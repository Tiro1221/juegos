// ============================================================================
// Dark Realm — Reinos en Sombra
// Main entry point: bootstraps renderer, world, player, systems, UI and the
// main game loop. Designed to run smoothly on both desktop and mobile.
// ============================================================================
import * as THREE from 'three';
import { World } from './world/World.js';
import { Player } from './entities/Player.js';
import { InputManager } from './core/InputManager.js';
import { SkySystem } from './systems/SkySystem.js';
import { Interaction } from './systems/Interaction.js';
import { Inventory } from './systems/Inventory.js';
import { getItem } from './systems/Items.js';
import { FarmingSystem } from './systems/Farming.js';
import { MobManager } from './systems/MobManager.js';
import { MountSystem } from './systems/MountSystem.js';
import { FactionSystem, FactionId } from './systems/Factions.js';
import { generateLoot } from './systems/Loot.js';
import { AudioSystem } from './audio/AudioSystem.js';
import { HUD } from './ui/HUD.js';
import { MenuManager } from './ui/MenuManager.js';
import { BlockId, getBlock } from './world/Blocks.js';
import { isMobile, RENDER_DISTANCE, RENDER_DISTANCE_MOBILE, DAY_LENGTH_SECONDS } from './core/Config.js';
import { MobKind } from './entities/Mob.js';

