/**
 * Точка входа.
 *
 * Порядок важен: сначала настройки и тема (чтобы не мигал экран),
 * затем подключение к хранилищу, затем маршруты.
 */
import { store } from './core/store.js';
import { router } from './core/router.js';
import { bus } from './core/eventBus.js';
import { connect, isLocalMode, onWatchError } from './network/db.js';
import { load } from './utils/storage.js';
import { STORAGE_KEYS, AVATARS } from './core/config.js';
import { setLanguage } from './ui/i18n.js';
import { applyTheme, applyPhase } from './ui/theme.js';
import { sound, bindClickSound } from './utils/sound.js';
import { initToasts, showToast } from './ui/components/toast.js';
import { initStatusBar } from './ui/components/statusBar.js';
import { initAtmosphere } from './ui/atmosphere.js';
import { pickStable } from './utils/random.js';
import { VERSION } from './core/version.js';

import { renderMenu } from './ui/screens/menu.js';
import { renderSettings } from './ui/screens/settings.js';
import { renderRules } from './ui/screens/rules.js';
import { renderAbout } from './ui/screens/about.js';
import { renderCreate } from './lobby/createRoom.js';
import { renderJoin } from './lobby/joinRoom.js';
import { renderLobby } from './lobby/lobbyScreen.js';
import { renderGame } from './ui/screens/game.js';

/** Сохранённые настройки клиента применяются до первой отрисовки. */
function restorePreferences() {
  const prefs = load(STORAGE_KEYS.settings, null);
  if (prefs) store.patchPrefs(prefs);
  const current = store.get().prefs;
  setLanguage(current.lang);
  applyTheme(current.theme);
  // Звуковой менеджер сам слушает событие 'prefs:change' и подстраивает громкость.
}

/** Профиль игрока: имя и аватар живут в этом браузере. */
function restoreProfile(uid) {
  const saved = load(STORAGE_KEYS.profile, {});
  store.patch({
    name: saved.name || '',
    avatar: saved.avatar || pickStable(AVATARS, uid),
  });
}

function registerScreens() {
  router.register('menu', renderMenu);
  router.register('create', renderCreate);
  router.register('join', renderJoin);
  router.register('lobby', renderLobby);
  router.register('game', renderGame);
  router.register('settings', renderSettings);
  router.register('rules', renderRules);
  router.register('about', renderAbout);
}

async function boot() {
  restorePreferences();
  applyPhase('lobby');
  initAtmosphere();
  initToasts();
  initStatusBar();
  registerScreens();

  try {
    const uid = await connect();
    restoreProfile(uid);
    if (isLocalMode()) {
      showToast('Сервер недоступен: игра идёт в локальном режиме, соседние устройства друг друга не увидят.', 'warn', 7000);
    }
    // Оборванная подписка = список игроков перестаёт обновляться.
    // Молчать об этом нельзя: со стороны выглядит как «никто не заходит».
    onWatchError(() => showToast('Обновления из базы не приходят. Проверьте связь и правила доступа Firestore.', 'error', 7000));
  } catch (err) {
    console.error('[boot] хранилище недоступно:', err);
    showToast('Не удалось подключиться к серверу. Игра работает в локальном режиме.', 'warn', 6000);
  }

  bindClickSound(document.body);
  document.addEventListener('pointerdown', () => sound.init(), { once: true });

  router.start('menu');
  console.info(`Мафия Online v${VERSION} · режим: ${isLocalMode() ? 'локальный' : 'firebase'}`);
}

// Ошибки в промисах не должны молчать: игрок хотя бы увидит уведомление.
window.addEventListener('unhandledrejection', (event) => {
  console.error('[app] необработанная ошибка:', event.reason);
  bus.emit('toast', { text: 'error.generic', tone: 'error' });
});

boot();
