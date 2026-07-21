/**
 * Тема оформления и индикация фазы.
 * Тема — атрибут data-theme на <html>, фаза — data-phase на <body>,
 * дальше всё решает CSS.
 */
import { store } from '../core/store.js';

export const THEMES = ['midnight', 'daylight'];

export function applyTheme(name) {
  const theme = THEMES.includes(name) ? name : 'midnight';
  document.documentElement.dataset.theme = theme;
  store.patchPrefs({ theme });
  // Обе темы тёмные: вторая просто теплее и дымнее.
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'midnight' ? '#0b0f1e' : '#121020');
}

/** Красит фон и полосу под текущую фазу: lobby | night | day | vote | ended. */
export function applyPhase(phase) {
  document.body.dataset.phase = phase || 'lobby';
}

/** Прогресс таймера фазы: 0 — только началась, 1 — истекла. */
export function setPhaseProgress(ratio) {
  const done = Math.min(100, Math.max(0, ratio * 100));
  document.getElementById('phase-bar')?.style.setProperty('--progress', `${done}%`);
}
