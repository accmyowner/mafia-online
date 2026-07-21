/**
 * Все пути к документам собраны в одном месте.
 * Если структура базы изменится, править нужно только здесь.
 *
 *   rooms/{code}
 *   rooms/{code}/players/{uid}
 *   rooms/{code}/secret/{uid}      — роль, видна только владельцу и хозяину
 *   rooms/{code}/actions/{n}_{uid} — ночные действия
 *   rooms/{code}/votes/{d}_{uid}   — голоса дня
 *   rooms/{code}/chat/{id}        — общий чат города
 *   rooms/{code}/chatMafia/{id}   — закрытый канал мафии
 */
export const paths = {
  room: (code) => `rooms/${code}`,
  players: (code) => `rooms/${code}/players`,
  player: (code, uid) => `rooms/${code}/players/${uid}`,
  secrets: (code) => `rooms/${code}/secret`,
  secret: (code, uid) => `rooms/${code}/secret/${uid}`,
  /** Служебная память ведущего: яд, прошлые выборы, защита адвоката. */
  memory: (code) => `rooms/${code}/secret/_engine`,
  actions: (code) => `rooms/${code}/actions`,
  action: (code, night, uid) => `rooms/${code}/actions/${night}_${uid}`,
  votes: (code) => `rooms/${code}/votes`,
  vote: (code, day, uid) => `rooms/${code}/votes/${day}_${uid}`,
  /**
   * Каналы чата разведены по разным коллекциям: так правила Firestore
   * могут просто запретить городу читать переписку мафии.
   */
  chat: (code, channel = 'town') => `rooms/${code}/${channel === 'mafia' ? 'chatMafia' : 'chat'}`,
  message: (code, id, channel = 'town') => `${paths.chat(code, channel)}/${id}`,
};
