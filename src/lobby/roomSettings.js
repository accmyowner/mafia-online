/**
 * Панель настроек комнаты.
 * Хозяин меняет значения, остальные видят их в режиме чтения.
 * Запись в базу задерживается на несколько сотен миллисекунд,
 * чтобы удержание кнопки «+» не превратилось в десять записей.
 */
import { el } from '../utils/dom.js';
import { t, tr } from '../ui/i18n.js';
import { store } from '../core/store.js';
import { LIMITS, TIMING } from '../core/config.js';
import { ASSIGNABLE, BASE_ROLES, EXTRA_ROLES, getRole } from '../roles/index.js';
import { validateDeck, buildDeck } from '../game/roleAssignment.js';
import { saveRoomSettings } from '../game/gameEngine.js';
import { throttle } from '../utils/time.js';
import { showToast } from '../ui/components/toast.js';

/** Копия настроек, с которой работает панель до отправки в базу. */
function draftOf(room) {
  return structuredClone(room.settings);
}

export function roomSettingsPanel(code, room) {
  const canEdit = store.isHost;
  const draft = draftOf(room);

  // Проверяем права ещё раз в момент записи: между сборкой панели и
  // нажатием кнопки хозяин комнаты мог смениться.
  const push = throttle(async () => {
    if (!store.isHost) return;
    const result = await saveRoomSettings(code, draft);
    if (result?.error) showToast(t('error.network'), 'error');
  }, 400);

  const balance = el('div.balance');

  function refreshBalance() {
    const players = store.get().players.length;
    const seats = Math.max(players, LIMITS.minPlayers);
    const check = validateDeck(draft, seats);
    const civilians = buildDeck(draft, seats).filter((id) => id === 'civilian').length;
    balance.className = `balance balance--${check.ok ? 'ok' : 'bad'}`;
    balance.textContent = check.ok
      ? `${t('settings.balanceOk')} · ${t('settings.civilians', { n: civilians })}`
      : t(check.reason);
  }

  /** Числовой параметр со стрелками. */
  function stepper({ label, hint, value, min, max, step = 1, suffix = '', onChange }) {
    let current = value;
    const output = el('span.stepper__value', {}, `${current}${suffix}`);
    const minus = el('button.stepper__btn', { type: 'button', 'aria-label': '−' }, '−');
    const plus = el('button.stepper__btn', { type: 'button', 'aria-label': '+' }, '+');

    const apply = (next) => {
      current = Math.min(max, Math.max(min, next));
      output.textContent = `${current}${suffix}`;
      minus.disabled = !canEdit || current <= min;
      plus.disabled = !canEdit || current >= max;
      onChange(current);
      refreshBalance();
      push();
    };
    minus.addEventListener('click', () => apply(current - step));
    plus.addEventListener('click', () => apply(current + step));
    minus.disabled = !canEdit || current <= min;
    plus.disabled = !canEdit || current >= max;

    return el(`div.setting-row${canEdit ? '' : '.setting-row--locked'}`, {},
      el('div.setting-row__label', {},
        el('span', {}, label),
        hint ? el('span.setting-row__hint', {}, hint) : null,
      ),
      el('div.stepper', {}, minus, output, plus),
    );
  }

  /** Переключатель «да/нет». */
  function toggle({ label, hint, value, onChange }) {
    const track = el('div.switch__track', { role: 'switch', tabIndex: canEdit ? 0 : -1, 'aria-checked': String(value) });
    const flip = () => {
      if (!canEdit) return;
      const next = track.getAttribute('aria-checked') !== 'true';
      track.setAttribute('aria-checked', String(next));
      onChange(next);
      refreshBalance();
      push();
    };
    track.addEventListener('click', flip);
    track.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flip(); }
    });
    return el(`div.setting-row${canEdit ? '' : '.setting-row--locked'}`, {},
      el('div.setting-row__label', {},
        el('span', {}, label),
        hint ? el('span.setting-row__hint', {}, hint) : null,
      ),
      track,
    );
  }

  /** Счётчик мест для конкретной роли. */
  function roleRow(role) {
    return stepper({
      label: `${role.icon} ${tr(role.name)}`,
      hint: tr(role.short),
      value: draft.roles[role.id] || 0,
      min: 0,
      max: LIMITS.maxPlayers - 1,
      onChange: (next) => { draft.roles[role.id] = next; },
    });
  }

  const extraBlock = el('div.stack', {}, EXTRA_ROLES.map(roleRow));
  const applyExtraVisibility = () => extraBlock.classList.toggle('hidden', !draft.extraRolesEnabled);
  applyExtraVisibility();

  const panel = el('section.panel.stack', {},
    el('div.panel__title', {},
      el('h3', { style: { margin: 0 } }, t('settings.room')),
      canEdit ? null : el('span.eyebrow', {}, t('settings.onlyHost')),
    ),

    stepper({
      label: t('settings.maxPlayers'),
      value: draft.maxPlayers,
      min: LIMITS.minPlayers,
      max: LIMITS.maxPlayers,
      onChange: (next) => { draft.maxPlayers = next; },
    }),
    stepper({
      label: t('settings.nightTime'),
      value: draft.nightTime, min: TIMING.night.min, max: TIMING.night.max, step: TIMING.night.step,
      suffix: ' ' + t('settings.seconds'),
      onChange: (next) => { draft.nightTime = next; },
    }),
    stepper({
      label: t('settings.dayTime'),
      value: draft.dayTime, min: TIMING.day.min, max: TIMING.day.max, step: TIMING.day.step,
      suffix: ' ' + t('settings.seconds'),
      onChange: (next) => { draft.dayTime = next; },
    }),
    stepper({
      label: t('settings.voteTime'),
      value: draft.voteTime, min: TIMING.vote.min, max: TIMING.vote.max, step: TIMING.vote.step,
      suffix: ' ' + t('settings.seconds'),
      onChange: (next) => { draft.voteTime = next; },
    }),
    toggle({ label: t('settings.chat'), value: draft.chatEnabled, onChange: (v) => { draft.chatEnabled = v; } }),
    toggle({ label: t('settings.revealRole'), value: draft.revealRoleOnDeath, onChange: (v) => { draft.revealRoleOnDeath = v; } }),
    toggle({
      label: t('settings.extraRoles'),
      hint: EXTRA_ROLES.map((r) => tr(r.name)).join(', '),
      value: draft.extraRolesEnabled,
      onChange: (v) => { draft.extraRolesEnabled = v; applyExtraVisibility(); },
    }),

    el('div.eyebrow', { style: { marginTop: '10px' } }, t('settings.rolesTitle')),
    el('div.stack', {}, BASE_ROLES.map(roleRow)),
    extraBlock,
    balance,
  );

  refreshBalance();
  return panel;
}

/** Сколько ролей заказано всего — используется в подсказках лобби. */
export function requestedRoleCount(settings) {
  return ASSIGNABLE.reduce((sum, role) => {
    if (!settings.extraRolesEnabled && !getRole(role.id).isBase) return sum;
    return sum + (Number(settings.roles?.[role.id]) || 0);
  }, 0);
}
