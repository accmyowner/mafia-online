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

/** Инициализация хранилища и анонимный вход. Возвращает uid. */
export async function connect() {
  if (!adapter) {
    adapter = isConfigured() ? new FirestoreAdapter() : new LocalAdapter();
    try {
      await adapter.ready();
    } catch (err) {
      console.error('[db] Firebase недоступен, переключаюсь на локальный режим:', err);
      adapter = new LocalAdapter();
      await adapter.ready();
      bus.emit('db:fallback');
    }
  }
  const uid = await adapter.signIn();
  store.patch({ uid });
  return uid;
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
