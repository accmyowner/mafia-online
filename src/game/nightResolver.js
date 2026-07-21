/**
 * Обработка ночи.
 *
 * Роли не знают друг о друге: каждая получает общий контекст и
 * заявляет намерение (убить, вылечить, заблокировать, проверить).
 * Итог считается один раз в конце — так порядок ролей не превращается
 * в набор частных случаев.
 *
 * Порядок: блокировки -> защита -> лечение -> убийства -> яд -> проверки.
 */
import { getRole, teamOfRole } from '../roles/index.js';

/** Собирает контекст ночи. */
export function createContext({ round, roles, players, memory }) {
  const byUid = Object.fromEntries(players.map((p) => [p.uid, p]));
  const aliveIds = new Set(players.filter((p) => p.alive).map((p) => p.uid));

  const ctx = {
    round,
    roles,
    players: byUid,
    aliveIds,
    memory,

    blocked: new Set(),
    healed: new Set(),
    defended: new Set(),
    guards: new Map(),      // подопечный -> телохранитель
    kills: [],              // {by, target, cause}
    poisonNew: new Set(),
    visits: new Map(),      // цель -> [кто приходил]
    actedBy: new Set(),     // кто вообще действовал этой ночью
    notes: {},              // uid -> [{type, text}]
    publicEvents: [],       // видно всему городу утром

    /* --- справки --- */
    roleOf: (uid) => roles[uid] || 'civilian',
    teamOf: (uid) => teamOfRole(roles[uid] || 'civilian'),
    nameOf: (uid) => byUid[uid]?.name || '???',
    isAlive: (uid) => aliveIds.has(uid),
    hasNightAbility: (uid) => getRole(roles[uid]).actsAtNight,
    didAct: (uid) => ctx.actedBy.has(uid),
    visitorsOf: (uid) => ctx.visits.get(uid) || [],
    isPoisoned: (uid) => (memory.poisoned || []).some((p) => p.uid === uid),
    /** Кого этот игрок выбирал прошлой ночью (для доктора и любовницы). */
    previousChoice: (uid) => memory.lastChoices?.[uid] ?? null,

    /* --- намерения --- */
    block: (uid) => ctx.blocked.add(uid),
    heal: (uid) => ctx.healed.add(uid),
    defend: (uid) => ctx.defended.add(uid),
    guard: (target, guardUid) => ctx.guards.set(target, guardUid),
    poison: (uid) => ctx.poisonNew.add(uid),
    kill: (by, target, cause) => ctx.kills.push({ by, target, cause }),
    cancelKillsBy: (cause) => { ctx.kills = ctx.kills.filter((k) => k.cause !== cause); },
    note: (uid, entry) => { (ctx.notes[uid] ||= []).push(entry); },
    publish: (entry) => ctx.publicEvents.push(entry),
  };

  return ctx;
}

/**
 * Прогоняет действия ночи и возвращает результат.
 * @returns {{deaths: Array, publicEvents: Array, notes: Object, poisoned: Array, lastChoices: Object}}
 */
export function resolveNight({ round, roles, players, actions, memory }) {
  const ctx = createContext({ round, roles, players, memory });

  // Отсекаем всё, что пришло от выбывших или по несуществующим целям.
  const valid = actions.filter((action) => {
    if (!ctx.isAlive(action.actorId)) return false;
    if (action.targetId && !ctx.players[action.targetId]) return false;
    return true;
  });

  // Сначала записываем визиты: свидетель должен видеть даже тех,
  // чьё действие потом отменят.
  for (const action of valid) {
    if (!action.targetId) continue;
    ctx.actedBy.add(action.actorId);
    const list = ctx.visits.get(action.targetId) || [];
    list.push(action.actorId);
    ctx.visits.set(action.targetId, list);
  }

  // Затем — по порядку ролей.
  const ordered = valid
    .map((action) => ({ action, role: getRole(ctx.roleOf(action.actorId)) }))
    .filter(({ role }) => role.actsAtNight && typeof role.resolve === 'function')
    .sort((a, b) => a.role.order - b.role.order);

  for (const { action, role } of ordered) {
    if (ctx.blocked.has(action.actorId)) continue;   // любовница отвлекла
    if (!action.targetId) continue;                  // игрок пропустил ход
    role.resolve(ctx, action);
  }

  return finalize(ctx, valid);
}

/** Считает, кто в итоге погиб, и обновляет список отравленных. */
function finalize(ctx, actions) {
  const deaths = [];
  const dying = new Set();

  const die = (uid, cause) => {
    if (dying.has(uid)) return;
    dying.add(uid);
    deaths.push({ uid, cause, role: ctx.roleOf(uid), name: ctx.nameOf(uid) });
  };

  // 1. Мафия стреляет один раз за ночь: если её выборы разошлись,
  //    выигрывает самый популярный (слово дона уже отменило остальные).
  const mafiaKills = ctx.kills.filter((k) => k.cause === 'mafia');
  let kills = ctx.kills.filter((k) => k.cause !== 'mafia');
  if (mafiaKills.length) {
    const tally = new Map();
    for (const kill of mafiaKills) tally.set(kill.target, (tally.get(kill.target) || 0) + 1);
    let best = mafiaKills[0];
    let bestCount = 0;
    for (const kill of mafiaKills) {
      const count = tally.get(kill.target);
      if (count > bestCount) { best = kill; bestCount = count; }
    }
    kills = [...kills, best];
  }

  // 2. Прямые убийства с учётом лечения и телохранителя.
  for (const { target, cause } of kills) {
    if (!ctx.isAlive(target)) continue;

    const guard = ctx.guards.get(target);
    if (guard && ctx.isAlive(guard) && !ctx.blocked.has(guard)) {
      die(guard, 'guard');       // телохранитель принял удар
      continue;
    }
    if (ctx.healed.has(target)) {
      ctx.publish({ type: 'save', text: { ru: 'Этой ночью кого-то спасли', en: 'Someone was saved tonight' } });
      continue;
    }
    die(target, cause);
  }

  // 3. Яд прошлых ночей: срок вышел — умирает, если доктор не вылечил.
  const carried = [];
  for (const entry of ctx.memory.poisoned || []) {
    if (!ctx.isAlive(entry.uid)) continue;
    if (ctx.healed.has(entry.uid)) {
      ctx.publish({ type: 'save', text: { ru: 'Кого-то откачали после отравления', en: 'Someone recovered from poison' } });
      continue;
    }
    const left = entry.nightsLeft - 1;
    if (left <= 0) die(entry.uid, 'poison');
    else carried.push({ uid: entry.uid, nightsLeft: left });
  }
  // 4. Свежий яд ждёт своей ночи.
  for (const uid of ctx.poisonNew) {
    if (ctx.isAlive(uid) && !dying.has(uid)) carried.push({ uid, nightsLeft: 1 });
  }

  // 5. Публичная сводка утра.
  if (deaths.length === 0 && ctx.publicEvents.length === 0) {
    ctx.publish({ type: 'info', text: { ru: 'Ночь прошла спокойно', en: 'The night passed quietly' } });
  }

  // 6. Что кто выбирал — понадобится в следующую ночь.
  const lastChoices = Object.fromEntries(actions.filter((a) => a.targetId).map((a) => [a.actorId, a.targetId]));

  return {
    deaths,
    publicEvents: ctx.publicEvents,
    notes: ctx.notes,
    poisoned: carried,
    defended: [...ctx.defended],
    lastChoices,
  };
}
