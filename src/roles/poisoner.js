/**
 * Отравитель.
 * Играет за мафию. Яд убивает не сразу: жертва умирает в конце
 * следующей ночи, если доктор её не вылечит.
 */
export default {
  id: 'poisoner',
  icon: '🧪',
  team: 'mafia',
  order: 40,
  isBase: false,
  actsAtNight: true,
  knowsAllies: true,
  name: { ru: 'Отравитель', en: 'Poisoner' },
  short: { ru: 'Медленная смерть', en: 'The slow death' },
  actionLabel: { ru: 'Кого отравите?', en: 'Who do you poison?' },
  description: {
    ru: 'Отравленный умирает в конце следующей ночи. Лечение доктора снимает яд.',
    en: 'The poisoned player dies at the end of the next night. The doctor cures the poison.',
  },

  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId && ctx.teamOf(targetId) !== 'mafia';
  },

  resolve(ctx, action) {
    if (ctx.isPoisoned(action.targetId)) return; // второй раз яд не действует
    ctx.poison(action.targetId);
  },
};
