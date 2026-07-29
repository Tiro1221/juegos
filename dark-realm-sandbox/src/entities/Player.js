// ============================================================================
// Player controller: first-person camera, voxel AABB physics/collision,
// swimming, sprinting, jumping, and health/stamina/hunger stats.
// ============================================================================
import * as THREE from 'three';
import { GRAVITY, PLAYER_HEIGHT, PLAYER_RADIUS, PLAYER_EYE_HEIGHT, WALK_SPEED, SPRINT_SPEED, SWIM_SPEED, JUMP_SPEED } from '../core/Config.js';
import { BlockId, isSolid, isLiquid } from '../world/Blocks.js';

export class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.position = new THREE.Vector3(0, 40, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.sprinting = false;
    this.crouching = false;
    this.flying = false;

    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.hunger = 100;
    this.maxHunger = 100;
    this.warmth = 100; // affected by cold biomes/weather at night
    this.isDead = false;

    this.mountedOn = null; // reference to a Mount entity when riding

    this.inputDir = new THREE.Vector3();
    this.wantJump = false;

    this._invulnTimer = 0;
    this._hungerTimer = 0;
  }

  setSpawn(pos) {
    this.position.set(pos.x, pos.y, pos.z);
  }

  get eyeHeight() { return this.crouching ? PLAYER_EYE_HEIGHT - 0.35 : PLAYER_EYE_HEIGHT; }

  getAABB(pos = this.position) {
    const h = this.crouching ? PLAYER_HEIGHT * 0.7 : PLAYER_HEIGHT;
    return {
      minX: pos.x - PLAYER_RADIUS, maxX: pos.x + PLAYER_RADIUS,
      minY: pos.y, maxY: pos.y + h,
      minZ: pos.z - PLAYER_RADIUS, maxZ: pos.z + PLAYER_RADIUS,
    };
  }

  collidesAt(pos) {
    const box = this.getAABB(pos);
    const minX = Math.floor(box.minX), maxX = Math.floor(box.maxX);
    const minY = Math.floor(box.minY), maxY = Math.floor(box.maxY);
    const minZ = Math.floor(box.minZ), maxZ = Math.floor(box.maxZ);
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (isSolid(this.world.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  isInLiquid(pos) {
    const cx = Math.floor(pos.x), cy = Math.floor(pos.y + 0.5), cz = Math.floor(pos.z);
    return isLiquid(this.world.getBlock(cx, cy, cz));
  }

  update(dt, movementIntent) {
    if (this.mountedOn) return; // mount controls movement directly
    if (this.isDead) return;

    const { forward, right, jump, sprint, crouch, fly } = movementIntent;
    this.sprinting = sprint && this.stamina > 1 && !this.crouching;
    this.crouching = crouch;

    const speed = this.inWater ? SWIM_SPEED : (this.sprinting ? SPRINT_SPEED : WALK_SPEED) * (this.crouching ? 0.45 : 1);

    const sinYaw = Math.sin(this.yaw), cosYaw = Math.cos(this.yaw);
    const moveX = (right * cosYaw - forward * sinYaw);
    const moveZ = (-right * sinYaw - forward * cosYaw);
    const len = Math.hypot(moveX, moveZ);
    const normX = len > 0 ? moveX / len : 0;
    const normZ = len > 0 ? moveZ / len : 0;

    this.inWater = this.isInLiquid(this.position);

    if (this.flying) {
      this.velocity.set(normX * speed * 1.4, 0, normZ * speed * 1.4);
      if (jump) this.velocity.y = speed * 1.2; else if (movementIntent.descend) this.velocity.y = -speed * 1.2; else this.velocity.y = 0;
    } else {
      this.velocity.x = normX * speed;
      this.velocity.z = normZ * speed;

      if (this.inWater) {
        this.velocity.y -= GRAVITY * 0.25 * dt;
        this.velocity.y = Math.max(this.velocity.y, -3.2);
        if (jump) this.velocity.y = 3.4;
      } else {
        this.velocity.y -= GRAVITY * dt;
        if (jump && this.onGround) {
          this.velocity.y = JUMP_SPEED;
          this.onGround = false;
        }
      }
    }

    // stamina drain/regen
    if (this.sprinting && len > 0) this.stamina = Math.max(0, this.stamina - dt * 12);
    else this.stamina = Math.min(this.maxStamina, this.stamina + dt * 8);

    // hunger drain over time
    this._hungerTimer += dt;
    if (this._hungerTimer > 8) {
      this._hungerTimer = 0;
      this.hunger = Math.max(0, this.hunger - 1);
      if (this.hunger <= 0) this.damage(2, 'starvation');
      else if (this.hunger > 60 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + 1);
    }

    this._moveWithCollision(dt);

    if (this._invulnTimer > 0) this._invulnTimer -= dt;

    this.camera.position.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  _moveWithCollision(dt) {
    const disp = this.velocity.clone().multiplyScalar(dt);

    // X axis
    let next = this.position.clone();
    next.x += disp.x;
    if (this.collidesAt(next)) { disp.x = 0; } else { this.position.x = next.x; }

    // Z axis
    next = this.position.clone();
    next.z += disp.z;
    if (this.collidesAt(next)) { disp.z = 0; } else { this.position.z = next.z; }

    // Y axis
    next = this.position.clone();
    next.y += disp.y;
    if (this.collidesAt(next)) {
      if (disp.y < 0) this.onGround = true;
      this.velocity.y = 0;
    } else {
      this.position.y = next.y;
      this.onGround = false;
    }

    // ground check via small probe below
    if (!this.onGround) {
      const probe = this.position.clone();
      probe.y -= 0.05;
      if (this.collidesAt(probe) && this.velocity.y <= 0) this.onGround = true;
    }
  }

  damage(amount, source = 'unknown') {
    if (this.isDead || this._invulnTimer > 0) return;
    this.health = Math.max(0, this.health - amount);
    this._invulnTimer = 0.4;
    if (this.health <= 0) this.die(source);
    return this.health;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  eat(amount) {
    this.hunger = Math.min(this.maxHunger, this.hunger + amount);
  }

  die(source) {
    this.isDead = true;
  }

  respawn(pos) {
    this.isDead = false;
    this.health = this.maxHealth;
    this.hunger = Math.max(40, this.hunger);
    this.stamina = this.maxStamina;
    this.velocity.set(0, 0, 0);
    this.setSpawn(pos);
  }

  getForwardVector() {
    const v = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    return v.normalize();
  }
}
