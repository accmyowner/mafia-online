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
 * Инициализация хранилища и вход. Возвращает playerId — он же uid,
 * он же идентификатор документа игрока в rooms/{code}/players.
 *
 * Подключение считается удачным только если получен непустой uid:
 * без него все устройства писали бы в один и тот же документ.
 * Если Firebase недоступен или анонимный вход не включён, честно
 * переходим в локальный режим — и нижняя панель это показывает.
 */
export async function connect() {
  if (!adapter) adapter = isConfigured() ? new FirestoreAdapter() : new LocalAdapter();

  let uid = null;
  try {
    await adapter.ready();
    uid = await adapter.signIn();
    if (typeof uid !== 'string' || !uid) throw new Error('хранилище не выдало идентификатор игрока');
  } catch (err) {
    console.error('[db] Firebase недоступен, переключаюсь на локальный режим:', err);
    adapter = new LocalAdapter();
    await adapter.ready();
    uid = await adapter.signIn();
    bus.emit('db:fallback', err);
  }

  store.patch({ uid });
  console.info(`[db] режим: ${adapter.name} · playerId: ${uid}`);
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
