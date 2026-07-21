/**
 * Правила игры и справочник ролей.
 * Список ролей строится из реестра, поэтому новая роль появляется
 * здесь автоматически.
 */
import { el } from '../../utils/dom.js';
import { t, tr } from '../i18n.js';
import { router } from '../../core/router.js';
import { ROLES, BASE_ROLES, EXTRA_ROLES, TEAM_LABEL } from '../../roles/index.js';

function roleDoc(role, index = 0) {
  return el('article.role-doc', { style: { '--i': index } },
    el('div.role-doc__head', {},
      el('span.role-doc__icon', {}, role.icon),
      el('span.role-doc__name', {}, tr(role.name)),
      el(`span.tag.tag--${role.team}`, {}, tr(TEAM_LABEL[role.team])),
    ),
    el('p.dim', {}, tr(role.description)),
  );
}

export function renderRules() {
  return el('div.screen', {},
    el('div.head', {},
      el('button.back', { type: 'button', onClick: () => router.go('menu') }, '←', t('common.back')),
      el('h2', {}, t('rules.title')),
    ),

    el('section.panel.prose', {},
      el('p', {}, 'Город живёт по кругу: ночь, утро, обсуждение, голосование. ' +
        'Мафия знает своих и убивает по ночам. Город не знает никого и ищет виноватых днём.'),

      el('h3', {}, 'Ночь'),
      el('ul', {},
        el('li', {}, 'Каждая активная роль выбирает одного игрока.'),
        el('li', {}, 'Выбор можно поменять, пока идёт таймер, — засчитывается последний.'),
        el('li', {}, 'Как только все сходили, ночь заканчивается досрочно.'),
      ),

      el('h3', {}, 'Утро'),
      el('ul', {},
        el('li', {}, 'Город узнаёт, кто погиб. Роль погибшего открывается, если это включено в комнате.'),
        el('li', {}, 'Результаты проверок видит только тот, кто проверял.'),
      ),

      el('h3', {}, 'Голосование'),
      el('ul', {},
        el('li', {}, 'Каждый живой игрок отдаёт один голос или воздерживается.'),
        el('li', {}, 'Переголосовать нельзя.'),
        el('li', {}, 'При равенстве голосов из города никто не уходит.'),
      ),

      el('h3', {}, 'Победа'),
      el('ul', {},
        el('li', {}, 'Город побеждает, когда не осталось ни мафии, ни маньяка.'),
        el('li', {}, 'Мафия побеждает, когда её не меньше, чем остальных.'),
        el('li', {}, 'Маньяк побеждает, когда за столом остаются только он и последняя жертва.'),
      ),
    ),

    el('section.stack', {},
      el('h3', {}, t('rules.rolesTitle')),
      el('div.eyebrow', {}, 'Базовые'),
      el('div.grid.grid--roles', {}, BASE_ROLES.concat(ROLES.civilian).map((role, i) => roleDoc(role, i))),
      el('div.eyebrow', { style: { marginTop: '12px' } }, 'Дополнительные'),
      el('div.grid.grid--roles', {}, EXTRA_ROLES.map((role, i) => roleDoc(role, i))),
    ),
  );
}
