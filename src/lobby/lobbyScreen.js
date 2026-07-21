/**
 * Лобби комнаты.
 *
 * Экран собирается один раз, дальше обновляются только те куски,
 * которые реально изменились: список игроков, счётчик и панель настроек.
 * Так карточки не перерисовываются на каждый чих и не теряют анимацию.
 */
import { el } from '../utils/dom.js';
import { t } from '../ui/i18n.js';
import { store } from '../core/store.js';
import { bus } from '../core/eventBus.js';
import { router } from '../core/router.js';
import { LIMITS, STORAGE_KEYS } from '../core/config.js';
import { watchRoom, watchPlayers, subscriptionBundle } from '../network/subscriptions.js';
import { setReady, leaveRoom, touch } from '../network/roomsRepo.js';
import { engine } from '../game/gameEngine.js';
import { validateDeck } from '../game/roleAssignment.js';
import { playerCard, lobbyTags } from '../ui/components/playerCard.js';
import { roomSettingsPanel } from './roomSettings.js';
import { showToast } from '../ui/components/toast.js';
import { confirmModal } from '../ui/components/modal.js';
import { applyPhase } from '../ui/theme.js';
import { remove } from '../utils/storage.js';
import { sound } from '../utils/sound.js';

export function renderLobby(params = {}) {
  const code = params.code || store.get().roomCode;
  if (!code) { router.go('menu'); return el('div'); }

  store.patch({ roomCode: code });
  applyPhase('lobby');

  const subs = subscriptionBundle();
  let knownPlayerIds = '';
  let knownSettings = '';

  /* ---------- статические части ---------- */

  const codeButton = el('button.room-code', {
    type: 'button',
    title: t('lobby.codeHint'),
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(code);
        showToast(t('common.copied'), 'ok');
      } catch {
        showToast(code, 'info');
      }
    },
  }, code, el('span', { style: { fontSize: '0.5em', letterSpacing: 0 } }, '⧉'));

  const counter = el('div.counter.mono');
  const playersGrid = el('div.grid.grid--players');
  const settingsSlot = el('div');
  const hint = el('div.action-hint');

  const readyButton = el('button.btn.btn--mint', { type: 'button' },
    el('span.btn__icon', {}, '✓'), el('span', {}, t('lobby.ready')));

  const startButton = el('button.btn.btn--primary', { type: 'button', disabled: true },
    el('span.btn__icon', {}, '▶'), el('span', {}, t('lobby.start')));

  const leaveButton = el('button.btn.btn--ghost.btn--sm', { type: 'button' }, t('lobby.leave'));

  /* ---------- поведение ---------- */

  readyButton.addEventListener('click', async () => {
    const me = store.me;
    if (!me) return;
    await setReady(code, me.uid, !me.ready);
    sound.play('ready');
  });

  startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    const result = await engine.startGame();
    if (result?.error) {
      showToast(t(result.error), 'error');
      startButton.disabled = false;
      return;
    }
    sound.play('start');
  });

  leaveButton.addEventListener('click', async () => {
    const confirmed = await confirmModal(t('game.leaveConfirm'), { confirmLabel: t('lobby.leave') });
    if (!confirmed) return;
    await leaveRoom(code, store.get().uid);
    remove(STORAGE_KEYS.lastRoom);
    store.clearRoom();
    router.go('menu');
  });

  /* ---------- обновление ---------- */

  function refreshPlayers() {
    const { players, room } = store.get();
    if (!room) return;

    const signature = players.map((p) => `${p.uid}:${p.ready}`).join('|');
    if (signature !== knownPlayerIds) {
      knownPlayerIds = signature;
      playersGrid.replaceChildren(...players.map((player, index) =>
        playerCard(player, {
          index,
          me: player.uid === store.get().uid,
          tags: lobbyTags(player, room.hostId),
        })));
    }

    counter.innerHTML = '';
    counter.append(
      el('b', {}, String(players.length)),
      document.createTextNode(` / ${room.settings.maxPlayers}`),
    );

    const me = store.me;
    if (me) {
      readyButton.classList.toggle('btn--mint', !me.ready);
      readyButton.classList.toggle('btn--ghost', me.ready);
      readyButton.lastChild.textContent = me.ready ? t('lobby.notReady') : t('lobby.ready');
    }

    updateStartState();
  }

  function updateStartState() {
    const { players, room } = store.get();
    if (!room) return;
    const isHost = store.isHost;
    startButton.classList.toggle('hidden', !isHost);

    if (players.length < LIMITS.minPlayers) {
      hint.textContent = t('lobby.needMore', { n: LIMITS.minPlayers - players.length });
      hint.className = 'action-hint';
      startButton.disabled = true;
      return;
    }
    const allReady = players.every((p) => p.ready || p.uid === room.hostId);
    const deck = validateDeck(room.settings, players.length);

    if (!deck.ok) {
      hint.textContent = t(deck.reason);
      hint.className = 'action-hint';
      startButton.disabled = true;
    } else if (!allReady) {
      hint.textContent = t('lobby.notAllReady');
      hint.className = 'action-hint';
      startButton.disabled = true;
    } else {
      hint.textContent = isHost ? t('settings.balanceOk') : t('lobby.waitHost');
      hint.className = 'action-hint action-hint--active';
      startButton.disabled = !isHost;
    }
  }

  function refreshSettings() {
    const { room } = store.get();
    if (!room) return;
    // Хозяин правит свою копию — перерисовка сбросила бы ему фокус.
    const signature = JSON.stringify(room.settings);
    if (store.isHost && knownSettings) { knownSettings = signature; return; }
    if (signature === knownSettings) return;
    knownSettings = signature;
    settingsSlot.replaceChildren(roomSettingsPanel(code, room));
  }

  /* ---------- подписки ---------- */

  subs.add(watchRoom(code));
  subs.add(watchPlayers(code));
  subs.add(bus.on('players:update', refreshPlayers));
  subs.add(bus.on('room:update', () => { refreshSettings(); refreshPlayers(); }));
  subs.add(bus.on('room:gone', () => {
    showToast(t('lobby.kicked'), 'warn');
    store.clearRoom();
    router.go('menu');
  }));
  subs.add(bus.on('phase:change', ({ room }) => {
    if (room.status === 'playing') router.go('game', { code });
  }));

  // Если партия уже идёт (перезаход в комнату) — сразу на игровой экран.
  subs.add(bus.on('room:update', (room) => {
    if (room.status === 'playing' && router.current === 'lobby') router.go('game', { code });
  }));

  engine.attach(code);
  const heartbeat = setInterval(() => touch(code, store.get().uid).catch(() => {}), 30_000);

  const screen = el('div.screen', {},
    el('div.lobby-head', {},
      el('div.stack', { style: { gap: '4px' } },
        el('div.eyebrow', {}, t('lobby.title')),
        codeButton,
        el('div.faint', { style: { fontSize: '0.8em' } }, t('lobby.codeHint')),
      ),
      counter,
    ),

    el('div.lobby-layout', {},
      el('div.stack', {},
        el('section.panel.stack', {},
          el('div.panel__title', {}, el('h3', { style: { margin: 0 } }, t('lobby.players'))),
          playersGrid,
        ),
        hint,
        el('div.row.row--stack-mobile', {}, readyButton, startButton, el('div.spacer'), leaveButton),
      ),
      settingsSlot,
    ),
  );

  refreshSettings();
  refreshPlayers();

  return {
    element: screen,
    destroy() {
      subs.close();
      clearInterval(heartbeat);
    },
  };
}
