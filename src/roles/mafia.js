/**
 * Мафия.
 * Ночью выбирает жертву. Если мафиози несколько, побеждает вариант,
 * который выбрал последний по времени, — так что договаривайтесь.
 */
export default {
  id: 'mafia',
  icon: '🔫',
  team: 'mafia',
  order: 30,
  isBase: true,
  actsAtNight: true,
  knowsAllies: true,
  name: { ru: 'Мафия', en: 'Mafia' },
  short: { ru: 'Ночной выстрел', en: 'The night shot' },
  actionLabel: { ru: 'Кого убрать этой ночью?', en: 'Who dies tonight?' },
  description: {
    ru: 'Каждую ночь мафия выбирает жертву. Вы знаете своих и переписываетесь с ними в отдельном канале.',
    en: 'Each night the mafia picks a victim. You know your allies and share a private channel.',
  },

  /** Своих не трогаем. */
  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId && ctx.teamOf(targetId) !== 'mafia';
  },

  resolve(ctx, action) {
    ctx.kill(action.actorId, action.targetId, 'mafia');
  },
};
