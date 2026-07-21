/**
 * Любовница.
 * Оставляет игрока у себя на ночь: он не может воспользоваться
 * своей способностью. На выстрел мафии это не влияет.
 */
export default {
  id: 'lover',
  icon: '💋',
  team: 'town',
  order: 10,
  isBase: false,
  actsAtNight: true,
  knowsAllies: false,
  name: { ru: 'Любовница', en: 'Lover' },
  short: { ru: 'Отвлечение', en: 'The distraction' },
  actionLabel: { ru: 'Кого отвлечёте этой ночью?', en: 'Who do you distract tonight?' },
  description: {
    ru: 'Выбранный игрок теряет ночную способность до утра. Одного и того же дважды подряд отвлечь нельзя.',
    en: 'The chosen player loses their night ability until morning. Not the same person twice in a row.',
  },

  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId && ctx.previousChoice(actorId) !== targetId;
  },

  resolve(ctx, action) {
    ctx.block(action.targetId);
  },
};
