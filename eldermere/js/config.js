// ============ ELDERMERE — Configuración global ============
export const CONFIG = {
  SEED: 20260729,
  CHUNK: 16,            // bloques por lado del chunk
  WORLD_H: 88,          // altura máxima del mundo
  SEA_LEVEL: 20,        // nivel del mar
  RENDER_DIST: 6,       // chunks de radio de renderizado
  DAY_LENGTH: 560,      // segundos por día completo
  DAYS_PER_SEASON: 4,   // días por estación
  PLAYER: {
    HEIGHT: 1.72, WIDTH: 0.62, EYE: 1.58,
    WALK: 4.4, RUN: 7.2, JUMP: 8.4, GRAVITY: 23, SWIM: 3.2,
    REACH: 5.2, MOUNT_SPEED: 10.5,
  },
};

// ---------- Biomas ----------
export const BIOMES = {
  PLAINS:   { id: 0, name: 'Praderas de Aldoria',   top: 'grass',  sub: 'dirt',   tree: 0.028, flower: 0.03, rock: 'stone',   fogTint: 0xbfd4e8, grassHue: [0.26, 0.38, 0.32] },
  FOREST:   { id: 1, name: 'Bosque Umbrío',          top: 'grass',  sub: 'dirt',   tree: 0.085, flower: 0.02, rock: 'stone',   fogTint: 0x9db8a4, grassHue: [0.31, 0.45, 0.28] },
  MOUNTAIN: { id: 2, name: 'Picos del Lamento',      top: 'snow',   sub: 'stone',  tree: 0.012, flower: 0.0,  rock: 'stone',   fogTint: 0xcdd8e4, grassHue: [0.0, 0.0, 0.75] },
  SWAMP:    { id: 3, name: 'Pantano Ponzoñoso',      top: 'mud',    sub: 'mud',    tree: 0.045, flower: 0.01, rock: 'stone',   fogTint: 0x8a9a6a, grassHue: [0.22, 0.28, 0.25], water: 'waterSwamp' },
  DESERT:   { id: 4, name: 'Desierto de Ceniza',     top: 'sand',   sub: 'sand',   tree: 0.004, flower: 0.005, rock: 'sandstone', fogTint: 0xe8d9a8, grassHue: [0.12, 0.35, 0.55] },
  TUNDRA:   { id: 5, name: 'Tundra Helada',          top: 'snow',   sub: 'dirt',   tree: 0.015, flower: 0.0,  rock: 'iceRock', fogTint: 0xd8e4ec, grassHue: [0.0, 0.0, 0.8] },
};

