/**
 * Открытие роли: карта переворачивается по нажатию.
 * Это единственный крупный эффект в игре — на нём держится момент,
 * ради которого все и садятся за стол.
 */
import { el } from '../../utils/dom.js';
import { t, tr } from '../i18n.js';
import { getRole, TEAM_LABEL } from '../../roles/index.js';
import { sound } from '../../utils/sound.js';

export function roleCard(roleId, { open = false, onOpen } = {}) {
  const role = getRole(roleId);
  const card = el(`div.role-card.role-card--${role.team}`, {
    role: 'button',
    tabIndex: 0,
    'aria-label': t('game.tapToReveal'),
  },
    el('div.role-card__inner', {},
      el('div.role-card__face.role-card__face--front'),
      el('div.role-card__face.role-card__face--back', {},
        el('div.role-card__icon', {}, role.icon),
        el('div.role-card__name', {}, tr(role.name)),
        el('div.eyebrow', {}, tr(TEAM_LABEL[role.team])),
        el('p.role-card__desc', {}, tr(role.description)),
      ),
    ),
  );

  const reveal = () => {
    if (card.classList.contains('role-card--open')) return;
    card.classList.add('role-card--open');
    sound.play('reveal');
    onOpen?.();
  };

  card.addEventListener('click', reveal);
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); reveal(); }
  });
  if (open) requestAnimationFrame(reveal);

  return card;
}

/** Компактная плашка «моя роль» на игровом экране. */
export function myRoleBadge(roleId) {
  const role = getRole(roleId);
  return el(`div.my-role.my-role--${role.team}`, {},
    el('span.my-role__icon', {}, role.icon),
    el('div', {},
      el('div.my-role__name', {}, tr(role.name)),
      el('div.faint', { style: { fontSize: '0.8em' } }, tr(role.short)),
    ),
  );
}