const MOBILE = isMobile();
const SAVE_KEY = 'dark_realm_save_v1';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.clock = new THREE.Clock();
    this.paused = true;
    this.started = false;
    this.chestStorage = new Map(); // "x,y,z" -> {items}

    this._initRenderer();
    this._initScene();
    this._initWorldAndPlayer();
    this._initSystems();
    this._initUI();
    this._initInput();
    this._bindGlobalKeys();
    this._bindWindowResize();

    this._loadingProgress();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(MOBILE ? 78 : 72, window.innerWidth / window.innerHeight, 0.05, 600);
  }

  _initWorldAndPlayer() {
    const renderDist = MOBILE ? RENDER_DISTANCE_MOBILE : RENDER_DISTANCE;
    this.world = new World(this.scene, renderDist);
    this.player = new Player(this.world, this.camera);
  }

  _initSystems() {
    this.sky = new SkySystem(this.scene, this.renderer);
    this.inventory = new Inventory();
    this.hud = new HUD();
    this.interaction = new Interaction(this.world, this.player, this.camera, this.inventory, this.hud);
    this.farming = new FarmingSystem(this.world, DAY_LENGTH_SECONDS);
    this.factions = new FactionSystem();
    this.mobs = new MobManager(this.world, this.player, this.factions);
    this.mount = new MountSystem(this.world, this.player);
    this.audio = new AudioSystem();

    this.interaction.onOpenStation = (type, target) => this._handleStationOpen(type, target);
    this.interaction.onHarvest = (t) => this.farming.unregisterPlant(t.x, t.y, t.z);

    this.mobs.onPlayerHit = (dmg, mob) => {
      const armor = this.inventory.getArmorTotal();
      const reduced = Math.max(1, dmg - armor * 0.4);
      this.player.damage(reduced, 'mob');
      this.audio.playHurt();
    };
    this.mobs.onMobKilled = (mob) => {
      this.audio.playHit();
      this._grantKillLoot(mob);
    };

    this.world.onBlockChange((wx, wy, wz, block) => {
      if (block === BlockId.FARMLAND) return;
    });
  }

  _initUI() {
    this.menu = new MenuManager({
      inventory: this.inventory,
      audio: this.audio,
      factionSystem: this.factions,
      onCraft: (recipe) => this._craft(recipe),
      onPause: (p) => { this.paused = p; },
      onResume: (mode) => this._startGame(mode),
      onQuit: () => { this.started = false; },
      onRespawn: () => this._respawnPlayer(),
    });
    this.inventory.onChange(() => { this.hud.updateHotbar(this.inventory); if (!document.getElementById('inventory-screen').classList.contains('hidden')) this.menu.renderInventoryGrid(); });
    this.hud.updateHotbar(this.inventory);
  }

  _initInput() {
    this.input = new InputManager(this.canvas, {
      onPrimaryAction: (down) => { this.primaryHeld = down; },
      onSecondaryAction: (down) => { if (down) this._secondaryAction(); },
      onHotbar: (idx) => { this.inventory.selectedHotbar = idx; this.hud.updateHotbar(this.inventory); },
      onInteract: () => this._interactPressed(),
      onJumpTap: () => {},
      onScroll: (dir) => {
        this.inventory.selectedHotbar = (this.inventory.selectedHotbar + dir + 9) % 9;
        this.hud.updateHotbar(this.inventory);
      },
    });
  }

  _bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      if (!this.started) return;
      if (e.code === 'KeyI') this.menu.toggleInventory();
      if (e.code === 'KeyM') this.menu.toggleMap();
      if (e.code === 'Escape') {
        if (!document.getElementById('inventory-screen').classList.contains('hidden')) this.menu.closeInventory();
        else if (!document.getElementById('crafting-screen').classList.contains('hidden')) this.menu.closeCrafting();
        else if (!document.getElementById('map-screen').classList.contains('hidden')) this.menu.toggleMap();
        else this.menu.togglePause();
      }
      if (e.code === 'KeyF') this._tryTameOrMount();
      if (e.code === 'KeyR' && this.mount.current) this.mount.dismount();
    });

    if (MOBILE) {
      document.getElementById('btn-menu-mobile')?.classList.remove('hidden');
      document.getElementById('btn-menu-mobile')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.menu.togglePause(); });
    }
  }

  _bindWindowResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  async _loadingProgress() {
    const bar = document.getElementById('loading-bar-fill');
    const text = document.getElementById('loading-text');
    const steps = ['Tejiendo la niebla...', 'Levantando montañas...', 'Sembrando bosques...', 'Excavando mazmorras...', 'Encendiendo antorchas...'];
    for (let i = 0; i < steps.length; i++) {
      text.textContent = steps[i];
      bar.style.width = `${((i + 1) / steps.length) * 100}%`;
      await new Promise(r => setTimeout(r, 220));
    }
    this.menu.showMainMenu();
  }

  _startGame(mode) {
    this.started = true;
    this.paused = false;
    document.getElementById('hud').classList.remove('hidden');
    this.audio.start();

    let spawn;
    if (mode === 'continue') {
      const loaded = this._loadGame();
      spawn = loaded?.spawn || this.world.findSpawnPoint();
    } else {
      spawn = this.world.findSpawnPoint();
    }

    this.world.ensureSpawnArea(spawn.x, spawn.z, 2);
    spawn.y = this.world.getHeightAt(Math.floor(spawn.x), Math.floor(spawn.z)) + 2;
    this.player.setSpawn(spawn);
    this._giveStarterKit();

    if (!this.input.pointerLocked && !MOBILE) this.canvas.requestPointerLock?.();
    this._lastAutosave = 0;
    this.loop();
  }

  _giveStarterKit() {
    if (this.inventory.slots.some(s => s)) return; // already has items (continue)
    this.inventory.addItem('axe_wood', 1);
    this.inventory.addItem('pickaxe_wood', 1);
    this.inventory.addItem('sword_wood', 1);
    this.inventory.addItem('torch', 8);
    this.inventory.addItem('bread', 3);
    this.inventory.addItem('item_workbench', 1);
    this.hud.updateHotbar(this.inventory);
  }

  _respawnPlayer() {
    const spawn = this.world.findSpawnPoint();
    spawn.y = this.world.getHeightAt(Math.floor(spawn.x), Math.floor(spawn.z)) + 2;
    this.player.respawn(spawn);
    document.getElementById('hud').classList.remove('hidden');
    this.paused = false;
  }

  _craft(recipe) {
    if (!this.inventory.consumeRecipe(recipe.inputs)) return;
    this.inventory.addItem(recipe.output.id, recipe.output.count);
    this.audio.playCraft();
    this.hud.toast(`Creado: ${recipe.name}`);
  }

  _handleStationOpen(type, target) {
    if (type === 'chest') {
      const key = `${target.x},${target.y},${target.z}`;
      if (!this.chestStorage.has(key)) this.chestStorage.set(key, { items: generateLoot('village') });
      this.menu.openChest(this.chestStorage.get(key));
    } else if (type === 'craft_building') {
      this.menu.openCrafting('carpentry');
    } else if (type === 'craft_forge') {
      this.menu.openCrafting('forge');
    } else if (type === 'craft_alchemy') {
      this.menu.openCrafting('alchemy');
    }
  }

  _interactPressed() {
    if (this.menu.anyModalOpen()) return;
    if (this.mount.current) { this.mount.dismount(); return; }
    const mountable = this.mobs.findMountable(this.player.position);
    if (mountable) { this.mount.mount(mountable); return; }
    const result = this.interaction.interact();
    if (!result) this._tryPlantOrHarvest();
  }

  _tryTameOrMount() {
    if (this.menu.anyModalOpen()) return;
    const mountable = this.mobs.findMountable(this.player.position);
    if (mountable) { this.mount.mount(mountable); return; }
    const held = this.inventory.selectedItem;
    const isFood = held && getItem(held.id)?.type === 'food';
    const tamed = this.mobs.tameNearby(this.player.position, isFood);
    if (tamed) {
      this.hud.toast(`¡Has domesticado a un ${tamed.kind === 'horse' ? 'caballo' : 'lobo'}!`);
      if (isFood) this.inventory.removeItem(held.id, 1);
    }
  }

  _tryPlantOrHarvest() {
    const t = this.interaction.target;
    if (!t) return;
    const held = this.inventory.selectedItem;
    const belowIsFarmland = t.block === BlockId.FARMLAND;
    if (belowIsFarmland && held?.id === 'seeds') {
      const key = [t.x, t.y + 1, t.z];
      if (this.world.getBlock(...key) === BlockId.AIR) {
        this.world.setBlock(key[0], key[1], key[2], BlockId.CROP_0);
        this.farming.registerPlant(key[0], key[1], key[2]);
        this.inventory.removeItem('seeds', 1);
      }
    } else if (held && getItem(held.id)?.type === 'food') {
      // eat
      const def = getItem(held.id);
      this.player.eat(def.hunger || 10);
      if (def.heal) this.player.heal(def.heal);
      this.inventory.removeItem(held.id, 1);
      this.audio.playPickup();
    }
  }

  _secondaryAction() {
    if (this.menu.anyModalOpen()) return;
    const held = this.inventory.selectedItem;
    if (!held) return;
    const def = getItem(held.id);
    if (!def) return;

    if (def.type === 'block') {
      // farmland special-case: hoe converts grass/dirt to farmland instead of placing block
      if (this.interaction.placeBlock(def.block)) {
        this.inventory.removeFromSlot(this.inventory.selectedHotbar, 1);
        this.audio.playPlace();
      }
    } else if (def.tool === 'hoe' && this.interaction.target) {
      const t = this.interaction.target;
      if (t.block === BlockId.GRASS || t.block === BlockId.DIRT) {
        this.world.setBlock(t.x, t.y, t.z, BlockId.FARMLAND);
        this.audio.playPlace();
      }
    } else if (def.type === 'food' || def.type === 'potion') {
      this._consumeItem(held.id, def);
    } else if (def.ranged) {
      this._shootRanged(def);
    }
  }

  _consumeItem(id, def) {
    if (def.hunger) this.player.eat(def.hunger);
    if (def.heal) this.player.heal(def.heal);
    if (def.stamina) this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + def.stamina);
    if (def.warmth) this.player.warmth = Math.min(100, this.player.warmth + def.warmth);
    this.inventory.removeItem(id, 1);
    this.audio.playPickup();
  }

  _shootRanged(def) {
    if (!this.inventory.hasItems({ arrow: 1 }) && def.ranged) {
      this.hud.toast('¡Sin flechas!');
      return;
    }
    this.inventory.removeItem('arrow', 1);
    const dir = this.player.getForwardVector();
    const origin = this.camera.position.clone().addScaledVector(dir, 0.6);
    this.mobs.fireArrowFromPlayer(origin, dir, def.damage);
    this.audio.playBowShot();
  }

  _meleeAttack() {
    const held = this.inventory.selectedItem;
    const def = held ? getItem(held.id) : null;
    const damage = def?.damage || 1.5;
    const dir = this.player.getForwardVector();
    const origin = this.camera.position.clone();
    const result = this.mobs.meleeAttack(origin, dir, 2.4, damage);
    if (result) {
      this.audio.playHit();
      if (result.died) this._onMobDeath(result.mob);
      if (def?.durability) this.inventory.damageSelected(1);
    }
  }

  _onMobDeath(mob) {
    // faction reputation effects
    if (mob.kind === MobKind.ZOMBIE_KNIGHT || mob.kind === MobKind.SKELETON_ARCHER || mob.kind === MobKind.DUNGEON_WRAITH) {
      this.factions.adjust(FactionId.KINGDOM_OF_EMBERFALL, 3);
      this.factions.adjust(FactionId.UNDEAD_LEGION, -6);
    } else if (mob.kind === MobKind.WOLF) {
      this.factions.adjust(FactionId.WILDKIN_TRIBES, -4);
    }
  }

  _grantKillLoot(mob) {
    const drops = {
      zombie_knight: [['bone', 1, 2], ['iron_ore', 0, 1]],
      skeleton_archer: [['bone', 2, 3], ['arrow', 1, 3]],
      cave_spider: [['string', 1, 2]],
      dungeon_wraith: [['bone', 2, 4], ['mithril_ore', 0, 1], ['gold_ore', 0, 2]],
      boar: [['raw_meat', 1, 2], ['leather', 0, 1]],
      deer: [['raw_meat', 1, 2], ['leather', 1, 2]],
      wolf: [['leather', 1, 2]],
    };
    const table = drops[mob.kind];
    if (!table) return;
    for (const [id, min, max] of table) {
      const c = min + Math.floor(Math.random() * (max - min + 1));
      if (c > 0) this.inventory.addItem(id, c);
    }
  }

  _consumeStructureSpawns() {
    const spawns = this.world.consumeSpawns();
    for (const s of spawns) {
      if (s.type === 'villager') {
        const mob = this.mobs.spawnMob(MobKind.VILLAGER, new THREE.Vector3(s.x, s.y, s.z));
        mob.homePos = new THREE.Vector3(...s.home);
        mob.workPos = new THREE.Vector3(...s.work);
      } else if (s.type === 'chest') {
        const key = `${Math.floor(s.x)},${Math.floor(s.y)},${Math.floor(s.z)}`;
        if (!this.chestStorage.has(key)) this.chestStorage.set(key, { items: generateLoot(s.loot || 'village') });
      } else if (s.type === 'hostile_group') {
        for (let i = 0; i < s.count; i++) {
          const ang = Math.random() * Math.PI * 2;
          const px = s.x + Math.cos(ang) * 3, pz = s.z + Math.sin(ang) * 3;
          this.mobs.spawnMob(s.kind, new THREE.Vector3(px, s.y, pz));
        }
      }
    }
  }

  _saveGame() {
    try {
      const data = {
        spawn: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        inventory: this.inventory.slots,
        health: this.player.health, hunger: this.player.hunger,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  _loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.inventory) this.inventory.slots = data.inventory;
      if (data.health) this.player.health = data.health;
      if (data.hunger) this.player.hunger = data.hunger;
      this.hud.updateHotbar(this.inventory);
      return { spawn: data.spawn };
    } catch (e) { return null; }
  }

  loop() {
    if (!this.started) return;
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(0.05, this.clock.getDelta());

    if (!this.paused && !this.player.isDead) {
      this._update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  _update(dt) {
    // look
    const look = this.input.consumeLookDelta();
    this.player.yaw += look.yaw;
    this.player.pitch = THREE.MathUtils.clamp(this.player.pitch + look.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);

    const movementIntent = this.input.getMovementIntent();

    if (this.mount.current) {
      this.mount.update(dt, movementIntent, this.camera);
    } else {
      this.player.update(dt, movementIntent);
    }

    // mining / attacking with primary action depending on target type & held item
    const held = this.inventory.selectedItem;
    const heldDef = held ? getItem(held.id) : null;
    const isWeapon = heldDef?.type === 'weapon' && !heldDef.ranged;

    this.interaction.update(dt, this.primaryHeld && !isWeapon);
    if (this.primaryHeld && isWeapon) {
      this._attackTimer = (this._attackTimer || 0) + dt;
      if (this._attackTimer > 0.4) { this._attackTimer = 0; this._meleeAttack(); }
    } else if (this.primaryHeld && !this.interaction.target) {
      this._attackTimer = (this._attackTimer || 0) + dt;
      if (this._attackTimer > 0.4) { this._attackTimer = 0; this._meleeAttack(); }
    }

    // interaction hint
    if (this.interaction.target) {
      const def = getBlock(this.interaction.target.block);
      this.hud.showInteractHint(!!def.interactive, def.interactive ? 'Pulsa E para interactuar' : '');
    } else {
      this.hud.showInteractHint(false);
    }
    this.hud.showMountHint(!this.mount.current && !!this.mobs.findMountable(this.player.position));

    // world streaming
    this.world.update(this.player.position.x, this.player.position.z);
    this.world.updateMaterialsTime(this.clock.elapsedTime);
    this._consumeStructureSpawns();

    // sky / weather / farming / mobs
    const skyInfo = this.sky.update(dt, this.camera, this.player.position, this._currentBiomeFogColor());
    this.farming.update(dt);
    this.mobs.update(dt, this.sky.isNight(), this.sky.timeOfDay + this.farming.totalDays);

    // cold biome warmth drain
    this._updateWarmth(dt);

    // dynamic point lights from torches (limit count for perf)
    this._updateTorchLights();

    // HUD
    this.hud.updateStats(this.player);
    this.hud.updateClock(this.sky.timeOfDay, this.sky.isNight());
    this.hud.updateSeason(this.farming.seasonLabel, this._seasonIcon());
    this.hud.updateBiome(this._currentBiomeName());
    this.hud.updateWeather(this.sky.weather);

    this.audio.update(dt, { isNight: this.sky.isNight(), weather: this.sky.weather, biomeName: this._currentBiomeName(), inCave: this.player.position.y < 30 && !this._isOutdoors() });

    this._lastAutosave = (this._lastAutosave || 0) + dt;
    if (this._lastAutosave > 20) { this._lastAutosave = 0; this._saveGame(); }

    if (this.player.isDead) { this.menu.showDeath(); }
  }

  _currentBiomeAt() {
    const cx = Math.floor(this.player.position.x), cz = Math.floor(this.player.position.z);
    const { cx: ccx, cz: ccz } = this.world.worldToChunk(cx, cz);
    const chunk = this.world.chunkAt(ccx, ccz);
    if (!chunk || !chunk.biomeMap) return null;
    const lx = cx - ccx * 16, lz = cz - ccz * 16;
    const idx = ((lx % 16) + 16) % 16 + (((lz % 16) + 16) % 16) * 16;
    return chunk.biomeMap[idx];
  }

  _currentBiomeName() {
    const biome = this._currentBiomeAt();
    const names = {
      ocean: 'Mar Sombrío', beach: 'Costa Salada', plains: 'Llanuras del Reino', forest: 'Bosque Umbrío',
      dense_forest: 'Bosque Ancestral', snow_mountains: 'Cumbres Heladas', tundra: 'Tundra Gélida',
      toxic_swamp: 'Pantano Ponzoñoso', desert: 'Desierto Maldito', oasis: 'Oasis Perdido', ruins: 'Ruinas Olvidadas',
    };
    return names[biome] || 'Tierras Salvajes';
  }

  _currentBiomeFogColor() {
    const biome = this._currentBiomeAt();
    const colors = {
      ocean: 0x24455a, beach: 0x9fb6a8, plains: 0x8fae7d, forest: 0x5f7d4f, dense_forest: 0x3f5c37,
      snow_mountains: 0xd8e6ec, tundra: 0xc7d6da, toxic_swamp: 0x3f4a34, desert: 0xd8c07f, oasis: 0x8fc088, ruins: 0x6a6a62,
    };
    return colors[biome];
  }

  _isOutdoors() {
    const px = Math.floor(this.player.position.x), pz = Math.floor(this.player.position.z);
    const h = this.world.getHeightAt(px, pz);
    return this.player.position.y >= h - 1;
  }

  _updateWarmth(dt) {
    const biome = this._currentBiomeAt();
    const cold = biome === 'snow_mountains' || biome === 'tundra';
    const nightPenalty = this.sky.isNight() ? 1.4 : 1;
    if (cold) {
      this.player.warmth = Math.max(0, this.player.warmth - dt * 3 * nightPenalty);
      if (this.player.warmth <= 0) this.player.damage(dt * 2, 'cold');
    } else {
      this.player.warmth = Math.min(100, this.player.warmth + dt * 4);
    }
  }

  _seasonIcon() {
    const icons = { spring: '🌱', summer: '☀', autumn: '🍂', winter: '❄' };
    return icons[this.farming.season] || '🌱';
  }

  _updateTorchLights() {
    if (!this._torchLightPool) {
      this._torchLightPool = [];
      for (let i = 0; i < 8; i++) {
        const light = new THREE.PointLight(0xffaa55, 0, 9, 2);
        this.scene.add(light);
        this._torchLightPool.push(light);
      }
    }
    const lights = this.world.lightPositions;
    const px = this.player.position;
    const nearby = lights
      .map(l => ({ l, d: (l[0]-px.x)**2 + (l[2]-px.z)**2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, this._torchLightPool.length);

    this._torchLightPool.forEach((light, i) => {
      const entry = nearby[i];
      if (entry && entry.d < 400) {
        light.position.set(entry.l[0], entry.l[1], entry.l[2]);
        light.intensity = entry.l[3] / 8 * (0.85 + Math.sin(performance.now() * 0.006 + i) * 0.1);
      } else {
        light.intensity = 0;
      }
    });
  }
}

new Game();
