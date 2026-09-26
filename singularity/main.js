import { createGL, program, target } from './gl.js';
import { BLACKHOLE_FRAG, PREFILTER_FRAG, DOWN_FRAG, UP_FRAG, COMPOSITE_FRAG } from './shaders.js';
import { Drone } from './audio.js';

// ════════════════════════════════════════════════════════════════════════════
//  Setup
// ════════════════════════════════════════════════════════════════════════════
const canvas = document.getElementById('c');
const $ = (s) => document.querySelector(s);
let gl, floatOK;
try { ({ gl, floatOK } = createGL(canvas)); }
catch (e) { $('#fatal').hidden = false; $('#fatal p').textContent = e.message; throw e; }

const P = {
  bh: program(gl, BLACKHOLE_FRAG),
  pre: program(gl, PREFILTER_FRAG),
  down: program(gl, DOWN_FRAG),
  up: program(gl, UP_FRAG),
  comp: program(gl, COMPOSITE_FRAG),
};

// ════════════════════════════════════════════════════════════════════════════
//  Parameters
// ════════════════════════════════════════════════════════════════════════════
const params = {
  lensing: 1, doppler: 1, temp: 6500, diskGain: 0.55, thick: 0.5,
  bloom: 0.7, exposure: 0.85, timeScale: 1, stars: 1, quality: 'auto',
};

const MASSES = {
  stellar: { name: 'Estelar · 10 M☉', solar: 10 },
  sgra:    { name: 'Sagitario A* · 4.3 M M☉', solar: 4.3e6 },
  m87:     { name: 'M87* · 6.5 G M☉', solar: 6.5e9 },
  ton618:  { name: 'TON 618 · 66 G M☉', solar: 6.6e10 },
};
let massKey = 'sgra';

const QUALITY = { low: { steps: 160, scale: 0.5 }, med: { steps: 260, scale: 0.7 }, high: { steps: 380, scale: 1 }, ultra: { steps: 560, scale: 1 } };

// ════════════════════════════════════════════════════════════════════════════
//  Camera (orbit + cinematic + dive)
// ════════════════════════════════════════════════════════════════════════════
const cam = { yaw: 0.6, pitch: 0.085, dist: 22, roll: 0, fov: 1.0, look: 0 };
const goal = { ...cam };
let mode = 'intro';           // intro | orbit | tour | dive
let tourT = 0, diveT = 0, idleT = 0;

const TOUR = [
  { yaw: 0.0, pitch: 0.06, dist: 30, roll: 0.00, fov: 0.9, d: 9 },
  { yaw: 1.3, pitch: 0.02, dist: 14, roll: -0.08, fov: 1.0, d: 10 },
  { yaw: 2.6, pitch: 0.55, dist: 18, roll: 0.05, fov: 1.0, d: 10 },
  { yaw: 3.6, pitch: 1.35, dist: 24, roll: 0.00, fov: 0.9, d: 10 },
  { yaw: 4.8, pitch: -0.25, dist: 9, roll: 0.12, fov: 1.2, d: 10 },
  { yaw: 6.0, pitch: 0.012, dist: 6.5, roll: -0.04, fov: 1.35, d: 11 },
  { yaw: 6.9, pitch: 0.18, dist: 40, roll: 0.00, fov: 0.7, d: 10 },
];
const TOUR_LEN = TOUR.reduce((s, k) => s + k.d, 0);

function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + (b - a) * t; }

function tourSample(t) {
  t = t % TOUR_LEN;
  let i = 0;
  while (t > TOUR[i].d) { t -= TOUR[i].d; i++; }
  const a = TOUR[i], b = TOUR[(i + 1) % TOUR.length];
  const k = smoother(t / a.d);
  let by = b.yaw; if (i === TOUR.length - 1) by += Math.PI * 2 * Math.round((a.yaw - b.yaw) / (Math.PI * 2));
  return { yaw: lerp(a.yaw, by, k), pitch: lerp(a.pitch, b.pitch, k), dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), k)), roll: lerp(a.roll, b.roll, k), fov: lerp(a.fov, b.fov, k) };
}

