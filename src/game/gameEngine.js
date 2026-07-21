/**
 * Ведущий партии.
 *
 * Движок работает у хозяина комнаты: только он переводит фазы, считает
 * ночь и объявляет победителя. Остальные клиенты просто читают документ
 * комнаты. Так на всю партию приходится один автор записей вместо
 * гонки нескольких.
 *
 * Если хозяин закрыл вкладку, права переходят следующему игроку
 * (см. roomsRepo.leaveRoom), и движок подхватывает партию с той же точки.
 */
import { store } from '../core/store.js';
import { bus } from '../core/eventBus.js';
import {
  updateState, setSecretRole, listActions, listVotes, listRoles,
  updatePlayer, clearRoundData, freshState, updateSettings,
  loadMemory, saveMemory, setAllies,
} from '../network/roomsRepo.js';
import { db } from '../network/db.js';
import { paths } from '../network/paths.js';
import { assignRoles, validateDeck } from './roleAssignment.js';
import { resolveNight } from './nightResolver.js';
import { countVotes, everyoneVoted } from './voting.js';
import { checkWinner } from './winConditions.js';
import { getRole, teamOfRole } from '../roles/index.js';

const REVEAL_SECONDS = 8;
const TICK_MS = 1200;

class GameEngine {
  constructor() {
    this.timer = null;
    this.code = null;
    this.busy = false;
  }

  /** Включается при входе в комнату; сам решает, ведущий он или нет. */
  attach(code) {
    this.code = code;
    this.detach();
    this.timer = setInterval(() => this.#tick(), TICK_MS);
  }

  detach() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Старт партии                                                       */
  /* ------------------------------------------------------------------ */

  /** Проверяет состав, раздаёт роли и открывает фазу знакомства с картой. */
  async startGame() {
    const { room, players } = store.get();
    if (!store.isHost || !room) return { error: 'error.notHost' };

    const check = validateDeck(room.settings, players.length);
    if (!check.ok) return { error: check.reason };

    const roles = assignRoles(room.settings, players);
    // Роли лежат в личных документах: их видит только владелец.
    await Promise.all(Object.entries(roles).map(([uid, role]) => setSecretRole(this.code, uid, role)));

    // Мафия знает своих: раскладываем список союзников по их же документам.
    const mafiaIds = Object.keys(roles).filter((uid) => teamOfRole(roles[uid]) === 'mafia');
    await Promise.all(mafiaIds.map((uid) => setAllies(this.code, uid, mafiaIds.filter((x) => x !== uid))));
    await saveMemory(this.code, { poisoned: [], lastChoices: {}, defended: [] });
    await Promise.all(players.map((p) => updatePlayer(this.code, p.uid, { alive: true, ready: false, seenRole: false })));
    await clearRoundData(this.code);

    const state = {
      ...freshState(),
      phase: 'reveal',
      round: 1,
      phaseEndsAt: Date.now() + REVEAL_SECONDS * 1000,
    };
    await updateState(this.code, state, { status: 'playing' });
    return { ok: true };
  }

  /** Возврат всей комнаты в лобби после партии. */
  async backToLobby() {
    if (!store.isHost) return;
    const { players } = store.get();
    await clearRoundData(this.code);
    await db().delCollection(paths.secrets(this.code));
    await Promise.all(players.map((p) => updatePlayer(this.code, p.uid, { alive: true, ready: false, seenRole: false })));
    await updateState(this.code, freshState(), { status: 'lobby' });
  }

  /* ------------------------------------------------------------------ */
  /*  Основной цикл                                                      */
  /* ------------------------------------------------------------------ */

  async #tick() {
    if (this.busy || !store.isHost) return;
    const { room, players } = store.get();
    if (!room || room.status !== 'playing') return;

    const { phase, phaseEndsAt } = room.state;
    const timeUp = phaseEndsAt > 0 && Date.now() >= phaseEndsAt;

    this.busy = true;
    try {
      if (phase === 'reveal' && timeUp) await this.#openNight(room, players);
      else if (phase === 'night') {
        if (timeUp || await this.#everyoneActed(room, players)) await this.#closeNight(room, players);
      } else if (phase === 'day' && timeUp) await this.#openVote(room);
      else if (phase === 'vote') {
        const votes = await listVotes(this.code, room.state.round);
        if (timeUp || everyoneVoted(votes, players)) await this.#closeVote(room, players, votes);
      }
    } catch (err) {
      console.error('[engine] сбой такта:', err);
    } finally {
      this.busy = false;
    }
  }

  /** Все ли активные роли уже сходили: экономит ожидание таймера. */
  async #everyoneActed(room, players) {
    const roles = await listRoles(this.code);
    const actors = players.filter((p) => p.alive && getRole(roles[p.uid]).actsAtNight);
    if (!actors.length) return true;
    const actions = await listActions(this.code, room.state.round);
    const done = new Set(actions.map((a) => a.actorId));
    return actors.every((p) => done.has(p.uid));
  }

