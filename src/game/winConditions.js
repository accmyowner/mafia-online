/**
 * Условия победы.
 * Проверяются после каждой ночи и после каждого голосования.
 */
import { teamOfRole } from '../roles/index.js';

/**
 * @returns {'town'|'mafia'|'maniac'|null} команда-победитель или null,
 * если партия продолжается.
 */
export function checkWinner(players, roles) {
  const alive = players.filter((p) => p.alive);
  const teams = alive.map((p) => teamOfRole(roles[p.uid] || 'civilian'));

  const mafia = teams.filter((team) => team === 'mafia').length;
  const solo = teams.filter((team) => team === 'solo').length;
  const town = teams.filter((team) => team === 'town').length;

  // Все преступники устранены.
  if (mafia === 0 && solo === 0) return 'town';

  // Одиночка остался вдвоём с последней жертвой или один.
  if (solo > 0 && alive.length <= 2) return 'maniac';

  // Мафии столько же или больше, чем всех остальных.
  if (mafia > 0 && solo === 0 && mafia >= town) return 'mafia';

  // Никого не осталось — считаем ничьей в пользу города.
  if (alive.length === 0) return 'town';

  return null;
}

/** Ключи перевода для финального экрана. */
export function winnerLabels(winner) {
  return {
    town: { title: 'end.winTown', sub: 'end.subTown', tone: 'town' },
    mafia: { title: 'end.winMafia', sub: 'end.subMafia', tone: 'mafia' },
    maniac: { title: 'end.winManiac', sub: 'end.subManiac', tone: 'solo' },
  }[winner] || { title: 'game.phase.ended', sub: '', tone: 'town' };
}