function camBasis() {
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const pos = [cam.dist * cp * sy, cam.dist * sp, cam.dist * cp * cy];
  let back = norm(pos);
  let right = norm(cross([0, 1, 0], back));
  let up = cross(back, right);
  if (cam.look) { // turn head sideways (around local up) to keep the shadow edge in frame
    const cl = Math.cos(cam.look), sl = Math.sin(cam.look);
    const b2 = add(scale(back, cl), scale(right, -sl));
    right = add(scale(right, cl), scale(back, sl));
    back = b2;
  }
  const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
  const r2 = add(scale(right, cr), scale(up, sr));
  const u2 = add(scale(up, cr), scale(right, -sr));
  return { pos, rot: new Float32Array([...r2, ...u2, ...back]) };
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const add = (a, b) => a.map((x, i) => x + b[i]);
const scale = (a, s) => a.map((x) => x * s);

// ── input ──
const pointers = new Map();
let pinchD = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (mode === 'tour' || mode === 'intro') setMode('orbit');
  idleT = 0;
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  idleT = 0;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 1 && mode === 'orbit') {
    goal.yaw -= dx * 0.005;
    goal.pitch = clamp(goal.pitch + dy * 0.004, -1.5, 1.5);
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchD) goal.dist = clamp(goal.dist * (pinchD / Math.max(d, 1)), 2.6, 80);
    pinchD = d;
  }
});
const endPtr = (e) => { pointers.delete(e.pointerId); pinchD = 0; };
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (mode === 'tour' || mode === 'intro') setMode('orbit');
  goal.dist = clamp(goal.dist * Math.exp(e.deltaY * 0.0012), 2.6, 80);
  idleT = 0;
}, { passive: false });

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// ════════════════════════════════════════════════════════════════════════════
//  Render targets
// ════════════════════════════════════════════════════════════════════════════
let W = 0, H = 0, renderScale = 0.75, sceneRT, bloomChain = [];
let qualityLevel = 'high';

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.floor(innerWidth * dpr), ch = Math.floor(innerHeight * dpr);
  canvas.width = cw; canvas.height = ch;
  const q = QUALITY[qualityLevel];
  const s = renderScale * q.scale;
  const w = Math.max(64, Math.floor(cw * s)), h = Math.max(64, Math.floor(ch * s));
  if (sceneRT && sceneRT.w === w && sceneRT.h === h) return;
  sceneRT?.dispose(); bloomChain.forEach((r) => r.dispose()); bloomChain = [];
  sceneRT = target(gl, w, h, floatOK);
  let bw = w >> 1, bh = h >> 1;
  for (let i = 0; i < 6 && bw > 4 && bh > 4; i++) { bloomChain.push(target(gl, bw, bh, floatOK)); bw >>= 1; bh >>= 1; }
  W = w; H = h;
}
addEventListener('resize', resize);

function pass(rt, prog) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, rt ? rt.fbo : null);
  gl.viewport(0, 0, rt ? rt.w : canvas.width, rt ? rt.h : canvas.height);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

