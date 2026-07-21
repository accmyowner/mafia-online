/**
 * Журналист.
 * Утром печатает заметку: выходил ли выбранный игрок из дома этой ночью.
 * Заметку видит весь город — это единственная публичная способность.
 */
export default {
  id: 'journalist',
  icon: '📰',
  team: 'town',
  order: 60,
  isBase: false,
  actsAtNight: true,
  knowsAllies: false,
  name: { ru: 'Журналист', en: 'Journalist' },
  short: { ru: 'Утренний выпуск', en: 'The morning edition' },
  actionLabel: { ru: 'О ком напишете статью?', en: 'Who is your story about?' },
  description: {
    ru: 'Город узнаёт, действовал ли выбранный игрок этой ночью. Имя журналиста в статье не указано.',
    en: 'The city learns whether the target acted during the night. Your name never appears in the article.',
  },

  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId;
  },

  resolve(ctx, action) {
    const active = ctx.didAct(action.targetId);
    ctx.publish({
      type: 'info',
      text: {
        ru: `Заметка в газете: ${ctx.nameOf(action.targetId)} ${active ? 'этой ночью выходил из дома' : 'всю ночь был дома'}.`,
        en: `Newspaper note: ${ctx.nameOf(action.targetId)} ${active ? 'left the house tonight' : 'stayed home all night'}.`,
      },
    });
  },
};
