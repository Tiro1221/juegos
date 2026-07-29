// ============ ELDERMERE — Generación procedural del mundo ============
import { CONFIG, BIOMES } from './config.js';
import { fbm2, fbm3, hash2, mulberry32 } from './rng.js';

const { CHUNK, WORLD_H, SEA_LEVEL, SEED } = CONFIG;

// ---------- Altura del terreno ----------
export function terrainHeight(x, z) {
  // continente + detalle + montañas con ridged noise
  const cont = fbm2(x * 0.0016, z * 0.0016, 4, SEED);          // 0..1
  const detail = fbm2(x * 0.012, z * 0.012, 3, SEED + 50);
  const ridge = 1 - Math.abs(2 * fbm2(x * 0.004, z * 0.004, 4, SEED + 90) - 1); // crestas
  const mountMask = Math.pow(fbm2(x * 0.0011 + 400, z * 0.0011 - 300, 3, SEED + 200), 2.2);
  let h = SEA_LEVEL - 6 + cont * 34 + detail * 6;
  h += ridge * mountMask * 46;
  return Math.max(4, Math.min(WORLD_H - 12, Math.round(h)));
}

// ---------- Selección de bioma ----------
export function biomeAt(x, z) {
  const temp = fbm2(x * 0.0011 + 800, z * 0.0011 + 800, 3, SEED + 300);   // 0 frío .. 1 caliente
  const hum = fbm2(x * 0.0013 - 500, z * 0.0013 + 250, 3, SEED + 400);    // 0 seco .. 1 húmedo
  const h = terrainHeight(x, z);
  if (h > 52) return 'MOUNTAIN';
  if (temp < 0.30) return 'TUNDRA';
  if (temp > 0.66 && hum < 0.42) return 'DESERT';
  if (hum > 0.72 && h < SEA_LEVEL + 6) return 'SWAMP';
  if (hum > 0.5) return 'FOREST';
  return 'PLAINS';
}

// ---------- Ríos: devuelve intensidad 0..1 (1 = centro del río) ----------
export function riverAt(x, z) {
  // ríos siguen líneas de bajo valor de ruido "snake"
  const n = fbm2(x * 0.0019 + 1500, z * 0.0019 - 900, 3, SEED + 600);
  const d = Math.abs(n - 0.5);            // cerca de 0 = cauce
  if (d < 0.012) return 1 - d / 0.012;
  return 0;
}

// ---------- Puntos de interés (aldeas, ruinas, castillos) ----------
// Distribuidos por celdas de rejilla, deterministas
export function poiAt(cx, cz, cellSize, chance, salt) {
  const t = hash2(cx, cz, SEED + salt);
  if (t > chance) return null;
  const r = mulberry32((cx * 7919 + cz * 104729 + salt * 31 + SEED) >>> 0);
  const x = cx * cellSize + Math.floor(r() * cellSize);
  const z = cz * cellSize + Math.floor(r() * cellSize);
  const biome = biomeAt(x, z);
  return { x, z, biome, seed: r() * 1e9 | 0 };
}
export function villageAt(x, z) {   // celda 220
  const cx = Math.floor(x / 220), cz = Math.floor(z / 220);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const p = poiAt(cx + i, cz + j, 220, 0.6, 1000);
    if (p && ['PLAINS', 'FOREST', 'DESERT', 'TUNDRA'].includes(p.biome) && Math.abs(p.x - x) < 120 && Math.abs(p.z - z) < 120) return p;
  }
  return null;
}
export function ruinAt(x, z) {      // celda 260
  const cx = Math.floor(x / 260), cz = Math.floor(z / 260);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const p = poiAt(cx + i, cz + j, 260, 0.5, 2000);
    if (p && Math.abs(p.x - x) < 130 && Math.abs(p.z - z) < 130) return p;
  }
  return null;
}
export function castleAt(x, z) {    // celda 480
  const cx = Math.floor(x / 480), cz = Math.floor(z / 480);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const p = poiAt(cx + i, cz + j, 480, 0.55, 3000);
    if (p && ['MOUNTAIN', 'TUNDRA', 'PLAINS', 'SWAMP'].includes(p.biome) && Math.abs(p.x - x) < 240 && Math.abs(p.z - z) < 240) return p;
  }
  return null;
}

// ---------- Datos base de columna (altura + bioma) usados por el chunk ----------
export function columnData(x, z) {
  const h = terrainHeight(x, z);
  const biome = biomeAt(x, z);
  const river = riverAt(x, z);
  return { h, biome, river };
}