// ════════════════════════════════════════════════════════════════════════════
//  Loop
// ════════════════════════════════════════════════════════════════════════════
let simTime = 0, clock = 0, last = performance.now(), paused = false, fade = 0, fadeGoal = 1;
let frameMs = 16, perfT = 0, wantShot = false;
const drone = new Drone();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  clock += dt;
  frameMs = lerp(frameMs, dt * 1000, 0.05);

  updateCamera(dt);
  const r = cam.dist;
  const dil = Math.sqrt(Math.max(1 - 1 / r, 1e-6));
  if (!paused) simTime += dt * params.timeScale * (mode === 'dive' ? dil : 1);
  fade = lerp(fade, fadeGoal, 1 - Math.exp(-dt * (fadeGoal < fade ? 3 : 0.9)));

  adaptQuality(dt);
  resize();
  const { pos, rot } = camBasis();
  const q = QUALITY[qualityLevel];

  gl.disable(gl.BLEND);
  P.bh.use()
    .set('uRes', [W, H]).set('uTime', simTime).set('uClock', clock)
    .set('uCamPos', pos).set('uCamRot', rot).set('uFov', cam.fov * Math.max(1, 0.62 * H / W))
    .set('uSteps', q.steps).set('uLensing', params.lensing).set('uDoppler', params.doppler)
    .set('uDiskTemp', params.temp).set('uDiskGain', params.diskGain)
    .set('uDiskInner', 3.0).set('uDiskOuter', 14.0).set('uDiskThick', params.thick)
    .set('uFar', Math.max(40, r * 1.6)).set('uStarGain', params.stars).set('uTint', [1, 1, 1]);
  pass(sceneRT, P.bh);

  // bloom
  P.pre.use().set('uTex', sceneRT.tex).set('uTexel', [1 / W, 1 / H]).set('uThreshold', 1.0);
  pass(bloomChain[0], P.pre);
  for (let i = 1; i < bloomChain.length; i++) {
    const s = bloomChain[i - 1];
    P.down.use().set('uTex', s.tex).set('uTexel', [1 / s.w, 1 / s.h]);
    pass(bloomChain[i], P.down);
  }
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = bloomChain.length - 1; i > 0; i--) {
    const s = bloomChain[i];
    P.up.use().set('uTex', s.tex).set('uTexel', [1 / s.w, 1 / s.h]).set('uRadius', 1.0);
    pass(bloomChain[i - 1], P.up);
  }
  gl.disable(gl.BLEND);

  P.comp.use().set('uScene', sceneRT.tex).set('uBloom', bloomChain[0].tex).set('uStreak', bloomChain[Math.min(2, bloomChain.length - 1)].tex)
    .set('uBloomStrength', params.bloom * 0.35).set('uExposure', params.exposure)
    .set('uTime', clock).set('uAberration', 0.012 + (mode === 'dive' ? 0.25 * Math.min(1, 3 / r) : 0))
    .set('uFade', fade).set('uRes', [canvas.width, canvas.height]);
  pass(null, P.comp);

  if (wantShot) { wantShot = false; saveShot(); }

  drone.update(r);
  updateHUD(r, dil, dt);
  requestAnimationFrame(frame);
}

function updateCamera(dt) {
  idleT += dt;
  if (mode === 'orbit' && idleT > 45) setMode('tour');

  if (mode === 'intro' || mode === 'tour') {
    tourT += dt * (mode === 'intro' ? 0.6 : 1);
    Object.assign(goal, tourSample(tourT));
    if (mode === 'intro') goal.yaw += clock * 0.02;
  } else if (mode === 'orbit') {
    goal.yaw += dt * 0.015;
    goal.roll = 0;
  } else if (mode === 'dive') {
    diveT += dt;
    // spiral plunge: speed up as we approach the horizon
    const rNow = goal.dist;
    goal.dist = Math.max(1.0, rNow - dt * (0.35 + 1.8 / Math.max(rNow - 0.9, 0.2)) * 0.9);
    goal.yaw += dt * (0.12 + 0.9 / rNow);
    goal.pitch = lerp(goal.pitch, 0.04, dt * 0.4);
    goal.roll = Math.sin(diveT * 0.4) * 0.15;
    goal.fov = lerp(goal.fov, 1.5, dt * 0.2);
    // angular radius of the shadow as seen by a static observer at r
    const rr = Math.max(cam.dist, 1.001);
    const sinA = Math.min(1, (1.5 * Math.sqrt(3) / rr) * Math.sqrt(1 - 1 / rr));
    const alpha = rr < 1.5 ? Math.PI - Math.asin(sinA) : Math.asin(sinA);
    goal.look = Math.min(alpha * 0.92, 2.6);
    if (goal.dist < 1.12 && fadeGoal === 1) {
      fadeGoal = 0;
      setTimeout(() => showCaption('Has cruzado el horizonte de sucesos.', 'Ninguna señal, ni siquiera la luz, puede volver a salir. Para el universo exterior, tu imagen quedó congelada para siempre en el borde.'), 700);
      setTimeout(() => { cam.look = goal.look = 0; cam.dist = goal.dist = 26; cam.fov = goal.fov = 1; goal.pitch = cam.pitch = 0.1; setMode('orbit'); fadeGoal = 1; }, 6500);
    }
  }
  const k = 1 - Math.exp(-dt * (mode === 'dive' ? 6 : mode === 'orbit' ? 5 : 3));
  cam.yaw = lerp(cam.yaw, goal.yaw, k);
  cam.pitch = lerp(cam.pitch, goal.pitch, k);
  cam.dist = lerp(cam.dist, goal.dist, k);
  cam.roll = lerp(cam.roll, goal.roll, k);
  cam.fov = lerp(cam.fov, goal.fov, k);
  if (mode !== 'dive' && !camQ) goal.look = 0;
  cam.look = lerp(cam.look, goal.look || 0, k * 0.6);
}

