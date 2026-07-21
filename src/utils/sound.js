/**
 * Звук.
 *
 * Задача — не «озвучить событие», а не мешать. Поэтому здесь нет резких
 * пилообразных сигналов: каждый звук собирается из синусоид, проходит
 * через мягкий фильтр и лёгкую реверберацию, а громкость по умолчанию
 * заметно ниже, чем кажется правильным на первый взгляд.
 *
 * Все звуки — из одного «набора»: одна тональность (ля минор),
 * одинаковые огибающие, одинаковый хвост. Оттого интерфейс звучит цельно.
 *
 * Если в assets/sounds лежит файл с таким же именем — играется он,
 * иначе звук синтезируется на месте. Игра звучит сразу после установки.
 */
import { store } from '../core/store.js';
import { bus } from '../core/eventBus.js';

/** Ноты одной гаммы: любые сочетания звучат согласованно. */
const NOTE = {
  A3: 220.00, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00,
  A4: 440.00, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.00,
};

/**
 * Банк звуков.
 *   notes  — что играем (частоты, вторая нота вступает с задержкой)
 *   gain   — базовая громкость (уже с запасом вниз)
 *   dur    — длительность хвоста
 *   cutoff — срез фильтра: чем ниже, тем мягче и глуше
 *   type   — форма волны: sine мягче, triangle чуть ярче
 */
const BANK = {
  /* --- касания интерфейса --- */
  hover:   { file: 'hover.mp3',   notes: [NOTE.E5], gain: 0.045, dur: 0.09, cutoff: 2600, type: 'sine' },
  click:   { file: 'click.mp3',   notes: [NOTE.A4, NOTE.E5], delay: 0.035, gain: 0.075, dur: 0.16, cutoff: 3000, type: 'sine' },
  confirm: { file: 'confirm.mp3', notes: [NOTE.C5, NOTE.G5], delay: 0.07, gain: 0.085, dur: 0.34, cutoff: 3400, type: 'triangle' },
  error:   { file: 'error.mp3',   notes: [NOTE.D4, NOTE.A3], delay: 0.08, gain: 0.085, dur: 0.30, cutoff: 1500, type: 'sine' },
  notify:  { file: 'notify.mp3',  notes: [NOTE.G4, NOTE.D5], delay: 0.06, gain: 0.070, dur: 0.28, cutoff: 3200, type: 'sine' },

  /* --- события комнаты --- */
  join:    { file: 'join.mp3',    notes: [NOTE.E4, NOTE.A4], delay: 0.06, gain: 0.075, dur: 0.30, cutoff: 3000, type: 'sine' },
  leave:   { file: 'leave.mp3',   notes: [NOTE.A4, NOTE.E4], delay: 0.06, gain: 0.070, dur: 0.30, cutoff: 2200, type: 'sine' },
  ready:   { file: 'ready.mp3',   notes: [NOTE.G4, NOTE.C5], delay: 0.05, gain: 0.070, dur: 0.24, cutoff: 3200, type: 'sine' },
  message: { file: 'message.mp3', notes: [NOTE.D5], gain: 0.050, dur: 0.14, cutoff: 3000, type: 'sine' },

  /* --- ход партии --- */
  start:   { file: 'start.mp3',   notes: [NOTE.A3, NOTE.E4, NOTE.A4], delay: 0.10, gain: 0.085, dur: 0.70, cutoff: 2600, type: 'triangle' },
  reveal:  { file: 'reveal.mp3',  notes: [NOTE.C4, NOTE.G4, NOTE.E5], delay: 0.12, gain: 0.080, dur: 0.90, cutoff: 3000, type: 'triangle' },
  night:   { file: 'night.mp3',   notes: [NOTE.A3, NOTE.E4], delay: 0.12, gain: 0.075, dur: 0.95, cutoff: 1300, type: 'sine' },
  day:     { file: 'day.mp3',     notes: [NOTE.C5, NOTE.G5], delay: 0.10, gain: 0.070, dur: 0.80, cutoff: 3600, type: 'triangle' },
  vote:    { file: 'vote.mp3',    notes: [NOTE.D4, NOTE.A4], delay: 0.05, gain: 0.070, dur: 0.26, cutoff: 2400, type: 'sine' },
  death:   { file: 'death.mp3',   notes: [NOTE.A3, NOTE.C4], delay: 0.14, gain: 0.080, dur: 1.10, cutoff: 900,  type: 'sine' },
  save:    { file: 'save.mp3',    notes: [NOTE.E4, NOTE.C5], delay: 0.08, gain: 0.075, dur: 0.50, cutoff: 3200, type: 'sine' },
  win:     { file: 'win.mp3',     notes: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5], delay: 0.11, gain: 0.085, dur: 1.10, cutoff: 3600, type: 'triangle' },
  lose:    { file: 'lose.mp3',    notes: [NOTE.A4, NOTE.G4, NOTE.E4, NOTE.A3], delay: 0.13, gain: 0.080, dur: 1.20, cutoff: 1400, type: 'sine' },
  tick:    { file: 'tick.mp3',    notes: [NOTE.A5], gain: 0.030, dur: 0.05, cutoff: 3000, type: 'sine' },
};

const MUSIC_FILE = 'assets/sounds/ambient.mp3';
const BASE_PATH = 'assets/sounds/';

/** Общий потолок громкости: ползунок в настройках работает уже внутри него. */
const MASTER = 0.55;

