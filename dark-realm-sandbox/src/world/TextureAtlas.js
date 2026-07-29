// ============================================================================
// Procedural pixel-art texture atlas generator.
// Draws every block texture on an 8x8 grid of 16x16 tiles directly onto a
// canvas at runtime — no external image assets needed, fully voxel/low-poly
// pixelated aesthetic, deterministic (seeded) noise for a hand-painted feel.
// ============================================================================
import * as THREE from 'three';

const TILE = 16;
const COLS = 8;
const ROWS = 8;

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx, x, y, size, rng, base, variants, density = 0.55) {
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const r = rng();
      let color = base;
      if (r > 1 - density) color = variants[Math.floor(rng() * variants.length)];
      ctx.fillStyle = color;
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
}

function grad(ctx, x, y, size, c1, c2, rng, dir = 'v') {
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const t = dir === 'v' ? py / size : px / size;
      const jitter = (rng() - 0.5) * 0.08;
      const tt = Math.min(1, Math.max(0, t + jitter));
      const col = lerpColor(c1, c2, tt);
      ctx.fillStyle = col;
      ctx.fillRect(x + px, y + py, 1, 1);
    }
  }
}

function lerpColor(a, b, t) {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.substr(0, 2), 16), g: parseInt(h.substr(2, 2), 16), b: parseInt(h.substr(4, 2), 16) };
}

function drawOre(ctx, x, y, base, veins, spots, rng) {
  speckle(ctx, x, y, TILE, rng, base, [shade(base, 0.85), shade(base, 1.15)], 0.5);
  for (let i = 0; i < spots; i++) {
    const sx = x + 2 + Math.floor(rng() * (TILE - 4));
    const sy = y + 2 + Math.floor(rng() * (TILE - 4));
    const sz = 1 + Math.floor(rng() * 2);
    ctx.fillStyle = veins;
    ctx.fillRect(sx, sy, sz, sz);
    ctx.fillStyle = shade(veins, 1.3);
    ctx.fillRect(sx, sy, 1, 1);
  }
}

function shade(hex, factor) {
  const c = hexToRgb(hex);
  const r = Math.min(255, Math.round(c.r * factor));
  const g = Math.min(255, Math.round(c.g * factor));
  const b = Math.min(255, Math.round(c.b * factor));
  return `rgb(${r},${g},${b})`;
}

function border(ctx, x, y, size, color, alpha = 0.35) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  ctx.globalAlpha = 1;
}

