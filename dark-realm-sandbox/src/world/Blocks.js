// ============================================================================
// Block registry — Dark Realm Sandbox
// Defines every voxel block type, its rendering data and gameplay properties.
// ============================================================================

export const BlockId = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  SNOW: 5,
  WATER: 6,
  LOG: 7,
  LEAVES: 8,
  COAL_ORE: 9,
  IRON_ORE: 10,
  SILVER_ORE: 11,
  GOLD_ORE: 12,
  MITHRIL_ORE: 13,
  PLANKS: 14,
  COBBLESTONE: 15,
  TORCH: 16,
  FARMLAND: 17,
  CROP_0: 18,
  CROP_1: 19,
  CROP_2: 20,
  CROP_3: 21,
  CHEST: 22,
  WORKBENCH: 23,
  FORGE: 24,
  CAULDRON: 25,
  BEDROCK: 26,
  ICE: 27,
  MUD: 28,
  CACTUS: 29,
  PALM_LOG: 30,
  PALM_LEAVES: 31,
  GRAVEL: 32,
  CLAY: 33,
  MOSSY_STONE: 34,
  CASTLE_BRICK: 35,
  RUIN_STONE: 36,
  GLOWSTONE: 37,
  PUMPKIN: 38,
  BONE_BLOCK: 39,
  MITHRIL_BLOCK: 40,
};

// Tile coordinates inside the 8x8 texture atlas (col, row)
const T = (col, row) => ({ col, row });

