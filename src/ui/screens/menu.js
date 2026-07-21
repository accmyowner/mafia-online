/**
 * Главное меню.
 * Здесь же игрок задаёт имя за столом — оно сохраняется локально
 * и подставляется во все следующие партии.
 */
import { el } from '../../utils/dom.js';
import { t } from '../i18n.js';
import { store } from '../../core/store.js';
import { router } from '../../core/router.js';
import { cleanName, isValidName } from '../../utils/validate.js';
import { save, load } from '../../utils/storage.js';
import { STORAGE_KEYS, AVATARS } from '../../core/config.js';
import { isLocalMode } from '../../network/db.js';
import { showToast } from '../components/toast.js';
import { pickStable } from '../../utils/random.js';

function menuButton({ icon, label, sub, onClick, variant = 'btn--ghost' }) {
  return el(`button.btn.menu-btn.${variant}`, { type: 'button', onClick },
    el('span.btn__icon', {}, icon),
    el('span.menu-btn__label', {}, label),
    el('span.menu-btn__sub', {}, sub),
  );
}

export function renderMenu() {
  const state = store.get();
  const saved = load(STORAGE_KEYS.profile, {});
  const name = state.name || saved.name || '';
  const avatar = state.avatar || saved.avatar || pickStable(AVATARS, state.uid || 'guest');
  store.patch({ name, avatar });

  const nameInput = el('input.input', {
    type: 'text',
    value: name,
    maxLength: 16,
    placeholder: t('menu.namePlaceholder'),
    onInput: (event) => {
      const clean = cleanName(event.target.value);
      store.patch({ name: clean });
      save(STORAGE_KEYS.profile, { name: clean, avatar });
      nameInput.classList.remove('input--error');
    },
  });

  /** Общая проверка перед выходом в комнату. */
  const requireName = (next) => () => {
    if (!isValidName(store.get().name)) {
      nameInput.classList.add('input--error');
      nameInput.focus();
      showToast(t('menu.nameShort'), 'warn');
      return;
    }
    next();
  };

  const avatarButton = el('button.btn.btn--ghost', {
    type: 'button',
    style: { fontSize: '22px', minWidth: '58px' },
    title: 'Сменить аватар',
    onClick: () => {
      const next = AVATARS[(AVATARS.indexOf(store.get().avatar) + 1) % AVATARS.length];
      store.patch({ avatar: next });
      avatarButton.textContent = next;
      save(STORAGE_KEYS.profile, { name: store.get().name, avatar: next });
    },
  }, avatar);

  const lastRoom = load(STORAGE_KEYS.lastRoom, null);

  return el('div.screen', {},
    el('header.logo', {},
      el('div.logo__mark', {}, 'МАФИЯ'),
      el('div.logo__sub', {}, 'Online'),
      el('p.dim.center', { style: { marginTop: '14px' } }, t('menu.tagline')),
    ),

    el('div.panel.panel--tight', {},
      el('div.field', {},
        el('label.field__label', {}, t('menu.nameLabel')),
        el('div.row', {}, avatarButton, el('div', { style: { flex: '1 1 200px' } }, nameInput)),
      ),
    ),

    el('nav.grid.grid--menu', {},
      menuButton({
        icon: '🎬', label: t('menu.create'), sub: t('menu.createSub'),
        variant: 'btn--primary', onClick: requireName(() => router.go('create')),
      }),
      menuButton({
        icon: '🔑', label: t('menu.join'), sub: t('menu.joinSub'),
        onClick: requireName(() => router.go('join')),
      }),
      menuButton({ icon: '⚙️', label: t('menu.settings'), sub: t('menu.settingsSub'), onClick: () => router.go('settings') }),
      menuButton({ icon: '📖', label: t('menu.rules'), sub: t('menu.rulesSub'), onClick: () => router.go('rules') }),
      menuButton({ icon: '👤', label: t('menu.about'), sub: t('menu.aboutSub'), onClick: () => router.go('about') }),
      lastRoom
        ? menuButton({
            icon: '↩️', label: t('menu.resume'), sub: lastRoom,
            onClick: requireName(() => router.go('join', { code: lastRoom })),
          })
        : null,
    ),

    // Версия и статус подключения живут в нижней панели, здесь — только
    // объяснение, что игра сейчас работает без сервера.
    isLocalMode()
      ? el('div.panel.panel--tight.panel--accent', {},
          el('div.eyebrow', {}, 'Играем без сервера'),
          el('p', { style: { margin: '6px 0 0' } },
            'Комнаты хранятся в этом браузере: позовите соседние вкладки или заполните ' +
            'firebase/config.js, чтобы играть по сети.'),
        )
      : null,
  );
}
