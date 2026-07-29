// ============================================================================
// Deterministic vegetation & decoration stamping (trees, grass tufts, cacti,
// palms). Uses world-space hashing so trees stay consistent across chunk
// borders without needing cross-chunk write-backs beyond a small padding.
// ============================================================================
import { BlockId } from './Blocks.js';
import { Biome, BiomeData } from './Biomes.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../core/Config.js';

function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

const PAD = 4;

export function decorateChunk(data, chunkX, chunkZ, terrainGen) {
  const size = CHUNK_SIZE;
  const idx = (x, y, z) => x + z * size + y * size * size;
  const inBounds = (x, y, z) => x >= 0 && x < size && z >= 0 && z < size && y >= 0 && y < CHUNK_HEIGHT;

  const setIfEmpty = (lx, ly, lz, block) => {
    if (!inBounds(lx, ly, lz)) return;
    const i = idx(lx, ly, lz);
    if (data[i] === BlockId.AIR) data[i] = block;
  };
  const setForce = (lx, ly, lz, block) => {
    if (!inBounds(lx, ly, lz)) return;
    data[idx(lx, ly, lz)] = block;
  };

  for (let wz = chunkZ * size - PAD; wz < chunkZ * size + size + PAD; wz++) {
    for (let wx = chunkX * size - PAD; wx < chunkX * size + size + PAD; wx++) {
      const { height, biome, isRiver } = terrainGen.getHeightAndBiome(wx, wz);
      if (isRiver) continue;
      const bd = BiomeData[biome];
      if (!bd || height <= 0 || height >= CHUNK_HEIGHT - 8) continue;
      const r = hash2(wx, wz, terrainGen.seed);
      const lx = wx - chunkX * size;
      const lz = wz - chunkZ * size;

      if (bd.treeChance > 0 && r < bd.treeChance) {
        const r2 = hash2(wx + 91, wz - 37, terrainGen.seed);
        if (bd.palm) {
          stampPalm(lx, height, lz, r2, setForce, setIfEmpty);
        } else if (bd.cactus) {
          stampCactus(lx, height, lz, r2, setForce);
        } else {
          stampTree(lx, height, lz, r2, bd.snow, setForce, setIfEmpty);
        }
      } else if (bd.grassTuft && r > 0.999 - bd.grassTuft * 0.02 && r < 1) {
        // sparse decorative crops-like grass tuft using CROP_0 as tuft visual (thin cross)
        const rr = hash2(wx - 55, wz + 12, terrainGen.seed);
        if (rr < 0.5) setIfEmpty(lx, height + 1, lz, BlockId.CROP_1);
      } else if (bd.swamp && r > 0.996) {
        setIfEmpty(lx, height + 1, lz, BlockId.PUMPKIN);
      }
    }
  }
}

function stampTree(lx, baseY, lz, r, snowy, setForce, setIfEmpty) {
  const trunkH = 4 + Math.floor(r * 3);
  const logType = BlockId.LOG;
  const leafType = BlockId.LEAVES;
  for (let i = 1; i <= trunkH; i++) setForce(lx, baseY + i, lz, logType);
  const topY = baseY + trunkH;
  const radius = 2;
  for (let dy = -2; dy <= 1; dy++) {
    const ringR = dy === 1 ? 1 : radius;
    for (let dx = -ringR; dx <= ringR; dx++) {
      for (let dz = -ringR; dz <= ringR; dz++) {
        if (Math.abs(dx) === ringR && Math.abs(dz) === ringR && ringR > 1) continue;
        if (dx === 0 && dz === 0 && dy < 1) continue;
        setIfEmpty(lx + dx, topY + dy, lz + dz, snowy ? BlockId.LEAVES : leafType);
      }
    }
  }
}

function stampPalm(lx, baseY, lz, r, setForce, setIfEmpty) {
  const trunkH = 5 + Math.floor(r * 3);
  for (let i = 1; i <= trunkH; i++) setForce(lx, baseY + i, lz, BlockId.PALM_LOG);
  const topY = baseY + trunkH;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (const [dx, dz] of dirs) {
    setIfEmpty(lx + dx, topY, lz + dz, BlockId.PALM_LEAVES);
    setIfEmpty(lx + dx * 2, topY, lz + dz * 2, BlockId.PALM_LEAVES);
  }
  setIfEmpty(lx, topY + 1, lz, BlockId.PALM_LEAVES);
}

function stampCactus(lx, baseY, lz, r, setForce) {
  const h = 1 + Math.floor(r * 3);
  for (let i = 1; i <= h; i++) setForce(lx, baseY + i, lz, BlockId.CACTUS);
}
