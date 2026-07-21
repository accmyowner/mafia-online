/**
 * Адвокат.
 * Играет за мафию. Прячет одного игрока от проверки комиссара
 * и от дневного голосования.
 */
export default {
  id: 'lawyer',
  icon: '⚖️',
  team: 'mafia',
  order: 12,
  isBase: false,
  actsAtNight: true,
  knowsAllies: true,
  name: { ru: 'Адвокат', en: 'Lawyer' },
  short: { ru: 'Защита', en: 'The defence' },
  actionLabel: { ru: 'Кого защищаете от суда?', en: 'Who do you defend?' },
  description: {
    ru: 'Ваш подзащитный переживёт дневное голосование, даже если получит больше всех голосов. Себя вы проверке не выдаёте.',
    en: 'Your client survives the day vote even with the most votes. Your own check always comes back clean.',
  },

  canTarget(ctx, actorId, targetId) {
    return ctx.aliveIds.has(targetId);
  },

  resolve(ctx, action) {
    ctx.defend(action.targetId);
  },
};