class SoundManager {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.missing = new Set();
    this.music = null;
    this.unlocked = false;
    this.bus = null;       // общая шина: фильтр + реверберация
    this.lastHover = 0;
  }

  /** Web Audio запускается только после первого действия пользователя. */
  init() {
    const unlock = () => {
      if (this.unlocked) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.#buildBus();
      this.unlocked = true;
      this.#applyMusicVolume();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    bus.on('prefs:change', () => this.#applyMusicVolume());
  }

  /**
   * Общая цепочка: мягкий срез верхов и короткий хвост.
   * Именно хвост превращает «пищание» в звук интерфейса.
   */
  #buildBus() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = MASTER;
    out.connect(ctx.destination);

    const dry = ctx.createGain();
    dry.gain.value = 0.85;
    dry.connect(out);

    const wet = ctx.createGain();
    wet.gain.value = 0.22;

    const reverb = ctx.createConvolver();
    reverb.buffer = this.#impulse(1.1, 2.6);
    wet.connect(reverb).connect(out);

    this.bus = { dry, wet, out };
  }

  /** Короткий синтетический импульс комнаты — вместо файла на 200 КБ. */
  #impulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
      }
    }
    return buffer;
  }

  /** Проигрывает звук по имени. Неизвестные имена молча игнорируются. */
  play(name) {
    const spec = BANK[name];
    if (!spec || !this.ctx || !this.bus) return;

    const { muted, sfx } = store.get().prefs;
    if (muted || sfx <= 0) return;

    // Наведение звучит часто — не даём ему слиться в шорох.
    if (name === 'hover') {
      const now = performance.now();
      if (now - this.lastHover < 90) return;
      this.lastHover = now;
    }

    if (this.buffers.has(name)) {
      this.#playBuffer(this.buffers.get(name), sfx * spec.gain * 8);
      return;
    }
    if (!this.missing.has(name)) this.#loadFile(name, spec.file);
    this.#synth(spec, sfx);
  }

  /** Фоновая музыка: файл необязателен. */
  startMusic() {
    if (this.music) return;
    const audio = new Audio(MUSIC_FILE);
    audio.loop = true;
    audio.volume = 0;
    audio.addEventListener('error', () => { this.music = null; });
    this.music = audio;
    this.#applyMusicVolume();
    audio.play().catch(() => { /* автозапуск ещё не разрешён */ });
  }

  stopMusic() {
    this.music?.pause();
    this.music = null;
  }

  #applyMusicVolume() {
    if (!this.music) return;
    const { muted, music } = store.get().prefs;
    this.music.volume = muted ? 0 : Math.min(1, Math.max(0, music)) * 0.6;
    if (muted) this.music.pause();
    else this.music.play().catch(() => {});
  }

  async #loadFile(name, file) {
    try {
      const response = await fetch(BASE_PATH + file);
      if (!response.ok) throw new Error('нет файла');
      this.buffers.set(name, await this.ctx.decodeAudioData(await response.arrayBuffer()));
    } catch {
      this.missing.add(name);
    }
  }

  #playBuffer(buffer, volume) {
    const gain = this.ctx.createGain();
    gain.gain.value = Math.min(1, volume);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.bus.dry);
    gain.connect(this.bus.wet);
    source.start();
  }

  /**
   * Синтез: несколько нот с мягкой атакой и экспоненциальным затуханием.
   * Атака в 18 мс — то, что отличает приятный щелчок от неприятного.
   */
  #synth(spec, volume) {
    const ctx = this.ctx;
    const start = ctx.currentTime + 0.005;
    const notes = spec.notes || [440];
    const delay = spec.delay || 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = spec.cutoff || 2600;
    filter.Q.value = 0.7;
    filter.connect(this.bus.dry);
    filter.connect(this.bus.wet);

    notes.forEach((freq, index) => {
      const at = start + index * delay;
      const dur = spec.dur * (index === notes.length - 1 ? 1 : 0.8);

      const osc = ctx.createOscillator();
      osc.type = spec.type || 'sine';
      osc.frequency.setValueAtTime(freq, at);

      // Лёгкий обертон делает звук объёмнее, но остаётся почти неслышным.
      const shine = ctx.createOscillator();
      shine.type = 'sine';
      shine.frequency.setValueAtTime(freq * 2, at);
      const shineGain = ctx.createGain();
      shineGain.gain.value = 0.12;

      const amp = ctx.createGain();
      const peak = Math.max(0.0002, spec.gain * volume);
      amp.gain.setValueAtTime(0.0001, at);
      amp.gain.exponentialRampToValueAtTime(peak, at + 0.018);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);

      osc.connect(amp);
      shine.connect(shineGain).connect(amp);
      amp.connect(filter);

      osc.start(at); osc.stop(at + dur + 0.05);
      shine.start(at); shine.stop(at + dur + 0.05);
    });
  }
}

export const sound = new SoundManager();

/**
 * Озвучивание интерфейса: наведение, нажатие и разные оттенки нажатия
 * для подтверждающих и опасных кнопок.
 */
const INTERACTIVE = '.btn, .back, .stepper__btn, .switch__track, .player--selectable, .room-code, .statusbar__item, .role-card';

export function bindClickSound(root = document) {
  root.addEventListener('pointerover', (event) => {
    const node = event.target.closest?.(INTERACTIVE);
    if (node && !node.disabled) sound.play('hover');
  }, { passive: true });

  root.addEventListener('click', (event) => {
    const node = event.target.closest?.(INTERACTIVE);
    if (!node || node.disabled) return;
    if (node.classList.contains('btn--primary') || node.classList.contains('btn--mint')) sound.play('confirm');
    else if (node.classList.contains('btn--danger')) sound.play('vote');
    else sound.play('click');
  });
}
