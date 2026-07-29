// ============================================================================
// Procedural structures: villages (with NPC spawn points), ruined castles
// inhabited by creatures, and underground procedural dungeons with loot
// chests. Uses a coarse deterministic grid ("structure cells") so each cell
// independently decides whether to host a structure, keeping generation
// consistent across chunk boundaries without needing global state.
// ============================================================================
import { BlockId } from './Blocks.js';
import { Biome } from './Biomes.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../core/Config.js';

const CELL_SIZE = 48; // world units per structure cell

function hash(x, z, salt) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

export class StructureGenerator {
  constructor(terrainGen) {
    this.terrainGen = terrainGen;
  }

  // Returns list of structure plans overlapping this chunk (may be centered outside chunk with padding)
  planForChunk(chunkX, chunkZ) {
    const plans = [];
    const chunkWorldX = chunkX * CHUNK_SIZE;
    const chunkWorldZ = chunkZ * CHUNK_SIZE;
    const minCellX = Math.floor((chunkWorldX - 24) / CELL_SIZE);
    const maxCellX = Math.floor((chunkWorldX + CHUNK_SIZE + 24) / CELL_SIZE);
    const minCellZ = Math.floor((chunkWorldZ - 24) / CELL_SIZE);
    const maxCellZ = Math.floor((chunkWorldZ + CHUNK_SIZE + 24) / CELL_SIZE);

    for (let cz = minCellZ; cz <= maxCellZ; cz++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const roll = hash(cx, cz, 91);
        const centerX = cx * CELL_SIZE + Math.floor(hash(cx, cz, 17) * (CELL_SIZE - 20)) + 10;
        const centerZ = cz * CELL_SIZE + Math.floor(hash(cx, cz, 29) * (CELL_SIZE - 20)) + 10;
        const { height, biome, isRiver } = this.terrainGen.getHeightAndBiome(centerX, centerZ);
        if (isRiver || height <= 0) continue;

        if (roll < 0.10 && (biome === Biome.PLAINS || biome === Biome.FOREST)) {
          plans.push({ type: 'village', x: centerX, z: centerZ, height, seed: hash(cx, cz, 5) });
        } else if (roll >= 0.10 && roll < 0.135 && biome === Biome.RUINS) {
          plans.push({ type: 'castle', x: centerX, z: centerZ, height, seed: hash(cx, cz, 7) });
        } else if (roll >= 0.135 && roll < 0.19 && height > 20) {
          plans.push({ type: 'dungeon', x: centerX, z: Math.min(height - 6, 30), height, seed: hash(cx, cz, 11), dz: centerZ });
        }
      }
    }
    return plans;
  }

  // Applies structures onto raw chunk data; returns spawn metadata array
  applyToChunk(data, chunkX, chunkZ) {
    const spawns = [];
    const plans = this.planForChunk(chunkX, chunkZ);
    const size = CHUNK_SIZE;
    const idx = (x, y, z) => x + z * size + y * size * size;
    const chunkWorldX = chunkX * size, chunkWorldZ = chunkZ * size;

    const setBlock = (wx, wy, wz, block) => {
      const lx = wx - chunkWorldX, lz = wz - chunkWorldZ;
      if (lx < 0 || lx >= size || lz < 0 || lz >= size || wy < 0 || wy >= CHUNK_HEIGHT) return;
      data[idx(lx, wy, lz)] = block;
    };
    const getBlockLocal = (wx, wy, wz) => {
      const lx = wx - chunkWorldX, lz = wz - chunkWorldZ;
      if (lx < 0 || lx >= size || lz < 0 || lz >= size || wy < 0 || wy >= CHUNK_HEIGHT) return null;
      return data[idx(lx, wy, lz)];
    };

    for (const plan of plans) {
      if (plan.type === 'village') {
        spawns.push(...this._stampVillage(plan, setBlock));
      } else if (plan.type === 'castle') {
        spawns.push(...this._stampCastle(plan, setBlock));
      } else if (plan.type === 'dungeon') {
        spawns.push(...this._stampDungeon(plan, setBlock));
      }
    }
    return spawns;
  }

  _stampVillage(plan, setBlock) {
    const spawns = [];
    const hutCount = 3 + Math.floor(plan.seed * 4);
    const baseY = plan.height;
    for (let i = 0; i < hutCount; i++) {
      const ang = (i / hutCount) * Math.PI * 2 + plan.seed * 3;
      const r = 6 + (i % 2) * 4;
      const hx = Math.round(plan.x + Math.cos(ang) * r);
      const hz = Math.round(plan.z + Math.sin(ang) * r);
      this._stampHut(hx, baseY, hz, setBlock);
      spawns.push({ type: 'villager', x: hx + 0.5, y: baseY + 1, z: hz + 0.5, home: [hx + 0.5, baseY + 1, hz + 0.5], work: [plan.x + 0.5, baseY + 1, plan.z + 0.5] });
    }
    // central well / plaza marker: torch ring
    for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
      setBlock(plan.x + dx, baseY + 1, plan.z + dz, BlockId.TORCH);
    }
    setBlock(plan.x, baseY, plan.z, BlockId.COBBLESTONE);
    spawns.push({ type: 'chest', x: plan.x + 0.5, y: baseY + 1, z: plan.z + 0.5 });
    return spawns;
  }

  _stampHut(x, y, z, setBlock) {
    const w = 5, d = 5, h = 3;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        setBlock(x + dx, y, z + dz, BlockId.PLANKS);
        if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
          for (let dy = 1; dy <= h; dy++) {
            const isDoor = dx === 0 && dz === -2 && dy <= 2;
            if (!isDoor) setBlock(x + dx, y + dy, z + dz, BlockId.LOG);
          }
        }
      }
    }
    // simple flat roof
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) setBlock(x + dx, y + h + 1, z + dz, BlockId.PLANKS);
    setBlock(x, y + h, z, BlockId.TORCH);
  }

  _stampCastle(plan, setBlock) {
    const spawns = [];
    const baseY = plan.height;
    const size = 9;
    for (let dx = -size; dx <= size; dx++) {
      for (let dz = -size; dz <= size; dz++) {
        const edge = Math.abs(dx) === size || Math.abs(dz) === size;
        if (edge) {
          const towerCorner = Math.abs(dx) === size && Math.abs(dz) === size;
          const wallH = towerCorner ? 7 : 5;
          for (let dy = 0; dy <= wallH; dy++) setBlock(plan.x + dx, baseY + dy, plan.z + dz, BlockId.CASTLE_BRICK);
        }
      }
    }
    // gate opening
    for (let dy = 0; dy <= 3; dy++) {
      setBlock(plan.x - 1, baseY + dy, plan.z + size, BlockId.AIR);
      setBlock(plan.x, baseY + dy, plan.z + size, BlockId.AIR);
      setBlock(plan.x + 1, baseY + dy, plan.z + size, BlockId.AIR);
    }
    // courtyard rubble + ruin stone floor
    for (let dx = -size + 1; dx <= size - 1; dx++) {
      for (let dz = -size + 1; dz <= size - 1; dz++) {
        setBlock(plan.x + dx, baseY, plan.z + dz, BlockId.RUIN_STONE);
      }
    }
    spawns.push({ type: 'hostile_group', kind: 'zombie_knight', count: 3, x: plan.x, y: baseY + 1, z: plan.z });
    spawns.push({ type: 'chest', x: plan.x + 0.5, y: baseY + 1, z: plan.z + 3.5, loot: 'castle' });
    return spawns;
  }

  _stampDungeon(plan, setBlock) {
    const spawns = [];
    const baseY = Math.max(6, plan.height);
    const cx = plan.x, cz = plan.dz;
    // hollow out a room
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        for (let dy = 0; dy <= 4; dy++) {
          const wall = Math.abs(dx) === 4 || Math.abs(dz) === 4;
          setBlock(cx + dx, baseY + dy, cz + dz, wall ? (dy === 0 || dy === 4 ? BlockId.MOSSY_STONE : BlockId.RUIN_STONE) : BlockId.AIR);
        }
      }
    }
    // corridor
    for (let i = 0; i <= 6; i++) {
      for (let dy = 0; dy <= 2; dy++) {
        setBlock(cx + 4 + i, baseY + dy, cz, BlockId.AIR);
      }
      setBlock(cx + 4 + i, baseY - 1, cz, BlockId.RUIN_STONE);
      setBlock(cx + 4 + i, baseY + 3, cz, BlockId.RUIN_STONE);
    }
    setBlock(cx, baseY - 1, cz, BlockId.BONE_BLOCK);
    setBlock(cx, baseY + 1, cz, BlockId.GLOWSTONE);
    spawns.push({ type: 'chest', x: cx + 0.5, y: baseY + 1, z: cz + 0.5, loot: 'dungeon' });
    spawns.push({ type: 'hostile_group', kind: 'dungeon_wraith', count: 2, x: cx, y: baseY + 1, z: cz });
    return spawns;
  }
}
