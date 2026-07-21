/**
 * Фон живёт своей жизнью.
 *
 * Слои города сдвигаются вслед за курсором и наклоном телефона — каждый
 * со своей глубиной (data-depth), поэтому появляется параллакс. Движение
 * сглажено: реальная позиция догоняет целевую, а не прыгает за мышью.
 *
 * При включённом «уменьшении движения» модуль просто не запускается.
 */

const layers = [];
let target = { x: 0, y: 0 };
let current = { x: 0, y: 0 };
let running = false;

/** Плавное приближение к цели: чем меньше коэффициент, тем тяжелее слой. */
function tick() {
  current.x += (target.x - current.x) * 0.06;
  current.y += (target.y - current.y) * 0.06;

  for (const { node, depth } of layers) {
    node.style.transform =
      `translate3d(${(current.x * depth).toFixed(2)}px, ${(current.y * depth * 0.6).toFixed(2)}px, 0)`;
  }

  if (running) requestAnimationFrame(tick);
}

function onPointer(event) {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  target = { x: (event.clientX / w - 0.5) * 2, y: (event.clientY / h - 0.5) * 2 };
}

function onOrientation(event) {
  if (event.gamma === null || event.beta === null) return;
  target = {
    x: Math.max(-1, Math.min(1, event.gamma / 35)),
    y: Math.max(-1, Math.min(1, (event.beta - 45) / 45)),
  };
}

/** Запускает параллакс. Возвращает функцию остановки. */
export function initAtmosphere() {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return () => {};

  document.querySelectorAll('.atmosphere [data-depth]').forEach((node) => {
    layers.push({ node, depth: Number(node.dataset.depth) || 0 });
  });
  if (!layers.length) return () => {};

  running = true;
  requestAnimationFrame(tick);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('deviceorientation', onOrientation, { passive: true });

  // Пока вкладка скрыта, кадры не нужны.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; return; }
    running = true;
    requestAnimationFrame(tick);
  });

  return () => {
    running = false;
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('deviceorientation', onOrientation);
  };
}
