/**
 * Комиссар.
 * Ночью проверяет одного игрока и узнаёт, за мафию тот или нет.
 * Адвокат для комиссара выглядит как мирный.
 */
export default {
  id: 'sheriff',
  icon: '🔎',
  team: 'town',
  order: 50,
  isBase: true,
  actsAtNight: true,
  knowsAllies: false,
  name: { ru: 'Комиссар', en: 'Sheriff' },
  short: { ru: 'Проверка', en: 'The check' },
  actionLabel: { ru: 'Кого проверяете?', en: 'Who do you check?' },
  description: {
    ru: 'Вы узнаёте, состоит ли выбранный игрок в мафии. Опытный адвокат умеет прятаться от проверки.',
    en: 'You learn whether the target belongs to the mafia. A good lawyer can hide from your check.',
  },

  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId;
  },

  resolve(ctx, action) {
    const role = ctx.roleOf(action.targetId);
    const guilty = ctx.teamOf(action.targetId) === 'mafia' && role !== 'lawyer';
    ctx.note(action.actorId, {
      type: 'check',
      text: {
        ru: `${ctx.nameOf(action.targetId)} — ${guilty ? 'мафия' : 'не мафия'}`,
        en: `${ctx.nameOf(action.targetId)} — ${guilty ? 'mafia' : 'not mafia'}`,
      },
    });
  },
};
