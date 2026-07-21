/**
 * Экран «О разработчике»: коротко о проекте и его устройстве.
 */
import { el } from '../../utils/dom.js';
import { t } from '../i18n.js';
import { router } from '../../core/router.js';
import { VERSION, BUILD_DATE, SCHEMA_VERSION } from '../../core/version.js';
import { isLocalMode } from '../../network/db.js';

export function renderAbout() {
  const facts = [
    ['Версия', `${VERSION} (${BUILD_DATE})`],
    ['Схема базы', String(SCHEMA_VERSION)],
    ['Хранилище', isLocalMode() ? 'localStorage (локальный режим)' : 'Firebase Firestore'],
    ['Технологии', 'HTML5, CSS3, ES-модули, Firebase'],
    ['Зависимости', 'нет — ни npm, ни сборщика'],
  ];

  return el('div.screen', {},
    el('div.head', {},
      el('button.back', { type: 'button', onClick: () => router.go('menu') }, '←', t('common.back')),
      el('h2', {}, t('about.title')),
    ),

    el('section.panel.prose', {},
      el('p', {}, 'Мафия Online — браузерная игра без единой зависимости: чистый JavaScript, ' +
        'модульная структура и Firebase в роли сервера. Проект собран так, чтобы его можно было ' +
        'развивать годами: новая роль — новый файл в src/roles, новый экран — новый модуль в src/ui.'),
      el('h3', {}, 'Как всё устроено'),
      el('ul', {},
        el('li', {}, 'src/core — шина событий, хранилище состояния, роутер.'),
        el('li', {}, 'src/network — адаптеры хранилища и подписки на данные.'),
        el('li', {}, 'src/game — движок партии, обработка ночи, голосование, победа.'),
        el('li', {}, 'src/roles — по файлу на роль с единым контрактом.'),
        el('li', {}, 'src/ui — экраны и компоненты интерфейса.'),
      ),
      el('h3', {}, 'Обратная связь'),
      el('p', {}, 'Нашли ошибку в правилах или хотите новую роль — начните с README: там описан ' +
        'контракт роли и порядок обработки ночи.'),
    ),

    el('section.panel', {},
      el('div.eyebrow', {}, 'Сборка'),
      el('div.reveal-list', {}, facts.map(([key, value]) =>
        el('div.reveal-row', {}, el('span.dim', {}, key), el('span.mono', {}, value)))),
    ),
  );
}
