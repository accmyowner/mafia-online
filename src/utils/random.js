/**
 * Генерация случайностей.
 * Везде, где возможно, используется crypto — чтобы коды комнат
 * и раздачу ролей нельзя было предсказать.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих символов (0/O, 1/I)

/** Код комнаты вида Q7DKL. */
export function roomCode(length = 5) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function randomInt(maxExclusive) {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return bytes[0] % maxExclusive;
}

export function pick(array) {
  return array[randomInt(array.length)];
}

/** Тасование Фишера — Йетса. Возвращает новый массив. */
export function shuffle(array) {
  const out = [...array];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Стабильный выбор из списка по строке (аватар по uid). */
export function pickStable(array, seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return array[hash % array.length];
}
