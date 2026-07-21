/**
 * Минимальная шина событий: связывает модули без прямых импортов
 * друг друга (сеть -> игра -> интерфейс).
 *
 *   bus.on('room:update', fn);
 *   bus.emit('room:update', room);
 */
class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.channels = new Map();
  }

  /** Подписаться. Возвращает функцию отписки. */
  on(event, handler) {
    if (!this.channels.has(event)) this.channels.set(event, new Set());
    this.channels.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /** Подписаться ровно на одно срабатывание. */
  once(event, handler) {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(event, handler) {
    this.channels.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const set = this.channels.get(event);
    if (!set) return;
    // Копия — чтобы обработчик мог отписаться прямо во время вызова.
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[bus] обработчик "${event}" упал:`, err);
      }
    }
  }

  clear(event) {
    if (event) this.channels.delete(event);
    else this.channels.clear();
  }
}

export const bus = new EventBus();
