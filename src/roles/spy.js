/**
 * Шпион.
 * Узнаёт, есть ли у выбранного игрока ночная способность.
 * Помогает отличить активную роль от мирного жителя.
 */
export default {
  id: 'spy',
  icon: '🕶️',
  team: 'town',
  order: 55,
  isBase: false,
  actsAtNight: true,
  knowsAllies: false,
  name: { ru: 'Шпион', en: 'Spy' },
  short: { ru: 'Досье', en: 'The dossier' },
  actionLabel: { ru: 'На кого собираете досье?', en: 'Who do you profile?' },
  description: {
    ru: 'Вы узнаёте, есть ли у игрока ночная способность, но не какая именно.',
    en: 'You learn whether the target has a night ability, but not which one.',
  },

  canTarget(ctx, actorId, targetId) {
    return targetId !== actorId;
  },

  resolve(ctx, action) {
    const active = ctx.hasNightAbility(action.targetId);
    ctx.note(action.actorId, {
      type: 'check',
      text: {
        ru: `${ctx.nameOf(action.targetId)} — ${active ? 'активная роль' : 'мирный житель'}`,
        en: `${ctx.nameOf(action.targetId)} — ${active ? 'an active role' : 'a plain civilian'}`,
      },
    });
  },
};
