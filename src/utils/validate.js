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

export function cleanCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LIMITS.codeLength);
}

export function isValidCode(raw) {
  return cleanCode(raw).length === LIMITS.codeLength;
}

export function cleanMessage(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.chatMax);
}
