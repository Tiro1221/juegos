// ============ ELDERMERE — Reinos de Ceniza — Bucle principal ============
import * as THREE from 'three';
import { CONFIG, BLOCKS, ITEMS, BIOMES } from './config.js';
import { buildTextureAtlas } from './textures.js';
import { World } from './world.js';
import { biomeAt } from './worldgen.js';
import { Sky } from './sky.js';
import { Player } from './player.js';
import { EntityManager } from './entities.js';
import { Inventory, Crafting, Farming, FactionSystem, QuestSystem } from './systems.js';
import { UI } from './ui.js';
import { GameAudio } from './audio.js';
import { Particles } from './particles.js';

const $ = (id) => document.getElementById(id);

// Colores de partículas por bloque
const PARTICLE_COLORS = {
  grass: 0x5d8f3e, dirt: 0x6d4c2c, stone: 0x7d7d7d, cobble: 0x6a6a6a, sand: 0xe0d29a,
  sandstone: 0xd6c78e, snow: 0xeef4f8, mud: 0x4e4230, iceRock: 0x9ec8de, ice: 0xbfe0f0,
  log: 0x8a6a42, logDark: 0x4e3a26, logBirch: 0xd8d0c0, logDead: 0x6a6058,
  leaves: 0x3f6b2a, leavesDark: 0x1e3a20, leavesSnow: 0xcfe0e8, planks: 0xa8845a,
  planksDark: 0x5e4630, stoneBricks: 0x7d7d7d, glass: 0xcfe8f0, coalOre: 0x3a3a3a,
  ironOre: 0xc88a5a, goldOre: 0xe8c84a, mithrilOre: 0x6ae0e8, crystalOre: 0xb06ae8,
  lava: 0xe85e2a, farmland: 0x4e3a24, torch: 0xffb43a, flower: 0xd84a6a, mushroom: 0x8a4bd0,
  cactus: 0x3a7a34, obsidian: 0x201630, brickRed: 0x9e4a34, straw: 0xd4b45a, bone: 0xd8d0bc,
  runeStone: 0x6ae0e8, goldBlock: 0xe8c84a, mithrilBlock: 0x8ad4dc, snowBlock: 0xeef4f8,
  crop0: 0x4f7a34, crop1: 0x5d8f3e, crop2: 0xb8a83e, crop3: 0xe0c46a, water: 0x2a5a9e, waterSwamp: 0x3a5a2e,
};

// Botín de cofres
const LOOT_TABLES = {
  village:  [['item', 'item_bread', 2, 4], ['item', 'item_seed', 2, 5], ['item', 'item_coal', 1, 4], ['item', 'arrow', 3, 8], ['item', 'item_leather', 1, 3], ['item', 'item_saddle', 1, 1, 0.2]],
  ruin:     [['item', 'item_crystal', 1, 2], ['item', 'item_gold', 1, 3], ['item', 'item_rune', 1, 1, 0.4], ['item', 'potion_heal', 1, 2], ['item', 'item_bone', 2, 4]],
  castle:   [['item', 'item_gold', 2, 4], ['item', 'item_mithril', 1, 2], ['item', 'potion_str', 1, 1], ['item', 'item_crystal', 1, 3], ['item', 'sword_iron', 1, 1, 0.3], ['item', 'crossbow', 1, 1, 0.25]],
  dungeon:  [['item', 'item_iron', 1, 3], ['item', 'potion_heal', 1, 2], ['item', 'item_gold', 1, 2], ['item', 'item_herb', 2, 4], ['item', 'arrow', 4, 10]],
  treasure: [['item', 'item_mithril', 2, 3], ['item', 'item_gold', 3, 5], ['item', 'item_crystal', 2, 3], ['item', 'sword_mithril', 1, 1, 0.4], ['item', 'item_rune', 1, 2], ['item', 'potion_swift', 1, 2]],
};

class Game {
  constructor() {
    this.pointerLocked = false;
    this.started = false;
    this.paused = false;
    this.tamedHorses = new Set();
    this.spawnPoint = new THREE.Vector3(8.5, 40, 8.5);
    this.biomeTimer = 0;
    this.curBiome = 'PLAINS';
    this.setupRenderer();
    this.setupWorld();
    this.bindInput();
    this.bindButtons();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
    this.simulateLoading();
  }