function adaptQuality(dt) {
  if (params.quality !== 'auto') { qualityLevel = params.quality; renderScale = 1; return; }
  perfT += dt;
  if (perfT < 0.5) return;
  perfT = 0;
  if (frameMs > 30) renderScale = Math.max(0.35, renderScale - 0.08);
  else if (frameMs < 18) renderScale = Math.min(1.0, renderScale + 0.04);
  qualityLevel = renderScale < 0.5 ? 'med' : 'high';
}

function setMode(m) {
  mode = m;
  document.body.dataset.mode = m;
  if (m === 'tour') { tourT = 0; }
  if (m === 'orbit') { goal.roll = 0; goal.fov = clamp(goal.fov, 0.8, 1.2); }
  if (m === 'dive') { diveT = 0; goal.dist = cam.dist; }
  document.querySelectorAll('[data-mode-btn]').forEach((b) => b.classList.toggle('on', b.dataset.modeBtn === m));
}

// ════════════════════════════════════════════════════════════════════════════
//  HUD
// ════════════════════════════════════════════════════════════════════════════
const hud = { r: $('#h-r'), km: $('#h-km'), dil: $('#h-dil'), v: $('#h-v'), tidal: $('#h-tidal'), zone: $('#h-zone'), fps: $('#h-fps'), bar: $('#h-bar'), clockOut: $('#h-clock-out'), clockIn: $('#h-clock-in') };
let properTime = 0, farTime = 0, hudT = 0;

function fmtDist(m) {
  const AU = 1.496e11, LY = 9.461e15;
  if (m > 0.05 * LY) return (m / LY).toFixed(2) + ' al';
  if (m > 0.2 * AU) return (m / AU).toFixed(2) + ' UA';
  if (m > 1e6) return (m / 1e3).toExponential(2).replace('e+', '·10^') + ' km';
  return (m / 1e3).toFixed(1) + ' km';
}
function fmtSci(x) {
  if (!isFinite(x)) return '∞';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e < 5) return x.toFixed(e < 0 ? 3 : e < 2 ? 2 : 0);
  return (x / 10 ** e).toFixed(2) + '×10' + sup(e);
}
const sup = (n) => String(n).split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? (c === '-' ? '⁻' : c)).join('');
function fmtTime(s) {
  const y = 3.156e7;
  if (s > y) return (s / y).toFixed(2) + ' años';
  if (s > 86400) return (s / 86400).toFixed(2) + ' días';
  if (s > 3600) return (s / 3600).toFixed(2) + ' h';
  if (s > 60) return (s / 60).toFixed(1) + ' min';
  return s.toFixed(1) + ' s';
}

