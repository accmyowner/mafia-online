/**
 * Маньяк.
 * Играет сам за себя: убивает по ночам и побеждает, когда
 * в городе не остаётся никого, кроме него и одной жертвы.
 */
export default {
  id: 'maniac',
  icon: '🔪',
  team: 'solo',
  order: 35,
  isBase: false,
  actsAtNight: true,
  knowsAllies: false,
  name: { ru: 'Маньяк', en: 'Maniac' },
  short: { ru: 'Сам за себя', en: 'On his own' },
  actionLabel: { ru: 'Кого убить этой ночью?', en: 'Who do you kill tonight?' },
  description: {
    ru: 'Вы убиваете каждую ночь и не состоите ни в одной команде. Побеждаете, когда остаётесь последним.',
    en: 'You kill every night and belong to no team. You win when you are the last one standing.',
  },

  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId;
  },

  resolve(ctx, action) {
    ctx.kill(action.actorId, action.targetId, 'maniac');
  },
};
