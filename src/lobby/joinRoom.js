/**
 * Экран входа по коду.
 * Как только введены все пять символов, вход происходит сам —
 * лишнее нажатие никому не нужно.
 */
import { el } from '../utils/dom.js';
import { t } from '../ui/i18n.js';
import { store } from '../core/store.js';
import { router } from '../core/router.js';
import { joinRoom } from '../network/roomsRepo.js';
import { cleanCode, isValidCode } from '../utils/validate.js';
import { showToast } from '../ui/components/toast.js';
import { save } from '../utils/storage.js';
import { STORAGE_KEYS, LIMITS } from '../core/config.js';
import { sound } from '../utils/sound.js';

const ERRORS = {
  notFound: 'join.notFound',
  full: 'join.full',
  started: 'join.started',
  network: 'error.network',
  noAuth: 'error.noAuth',
};

export function renderJoin(params = {}) {
  let busy = false;

  // Код — только латиница A-Z и цифры 0-9. Русская раскладка, пробелы,
  // дефисы и лишние слова из сообщения разбираются в cleanCode().
  const input = el('input.input.input--code', {
    type: 'text',
    inputMode: 'text',
    pattern: '[A-Za-z0-9]*',
    autocapitalize: 'characters',
    autocorrect: 'off',
    autocomplete: 'off',
    spellcheck: false,
    maxLength: LIMITS.codeLength,
    value: cleanCode(params.code || ''),
    placeholder: 'NDPS8',
    'aria-label': t('join.codeLabel'),
  });

  const button = el('button.btn.btn--primary.btn--block', {
    type: 'button',
    disabled: !isValidCode(input.value),
    onClick: () => attempt(),
  }, el('span.btn__icon', {}, '🔑'), el('span', {}, t('join.button')));

  async function attempt() {
    const code = cleanCode(input.value);
    if (busy) return;
    if (!isValidCode(code)) {
      input.classList.add('input--error');
      showToast(t('join.badCode'), 'warn');
      return;
    }
    busy = true;
    button.disabled = true;
    button.lastChild.textContent = t('common.loading');

    const { uid, name, avatar } = store.get();
    const result = await joinRoom(code, { uid, name, avatar });

    if (result.error) {
      input.classList.remove('input--error');
      void input.offsetWidth;           // перезапуск анимации тряски
      input.classList.add('input--error');
      showToast(t(ERRORS[result.error] || 'error.generic'), 'error');
      busy = false;
      button.disabled = false;
      button.lastChild.textContent = t('join.button');
      return;
    }

    save(STORAGE_KEYS.lastRoom, code);
    sound.play('join');

    // Показываем себя в лобби не дожидаясь первого снимка из базы:
    // подписка всё равно перезапишет список через мгновение.
    if (result.player) {
      store.patch({ roomCode: code, players: [result.player] });
    }
    router.go('lobby', { code });
  }

  input.addEventListener('input', (event) => {
    const code = cleanCode(event.target.value);
    event.target.value = code;
    input.classList.remove('input--error');
    button.disabled = !isValidCode(code);
    if (isValidCode(code)) attempt();
  });

  // Вставка длинной строки: браузер обрежет её по maxlength раньше, чем
  // мы успеем найти в ней код, поэтому разбираем текст сами.
  input.addEventListener('paste', (event) => {
    const text = event.clipboardData?.getData('text');
    if (!text) return;
    event.preventDefault();
    const code = cleanCode(text);
    input.value = code;
    input.classList.remove('input--error');
    button.disabled = !isValidCode(code);
    if (isValidCode(code)) attempt();
  });
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') attempt(); });
  requestAnimationFrame(() => input.focus());

  // Если код пришёл из меню («вернуться в комнату»), пробуем войти сразу.
  if (params.code && isValidCode(params.code)) requestAnimationFrame(attempt);

  return el('div.screen', {},
    el('div.head', {},
      el('button.back', { type: 'button', onClick: () => router.go('menu') }, '←', t('common.back')),
      el('h2', {}, t('join.title')),
    ),
    el('section.panel.stack', {},
      el('div.field', {}, el('label.field__label', {}, t('join.codeLabel')), input),
      button,
    ),
  );
}
