/**
 * Адаптер Firestore.
 *
 * SDK подключается динамическим импортом с CDN как ES-модуль — поэтому
 * в проекте нет ни одной npm-зависимости и не нужен сборщик.
 * Наружу торчит тот же интерфейс, что у LocalAdapter, так что игровая
 * логика ничего не знает о Firebase.
 */
import { firebaseConfig, FIREBASE_SDK } from '../../firebase/config.js';

/** Путь -> ссылка на документ (нечётное число сегментов = коллекция). */
function splitPath(path) {
  return path.split('/').filter(Boolean);
}

export class FirestoreAdapter {
  constructor() {
    this.name = 'firestore';
    this.api = null;
    this.db = null;
    this.auth = null;
    this.uid = null;
  }

  async ready() {
    if (this.db) return true;

    const [app, firestore, auth] = await Promise.all([
      import(`${FIREBASE_SDK}/firebase-app.js`),
      import(`${FIREBASE_SDK}/firebase-firestore.js`),
      import(`${FIREBASE_SDK}/firebase-auth.js`),
    ]);

    this.api = { ...firestore, ...auth };
    const instance = app.initializeApp(firebaseConfig);
    this.db = firestore.getFirestore(instance);
    this.auth = auth.getAuth(instance);

    // Кэш на диске: меньше чтений и мгновенный отклик при переподключении.
    try {
      await firestore.enableIndexedDbPersistence(this.db);
    } catch {
      /* несколько вкладок или приватный режим — работаем без кэша */
    }
    return true;
  }

  /** Анонимная авторизация: uid стабилен между перезагрузками. */
  async signIn() {
    await this.ready();
    const { signInAnonymously, onAuthStateChanged } = this.api;
    if (this.auth.currentUser) return (this.uid = this.auth.currentUser.uid);

    const user = await new Promise((resolve, reject) => {
      const stop = onAuthStateChanged(this.auth, (u) => {
        if (u) { stop(); resolve(u); }
      }, reject);
      signInAnonymously(this.auth).catch(reject);
    });
    this.uid = user.uid;
    return this.uid;
  }

  now() { return Date.now(); }

  #doc(path) {
    return this.api.doc(this.db, ...splitPath(path));
  }
  #coll(path) {
    return this.api.collection(this.db, ...splitPath(path));
  }

  async get(path) {
    const snap = await this.api.getDoc(this.#doc(path));
    return snap.exists() ? snap.data() : null;
  }

  async set(path, data, { merge = false } = {}) {
    await this.api.setDoc(this.#doc(path), data, { merge });
    return data;
  }

  async update(path, patch) {
    // setDoc с merge не падает, если документа ещё нет.
    await this.api.setDoc(this.#doc(path), patch, { merge: true });
    return patch;
  }

  async del(path) {
    await this.api.deleteDoc(this.#doc(path));
  }

  async list(collPath) {
    const snap = await this.api.getDocs(this.#coll(collPath));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  /** Удаление коллекции пачкой: одна операция записи вместо N. */
  async delCollection(collPath) {
    const snap = await this.api.getDocs(this.#coll(collPath));
    if (snap.empty) return;
    const batch = this.api.writeBatch(this.db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  watchDoc(path, callback) {
    return this.api.onSnapshot(
      this.#doc(path),
      (snap) => callback(snap.exists() ? snap.data() : null),
      (err) => console.error('[firestore] подписка на документ:', err),
    );
  }

  watchCollection(collPath, callback) {
    return this.api.onSnapshot(
      this.#coll(collPath),
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error('[firestore] подписка на коллекцию:', err),
    );
  }

  /**
   * Транзакция: нужна при входе в комнату, чтобы два игрока
   * не заняли последнее место одновременно.
   */
  async transaction(handler) {
    return this.api.runTransaction(this.db, async (tx) => handler({
      get: async (path) => {
        const snap = await tx.get(this.#doc(path));
        return snap.exists() ? snap.data() : null;
      },
      set: async (path, data, { merge = false } = {}) => { tx.set(this.#doc(path), data, { merge }); },
      update: async (path, patch) => { tx.set(this.#doc(path), patch, { merge: true }); },
      del: async (path) => { tx.delete(this.#doc(path)); },
    }));
  }
}