// ---------- Minerales ----------
function oreBlock(wx, wy, wz) {
  // vetas 3D por tipo con distinta profundidad
  const v1 = fbm3(wx * 0.09, wy * 0.09, wz * 0.09, 2, SEED + 11);
  if (wy < 46 && v1 > 0.72) return 'coalOre';
  const v2 = fbm3(wx * 0.075 + 300, wy * 0.075, wz * 0.075, 2, SEED + 22);
  if (wy < 38 && v2 > 0.74) return 'ironOre';
  const v3 = fbm3(wx * 0.07 + 800, wy * 0.07, wz * 0.07 + 800, 2, SEED + 33);
  if (wy < 22 && v3 > 0.755) return 'goldOre';
  const v4 = fbm3(wx * 0.065 + 1500, wy * 0.065, wz * 0.065 + 1500, 2, SEED + 44);
  if (wy < 14 && v4 > 0.76) return 'mithrilOre';
  const v5 = fbm3(wx * 0.11 + 2200, wy * 0.11, wz * 0.11 + 2200, 2, SEED + 55);
  if (wy < 26 && v5 > 0.775) return 'crystalOre';
  return null;
}

// ---------- Cuevas ----------
function isCave(wx, wy, wz, surfaceH) {
  if (wy < 3 || wy > surfaceH - 3) return false;
  // túneles tipo "spaghetti": dos campos perpendiculares
  const a = fbm3(wx * 0.028, wy * 0.045, wz * 0.028, 3, SEED + 500);
  const b = fbm3(wx * 0.028 + 900, wy * 0.045 + 900, wz * 0.028 + 900, 3, SEED + 501);
  const tunnel = Math.abs(a - 0.5) < 0.035 && Math.abs(b - 0.5) < 0.035;
  if (tunnel) return true;
  // cavernas grandes bajo tierra
  if (wy < 24) {
    const c = fbm3(wx * 0.05 + 3000, wy * 0.06, wz * 0.05 + 3000, 3, SEED + 502);
    if (c > 0.68) return true;
  }
  return false;
}

