// ============================================================================
// Biome definitions & selection — dark fantasy medieval world.
// Biome chosen from temperature / moisture / height noise fields.
// ============================================================================
import { BlockId } from './Blocks.js';

export const Biome = {
  OCEAN: 'ocean',
  BEACH: 'beach',
  PLAINS: 'plains',
  FOREST: 'forest',
  DENSE_FOREST: 'dense_forest',
  SNOW_MOUNTAINS: 'snow_mountains',
  TUNDRA: 'tundra',
  TOXIC_SWAMP: 'toxic_swamp',
  DESERT: 'desert',
  OASIS: 'oasis',
  RUINS: 'ruins',
};

export const BiomeData = {
  [Biome.OCEAN]: { name: 'Mar Sombrío', fogColor: 0x24455a, skyTint: 0x1f3a4a, top: BlockId.SAND, filler: BlockId.SAND, treeChance: 0 },
  [Biome.BEACH]: { name: 'Costa Salada', fogColor: 0x9fb6a8, skyTint: 0xcfe3d8, top: BlockId.SAND, filler: BlockId.SAND, treeChance: 0.001 },
  [Biome.PLAINS]: { name: 'Llanuras del Reino', fogColor: 0x8fae7d, skyTint: 0xbfe0c8, top: BlockId.GRASS, filler: BlockId.DIRT, treeChance: 0.006, grassTuft: 0.35 },
  [Biome.FOREST]: { name: 'Bosque Umbrío', fogColor: 0x5f7d4f, skyTint: 0x9fc0a0, top: BlockId.GRASS, filler: BlockId.DIRT, treeChance: 0.05, grassTuft: 0.25 },
  [Biome.DENSE_FOREST]: { name: 'Bosque Ancestral', fogColor: 0x3f5c37, skyTint: 0x6f8f6a, top: BlockId.GRASS, filler: BlockId.DIRT, treeChance: 0.14, grassTuft: 0.2 },
  [Biome.SNOW_MOUNTAINS]: { name: 'Cumbres Heladas', fogColor: 0xd8e6ec, skyTint: 0xe8f2f6, top: BlockId.SNOW, filler: BlockId.STONE, treeChance: 0.002, snow: true },
  [Biome.TUNDRA]: { name: 'Tundra Gélida', fogColor: 0xc7d6da, skyTint: 0xdbe8ec, top: BlockId.SNOW, filler: BlockId.DIRT, treeChance: 0.008, snow: true },
  [Biome.TOXIC_SWAMP]: { name: 'Pantano Ponzoñoso', fogColor: 0x3f4a34, skyTint: 0x556047, top: BlockId.MUD, filler: BlockId.MUD, treeChance: 0.03, swamp: true },
  [Biome.DESERT]: { name: 'Desierto Maldito', fogColor: 0xd8c07f, skyTint: 0xe8d79a, top: BlockId.SAND, filler: BlockId.SAND, treeChance: 0.0015, cactus: true },
  [Biome.OASIS]: { name: 'Oasis Perdido', fogColor: 0x8fc088, skyTint: 0xc8e6c0, top: BlockId.GRASS, filler: BlockId.SAND, treeChance: 0.05, palm: true },
  [Biome.RUINS]: { name: 'Ruinas Olvidadas', fogColor: 0x6a6a62, skyTint: 0x9a948a, top: BlockId.RUIN_STONE, filler: BlockId.STONE, treeChance: 0.005 },
};

export function pickBiome(temp, moisture, height, seaLevel, rng) {
  if (height < seaLevel - 1) return Biome.OCEAN;
  if (height < seaLevel + 1.5) return Biome.BEACH;
  if (temp < -0.35) return height > 0.35 ? Biome.SNOW_MOUNTAINS : Biome.TUNDRA;
  if (temp > 0.45) {
    if (moisture > 0.45) return Biome.OASIS;
    return Biome.DESERT;
  }
  if (moisture > 0.55) return Biome.TOXIC_SWAMP;
  if (moisture > 0.15) return height > 0.25 ? Biome.DENSE_FOREST : Biome.FOREST;
  if (rng && rng() < 0.004) return Biome.RUINS;
  return Biome.PLAINS;
}
