/**
 * Модальные окна: подтверждение, произвольное содержимое.
 * Закрываются по Esc, по клику на подложку и по кнопке.
 */
import { el } from '../../utils/dom.js';
import { t } from '../i18n.js';

/** Открывает окно. Возвращает функцию закрытия. */
export function openModal({ title, body, actions = [], dismissible = true }) {
  const root = document.getElementById('modal-root');
  const box = el('div.modal__box', { role: 'dialog', 'aria-modal': 'true' });

  if (title) box.append(el('h3', {}, title));
  if (body) box.append(body instanceof Node ? body : el('p', {}, body));

  const close = () => {
    document.removeEventListener('keydown', onKey);
    layer.remove();
  };

  if (actions.length) {
    box.append(el('div.modal__actions', {}, actions.map((action) =>
      el(`button.btn.btn--sm.${action.variant || 'btn--ghost'}`, {
        type: 'button',
        onClick: () => { action.onClick?.(close); if (!action.keepOpen) close(); },
      }, action.label))));
  }

  const layer = el('div.modal', {
    onClick: (event) => { if (dismissible && event.target === layer) close(); },
  }, box);

  const onKey = (event) => { if (event.key === 'Escape' && dismissible) close(); };
  document.addEventListener('keydown', onKey);

  root.append(layer);
  box.querySelector('button')?.focus();
  return close;
}

/** Да/нет. Возвращает промис с булевым ответом. */
export function confirmModal(text, { title = '', confirmLabel } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title,
      body: text,
      actions: [
        { label: t('common.cancel'), onClick: () => { answered = true; resolve(false); } },
        {
          label: confirmLabel || t('common.confirm'),
          variant: 'btn--danger',
          onClick: () => { answered = true; resolve(true); },
        },
      ],
    });
    // Если окно закрыли по Esc, считаем это отказом.
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.modal') && !answered) { answered = true; resolve(false); observer.disconnect(); }
    });
    observer.observe(document.getElementById('modal-root'), { childList: true });
  });
}
