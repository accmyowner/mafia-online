/**
 * Простейший роутер по хэшу адреса.
 * Экран — это функция, которая возвращает DOM-элемент и (необязательно)
 * функцию очистки, вызываемую при уходе с экрана.
 *
 *   router.register('lobby', renderLobby);
 *   router.go('lobby', { code: 'Q7DKL' });
 */
import { bus } from './eventBus.js';

class Router {
  constructor(mountId = 'app') {
    this.mount = document.getElementById(mountId);
    this.routes = new Map();
    this.current = null;
    this.cleanup = null;
    window.addEventListener('hashchange', () => this.#syncFromHash());
  }

  register(name, factory) {
    this.routes.set(name, factory);
    return this;
  }

  /** Переход на экран. Параметры передаются напрямую, не через URL. */
  go(name, params = {}) {
    if (!this.routes.has(name)) {
      console.warn(`[router] неизвестный экран: ${name}`);
      return;
    }
    this.#render(name, params);
    const hash = `#/${name}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  /** Разбирает адрес при первой загрузке страницы. */
  start(fallback = 'menu') {
    const name = location.hash.replace('#/', '').split('?')[0];
    this.go(this.routes.has(name) && name !== 'lobby' && name !== 'game' ? name : fallback);
  }

  #syncFromHash() {
    const name = location.hash.replace('#/', '');
    if (name && name !== this.current && this.routes.has(name)) this.#render(name, {});
  }

  #render(name, params) {
    // Отпускаем ресурсы предыдущего экрана (подписки, таймеры).
    if (typeof this.cleanup === 'function') {
      try { this.cleanup(); } catch (err) { console.error('[router] ошибка очистки:', err); }
    }
    this.cleanup = null;

    const result = this.routes.get(name)(params);
    const element = result instanceof HTMLElement ? result : result.element;
    if (result && typeof result.destroy === 'function') this.cleanup = result.destroy;

    this.mount.replaceChildren(element);
    this.mount.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'instant' });
    this.current = name;
    bus.emit('route:change', { name, params });
  }
}

export const router = new Router();
