/**
 * Проверки ввода. Клиент проверяет ради удобства,
 * те же ограничения продублированы в firestore.rules.
 */
import { LIMITS } from '../core/config.js';

export function cleanName(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, LIMITS.nameMax);
}

export function isValidName(raw) {
  return cleanName(raw).length >= 2;
}

/**
 * Кириллические буквы, которые на экране неотличимы от латинских.
 * Игрок диктует код голосом или набирает его с русской раскладки —
 * и «НДПС8» превращается в пустую строку, если просто выбросить всё
 * нелатинское. Поэтому сначала переводим похожие буквы, и только потом
 * отсекаем действительно посторонние символы.
 */
const LOOKALIKE = {
  А: 'A', В: 'B', Е: 'E', Ё: 'E', З: '3', И: 'N', К: 'K', М: 'M', Н: 'H',
  О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X', Ѕ: 'S', І: 'I', Ј: 'J',
};

/** Приводит ввод к коду комнаты: латиница A-Z и цифры 0-9. */
export function cleanCode(raw) {
  const normalized = String(raw || '')
    .replace(/[\u200b-\u200f\ufeff]/g, '')   // невидимые символы из буфера обмена
    .toUpperCase()
    .replace(/[А-ЯЁЅІЈ]/g, (letter) => LOOKALIKE[letter] || ' ');

  // Код часто присылают в сообщении: «заходи, комната NDPS8».
  // Если в строке есть отдельное слово нужной длины — берём его,
  // иначе просто склеиваем всё подходящее (это случай ввода по буквам).
  const words = normalized.split(/[^A-Z0-9]+/).filter(Boolean);
  const exact = words.find((word) => word.length === LIMITS.codeLength);
  return (exact || words.join('')).slice(0, LIMITS.codeLength);
}

export function isValidCode(raw) {
  return cleanCode(raw).length === LIMITS.codeLength;
}

export function cleanMessage(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.chatMax);
}