// ---------- Bloques ----------
// face: [top, bottom, side] keys de textura; tool: herramienta ideal; hard: segundos base
export const BLOCKS = {
  air:        { id: 0,  solid: false },
  grass:      { id: 1,  name: 'Hierba',          tex: ['grassTop','dirt','grassSide'], tool: 'shovel', hard: 0.7, drop: 'dirt', icon: '🟩' },
  dirt:       { id: 2,  name: 'Tierra',          tex: ['dirt','dirt','dirt'],        tool: 'shovel', hard: 0.6, icon: '🟫' },
  stone:      { id: 3,  name: 'Piedra',          tex: ['stone','stone','stone'],     tool: 'pick',   hard: 1.7, drop: 'cobble', icon: '⬜' },
  cobble:     { id: 4,  name: 'Adoquín',         tex: ['cobble','cobble','cobble'],  tool: 'pick',   hard: 1.8, icon: '🔘', craft: true },
  sand:       { id: 5,  name: 'Arena',           tex: ['sand','sand','sand'],        tool: 'shovel', hard: 0.5, icon: '🟨' },
  sandstone:  { id: 6,  name: 'Arenisca',        tex: ['sandstoneTop','sandstoneTop','sandstone'], tool: 'pick', hard: 1.5, drop: 'sandstone', icon: '🟧' },
  snow:       { id: 7,  name: 'Nieve',           tex: ['snow','dirt','snowSide'],    tool: 'shovel', hard: 0.6, icon: '⬜' },
  mud:        { id: 8,  name: 'Lodo',            tex: ['mud','mud','mud'],           tool: 'shovel', hard: 0.7, icon: '🟤' },
  iceRock:    { id: 9,  name: 'Roca helada',     tex: ['iceRock','iceRock','iceRock'], tool: 'pick', hard: 1.9, drop: 'cobble', icon: '🧊' },
  log:        { id: 10, name: 'Tronco de roble', tex: ['logTop','logTop','logSide'], tool: 'axe',    hard: 1.4, icon: '🪵' },
  logDark:    { id: 11, name: 'Tronco oscuro',   tex: ['logDarkTop','logDarkTop','logDarkSide'], tool: 'axe', hard: 1.6, icon: '🌲' },
  logBirch:   { id: 12, name: 'Tronco de abedul',tex: ['logBirchTop','logBirchTop','logBirchSide'], tool: 'axe', hard: 1.2, icon: '🪵' },
  logDead:    { id: 13, name: 'Tronco muerto',   tex: ['logDeadTop','logDeadTop','logDeadSide'], tool: 'axe', hard: 1.5, icon: '🥀' },
  leaves:     { id: 14, name: 'Hojas',           tex: ['leaves','leaves','leaves'],  hard: 0.25, drop: null, icon: '🍃', translucent: true },
  leavesDark: { id: 15, name: 'Hojas oscuras',   tex: ['leavesDark','leavesDark','leavesDark'], hard: 0.25, drop: null, icon: '🍃', translucent: true },
  leavesSnow: { id: 16, name: 'Hojas nevadas',   tex: ['leavesSnow','leavesSnow','leavesSnow'], hard: 0.25, drop: null, icon: '❄️', translucent: true },
  planks:     { id: 17, name: 'Tablones',        tex: ['planks','planks','planks'],  tool: 'axe', hard: 1.2, icon: '🟫', craft: true },
  planksDark: { id: 18, name: 'Tablones oscuros',tex: ['planksDark','planksDark','planksDark'], tool: 'axe', hard: 1.3, icon: '🟤', craft: true },
  stoneBricks:{ id: 19, name: 'Ladrillos pétreos',tex: ['stoneBricks','stoneBricks','stoneBricks'], tool: 'pick', hard: 1.9, icon: '🧱', craft: true },
  glass:      { id: 20, name: 'Vidrio',          tex: ['glass','glass','glass'],     hard: 0.4, drop: null, icon: '🔲', transparent: true, craft: true },
  coalOre:    { id: 21, name: 'Veta de carbón',  tex: ['coalOre','coalOre','coalOre'], tool: 'pick', hard: 2.2, drop: 'item_coal', icon: '⚫', depth: 999 },
  ironOre:    { id: 22, name: 'Veta de hierro',  tex: ['ironOre','ironOre','ironOre'], tool: 'pick', hard: 2.6, drop: 'item_ironOre', icon: '🟠', depth: 40 },
  goldOre:    { id: 23, name: 'Veta de oro',     tex: ['goldOre','goldOre','goldOre'], tool: 'pick', hard: 3.0, drop: 'item_goldOre', icon: '🟡', depth: 24 },
  mithrilOre: { id: 24, name: 'Veta de mithril', tex: ['mithrilOre','mithrilOre','mithrilOre'], tool: 'pick', hard: 3.6, drop: 'item_mithrilOre', icon: '🔵', depth: 14 },
  crystalOre: { id: 25, name: 'Cristal arcano',  tex: ['crystalOre','crystalOre','crystalOre'], tool: 'pick', hard: 3.4, drop: 'item_crystal', icon: '💜', depth: 20 },
  water:      { id: 26, name: 'Agua',            tex: ['water','water','water'],     solid: false, liquid: true, transparent: true, icon: '💧' },
  waterSwamp: { id: 27, name: 'Agua ponzoñosa',  tex: ['waterSwamp','waterSwamp','waterSwamp'], solid: false, liquid: true, transparent: true, icon: '🤢' },
  lava:       { id: 28, name: 'Lava',            tex: ['lava','lava','lava'],        solid: false, liquid: true, icon: '🔥', light: 14 },
  farmland:   { id: 29, name: 'Tierra labrada',  tex: ['farmland','dirt','dirt'],    tool: 'shovel', hard: 0.6, drop: 'dirt', icon: '🌱', craft: true },
  torch:      { id: 30, name: 'Antorcha',        tex: ['torch','torch','torch'],     solid: false, hard: 0.1, icon: '🕯️', light: 13, cross: true },
  flower:     { id: 31, name: 'Flor silvestre',  tex: ['flower','flower','flower'],  solid: false, hard: 0.05, drop: null, icon: '🌸', cross: true },
  mushroom:   { id: 32, name: 'Hongo brillante', tex: ['mushroom','mushroom','mushroom'], solid: false, hard: 0.05, icon: '🍄', cross: true, light: 6 },
  cactus:     { id: 33, name: 'Cactus',          tex: ['cactusTop','cactusTop','cactus'], tool: 'axe', hard: 0.8, icon: '🌵' },
  obsidian:   { id: 34, name: 'Obsidiana',       tex: ['obsidian','obsidian','obsidian'], tool: 'pick', hard: 6.0, icon: '⬛' },
  brickRed:   { id: 35, name: 'Ladrillo rojo',   tex: ['brickRed','brickRed','brickRed'], tool: 'pick', hard: 1.9, icon: '🧱', craft: true },
  snowBlock:  { id: 36, name: 'Bloque de nieve', tex: ['snow','snow','snow'],        tool: 'shovel', hard: 0.6, icon: '🌨️', craft: true },
  ice:        { id: 37, name: 'Hielo',           tex: ['ice','ice','ice'],           tool: 'pick', hard: 0.8, drop: null, icon: '🧊', transparent: true },
  goldBlock:  { id: 38, name: 'Bloque de oro',   tex: ['goldBlock','goldBlock','goldBlock'], tool: 'pick', hard: 2.4, icon: '🌟', craft: true },
  mithrilBlock:{id: 39, name: 'Bloque de mithril',tex: ['mithrilBlock','mithrilBlock','mithrilBlock'], tool: 'pick', hard: 2.8, icon: '💠', craft: true },
  straw:      { id: 40, name: 'Paja',            tex: ['straw','straw','straw'],     tool: 'axe', hard: 0.5, icon: '🌾', craft: true },
  bone:       { id: 41, name: 'Huesos antiguos', tex: ['bone','bone','bone'],        tool: 'pick', hard: 1.2, icon: '🦴' },
  runeStone:  { id: 42, name: 'Piedra rúnica',   tex: ['runeStone','runeStone','runeStone'], tool: 'pick', hard: 2.2, icon: '🗿', light: 8 },
  bedrock:    { id: 43, name: 'Roca madre',      tex: ['bedrock','bedrock','bedrock'], unbreakable: true, icon: '⬛' },
  crop0:      { id: 44, name: 'Brote de trigo',  tex: ['crop0','crop0','crop0'], solid: false, hard: 0.05, drop: null, cross: true, icon: '🌱' },
  crop1:      { id: 45, name: 'Trigo joven',     tex: ['crop1','crop1','crop1'], solid: false, hard: 0.05, drop: null, cross: true, icon: '🌾' },
  crop2:      { id: 46, name: 'Trigo crecido',   tex: ['crop2','crop2','crop2'], solid: false, hard: 0.05, drop: null, cross: true, icon: '🌾' },
  crop3:      { id: 47, name: 'Trigo maduro',    tex: ['crop3','crop3','crop3'], solid: false, hard: 0.05, drop: null, cross: true, icon: '🌾' },
};

