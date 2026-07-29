// ============ ELDERMERE — Texturas pixeladas procedurales (estilo voxel) ============
import * as THREE from 'three';
import { mulberry32 } from './rng.js';

const TILE = 16, COLS = 8, ROWS = 8;
const registry = new Map();   // nombre -> {x,y} en el atlas
let cursor = 0;

function hashName(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Registra una textura y devuelve su nombre
function reg(name, drawFn) {
  if (registry.has(name)) return name;
  const idx = cursor++;
  registry.set(name, { x: idx % COLS, y: Math.floor(idx / COLS) | 0, draw: drawFn });
  return name;
}

// Helper: ruido de pixel con paleta
function pixelNoise(ctx, ox, oy, seed, palette, scale = 1) {
  const rand = mulberry32(seed);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    if (rand() < scale) {
      const c = palette[(rand() * palette.length) | 0];
      ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}
function overlaySpeckles(ctx, ox, oy, seed, color, n, size = 1) {
  const rand = mulberry32(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) ctx.fillRect(ox + (rand() * TILE) | 0, oy + (rand() * TILE) | 0, size, size);
}
function drawBricks(ctx, ox, oy, seed, base, mortar, bw = 8, bh = 4) {
  const rand = mulberry32(seed);
  ctx.fillStyle = mortar; ctx.fillRect(ox, oy, TILE, TILE);
  for (let row = 0; row * bh < TILE; row++) {
    const off = (row % 2) * (bw / 2);
    for (let col = -1; col * bw < TILE; col++) {
      const c = base[(rand() * base.length) | 0];
      ctx.fillStyle = c;
      ctx.fillRect(ox + col * bw + off + 1, oy + row * bh + 1, bw - 2, bh - 2);
    }
  }
}
function drawOre(ctx, ox, oy, seed, stonePal, gemPal) {
  pixelNoise(ctx, ox, oy, seed, stonePal);
  const rand = mulberry32(seed + 7);
  for (let i = 0; i < 5; i++) {
    const gx = 2 + (rand() * 12) | 0, gy = 2 + (rand() * 12) | 0;
    const c = gemPal[(rand() * gemPal.length) | 0];
    ctx.fillStyle = c;
    ctx.fillRect(ox + gx, oy + gy, 2, 2);
    ctx.fillStyle = gemPal[gemPal.length - 1];
    ctx.fillRect(ox + gx, oy + gy, 1, 1);
  }
}

const P = {
  dirt:   ['#6d4c2c', '#5f4226', '#7a5634', '#68482a'],
  grass:  ['#5d8f3e', '#548237', '#679c46', '#4f7a34'],
  stone:  ['#7d7d7d', '#727272', '#8a8a8a', '#686868'],
  sand:   ['#e0d29a', '#d6c78e', '#eadfb0', '#cbbd82'],
  snow:   ['#eef4f8', '#e2ecf2', '#f6fafc', '#d8e4ec'],
  mud:    ['#4e4230', '#453a2a', '#584c36', '#403626'],
  wood:   ['#8a6a42', '#7d5f3a', '#96754c'],
  woodD:  ['#4e3a26', '#453322', '#584330'],
  cobble: ['#6a6a6a', '#5c5c5c', '#787878'],
};

export function buildTextureAtlas() {
  // ---- registrar todas ----
  reg('grassTop',  (c, x, y) => { pixelNoise(c, x, y, 11, P.grass); overlaySpeckles(c, x, y, 12, '#79a852', 20); });
  reg('grassSide', (c, x, y) => { pixelNoise(c, x, y, 13, P.dirt); for (let i = 0; i < TILE; i++) { const h = 3 + ((i * 7 + 3) % 3); for (let j = 0; j < h; j++) { c.fillStyle = P.grass[(i + j) % 4]; c.fillRect(x + i, y + j, 1, 1); } } });
  reg('dirt',      (c, x, y) => { pixelNoise(c, x, y, 14, P.dirt); overlaySpeckles(c, x, y, 15, '#513a20', 14); });
  reg('stone',     (c, x, y) => { pixelNoise(c, x, y, 16, P.stone); overlaySpeckles(c, x, y, 17, '#5e5e5e', 12); });
  reg('cobble',    (c, x, y) => { drawBricks(c, x, y, 18, P.cobble, '#4a4a4a', 5, 5); });
  reg('stoneBricks',(c, x, y) => { drawBricks(c, x, y, 19, P.stone, '#4f4f4f'); });
  reg('sand',      (c, x, y) => { pixelNoise(c, x, y, 20, P.sand); });
  reg('sandstone', (c, x, y) => { pixelNoise(c, x, y, 21, P.sand); c.fillStyle = '#bfae76'; c.fillRect(x, y + 3, TILE, 1); c.fillRect(x, y + 12, TILE, 1); });
  reg('sandstoneTop',(c, x, y) => { pixelNoise(c, x, y, 22, P.sand); overlaySpeckles(c, x, y, 23, '#c9b87f', 26); });
  reg('snow',      (c, x, y) => { pixelNoise(c, x, y, 24, P.snow); });
  reg('snowSide',  (c, x, y) => { pixelNoise(c, x, y, 25, P.dirt); for (let i = 0; i < TILE; i++) { const h = 4 + ((i * 5 + 1) % 3); for (let j = 0; j < h; j++) { c.fillStyle = P.snow[(i + j) % 4]; c.fillRect(x + i, y + j, 1, 1); } } });
  reg('mud',       (c, x, y) => { pixelNoise(c, x, y, 26, P.mud); overlaySpeckles(c, x, y, 27, '#33422a', 16); });
  reg('iceRock',   (c, x, y) => { pixelNoise(c, x, y, 28, P.stone); overlaySpeckles(c, x, y, 29, '#bfe0ee', 22); });
  reg('ice',       (c, x, y) => { pixelNoise(c, x, y, 30, ['#bfe0f0', '#aad4e8', '#d0ecf8']); overlaySpeckles(c, x, y, 31, '#ffffff', 10); });
  reg('logTop',    (c, x, y) => { c.fillStyle = '#a8845a'; c.fillRect(x, y, TILE, TILE); const r = mulberry32(32); for (let ring = 6; ring > 0; ring--) { c.strokeStyle = ring % 2 ? '#8a6a42' : '#96754c'; c.strokeRect(x + 8 - ring - (r() < .5 ? 1 : 0), y + 8 - ring, ring * 2, ring * 2); } });
  reg('logSide',   (c, x, y) => { pixelNoise(c, x, y, 33, P.wood); const r = mulberry32(34); for (let i = 0; i < 5; i++) { c.fillStyle = '#5f4527'; c.fillRect(x + (r() * TILE) | 0, y, 1, TILE); } });
  reg('logDarkTop',(c, x, y) => { c.fillStyle = '#6a5036'; c.fillRect(x, y, TILE, TILE); for (let ring = 6; ring > 0; ring--) { c.strokeStyle = ring % 2 ? '#4e3a26' : '#584330'; c.strokeRect(x + 8 - ring, y + 8 - ring, ring * 2, ring * 2); } });
  reg('logDarkSide',(c, x, y) => { pixelNoise(c, x, y, 35, P.woodD); const r = mulberry32(36); for (let i = 0; i < 5; i++) { c.fillStyle = '#2e2115'; c.fillRect(x + (r() * TILE) | 0, y, 1, TILE); } });
  reg('logBirchTop',(c, x, y) => { c.fillStyle = '#d8d0c0'; c.fillRect(x, y, TILE, TILE); for (let ring = 6; ring > 0; ring--) { c.strokeStyle = ring % 2 ? '#b8b0a0' : '#c8c0b0'; c.strokeRect(x + 8 - ring, y + 8 - ring, ring * 2, ring * 2); } });
  reg('logBirchSide',(c, x, y) => { pixelNoise(c, x, y, 37, ['#d8d0c0', '#cfc7b7', '#e2dac9']); const r = mulberry32(38); for (let i = 0; i < 6; i++) { c.fillStyle = '#3a332a'; c.fillRect(x + (r() * TILE) | 0, y + (r() * TILE) | 0, 2, 1); } });
  reg('logDeadTop',(c, x, y) => { c.fillStyle = '#7a7068'; c.fillRect(x, y, TILE, TILE); for (let ring = 6; ring > 0; ring--) { c.strokeStyle = ring % 2 ? '#5e564e' : '#6a625a'; c.strokeRect(x + 8 - ring, y + 8 - ring, ring * 2, ring * 2); } });
  reg('logDeadSide',(c, x, y) => { pixelNoise(c, x, y, 39, ['#6a6058', '#5e564e', '#766c64']); const r = mulberry32(40); for (let i = 0; i < 6; i++) { c.fillStyle = '#423a32'; c.fillRect(x + (r() * TILE) | 0, y, 1, TILE); } });
  const leavesPal = ['#3f6b2a', '#375f24', '#47782f', '#2f5420'];
  reg('leaves',    (c, x, y) => { pixelNoise(c, x, y, 41, leavesPal); overlaySpeckles(c, x, y, 42, '#578c3a', 18); });
  reg('leavesDark',(c, x, y) => { pixelNoise(c, x, y, 43, ['#1e3a20', '#183018', '#244428']); });
  reg('leavesSnow',(c, x, y) => { pixelNoise(c, x, y, 44, leavesPal); overlaySpeckles(c, x, y, 45, '#eef4f8', 34); });
  reg('planks',    (c, x, y) => { pixelNoise(c, x, y, 46, ['#a8845a', '#9c7a50', '#b4906a']); c.fillStyle = '#6a4e2e'; for (let i = 0; i < 4; i++) c.fillRect(x, y + i * 4, TILE, 1); });
  reg('planksDark',(c, x, y) => { pixelNoise(c, x, y, 47, ['#5e4630', '#54402a', '#684e36']); c.fillStyle = '#38281a'; for (let i = 0; i < 4; i++) c.fillRect(x, y + i * 4, TILE, 1); });
  reg('glass',     (c, x, y) => { c.clearRect(x, y, TILE, TILE); c.strokeStyle = '#cfe8f0'; c.strokeRect(x + .5, y + .5, TILE - 1, TILE - 1); c.fillStyle = 'rgba(207,232,240,.35)'; c.fillRect(x + 3, y + 3, 3, 3); c.fillRect(x + 9, y + 8, 2, 2); });
  reg('coalOre',   (c, x, y) => { drawOre(c, x, y, 48, P.stone, ['#2a2a2a', '#1e1e1e', '#3a3a3a']); });
  reg('ironOre',   (c, x, y) => { drawOre(c, x, y, 49, P.stone, ['#c88a5a', '#b87a4a', '#e8a87a']); });
  reg('goldOre',   (c, x, y) => { drawOre(c, x, y, 50, P.stone, ['#e8c84a', '#d4b43a', '#ffe87a']); });
  reg('mithrilOre',(c, x, y) => { drawOre(c, x, y, 51, ['#5a5e68', '#50545e', '#646872'], ['#6ae0e8', '#4ac8d4', '#a8f4fa']); });
  reg('crystalOre',(c, x, y) => { drawOre(c, x, y, 52, ['#4a4458', '#403a4e', '#544e62'], ['#b06ae8', '#944ad4', '#d4a8fa']); });
  reg('water',     (c, x, y) => { pixelNoise(c, x, y, 53, ['#2a5a9e', '#24518f', '#3066ad']); const r = mulberry32(54); c.fillStyle = '#4a86c8'; for (let i = 0; i < 8; i++) c.fillRect(x + (r() * 13) | 0, y + (r() * 15) | 0, 3, 1); });
  reg('waterSwamp',(c, x, y) => { pixelNoise(c, x, y, 55, ['#3a5a2e', '#334f28', '#426534']); const r = mulberry32(56); c.fillStyle = '#5a7a42'; for (let i = 0; i < 8; i++) c.fillRect(x + (r() * 13) | 0, y + (r() * 15) | 0, 3, 1); });
  reg('lava',      (c, x, y) => { pixelNoise(c, x, y, 57, ['#d84a1a', '#c43e12', '#e85e2a']); overlaySpeckles(c, x, y, 58, '#ffb43a', 22); overlaySpeckles(c, x, y, 59, '#7a1e08', 10); });
  reg('farmland',  (c, x, y) => { pixelNoise(c, x, y, 60, ['#4e3a24', '#453421', '#584330']); c.fillStyle = '#342618'; for (let i = 0; i < 4; i++) c.fillRect(x, y + 2 + i * 4, TILE, 1); });
  reg('torch',     (c, x, y) => { c.fillStyle = '#6a4e2e'; c.fillRect(x + 6, y + 6, 4, 10); c.fillStyle = '#ffb43a'; c.fillRect(x + 5, y + 1, 6, 5); c.fillStyle = '#ffe87a'; c.fillRect(x + 6, y + 2, 4, 3); });
  reg('flower',    (c, x, y) => { pixelNoise(c, x, y, 61, ['#00000000'], 0); const r = mulberry32(62); const cols = ['#d84a6a', '#e8c84a', '#b06ae8', '#e8e8e8']; for (let i = 0; i < 3; i++) { const fx = 2 + (r() * 12) | 0, fy = 8 + (r() * 7) | 0; c.fillStyle = '#3f6b2a'; c.fillRect(x + fx, y + fy, 1, 16 - fy); c.fillStyle = cols[(r() * 4) | 0]; c.fillRect(x + fx - 1, y + fy - 2, 3, 3); } });
  reg('mushroom',  (c, x, y) => { c.fillStyle = '#c8b8a0'; c.fillRect(x + 6, y + 8, 4, 7); c.fillStyle = '#8a4bd0'; c.fillRect(x + 3, y + 4, 10, 5); c.fillStyle = '#d4a8fa'; c.fillRect(x + 5, y + 5, 2, 2); c.fillRect(x + 9, y + 6, 2, 2); });
  reg('cactus',    (c, x, y) => { pixelNoise(c, x, y, 63, ['#3a7a34', '#316b2c', '#448a3d']); overlaySpeckles(c, x, y, 64, '#e8e8d8', 8); });
  reg('cactusTop', (c, x, y) => { pixelNoise(c, x, y, 65, ['#3a7a34', '#448a3d']); c.fillStyle = '#316b2c'; c.fillRect(x + 4, y + 4, 8, 8); });
  reg('obsidian',  (c, x, y) => { pixelNoise(c, x, y, 66, ['#1a1226', '#150e1e', '#201630']); overlaySpeckles(c, x, y, 67, '#3a2454', 12); });
  reg('brickRed',  (c, x, y) => { drawBricks(c, x, y, 68, ['#9e4a34', '#8f4130', '#ad553d'], '#6e5a4a'); });
  reg('straw',     (c, x, y) => { pixelNoise(c, x, y, 69, ['#d4b45a', '#c8a84e', '#e0c46a']); const r = mulberry32(70); c.fillStyle = '#a8883a'; for (let i = 0; i < 8; i++) c.fillRect(x + (r() * 14) | 0, y + (r() * 14) | 0, 2, 1); });
  reg('bone',      (c, x, y) => { pixelNoise(c, x, y, 71, ['#d8d0bc', '#cfc7b3', '#e2dac6']); overlaySpeckles(c, x, y, 72, '#a89f8a', 12); });
  reg('runeStone', (c, x, y) => { pixelNoise(c, x, y, 73, P.stone); c.fillStyle = '#6ae0e8'; c.fillRect(x + 7, y + 3, 2, 10); c.fillRect(x + 4, y + 6, 8, 2); c.fillRect(x + 4, y + 10, 8, 2); });
  reg('bedrock',   (c, x, y) => { pixelNoise(c, x, y, 74, ['#2a2a2a', '#1e1e1e', '#363636', '#141414']); });
  const drawCrop = (c, x, y, seed, h, stemCol, headCol) => {
    const r = mulberry32(seed);
    for (let i = 0; i < 5; i++) {
      const cx2 = 2 + (r() * 12) | 0;
      c.fillStyle = stemCol; c.fillRect(x + cx2, y + 16 - h, 1, h);
      if (headCol) { c.fillStyle = headCol; c.fillRect(x + cx2 - 1, y + 15 - h, 3, 2); }
    }
  };
  reg('crop0', (c, x, y) => { drawCrop(c, x, y, 80, 4, '#4f7a34', null); });
  reg('crop1', (c, x, y) => { drawCrop(c, x, y, 81, 8, '#5d8f3e', null); });
  reg('crop2', (c, x, y) => { drawCrop(c, x, y, 82, 11, '#7a9a3a', '#b8a83e'); });
  reg('crop3', (c, x, y) => { drawCrop(c, x, y, 83, 14, '#c8a84e', '#e0c46a'); });
  reg('goldBlock', (c, x, y) => { pixelNoise(c, x, y, 75, ['#e8c84a', '#dcb93e', '#f4d75e']); c.fillStyle = '#b89a2e'; c.strokeRect(x + .5, y + .5, TILE - 1, TILE - 1); });
  reg('mithrilBlock',(c, x, y) => { pixelNoise(c, x, y, 76, ['#8ad4dc', '#7ac4d0', '#9ae4ea']); c.fillStyle = '#5aa4b0'; c.strokeRect(x + .5, y + .5, TILE - 1, TILE - 1); });

  // ---- pintar atlas ----
  const cv = document.createElement('canvas');
  cv.width = COLS * TILE; cv.height = ROWS * TILE;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const uvMap = new Map();
  for (const [name, info] of registry) {
    info.draw(ctx, info.x * TILE, info.y * TILE);
    uvMap.set(name, info);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;

  function uv(name) {
    const i = uvMap.get(name) || uvMap.get('stone');
    const u0 = i.x / COLS, v0 = 1 - (i.y + 1) / ROWS, u1 = (i.x + 1) / COLS, v1 = 1 - i.y / ROWS;
    return [u0, v0, u1, v1];
  }
  return { texture: tex, uv };
}
