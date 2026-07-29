// ============ ELDERMERE — Sistemas: inventario, crafteo, agricultura, facciones, lore ============
import { BLOCKS, ITEMS, RECIPES, FACTIONS } from './config.js';

// ---------- Inventario ----------
export class Inventory {
  constructor(game) {
    this.game = game;
    this.slots = new Array(36).fill(null);      // { type:'block'|'item', key, n }
    this.hotSel = 0;
    // equipamiento inicial
    this.add('item', 'tool_pickWood', 1);
    this.add('item', 'tool_axeWood', 1);
    this.add('item', 'item_bread', 3);
    this.add('item', 'item_stick', 4);
    this.add('item', 'item_apple', 2);
    this.add('item', 'item_seed', 6);
  }
  def(entry) { return entry.type === 'block' ? BLOCKS[entry.key] : ITEMS[entry.key]; }
  heldEntry() { return this.slots[this.hotSel]; }
  add(type, key, n = 1) {
    const max = type === 'item' && ITEMS[key] && (ITEMS[key].tool || ITEMS[key].melee || ITEMS[key].ranged) ? 1 : 64;
    // apilar
    for (let i = 0; i < 36 && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.type === type && s.key === key && s.n < max) {
        const take = Math.min(n, max - s.n);
        s.n += take; n -= take;
      }
    }
    for (let i = 0; i < 36 && n > 0; i++) {
      if (!this.slots[i]) { const take = Math.min(n, max); this.slots[i] = { type, key, n: take }; n -= take; }
    }
    return n === 0;
  }
  count(type, key) {
    let n = 0;
    for (const s of this.slots) if (s && s.type === type && s.key === key) n += s.n;
    return n;
  }
  remove(type, key, n = 1) {
    for (let i = 0; i < 36 && n > 0; i++) {
      const s = this.slots[i];
      if (s && s.type === type && s.key === key) {
        const take = Math.min(n, s.n);
        s.n -= take; n -= take;
        if (s.n <= 0) this.slots[i] = null;
      }
    }
    return n === 0;
  }
  // para recetas: req puede mezclar bloques e items (con n=0 = herramienta necesaria no consumible)
  resolveReqKey(k) {
    if (BLOCKS[k]) return { type: 'block', key: k };
    if (ITEMS[k]) return { type: 'item', key: k };
    return null;
  }
}

// ---------- Crafteo ----------
export class Crafting {
  constructor(game) { this.game = game; }
  canCraft(recipe) {
    const inv = this.game.inventory;
    for (const [k, n] of Object.entries(recipe.req)) {
      if (n === 0) continue;                     // herramienta requerida: se comprueba aparte
      const r = inv.resolveReqKey(k);
      if (!r || inv.count(r.type, r.key) < n) return false;
    }
    for (const [k, n] of Object.entries(recipe.req)) {
      if (n !== 0) continue;
      const r = inv.resolveReqKey(k);
      if (r && inv.count(r.type, r.key) < 1) return false;
    }
    return true;
  }
  craft(recipe) {
    if (!this.canCraft(recipe)) return false;
    const inv = this.game.inventory;
    for (const [k, n] of Object.entries(recipe.req)) {
      if (n === 0) continue;
      const r = inv.resolveReqKey(k);
      inv.remove(r.type, r.key, n);
    }
    const out = recipe.out;
    if (out.block) inv.add('block', out.block, out.n);
    else inv.add('item', out.item, out.n);
    this.game.audio.sfx('craft');
    this.game.ui.refreshAll();
    const name = out.block ? BLOCKS[out.block].name : ITEMS[out.item].name;
    this.game.ui.message(`⚒ Has creado: ${name} ×${out.n}`);
    // hazañas
    if (recipe.tab === 'alchemy') this.game.quests.progress('alchemist', 1);
    if (recipe.tab === 'forge') this.game.quests.progress('smith', 1);
    return true;
  }
  recipesByTab(tab) { return RECIPES.filter((r) => r.tab === tab); }
}

// ---------- Agricultura ----------
// Los cultivos son bloques reales (crop0..crop3) sobre tierra labrada
export class Farming {
  constructor(game) {
    this.game = game;
    this.crops = new Map();       // "x,y,z" -> { t }
  }
  key(x, y, z) { return x + ',' + y + ',' + z; }
  stageOf(x, y, z) {
    const b = this.game.world.getBlock(x, y, z);
    return b && b.startsWith('crop') ? Number(b.slice(4)) : -1;
  }
  plant(x, y, z) {
    if (this.game.world.getBlock(x, y, z) !== 'air') return false;
    this.game.world.setBlock(x, y, z, 'crop0');
    this.crops.set(this.key(x, y, z), { t: 0 });
    return true;
  }
  register(x, y, z, stage) {
    this.game.world.setBlock(x, y, z, 'crop' + Math.min(3, stage));
    this.crops.set(this.key(x, y, z), { t: 0 });
  }
  update(dt, seasonGrow) {
    const p = this.game.player.pos;
    for (const [k, c] of this.crops) {
      const [x, y, z] = k.split(',').map(Number);
      if (Math.hypot(x - p.x, z - p.z) > 60) continue;
      const stage = this.stageOf(x, y, z);
      if (stage < 0 || this.game.world.getBlock(x, y - 1, z) !== 'farmland') { this.crops.delete(k); continue; }
      if (stage >= 3) continue;
      c.t += dt * seasonGrow;
      if (c.t > 50) { c.t = 0; this.game.world.setBlock(x, y, z, 'crop' + (stage + 1)); }
    }
  }
  // devuelve true si el bloque minado era un cultivo
  harvest(x, y, z) {
    const stage = this.stageOf(x, y, z);
    if (stage < 0) return false;
    this.crops.delete(this.key(x, y, z));
    if (stage >= 3) {
      this.game.inventory.add('item', 'item_wheat', 2 + (Math.random() * 2 | 0));
      this.game.inventory.add('item', 'item_seed', 1 + (Math.random() * 2 | 0));
      this.game.ui.message('🌾 Cosecha recogida: trigo y semillas');
      this.game.quests.progress('farmer', 1);
    } else {
      this.game.inventory.add('item', 'item_seed', 1);
    }
    return true;
  }
}

