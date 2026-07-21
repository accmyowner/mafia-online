/**
 * Подписки на данные комнаты.
 *
 * Постоянно живут ровно две: документ комнаты и список игроков.
 * Чат подключается только на экранах, где он виден, голоса — только
 * во время голосования. Каждая подписка возвращает функцию отписки,
 * и все они складываются в один «пакет», который закрывается разом.
 */
import { db } from './db.js';
import { paths } from './paths.js';
import { store } from '../core/store.js';
import { bus } from '../core/eventBus.js';

/** Набор отписок, который можно закрыть одним вызовом. */
export function subscriptionBundle() {
  const unsubs = [];
  return {
    add(unsub) { if (typeof unsub === 'function') unsubs.push(unsub); return unsub; },
    close() {
      while (unsubs.length) {
        const unsub = unsubs.pop();
        try { unsub(); } catch (err) { console.error('[subs] отписка:', err); }
      }
    },
  };
}

/** Документ комнаты -> store.room + событие room:update. */
export function watchRoom(code) {
  return db().watchDoc(paths.room(code), (room) => {
    const previous = store.get().room;
    store.patch({ room });
    if (!room) { bus.emit('room:gone'); return; }
    bus.emit('room:update', room);
    if (previous?.state?.phase !== room.state?.phase) {
      bus.emit('phase:change', { phase: room.state.phase, round: room.state.round, room });
    }
  });
}

/** Список игроков -> store.players + событие players:update. */
export function watchPlayers(code) {
  return db().watchCollection(paths.players(code), (rows) => {
    const players = rows.slice().sort((a, b) => a.joinedAt - b.joinedAt);
    store.patch({ players });
    bus.emit('players:update', players);
  });
}

/** Чат: подключается только когда экран его показывает. */
export function watchChat(code, channel = 'town', limit = 60) {
  return db().watchCollection(paths.chat(code, channel), (rows) => {
    const chat = rows.slice().sort((a, b) => a.at - b.at).slice(-limit);
    store.patch({ chat });
    bus.emit('chat:update', chat);
  });
}

/** Голоса текущего круга: нужны только на экране голосования. */
export function watchVotes(code, round) {
  return db().watchCollection(paths.votes(code), (rows) => {
    const votes = rows.filter((row) => row.round === round);
    store.patch({ votes });
    bus.emit('votes:update', votes);
  });
}

/**
 * Ночные действия текущего круга.
 * Подписывается только хозяин комнаты — ему нужно понять,
 * когда все успели сходить, чтобы не ждать таймер зря.
 */
export function watchActions(code, round, handler) {
  return db().watchCollection(paths.actions(code), (rows) => {
    handler(rows.filter((row) => row.round === round));
  });
}