export const ID_TO_BLOCK = {};
for (const [k, b] of Object.entries(BLOCKS)) ID_TO_BLOCK[b.id] = k;

// ---------- Objetos (items) ----------
export const ITEMS = {
  item_coal:     { name: 'Carbón',            icon: '⚫' },
  item_ironOre:  { name: 'Mena de hierro',    icon: '🟠' },
  item_iron:     { name: 'Lingote de hierro', icon: '🔩' },
  item_goldOre:  { name: 'Mena de oro',       icon: '🟡' },
  item_gold:     { name: 'Lingote de oro',    icon: '🪙' },
  item_mithrilOre:{name: 'Mena de mithril',   icon: '🔵' },
  item_mithril:  { name: 'Lingote de mithril',icon: '💠' },
  item_crystal:  { name: 'Cristal arcano',    icon: '💜' },
  item_stick:    { name: 'Palo',              icon: '🥢' },
  item_leather:  { name: 'Cuero',             icon: '🟤' },
  item_herb:     { name: 'Hierba medicinal',  icon: '🌿' },
  item_seed:     { name: 'Semillas',          icon: '🌰' },
  item_wheat:    { name: 'Trigo',             icon: '🌾' },
  item_bread:    { name: 'Pan',               icon: '🍞', food: 30 },
  item_meat:     { name: 'Carne cruda',       icon: '🥩', food: 12 },
  item_meatCooked:{name: 'Carne asada',       icon: '🍖', food: 40 },
  item_bone:     { name: 'Hueso',             icon: '🦴' },
  item_ectoplasm:{ name: 'Ectoplasma',        icon: '👻' },
  item_rune:     { name: 'Runa antigua',      icon: '🗿' },
  item_apple:    { name: 'Manzana',           icon: '🍎', food: 15 },
  // Herramientas / armas (power = daño, speed = multiplicador de minería, tool = tipo)
  tool_pickWood:  { name: 'Pico de madera',   icon: '⛏️', tool: 'pick',   speed: 1.6, power: 2 },
  tool_pickStone: { name: 'Pico de piedra',   icon: '⛏️', tool: 'pick',   speed: 2.6, power: 3 },
  tool_pickIron:  { name: 'Pico de hierro',   icon: '⛏️', tool: 'pick',   speed: 4.2, power: 4 },
  tool_pickMithril:{name: 'Pico de mithril',  icon: '⛏️', tool: 'pick',   speed: 7.0, power: 6 },
  tool_axeWood:   { name: 'Hacha de madera',  icon: '🪓', tool: 'axe',    speed: 1.6, power: 3 },
  tool_axeIron:   { name: 'Hacha de hierro',  icon: '🪓', tool: 'axe',    speed: 4.0, power: 5 },
  tool_shovelIron:{ name: 'Pala de hierro',   icon: '🥄', tool: 'shovel', speed: 4.0, power: 2 },
  tool_hoe:       { name: 'Azada',            icon: '🌱', tool: 'hoe',    speed: 1.0, power: 1 },
  sword_wood:     { name: 'Espada de madera', icon: '🗡️', power: 5,  melee: true },
  sword_iron:     { name: 'Espada de hierro', icon: '⚔️', power: 9,  melee: true },
  sword_mithril:  { name: 'Espada de mithril',icon: '⚔️', power: 15, melee: true },
  bow:            { name: 'Arco de cazador',  icon: '🏹', power: 7,  ranged: true },
  crossbow:       { name: 'Ballesta pesada',  icon: '🎯', power: 14, ranged: true },
  arrow:          { name: 'Flechas',          icon: '➶' },
  potion_heal:    { name: 'Poción de vida',   icon: '🧪', potion: { hp: 45 } },
  potion_str:     { name: 'Poción de fuerza', icon: '🧫', potion: { str: 30 } },
  potion_swift:   { name: 'Poción de presteza',icon: '⚗️', potion: { swift: 30 } },
  item_saddle:    { name: 'Montura (silla)',  icon: '🐴' },
};

