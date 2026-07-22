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

    /**
     * initializeFirestore вместо getFirestore — ради двух настроек:
     *
     *  experimentalAutoDetectLongPolling — в мобильных сетях и за корпоративными
     *  прокси веб-сокеты Firestore нередко режутся. Подписка при этом молча
     *  замирает: свои записи видно (они из кэша), чужие не приходят никогда —
     *  ровно та картина, когда в лобби вечно один игрок. С автоопределением
     *  клиент переключается на длинные опросы и список снова живой.
     *
     *  ignoreUndefinedProperties — одно undefined в документе роняло всю запись.
     */
    this.db = firestore.initializeFirestore(instance, {
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true,
    });
    this.auth = auth.getAuth(instance);

    // Кэш на диске: меньше чтений и мгновенный отклик при переподключении.
    try {
      await firestore.enableIndexedDbPersistence(this.db);
    } catch {
      /* несколько вкладок или приватный режим — работаем без кэша */
    }
    return true;
  }

  /**
   * Анонимная авторизация. uid здесь — это и есть playerId: он же
   * идентификатор документа игрока и он же проверяется правилами.
   *
   * Раньше сбой входа проваливался наверх, приложение продолжало работать
   * с uid = undefined, и все устройства писали в один документ
   * players/undefined — отсюда «в комнате всегда один игрок» и «хозяин у
   * всех». Теперь без настоящего uid игра к Firestore не подключается.
   */
  async signIn() {
    await this.ready();
    const { signInAnonymously, onAuthStateChanged } = this.api;

    // Сначала ждём, пока SDK восстановит сохранённую сессию.
    const restored = await new Promise((resolve) => {
      const stop = onAuthStateChanged(this.auth, (user) => { stop(); resolve(user); },
        () => resolve(null));
    });
    if (restored?.uid) return (this.uid = restored.uid);

    try {
      const credential = await signInAnonymously(this.auth);
      const uid = credential?.user?.uid;
      if (!uid) throw new Error('Firebase вернул вход без идентификатора');
      this.uid = uid;
      return uid;
    } catch (err) {
      const reason = err?.code === 'auth/operation-not-allowed'
        ? 'в консоли Firebase не включён анонимный вход (Authentication → Sign-in method → Anonymous)'
        : err?.message || String(err);
      throw new Error(`Анонимный вход не выполнен: ${reason}`);
    }
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
      (err) => this.#watchFailed(path, err),
    );
  }

  watchCollection(collPath, callback) {
    return this.api.onSnapshot(
      this.#coll(collPath),
      (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => this.#watchFailed(collPath, err),
    );
  }

  /**
   * Оборванная подписка — самая незаметная поломка: экран просто перестаёт
   * обновляться. Поэтому о ней сообщаем один раз наружу, а не только в консоль.
   */
  #watchFailed(path, err) {
    console.error(`[firestore] подписка «${path}» оборвалась:`, err);
    if (this.onWatchError) this.onWatchError(path, err);
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
