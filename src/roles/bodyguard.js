/**
 * Телохранитель.
 * Закрывает выбранного игрока собой: если этой ночью на подопечного
 * нападут, погибнет телохранитель.
 */
export default {
  id: 'bodyguard',
  icon: '🛡️',
  team: 'town',
  order: 15,
  isBase: false,
  actsAtNight: true,
  knowsAllies: false,
  name: { ru: 'Телохранитель', en: 'Bodyguard' },
  short: { ru: 'Щит', en: 'The shield' },
  actionLabel: { ru: 'Кого прикрываете?', en: 'Who do you guard?' },
  description: {
    ru: 'Нападение на вашего подопечного убивает вас, а не его. Себя прикрыть нельзя.',
    en: 'An attack on your ward kills you instead. You cannot guard yourself.',
  },

  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId;
  },

  resolve(ctx, action) {
    ctx.guard(action.targetId, action.actorId);
  },
};
