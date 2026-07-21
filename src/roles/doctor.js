/**
 * Доктор.
 * Спасает одного игрока за ночь. Одного и того же человека
 * нельзя лечить две ночи подряд — включая себя.
 */
export default {
  id: 'doctor',
  icon: '✚',
  team: 'town',
  order: 20,
  isBase: true,
  actsAtNight: true,
  knowsAllies: false,
  name: { ru: 'Доктор', en: 'Doctor' },
  short: { ru: 'Спасение', en: 'The save' },
  actionLabel: { ru: 'Кого лечите этой ночью?', en: 'Who do you heal tonight?' },
  description: {
    ru: 'Выбранный игрок переживёт покушение и излечится от яда. Дважды подряд одного и того же лечить нельзя.',
    en: 'Your patient survives an attack and is cured of poison. You cannot heal the same person twice in a row.',
  },

  canTarget(ctx, actorId, targetId) {
    return ctx.previousChoice(actorId) !== targetId;
  },

  resolve(ctx, action) {
    ctx.heal(action.targetId);
  },
};