// ---------- Genera un chunk completo: devuelve { data:Uint8Array, props:Map } ----------
// props: cosas fuera de rejilla (posiciones de NPCs, cultivos, cofres…) que main usará
export function generateChunk(cx, cz) {
  const data = new Uint8Array(CHUNK * CHUNK * WORLD_H);
  const props = { npcSpawns: [], mobSpawns: [], chests: [], crops: [], torches: [], structures: [] };
  const idx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;
  const B = (name) => name;   // alias legible; world.js resolverá el id

  const village = villageAt(cx * CHUNK, cz * CHUNK);
  const ruin = ruinAt(cx * CHUNK, cz * CHUNK);
  const castle = castleAt(cx * CHUNK, cz * CHUNK);

  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
      let { h, biome } = columnData(wx, wz);
      const bio = BIOMES[biome];
      const river = riverAt(wx, wz);

      // Los ríos excavan el cauce hasta el nivel del mar
      if (river > 0 && h > SEA_LEVEL - 2) h = Math.max(SEA_LEVEL - 4, h - Math.round(river * 8));
      // Pantano: terreno muy plano cerca del nivel del agua
      if (biome === 'SWAMP') h = Math.round(SEA_LEVEL - 2 + fbm2(wx * 0.05, wz * 0.05, 2, SEED + 77) * 5);
      // Oasis en el desierto
      const oasis = biome === 'DESERT' ? fbm2(wx * 0.02 + 5000, wz * 0.02 + 5000, 2, SEED + 88) : 0;
      const isOasis = oasis > 0.80;
      if (isOasis) h = Math.min(h, SEA_LEVEL - 1);

      // Columna de bloques
      for (let y = 0; y <= h && y < WORLD_H; y++) {
        let name;
        if (y === 0) name = 'bedrock';
        else if (y >= h - 0) name = bio.top;
        else if (y >= h - 3) name = bio.sub;
        else name = bio.rock;
        // vetas de mineral
        if (name === bio.rock || name === 'stone') {
          const ore = oreBlock(wx, y, wz);
          if (ore) name = ore;
        }
        data[idx(lx, y, lz)] = name;
      }
      // Cuevas: perforar
      for (let y = 2; y < h; y++) {
        if (isCave(wx, y, wz, h)) {
          const below = y > 0 ? data[idx(lx, y - 1, lz)] : 'air';
          data[idx(lx, y, lz)] = 'air';
          // lava en el fondo de cuevas profundas
          if (y < 8 && hash2(wx, wz, SEED + y) > 0.93 && below !== 'air') data[idx(lx, y - 1, lz)] = 'lava';
        }
      }
      // Agua: mar, ríos, pantano, oasis
      const waterName = biome === 'SWAMP' ? 'waterSwamp' : 'water';
      for (let y = h + 1; y <= SEA_LEVEL; y++) {
        if (data[idx(lx, y, lz)] === 'air' || data[idx(lx, y, lz)] === 0) {
          // hielo en tundra en superficie de agua
          if (biome === 'TUNDRA' && y === SEA_LEVEL && hash2(wx, wz, SEED + 99) > 0.35) data[idx(lx, y, lz)] = 'ice';
          else data[idx(lx, y, lz)] = waterName;
        }
      }
      // Huesos antiguos en desierto (reliquias)
      if (biome === 'DESERT' && hash2(wx, wz, SEED + 555) > 0.996) {
        data[idx(lx, h + 1, lz)] = 'bone';
      }
      // Hongos brillantes en cuevas del pantano/bosque (marcador visual sobre superficie húmeda)
      if (biome === 'SWAMP' && hash2(wx, wz, SEED + 556) > 0.985 && h >= SEA_LEVEL - 1) {
        data[idx(lx, h + 1, lz)] = 'mushroom';
      }
      // Flores
      if (hash2(wx, wz, SEED + 557) < bio.flower && h > SEA_LEVEL && data[idx(lx, h, lz)] === bio.top) {
        data[idx(lx, h + 1, lz)] = 'flower';
      }
      // Cactus en desierto
      if (biome === 'DESERT' && !isOasis && hash2(wx, wz, SEED + 558) > 0.985 && h > SEA_LEVEL) {
        const ch = 2 + (hash2(wx, wz, SEED + 559) * 3 | 0);
        for (let i = 1; i <= ch; i++) data[idx(lx, h + i, lz)] = 'cactus';
      }
    }
  }

  // ---------- Vegetación (árboles por bioma) ----------
  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const wx = cx * CHUNK + lx, wz = cz * CHUNK + lz;
      const { h, biome } = columnData(wx, wz);
      const bio = BIOMES[biome];
      if (h <= SEA_LEVEL) continue;
      const t = hash2(wx * 3, wz * 3, SEED + 660);
      if (t > bio.tree) continue;
      // dejar borde para la copa
      if (lx < 2 || lx > CHUNK - 3 || lz < 2 || lz > CHUNK - 3) continue;
      plantTree(data, lx, h, lz, biome);
    }
  }

  // ---------- Estructuras ----------
  if (village && village.x >= cx * CHUNK - 40 && village.x < cx * CHUNK + CHUNK + 40 &&
      village.z >= cz * CHUNK - 40 && village.z < cz * CHUNK + CHUNK + 40) {
    buildVillage(data, cx, cz, village, props);
  }
  if (ruin && ruin.x >= cx * CHUNK - 30 && ruin.x < cx * CHUNK + CHUNK + 30 &&
      ruin.z >= cz * CHUNK - 30 && ruin.z < cz * CHUNK + CHUNK + 30) {
    buildRuin(data, cx, cz, ruin, props);
  }
  if (castle && castle.x >= cx * CHUNK - 60 && castle.x < cx * CHUNK + CHUNK + 60 &&
      castle.z >= cz * CHUNK - 60 && castle.z < cz * CHUNK + CHUNK + 60) {
    buildCastle(data, cx, cz, castle, props);
  }
  // Mazmorra procedural bajo cada aldea/ruina (entrada en superficie)
  if ((village || ruin) && hash2(cx, cz, SEED + 777) > 0.5) {
    const anchor = village || ruin;
    if (anchor.x >= cx * CHUNK - 24 && anchor.x < cx * CHUNK + CHUNK + 24 &&
        anchor.z >= cz * CHUNK - 24 && anchor.z < cz * CHUNK + CHUNK + 24) {
      buildDungeon(data, cx, cz, anchor, props);
    }
  }

  return { data, props };
}

function set(data, lx, y, lz, name) {
  if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= WORLD_H) return;
  data[(y * CHUNK + lz) * CHUNK + lx] = name;
}
function get(data, lx, y, lz) {
  if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= WORLD_H) return 'air';
  return data[(y * CHUNK + lz) * CHUNK + lx];
}