// ---------- Recetas ----------
export const RECIPES = [
  // Básico
  { id:'planks',      tab:'basic', out:{ block:'planks', n:4 },       req:{ log:1 } },
  { id:'planksDark',  tab:'basic', out:{ block:'planksDark', n:4 },   req:{ logDark:1 } },
  { id:'stick',       tab:'basic', out:{ item:'item_stick', n:4 },    req:{ planks:2 } },
  { id:'torch',       tab:'basic', out:{ block:'torch', n:4 },        req:{ item_stick:1, item_coal:1 } },
  { id:'pickWood',    tab:'basic', out:{ item:'tool_pickWood', n:1 }, req:{ planks:3, item_stick:2 } },
  { id:'axeWood',     tab:'basic', out:{ item:'tool_axeWood', n:1 },  req:{ planks:3, item_stick:2 } },
  { id:'swordWood',   tab:'basic', out:{ item:'sword_wood', n:1 },    req:{ planks:2, item_stick:1 } },
  { id:'hoe',         tab:'basic', out:{ item:'tool_hoe', n:1 },      req:{ planks:2, item_stick:2 } },
  { id:'arrow',       tab:'basic', out:{ item:'arrow', n:8 },         req:{ item_stick:2, item_coal:1 } },
  { id:'bread',       tab:'basic', out:{ item:'item_bread', n:1 },    req:{ item_wheat:3 } },
  // Forja (requiere piedra cerca = forja improvisada)
  { id:'cobble',      tab:'forge', out:{ block:'cobble', n:1 },       req:{ stone:1 } },
  { id:'stoneBricks', tab:'forge', out:{ block:'stoneBricks', n:4 },  req:{ stone:4 } },
  { id:'brickRed',    tab:'forge', out:{ block:'brickRed', n:2 },     req:{ stone:2, item_coal:1 } },
  { id:'iron',        tab:'forge', out:{ item:'item_iron', n:1 },     req:{ item_ironOre:1, item_coal:1 } },
  { id:'gold',        tab:'forge', out:{ item:'item_gold', n:1 },     req:{ item_goldOre:1, item_coal:1 } },
  { id:'mithril',     tab:'forge', out:{ item:'item_mithril', n:1 },  req:{ item_mithrilOre:1, item_coal:2 } },
  { id:'cookMeat',    tab:'forge', out:{ item:'item_meatCooked', n:1 }, req:{ item_meat:1, item_coal:1 } },
  { id:'pickStone',   tab:'forge', out:{ item:'tool_pickStone', n:1 }, req:{ cobble:3, item_stick:2 } },
  { id:'pickIron',    tab:'forge', out:{ item:'tool_pickIron', n:1 }, req:{ item_iron:3, item_stick:2 } },
  { id:'pickMithril', tab:'forge', out:{ item:'tool_pickMithril', n:1 }, req:{ item_mithril:3, item_stick:2 } },
  { id:'axeIron',     tab:'forge', out:{ item:'tool_axeIron', n:1 },  req:{ item_iron:3, item_stick:2 } },
  { id:'shovelIron',  tab:'forge', out:{ item:'tool_shovelIron', n:1 }, req:{ item_iron:1, item_stick:2 } },
  { id:'swordIron',   tab:'forge', out:{ item:'sword_iron', n:1 },    req:{ item_iron:2, item_stick:1 } },
  { id:'swordMithril',tab:'forge', out:{ item:'sword_mithril', n:1 }, req:{ item_mithril:2, item_stick:1, item_crystal:1 } },
  { id:'bow',         tab:'forge', out:{ item:'bow', n:1 },           req:{ item_stick:3, item_leather:2 } },
  { id:'crossbow',    tab:'forge', out:{ item:'crossbow', n:1 },      req:{ item_iron:3, item_stick:2, item_leather:1 } },
  { id:'saddle',      tab:'forge', out:{ item:'item_saddle', n:1 },   req:{ item_leather:4, item_iron:1 } },
  { id:'glass',       tab:'forge', out:{ block:'glass', n:2 },        req:{ sand:2, item_coal:1 } },
  { id:'goldBlock',   tab:'forge', out:{ block:'goldBlock', n:1 },    req:{ item_gold:4 } },
  { id:'mithrilBlock',tab:'forge', out:{ block:'mithrilBlock', n:1 }, req:{ item_mithril:4 } },
  // Alquimia
  { id:'potionHeal',  tab:'alchemy', out:{ item:'potion_heal', n:1 }, req:{ item_herb:2, mushroom:1 } },
  { id:'potionStr',   tab:'alchemy', out:{ item:'potion_str', n:1 },  req:{ item_herb:1, item_bone:1, crystalOre:0, item_crystal:1 } },
  { id:'potionSwift', tab:'alchemy', out:{ item:'potion_swift', n:1 }, req:{ item_herb:1, flower:2 } },
  { id:'runeStone',   tab:'alchemy', out:{ block:'runeStone', n:1 },  req:{ stone:2, item_crystal:1 } },
  { id:'ectoTorch',   tab:'alchemy', out:{ block:'torch', n:6 },      req:{ item_ectoplasm:1, item_stick:2 } },
  // Construcción
  { id:'farmland',    tab:'build', out:{ block:'farmland', n:1 },     req:{ dirt:1, tool_hoe:0 } },
  { id:'straw',       tab:'build', out:{ block:'straw', n:1 },        req:{ item_wheat:2 } },
  { id:'snowBlock',   tab:'build', out:{ block:'snowBlock', n:1 },    req:{ snow:1 } },
  { id:'sandstone',   tab:'build', out:{ block:'sandstone', n:1 },    req:{ sand:2 } },
];

