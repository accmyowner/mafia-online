/**
 * Мирный житель.
 * Ночью не действует, днём голосует. Основа команды города.
 */
export default {
  id: 'civilian',
  icon: '🧑',
  team: 'town',
  order: 100,
  isBase: true,
  actsAtNight: false,
  knowsAllies: false,
  name: { ru: 'Мирный житель', en: 'Civilian' },
  short: { ru: 'Голос города', en: 'Voice of the city' },
  description: {
    ru: 'У вас нет ночной способности. Ваше оружие — внимание и голос на дневном голосовании.',
    en: 'You have no night ability. Your weapons are attention and your vote during the day.',
  },
};
