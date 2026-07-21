/**
 * Чат комнаты.
 *
 * Днём город говорит в общем канале, ночью мафия — в своём.
 * Подписка на сообщения живёт только пока панель на экране.
 */
import { el } from '../utils/dom.js';
import { t } from '../ui/i18n.js';
import { store } from '../core/store.js';
import { bus } from '../core/eventBus.js';
import { sendMessage } from '../network/roomsRepo.js';
import { watchChat } from '../network/subscriptions.js';
import { cleanMessage } from '../utils/validate.js';
import { LIMITS } from '../core/config.js';
import { sound } from '../utils/sound.js';

/**
 * @param {string} code код комнаты
 * @param {Object} options { channel: 'town'|'mafia', enabled, placeholder, note }
 * @returns {{element: HTMLElement, destroy: Function}}
 */
export function chatPanel(code, { channel = 'town', enabled = true, note = '' } = {}) {
  const list = el('div.feed');
  const input = el('input.input', {
    type: 'text',
    maxLength: LIMITS.chatMax,
    placeholder: t('game.chatPlaceholder'),
    disabled: !enabled,
  });
  const sendButton = el('button.btn.btn--sm.btn--mint', { type: 'button', disabled: !enabled }, t('game.chatSend'));

  let lastCount = 0;

  function draw(messages) {
    const visible = messages;
    list.replaceChildren(...visible.map((message) =>
      el('div.feed__item', {},
        el('span.feed__author', {}, `${message.avatar || ''} ${message.name}`),
        el('span', {}, message.text),
      )));
    list.scrollTop = list.scrollHeight;
    if (visible.length > lastCount && lastCount > 0) sound.play('message');
    lastCount = visible.length;
  }

  async function send() {
    const text = cleanMessage(input.value);
    if (!text || !enabled) return;
    input.value = '';
    const { uid, name, avatar } = store.get();
    await sendMessage(code, { uid, name, avatar }, text, channel);
  }

  sendButton.addEventListener('click', send);
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') send(); });

  const unwatch = watchChat(code, channel);
  const off = bus.on('chat:update', draw);
  draw(store.get().chat || []);

  const element = el('section.panel.stack', {},
    el('div.panel__title', {},
      el('h3', { style: { margin: 0, fontSize: 'var(--step-0)' } },
        channel === 'mafia' ? t('game.mafiaChat') : t('game.discuss')),
      note ? el('span.eyebrow', {}, note) : null,
    ),
    list,
    el('div.chat-form', {}, input, sendButton),
  );

  return {
    element,
    destroy() { off(); unwatch?.(); },
  };
}
