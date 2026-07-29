// ============ ELDERMERE — Jugador: física, minería, construcción, combate ============
import * as THREE from 'three';
import { CONFIG, BLOCKS, ITEMS } from './config.js';

const { PLAYER } = CONFIG;
const HALF = PLAYER.WIDTH / 2;

export class Player {
  constructor(world, camera, scene) {
    this.world = world;
    this.camera = camera;
    this.scene = scene;
    this.pos = new THREE.Vector3(8, 40, 8);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.keys = {};
    this.hp = 100; this.maxHp = 100;
    this.food = 100; this.stam = 100;
    this.dead = false;
    this.attackCooldown = 0;
    this.breaking = { active: false, x: 0, y: 0, z: 0, progress: 0 };
    this.strBuff = 0; this.swiftBuff = 0;
    this.mount = null;              // entidad montura
    this.hurtCooldown = 0;

    // highlight del bloque objetivo
    const hlGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(hlGeo),
      new THREE.LineBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.9 }));
    this.highlight.visible = false;
    scene.add(this.highlight);

    // indicador de progreso de rotura
    this.breakOverlay = new THREE.Mesh(hlGeo.clone(),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    scene.add(this.breakOverlay);

    // brazo/herramienta en primera persona (simple)
    this.handGroup = new THREE.Group();
    const handMat = new THREE.MeshLambertMaterial({ color: 0xc89878 });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.32), handMat);
    hand.position.set(0.34, -0.3, -0.55);
    this.handGroup.add(hand);
    this.handTool = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
    this.handTool.position.set(0.34, -0.22, -0.62);
    this.handGroup.add(this.handTool);
    camera.add(this.handGroup);
    this.swing = 0;
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0024;
    this.pitch -= dy * 0.0024;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
  }

  eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + PLAYER.EYE, this.pos.z); }

  forwardDir() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }

  // ---------- colisión AABB vs voxels ----------
  collide(axis) {
    const p = this.pos;
    const minX = Math.floor(p.x - HALF), maxX = Math.floor(p.x + HALF);
    const minY = Math.floor(p.y), maxY = Math.floor(p.y + PLAYER.HEIGHT);
    const minZ = Math.floor(p.z - HALF), maxZ = Math.floor(p.z + HALF);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (!this.world.isSolid(x, y, z)) continue;
      // resolución por eje
      if (axis === 'x') {
        if (this.vel.x > 0) p.x = x - HALF - 0.001; else p.x = x + 1 + HALF + 0.001;
        this.vel.x = 0;
      } else if (axis === 'z') {
        if (this.vel.z > 0) p.z = z - HALF - 0.001; else p.z = z + 1 + HALF + 0.001;
        this.vel.z = 0;
      } else {
        if (this.vel.y > 0) { p.y = y - PLAYER.HEIGHT - 0.001; this.vel.y = 0; }
        else { p.y = y + 1.001; this.vel.y = 0; this.onGround = true; }
      }
    }
  }

  update(dt, game) {
    if (this.dead) return;
    const speedMul = (this.swiftBuff > 0 ? 1.35 : 1);
    this.strBuff = Math.max(0, this.strBuff - dt);
    this.swiftBuff = Math.max(0, this.swiftBuff - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);

    // hambre y regeneración
    this.food = Math.max(0, this.food - dt * 0.22);
    if (this.food > 70 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * 1.4);
    if (this.food <= 0) this.damage(dt * 2.2, game, 'inanición');

    // agua
    const feetBlock = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.3), Math.floor(this.pos.z));
    const fb = BLOCKS[feetBlock];
    this.inWater = !!(fb && fb.liquid && feetBlock !== 'lava');
    if (feetBlock === 'lava') this.damage(dt * 14, game, 'la lava');

    // movimiento
    const mounted = !!this.mount;
    let speed = (this.keys['ShiftLeft'] && this.stam > 1 ? PLAYER.RUN : PLAYER.WALK) * speedMul;
    if (mounted) speed = PLAYER.MOUNT_SPEED;
    if (this.inWater) speed = PLAYER.SWIM;

    const run = this.keys['ShiftLeft'] && this.stam > 1;
    if (run && (this.keys['KeyW'] || this.keys['KeyA'] || this.keys['KeyS'] || this.keys['KeyD'])) {
      this.stam = Math.max(0, this.stam - dt * 12);
      this.food = Math.max(0, this.food - dt * 0.35);
    } else this.stam = Math.min(100, this.stam + dt * 9);

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (this.keys['KeyW']) { mx -= sin; mz -= cos; }
    if (this.keys['KeyS']) { mx += sin; mz += cos; }
    if (this.keys['KeyA']) { mx -= cos; mz += sin; }
    if (this.keys['KeyD']) { mx += cos; mz -= sin; }
    const len = Math.hypot(mx, mz) || 1;
    mx = mx / len * speed; mz = mz / len * speed;

    // aceleración suave
    const accel = this.onGround || this.inWater ? 14 : 4;
    this.vel.x += (mx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (mz - this.vel.z) * Math.min(1, accel * dt);

    if (this.inWater) {
      this.vel.y += (-PLAYER.GRAVITY * 0.22 - this.vel.y) * Math.min(1, 3 * dt);
      if (this.keys['Space']) this.vel.y = 4.2;
    } else {
      this.vel.y -= PLAYER.GRAVITY * dt;
      if (this.keys['Space'] && this.onGround) {
        this.vel.y = PLAYER.JUMP;
        this.onGround = false;
        game.audio.sfx('jump');
      }
    }

    // integración con colisiones por eje
    this.pos.x += this.vel.x * dt; this.collide('x');
    this.pos.z += this.vel.z * dt; this.collide('z');
    this.onGround = false;
    this.pos.y += this.vel.y * dt; this.collide('y');

    // caída al vacío de seguridad
    if (this.pos.y < -10) { this.pos.y = 60; this.vel.set(0, 0, 0); }

    // montura
    if (this.mount) {
      this.mount.pos.set(this.pos.x, this.pos.y - 0.4, this.pos.z);
      this.mount.group.position.copy(this.mount.pos);
      this.mount.group.rotation.y = this.yaw;
    }

    // cámara
    const bobT = performance.now() * 0.001;
    const moving = Math.abs(this.vel.x) + Math.abs(this.vel.z) > 1 && this.onGround;
    const bob = moving ? Math.sin(bobT * 10) * 0.045 : 0;
    this.camera.position.set(this.pos.x, this.pos.y + PLAYER.EYE + bob, this.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);

    // animación de mano
    this.swing = Math.max(0, this.swing - dt * 6);
    const sw = Math.sin(this.swing * Math.PI);
    this.handGroup.rotation.x = -sw * 1.1;
    this.handGroup.position.y = moving ? Math.sin(bobT * 10 + 1) * 0.02 : 0;

    // raycast objetivo
    const hit = this.world.raycast(this.eyePos(), this.forwardDir(), PLAYER.REACH);
    this.target = hit;
    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlight.visible = false;
      this.breaking.active = false;
      this.breakOverlay.material.opacity = 0;
    }

    // romper bloque manteniendo clic
    if (this.breaking.active && hit) {
      const b = BLOCKS[hit.block];
      if (b.unbreakable) { this.breaking.progress = 0; }
      else {
        const held = game.inventory.heldEntry();
        const heldItem = held && held.type === 'item' ? ITEMS[held.key] : null;
        let speed = 1;
        if (heldItem && heldItem.tool && heldItem.tool === b.tool) speed = heldItem.speed;
        else if (heldItem && heldItem.tool) speed = 0.9;
        this.breaking.progress += dt * speed / (b.hard || 0.5);
        this.breakOverlay.material.opacity = this.breaking.progress * 0.45;
        this.breakOverlay.position.copy(this.highlight.position);
        this.swing = Math.max(this.swing, 0.35);
        if (this.breaking.progress >= 1) {
          this.breaking.active = false;
          this.breaking.progress = 0;
          this.breakOverlay.material.opacity = 0;
          game.mineBlock(hit.x, hit.y, hit.z, hit.block);
        }
      }
    } else if (!this.breaking.active) {
      this.breaking.progress = 0;
      this.breakOverlay.material.opacity = 0;
    }
  }

  startBreaking() {
    if (this.target) {
      this.breaking.active = true;
      this.breaking.progress = 0;
      this.swing = 1;
    }
  }
  stopBreaking() { this.breaking.active = false; this.breaking.progress = 0; }

  damage(amount, game, cause = 'el daño') {
    if (this.hurtCooldown > 0 && amount > 1) return;
    if (amount > 1) this.hurtCooldown = 0.5;
    this.hp -= amount;
    if (amount > 1) {
      game.audio.sfx('hurt');
      const v = document.getElementById('damage-vignette');
      v.style.opacity = Math.min(1, 0.4 + amount / 40);
      setTimeout(() => v.style.opacity = 0, 220);
    }
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      game.onPlayerDeath(cause);
    }
  }

  respawn(spawn) {
    this.dead = false;
    this.hp = this.maxHp; this.food = 80; this.stam = 100;
    this.pos.set(spawn.x + 0.5, spawn.y + 1, spawn.z + 0.5);
    this.vel.set(0, 0, 0);
  }
}
