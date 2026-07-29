// ============================================================================
// Mob: base class for all living creatures (hostile monsters, animals,
// mountable beasts, village NPCs). Uses simple low-poly voxel-box bodies
// built from BoxGeometry parts, with a lightweight state-machine AI.
// ============================================================================
import * as THREE from 'three';
import { GRAVITY } from '../core/Config.js';
import { isSolid } from '../world/Blocks.js';

export const MobKind = {
  ZOMBIE_KNIGHT: 'zombie_knight',
  SKELETON_ARCHER: 'skeleton_archer',
  CAVE_SPIDER: 'cave_spider',
  BOAR: 'boar',
  DEER: 'deer',
  HORSE: 'horse',
  WOLF: 'wolf',
  VILLAGER: 'villager',
  DUNGEON_WRAITH: 'dungeon_wraith',
};

const PALETTES = {
  zombie_knight: { skin: 0x5c7a52, cloth: 0x3a3a3f, metal: 0x6c6c70 },
  skeleton_archer: { skin: 0xe4ddc9, cloth: 0x5a4a3a, metal: 0x8a8a8a },
  cave_spider: { skin: 0x241f33, cloth: 0x4a2f5a, metal: 0x111 },
  boar: { skin: 0x6b4a34, cloth: 0x4a3324, metal: 0x2a2a2a },
  deer: { skin: 0x9a7a52, cloth: 0x7a5c3a, metal: 0x3a2a1a },
  horse: { skin: 0x8a5a34, cloth: 0x5a3a24, metal: 0x2a1a10 },
  wolf: { skin: 0x707070, cloth: 0x505050, metal: 0x202020 },
  villager: { skin: 0xd8b58a, cloth: 0x8a4a3a, metal: 0x6a5a4a },
  dungeon_wraith: { skin: 0x2a1a3a, cloth: 0x160b22, metal: 0x8f5ad6 },
};

let mobIdCounter = 1;

export class Mob {
  constructor(world, kind, position) {
    this.id = mobIdCounter++;
    this.world = world;
    this.kind = kind;
    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.onGround = false;

    this.isHostile = [MobKind.ZOMBIE_KNIGHT, MobKind.SKELETON_ARCHER, MobKind.CAVE_SPIDER, MobKind.DUNGEON_WRAITH].includes(kind);
    this.isTameable = [MobKind.HORSE, MobKind.WOLF].includes(kind);
    this.isPassive = [MobKind.BOAR, MobKind.DEER].includes(kind);
    this.isVillager = kind === MobKind.VILLAGER;

    const statsByKind = {
      [MobKind.ZOMBIE_KNIGHT]: { hp: 30, speed: 1.6, damage: 6, radius: 0.35, height: 1.9, xp: 12 },
      [MobKind.SKELETON_ARCHER]: { hp: 20, speed: 1.7, damage: 4, radius: 0.32, height: 1.8, xp: 10, ranged: true },
      [MobKind.CAVE_SPIDER]: { hp: 14, speed: 2.6, damage: 3, radius: 0.4, height: 0.6, xp: 8 },
      [MobKind.DUNGEON_WRAITH]: { hp: 45, speed: 1.9, damage: 9, radius: 0.4, height: 2.1, xp: 25 },
      [MobKind.BOAR]: { hp: 16, speed: 1.6, damage: 0, radius: 0.4, height: 0.9, xp: 3, flee: true },
      [MobKind.DEER]: { hp: 12, speed: 2.4, damage: 0, radius: 0.35, height: 1.1, xp: 2, flee: true },
      [MobKind.HORSE]: { hp: 40, speed: 3.4, damage: 0, radius: 0.5, height: 1.6, xp: 0, flee: true, mountSpeed: 8.5 },
      [MobKind.WOLF]: { hp: 22, speed: 2.8, damage: 4, radius: 0.4, height: 0.9, xp: 6 },
      [MobKind.VILLAGER]: { hp: 20, speed: 1.2, damage: 0, radius: 0.32, height: 1.75, xp: 0 },
    };
    Object.assign(this, statsByKind[kind]);
    this.maxHp = this.hp;

    this.state = 'idle'; // idle | wander | chase | flee | attack | tamed | ride | schedule
    this.stateTimer = 0;
    this.attackCooldown = 0;
    this.tamed = false;
    this.owner = null;
    this.rider = null;
    this.homePos = position.clone();
    this.deathHandled = false;
    this.hitFlash = 0;

    this.mesh = this._buildMesh();
    this.mesh.position.copy(this.position);
    this.world.scene.add(this.mesh);

    // Villager routine
    this.routine = null;
    this.routineTarget = null;
  }

