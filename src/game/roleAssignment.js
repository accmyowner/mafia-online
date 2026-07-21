/**
 * Раздача ролей.
 * Хозяин вызывает assignRoles() один раз при старте партии,
 * результат раскладывается по личным документам игроков.
 */
import { shuffle } from '../utils/random.js';
import { getRole, ASSIGNABLE } from '../roles/index.js';

/**
 * Собирает колоду ролей под количество игроков.
 * Лишние места добиваются мирными жителями.
 */
export function buildDeck(settings, playerCount) {
  const deck = [];
  for (const role of ASSIGNABLE) {
    if (!settings.extraRolesEnabled && !role.isBase) continue;
    const count = Math.max(0, Number(settings.roles?.[role.id]) || 0);
    for (let i = 0; i < count; i += 1) deck.push(role.id);
  }
  while (deck.length < playerCount) deck.push('civilian');
  return deck.slice(0, playerCount);
}

/**
 * Проверка состава перед стартом.
 * Возвращает { ok, reason }, где reason — ключ перевода.
 */
export function validateDeck(settings, playerCount) {
  const deck = buildDeck(settings, playerCount);
  const teams = deck.map((id) => getRole(id).team);
  const mafiaCount = teams.filter((team) => team === 'mafia').length;
  const soloCount = teams.filter((team) => team === 'solo').length;
  const townCount = teams.filter((team) => team === 'town').length;

  const requested = Object.entries(settings.roles || {})
    .filter(([id]) => settings.extraRolesEnabled || getRole(id).isBase)
    .reduce((sum, [, n]) => sum + (Number(n) || 0), 0);

  if (requested > playerCount) return { ok: false, reason: 'settings.balanceTooMany' };
  if (mafiaCount === 0 && soloCount === 0) return { ok: false, reason: 'settings.balanceNoMafia' };
  if (mafiaCount >= townCount + soloCount) return { ok: false, reason: 'settings.balanceMafiaWins' };
  return { ok: true, reason: 'settings.balanceOk', civilians: deck.filter((id) => id === 'civilian').length };
}

/**
 * Случайно распределяет колоду между игроками.
 * Возвращает объект { uid: roleId }.
 */
export function assignRoles(settings, players) {
  const deck = shuffle(buildDeck(settings, players.length));
  const seats = shuffle(players.map((p) => p.uid));
  return Object.fromEntries(seats.map((uid, index) => [uid, deck[index] || 'civilian']));
}
