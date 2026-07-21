/**
 * Игровые константы и настройки по умолчанию.
 * Здесь нет ничего, что зависит от Firebase, — только правила игры,
 * чтобы их можно было менять, не трогая сетевой слой.
 */

export const LIMITS = {
  minPlayers: 4,
  maxPlayers: 15,
  nameMax: 16,
  chatMax: 200,
  codeLength: 5,
};

/** Диапазоны длительности фаз в секундах. */
export const TIMING = {
  night: { min: 20, max: 120, step: 5, default: 40 },
  day: { min: 30, max: 300, step: 15, default: 90 },
  vote: { min: 20, max: 120, step: 10, default: 40 },
  /** Через сколько миллисекунд игрок считается отключившимся. */
  heartbeatTimeout: 60_000,
};

/** Настройки комнаты по умолчанию. */
export function defaultSettings() {
  return {
    maxPlayers: 10,
    dayTime: TIMING.day.default,
    nightTime: TIMING.night.default,
    voteTime: TIMING.vote.default,
    chatEnabled: true,
    extraRolesEnabled: true,
    revealRoleOnDeath: true,
    /** Сколько игроков получает каждую роль. Ключ — id роли. */
    roles: {
      mafia: 1,
      don: 0,
      doctor: 1,
      sheriff: 1,
      maniac: 0,
      bodyguard: 0,
      lover: 0,
      lawyer: 0,
      journalist: 0,
      witness: 0,
      spy: 0,
      poisoner: 0,
    },
  };
}

/** Аватары-эмодзи: выбираются детерминированно по uid. */
export const AVATARS = ['🎩', '🕵️', '🃏', '🦊', '🐺', '🦉', '🐍', '🦅', '🎭', '👁️', '🗝️', '🕯️', '☠️', '🪄', '🎲'];

/** Ключи локального хранилища (см. utils/storage.js). */
export const STORAGE_KEYS = {
  profile: 'mafia:profile',
  settings: 'mafia:settings',
  lastRoom: 'mafia:lastRoom',
};

/**
 * Ссылки нижней панели. Замените на свои перед публикацией —
 * больше нигде в коде они не встречаются.
 */
export const LINKS = {
  author: 'Мафия Online',
  github: 'https://github.com/',
  discord: 'https://discord.com/',
};