export const Blocks = {
  [BlockId.AIR]: { name: 'Air', solid: false, transparent: true, liquid: false },
  [BlockId.GRASS]: {
    name: 'Grass', solid: true, transparent: false,
    top: T(0, 0), bottom: T(1, 0), side: T(2, 0), tint: true,
    hardness: 0.4, tool: 'shovel', drops: BlockId.DIRT,
  },
  [BlockId.DIRT]: { name: 'Dirt', solid: true, top: T(1, 0), bottom: T(1, 0), side: T(1, 0), hardness: 0.4, tool: 'shovel' },
  [BlockId.STONE]: { name: 'Stone', solid: true, top: T(3, 0), bottom: T(3, 0), side: T(3, 0), hardness: 1.5, tool: 'pickaxe', drops: BlockId.COBBLESTONE },
  [BlockId.SAND]: { name: 'Sand', solid: true, top: T(4, 0), bottom: T(4, 0), side: T(4, 0), hardness: 0.4, tool: 'shovel' },
  [BlockId.SNOW]: { name: 'Snow', solid: true, top: T(5, 0), bottom: T(1, 0), side: T(6, 0), hardness: 0.2, tool: 'shovel' },
  [BlockId.WATER]: { name: 'Water', solid: false, transparent: true, liquid: true, top: T(7, 0), side: T(7, 0) },
  [BlockId.LOG]: { name: 'Log', solid: true, top: T(0, 1), bottom: T(0, 1), side: T(1, 1), hardness: 1.0, tool: 'axe' },
  [BlockId.LEAVES]: { name: 'Leaves', solid: true, transparent: true, top: T(2, 1), bottom: T(2, 1), side: T(2, 1), tint: true, hardness: 0.2, tool: 'axe' },
  [BlockId.COAL_ORE]: { name: 'Coal Ore', solid: true, top: T(3, 1), side: T(3, 1), hardness: 1.8, tool: 'pickaxe', tier: 0, item: 'coal_ore' },
  [BlockId.IRON_ORE]: { name: 'Iron Ore', solid: true, top: T(4, 1), side: T(4, 1), hardness: 2.2, tool: 'pickaxe', tier: 1, item: 'iron_ore' },
  [BlockId.SILVER_ORE]: { name: 'Silver Ore', solid: true, top: T(5, 1), side: T(5, 1), hardness: 2.6, tool: 'pickaxe', tier: 2, item: 'silver_ore' },
  [BlockId.GOLD_ORE]: { name: 'Gold Ore', solid: true, top: T(6, 1), side: T(6, 1), hardness: 2.8, tool: 'pickaxe', tier: 2, item: 'gold_ore' },
  [BlockId.MITHRIL_ORE]: { name: 'Mithril Ore', solid: true, top: T(7, 1), side: T(7, 1), hardness: 3.6, tool: 'pickaxe', tier: 3, item: 'mithril_ore' },
  [BlockId.PLANKS]: { name: 'Planks', solid: true, top: T(0, 2), side: T(0, 2), hardness: 0.8, tool: 'axe' },
  [BlockId.COBBLESTONE]: { name: 'Cobblestone', solid: true, top: T(1, 2), side: T(1, 2), hardness: 1.6, tool: 'pickaxe' },
  [BlockId.TORCH]: { name: 'Torch', solid: false, transparent: true, top: T(2, 2), side: T(2, 2), light: 14, hardness: 0.1 },
  [BlockId.FARMLAND]: { name: 'Farmland', solid: true, top: T(3, 2), bottom: T(1, 0), side: T(1, 0), hardness: 0.3, tool: 'hoe' },
  [BlockId.CROP_0]: { name: 'Sprout', solid: false, transparent: true, top: T(4, 2), side: T(4, 2), cross: true, hardness: 0.1 },
  [BlockId.CROP_1]: { name: 'Sapling', solid: false, transparent: true, top: T(5, 2), side: T(5, 2), cross: true, hardness: 0.1 },
  [BlockId.CROP_2]: { name: 'Budding Wheat', solid: false, transparent: true, top: T(6, 2), side: T(6, 2), cross: true, hardness: 0.1 },
  [BlockId.CROP_3]: { name: 'Ripe Wheat', solid: false, transparent: true, top: T(7, 2), side: T(7, 2), cross: true, hardness: 0.1, drops: 'wheat', harvest: true },
  [BlockId.CHEST]: { name: 'Chest', solid: true, top: T(0, 3), side: T(1, 3), hardness: 0.6, tool: 'axe', interactive: 'chest' },
  [BlockId.WORKBENCH]: { name: 'Carpenter Bench', solid: true, top: T(2, 3), side: T(3, 3), hardness: 0.7, tool: 'axe', interactive: 'craft_building' },
  [BlockId.FORGE]: { name: 'Forge', solid: true, top: T(4, 3), side: T(5, 3), hardness: 2.0, tool: 'pickaxe', interactive: 'craft_forge', light: 10 },
  [BlockId.CAULDRON]: { name: 'Alchemy Cauldron', solid: true, top: T(6, 3), side: T(7, 3), hardness: 1.4, tool: 'pickaxe', interactive: 'craft_alchemy' },
  [BlockId.BEDROCK]: { name: 'Bedrock', solid: true, top: T(0, 4), side: T(0, 4), hardness: 999, unbreakable: true },
  [BlockId.ICE]: { name: 'Ice', solid: true, transparent: true, top: T(1, 4), side: T(1, 4), hardness: 0.5, tool: 'pickaxe', slippery: true },
  [BlockId.MUD]: { name: 'Mud', solid: true, top: T(2, 4), side: T(2, 4), hardness: 0.3, tool: 'shovel', slow: true },
  [BlockId.CACTUS]: { name: 'Cactus', solid: true, top: T(3, 4), side: T(3, 4), hardness: 0.4, tool: 'axe', damage: 1 },
  [BlockId.PALM_LOG]: { name: 'Palm Log', solid: true, top: T(0, 1), side: T(4, 4), hardness: 1.0, tool: 'axe' },
  [BlockId.PALM_LEAVES]: { name: 'Palm Leaves', solid: true, transparent: true, top: T(5, 4), side: T(5, 4), tint: true, hardness: 0.2, tool: 'axe' },
  [BlockId.GRAVEL]: { name: 'Gravel', solid: true, top: T(6, 4), side: T(6, 4), hardness: 0.6, tool: 'shovel' },
  [BlockId.CLAY]: { name: 'Clay', solid: true, top: T(7, 4), side: T(7, 4), hardness: 0.6, tool: 'shovel' },
  [BlockId.MOSSY_STONE]: { name: 'Mossy Stone', solid: true, top: T(0, 5), side: T(0, 5), hardness: 1.5, tool: 'pickaxe' },
  [BlockId.CASTLE_BRICK]: { name: 'Castle Brick', solid: true, top: T(1, 5), side: T(1, 5), hardness: 2.0, tool: 'pickaxe' },
  [BlockId.RUIN_STONE]: { name: 'Ruined Stone', solid: true, top: T(2, 5), side: T(2, 5), hardness: 1.3, tool: 'pickaxe' },
  [BlockId.GLOWSTONE]: { name: 'Glowstone', solid: true, top: T(3, 5), side: T(3, 5), hardness: 1.0, tool: 'pickaxe', light: 15 },
  [BlockId.PUMPKIN]: { name: 'Pumpkin', solid: true, top: T(4, 5), side: T(5, 5), hardness: 0.6, tool: 'axe' },
  [BlockId.BONE_BLOCK]: { name: 'Bone Pile', solid: true, top: T(6, 5), side: T(6, 5), hardness: 0.8, tool: 'pickaxe' },
  [BlockId.MITHRIL_BLOCK]: { name: 'Mithril Block', solid: true, top: T(7, 5), side: T(7, 5), hardness: 4.0, tool: 'pickaxe' },
};

export function isSolid(id) {
  const b = Blocks[id];
  return !!(b && b.solid);
}
export function isTransparent(id) {
  const b = Blocks[id];
  if (!b) return true;
  return !!b.transparent || id === BlockId.AIR;
}
export function isLiquid(id) {
  const b = Blocks[id];
  return !!(b && b.liquid);
}
export function getBlock(id) {
  return Blocks[id] || Blocks[BlockId.AIR];
}

export const ORE_BLOCKS = [BlockId.COAL_ORE, BlockId.IRON_ORE, BlockId.SILVER_ORE, BlockId.GOLD_ORE, BlockId.MITHRIL_ORE];