// ---------- Árboles por bioma ----------
function plantTree(data, lx, h, lz, biome) {
  const r = hash2(lx * 13 + lz * 7, h, SEED + 700);
  let trunk, leaves, th;
  switch (biome) {
    case 'FOREST':  trunk = r > 0.5 ? 'logDark' : 'log'; leaves = r > 0.5 ? 'leavesDark' : 'leaves'; th = 5 + (r * 5 | 0); break;
    case 'MOUNTAIN':
    case 'TUNDRA':  trunk = 'logDark'; leaves = 'leavesSnow'; th = 4 + (r * 3 | 0); break;
    case 'SWAMP':   trunk = 'logDead'; leaves = 'leavesDark'; th = 4 + (r * 3 | 0); break;
    case 'DESERT':  trunk = 'logDead'; leaves = null; th = 3 + (r * 2 | 0); break;   // árbol muerto
    default:        trunk = r > 0.7 ? 'logBirch' : 'log'; leaves = 'leaves'; th = 4 + (r * 3 | 0);
  }
  for (let i = 1; i <= th; i++) set(data, lx, h + i, lz, trunk);
  if (!leaves) return;
  const top = h + th;
  for (let dy = -2; dy <= 1; dy++) {
    const rad = dy === -2 || dy === 0 ? 2 : 1;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (dx === 0 && dz === 0 && dy <= 0) continue;
      if (Math.abs(dx) === rad && Math.abs(dz) === rad && hash2(lx + dx, lz + dz, SEED + dy) > 0.5) continue;
      if (get(data, lx + dx, top + dy, lz + dz) === 'air') set(data, lx + dx, top + dy, lz + dz, leaves);
    }
  }
  if (get(data, lx, top + 2, lz) === 'air') set(data, lx, top + 2, lz, leaves);
}

// ---------- Aldea medieval ----------
function buildVillage(data, cx, cz, v, props) {
  const r = mulberry32(v.seed);
  const baseX = v.x - cx * CHUNK, baseZ = v.z - cz * CHUNK;
  const nHouses = 3 + (r() * 4 | 0);
  props.structures.push({ type: 'village', x: v.x, z: v.z, seed: v.seed });
  for (let i = 0; i < nHouses; i++) {
    const hx = baseX + ((r() * 36 | 0) - 18), hz = baseZ + ((r() * 36 | 0) - 18);
    buildHouse(data, hx, hz, r, props, cx, cz);
  }
  // pozo central
  const { h } = columnData(v.x, v.z);
  const wx = baseX, wz = baseZ;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (Math.abs(dx) === 1 || Math.abs(dz) === 1) set(data, wx + dx, h + 1, wz + dz, 'cobble');
  }
  set(data, wx, h + 1, wz, 'water');
  set(data, wx - 1, h + 3, wz - 1, 'log'); set(data, wx + 1, h + 3, wz - 1, 'log');
  set(data, wx - 1, h + 3, wz + 1, 'log'); set(data, wx + 1, h + 3, wz + 1, 'log');
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) set(data, wx + dx, h + 4, wz + dz, 'planks');
  // campos de cultivo
  for (let f = 0; f < 2; f++) {
    const fx = baseX + ((r() * 30 | 0) - 15), fz = baseZ + ((r() * 30 | 0) - 15);
    const fh = columnData(cx * CHUNK + fx, cz * CHUNK + fz).h;
    for (let dx = 0; dx < 5; dx++) for (let dz = 0; dz < 4; dz++) {
      set(data, fx + dx, fh, fz + dz, 'farmland');
      if (dz === 2) set(data, fx + dx, fh, fz + dz, 'water');
      else if (r() > 0.3) props.crops.push({ x: cx * CHUNK + fx + dx, y: fh + 1, z: cz * CHUNK + fz + dz, stage: (r() * 4) | 0 });
    }
  }
  // antorchas del camino
  for (let t = 0; t < 4; t++) {
    const tx = baseX + ((r() * 24 | 0) - 12), tz = baseZ + ((r() * 24 | 0) - 12);
    const th = columnData(cx * CHUNK + tx, cz * CHUNK + tz).h;
    if (get(data, tx, th + 1, tz) === 'air') { set(data, tx, th + 1, tz, 'torch'); props.torches.push({ x: cx * CHUNK + tx + .5, y: th + 1.5, z: cz * CHUNK + tz + .5 }); }
  }
}