// ---------- Facciones y reputación ----------
export class FactionSystem {
  constructor(game) {
    this.game = game;
    this.rep = { aldoria: 10, ashfang: 0, veil: 0, wardens: 5 };
  }
  change(faction, amount, reason = '') {
    if (!this.rep.hasOwnProperty(faction)) return;
    this.rep[faction] = Math.max(-100, Math.min(100, this.rep[faction] + amount));
    const f = FACTIONS[faction];
    const sign = amount > 0 ? '+' : '';
    this.game.ui.message(`⚜ ${f.name}: ${sign}${amount} reputación ${reason ? '— ' + reason : ''}`);
    if (amount > 0) this.game.audio.sfx('rep');
  }
  title(faction) {
    const r = this.rep[faction];
    if (r >= 75) return 'Héroe jurado';
    if (r >= 40) return 'Aliado honorable';
    if (r >= 15) return 'Conocido';
    if (r > -15) return 'Neutral';
    if (r > -50) return 'Desconfiado';
    return 'Enemigo';
  }
}

// ---------- Hazañas (mini-quests) ----------
const QUEST_DEFS = [
  { id: 'firstNight', name: 'Sobrevivir a la primera noche', desc: 'Aguanta con vida hasta el amanecer del día 2.', target: 1 },
  { id: 'miner',      name: 'Vetas profundas',  desc: 'Extrae 20 minerales (carbón, hierro, oro…).', target: 20 },
  { id: 'smith',      name: 'Maestro de la forja', desc: 'Forja 8 objetos en la fragua.', target: 8 },
  { id: 'alchemist',  name: 'Secretos del Velo', desc: 'Prepara 3 pociones de alquimia.', target: 3 },
  { id: 'farmer',     name: 'Pan para el reino', desc: 'Cosecha 5 cultivos maduros.', target: 5 },
  { id: 'hunter',     name: 'Cazador de horrores', desc: 'Derrota 12 criaturas hostiles.', target: 12 },
  { id: 'rider',      name: 'Jinete de Eldermere', desc: 'Doma un caballo con manzanas y ensíllalo.', target: 1 },
  { id: 'delver',     name: 'El que desciende',  desc: 'Saquea 3 cofres de mazmorras o ruinas.', target: 3 },
  { id: 'boss',       name: 'Fin del Guardián',  desc: 'Derrota al Guardián de un castillo abandonado.', target: 1 },
];
export class QuestSystem {
  constructor(game) {
    this.game = game;
    this.state = {};
    for (const q of QUEST_DEFS) this.state[q.id] = { n: 0, done: false };
  }
  progress(id, n = 1) {
    const s = this.state[id];
    if (!s || s.done) return;
    s.n += n;
    const def = QUEST_DEFS.find((q) => q.id === id);
    if (s.n >= def.target) {
      s.done = true;
      this.game.ui.message(`📜 ¡Hazaña completada: ${def.name}!`);
      this.game.audio.sfx('quest');
      // recompensa de reputación general
      this.game.factions.change('aldoria', 5, 'por tu hazaña');
    }
  }
  list() { return QUEST_DEFS.map((q) => ({ ...q, ...this.state[q.id] })); }
}

// ---------- Lore interconectado ----------
export const LORE = [
  { title: 'La Caída de los Antiguos', text: 'Antes de los reinos, los Antiguos alzaron torres de piedra rúnica y dominaron el cristal arcano. Ambicionaron abrir el Velo entre mundos… y algo cruzó desde el otro lado. En una sola noche, sus ciudades quedaron en ruinas y su nombre fue borrado de las canciones.' },
  { title: 'La Guerra de los Dos Reinos', text: 'La Corona de Aldoria y el Clan Colmillo de Ceniza se disputan el valle desde hace tres generaciones. Aldoria reclama la herencia de los Antiguos; los Colmillo afirman que el fuego de sus forjas purificará la tierra maldita. Las aldeas pagan el precio de ambos.' },
  { title: 'El Aquelarre del Velo', text: 'Eruditos que estudian las ruinas prohibidas. Dicen buscar la forma de cerrar el Velo para siempre… pero sus enemigos susurran que desean abrirlo del todo. Pagan oro por cristales arcanos y ectoplasma de los espectros.' },
  { title: 'El Guardián de las Ruinas', text: 'En cada castillo abandonado mora un Guardián: un rey de antaño que no aceptó la muerte. Su corona rota aún brilla con maldición. Quien lo derrote reclamará sus tesoros de mithril… y liberará un alma atormentada.' },
  { title: 'Los Guardianes del Bosque', text: 'Ni aliados de la Corona ni del Clan. Protegen lo que queda de los bosques primigenios y las bestias que los habitan. Dicen que el bosque recuerda cada árbol caído… y que la tundra es su venganza helada.' },
  { title: 'Las Mazmorras de los Antiguos', text: 'Bajo aldeas y ruinas se abren escalinatas selladas con piedra rúnica. En lo profundo duermen salas del tesoro, hongos brillantes y horrores que nunca ven el sol. Los aldeanos las llaman "las bocas del mundo".' },
];