export function generateAtlas() {
  const size = TILE * COLS;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const rng = mulberry32(1337);
  const tile = (col, row) => [col * TILE, row * TILE];

  // Helper to paint a whole tile with speckle
  const paint = (col, row, base, variants, density = 0.5) => {
    const [x, y] = tile(col, row);
    speckle(ctx, x, y, TILE, rng, base, variants, density);
  };
  const paintGrad = (col, row, c1, c2, dir) => {
    const [x, y] = tile(col, row);
    grad(ctx, x, y, TILE, c1, c2, rng, dir);
  };

  // Row 0: grass/dirt/stone/sand/snow/water
  paint(0, 0, '#3f7d33', ['#4f9640', '#356b2b', '#5ba648'], 0.6); // grass top
  paint(1, 0, '#6b4a2f', ['#7c5738', '#5a3c24', '#87613f'], 0.55); // dirt
  paint(2, 0, '#5c8b3f', ['#4f9640', '#3f7d33']); // grass side base (overlaid below)
  { // grass side: dirt bottom + grass strip on top
    const [x, y] = tile(2, 0);
    speckle(ctx, x, y, TILE, rng, '#6b4a2f', ['#7c5738', '#5a3c24'], 0.5);
    speckle(ctx, x, y, TILE * 0.3, rng, '#3f7d33', ['#4f9640', '#356b2b'], 0.6);
  }
  paint(3, 0, '#8a8a8e', ['#78787c', '#97979b', '#6d6d70'], 0.55); // stone
  paint(4, 0, '#d8c481', ['#e0cf95', '#c9b46f'], 0.45); // sand
  paint(5, 0, '#eef4f8', ['#ffffff', '#dbe6ec'], 0.4); // snow top
  paint(6, 0, '#d7dee2', ['#c3ccd1', '#e7edf0'], 0.45); // snow side
  paintGrad(7, 0, '#1c5f7a', '#2f8fae', 'v'); // water

  // Row 1: log/leaves/ores
  { const [x, y] = tile(0, 1); speckle(ctx, x, y, TILE, rng, '#8a6a3f', ['#7c5c34', '#93744a'], 0.4);
    ctx.strokeStyle = '#5a3f22'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 8, y + 8, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 8, y + 8, 2, 0, Math.PI * 2); ctx.stroke(); }
  { const [x, y] = tile(1, 1);
    for (let py = 0; py < TILE; py++) {
      for (let px = 0; px < TILE; px++) {
        const stripe = Math.sin(px * 0.9) * 3;
        const c = Math.abs((py + stripe) % 8 - 4) < 2 ? '#6b4d2c' : '#7c5c34';
        ctx.fillStyle = c; ctx.fillRect(x + px, y + py, 1, 1);
      }
    } }
  paint(2, 1, '#2e5f2a', ['#3a7433', '#254e22', '#468339'], 0.6); // leaves
  drawOre(ctx, ...tile(3, 1), '#6f6f74', '#2b2b2b', 6, rng); // coal
  drawOre(ctx, ...tile(4, 1), '#8f8378', '#b5762f', 6, rng); // iron
  drawOre(ctx, ...tile(5, 1), '#8f9aa0', '#dfe6ea', 6, rng); // silver
  drawOre(ctx, ...tile(6, 1), '#8f8262', '#e6c344', 6, rng); // gold
  drawOre(ctx, ...tile(7, 1), '#5f7d84', '#69e0c9', 7, rng); // mithril (teal glow)

  // Row 2: planks/cobble/torch/farmland/crops
  { const [x, y] = tile(0, 2);
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const c = (px % 4 === 0) ? '#a9793f' : ((py + px) % 7 === 0 ? '#8a5f30' : '#b9884c');
      ctx.fillStyle = c; ctx.fillRect(x + px, y + py, 1, 1);
    } }
  paint(1, 2, '#8f8f92', ['#7a7a7d', '#a0a0a3', '#67676a'], 0.6); // cobblestone
  { const [x, y] = tile(2, 2); ctx.clearRect(x, y, TILE, TILE);
    ctx.fillStyle = '#5a3c24'; ctx.fillRect(x + 7, y + 6, 2, 10);
    ctx.fillStyle = '#ffb020'; ctx.fillRect(x + 6, y + 2, 4, 5);
    ctx.fillStyle = '#ff5b1f'; ctx.fillRect(x + 7, y + 3, 2, 3); }
  paint(3, 2, '#5a4127', ['#4a3420', '#6b4d2f'], 0.6); // farmland
  { const [x, y] = tile(4, 2); ctx.clearRect(x, y, TILE, TILE);
    ctx.fillStyle = '#4a7d2f'; ctx.fillRect(x + 7, y + 10, 2, 5); ctx.fillRect(x + 6, y + 9, 1, 2); ctx.fillRect(x + 9, y + 9, 1, 2); }
  { const [x, y] = tile(5, 2); ctx.clearRect(x, y, TILE, TILE);
    ctx.fillStyle = '#5c9038'; ctx.fillRect(x + 7, y + 7, 2, 8); ctx.fillRect(x + 5, y + 6, 2, 3); ctx.fillRect(x + 9, y + 6, 2, 3); }
  { const [x, y] = tile(6, 2); ctx.clearRect(x, y, TILE, TILE);
    ctx.fillStyle = '#8ba930'; ctx.fillRect(x + 7, y + 4, 2, 11);
    ctx.fillStyle = '#c9b23a'; ctx.fillRect(x + 5, y + 3, 2, 4); ctx.fillRect(x + 9, y + 3, 2, 4); }
  { const [x, y] = tile(7, 2); ctx.clearRect(x, y, TILE, TILE);
    ctx.fillStyle = '#d8b23a'; ctx.fillRect(x + 7, y + 2, 2, 13);
    ctx.fillStyle = '#e8c94a'; ctx.fillRect(x + 4, y + 1, 3, 5); ctx.fillRect(x + 9, y + 1, 3, 5); }

  // Row 3: chest/workbench/forge/cauldron
  paint(0, 3, '#7c5230', ['#6b4527', '#8a5f38'], 0.5);
  { const [x, y] = tile(0, 3); ctx.fillStyle = '#40291a'; ctx.fillRect(x + 6, y + 6, 4, 3); }
  paint(1, 3, '#6b4527', ['#5a3a20', '#7c5230'], 0.5);
  paint(2, 3, '#a9793f', ['#b9884c', '#8a5f30'], 0.4);
  paint(3, 3, '#8a5f30', ['#7c5230', '#a9793f'], 0.4);
  paintGrad(4, 3, '#5a5a5c', '#33302f', 'v');
  { const [x, y] = tile(4, 3); ctx.fillStyle = '#ff6a1f'; ctx.fillRect(x + 5, y + 10, 6, 3); }
  paintGrad(5, 3, '#43413f', '#26221f', 'v');
  paint(6, 3, '#3d4a3a', ['#4a5c47', '#33402f'], 0.5);
  { const [x, y] = tile(6, 3); ctx.fillStyle = '#5c8f60'; ctx.fillRect(x + 4, y + 3, 8, 4); }
  paint(7, 3, '#565654', ['#4a4a48', '#666664'], 0.4);

  // Row 4: bedrock/ice/mud/cactus/palm log/palm leaves/gravel/clay
  paint(0, 4, '#1c1c1e', ['#141416', '#26262a'], 0.6);
  paintGrad(1, 4, '#a9e2f2', '#7fc4de', 'v');
  paint(2, 4, '#4a4030', ['#3d3427', '#584c39'], 0.6);
  paint(3, 4, '#3c6b2f', ['#31592a', '#487d38'], 0.5);
  { const [x, y] = tile(3, 4); ctx.fillStyle = '#f4e9c4'; for (let i=0;i<6;i++) ctx.fillRect(x+2+i*2, y+2+((i%2)*3), 1,1); }
  { const [x, y] = tile(4, 4); speckle(ctx, x, y, TILE, rng, '#9c7a4a', ['#8a6a3f', '#ab8a55'], 0.4); }
  paint(5, 4, '#3f8a4a', ['#4fa159', '#357740'], 0.6);
  paint(6, 4, '#88827c', ['#787270', '#96908a'], 0.55);
  paint(7, 4, '#a2765a', ['#8f6449', '#b18468'], 0.45);

  // Row 5: mossy stone/castle brick/ruin stone/glowstone/pumpkin/pumpkin side/bone/mithril block
  { const [x, y] = tile(0, 5); speckle(ctx, x, y, TILE, rng, '#7c7c7f', ['#6d6d70', '#8a8a8d'], 0.5);
    speckle(ctx, x, y, TILE, rng, '#4a6b3a', ['#3a5c2c'], 0.18); }
  { const [x, y] = tile(1, 5);
    for (let py = 0; py < TILE; py++) for (let px = 0; px < TILE; px++) {
      const brick = (Math.floor(py / 4) % 2 === 0) ? Math.floor(px / 8) : Math.floor((px + 4) / 8);
      const edge = (py % 4 === 0) || (px % 8 === (Math.floor(py/4)%2===0?0:4));
      ctx.fillStyle = edge ? '#4a4340' : '#726860';
      ctx.fillRect(x + px, y + py, 1, 1);
    } }
  paint(2, 5, '#726860', ['#645b53', '#7f746b'], 0.55);
  { const [x, y] = tile(3, 5); speckle(ctx, x, y, TILE, rng, '#e8a23a', ['#ffcf5e', '#d88a1f'], 0.5); }
  paint(4, 5, '#d9782a', ['#c96a1f', '#e88a3a'], 0.5);
  { const [x, y] = tile(5, 5); speckle(ctx, x, y, TILE, rng, '#c96a1f', ['#b85c15', '#d9782a'], 0.4);
    ctx.fillStyle = '#8a4a12'; for (let py=0; py<TILE; py+=4) ctx.fillRect(x, y+py, TILE, 1); }
  paint(6, 5, '#d8d2c0', ['#c9c2ac', '#e6e0d0'], 0.5);
  { const [x, y] = tile(7, 5); speckle(ctx, x, y, TILE, rng, '#5fb2a0', ['#7fd6c4', '#468f80'], 0.5); }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return { texture, cols: COLS, rows: ROWS, canvas };
}

export function uvForTile(col, row, cols = COLS, rows = ROWS) {
  const u0 = col / cols, v0 = 1 - (row + 1) / rows;
  const u1 = (col + 1) / cols, v1 = 1 - row / rows;
  return { u0, v0, u1, v1 };
}
