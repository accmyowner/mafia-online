/**
 * Работа с комнатами: создание, вход, выход, настройки, действия,
 * голоса и чат. Модуль ничего не знает об интерфейсе и об игровых
 * правилах — только читает и пишет документы.
 *
 * Экономия обращений:
 *  - состояние партии лежит в одном документе комнаты (одна подписка);
 *  - список игроков — вторая и последняя постоянная подписка;
 *  - действия и голоса читаются пачкой один раз в конце фазы;
 *  - чат подписан только когда он реально открыт.
 */
import { db } from './db.js';
import { paths } from './paths.js';
import { teamOfRole } from '../roles/index.js';
import { roomCode as generateCode } from '../utils/random.js';
import { defaultSettings, LIMITS, AVATARS } from '../core/config.js';
import { VERSION, SCHEMA_VERSION } from '../core/version.js';
import { pickStable } from '../utils/random.js';
import { cleanName, cleanMessage } from '../utils/validate.js';

/** Пустое состояние партии. Хранится внутри документа комнаты. */
export function freshState() {
  return {
    phase: 'lobby',      // lobby | reveal | night | day | vote | ended
    round: 0,            // номер ночи/дня, начиная с 1
    phaseEndsAt: 0,      // метка времени окончания фазы (мс)
    winner: null,        // town | mafia | maniac
    lastNight: [],       // события прошедшей ночи для экрана дня
    lastVote: null,      // итог последнего голосования
    deaths: [],          // [{uid, round, cause, role}]
  };
}

/** Создаёт комнату и сажает в неё хозяина. Возвращает код. */
export async function createRoom(profile) {
  const store = db();
  // Коллизии кодов почти невозможны, но проверить дешевле, чем потерять комнату.
  let code = generateCode(LIMITS.codeLength);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!(await store.get(paths.room(code)))) break;
    code = generateCode(LIMITS.codeLength);
  }

  const now = store.now();
  await store.set(paths.room(code), {
    code,
    hostId: profile.uid,
    status: 'lobby',
    createdAt: now,
    updatedAt: now,
    appVersion: VERSION,
    schema: SCHEMA_VERSION,
    settings: defaultSettings(),
    state: freshState(),
  });

  await addPlayer(code, profile, { isHost: true });
  return code;
}

/** Собирает документ игрока. */
function playerDoc(profile, extra = {}) {
  return {
    uid: profile.uid,
    name: cleanName(profile.name) || 'Игрок',
    avatar: profile.avatar || pickStable(AVATARS, profile.uid),
    isHost: false,
    ready: false,
    alive: true,
    seenRole: false,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    ...extra,
  };
}

async function addPlayer(code, profile, extra) {
  await db().set(paths.player(code, profile.uid), playerDoc(profile, extra));
}

/**
 * Ошибки сети раньше уходили в общий обработчик и игрок видел только
 * «что-то пошло не так». Теперь причина возвращается вызывающему коду,
 * а подробность остаётся в консоли — по ней сразу видно, например,
 * что правила Firestore не развёрнуты.
 */
function networkError(scope, err) {
  console.error(`[rooms] ${scope}:`, err);
  return { error: 'network' };
}

/**
 * Вход в комнату.
 *
 * Игрок пишет ровно один документ — свой собственный: правила Firestore
 * не дают ему трогать ни комнату, ни чужие карточки. Поэтому место
 * занимается так: проверили, записались, перечитали список. Если за это
 * время кто-то успел занять последнее место, лишний сам убирает свою
 * карточку — порядок определяется временем входа, одинаковым для всех.
 *
 * Возвращает { ok } или { error: 'notFound' | 'full' | 'started' | 'network' }.
 */
export async function joinRoom(code, profile) {
  const store = db();

  try {
    const room = await store.get(paths.room(code));
    if (!room) return { error: 'notFound' };

    // Возвращение в свою партию разрешено всегда, новых игроков не пускаем.
    const existing = await store.get(paths.player(code, profile.uid));
    if (existing) {
      await store.update(paths.player(code, profile.uid), {
        name: cleanName(profile.name) || existing.name,
        avatar: profile.avatar || existing.avatar,
        lastSeen: Date.now(),
      });
      return { ok: true, rejoined: true };
    }
    if (room.status !== 'lobby') return { error: 'started' };

    const before = await store.list(paths.players(code));
    if (before.length >= room.settings.maxPlayers) return { error: 'full' };

    await addPlayer(code, profile, {});

    // Проверяем, что место действительно осталось за нами.
    const after = await store.list(paths.players(code));
    const seated = after
      .slice()
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
      .slice(0, room.settings.maxPlayers);

    if (!seated.some((p) => p.uid === profile.uid)) {
      await store.del(paths.player(code, profile.uid));
      return { error: 'full' };
    }

    return { ok: true, player: after.find((p) => p.uid === profile.uid) || null };
  } catch (err) {
    return networkError('вход в комнату', err);
  }
}