  _buildMesh() {
    const pal = PALETTES[this.kind] || PALETTES.villager;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: pal.skin });
    const clothMat = new THREE.MeshLambertMaterial({ color: pal.cloth });
    const metalMat = new THREE.MeshLambertMaterial({ color: pal.metal });

    const scale = this._scaleForKind();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.6 * scale, 0.3 * scale), clothMat);
    torso.position.y = 0.9 * scale;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36 * scale, 0.36 * scale, 0.36 * scale), bodyMat);
    head.position.y = 1.35 * scale;
    head.castShadow = true;
    group.add(head);
    this.headMesh = head;

    if (this.kind === MobKind.HORSE || this.kind === MobKind.BOAR || this.kind === MobKind.DEER || this.kind === MobKind.WOLF) {
      // quadruped shape
      torso.rotation.x = Math.PI / 2;
      torso.geometry = new THREE.BoxGeometry(0.5 * scale, 0.9 * scale, 0.45 * scale);
      torso.position.y = 0.55 * scale;
      head.position.set(0, 0.6 * scale, 0.45 * scale);
      const legGeo = new THREE.BoxGeometry(0.12 * scale, 0.5 * scale, 0.12 * scale);
      this.legs = [];
      for (const [dx, dz] of [[0.16, 0.16], [-0.16, 0.16], [0.16, -0.16], [-0.16, -0.16]]) {
        const leg = new THREE.Mesh(legGeo, metalMat);
        leg.position.set(dx * scale, 0.25 * scale, dz * scale);
        leg.castShadow = true;
        group.add(leg);
        this.legs.push(leg);
      }
    } else {
      const armGeo = new THREE.BoxGeometry(0.14 * scale, 0.5 * scale, 0.14 * scale);
      this.armL = new THREE.Mesh(armGeo, bodyMat);
      this.armL.position.set(0.32 * scale, 0.9 * scale, 0);
      this.armR = this.armL.clone();
      this.armR.position.x = -0.32 * scale;
      group.add(this.armL, this.armR);

      const legGeo = new THREE.BoxGeometry(0.16 * scale, 0.55 * scale, 0.16 * scale);
      this.legL = new THREE.Mesh(legGeo, clothMat);
      this.legL.position.set(0.14 * scale, 0.28 * scale, 0);
      this.legR = this.legL.clone();
      this.legR.position.x = -0.14 * scale;
      group.add(this.legL, this.legR);

      if (this.kind === MobKind.ZOMBIE_KNIGHT || this.kind === MobKind.SKELETON_ARCHER || this.kind === MobKind.DUNGEON_WRAITH) {
        const helm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.12 * scale, 0.4 * scale), metalMat);
        helm.position.y = 1.55 * scale;
        group.add(helm);
      }
    }

    group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    return group;
  }

  _scaleForKind() {
    switch (this.kind) {
      case MobKind.HORSE: return 1.5;
      case MobKind.CAVE_SPIDER: return 0.8;
      case MobKind.DUNGEON_WRAITH: return 1.3;
      case MobKind.BOAR: return 0.9;
      case MobKind.DEER: return 1.05;
      case MobKind.WOLF: return 0.85;
      default: return 1;
    }
  }

  distanceTo(pos) { return this.position.distanceTo(pos); }

  takeDamage(amount, sourcePos) {
    this.hp -= amount;
    this.hitFlash = 0.15;
    if (this.hp <= 0 && !this.deathHandled) {
      this.deathHandled = true;
      return true; // died
    }
    if (sourcePos && !this.tamed) {
      this.state = this.isHostile || this.kind === MobKind.WOLF ? 'chase' : 'flee';
      this.fleeFrom = sourcePos.clone();
    }
    return false;
  }

  applyPhysics(dt) {
    this.velocity.y -= GRAVITY * dt;
    const disp = this.velocity.clone().multiplyScalar(dt);
    const r = this.radius;

    let next = this.position.clone(); next.x += disp.x;
    if (!this._collides(next, r)) this.position.x = next.x; else this.velocity.x = 0;
    next = this.position.clone(); next.z += disp.z;
    if (!this._collides(next, r)) this.position.z = next.z; else this.velocity.z = 0;
    next = this.position.clone(); next.y += disp.y;
    if (!this._collides(next, r)) { this.position.y = next.y; this.onGround = false; }
    else { if (disp.y < 0) this.onGround = true; this.velocity.y = 0; }
  }

  _collides(pos, r) {
    const minY = Math.floor(pos.y), maxY = Math.floor(pos.y + this.height);
    for (let y = minY; y <= maxY; y++) {
      for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
        if (isSolid(this.world.getBlock(Math.floor(pos.x + dx), y, Math.floor(pos.z + dz)))) return true;
      }
    }
    return false;
  }

  syncMesh() {
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.yaw;
    if (this.hitFlash > 0) {
      this.hitFlash -= 0.016;
      this.mesh.traverse(o => { if (o.isMesh) o.material.emissive?.setRGB?.(0.6, 0.05, 0.05); });
    } else {
      this.mesh.traverse(o => { if (o.isMesh && o.material.emissive) o.material.emissive.setRGB(0, 0, 0); });
    }
  }

  animateWalk(t, moving) {
    const swing = moving ? Math.sin(t * 8) * 0.5 : 0;
    if (this.legL) { this.legL.rotation.x = swing; this.legR.rotation.x = -swing; }
    if (this.armL) { this.armL.rotation.x = -swing * 0.6; this.armR.rotation.x = swing * 0.6; }
    if (this.legs) this.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 8 + i * Math.PI / 2) * (moving ? 0.5 : 0); });
  }

  dispose() {
    this.world.scene.remove(this.mesh);
    this.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
}
