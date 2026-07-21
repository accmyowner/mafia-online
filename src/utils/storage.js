/**
 * Обёртка над localStorage: не падает в приватном режиме
 * и всегда возвращает значение по умолчанию.
 */
export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(key); } catch { /* хранилище недоступно */ }
}