/** Выход из комнаты. Хозяйство передаётся следующему игроку. */
export async function leaveRoom(code, uid) {
  const store = db();
  const room = await store.get(paths.room(code));
  if (!room) return;

  await store.del(paths.player(code, uid));
  await store.del(paths.secret(code, uid));

  const rest = await store.list(paths.players(code));
  if (!rest.length) {
    await destroyRoom(code);
    return;
  }
  if (room.hostId === uid) {
    const heir = rest.slice().sort((a, b) => a.joinedAt - b.joinedAt)[0];
    await store.update(paths.room(code), { hostId: heir.uid, updatedAt: Date.now() });
    await store.update(paths.player(code, heir.uid), { isHost: true });
  }
}

/** Полностью удаляет комнату со всеми подколлекциями. */
export async function destroyRoom(code) {
  const store = db();
  await Promise.all([
    store.delCollection(paths.players(code)),
    store.delCollection(paths.secrets(code)),
    store.delCollection(paths.actions(code)),
    store.delCollection(paths.votes(code)),
    store.delCollection(paths.chat(code, 'town')),
    store.delCollection(paths.chat(code, 'mafia')),
  ]);
  await store.del(paths.room(code));
}

export async function setReady(code, uid, ready) {
  try {
    await db().update(paths.player(code, uid), { ready: Boolean(ready), lastSeen: Date.now() });
    return { ok: true };
  } catch (err) {
    return networkError('отметка готовности', err);
  }
}

export async function touch(code, uid) {
  await db().update(paths.player(code, uid), { lastSeen: Date.now() });
}

export async function updatePlayer(code, uid, patch) {
  await db().update(paths.player(code, uid), patch);
}

/** Настройки комнаты меняет только хозяин (это же проверяют правила Firestore). */
export async function updateSettings(code, settings) {
  try {
    await db().update(paths.room(code), { settings, updatedAt: Date.now() });
    return { ok: true };
  } catch (err) {
    return networkError('сохранение настроек комнаты', err);
  }
}

/** Обновление состояния партии одним документом — одна операция записи. */
export async function updateState(code, state, extra = {}) {
  await db().update(paths.room(code), { state, updatedAt: Date.now(), ...extra });
}

export async function getRoom(code) {
  return db().get(paths.room(code));
}

export async function listPlayers(code) {
  return db().list(paths.players(code));
}

/* ---------------- Роли ---------------- */

export async function setSecretRole(code, uid, role) {
  // Команду храним рядом с ролью: по ней правила Firestore решают,
  // пускать ли игрока в закрытый чат мафии.
  await db().set(paths.secret(code, uid), {
    uid, role, team: teamOfRole(role), assignedAt: Date.now(),
  });
}

export async function getMyRole(code, uid) {
  const doc = await db().get(paths.secret(code, uid));
  return doc?.role ?? null;
}

/** Все роли: читает хозяин при обработке ночи и все игроки в конце партии. */
export async function listRoles(code) {
  const rows = await db().list(paths.secrets(code));
  return Object.fromEntries(rows.filter((r) => r.uid && r.role).map((r) => [r.uid, r.role]));
}

/* ---------------- Ночные действия ---------------- */

export async function submitAction(code, round, uid, action) {
  await db().set(paths.action(code, round, uid), {
    ...action, actorId: uid, round, at: Date.now(),
  });
}

export async function listActions(code, round) {
  const rows = await db().list(paths.actions(code));
  return rows.filter((row) => row.round === round);
}

export async function getMyAction(code, round, uid) {
  return db().get(paths.action(code, round, uid));
}

/* ---------------- Голосование ---------------- */

export async function submitVote(code, round, uid, targetId) {
  await db().set(paths.vote(code, round, uid), {
    voterId: uid, targetId: targetId || null, round, at: Date.now(),
  });
}

export async function listVotes(code, round) {
  const rows = await db().list(paths.votes(code));
  return rows.filter((row) => row.round === round);
}

/* ---------------- Чат ---------------- */

export async function sendMessage(code, author, text, channel = 'town') {
  const body = cleanMessage(text);
  if (!body) return;
  const id = `${Date.now()}_${author.uid.slice(0, 6)}`;
  await db().set(paths.message(code, id, channel), {
    id, uid: author.uid, name: author.name, avatar: author.avatar, text: body, channel, at: Date.now(),
  });
}

/** Чистит прошлые голоса и действия перед новым кругом. */
export async function clearRoundData(code) {
  const store = db();
  await Promise.all([
    store.delCollection(paths.actions(code)),
    store.delCollection(paths.votes(code)),
  ]);
}

/* ---------------- Приватная память ведущего ---------------- */

/**
 * Отравленные, прошлые выборы и подзащитные адвоката не должны лежать
 * в документе комнаты: его читают все. Держим их в закрытом документе,
 * доступном только хозяину.
 */
export async function loadMemory(code) {
  return (await db().get(paths.memory(code))) || { poisoned: [], lastChoices: {}, defended: [] };
}

export async function saveMemory(code, memory) {
  await db().set(paths.memory(code), memory);
}

/** Список союзников для ролей, которые знают своих (мафия). */
export async function setAllies(code, uid, allies) {
  await db().update(paths.secret(code, uid), { allies });
}
