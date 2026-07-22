/**
 * Хранилище состояния приложения.
 * Глобальных переменных в проекте нет: всё общее состояние живёт здесь
 * и меняется только через store.patch().
 */
import { bus } from './eventBus.js';

const initial = {
  /** Профиль игрока (uid выдаёт анонимная авторизация). */
  uid: null,
  name: '',
  avatar: '🎩',

  /** Текущая комната: документ, игроки, моя роль. */
  roomCode: null,
  room: null,
  players: [],
  myRole: null,
  chat: [],
  votes: [],

  /** Настройки клиента (звук, язык, тема). */
  prefs: {
    lang: 'ru',
    theme: 'midnight',
    music: 0.35,
    sfx: 0.7,
    muted: false,
  },
};

class Store {
  constructor() {
    this.state = structuredClone(initial);
  }

  get() {
    return this.state;
  }

  /**
   * Поверхностное слияние с оповещением подписчиков.
   * Оповещаем только если что-то реально изменилось по ссылке.
   */
  patch(partial) {
    let changed = false;
    for (const [key, value] of Object.entries(partial)) {
      if (this.state[key] !== value) {
        this.state[key] = value;
        changed = true;
      }
    }
    if (changed) bus.emit('store:change', this.state);
    return this.state;
  }

  /** Обновление вложенных настроек клиента. */
  patchPrefs(partial) {
    this.state.prefs = { ...this.state.prefs, ...partial };
    bus.emit('store:change', this.state);
    bus.emit('prefs:change', this.state.prefs);
    return this.state.prefs;
  }

  /** Сбросить всё, что связано с комнатой (выход в меню). */
  clearRoom() {
    this.patch({ roomCode: null, room: null, players: [], myRole: null, chat: [], votes: [] });
  }

  subscribe(handler) {
    return bus.on('store:change', handler);
  }

  /**
   * Я ли хозяин текущей комнаты.
   * Пустые значения сравнивать нельзя: два клиента без идентификатора
   * оба оказывались «хозяевами».
   */
  get isHost() {
    const { room, uid } = this.state;
    return Boolean(room?.hostId && uid && room.hostId === uid);
  }

  /** Мой объект игрока в текущей комнате. */
  get me() {
    return this.state.players.find((p) => p.uid === this.state.uid) || null;
  }
}

export const store = new Store();