function buildHouse(data, hx, hz, r, props, cx, cz) {
  const w = 5 + (r() * 2 | 0), d = 5 + (r() * 2 | 0);
  const { h, biome } = columnData(cx * CHUNK + hx, cz * CHUNK + hz);
  const wall = biome === 'DESERT' ? 'sandstone' : biome === 'TUNDRA' || biome === 'MOUNTAIN' ? 'stoneBricks' : 'planks';
  const frame = biome === 'DESERT' ? 'sandstone' : 'log';
  const roof = r() > 0.5 ? 'planksDark' : 'straw';
  // cimientos
  for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) set(data, hx + dx, h, hz + dz, 'cobble');
  // paredes
  for (let y = 1; y <= 3; y++) {
    for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) {
      const edge = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
      if (!edge) { set(data, hx + dx, h + y, hz + dz, 'air'); continue; }
      const corner = (dx === 0 || dx === w - 1) && (dz === 0 || dz === d - 1);
      if (corner) set(data, hx + dx, h + y, hz + dz, frame);
      else if (y === 2 && ((dx === (w >> 1)) || (dz === (d >> 1))) && r() > 0.4) set(data, hx + dx, h + y, hz + dz, 'glass');
      else set(data, hx + dx, h + y, hz + dz, wall);
    }
  }
  // puerta
  const doorSide = r() > 0.5;
  if (doorSide) { set(data, hx + (w >> 1), h + 1, hz, 'air'); set(data, hx + (w >> 1), h + 2, hz, 'air'); }
  else { set(data, hx, h + 1, hz + (d >> 1), 'air'); set(data, hx, h + 2, hz + (d >> 1), 'air'); }
  // tejado a dos aguas
  for (let k = 0; k <= Math.ceil(w / 2); k++) {
    for (let dz = -1; dz <= d; dz++) {
      set(data, hx + k, h + 4 + k, hz + dz, roof);
      set(data, hx + w - 1 - k, h + 4 + k, hz + dz, roof);
    }
  }
  // antorcha interior + cofre ocasional
  set(data, hx + 1, h + 1, hz + 1, 'torch');
  props.torches.push({ x: cx * CHUNK + hx + 1.5, y: h + 1.6, z: cz * CHUNK + hz + 1.5 });
  if (r() > 0.55) props.chests.push({ x: cx * CHUNK + hx + w - 2, y: h + 1, z: cz * CHUNK + hz + d - 2, loot: 'village' });
  // aldeano de esta casa
  props.npcSpawns.push({ x: cx * CHUNK + hx + w / 2, y: h + 1, z: cz * CHUNK + hz + d / 2, home: { x: cx * CHUNK + hx + w / 2, y: h + 1, z: cz * CHUNK + hz + d / 2 } });
}

// ---------- Ruinas de antigua civilización ----------
function buildRuin(data, cx, cz, ru, props) {
  const r = mulberry32(ru.seed);
  const baseX = ru.x - cx * CHUNK, baseZ = ru.z - cz * CHUNK;
  const { h } = columnData(ru.x, ru.z);
  props.structures.push({ type: 'ruin', x: ru.x, z: ru.z, seed: ru.seed });
  // anillo de pilares rotos + piedra rúnica central
  const rad = 6 + (r() * 4 | 0);
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
    const px = Math.round(baseX + Math.cos(a) * rad), pz = Math.round(baseZ + Math.sin(a) * rad);
    const ph = 2 + (r() * 5 | 0);
    for (let y = 0; y <= ph; y++) set(data, px, h + y, pz, r() > 0.3 ? 'stoneBricks' : 'cobble');
    if (r() > 0.6) set(data, px, h + ph + 1, pz, 'runeStone');
  }
  // altar central
  set(data, baseX, h + 1, baseZ, 'runeStone');
  set(data, baseX + 1, h + 1, baseZ, 'stoneBricks'); set(data, baseX - 1, h + 1, baseZ, 'stoneBricks');
  set(data, baseX, h + 1, baseZ + 1, 'stoneBricks'); set(data, baseX, h + 1, baseZ - 1, 'stoneBricks');
  props.chests.push({ x: ru.x + 2, y: h + 1, z: ru.z + 2, loot: 'ruin' });
  // guardianes
  const n = 2 + (r() * 2 | 0);
  for (let i = 0; i < n; i++) props.mobSpawns.push({ type: 'skeleton', x: ru.x + (r() * 14 - 7), y: h + 1, z: ru.z + (r() * 14 - 7) });
  if (r() > 0.6) props.mobSpawns.push({ type: 'wraith', x: ru.x, y: h + 2, z: ru.z });
}

