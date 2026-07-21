/**
 * Дневное голосование.
 * Голоса лежат отдельными документами (по одному на игрока), поэтому
 * переголосовать нельзя: запись всегда идёт по ключу round_uid.
 */
import { getRole } from '../roles/index.js';

/**
 * Подсчёт голосов.
 * @returns {{tally: Object, leaders: string[], executed: string|null, tie: boolean}}
 */
export function countVotes({ votes, players, defended = [] }) {
  const aliveIds = new Set(players.filter((p) => p.alive).map((p) => p.uid));
  const tally = {};

  for (const vote of votes) {
    if (!aliveIds.has(vote.voterId)) continue;      // мёртвые не голосуют
    if (!vote.targetId || !aliveIds.has(vote.targetId)) continue; // воздержался
    tally[vote.targetId] = (tally[vote.targetId] || 0) + 1;
  }

  const max = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter((uid) => tally[uid] === max);

  if (max === 0 || leaders.length !== 1) {
    return { tally, leaders, executed: null, tie: leaders.length > 1 };
  }

  const target = leaders[0];
  if (defended.includes(target)) {
    // Адвокат отбил подзащитного — город остаётся ни с чем.
    return { tally, leaders, executed: null, tie: false, defended: target };
  }
  return { tally, leaders, executed: target, tie: false };
}

/** Все ли живые уже проголосовали — можно закрывать фазу досрочно. */
export function everyoneVoted(votes, players) {
  const alive = players.filter((p) => p.alive).map((p) => p.uid);
  const voted = new Set(votes.map((v) => v.voterId));
  return alive.every((uid) => voted.has(uid));
}

/** Роль изгнанного — для сообщения городу, если это включено в настройках. */
export function executedRoleLabel(uid, roles) {
  return getRole(roles[uid]);
}
