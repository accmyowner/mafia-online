/**
 * Свидетель.
 * Следит за домом выбранного игрока и утром узнаёт, кто к нему приходил.
 */
export default {
  id: 'witness',
  icon: '👁️',
  team: 'town',
  order: 62,
  isBase: false,
  actsAtNight: true,
  knowsAllies: false,
  name: { ru: 'Свидетель', en: 'Witness' },
  short: { ru: 'Слежка', en: 'The stakeout' },
  actionLabel: { ru: 'За чьим домом следите?', en: 'Whose house do you watch?' },
  description: {
    ru: 'Вы узнаёте имена всех, кто приходил к выбранному игроку этой ночью, но не их роли.',
    en: 'You learn the names of everyone who visited the target tonight, but not their roles.',
  },

  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId;
  },

  resolve(ctx, action) {
    const visitors = ctx.visitorsOf(action.targetId).filter((uid) => uid !== action.actorId);
    const names = visitors.map((uid) => ctx.nameOf(uid)).join(', ');
    ctx.note(action.actorId, {
      type: 'info',
      text: {
        ru: visitors.length
          ? `К игроку ${ctx.nameOf(action.targetId)} приходили: ${names}`
          : `К игроку ${ctx.nameOf(action.targetId)} никто не приходил`,
        en: visitors.length
          ? `Visitors of ${ctx.nameOf(action.targetId)}: ${names}`
          : `Nobody visited ${ctx.nameOf(action.targetId)}`,
      },
    });
  },
};
