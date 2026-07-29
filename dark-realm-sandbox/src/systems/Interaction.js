// ============================================================================
// Block interaction: voxel raycasting (DDA), mining progress with tool-tier
// gating, block placement, and generic "interact" (E) for chests / crafting
// stations / farmland / crops / doors.
// ============================================================================
import * as THREE from 'three';
import { BlockId, getBlock, isSolid } from '../world/Blocks.js';
import { getItem } from './Items.js';

export class Interaction {
  constructor(world, player, camera, inventory, hud) {
    this.world = world;
    this.player = player;
    this.camera = camera;
    this.inventory = inventory;
    this.hud = hud;
    this.reach = 5.5;
    this.target = null; // {x,y,z, face, blockId}
    this.miningProgress = 0;
    this.miningTarget = null;
    this.onOpenStation = null; // callback(stationType, pos)
    this.onHarvest = null;
  }

  raycast() {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = dir.x !== 0 ? ((stepX > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDeltaX) : Infinity;
    let tMaxY = dir.y !== 0 ? ((stepY > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDeltaY) : Infinity;
    let tMaxZ = dir.z !== 0 ? ((stepZ > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDeltaZ) : Infinity;

    let dist = 0;
    let lastFace = null;
    for (let i = 0; i < 200 && dist < this.reach; i++) {
      const block = this.world.getBlock(x, y, z);
      if (isSolid(block) || getBlock(block).interactive || getBlock(block).cross) {
        return { x, y, z, block, face: lastFace };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; dist = tMaxX; tMaxX += tDeltaX; lastFace = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; dist = tMaxY; tMaxY += tDeltaY; lastFace = [0, -stepY, 0];
      } else {
        z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; lastFace = [0, 0, -stepZ];
      }
    }
    return null;
  }

  update(dt, mining) {
    this.target = this.raycast();

    if (mining && this.target) {
      const def = getBlock(this.target.block);
      if (def.unbreakable) { this.miningProgress = 0; return; }
      const key = `${this.target.x},${this.target.y},${this.target.z}`;
      if (this.miningTarget !== key) { this.miningTarget = key; this.miningProgress = 0; }

      const held = this.inventory.selectedItem;
      const heldDef = held ? getItem(held.id) : null;
      let speed = 1;
      if (def.tool) {
        const toolMatches = heldDef && heldDef.tool === def.tool;
        const tierOk = heldDef ? (heldDef.tier ?? 0) >= (def.tier ?? 0) : (def.tier ?? 0) === 0 ? false : false;
        if (toolMatches) speed = 2.2 + (heldDef.tier || 0) * 1.1;
        else speed = 0.4; // hand mining is slow, penalize wrong tool more for ores
        if (def.tier && !toolMatches) speed = 0.12;
      } else {
        speed = 2.5;
      }
      this.miningProgress += dt * speed / Math.max(0.2, def.hardness);
      if (this.hud) this.hud.setMiningProgress(this.miningProgress);

      if (this.miningProgress >= 1) {
        this._breakBlock(this.target, heldDef);
        this.miningProgress = 0;
        this.miningTarget = null;
        if (this.hud) this.hud.setMiningProgress(0);
      }
    } else {
      this.miningProgress = 0;
      this.miningTarget = null;
      if (this.hud) this.hud.setMiningProgress(0);
    }
  }

  _breakBlock(t, heldDef) {
    const def = getBlock(t.block);
    this.world.setBlock(t.x, t.y, t.z, BlockId.AIR);
    if (heldDef?.durability) this.inventory.damageSelected(1);
    this._dropLoot(def, t);
  }

  _dropLoot(def, t) {
    const dropTable = {
      [BlockId.GRASS]: 'dirt', [BlockId.DIRT]: 'dirt', [BlockId.STONE]: 'stone', [BlockId.SAND]: 'sand',
      [BlockId.LOG]: 'wood', [BlockId.PALM_LOG]: 'wood', [BlockId.COBBLESTONE]: 'stone',
      [BlockId.COAL_ORE]: 'coal_ore', [BlockId.IRON_ORE]: 'iron_ore', [BlockId.SILVER_ORE]: 'silver_ore',
      [BlockId.GOLD_ORE]: 'gold_ore', [BlockId.MITHRIL_ORE]: 'mithril_ore', [BlockId.PLANKS]: 'plank',
      [BlockId.GLOWSTONE]: 'glowstone', [BlockId.SNOW]: 'dirt', [BlockId.TORCH]: 'torch',
      [BlockId.MUD]: 'dirt', [BlockId.GRAVEL]: 'stone', [BlockId.CLAY]: 'dirt',
    };
    const id = dropTable[t.block] ?? null;
    if (id) this.inventory.addItem(id, 1);
    if (t.block === BlockId.CROP_3 && this.onHarvest) this.onHarvest(t);
    if (Math.random() < 0.05 && (t.block === BlockId.LEAVES || t.block === BlockId.PALM_LEAVES)) this.inventory.addItem('seeds', 1);
  }

  placeBlock(blockId) {
    if (!this.target) return false;
    const [nx, ny, nz] = this.target.face || [0, 1, 0];
    const px = this.target.x + nx, py = this.target.y + ny, pz = this.target.z + nz;
    const existing = this.world.getBlock(px, py, pz);
    if (isSolid(existing)) return false;
    // avoid placing inside player
    const playerBox = this.player.getAABB();
    if (px + 1 > playerBox.minX && px < playerBox.maxX && py + 1 > playerBox.minY && py < playerBox.maxY && pz + 1 > playerBox.minZ && pz < playerBox.maxZ) return false;
    this.world.setBlock(px, py, pz, blockId);
    return true;
  }

  interact() {
    if (!this.target) return null;
    const def = getBlock(this.target.block);
    if (def.interactive && this.onOpenStation) {
      this.onOpenStation(def.interactive, this.target);
      return def.interactive;
    }
    return null;
  }
}
