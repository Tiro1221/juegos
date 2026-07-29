// ============================================================================
// Medieval technology tree recipes, split by crafting station:
//  - "hand"     : craftable anywhere (basic survival items)
//  - "carpentry": Carpenter's Bench (wood tools, building blocks, furniture)
//  - "forge"    : Forge (smelting ores -> ingots, metal tools/weapons/armor)
//  - "alchemy"  : Cauldron (potions from herbs/materials)
// ============================================================================

export const Recipes = [
  // --- Hand crafting ---
  { id: 'plank', station: 'hand', inputs: { wood: 1 }, output: { id: 'plank', count: 4 }, name: 'Tablones', icon: '🟫' },
  { id: 'torch', station: 'hand', inputs: { plank: 1, coal_ore: 1 }, output: { id: 'torch', count: 4 }, name: 'Antorcha', icon: '🔥' },
  { id: 'string_from_leather', station: 'hand', inputs: { leather: 1 }, output: { id: 'string', count: 2 }, name: 'Cuerda', icon: '🧵' },

  // --- Carpentry bench: tools, building, basic survival gear ---
  { id: 'workbench', station: 'hand', inputs: { plank: 5 }, output: { id: 'item_workbench', count: 1 }, name: 'Banco de Carpintero', icon: '🛠️' },
  { id: 'pickaxe_wood', station: 'carpentry', inputs: { plank: 3, wood: 2 }, output: { id: 'pickaxe_wood', count: 1 }, name: 'Piqueta de Madera', icon: '⛏️' },
  { id: 'axe_wood', station: 'carpentry', inputs: { plank: 3, wood: 2 }, output: { id: 'axe_wood', count: 1 }, name: 'Hacha de Madera', icon: '🪓' },
  { id: 'shovel_wood', station: 'carpentry', inputs: { plank: 2, wood: 2 }, output: { id: 'shovel_wood', count: 1 }, name: 'Pala de Madera', icon: '🧹' },
  { id: 'hoe_wood', station: 'carpentry', inputs: { plank: 2, wood: 2 }, output: { id: 'hoe_wood', count: 1 }, name: 'Azada', icon: '🌾' },
  { id: 'sword_wood', station: 'carpentry', inputs: { plank: 2, wood: 1 }, output: { id: 'sword_wood', count: 1 }, name: 'Espada de Madera', icon: '🗡️' },
  { id: 'bow', station: 'carpentry', inputs: { wood: 3, string: 3 }, output: { id: 'bow', count: 1 }, name: 'Arco', icon: '🏹' },
  { id: 'arrow', station: 'carpentry', inputs: { wood: 1, feather: 1, iron_ore: 1 }, output: { id: 'arrow', count: 4 }, name: 'Flechas', icon: '➹' },
  { id: 'crossbow', station: 'carpentry', inputs: { plank: 4, string: 2, iron_ingot: 2 }, output: { id: 'crossbow', count: 1 }, name: 'Ballesta', icon: '🏹' },
  { id: 'saddle', station: 'carpentry', inputs: { leather: 4, string: 2 }, output: { id: 'saddle', count: 1 }, name: 'Silla de Montar', icon: '🐴' },
  { id: 'chest', station: 'carpentry', inputs: { plank: 6 }, output: { id: 'item_chest', count: 1 }, name: 'Cofre', icon: '🧰' },

  // --- Forge: smelting + metal gear (requires coal as fuel implicitly) ---
  { id: 'forge_block', station: 'carpentry', inputs: { stone: 6, coal_ore: 2 }, output: { id: 'item_forge', count: 1 }, name: 'Forja', icon: '🔥' },
  { id: 'iron_ingot', station: 'forge', inputs: { iron_ore: 2, coal_ore: 1 }, output: { id: 'iron_ingot', count: 1 }, name: 'Fundir Hierro', icon: '🔧' },
  { id: 'silver_ingot', station: 'forge', inputs: { silver_ore: 2, coal_ore: 1 }, output: { id: 'silver_ingot', count: 1 }, name: 'Fundir Plata', icon: '🥈' },
  { id: 'gold_ingot', station: 'forge', inputs: { gold_ore: 2, coal_ore: 1 }, output: { id: 'gold_ingot', count: 1 }, name: 'Fundir Oro', icon: '🥇' },
  { id: 'mithril_ingot', station: 'forge', inputs: { mithril_ore: 3, coal_ore: 2 }, output: { id: 'mithril_ingot', count: 1 }, name: 'Fundir Mithril', icon: '🔷' },
  { id: 'pickaxe_iron', station: 'forge', inputs: { iron_ingot: 3, wood: 2 }, output: { id: 'pickaxe_iron', count: 1 }, name: 'Piqueta de Hierro', icon: '⛏️' },
  { id: 'axe_iron', station: 'forge', inputs: { iron_ingot: 3, wood: 2 }, output: { id: 'axe_iron', count: 1 }, name: 'Hacha de Hierro', icon: '🪓' },
  { id: 'sword_iron', station: 'forge', inputs: { iron_ingot: 2, wood: 1 }, output: { id: 'sword_iron', count: 1 }, name: 'Espada de Hierro', icon: '⚔️' },
  { id: 'armor_iron_chest', station: 'forge', inputs: { iron_ingot: 6 }, output: { id: 'armor_iron_chest', count: 1 }, name: 'Coraza de Hierro', icon: '🛡️' },
  { id: 'pickaxe_mithril', station: 'forge', inputs: { mithril_ingot: 3, wood: 2 }, output: { id: 'pickaxe_mithril', count: 1 }, name: 'Piqueta de Mithril', icon: '⛏️' },
  { id: 'sword_mithril', station: 'forge', inputs: { mithril_ingot: 2, wood: 1 }, output: { id: 'sword_mithril', count: 1 }, name: 'Espada de Mithril', icon: '🗡️' },
  { id: 'armor_mithril_chest', station: 'forge', inputs: { mithril_ingot: 6 }, output: { id: 'armor_mithril_chest', count: 1 }, name: 'Coraza de Mithril', icon: '🛡️' },

  // --- Alchemy cauldron: potions ---
  { id: 'cauldron_block', station: 'carpentry', inputs: { iron_ingot: 2, stone: 4 }, output: { id: 'item_cauldron', count: 1 }, name: 'Caldero Alquímico', icon: '⚗️' },
  { id: 'potion_heal', station: 'alchemy', inputs: { herb: 3, wheat: 1 }, output: { id: 'potion_heal', count: 1 }, name: 'Poción de Curación', icon: '🧪' },
  { id: 'potion_stamina', station: 'alchemy', inputs: { herb: 2, apple: 1 }, output: { id: 'potion_stamina', count: 1 }, name: 'Elixir de Vigor', icon: '⚗️' },
  { id: 'potion_warmth', station: 'alchemy', inputs: { herb: 2, coal_ore: 1 }, output: { id: 'potion_warmth', count: 1 }, name: 'Filtro de Calor', icon: '🍶' },

  // --- Cooking (hand, near forge conceptually but allowed anywhere for simplicity) ---
  { id: 'cooked_meat', station: 'forge', inputs: { raw_meat: 1, coal_ore: 1 }, output: { id: 'cooked_meat', count: 1 }, name: 'Carne Asada', icon: '🍖' },
  { id: 'bread', station: 'hand', inputs: { wheat: 3 }, output: { id: 'bread', count: 1 }, name: 'Pan', icon: '🍞' },

  // --- Building blocks ---
  { id: 'glowstone_lamp', station: 'carpentry', inputs: { gold_ore: 1, coal_ore: 1 }, output: { id: 'glowstone', count: 2 }, name: 'Lámpara Luminosa', icon: '✨' },
];

export function recipesFor(station) {
  return Recipes.filter(r => r.station === station);
}