// ---------- Castillo abandonado ----------
function buildCastle(data, cx, cz, ca, props) {
  const r = mulberry32(ca.seed);
  const baseX = ca.x - cx * CHUNK, baseZ = ca.z - cz * CHUNK;
  const { h } = columnData(ca.x, ca.z);
  const W = 22, D = 22;
  props.structures.push({ type: 'castle', x: ca.x, z: ca.z, seed: ca.seed });
  // muralla con almenas
  for (let dx = -W / 2; dx <= W / 2; dx++) for (let dz = -D / 2; dz <= D / 2; dz++) {
    const edge = Math.abs(dx) === W / 2 || Math.abs(dz) === D / 2;
    if (!edge) continue;
    // puerta rota al sur
    if (dz === D / 2 && Math.abs(dx) <= 1) { set(data, baseX + dx, h + 1, baseZ + dz, 'air'); set(data, baseX + dx, h + 2, baseZ + dz, 'air'); set(data, baseX + dx, h + 3, baseZ + dz, 'air'); continue; }
    const wallH = 5 + (hash2(dx, dz, ca.seed) > 0.8 ? -2 : 0);   // secciones derruidas
    for (let y = 1; y <= wallH; y++) set(data, baseX + dx, h + y, baseZ + dz, 'stoneBricks');
    if (wallH > 3 && (dx + dz) % 2 === 0) set(data, baseX + dx, h + wallH + 1, baseZ + dz, 'stoneBricks'); // almena
  }
  // torres de esquina
  for (const [tx, tz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const th = 8 + (r() * 3 | 0);
      for (let y = 1; y <= th; y++) set(data, baseX + tx + dx, h + y, baseZ + tz + dz, 'stoneBricks');
      set(data, baseX + tx + dx, h + th + 1, baseZ + tz + dz, 'cobble');
    }
    if (r() > 0.5) { set(data, baseX + tx, h + 5, baseZ + tz, 'torch'); props.torches.push({ x: ca.x + tx + .5, y: h + 5.5, z: ca.z + tz + .5 }); }
  }
  // torreón central en ruinas
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
    const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3;
    const th = 7 + (hash2(dx * 3, dz * 5, ca.seed) * 5 | 0);
    for (let y = 1; y <= (edge ? th : 1); y++) {
      if (!edge && y === 1) set(data, baseX + dx, h + y, baseZ + dz, 'cobble');
      else set(data, baseX + dx, h + y, baseZ + dz, 'stoneBricks');
    }
  }
  // trono del guardián
  set(data, baseX, h + 2, baseZ - 2, 'obsidian');
  set(data, baseX, h + 3, baseZ - 2, 'goldBlock');
  props.chests.push({ x: ca.x - 2, y: h + 2, z: ca.z - 2, loot: 'castle' });
  props.chests.push({ x: ca.x + 2, y: h + 2, z: ca.z - 3, loot: 'castle' });
  // criaturas que lo habitan
  const mobs = ['skeleton', 'wraith', 'skeleton', 'spider'];
  for (let i = 0; i < 4 + (r() * 3 | 0); i++) {
    props.mobSpawns.push({ type: mobs[(r() * mobs.length) | 0], x: ca.x + (r() * 30 - 15), y: h + 1, z: ca.z + (r() * 30 - 15) });
  }
  props.mobSpawns.push({ type: 'boss', x: ca.x, y: h + 2, z: ca.z });
}