// ---------- Facciones ----------
export const FACTIONS = {
  aldoria:  { name: 'Corona de Aldoria',   color: '#c9a227', desc: 'Los últimos herederos del viejo reino. Custodian las aldeas y el comercio. Desprecian la brujería del aquelarre.' },
  ashfang:  { name: 'Clan Colmillo de Ceniza', color: '#8a2323', desc: 'Guerreros de las montañas que veneran el fuego y la guerra. Respetan solo la fuerza demostrada en combate.' },
  veil:     { name: 'Aquelarre del Velo',  color: '#7a4bd0', desc: 'Eruditos arcanos que moran en las ruinas. Buscan los cristales y las runas de los Antiguos, a cualquier precio.' },
  wardens:  { name: 'Guardianes del Bosque', color: '#3f8a4e', desc: 'Protectores ancestrales de los bosques y las bestias. Odian la tala indiscriminada y la profanación de tumbas.' },
};

export const SEASONS = [
  { name: 'Primavera', icon: '🌱', fogMul: 1.0,  grassSat: 1.0,  grow: 1.0 },
  { name: 'Verano',    icon: '☀️', fogMul: 0.85, grassSat: 0.9,  grow: 1.4 },
  { name: 'Otoño',     icon: '🍂', fogMul: 1.1,  grassSat: 0.55, grow: 0.8 },
  { name: 'Invierno',  icon: '❄️', fogMul: 1.25, grassSat: 0.4,  grow: 0.4 },
];