  // ---------- Render ----------
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // sombras suaves
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    $('game-container').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 600);
    this.scene.add(this.camera);
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }

  // ---------- Mundo ----------
  setupWorld() {
    const atlas = buildTextureAtlas();
    this.world = new World(this.scene, atlas);
    this.sky = new Sky(this.scene, this.camera);
    this.audio = new GameAudio();
    this.particles = new Particles(this.scene);
    this.inventory = new Inventory(this);
    this.crafting = new Crafting(this);
    this.farming = new Farming(this);
    this.factions = new FactionSystem(this);
    this.quests = new QuestSystem(this);
    this.ui = new UI(this);
    this.player = new Player(this.world, this.camera, this.scene);
    this.entities = new EntityManager(this.scene, this.world, this);
    // pre-generar chunks del spawn de forma sincrónica
    this.world.update(this.spawnPoint.x, this.spawnPoint.z, 999);
    let guard = 0;
    while (this.world.pendingProps.length === 0 && guard++ < 3) this.world.update(this.spawnPoint.x, this.spawnPoint.z, 999);
    this.consumeProps();
    const sy = this.world.surfaceHeight(8, 8) + 1;
    this.spawnPoint.set(8.5, sy + 1, 8.5);
    this.player.pos.copy(this.spawnPoint);
    // luces puntuales de antorchas cercanas al jugador (máx 6)
    this.torchLights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffa03a, 0, 11, 1.6);
      this.scene.add(l);
      this.torchLights.push(l);
    }
  }

  // consume props de chunks recién generados: NPCs, cofres, cultivos, mobs, antorchas
  consumeProps() {
    for (const props of this.world.pendingProps) {
      for (const n of props.npcSpawns) {
        const types = ['villager', 'villager', 'merchant', 'villager', 'sage', 'warden'];
        const e = this.entities.spawn(types[(Math.random() * types.length) | 0], n.x, n.y, n.z, n.x * 31 + n.z);
        if (e) e.home = n.home || { x: n.x, y: n.y, z: n.z };
      }
      for (const m of props.mobSpawns) this.entities.spawn(m.type, m.x + .5, m.y, m.z + .5, m.x * 7 + m.z);
      for (const c of props.crops) this.farming.register(c.x, c.y, c.z, c.stage);
      for (const ch of props.chests) this.registerChest(ch);
      for (const t of props.torches) this.registerTorch(t);
      for (const s of props.structures) this.announceStructure(s);
    }
    this.world.pendingProps.length = 0;
  }

  announceStructure(s) {
    const d = Math.hypot(s.x - this.player.pos.x, s.z - this.player.pos.z);
    if (d > 130) return;
    if (s.type === 'village') this.ui.message('🏘 Divisas una aldea en la distancia…');
    else if (s.type === 'ruin') this.ui.message('🗿 Ruinas de los Antiguos emergen entre la niebla…');
    else if (s.type === 'castle') this.ui.message('🏰 Un castillo abandonado se alza, habitado por criaturas…');
    else if (s.type === 'dungeon') this.ui.message('🕳 Una escalinata rúnica desciende a las bocas del mundo…');
  }

  // ---------- Cofres ----------
  registerChest(c) {
    if (!this.chestGroup) {
      this.chestGroup = new THREE.Group();
      this.scene.add(this.chestGroup);
      this.chestMap = new Map();
      this.chestGeo = new THREE.BoxGeometry(0.85, 0.6, 0.6);
      this.chestLidGeo = new THREE.BoxGeometry(0.85, 0.22, 0.6);
      this.chestMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
      this.chestLidMat = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
    }
    const key = c.x + ',' + c.y + ',' + c.z;
    if (this.chestMap.has(key)) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.chestGeo, this.chestMat);
    body.position.y = 0.3; body.castShadow = true;
    const lid = new THREE.Mesh(this.chestLidGeo, this.chestLidMat);
    lid.position.y = 0.68;
    g.add(body, lid);
    g.position.set(c.x + 0.5, c.y, c.z + 0.5);
    this.chestGroup.add(g);
    this.chestMap.set(key, { x: c.x, y: c.y, z: c.z, loot: c.loot, group: g, opened: false });
  }
  registerTorch(t) {
    if (!this.torchPoints) this.torchPoints = [];
    this.torchPoints.push(t);
  }
  nearestChest(pos, maxDist = 2.8) {
    if (!this.chestMap) return null;
    let best = null, bd = maxDist;
    for (const [, c] of this.chestMap) {
      if (c.opened) continue;
      const d = Math.hypot(c.x + .5 - pos.x, c.y - pos.y, c.z + .5 - pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  openChest(c) {
    c.opened = true;
    c.group.children[1].rotation.x = -1.1;   // tapa abierta
    this.audio.sfx('chest');
    const table = LOOT_TABLES[c.loot] || LOOT_TABLES.village;
    let found = [];
    for (const [type, key, min, max, chance] of table) {
      if (chance !== undefined && Math.random() > chance) continue;
      const n = min + (Math.random() * (max - min + 1) | 0);
      this.inventory.add(type, key, n);
      const def = type === 'block' ? BLOCKS[key] : ITEMS[key];
      found.push(`${def.icon || ''} ${def.name} ×${n}`);
    }
    this.ui.message(`🧰 Cofre abierto: ${found.join(', ') || 'vacío…'}`);
    if (c.loot === 'dungeon' || c.loot === 'ruin' || c.loot === 'treasure') this.quests.progress('delver', 1);
    if (c.loot === 'treasure') this.factions.change('veil', 6, 'por el tesoro de los Antiguos');
    this.ui.refreshAll();
  }

  // ---------- Input ----------
  bindInput() {
    const canvas = this.renderer.domElement;
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (!this.pointerLocked && this.started && !this.ui.openPanel && !this.player.dead) {
        this.paused = true;
        this.ui.open('pause');
      }
    });
    canvas.addEventListener('click', () => {
      if (this.started && !this.pointerLocked && !this.ui.openPanel) this.lockPointer();
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) this.player.look(e.movementX, e.movementY);
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.pointerLocked || !this.started) return;
      if (e.button === 0) this.onLeftClick();
      if (e.button === 2) this.onRightClick();
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.player.stopBreaking();
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', (e) => {
      this.player.keys[e.code] = true;
      if (!this.started) return;
      // hotbar
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) { this.inventory.hotSel = n - 1; this.ui.refreshHotbar(); }
      }
      if (e.code === 'KeyE') this.togglePanel('inventory');
      if (e.code === 'KeyC') this.togglePanel('crafting');
      if (e.code === 'KeyJ') this.togglePanel('journal');
      if (e.code === 'KeyF') this.interact();
      if (e.code === 'Escape') {
        if (this.ui.openPanel) { this.ui.closeAll(); this.paused = false; }
      }
    });
    addEventListener('keyup', (e) => { this.player.keys[e.code] = false; });
  }
  togglePanel(name) {
    if (this.ui.openPanel === name) { this.ui.closeAll(); this.paused = false; }
    else { this.ui.open(name); }
  }
  lockPointer() {
    this.renderer.domElement.requestPointerLock();
  }
  relockPointer() {
    if (this.started && !this.paused) setTimeout(() => this.lockPointer(), 60);
  }
  bindButtons() {
    $('btn-start').addEventListener('click', () => this.startGame());
    $('btn-resume').addEventListener('click', () => { this.paused = false; this.ui.closeAll(); });
    $('btn-help').addEventListener('click', () => this.ui.open('help'));
    $('btn-mute').addEventListener('click', () => {
      const m = this.audio.toggleMute();
      $('btn-mute').textContent = m ? '🔇 Sonido: OFF' : '🔊 Sonido: ON';
    });
  }

  // ---------- Inicio ----------
  startGame() {
    this.audio.init();
    this.started = true;
    $('title-screen').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.lockPointer();
    this.ui.message('⚔ Bienvenido a Eldermere. Sobrevive, forja, explora.');
    this.ui.message('💡 Pulsa J para leer las crónicas del mundo.');
    this.ui.refreshAll();
  }
  simulateLoading() {
    // breve pantalla de carga estética
    let p = 0;
    const iv = setInterval(() => {
      p += 25;
      $('loading-fill').style.width = Math.min(100, p) + '%';
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => $('loading-screen').classList.add('hidden'), 300);
      }
    }, 90);
  }

  // ---------- Clic izquierdo: minar / atacar ----------
  onLeftClick() {
    if (this.player.dead) return;
    // ataque a criatura cercana primero
    const target = this.entities.nearestHostile(this.player.pos, 2.6);
    if (target && this.player.attackCooldown <= 0) {
      const held = this.inventory.heldEntry();
      const item = held && held.type === 'item' ? ITEMS[held.key] : null;
      // arco / ballesta
      if (item && item.ranged) {
        if (this.inventory.count('item', 'arrow') >= 1) {
          this.inventory.remove('item', 'arrow', 1);
          this.player.attackCooldown = item === ITEMS.crossbow ? 0.9 : 0.55;
          const dir = this.player.forwardDir();
          this.entities.fireArrow(this.player.eyePos().addScaledVector(dir, 0.5), dir, item.power, this, true);
          this.player.swing = 1;
          this.ui.refreshAll();
          return;
        } else { this.ui.message('❌ No te quedan flechas. Fabrica más (C).'); return; }
      }
      // melee
      let dmg = 3;
      if (item && item.power) dmg = item.power;
      if (this.player.strBuff > 0) dmg *= 1.5;
      this.player.attackCooldown = 0.42;
      this.player.swing = 1;
      target.hurt(dmg, this, true);
      this.particles.emit(target.pos.x, target.pos.y + 1, target.pos.z, 0xc43b3b, 8, 2, 2.5);
      this.audio.sfx('enemyHit');
      return;
    }
    // arco sin objetivo: disparar igualmente
    const held = this.inventory.heldEntry();
    const item = held && held.type === 'item' ? ITEMS[held.key] : null;
    if (item && item.ranged && this.player.attackCooldown <= 0) {
      if (this.inventory.count('item', 'arrow') >= 1) {
        this.inventory.remove('item', 'arrow', 1);
        this.player.attackCooldown = item === ITEMS.crossbow ? 0.9 : 0.55;
        const dir = this.player.forwardDir();
        this.entities.fireArrow(this.player.eyePos().addScaledVector(dir, 0.5), dir, item.power, this, true);
        this.player.swing = 1;
        this.ui.refreshAll();
        return;
      }
      this.ui.message('❌ No te quedan flechas.');
      return;
    }
    // minar
    this.player.startBreaking();
    if (this.player.target) {
      const t = this.player.target;
      this.particles.emit(t.x + .5, t.y + .6, t.z + .5, PARTICLE_COLORS[t.block] || 0x888888, 3, 1.4, 1.4);
      this.audio.sfx('mine');
    }
  }

  mineBlock(x, y, z, blockKey) {
    // cultivo
    if (this.farming.harvest(x, y, z)) {
      this.world.setBlock(x, y, z, 'air');
      this.particles.emit(x + .5, y + .5, z + .5, 0xe0c46a, 10, 2, 2);
      this.audio.sfx('mine');
      this.ui.refreshAll();
      return;
    }
    const b = BLOCKS[blockKey];
    this.world.setBlock(x, y, z, 'air');
    this.particles.emit(x + .5, y + .5, z + .5, PARTICLE_COLORS[blockKey] || 0x888888, 16, 2.6, 3);
    this.audio.sfx('mine');
    // drop
    const drop = b.drop !== undefined ? b.drop : blockKey;
    if (drop) {
      if (BLOCKS[drop]) this.inventory.add('block', drop, 1);
      else if (ITEMS[drop]) this.inventory.add('item', drop, blockKey === 'coalOre' ? 1 + (Math.random() * 2 | 0) : 1);
    }
    // extras
    if (blockKey === 'flower' && Math.random() < 0.45) { this.inventory.add('item', 'item_herb', 1); this.ui.message('🌿 Recogiste una hierba medicinal'); }
    if (blockKey === 'leaves' && Math.random() < 0.08) { this.inventory.add('item', 'item_apple', 1); this.ui.message('🍎 ¡Una manzana cayó del árbol!'); }
    if (blockKey === 'bone') { this.inventory.add('item', 'item_bone', 1 + (Math.random() * 2 | 0)); }
    // reputación y hazañas
    if (blockKey.endsWith('Ore') || blockKey === 'coalOre') this.quests.progress('miner', 1);
    if (blockKey === 'log' || blockKey === 'logDark' || blockKey === 'logBirch') this.factions.change('wardens', -1, 'por talar');
    if (blockKey === 'runeStone') { this.inventory.add('item', 'item_rune', 1); this.factions.change('veil', 2, 'por la runa'); }
    this.ui.refreshAll();
  }

  // ---------- Clic derecho: colocar / usar ----------
  onRightClick() {
    if (this.player.dead) return;
    const held = this.inventory.heldEntry();
    if (!held) return;
    // comida
    if (held.type === 'item') {
      const item = ITEMS[held.key];
      if (item.food) {
        this.player.food = Math.min(100, this.player.food + item.food);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + item.food * 0.15);
        this.inventory.remove('item', held.key, 1);
        this.audio.sfx('eat');
        this.ui.message(`🍖 Comes ${item.name}. +${item.food} saciedad`);
        this.ui.refreshAll();
        return;
      }
      if (item.potion) {
        const p = item.potion;
        if (p.hp) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + p.hp); this.ui.message('🧪 La poción restaura tu vida'); }
        if (p.str) { this.player.strBuff = p.str; this.ui.message('🧫 ¡Sientes una fuerza sobrehumana! (+50% daño, 30s)'); }
        if (p.swift) { this.player.swiftBuff = p.swift; this.ui.message('⚗️ ¡Tus pies vuelan como el viento! (+35% velocidad, 30s)'); }
        this.inventory.remove('item', held.key, 1);
        this.audio.sfx('eat');
        this.ui.refreshAll();
        return;
      }
      // semillas sobre tierra labrada
      if (held.key === 'item_seed' && this.player.target) {
        const t = this.player.target;
        if (this.world.getBlock(t.x, t.y, t.z) === 'farmland' && this.farming.plant(t.x, t.y + 1, t.z)) {
          this.inventory.remove('item', 'item_seed', 1);
          this.audio.sfx('place');
          this.ui.message('🌱 Siembras semillas de trigo');
          this.ui.refreshAll();
          return;
        }
      }
      // azada: convertir tierra en tierra labrada
      if (held.key === 'tool_hoe' && this.player.target) {
        const t = this.player.target;
        const bk = this.world.getBlock(t.x, t.y, t.z);
        if (bk === 'grass' || bk === 'dirt') {
          this.world.setBlock(t.x, t.y, t.z, 'farmland');
          this.audio.sfx('place');
          this.particles.emit(t.x + .5, t.y + 1, t.z + .5, 0x6d4c2c, 8, 1.6, 1.6);
          this.ui.message('🌱 Labraste la tierra. Lista para sembrar.');
          return;
        }
      }
      // silla de montar: usar sobre caballo cercano
      if (held.key === 'item_saddle') {
        this.ui.message('🐴 Acércate a un caballo y pulsa F para ensillarlo.');
        return;
      }
      return; // otros items no se colocan
    }
    // colocar bloque
    const t = this.player.target;
    if (!t) return;
    const px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    const existing = BLOCKS[this.world.getBlock(px, py, pz)];
    if (existing && existing.solid !== false && !existing.liquid) return;
    // no colocar dentro del jugador
    const p = this.player.pos;
    if (px + 1 > p.x - 0.31 && px < p.x + 0.31 && pz + 1 > p.z - 0.31 && pz < p.z + 0.31 &&
        py < p.y + CONFIG.PLAYER.HEIGHT && py + 1 > p.y) return;
    this.world.setBlock(px, py, pz, held.key);
    this.inventory.remove('block', held.key, 1);
    this.audio.sfx('place');
    this.particles.emit(px + .5, py + .5, pz + .5, PARTICLE_COLORS[held.key] || 0xaaaaaa, 6, 1.4, 1.4);
    if (held.key === 'torch') this.registerTorch({ x: px + .5, y: py + .7, z: pz + .5 });
    this.player.swing = 1;
    this.ui.refreshAll();
  }

  // ---------- Interactuar (F): NPC, caballo, cofre ----------
  interact() {
    if (this.player.dead) return;
    // desmontar
    if (this.player.mount) {
      this.player.mount = null;
      this.ui.message('🐴 Desmontas del caballo.');
      return;
    }
    // cofre
    const chest = this.nearestChest(this.player.pos);
    if (chest) { this.openChest(chest); return; }
    // entidad interactuable
    const e = this.entities.nearestInteractable(this.player.pos, 3.2);
    if (!e) return;
    if (e.npcName) { this.ui.showDialog(e); return; }
    if (e.mountable) {
      if (!this.tamedHorses.has(e.id)) {
        // domesticar con manzana
        if (this.inventory.count('item', 'item_apple') >= 1) {
          this.inventory.remove('item', 'item_apple', 1);
          if (Math.random() < 0.65) {
            this.tamedHorses.add(e.id);
            this.audio.sfx('tame');
            this.ui.message('🐴 ¡El caballo confía en ti! Ahora ensíllalo (F con silla).');
            this.particles.emit(e.pos.x, e.pos.y + 1.4, e.pos.z, 0xff6a9e, 14, 2, 2.5);
          } else {
            this.ui.message('🐴 El caballo se resiste… dale otra manzana.');
            this.audio.sfx('hurt');
          }
        } else {
          this.ui.message('🐴 Caballo salvaje. Dómalo con una 🍎 manzana (F).');
        }
        this.ui.refreshAll();
        return;
      }
      // ya domado: montar si tienes silla
      if (this.inventory.count('item', 'item_saddle') >= 1) {
        this.player.mount = e;
        this.audio.sfx('tame');
        this.quests.progress('rider', 1);
        this.ui.message('🐴 ¡Ensillas y montas! Galopa con WASD.');
      } else {
        this.ui.message('🐴 Necesitas una silla de montar (fórjala o cómprala).');
      }
    }
  }

  // ---------- Muerte ----------
  onPlayerDeath(cause) {
    this.audio.sfx('bossRoar');
    $('fade-layer').style.opacity = 1;
    this.ui.message(`💀 Has caído por ${cause}…`, 6000);
    setTimeout(() => {
      this.player.respawn(this.spawnPoint);
      $('fade-layer').style.opacity = 0;
      this.ui.message('🕯 Despiertas junto al fuego de tu hogar. El mundo perdona… una vez.');
    }, 2600);
  }

  onEntityDeath(e, byPlayer) {
    this.particles.emit(e.pos.x, e.pos.y + 1, e.pos.z, e.hostile ? 0x8a2323 : 0xd8d0bc, 22, 3, 3.5);
    this.audio.sfx('enemyHit');
    if (!byPlayer) return;
    if (e.drops) {
      for (const [key, n] of e.drops) {
        this.inventory.add('item', key, n);
        const def = ITEMS[key];
        if (def) this.ui.message(`${def.icon} Recoges ${def.name} ×${n}`);
      }
    }
    if (e.hostile) {
      this.quests.progress('hunter', 1);
      this.factions.change('ashfang', 2, 'por tu valor en combate');
    }
    if (e.boss) {
      this.quests.progress('boss', 1);
      this.ui.message('👑 ¡EL GUARDIÁN HA CAÍDO! Un alma antigua queda libre…', 8000);
      this.audio.sfx('quest');
      this.factions.change('aldoria', 15, 'por liberar el castillo');
      this.factions.change('veil', 10, 'por romper la maldición');
    }
    this.ui.refreshAll();
  }

  // ---------- Prompt contextual ----------
  updatePrompt() {
    if (this.player.dead || this.ui.openPanel) { this.ui.setPrompt(null); return; }
    if (this.player.mount) { this.ui.setPrompt('[F] Desmontar'); return; }
    const chest = this.nearestChest(this.player.pos);
    if (chest) { this.ui.setPrompt('[F] Abrir cofre'); return; }
    const e = this.entities.nearestInteractable(this.player.pos, 3.2);
    if (e) {
      if (e.npcName) this.ui.setPrompt(`[F] Hablar con ${e.npcName}`);
      else if (e.mountable) this.ui.setPrompt(this.tamedHorses.has(e.id) ? '[F] Ensillar / Montar' : '[F] Domesticar (🍎 manzana)');
      return;
    }
    this.ui.setPrompt(null);
  }

  // ---------- Bucle principal ----------
  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clockDelta());
    if (!this.started) {
      // cámara de título orbitando el mundo
      const t = performance.now() * 0.00005;
      const cx = 8 + Math.cos(t) * 40, cz = 8 + Math.sin(t) * 40;
      this.camera.position.set(cx, this.world.surfaceHeight(Math.floor(cx), Math.floor(cz)) + 16, cz);
      this.camera.lookAt(8, this.world.surfaceHeight(8, 8) + 4, 8);
      this.world.update(this.camera.position.x, this.camera.position.z, 2);
      this.consumeProps();
      this.sky.update(dt, this.camera.position, this.curBiome);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.paused || (this.ui.openPanel && this.ui.openPanel !== 'dialog')) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const p = this.player.pos;
    this.world.update(p.x, p.z, 2);
    this.consumeProps();
    this.player.update(dt, this);
    this.entities.update(dt, this.sky);
    this.particles.update(dt);
    this.farming.update(dt, this.sky.seasonInfo.grow);

    // bioma actual
    this.biomeTimer -= dt;
    if (this.biomeTimer <= 0) {
      this.biomeTimer = 1.2;
      const bk = biomeAt(Math.floor(p.x), Math.floor(p.z));
      if (bk !== this.curBiome) {
        this.curBiome = bk;
        this.ui.message(`🧭 Entras en: ${BIOMES[bk].name}`);
      }
      this.ui.setBiome(BIOMES[this.curBiome].name);
      this.world.seasonSat = this.sky.seasonInfo.grassSat;
    }
    this.sky.update(dt, p, this.curBiome);

    // hazaña primera noche
    if (this.sky.dayCount >= 2 && this.sky.timeOfDay > 0.25 && this.sky.timeOfDay < 0.4) {
      this.quests.progress('firstNight', 1);
    }

    // audio
    const underground = p.y < CONFIG.SEA_LEVEL - 6 && !this.world.isLiquid(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
    this.audio.updateMusic(dt, this.sky.isNight, underground);
    this.audio.updateAmbient(dt, { isNight: this.sky.isNight, biome: this.curBiome, underground, weather: this.sky.weather });

    // luces de antorcha cercanas
    if (this.torchPoints) {
      const sorted = this.torchPoints
        .map((t) => ({ t, d: Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z) }))
        .filter((o) => o.d < 30)
        .sort((a, b) => a.d - b.d)
        .slice(0, this.torchLights.length);
      const flick = 0.9 + Math.sin(performance.now() * 0.01) * 0.1;
      for (let i = 0; i < this.torchLights.length; i++) {
        const l = this.torchLights[i];
        if (i < sorted.length) {
          l.position.set(sorted[i].t.x, sorted[i].t.y + 0.3, sorted[i].t.z);
          l.intensity = 1.5 * flick * (this.sky.isNight ? 1.4 : 0.9);
        } else l.intensity = 0;
      }
      // luz en la mano si sostiene antorcha
      const held = this.inventory.heldEntry();
      if (held && held.type === 'block' && held.key === 'torch') {
        this.sky.playerLight.intensity = 1.2 * flick;
        this.sky.playerLight.position.copy(this.player.eyePos());
      } else this.sky.playerLight.intensity = 0;
    }

    // agua: splash al entrar
    if (this.player.inWater && !this.wasInWater) this.audio.sfx('splash');
    this.wasInWater = this.player.inWater;

    this.updatePrompt();
    this.ui.refreshHUD();
    this.renderer.render(this.scene, this.camera);
  }

  clockDelta() {
    const now = performance.now();
    const dt = (now - (this._lastT || now)) / 1000;
    this._lastT = now;
    return dt;
  }
}

// ---------- Arranque ----------
new Game();
