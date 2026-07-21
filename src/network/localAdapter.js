/**
 * Локальный адаптер хранилища.
 *
 * Повторяет интерфейс Firestore-адаптера, но держит данные в localStorage
 * и рассылает изменения между вкладками через BroadcastChannel.
 * Благодаря ему проект запускается сразу после клонирования: откройте
 * несколько вкладок — и можно играть вдвоём или втроём.
 */
import { load, save } from '../utils/storage.js';

const DB_KEY = 'mafia:localdb';
const CHANNEL = 'mafia:localdb:changes';

function readDb() {
  return load(DB_KEY, {});
}
function writeDb(db) {
  save(DB_KEY, db);
}

export class LocalAdapter {
  constructor() {
    this.name = 'local';
    this.watchers = new Set();
    this.channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
    this.channel?.addEventListener('message', () => this.#notifyAll());
    // Запасной канал: событие storage приходит из других вкладок.
    window.addEventListener('storage', (event) => {
      if (event.key === DB_KEY) this.#notifyAll();
    });
  }

  async ready() { return true; }

  /** Стабильный анонимный идентификатор в пределах браузера. */
  async signIn() {
    let uid = load('mafia:localUid', null);
    if (!uid) {
      uid = 'local-' + crypto.randomUUID().slice(0, 12);
      save('mafia:localUid', uid);
    }
    return uid;
  }

  now() { return Date.now(); }

  async get(path) {
    return readDb()[path] ?? null;
  }

  async set(path, data, { merge = false } = {}) {
    const db = readDb();
    db[path] = merge ? { ...(db[path] || {}), ...data } : data;
    writeDb(db);
    this.#broadcast();
    return db[path];
  }

  async update(path, patch) {
    return this.set(path, patch, { merge: true });
  }

  async del(path) {
    const db = readDb();
    delete db[path];
    writeDb(db);
    this.#broadcast();
  }

  /** Все документы коллекции: ключи вида "rooms/AB12C/players/uid". */
  async list(collPath) {
    const db = readDb();
    const prefix = collPath.endsWith('/') ? collPath : collPath + '/';
    return Object.entries(db)
      .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
      .map(([key, value]) => ({ id: key.slice(prefix.length), ...value }));
  }

  async delCollection(collPath) {
    const db = readDb();
    const prefix = collPath.endsWith('/') ? collPath : collPath + '/';
    for (const key of Object.keys(db)) if (key.startsWith(prefix)) delete db[key];
    writeDb(db);
    this.#broadcast();
  }

  watchDoc(path, callback) {
    const watcher = { type: 'doc', path, callback, last: '' };
    this.watchers.add(watcher);
    this.#notify(watcher);
    return () => this.watchers.delete(watcher);
  }

  watchCollection(collPath, callback) {
    const watcher = { type: 'coll', path: collPath, callback, last: '' };
    this.watchers.add(watcher);
    this.#notify(watcher);
    return () => this.watchers.delete(watcher);
  }

  /** Транзакции локально не нужны: вкладки пишут по очереди. */
  async transaction(handler) {
    return handler({
      get: (path) => this.get(path),
      set: (path, data, options) => this.set(path, data, options),
      update: (path, patch) => this.update(path, patch),
      del: (path) => this.del(path),
    });
  }

  #broadcast() {
    this.channel?.postMessage('changed');
    this.#notifyAll();
  }

  #notifyAll() {
    for (const watcher of this.watchers) this.#notify(watcher);
  }

  async #notify(watcher) {
    const data = watcher.type === 'doc' ? await this.get(watcher.path) : await this.list(watcher.path);
    const snapshot = JSON.stringify(data);
    if (snapshot === watcher.last) return; // лишние перерисовки не нужны
    watcher.last = snapshot;
    watcher.callback(data);
  }
}
