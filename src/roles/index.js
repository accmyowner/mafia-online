/**
 * Реестр ролей.
 *
 * Чтобы добавить новую роль, достаточно двух шагов:
 *   1. создать файл src/roles/<id>.js по образцу существующих;
 *   2. добавить импорт в список ниже.
 * Настройки комнаты, экран правил и ночная обработка подхватят её сами.
 *
 * Контракт роли:
 *   id, icon, team ('town' | 'mafia' | 'solo'), order (порядок ночи),
 *   isBase, actsAtNight, knowsAllies, name/short/description/actionLabel,
 *   canTarget(ctx, actorId, targetId) -> boolean,
 *   resolve(ctx, action) -> void
 */
import civilian from './civilian.js';
import mafia from './mafia.js';
import don from './don.js';
import doctor from './doctor.js';
import sheriff from './sheriff.js';
import maniac from './maniac.js';
import bodyguard from './bodyguard.js';
import lover from './lover.js';
import lawyer from './lawyer.js';
import journalist from './journalist.js';
import witness from './witness.js';
import spy from './spy.js';
import poisoner from './poisoner.js';

const LIST = [
  civilian, mafia, don, doctor, sheriff,
  maniac, bodyguard, lover, lawyer,
  journalist, witness, spy, poisoner,
];

/** id -> описание роли. */
export const ROLES = Object.fromEntries(LIST.map((role) => [role.id, role]));

/** Все роли, которые можно назначать через настройки (мирный добирается сам). */
export const ASSIGNABLE = LIST.filter((role) => role.id !== 'civilian');

/** Базовые роли доступны всегда, дополнительные — по переключателю в комнате. */
export const BASE_ROLES = ASSIGNABLE.filter((role) => role.isBase);
export const EXTRA_ROLES = ASSIGNABLE.filter((role) => !role.isBase);

export function getRole(id) {
  return ROLES[id] || ROLES.civilian;
}

export function teamOfRole(id) {
  return getRole(id).team;
}

/** Роли, действующие ночью, в порядке обработки. */
export function nightOrder() {
  return LIST.filter((role) => role.actsAtNight).sort((a, b) => a.order - b.order);
}

/** Человеческое название команды. */
export const TEAM_LABEL = {
  town: { ru: 'Город', en: 'Town' },
  mafia: { ru: 'Мафия', en: 'Mafia' },
  solo: { ru: 'Одиночка', en: 'Solo' },
};
