// Generative drone — pitch & timbre react to proximity to the event horizon.
export class Drone {
  constructor() { this.ctx = null; this.on = false; }

  start() {
    if (this.ctx) { this.ctx.resume(); this.on = true; this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.5); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = this.master = ctx.createGain();
    master.gain.value = 0;
    master.gain.setTargetAtTime(0.5, ctx.currentTime, 2);

    // convolution reverb from synthetic impulse
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 6;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    conv.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.8;
    const dry = ctx.createGain(); dry.gain.value = 0.35;
    master.connect(dry).connect(ctx.destination);
    master.connect(conv).connect(wet).connect(ctx.destination);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 600;
    this.filter.Q.value = 6;
    this.filter.connect(master);

    // detuned stack on a minor-ninth-ish chord
    this.oscs = [];
    const base = 43.65; // F1
    const ratios = [1, 1.5, 2, 2.378, 3, 4.49];
    ratios.forEach((r, i) => {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = i < 2 ? 'sawtooth' : 'triangle';
        o.frequency.value = base * r;
        o.detune.value = det + (Math.random() - 0.5) * 4;
        const g = ctx.createGain();
        g.gain.value = 0.05 / (1 + i * 0.6);
        // slow LFO on each voice for breathing
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.03 + Math.random() * 0.08;
        const lg = ctx.createGain(); lg.gain.value = g.gain.value * 0.8;
        lfo.connect(lg).connect(g.gain);
        lfo.start();
        o.connect(g).connect(this.filter);
        o.start();
        this.oscs.push({ o, r });
      }
    });

    // sub rumble (filtered noise)
    const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[i] = last * 3.5; }
    const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
    this.noiseGain = ctx.createGain(); this.noiseGain.gain.value = 0.25;
    noise.connect(this.noiseGain).connect(master);
    noise.start();

    this.base = base;
    this.on = true;
  }

  stop() {
    if (!this.ctx) return;
    this.on = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  // r = distance in Schwarzschild radii
  update(r) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    const dil = Math.sqrt(Math.max(1 - 1 / r, 0.0005));      // gravitational time dilation
    const prox = Math.min(1, 6 / r);
    this.filter.frequency.setTargetAtTime(250 + 2200 * prox * prox, t, 0.5);
    this.noiseGain.gain.setTargetAtTime(0.15 + 0.9 * prox * prox, t, 0.5);
    // everything slows and deepens as clocks slow down
    for (const { o, r: ratio } of this.oscs) o.frequency.setTargetAtTime(this.base * ratio * (0.55 + 0.45 * dil), t, 0.8);
  }
}
