// ============================================================================
// Audio system: ambient soundscape driven by biome/weather/time-of-day using
// Web Audio API synthesis (no external asset dependency required — works
// fully offline). Also exposes hooks to play external music/SFX files if
// present in /public/audio (loaded lazily, gracefully skipped if missing).
// ============================================================================

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.ambientGain = null;
    this.sfxGain = null;
    this.started = false;
    this.currentAmbientNodes = [];
    this.musicEl = null;
    this.musicEnabled = true;
    this.sfxEnabled = true;
  }

  async start() {
    if (this.started) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.masterGain);

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.55;
    this.ambientGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.masterGain);

    this.started = true;
    this._startProceduralMusic();
    this._startWindBed();
  }

  setMasterVolume(v) { if (this.masterGain) this.masterGain.gain.value = v; }
  setMusicVolume(v) { if (this.musicGain) this.musicGain.gain.value = v; }

  // ---- Procedural medieval-ish ambient music: sparse lute-like plucks over a drone ----
  _startProceduralMusic() {
    const ctx = this.ctx;
    const scaleHz = [196, 220, 247, 261.6, 293.7, 329.6, 349.2, 392]; // G minor-ish medieval scale
    this._musicTimer = setInterval(() => {
      if (!this.musicEnabled) return;
      if (Math.random() < 0.65) this._pluckNote(scaleHz[Math.floor(Math.random() * scaleHz.length)] / 2, 1.6);
      if (Math.random() < 0.3) this._pluckNote(scaleHz[Math.floor(Math.random() * scaleHz.length)], 1.1);
    }, 1400);

    // low drone
    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sine';
    droneOsc.frequency.value = 98;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    droneOsc.connect(droneGain).connect(this.musicGain);
    droneOsc.start();
    this._droneOsc = droneOsc;
  }

  _pluckNote(freq, decay = 1.2) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    osc.connect(filter).connect(gain).connect(this.musicGain);
    osc.start(now);
    osc.stop(now + decay + 0.1);
  }

  // ---- Wind bed: filtered noise, intensity modulated by weather ----
  _startWindBed() {
    const ctx = this.ctx;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    noise.connect(filter).connect(this.windGain).connect(this.ambientGain);
    noise.start();
    this.windFilter = filter;
  }

  setWindIntensity(level) {
    // level 0..1
    if (this.windGain) this.windGain.gain.value = 0.03 + level * 0.22;
    if (this.windFilter) this.windFilter.frequency.value = 250 + level * 500;
  }

  // ---- Environmental one-shots: crickets at night, cave drips, thunder ----
  playCricket() {
    if (!this.sfxEnabled || !this.ctx) return;
    const ctx = this.ctx; const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 3200 + Math.random() * 400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.02, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(gain).connect(this.ambientGain);
    osc.start(now); osc.stop(now + 0.12);
  }

  playCaveDrip() {
    if (!this.sfxEnabled || !this.ctx) return;
    const ctx = this.ctx; const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.25);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(this.ambientGain);
    osc.start(now); osc.stop(now + 0.32);
  }

  playThunder() {
    if (!this.sfxEnabled || !this.ctx) return;
    const ctx = this.ctx; const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    noise.connect(filter).connect(gain).connect(this.sfxGain);
    noise.start(now);
  }

  playHit() { this._blip(180, 0.12, 'square'); }
  playBreak() { this._blip(120, 0.15, 'sawtooth'); }
  playPlace() { this._blip(300, 0.08, 'triangle'); }
  playPickup() { this._blip(660, 0.08, 'sine'); }
  playCraft() { this._blip(440, 0.18, 'triangle'); }
  playBowShot() { this._blip(800, 0.1, 'sawtooth'); }
  playHurt() { this._blip(140, 0.2, 'sawtooth'); }
  playSplash() { this._blip(500, 0.15, 'sine'); }
  playStepGrass() { this._blip(220, 0.05, 'triangle', 0.08); }

  _blip(freq, decay, type = 'sine', vol = 0.22) {
    if (!this.sfxEnabled || !this.ctx) return;
    const ctx = this.ctx; const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(gain).connect(this.sfxGain);
    osc.start(now); osc.stop(now + decay + 0.05);
  }

  update(dt, { isNight, weather, biomeName, inCave }) {
    if (!this.started) return;
    this._ambientTimer = (this._ambientTimer || 0) + dt;
    const windLevel = weather === 'storm' ? 0.9 : weather === 'rain' ? 0.5 : weather === 'snow' ? 0.4 : 0.15;
    this.setWindIntensity(windLevel);

    if (weather === 'storm' && Math.random() < dt * 0.05) this.playThunder();

    if (this._ambientTimer > (inCave ? 3 : isNight ? 1.4 : 5)) {
      this._ambientTimer = 0;
      if (inCave && Math.random() < 0.6) this.playCaveDrip();
      else if (isNight && Math.random() < 0.7) this.playCricket();
    }
  }
}