function updateHUD(r, dil, dt) {
  const M = MASSES[massKey].solar;
  const Rs = 2953 * M; // metres
  const c = 299792458;
  // proper time of the observer vs far-away clock. One Rs/c of "physical time" per sim second scaled for drama
  const unit = Rs / c * 40;
  properTime += dt * unit * dil;
  farTime += dt * unit;
  hudT += dt;
  if (hudT < 0.08) return;
  hudT = 0;

  const vOrb = r > 1.5 ? Math.sqrt(0.5 / (r - 1)) : NaN;             // local circular-orbit speed / c
  const tidal = (c * c * 2) / (r ** 3 * Rs * Rs) * 1;                 // Δa over 2 m body (m/s²)
  hud.r.textContent = r.toFixed(2) + ' Rₛ';
  hud.km.textContent = fmtDist(r * Rs);
  hud.dil.textContent = (1 / dil).toFixed(r < 1.3 ? 3 : 4) + '×';
  hud.v.textContent = isNaN(vOrb) || vOrb >= 1 ? 'sin órbita estable' : (vOrb * 100).toFixed(1) + '% c';
  hud.tidal.textContent = fmtSci(tidal / 9.81) + ' g';
  hud.clockOut.textContent = fmtTime(farTime);
  hud.clockIn.textContent = fmtTime(properTime);
  let zone = 'Espacio lejano';
  if (r < 1.02) zone = 'Horizonte de sucesos';
  else if (r < 1.5) zone = 'Dentro de la esfera de fotones';
  else if (r < 1.6) zone = 'Esfera de fotones — la luz orbita';
  else if (r < 3) zone = 'Bajo la ISCO — caída inevitable';
  else if (r < 14) zone = 'Disco de acreción';
  hud.zone.textContent = zone;
  hud.zone.dataset.danger = r < 3 ? '1' : '0';
  hud.bar.style.setProperty('--p', clamp(Math.log(r) / Math.log(80), 0, 1));
  hud.fps.textContent = `${Math.round(1000 / frameMs)} fps · ${W}×${H} · ${QUALITY[qualityLevel].steps} pasos`;
}

// ════════════════════════════════════════════════════════════════════════════
//  UI wiring
// ════════════════════════════════════════════════════════════════════════════
function bindSlider(id, key, fmt = (v) => v) {
  const el = $('#' + id);
  const out = el.parentElement.querySelector('output');
  const upd = () => { params[key] = parseFloat(el.value); if (out) out.textContent = fmt(params[key]); };
  el.addEventListener('input', upd);
  el.value = params[key]; upd();
}
bindSlider('s-lensing', 'lensing', (v) => Math.round(v * 100) + '%');
bindSlider('s-doppler', 'doppler', (v) => Math.round(v * 100) + '%');
bindSlider('s-temp', 'temp', (v) => Math.round(v).toLocaleString('es') + ' K');
bindSlider('s-gain', 'diskGain', (v) => v.toFixed(2));
bindSlider('s-thick', 'thick', (v) => v.toFixed(2));
bindSlider('s-bloom', 'bloom', (v) => v.toFixed(2));
bindSlider('s-exposure', 'exposure', (v) => v.toFixed(2));
bindSlider('s-time', 'timeScale', (v) => v.toFixed(2) + '×');

$('#s-quality').addEventListener('change', (e) => { params.quality = e.target.value; renderScale = 1; });
$('#s-mass').addEventListener('change', (e) => { massKey = e.target.value; properTime = farTime = 0; });

document.querySelectorAll('[data-mode-btn]').forEach((b) => b.addEventListener('click', () => {
  const m = b.dataset.modeBtn;
  if (m === 'dive') { if (mode === 'dive') return; showCaption('Iniciando caída libre', 'Observa cómo la sombra crece, el cielo entero se comprime en un anillo y tu reloj se ralentiza respecto al universo.'); }
  setMode(m);
}));

