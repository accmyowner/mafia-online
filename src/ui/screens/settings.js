/**
 * Настройки клиента: язык, тема, громкость.
 * Хранятся локально и не влияют на других игроков.
 */
import { el } from '../../utils/dom.js';
import { t, setLanguage, LANGUAGES } from '../i18n.js';
import { store } from '../../core/store.js';
import { router } from '../../core/router.js';
import { applyTheme, THEMES } from '../theme.js';
import { save } from '../../utils/storage.js';
import { STORAGE_KEYS } from '../../core/config.js';
import { sound } from '../../utils/sound.js';

function persist() {
  save(STORAGE_KEYS.settings, store.get().prefs);
}

function slider(label, key, onInput) {
  const value = store.get().prefs[key];
  const output = el('span.mono', {}, `${Math.round(value * 100)}%`);
  return el('div.setting-row', {},
    el('div.setting-row__label', {}, el('span', {}, label)),
    el('div.row', { style: { flex: '1 1 180px', maxWidth: '260px' } },
      el('input.range', {
        type: 'range', min: '0', max: '100', value: String(Math.round(value * 100)),
        onInput: (event) => {
          const next = Number(event.target.value) / 100;
          output.textContent = `${event.target.value}%`;
          store.patchPrefs({ [key]: next });
          persist();
          onInput?.(next);
        },
      }),
      output,
    ),
  );
}

function toggle(label, key) {
  const track = el('div.switch__track', {
    role: 'switch',
    tabIndex: 0,
    'aria-checked': String(store.get().prefs[key]),
  });
  const flip = () => {
    const next = !store.get().prefs[key];
    store.patchPrefs({ [key]: next });
    track.setAttribute('aria-checked', String(next));
    persist();
  };
  track.addEventListener('click', flip);
  track.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flip(); }
  });
  return el('div.setting-row', {}, el('span', {}, label), track);
}

function choice(label, current, items, onPick) {
  return el('div.setting-row', {},
    el('span', {}, label),
    el('div.row', {}, items.map((item) =>
      el(`button.btn.btn--sm.${item.id === current ? 'btn--mint' : 'btn--ghost'}`, {
        type: 'button',
        onClick: () => onPick(item.id),
      }, item.label))),
  );
}

export function renderSettings() {
  const rerender = () => router.go('settings');
  const prefs = store.get().prefs;

  return el('div.screen', {},
    el('div.head', {},
      el('button.back', { type: 'button', onClick: () => router.go('menu') }, '←', t('common.back')),
      el('h2', {}, t('client.title')),
    ),

    el('section.panel', {},
      el('div.panel__title', {}, el('div.eyebrow', {}, t('client.appearance'))),
      choice(t('client.lang'), prefs.lang, LANGUAGES, (id) => { setLanguage(id); persist(); rerender(); }),
      choice(t('client.theme'), prefs.theme, THEMES.map((id) => ({
        id, label: t(id === 'midnight' ? 'client.themeMidnight' : 'client.themeDaylight'),
      })), (id) => { applyTheme(id); persist(); rerender(); }),
    ),

    el('section.panel', {},
      el('div.panel__title', {}, el('div.eyebrow', {}, t('client.audio'))),
      toggle(t('client.mute'), 'muted'),
      slider(t('client.music'), 'music'),
      slider(t('client.sfx'), 'sfx', () => sound.play('click')),
      el('div.row', { style: { marginTop: 'var(--space-3)' } },
        el('button.btn.btn--ghost.btn--sm', {
          type: 'button',
          onClick: () => {
            // Проигрываем набор целиком: так слышно, что звуки одного стиля.
            ['hover', 'click', 'confirm', 'notify', 'error'].forEach((name, i) => {
              setTimeout(() => sound.play(name), i * 320);
            });
          },
        }, t('client.testSound')),
        el('span.faint', {}, t('client.testSoundHint')),
      ),
    ),
  );
}
