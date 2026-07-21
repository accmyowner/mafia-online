/**
 * Всплывающие уведомления.
 * Любой модуль может позвать bus.emit('toast', {text, tone}) — текст
 * может быть готовой строкой или ключом перевода.
 */
import { el, removeSoft } from '../../utils/dom.js';
import { bus } from '../../core/eventBus.js';
import { t } from '../i18n.js';
import { sound } from '../../utils/sound.js';

const ICONS = { ok: '✓', error: '✕', warn: '!', info: '•' };

export function showToast(text, tone = 'info', ms = 3200) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const label = text.includes('.') && !text.includes(' ') ? t(text) : text;
  const node = el(`div.toast.toast--${tone}`, {},
    el('span.mono', {}, ICONS[tone] || ICONS.info),
    el('span', {}, label),
  );
  root.append(node);
  sound.play(tone === 'error' ? 'error' : 'notify');
  setTimeout(() => removeSoft(node), ms);
}

/** Подключается один раз при старте приложения. */
export function initToasts() {
  bus.on('toast', (payload) => {
    if (typeof payload === 'string') showToast(payload);
    else showToast(payload.text, payload.tone, payload.ms);
  });
}
