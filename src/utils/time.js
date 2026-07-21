/** Работа со временем и таймерами фаз. */

/** Секунды -> «01:30». */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Сколько секунд осталось до метки времени (мс). */
export function secondsLeft(endsAt) {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

/**
 * Тикающий таймер, который сам останавливается.
 * Возвращает функцию остановки — её вызывает роутер при уходе с экрана.
 */
export function everySecond(callback) {
  callback();
  const id = setInterval(callback, 1000);
  return () => clearInterval(id);
}

/** Ожидание, удобное для последовательных анимаций. */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Ограничивает частоту вызова — используется для записи в Firestore. */
export function throttle(fn, ms) {
  let last = 0;
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const rest = ms - (now - last);
    if (rest <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn(...args);
      }, rest);
    }
  };
}
