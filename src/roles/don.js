/**
 * Дон мафии.
 * Стреляет наравне с мафией — его выбор считается решающим — и заодно
 * проверяет, не комиссар ли перед ним.
 */
export default {
  id: 'don',
  icon: '🎩',
  team: 'mafia',
  order: 32,   // строго после обычной мафии: слово дона отменяет их выбор
  isBase: false,
  actsAtNight: true,
  knowsAllies: true,
  name: { ru: 'Дон мафии', en: 'Mafia don' },
  short: { ru: 'Последнее слово', en: 'The final word' },
  actionLabel: { ru: 'Ваш выстрел и проверка на комиссара', en: 'Your shot and sheriff check' },
  description: {
    ru: 'Ваш выстрел отменяет выбор остальной мафии. Заодно вы узнаёте, комиссар ли ваша цель.',
    en: 'Your shot overrides the rest of the mafia. You also learn whether the target is the sheriff.',
  },

  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId && ctx.teamOf(targetId) !== 'mafia';
  },

  resolve(ctx, action) {
    ctx.cancelKillsBy('mafia');            // слово дона важнее
    ctx.kill(action.actorId, action.targetId, 'mafia');
    const isSheriff = ctx.roleOf(action.targetId) === 'sheriff';
    ctx.note(action.actorId, {
      type: 'check',
      text: {
        ru: `${ctx.nameOf(action.targetId)} — ${isSheriff ? 'комиссар' : 'не комиссар'}`,
        en: `${ctx.nameOf(action.targetId)} — ${isSheriff ? 'the sheriff' : 'not the sheriff'}`,
      },
    });
  },
};