  async #openNight(room, players) {
    const seconds = room.settings.nightTime;
    await updateState(this.code, {
      ...room.state,
      phase: 'night',
      phaseEndsAt: Date.now() + seconds * 1000,
      lastNight: [],
    });
  }

  /** Считает ночь, разносит личные результаты и открывает день. */
  async #closeNight(room, players) {
    const [roles, actions, memory] = await Promise.all([
      listRoles(this.code),
      listActions(this.code, room.state.round),
      loadMemory(this.code),
    ]);

    const result = resolveNight({
      round: room.state.round,
      roles,
      players,
      actions,
      memory,
    });

    // Приватная память ведущего обновляется отдельно от документа комнаты.
    await saveMemory(this.code, {
      poisoned: result.poisoned,
      lastChoices: result.lastChoices,
      defended: result.defended,
    });

    // Личные результаты проверок кладём в закрытые документы игроков.
    await Promise.all(Object.entries(result.notes).map(([uid, notes]) =>
      db().update(paths.secret(this.code, uid), { notes, notesRound: room.state.round })));

    // Отмечаем погибших.
    await Promise.all(result.deaths.map((death) =>
      updatePlayer(this.code, death.uid, { alive: false, diedRound: room.state.round, diedCause: death.cause })));

    const players2 = players.map((p) =>
      result.deaths.some((d) => d.uid === p.uid) ? { ...p, alive: false } : p);

    const winner = checkWinner(players2, roles);
    const events = [
      ...result.publicEvents,
      ...result.deaths.map((death) => ({
        type: 'death',
        uid: death.uid,
        name: death.name,
        role: room.settings.revealRoleOnDeath ? death.role : null,
      })),
    ];

    const state = {
      ...room.state,
      phase: winner ? 'ended' : 'day',
      phaseEndsAt: winner ? 0 : Date.now() + room.settings.dayTime * 1000,
      lastNight: events,
      deaths: [...(room.state.deaths || []), ...result.deaths.map((d) => ({ ...d, round: room.state.round }))],
      winner: winner || null,
    };
    await updateState(this.code, state, winner ? { status: 'finished' } : {});
  }

  async #openVote(room) {
    await updateState(this.code, {
      ...room.state,
      phase: 'vote',
      phaseEndsAt: Date.now() + room.settings.voteTime * 1000,
    });
  }

  /** Считает голоса, выводит игрока и решает, продолжается ли партия. */
  async #closeVote(room, players, votes) {
    const [roles, memory] = await Promise.all([listRoles(this.code), loadMemory(this.code)]);
    const outcome = countVotes({ votes, players, defended: memory.defended || [] });

    let players2 = players;
    if (outcome.executed) {
      await updatePlayer(this.code, outcome.executed, {
        alive: false, diedRound: room.state.round, diedCause: 'vote',
      });
      players2 = players.map((p) => (p.uid === outcome.executed ? { ...p, alive: false } : p));
    }

    const winner = checkWinner(players2, roles);
    const executedName = outcome.executed ? players.find((p) => p.uid === outcome.executed)?.name : null;

    const state = {
      ...room.state,
      phase: winner ? 'ended' : 'night',
      round: winner ? room.state.round : room.state.round + 1,
      phaseEndsAt: winner ? 0 : Date.now() + room.settings.nightTime * 1000,
      lastVote: {
        tally: outcome.tally,
        tie: outcome.tie,
        defended: outcome.defended || null,
        executed: outcome.executed || null,
        executedName,
        executedRole: outcome.executed && room.settings.revealRoleOnDeath ? roles[outcome.executed] : null,
      },
      deaths: outcome.executed
        ? [...(room.state.deaths || []), {
            uid: outcome.executed, name: executedName, cause: 'vote',
            role: roles[outcome.executed], round: room.state.round,
          }]
        : room.state.deaths,
      lastNight: [],
      winner: winner || null,
    };

    if (!winner) await clearRoundData(this.code); // старые голоса и действия больше не нужны
    await updateState(this.code, state, winner ? { status: 'finished' } : {});
  }
}

export const engine = new GameEngine();

/** Настройки комнаты меняет только хозяин — проверяем и здесь, и в правилах. */
export async function saveRoomSettings(code, settings) {
  if (!store.isHost) {
    bus.emit('toast', { text: 'error.notHost', tone: 'error' });
    return { error: 'notHost' };
  }
  return updateSettings(code, settings);
}
