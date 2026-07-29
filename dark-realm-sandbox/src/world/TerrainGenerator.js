// ============================================================================
// Procedural terrain generator: heightmaps, biomes, caves, ore veins,
// rivers, trees/vegetation placement and simple structure stamping
// (villages markers / ruin markers handled at a higher level).
// ============================================================================
import { Noise2D, Noise3D } from './Noise.js';
import { BlockId } from './Blocks.js';
import { Biome, BiomeData, pickBiome } from './Biomes.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, WORLD_SEED } from '../core/Config.js';

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TerrainGenerator {
  constructor(seed = WORLD_SEED) {
    this.seed = seed;
    this.heightNoise = new Noise2D(seed);
    this.detailNoise = new Noise2D(seed + 101);
    this.tempNoise = new Noise2D(seed + 202);
    this.moistureNoise = new Noise2D(seed + 303);
    this.riverNoise = new Noise2D(seed + 404);
    this.caveNoise = new Noise3D(seed + 505);
    this.caveNoise2 = new Noise3D(seed + 606);
    this.oreNoise = new Noise3D(seed + 707);
    this.mountainNoise = new Noise2D(seed + 808);
  }

  getHeightAndBiome(wx, wz) {
    const base = this.heightNoise.fbm(wx * 0.006, wz * 0.006, 5, 2.05, 0.52);
    const mountain = Math.max(0, this.mountainNoise.fbm(wx * 0.0025, wz * 0.0025, 4, 2, 0.5));
    const detail = this.detailNoise.fbm(wx * 0.02, wz * 0.02, 3, 2, 0.5) * 0.06;
    let h = base * 0.5 + mountain * mountain * 0.55 + detail; // -~0.6..1.1
    const temp = this.tempNoise.fbm(wx * 0.0015, wz * 0.0015, 3, 2, 0.5);
    const moisture = this.moistureNoise.fbm(wx * 0.002 + 500, wz * 0.002 + 500, 3, 2, 0.5);
    const river = Math.abs(this.riverNoise.fbm(wx * 0.004, wz * 0.004, 2, 2, 0.5));
    const rng = mulberry32(((wx * 928371) ^ (wz * 12457)) >>> 0);
    let biome = pickBiome(temp, moisture, h, 0, rng);

    let heightBlocks = Math.round(SEA_LEVEL + h * 34);
    // Carve navigable rivers through lowlands
    let isRiver = false;
    if (river < 0.035 && heightBlocks < SEA_LEVEL + 14 && heightBlocks > SEA_LEVEL - 6) {
      heightBlocks = SEA_LEVEL - 2;
      isRiver = true;
    }
    heightBlocks = Math.max(3, Math.min(CHUNK_HEIGHT - 8, heightBlocks));
    return { height: heightBlocks, biome, isRiver, temp, moisture };
  }

  // Cave carving using two 3D noise fields combined (worm-like caverns)
  isCave(wx, wy, wz) {
    if (wy < 4) return false;
    const n1 = this.caveNoise.fbm(wx * 0.045, wy * 0.06, wz * 0.045, 3, 2, 0.5);
    const n2 = this.caveNoise2.fbm(wx * 0.05, wy * 0.05, wz * 0.05, 2, 2, 0.5);
    const density = Math.abs(n1) + Math.abs(n2) * 0.6;
    const depthFactor = Math.max(0, 1 - wy / 70);
    return density < 0.045 + depthFactor * 0.02;
  }

  getOreAt(wx, wy, wz) {
    // Layer-based rarity: deeper -> rarer & more valuable
    const n = this.oreNoise.fbm(wx * 0.09, wy * 0.09, wz * 0.09, 2, 2, 0.5);
    const v = (n + 1) / 2; // 0..1
    if (wy > 60) return null;
    if (wy < 60 && wy > 44 && v > 0.93) return BlockId.COAL_ORE;
    if (wy <= 44 && wy > 26 && v > 0.935) return BlockId.IRON_ORE;
    if (wy <= 26 && wy > 14 && v > 0.945) return BlockId.SILVER_ORE;
    if (wy <= 26 && wy > 10 && v > 0.955) return BlockId.GOLD_ORE;
    if (wy <= 12 && v > 0.965) return BlockId.MITHRIL_ORE;
    if (wy <= 44 && wy > 20 && v > 0.9 && v <= 0.935) return BlockId.COAL_ORE;
    return null;
  }

  /**
   * Generates one full vertical column of blocks for world coords (wx, wz).
   * Returns { column: Uint8Array(CHUNK_HEIGHT), height, biome, isRiver }
   */
  generateColumn(wx, wz) {
    const { height, biome, isRiver } = this.getHeightAndBiome(wx, wz);
    const bd = BiomeData[biome];
    const column = new Uint8Array(CHUNK_HEIGHT);
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      let block = BlockId.AIR;
      if (y === 0) {
        block = BlockId.BEDROCK;
      } else if (y < height) {
        if (y > height - 1) block = bd.filler;
        else if (y > height - 4) block = bd.filler === BlockId.SAND ? BlockId.SAND : BlockId.DIRT;
        else block = BlockId.STONE;

        if (y < height - 3) {
          const ore = this.getOreAt(wx, y, wz);
          if (ore) block = ore;
        }
        if (this.isCave(wx, y, wz) && y < height - 1 && y > 2) {
          block = BlockId.AIR;
        }
      } else if (y === height) {
        block = isRiver ? BlockId.WATER : bd.top;
        if (bd.snow && !isRiver) block = BlockId.SNOW;
      } else if (y <= SEA_LEVEL && y > height) {
        block = BlockId.WATER;
      }
      column[y] = block;
    }
    return { column, height, biome, isRiver };
  }

  /**
   * Fills a flat Uint8Array of size CHUNK_SIZE^2 * CHUNK_HEIGHT with block ids.
   * index(x,y,z) = x + z*CHUNK_SIZE + y*CHUNK_SIZE*CHUNK_SIZE
   */
  generateChunkData(chunkX, chunkZ) {
    const size = CHUNK_SIZE;
    const data = new Uint8Array(size * size * CHUNK_HEIGHT);
    const heightMap = new Int16Array(size * size);
    const biomeMap = new Array(size * size);
    const idx = (x, y, z) => x + z * size + y * size * size;

    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const wx = chunkX * size + x;
        const wz = chunkZ * size + z;
        const { column, height, biome } = this.generateColumn(wx, wz);
        heightMap[x + z * size] = height;
        biomeMap[x + z * size] = biome;
        for (let y = 0; y < CHUNK_HEIGHT; y++) data[idx(x, y, z)] = column[y];
      }
    }

    return { data, heightMap, biomeMap, chunkX, chunkZ };
  }
}

export const terrainGen = new TerrainGenerator();
