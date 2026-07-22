/**
 * Нижняя панель.
 *
 * Держит на виду то, что игрок хочет проверить, не выходя из партии:
 * есть ли связь, сколько человек в комнате, какая версия сборки и где
 * искать автора. Собирается один раз, дальше обновляются только цифры.
 */
import { el } from '../../utils/dom.js';
import { store } from '../../core/store.js';
import { bus } from '../../core/eventBus.js';
import { t } from '../i18n.js';
import { VERSION } from '../../core/version.js';
import { LINKS } from '../../core/config.js';
import { isLocalMode } from '../../network/db.js';

/** Иконки: маленькие пути, чтобы не тянуть шрифт иконок ради трёх значков. */
const ICONS = {
  user: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4 0-8 2-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-3-4-5-8-5Z',
  players: 'M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 1a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4ZM8 14c-.4 0-.9 0-1.4.1C4.4 14.6 0 15.8 0 18v2h6v-2c0-1.3.6-2.4 1.6-3.2Z',
  tag: 'M12.4 2H4a2 2 0 0 0-2 2v8.4a2 2 0 0 0 .6 1.4l7.6 7.6a2 2 0 0 0 2.8 0l8.4-8.4a2 2 0 0 0 0-2.8L13.8 2.6a2 2 0 0 0-1.4-.6ZM7 8a1.5 1.5 0 1 1 1.5-1.5A1.5 1.5 0 0 1 7 8Z',
};

function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'statusbar__icon');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/** Монтирует панель в подвал страницы. */
export function initStatusBar() {
  const root = document.getElementById('statusbar');
  if (!root) return;

  const dot = el('span.statusbar__dot');
  const connectionLabel = el('span.statusbar__label');
  const playersLabel = el('span', {});

  const connection = el('div.statusbar__item', {}, dot, connectionLabel);
  const players = el('div.statusbar__item', {}, icon('players'), playersLabel);

  root.replaceChildren(
    el('div.statusbar__group', {}, connection, players),
    el('div.statusbar__group.statusbar__group--meta.statusbar__group--links', {},
      el('div.statusbar__item', {},
        icon('tag'), el('span.statusbar__label', {}, `v${VERSION}`)),
      el('div.statusbar__item', {},
        icon('user'), el('span', {}, LINKS.author)),
    ),
  );

  /** Онлайн считаем по комнате: вне комнаты честнее так и написать. */
  function refresh() {
    const local = isLocalMode();
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

    dot.className = `statusbar__dot${offline ? ' statusbar__dot--off' : local ? ' statusbar__dot--local' : ''}`;
    connectionLabel.textContent = offline
      ? t('status.offline')
      : local ? t('status.local') : t('status.online');

    const { room, players: list } = store.get();
    playersLabel.textContent = room
      ? t('status.inRoom', { n: list.length, max: room.settings.maxPlayers })
      : t('status.noRoom');
  }

  refresh();
  store.subscribe(refresh);
  bus.on('lang:change', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
}
