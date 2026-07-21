/**
 * Игровой экран.
 *
 * Один экран на всю партию: шапка с фазой и таймером не пересобирается,
 * меняется только тело — карта роли, ночной выбор, утренняя сводка,
 * голосование или итог. Чат живёт отдельным узлом, чтобы не терять текст,
 * который игрок как раз набирает.
 */
import { el } from '../../utils/dom.js';
import { t, tr } from '../i18n.js';
import { store } from '../../core/store.js';
import { bus } from '../../core/eventBus.js';
import { router } from '../../core/router.js';
import { db } from '../../network/db.js';
import { paths } from '../../network/paths.js';
import { STORAGE_KEYS } from '../../core/config.js';
import { remove } from '../../utils/storage.js';
import {
  watchRoom, watchPlayers, watchVotes, subscriptionBundle,
} from '../../network/subscriptions.js';
import {
  submitAction, submitVote, getMyAction, listRoles, leaveRoom, updatePlayer,
} from '../../network/roomsRepo.js';
import { engine } from '../../game/gameEngine.js';
import { runPhaseTimer } from '../../game/phaseTimer.js';
import { nightSummary, voteSummary, personalNotes } from '../../game/dayPhase.js';
import { chatPanel } from '../../game/chat.js';
import { getRole, TEAM_LABEL } from '../../roles/index.js';
import { playerCard } from '../components/playerCard.js';
import { roleCard, myRoleBadge } from '../components/roleReveal.js';
import { confirmModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { applyPhase, setPhaseProgress } from '../theme.js';
import { winnerLabels } from '../../game/winConditions.js';
import { sound } from '../../utils/sound.js';

const PHASE_SOUND = { night: 'night', day: 'day', vote: 'vote', reveal: 'reveal' };

export function renderGame(params = {}) {
  const code = params.code || store.get().roomCode;
  if (!code) { router.go('menu'); return el('div'); }
  store.patch({ roomCode: code });

  const subs = subscriptionBundle();
  const uid = store.get().uid;

  /** Локальная память экрана: всё, что не нужно хранить в базе. */
  const local = {
    role: null,          // моя роль
    allies: [],          // союзники (для мафии)
    notes: [],           // личные результаты проверок
    notesRound: 0,
    target: null,        // выбор этой ночью
    prevTarget: null,    // выбор прошлой ночи (для доктора)
    voted: null,         // за кого проголосовал
    phaseKey: '',        // фаза+круг, чтобы понять, что пора пересобрать тело
    finalRoles: null,    // роли всех игроков — только после партии
  };

  let stopTimer = null;
  let chat = null;
  let voteWatch = null;

  /* ---------------- каркас ---------------- */

  const phaseTitle = el('h2.phase-head__title');
  const phaseSub = el('div.phase-head__sub');
  const timerNode = el('div.timer.mono', {}, '--:--');
  const roleSlot = el('div');
  const body = el('div.stack');
  const chatSlot = el('div');

  const leaveButton = el('button.btn.btn--ghost.btn--sm', {
    type: 'button',
    onClick: async () => {
      const confirmed = await confirmModal(t('game.leaveConfirm'), { confirmLabel: t('lobby.leave') });
      if (!confirmed) return;
      await leaveRoom(code, uid);
      remove(STORAGE_KEYS.lastRoom);
      store.clearRoom();
      router.go('menu');
    },
  }, t('lobby.leave'));

  const screen = el('div.screen', {},
    el('header.phase-head', {},
      el('div', {}, phaseTitle, phaseSub),
      el('div.row', {}, timerNode, leaveButton),
    ),
    roleSlot,
    body,
    chatSlot,
  );

  /* ---------------- вспомогательное ---------------- */

  /** Урезанный контекст для проверки целей на стороне клиента. */
  function clientContext(players) {
    const aliveIds = players.filter((p) => p.alive !== false).map((p) => p.uid);
    const mafia = new Set(local.role?.team === 'mafia' ? [uid, ...local.allies] : []);
    return {
      aliveIds,
      isAlive: (id) => aliveIds.includes(id),
      teamOf: (id) => (mafia.has(id) ? 'mafia' : 'unknown'),
      previousChoice: (id) => (id === uid ? local.prevTarget : null),
      isPoisoned: () => false, // яд — тайна ведущего, клиенту знать не положено
    };
  }

  function alivePlayers() {
    return store.get().players.filter((p) => p.alive !== false);
  }

  function iAmAlive() {
    return store.me?.alive !== false;
  }

  function setChat(config) {
    chat?.destroy();
    chat = null;
    chatSlot.replaceChildren();
    if (!config) return;
    chat = chatPanel(code, config);
    chatSlot.append(chat.element);
  }

  /* ---------------- тело экрана по фазам ---------------- */

  function renderReveal() {
    const role = local.role;
    if (!role) return [el('div.action-hint', {}, t('common.loading'))];
    roleSlot.replaceChildren();
    return [
      el('div.center.stack', {},
        el('p.dim', {}, t('game.tapToReveal')),
        roleCard(role.id, {
          onOpen: () => {
            updatePlayer(code, uid, { seenRole: true }).catch(() => {});
            if (role.knowsAllies && local.allies.length) showAllies();
          },
        }),
      ),
    ];
  }

  /** Мафии показываем своих — один раз, сразу после открытия карты. */
  function showAllies() {
    const names = store.get().players
      .filter((p) => local.allies.includes(p.uid))
      .map((p) => `${p.avatar} ${p.name}`);
    if (names.length) showToast(`${t('game.allies')}: ${names.join(', ')}`, 'info', 6000);
  }

  function renderNight() {
    roleSlot.replaceChildren(local.role ? myRoleBadge(local.role.id) : null);

    if (!iAmAlive()) {
      return [el('div.action-hint', {}, t('game.youAreDead')), deadFeed()];
    }
    if (!local.role?.actsAtNight) {
      return [
        el('div.action-hint', {}, t('game.sleep')),
        el('div.panel.center.dim', {}, tr(local.role.description)),
      ];
    }

    const ctx = clientContext(store.get().players);
    const hint = el(`div.action-hint.action-hint--${local.target ? 'done' : 'active'}`, {},
      local.target
        ? t('game.actionSaved')
        : tr(local.role.actionLabel));

    const grid = el('div.grid.grid--players', {}, alivePlayers().map((player, index) => {
      const allowed = local.role.canTarget(ctx, uid, player.uid);
      return playerCard(player, {
        index,
        me: player.uid === uid,
        selectable: allowed,
        disabled: !allowed,
        selected: local.target === player.uid,
        tags: local.allies.includes(player.uid) ? [{ label: t('game.ally'), tone: 'mafia' }] : [],
        onSelect: async (chosen) => {
          local.target = chosen.uid;
          await submitAction(code, store.get().room.state.round, uid, {
            targetId: chosen.uid, role: local.role.id,
          });
          sound.play('click');
          rebuild(true);
        },
      });
    }));

    return [hint, grid];
  }

  function renderDay() {
    roleSlot.replaceChildren(local.role ? myRoleBadge(local.role.id) : null);
    const state = store.get().room.state;

    const feed = el('section.panel.stack', {},
      el('div.panel__title', {}, el('h3', { style: { margin: 0 } }, t('game.morning'))),
      el('div.feed', {},
        ...nightSummary(state.lastNight),
        voteSummary(state.lastVote),
        ...(local.notesRound === state.round ? personalNotes(local.notes) : []),
      ),
    );

    setChat(store.get().room.settings.chatEnabled && iAmAlive()
      ? { channel: 'town', enabled: true }
      : null);

    return [
      feed,
      el('div.action-hint', {}, iAmAlive() ? t('game.discussHint') : t('game.youAreDead')),
      el('div.grid.grid--players', {}, store.get().players.map((player, index) =>
        playerCard(player, { index, me: player.uid === uid }))),
    ];
  }

  function renderVote() {
    roleSlot.replaceChildren(local.role ? myRoleBadge(local.role.id) : null);
    const round = store.get().room.state.round;
    const votes = store.get().votes || [];
    const counts = {};
    votes.forEach((vote) => { if (vote.targetId) counts[vote.targetId] = (counts[vote.targetId] || 0) + 1; });

    const locked = local.voted !== null || !iAmAlive();
    const hint = el(`div.action-hint${locked ? '' : '.action-hint--active'}`, {},
      !iAmAlive() ? t('game.youAreDead') : locked ? t('game.voteSaved') : t('game.voteHint'));

    const grid = el('div.grid.grid--players', {}, alivePlayers().map((player, index) =>
      playerCard(player, {
        index,
        me: player.uid === uid,
        selectable: !locked && player.uid !== uid,
        disabled: locked || player.uid === uid,
        selected: local.voted === player.uid,
        votes: counts[player.uid] || 0,
        onSelect: async (chosen) => {
          local.voted = chosen.uid;
          await submitVote(code, round, uid, chosen.uid);
          sound.play('vote');
          rebuild(true);
        },
      })));

    const skip = el('button.btn.btn--ghost.btn--block', {
      type: 'button',
      disabled: locked,
      onClick: async () => {
        local.voted = 'skip';
        await submitVote(code, round, uid, null);
        rebuild(true);
      },
    }, t('game.abstain'));

    const progress = el('div.dim.center', {},
      t('game.votedCount', { n: votes.length, total: alivePlayers().length }));

    return [hint, grid, iAmAlive() ? skip : null, progress];
  }

  function renderEnded() {
    roleSlot.replaceChildren();
    setChat(null);
    setPhaseProgress(0);
    const state = store.get().room.state;
    const labels = winnerLabels(state.winner);
    // Маньяк играет за команду solo, а победа объявляется как «maniac».
    const winnerTeam = state.winner === 'maniac' ? 'solo' : state.winner;
    const iWon = local.role?.team === winnerTeam;

    sound.play(iWon ? 'win' : 'lose');

    const list = el('div.reveal-list', {}, store.get().players.map((player, index) => {
      const roleId = local.finalRoles?.[player.uid];
      const role = roleId ? getRole(roleId) : null;
      return el('div.reveal-row', { style: { '--i': index } },
        el('span', {}, `${player.avatar} ${player.name}`),
        role
          ? el('span', {}, `${role.icon} ${tr(role.name)} · `, el('span.faint', {}, tr(TEAM_LABEL[role.team])))
          : el('span.faint', {}, '—'),
      );
    }));

    const actions = el('div.row.row--stack-mobile', {},
      store.isHost
        ? el('button.btn.btn--primary', { type: 'button', onClick: () => engine.backToLobby() },
            t('end.again'))
        : el('div.dim', {}, t('end.waitHost')),
      el('div.spacer'),
      el('button.btn.btn--ghost', {
        type: 'button',
        onClick: async () => {
          await leaveRoom(code, uid);
          remove(STORAGE_KEYS.lastRoom);
          store.clearRoom();
          router.go('menu');
        },
      }, t('end.toMenu')),
    );

    return [
      el(`section.result.result--${labels.tone}`, {},
        el('div.result__title', {}, t(labels.title)),
        el('div.result__sub', {}, t(labels.sub)),
        el('div.result__mine', {}, iWon ? t('end.youWon') : t('end.youLost')),
      ),
      el('section.panel.stack', {},
        el('div.panel__title', {}, el('h3', { style: { margin: 0 } }, t('end.rolesTitle'))),
        list,
      ),
      actions,
    ];
  }

  /** Лента для погибших: они видят ход партии, но не участвуют. */
  function deadFeed() {
    const state = store.get().room.state;
    return el('section.panel.stack', {},
      el('div.panel__title', {}, el('h3', { style: { margin: 0 } }, t('game.spectator'))),
      el('div.feed', {}, ...nightSummary(state.lastNight), voteSummary(state.lastVote)),
    );
  }

  /* ---------------- сборка ---------------- */

  const RENDERERS = {
    reveal: renderReveal, night: renderNight, day: renderDay,
    vote: renderVote, ended: renderEnded,
  };

  function rebuild(force = false) {
    const room = store.get().room;
    if (!room) return;
    const { phase, round, phaseEndsAt } = room.state;
    const key = `${phase}:${round}`;

    if (key !== local.phaseKey) {
      local.phaseKey = key;
      onPhaseEnter(phase, round, phaseEndsAt, room);
    } else if (!force) {
      // Та же фаза: обновляем только то, что зависит от чужих действий.
      if (phase !== 'vote' && phase !== 'day') return;
    }

    phaseTitle.textContent = t(`game.phase.${phase}`);
    phaseSub.textContent = phase === 'ended'
      ? t('game.over')
      : `${t('game.round', { n: round })} · ${t('game.alive', { n: alivePlayers().length })}`;

    body.replaceChildren(...(RENDERERS[phase]?.() || []));
  }

  /** Всё, что нужно сделать один раз на входе в фазу. */
  function onPhaseEnter(phase, round, phaseEndsAt, room) {
    applyPhase(phase);
    if (PHASE_SOUND[phase]) sound.play(PHASE_SOUND[phase]);

    stopTimer?.();
    stopTimer = null;
    timerNode.textContent = '--:--';

    const seconds = { night: room.settings.nightTime, day: room.settings.dayTime, vote: room.settings.voteTime }[phase];
    if (phaseEndsAt > 0) {
      stopTimer = runPhaseTimer(timerNode, phaseEndsAt, seconds || 8);
    }

    voteWatch?.();
    voteWatch = null;

    if (phase === 'night') {
      local.prevTarget = local.target;
      local.target = null;
      setChat(local.role?.team === 'mafia' && iAmAlive() && room.settings.chatEnabled
        ? { channel: 'mafia', enabled: true, note: t('game.secret') }
        : null);
      // Если вкладку перезагрузили посреди ночи — подтянем свой выбор.
      getMyAction(code, round, uid).then((action) => {
        if (action?.targetId) { local.target = action.targetId; rebuild(true); }
      }).catch(() => {});
    }

    if (phase === 'vote') {
      local.voted = null;
      voteWatch = watchVotes(code, round);
      setChat(room.settings.chatEnabled && iAmAlive() ? { channel: 'town', enabled: true } : null);
    }

    if (phase === 'ended') {
      listRoles(code).then((roles) => { local.finalRoles = roles; rebuild(true); }).catch(() => {});
    }
  }

  /* ---------------- подписки ---------------- */

  subs.add(watchRoom(code));
  subs.add(watchPlayers(code));
  subs.add(bus.on('room:update', () => rebuild()));
  subs.add(bus.on('players:update', () => rebuild()));
  subs.add(bus.on('votes:update', () => { if (store.get().room?.state.phase === 'vote') rebuild(true); }));
  subs.add(bus.on('room:gone', () => { store.clearRoom(); router.go('menu'); }));

  // Личный документ: роль, союзники и результаты проверок.
  subs.add(db().watchDoc(paths.secret(code, uid), (secret) => {
    if (!secret) return;
    if (secret.role && secret.role !== local.role?.id) {
      local.role = getRole(secret.role);
      store.patch({ myRole: secret.role });
      rebuild(true);
    }
    local.allies = secret.allies || [];
    if (secret.notesRound && secret.notesRound !== local.notesRound) {
      local.notes = secret.notes || [];
      local.notesRound = secret.notesRound;
      rebuild(true);
    }
  }));

  subs.add(bus.on('phase:change', ({ room }) => {
    if (room.status === 'lobby') router.go('lobby', { code });
  }));

  engine.attach(code);
  rebuild(true);

  return {
    element: screen,
    destroy() {
      subs.close();
      stopTimer?.();
      voteWatch?.();
      chat?.destroy();
      setPhaseProgress(0);
    },
  };
}
