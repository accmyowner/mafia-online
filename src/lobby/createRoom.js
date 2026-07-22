/**
 * Экран создания комнаты.
 * Комната появляется в базе сразу, дальше её настраивают в лобби.
 */
import { el } from '../utils/dom.js';
import { t } from '../ui/i18n.js';
import { store } from '../core/store.js';
import { router } from '../core/router.js';
import { createRoom } from '../network/roomsRepo.js';
import { showToast } from '../ui/components/toast.js';
import { save } from '../utils/storage.js';
import { STORAGE_KEYS } from '../core/config.js';
import { sound } from '../utils/sound.js';

export function renderCreate() {
  const button = el('button.btn.btn--primary.btn--block', { type: 'button' },
    el('span.btn__icon', {}, '🎬'), el('span', {}, t('create.button')));

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.lastChild.textContent = t('common.loading');
    try {
      const { uid, name, avatar } = store.get();
      const code = await createRoom({ uid, name, avatar });
      if (!code || code.error) throw new Error(code?.error || 'комната не создана');
      save(STORAGE_KEYS.lastRoom, code);
      sound.play('join');
      router.go('lobby', { code });
    } catch (err) {
      console.error('[create] не удалось создать комнату:', err);
      showToast(t('create.failed'), 'error');
      button.disabled = false;
      button.lastChild.textContent = t('create.button');
    }
  });

  const step = (n, text) => el('div.row', { style: { alignItems: 'flex-start' } },
    el('span.mono', { style: { color: 'var(--violet)', minWidth: '22px' } }, `0${n}`),
    el('span.dim', {}, text));

  return el('div.screen', {},
    el('div.head', {},
      el('button.back', { type: 'button', onClick: () => router.go('menu') }, '←', t('common.back')),
      el('h2', {}, t('create.title')),
    ),

    el('div.grid.grid--two', {},
      el('section.panel.stack', {},
        el('div.eyebrow', {}, t('create.youAre')),
        el('div.row', {},
          el('div.player__avatar', {}, store.get().avatar),
          el('div', {},
            el('div', { style: { fontWeight: 700, fontSize: 'var(--step-1)' } }, store.get().name),
            el('div.faint.mono', { style: { fontSize: '0.8em' } }, t('lobby.host')),
          ),
        ),
        el('p.dim', {}, t('create.hint')),
        button,
      ),

      el('section.panel.stack', {},
        el('div.eyebrow', {}, t('create.next')),
        step(1, t('create.step1')),
        step(2, t('create.step2')),
        step(3, t('create.step3')),
      ),
    ),
  );
}