// ---------- Mazmorra procedural subterránea ----------
function buildDungeon(data, cx, cz, anchor, props) {
  const r = mulberry32(anchor.seed + 4242);
  const baseX = anchor.x - cx * CHUNK, baseZ = anchor.z - cz * CHUNK;
  const surfH = columnData(anchor.x, anchor.z).h;
  const dy = Math.max(6, surfH - 22);   // profundidad de la mazmorra
  props.structures.push({ type: 'dungeon', x: anchor.x, z: anchor.z, seed: anchor.seed });
  // escalera de caracol descendente
  let sx = baseX + 8, sz = baseZ + 8;
  for (let y = surfH; y >= dy + 2; y--) {
    const step = surfH - y;
    const ox = [1, 0, -1, 0][step % 4], oz = [0, 1, 0, -1][step % 4];
    set(data, sx + ox, y, sz + oz, 'air'); set(data, sx + ox, y + 1, sz + oz, 'air'); set(data, sx + ox, y + 2, sz + oz, 'air');
    set(data, sx, y - 1, sz, 'stoneBricks');
  }
  // entrada visible en superficie
  set(data, sx, surfH + 1, sz, 'runeStone');
  // habitaciones conectadas por pasillos
  const rooms = [];
  const nRooms = 3 + (r() * 3 | 0);
  let px = sx, pz = sz;
  for (let i = 0; i < nRooms; i++) {
    const rw = 5 + (r() * 4 | 0), rd = 5 + (r() * 4 | 0);
    const rx = Math.round(px + (r() * 14 - 7)), rz = Math.round(pz + (r() * 14 - 7));
    const ry = dy - (r() * 6 | 0);
    rooms.push({ x: rx, z: rz, y: ry, w: rw, d: rd });
    // excavar habitación
    for (let dx = 0; dx < rw; dx++) for (let dz = 0; dz < rd; dz++) for (let yy = 0; yy < 4; yy++) {
      set(data, rx + dx, ry + yy, rz + dz, yy === 3 ? 'stoneBricks' : 'air');
    }
    for (let dx = -1; dx <= rw; dx++) for (let dz = -1; dz <= rd; dz++) {
      set(data, rx + dx, ry - 1, rz + dz, 'stoneBricks');
      const edge = dx === -1 || dx === rw || dz === -1 || dz === rd;
      if (edge) for (let yy = 0; yy < 4; yy++) if (get(data, rx + dx, ry + yy, rz + dz) === 'air') set(data, rx + dx, ry + yy, rz + dz, 'stoneBricks');
    }
    // antorchas y hongos
    set(data, rx, ry, rz, 'torch');
    props.torches.push({ x: cx * CHUNK + rx + .5, y: ry + .6, z: cz * CHUNK + rz + .5 });
    if (r() > 0.5) set(data, rx + rw - 1, ry, rz + rd - 1, 'mushroom');
    // pasillo hacia la siguiente
    if (i > 0) {
      const prev = rooms[i - 1];
      carveCorridor(data, prev.x + (prev.w >> 1), prev.y, prev.z + (prev.d >> 1), rx + (rw >> 1), ry, rz + (rd >> 1));
    } else {
      carveCorridor(data, sx, dy + 1, sz, rx + (rw >> 1), ry, rz + (rd >> 1));
    }
    // enemigos de mazmorra
    const dm = ['skeleton', 'spider', 'wraith'];
    props.mobSpawns.push({ type: dm[(r() * 3) | 0], x: cx * CHUNK + rx + rw / 2, y: ry, z: cz * CHUNK + rz + rd / 2, dungeon: true });
    if (r() > 0.55) props.chests.push({ x: cx * CHUNK + rx + 1, y: ry, z: cz * CHUNK + rz + 1, loot: 'dungeon' });
    px = rx; pz = rz;
  }
  // sala del tesoro final
  const last = rooms[rooms.length - 1];
  if (last) {
    set(data, last.x + (last.w >> 1), last.y, last.z + (last.d >> 1), 'goldBlock');
    set(data, last.x + (last.w >> 1) + 1, last.y, last.z + (last.d >> 1), 'runeStone');
    props.chests.push({ x: cx * CHUNK + last.x + (last.w >> 1) - 1, y: last.y, z: cz * CHUNK + last.z + (last.d >> 1), loot: 'treasure' });
    props.mobSpawns.push({ type: 'wraith', x: cx * CHUNK + last.x + 1, y: last.y, z: cz * CHUNK + last.z + 1, dungeon: true });
  }
}

function carveCorridor(data, x0, y0, z0, x1, y1, z1) {
  let x = x0, y = y0, z = z0;
  let guard = 0;
  while ((x !== x1 || z !== z1 || y !== y1) && guard++ < 200) {
    for (let dy = 0; dy < 3; dy++) set(data, x, y + dy, z, 'air');
    set(data, x, y - 1, z, 'stoneBricks');
    if (x !== x1) x += Math.sign(x1 - x);
    else if (z !== z1) z += Math.sign(z1 - z);
    else if (y !== y1) y += Math.sign(y1 - y);
  }
}
