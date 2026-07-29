// ============ ELDERMERE — Audio procedural: orquesta medieval + ambiente ============
// Todo el audio se genera con WebAudio: laúd (karplus-strong), flauta, bordones,
// grillos nocturnos, viento, gotas de cueva, efectos de juego.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = 0;
    this.ambientTimer = 0;
    this.step = 0;
    // Progresiones modales medievales (dorico / eólico) en Hz
    this.scales = {
      day:   [146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63, 293.66],  // D dorico
      night: [110.00, 123.47, 130.81, 146.83, 164.81, 174.61, 196.00, 220.00],  // A eólico
    };
    this.chords = {
      day:   [[146.83, 220.00, 293.66], [130.81, 196.00, 261.63], [164.81, 246.94, 329.63], [146.83, 220.00, 293.66]],
      night: [[110.00, 164.81, 220.00], [98.00, 146.83, 196.00], [110.00, 164.81, 220.00], [123.47, 185.00, 246.94]],
    };
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    // Reverb sencilla por delay feedback
    this.reverb = this.ctx.createDelay(1.0);
    this.reverb.delayTime.value = 0.24;
    this.reverbGain = this.ctx.createGain(); this.reverbGain.gain.value = 0.28;
    this.reverbFilter = this.ctx.createBiquadFilter();
    this.reverbFilter.type = 'lowpass'; this.reverbFilter.frequency.value = 1600;
    this.reverb.connect(this.reverbGain).connect(this.reverbFilter).connect(this.reverb);
    this.master.connect(this.ctx.destination);
    this.reverbFilter.connect(this.master);
    // viento continuo
    this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0.0;
    const wind = this.noiseSource();
    const windF = this.ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 420; windF.Q.value = 0.6;
    wind.connect(windF).connect(this.windGain).connect(this.master);
    wind.start();
    this.windFilter = windF;
    // LFO del viento
    this.windLfoPhase = 0;
  }

  noiseSource() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    return src;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  // ---------- Laúd: Karplus-Strong ----------
  pluck(freq, vol = 0.16, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const sr = this.ctx.sampleRate;
    const N = Math.round(sr / freq);
    const len = sr * 1.6;
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (let i = N; i < len; i++) d[i] = (d[i - N] + d[i - N + 1 >= len ? i - N : i - N + 1]) * 0.4985;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    src.connect(f).connect(g).connect(this.master);
    g.connect(this.reverb);
    src.start(t);
  }

  // ---------- Flauta ----------
  flute(freq, dur = 1.2, vol = 0.08, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
    const vib = this.ctx.createOscillator(); vib.frequency.value = 4.5;
    const vibG = this.ctx.createGain(); vibG.gain.value = freq * 0.008;
    vib.connect(vibG).connect(osc.frequency);
    const breath = this.noiseSource();
    const bg = this.ctx.createGain(); bg.gain.value = vol * 0.14;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.14);
    g.gain.setValueAtTime(vol, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); breath.connect(bg).connect(g);
    g.connect(this.master); g.connect(this.reverb);
    osc.start(t); osc.stop(t + dur + 0.1);
    vib.start(t); vib.stop(t + dur + 0.1);
    breath.start(t); breath.stop(t + dur + 0.1);
  }

  // ---------- Bordón (drone grave) ----------
  drone(freq, dur = 4, vol = 0.05, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o1 = this.ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = freq;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 0.5;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); g.connect(this.reverb);
    o1.start(t); o1.stop(t + dur + 0.1); o2.start(t); o2.stop(t + dur + 0.1);
  }

  // ---------- Música: actualización por frame ----------
  updateMusic(dt, isNight, underground) {
    if (!this.ctx || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const mode = isNight ? 'night' : 'day';
    const chordList = this.chords[mode];
    const chord = chordList[this.step % chordList.length];
    this.step++;
    // patrón: bordón + arpegio de laúd + flauta ocasional
    this.drone(chord[0] * 0.5, 5.5, isNight ? 0.04 : 0.05);
    const arp = [0, 1, 2, 1, 0, 2, 1, 2];
    arp.forEach((n, i) => this.pluck(chord[n] * 2, 0.11, i * 0.42));
    if (this.step % 2 === 0) {
      const scale = this.scales[mode];
      const n1 = scale[(Math.random() * scale.length) | 0];
      this.flute(n1 * 2, 1.6, underground ? 0.05 : 0.07, 0.4 + Math.random() * 1.5);
    }
    this.musicTimer = underground ? 7.5 : 6.4;   // bajo tierra, música más escasa e inquietante
  }

  // ---------- Ambiente ----------
  updateAmbient(dt, env) {
    if (!this.ctx || this.muted) return;
    const { isNight, biome, underground, weather } = env;
    // viento: más fuerte en montañas, tormentas y tundra
    let windTarget = 0.02;
    if (biome === 'MOUNTAIN') windTarget = 0.075;
    else if (biome === 'TUNDRA' || biome === 'DESERT') windTarget = 0.05;
    if (weather === 'storm') windTarget = 0.11;
    else if (weather === 'rain' || weather === 'snow') windTarget = 0.06;
    if (underground) windTarget = 0.006;
    this.windGain.gain.value += (windTarget - this.windGain.gain.value) * Math.min(1, dt * 1.5);
    this.windLfoPhase += dt * 0.7;
    this.windFilter.frequency.value = 380 + Math.sin(this.windLfoPhase) * 160;

    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 0.7 + Math.random() * 1.6;

    if (underground) {
      if (Math.random() < 0.55) this.drip();
    } else if (isNight) {
      if (Math.random() < 0.8) this.cricket();
      if (Math.random() < 0.08) this.owl();
    } else {
      if (Math.random() < 0.3) this.bird();
    }
    if (weather === 'storm' && Math.random() < 0.12) this.thunder();
  }

  cricket() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3 + (Math.random() * 4 | 0); i++) {
      const osc = this.ctx.createOscillator(); osc.type = 'sine';
      osc.frequency.value = 4200 + Math.random() * 800;
      const g = this.ctx.createGain();
      const tt = t + i * 0.07;
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.linearRampToValueAtTime(0.016, tt + 0.012);
      g.gain.linearRampToValueAtTime(0.0001, tt + 0.05);
      osc.connect(g).connect(this.master);
      osc.start(tt); osc.stop(tt + 0.07);
    }
  }
  owl() {
    if (!this.ctx || this.muted) return;
    this.flute(330 + Math.random() * 40, 0.35, 0.03, 0);
    this.flute(300 + Math.random() * 40, 0.5, 0.03, 0.45);
  }
  bird() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) {
      const osc = this.ctx.createOscillator(); osc.type = 'sine';
      const f0 = 2200 + Math.random() * 1400;
      const tt = t + i * 0.12;
      osc.frequency.setValueAtTime(f0, tt);
      osc.frequency.exponentialRampToValueAtTime(f0 * (0.8 + Math.random() * 0.5), tt + 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.linearRampToValueAtTime(0.02, tt + 0.02);
      g.gain.linearRampToValueAtTime(0.0001, tt + 0.1);
      osc.connect(g).connect(this.master);
      osc.start(tt); osc.stop(tt + 0.12);
    }
  }
  drip() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(); osc.type = 'sine';
    const f = 900 + Math.random() * 700;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g); g.connect(this.master); g.connect(this.reverb);
    osc.start(t); osc.stop(t + 0.2);
  }
  thunder() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const n = this.noiseSource();
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 1.8);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    n.connect(f).connect(g).connect(this.master); g.connect(this.reverb);
    n.start(t); n.stop(t + 2.4);
  }

  // ---------- SFX de juego ----------
  sfx(name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const G = (v) => { const g = this.ctx.createGain(); g.gain.value = v; g.connect(this.master); return g; };
    switch (name) {
      case 'mine': {   // golpe de pico
        const n = this.noiseSource(); const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 1.2;
        const g = G(0); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        n.connect(f).connect(g); n.start(t); n.stop(t + 0.12);
        break; }
      case 'place': {
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 180 + Math.random() * 60;
        const g = G(0); g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g); o.start(t); o.stop(t + 0.12);
        break; }
      case 'craft': {
        [520, 660, 780].forEach((fr, i) => this.pluck(fr, 0.14, i * 0.09));
        break; }
      case 'hurt': {
        const o = this.ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.18);
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
        const g = G(0); g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(f).connect(g); o.start(t); o.stop(t + 0.25);
        break; }
      case 'enemyHit': {
        const n = this.noiseSource(); const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 300;
        const g = G(0); g.gain.setValueAtTime(0.26, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        n.connect(f).connect(g); n.start(t); n.stop(t + 0.2);
        break; }
      case 'bow': {
        const o = this.ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(300, t + 0.08);
        const g = G(0); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g); o.start(t); o.stop(t + 0.12);
        break; }
      case 'eat': {
        for (let i = 0; i < 3; i++) {
          const n = this.noiseSource(); const f = this.ctx.createBiquadFilter();
          f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 300;
          const g = G(0); const tt = t + i * 0.14;
          g.gain.setValueAtTime(0.14, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.08);
          n.connect(f).connect(g); n.start(tt); n.stop(tt + 0.1);
        }
        break; }
      case 'jump': {
        const o = this.ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.1);
        const g = G(0); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o.connect(g); o.start(t); o.stop(t + 0.14);
        break; }
      case 'splash': {
        const n = this.noiseSource(); const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
        const g = G(0); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        n.connect(f).connect(g); n.start(t); n.stop(t + 0.35);
        break; }
      case 'quest': {
        [392, 523, 659, 784].forEach((fr, i) => this.pluck(fr, 0.16, i * 0.13));
        this.flute(1046, 1.2, 0.06, 0.55);
        break; }
      case 'rep': { this.pluck(660, 0.12, 0); this.pluck(880, 0.12, 0.1); break; }
      case 'levelup': {
        [523, 659, 784, 1046].forEach((fr, i) => this.pluck(fr, 0.15, i * 0.1));
        break; }
      case 'bossRoar': {
        const o = this.ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(80, t); o.frequency.linearRampToValueAtTime(50, t + 1.2);
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
        const g = G(0); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        o.connect(f).connect(g); g.connect(this.reverb); o.start(t); o.stop(t + 1.5);
        break; }
      case 'tame': {
        [523, 659, 784].forEach((fr, i) => this.flute(fr, 0.3, 0.05, i * 0.15));
        break; }
      case 'chest': {
        const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = 140;
        const g = G(0); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
        o.connect(f).connect(g); o.start(t); o.stop(t + 0.2);
        this.pluck(784, 0.1, 0.18);
        break; }
    }
  }
}
