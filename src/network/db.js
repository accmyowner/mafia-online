/**
 * Выбор хранилища и точка входа сетевого слоя.
 * Если firebase/config.js заполнен — работаем через Firestore,
 * иначе поднимаем локальный режим и честно сообщаем об этом.
 */
import { isConfigured } from '../../firebase/config.js';
import { FirestoreAdapter } from './firestoreAdapter.js';
import { LocalAdapter } from './localAdapter.js';
import { store } from '../core/store.js';
import { bus } from '../core/eventBus.js';

let adapter = null;

/**
 * Инициализация хранилища и вход. Возвращает playerId — он же
 * идентификатор документа игрока в rooms/{code}/players.
 *
 * В локальный режим переходим только тогда, когда недоступна сама база:
 * не подключился SDK, не заполнена конфигурация, не открылось соединение.
 * Несостоявшийся анонимный вход к таким случаям не относится — Firestore
 * при этом работает, и клиент продолжает играть по сети со своим
 * постоянным идентификатором (см. FirestoreAdapter.signIn).
 *
 * Обязательное условие одно: непустой уникальный идентификатор. Без него
 * все устройства писали бы в один и тот же документ игрока.
 */
export async function connect() {
  if (!adapter) adapter = isConfigured() ? new FirestoreAdapter() : new LocalAdapter();

  let uid = null;
  try {
    await adapter.ready();
    uid = await adapter.signIn();
    if (typeof uid !== 'string' || !uid) throw new Error('хранилище не выдало идентификатор игрока');
  } catch (err) {
    console.error('[db] база недоступна, переключаюсь на локальный режим:', err);
    adapter = new LocalAdapter();
    await adapter.ready();
    uid = await adapter.signIn();
    bus.emit('db:fallback', err);
  }

  store.patch({ uid });
  console.info(`[db] режим: ${adapter.name} · playerId: ${uid}`
    + (adapter.authFailed ? ' (без анонимного входа)' : ''));
  return uid;
}

/** Подписки Firestore могут оборваться (например, из-за правил доступа). */
export function onWatchError(handler) {
  if (adapter && adapter.name === 'firestore') adapter.onWatchError = handler;
}

/** Текущий адаптер. Бросает ошибку, если connect() ещё не вызывали. */
export function db() {
  if (!adapter) throw new Error('Хранилище не инициализировано: вызовите connect()');
  return adapter;
}

/** Локальный ли режим — показываем плашку в меню. */
export function isLocalMode() {
  return adapter?.name === 'local';
}
