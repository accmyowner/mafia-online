/**
 * Таймер фазы.
 * Отсчёт ведётся от метки времени в документе комнаты, поэтому
 * у всех игроков цифры совпадают, а перезагрузка страницы ничего не ломает.
 */
import { secondsLeft, everySecond, formatClock } from '../utils/time.js';
import { setPhaseProgress } from '../ui/theme.js';
import { sound } from '../utils/sound.js';

/**
 * Запускает отсчёт и обновляет узел с временем.
 * @returns {Function} остановка таймера
 */
export function runPhaseTimer(node, endsAt, totalSeconds, onExpire) {
  let expired = false;
  return everySecond(() => {
    const left = secondsLeft(endsAt);
    if (node) {
      node.textContent = formatClock(left);
      node.classList.toggle('timer--urgent', left <= 10 && left > 0);
    }
    setPhaseProgress(totalSeconds ? 1 - left / totalSeconds : 0);
    if (left <= 5 && left > 0) sound.play('tick');
    if (left === 0 && !expired) {
      expired = true;
      onExpire?.();
    }
  });
}
