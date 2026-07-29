// ============================================================================
// Item definitions: raw materials, tools, weapons, armor, food, potions.
// Tool tiers gate which blocks can be efficiently mined (mirrors Blocks.js
// `tool` + `tier` metadata).
// ============================================================================
import { BlockId } from '../world/Blocks.js';

export const ItemType = { BLOCK: 'block', TOOL: 'tool', WEAPON: 'weapon', ARMOR: 'armor', FOOD: 'food', MATERIAL: 'material', POTION: 'potion' };

export const Items = {
  // --- raw materials ---
  wood: { name: 'Madera', type: ItemType.MATERIAL, icon: '🪵', stack: 64 },
  plank: { name: 'Tablón', type: ItemType.BLOCK, block: BlockId.PLANKS, icon: '🟫', stack: 64 },
  stone: { name: 'Piedra', type: ItemType.BLOCK, block: BlockId.COBBLESTONE, icon: '🪨', stack: 64 },
  dirt: { name: 'Tierra', type: ItemType.BLOCK, block: BlockId.DIRT, icon: '🟤', stack: 64 },
  sand: { name: 'Arena', type: ItemType.BLOCK, block: BlockId.SAND, icon: '🟨', stack: 64 },
  glowstone: { name: 'Piedra Luminosa', type: ItemType.BLOCK, block: BlockId.GLOWSTONE, icon: '✨', stack: 64 },
  coal_ore: { name: 'Carbón', type: ItemType.MATERIAL, icon: '⚫', stack: 64 },
  iron_ore: { name: 'Mineral de Hierro', type: ItemType.MATERIAL, icon: '🔘', stack: 64 },
  silver_ore: { name: 'Mineral de Plata', type: ItemType.MATERIAL, icon: '⬜', stack: 64 },
  gold_ore: { name: 'Mineral de Oro', type: ItemType.MATERIAL, icon: '🟡', stack: 64 },
  mithril_ore: { name: 'Mineral de Mithril', type: ItemType.MATERIAL, icon: '💠', stack: 64 },
  iron_ingot: { name: 'Lingote de Hierro', type: ItemType.MATERIAL, icon: '🔧', stack: 64 },
  silver_ingot: { name: 'Lingote de Plata', type: ItemType.MATERIAL, icon: '🥈', stack: 64 },
  gold_ingot: { name: 'Lingote de Oro', type: ItemType.MATERIAL, icon: '🥇', stack: 64 },
  mithril_ingot: { name: 'Lingote de Mithril', type: ItemType.MATERIAL, icon: '🔷', stack: 64 },
  wheat: { name: 'Trigo', type: ItemType.MATERIAL, icon: '🌾', stack: 64 },
  seeds: { name: 'Semillas', type: ItemType.MATERIAL, icon: '🌱', stack: 64 },
  herb: { name: 'Hierba Alquímica', type: ItemType.MATERIAL, icon: '🍃', stack: 64 },
  bone: { name: 'Hueso', type: ItemType.MATERIAL, icon: '🦴', stack: 64 },
  leather: { name: 'Cuero', type: ItemType.MATERIAL, icon: '🟫', stack: 64 },
  string: { name: 'Cuerda', type: ItemType.MATERIAL, icon: '🧵', stack: 64 },
  feather: { name: 'Pluma', type: ItemType.MATERIAL, icon: '🪶', stack: 64 },
  torch: { name: 'Antorcha', type: ItemType.BLOCK, block: BlockId.TORCH, icon: '🔥', stack: 64 },

  // --- food ---
  bread: { name: 'Pan', type: ItemType.FOOD, icon: '🍞', stack: 16, hunger: 22 },
  apple: { name: 'Manzana', type: ItemType.FOOD, icon: '🍎', stack: 16, hunger: 10 },
  cooked_meat: { name: 'Carne Asada', type: ItemType.FOOD, icon: '🍖', stack: 16, hunger: 26 },
  raw_meat: { name: 'Carne Cruda', type: ItemType.FOOD, icon: '🥩', stack: 16, hunger: 6 },

  // --- potions ---
  potion_heal: { name: 'Poción de Curación', type: ItemType.POTION, icon: '🧪', stack: 8, heal: 40 },
  potion_stamina: { name: 'Elixir de Vigor', type: ItemType.POTION, icon: '⚗️', stack: 8, stamina: 60 },
  potion_warmth: { name: 'Filtro de Calor', type: ItemType.POTION, icon: '🍶', stack: 8, warmth: 60 },

  // --- tools (tiers: 0 wood,1 stone,2 iron,3 mithril) ---
  pickaxe_wood: { name: 'Piqueta de Madera', type: ItemType.TOOL, tool: 'pickaxe', tier: 0, icon: '⛏️', stack: 1, durability: 60 },
  pickaxe_stone: { name: 'Piqueta de Piedra', type: ItemType.TOOL, tool: 'pickaxe', tier: 1, icon: '⛏️', stack: 1, durability: 130 },
  pickaxe_iron: { name: 'Piqueta de Hierro', type: ItemType.TOOL, tool: 'pickaxe', tier: 2, icon: '⛏️', stack: 1, durability: 250 },
  pickaxe_mithril: { name: 'Piqueta de Mithril', type: ItemType.TOOL, tool: 'pickaxe', tier: 3, icon: '⛏️', stack: 1, durability: 600 },
  axe_wood: { name: 'Hacha de Madera', type: ItemType.TOOL, tool: 'axe', tier: 0, icon: '🪓', stack: 1, durability: 60 },
  axe_iron: { name: 'Hacha de Hierro', type: ItemType.TOOL, tool: 'axe', tier: 2, icon: '🪓', stack: 1, durability: 250 },
  shovel_wood: { name: 'Pala de Madera', type: ItemType.TOOL, tool: 'shovel', tier: 0, icon: '🧹', stack: 1, durability: 60 },
  hoe_wood: { name: 'Azada', type: ItemType.TOOL, tool: 'hoe', tier: 0, icon: '🌾', stack: 1, durability: 60 },

  // --- weapons ---
  sword_wood: { name: 'Espada de Madera', type: ItemType.WEAPON, icon: '🗡️', stack: 1, damage: 4, durability: 60 },
  sword_iron: { name: 'Espada de Hierro', type: ItemType.WEAPON, icon: '⚔️', stack: 1, damage: 8, durability: 250 },
  sword_mithril: { name: 'Espada de Mithril', type: ItemType.WEAPON, icon: '🗡️', stack: 1, damage: 14, durability: 600 },
  bow: { name: 'Arco', type: ItemType.WEAPON, ranged: true, icon: '🏹', stack: 1, damage: 6, durability: 200 },
  crossbow: { name: 'Ballesta', type: ItemType.WEAPON, ranged: true, icon: '🏹', stack: 1, damage: 10, durability: 300 },
  arrow: { name: 'Flecha', type: ItemType.MATERIAL, icon: '➹', stack: 64 },

  // --- armor ---
  armor_leather_chest: { name: 'Pechera de Cuero', type: ItemType.ARMOR, slot: 'chest', icon: '🥼', armor: 3 },
  armor_iron_chest: { name: 'Coraza de Hierro', type: ItemType.ARMOR, slot: 'chest', icon: '🛡️', armor: 6 },
  armor_mithril_chest: { name: 'Coraza de Mithril', type: ItemType.ARMOR, slot: 'chest', icon: '🛡️', armor: 10 },

  // --- misc / building ---
  saddle: { name: 'Silla de Montar', type: ItemType.MATERIAL, icon: '🐴', stack: 4 },

  // --- placeable crafting stations ---
  item_workbench: { name: 'Banco de Carpintero', type: ItemType.BLOCK, block: BlockId.WORKBENCH, icon: '🛠️', stack: 4 },
  item_chest: { name: 'Cofre', type: ItemType.BLOCK, block: BlockId.CHEST, icon: '🧰', stack: 4 },
  item_forge: { name: 'Forja', type: ItemType.BLOCK, block: BlockId.FORGE, icon: '🔥', stack: 4 },
  item_cauldron: { name: 'Caldero Alquímico', type: ItemType.BLOCK, block: BlockId.CAULDRON, icon: '⚗️', stack: 4 },
};

export function getItem(id) { return Items[id]; }
