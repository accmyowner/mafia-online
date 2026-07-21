/**
 * Карточка игрока: используется в лобби, ночью, при голосовании
 * и на финальном экране.
 */
import { el } from '../../utils/dom.js';
import { t, tr } from '../i18n.js';
import { getRole } from '../../roles/index.js';

/**
 * @param {Object} player  документ игрока
 * @param {Object} options { index, me, selectable, selected, votes, role, tags, onSelect, extra }
 */
export function playerCard(player, options = {}) {
  const {
    index = 0, me = false, selectable = false, selected = false,
    votes = 0, role = null, tags = [], onSelect = null, disabled = false,
  } = options;

  const classes = [
    'player',
    me ? 'player--me' : '',
    selectable && !disabled ? 'player--selectable' : '',
    selected ? 'player--selected' : '',
    player.alive === false ? 'player--dead' : '',
  ].filter(Boolean).join('.');

  const roleInfo = role ? getRole(role) : null;

  const node = el(`${classes ? 'div.' + classes : 'div'}`, {
    style: { '--i': index },
    dataset: { uid: player.uid },
    role: selectable ? 'button' : undefined,
    tabIndex: selectable && !disabled ? 0 : undefined,
    onClick: selectable && !disabled ? () => onSelect?.(player) : undefined,
    onKeydown: selectable && !disabled
      ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(player); } }
      : undefined,
  },
    votes > 0 ? el('span.player__votes.mono', {}, votes) : null,
    el('div.player__avatar', {}, player.avatar || '🎩'),
    el('div.player__name', {}, player.name),
    roleInfo ? el('div.player__meta', {}, `${roleInfo.icon} ${tr(roleInfo.name)}`) : null,
    tags.length
      ? el('div.player__tags', {}, tags.map((tag) => el(`span.tag.tag--${tag.tone || 'info'}`, {}, tag.label)))
      : null,
  );

  return node;
}

/** Готовые бейджи для лобби. */
export function lobbyTags(player, hostId) {
  const tags = [];
  if (player.uid === hostId) tags.push({ label: t('lobby.host'), tone: 'host' });
  tags.push(player.ready
    ? { label: t('lobby.ready'), tone: 'ready' }
    : { label: t('lobby.notReady'), tone: 'info' });
  return tags;
}