const PRESETS = {
  interstellar: { lensing: 1, doppler: 0.0, temp: 4600, diskGain: 0.75, thick: 0.4, bloom: 0.9, exposure: 0.9 },
  physical:     { lensing: 1, doppler: 1, temp: 6500, diskGain: 0.55, thick: 0.5, bloom: 0.7, exposure: 0.85 },
  quasar:       { lensing: 1, doppler: 1, temp: 18000, diskGain: 0.8, thick: 1.2, bloom: 1.3, exposure: 0.7 },
  newton:       { lensing: 0, doppler: 0, temp: 5500, diskGain: 0.6, thick: 0.4, bloom: 0.7, exposure: 0.9 },
};
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  const p = PRESETS[b.dataset.preset];
  const from = { ...params };
  const t0 = performance.now();
  const map = { lensing: 's-lensing', doppler: 's-doppler', temp: 's-temp', diskGain: 's-gain', thick: 's-thick', bloom: 's-bloom', exposure: 's-exposure' };
  (function step() {
    const k = smoother(Math.min(1, (performance.now() - t0) / 1400));
    for (const key in p) {
      const el = $('#' + map[key]);
      el.value = lerp(from[key], p[key], k);
      el.dispatchEvent(new Event('input'));
    }
    if (k < 1) requestAnimationFrame(step);
  })();
  document.querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('on', x === b));
}));

$('#btn-panel').addEventListener('click', () => document.body.classList.toggle('panel-open'));
$('#btn-audio').addEventListener('click', toggleAudio);
$('#btn-shot').addEventListener('click', () => (wantShot = true));
$('#btn-full').addEventListener('click', toggleFull);
$('#btn-hide').addEventListener('click', () => document.body.classList.toggle('clean'));

function toggleAudio() {
  if (drone.on) drone.stop(); else drone.start();
  $('#btn-audio').classList.toggle('on', drone.on);
}
function toggleFull() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
}
function saveShot() {
  canvas.toBlob((b) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `singularity-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === 'h') document.body.classList.toggle('clean');
  else if (k === ' ') { paused = !paused; e.preventDefault(); }
  else if (k === 'c') setMode(mode === 'tour' ? 'orbit' : 'tour');
  else if (k === 'd') document.querySelector('[data-mode-btn="dive"]').click();
  else if (k === 'p') wantShot = true;
  else if (k === 'f') toggleFull();
  else if (k === 'm') toggleAudio();
  else if (k === 'tab') { e.preventDefault(); document.body.classList.toggle('panel-open'); }
});

// captions
let capTimer;
function showCaption(title, body) {
  const el = $('#caption');
  el.querySelector('h3').textContent = title;
  el.querySelector('p').textContent = body;
  el.classList.add('show');
  clearTimeout(capTimer);
  capTimer = setTimeout(() => el.classList.remove('show'), 6000);
}

// intro
$('#enter').addEventListener('click', () => {
  document.body.classList.add('entered');
  drone.start(); $('#btn-audio').classList.add('on');
  setMode('tour');
  setTimeout(() => showCaption('Gargantúa, trazado en tiempo real', 'Cada píxel sigue la trayectoria de un fotón a través del espacio-tiempo curvo de Schwarzschild. Arrastra para orbitar. Rueda para acercarte.'), 1800);
});
$('#enter-silent').addEventListener('click', () => {
  document.body.classList.add('entered');
  setMode('tour');
});

// go
resize();
setMode('intro');
document.body.dataset.mode = 'intro';
requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

// debug / automation hook (e.g. ?cam=yaw,pitch,dist)
const camQ = new URLSearchParams(location.search).get('cam');
if (camQ) {
  const [y, p, d, lk] = camQ.split(',').map(Number);
  document.body.classList.add('entered');
  setMode('orbit');
  Object.assign(goal, { yaw: y, pitch: p, dist: d, roll: 0, fov: 1, look: lk || 0 });
  Object.assign(cam, goal);
  idleT = -1e9;
  fade = 1;
}
const qQ = new URLSearchParams(location.search).get('q');
if (qQ && QUALITY[qQ]) { params.quality = qQ; $('#s-quality').value = qQ; }
