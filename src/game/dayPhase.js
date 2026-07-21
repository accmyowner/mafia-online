/**
 * Утренняя сводка: что произошло ночью и чем закончилось голосование.
 * Формирует список событий для ленты — без записей в базу.
 */
import { el } from '../utils/dom.js';
import { t, tr } from '../ui/i18n.js';
import { getRole } from '../roles/index.js';

/** Публичные события ночи -> элементы ленты. */
export function nightSummary(events = []) {
  if (!events.length) {
    return [el('div.feed__item.feed__item--info', {}, t('game.nobodyDied'))];
  }

  return events.map((event) => {
    if (event.type === 'death') {
      const role = event.role ? getRole(event.role) : null;
      return el('div.feed__item.feed__item--death', {},
        el('span', {}, t('game.died', { name: event.name })),
        role ? el('span.faint', {}, ` · ${role.icon} ${tr(role.name)}`) : null,
      );
    }
    const tone = event.type === 'save' ? 'save' : 'info';
    return el(`div.feed__item.feed__item--${tone}`, {}, tr(event.text));
  });
}

/** Итог прошлого голосования -> элемент ленты. */
export function voteSummary(lastVote) {
  if (!lastVote) return null;
  if (lastVote.executed) {
    const role = lastVote.executedRole ? getRole(lastVote.executedRole) : null;
    return el('div.feed__item.feed__item--death', {},
      el('span', {}, t('game.executed', { name: lastVote.executedName })),
      role ? el('span.faint', {}, ` · ${role.icon} ${tr(role.name)}`) : null,
    );
  }
  if (lastVote.defended) {
    return el('div.feed__item.feed__item--save', {}, t('game.tie'));
  }
  return el('div.feed__item.feed__item--info', {}, t('game.tie'));
}

/** Личные результаты проверок текущего игрока. */
export function personalNotes(notes = []) {
  return notes.map((note) => el(`div.feed__item.feed__item--${note.type === 'check' ? 'info' : 'save'}`, {},
    el('span.mono', { style: { marginRight: '8px' } }, '★'),
    el('span', {}, tr(note.text)),
  ));
}
