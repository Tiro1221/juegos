// ============================================================================
// MobManager: spawns and updates all living creatures around the player —
// hostile monsters (night/dungeon spawns), passive wildlife, tameable
// animals, and village NPCs with daily routines.
// ============================================================================
import * as THREE from 'three';
import { Mob, MobKind } from '../entities/Mob.js';
import { isSolid } from '../world/Blocks.js';

const MAX_MOBS = 26;
const SPAWN_RADIUS_MIN = 14;
const SPAWN_RADIUS_MAX = 34;
const DESPAWN_RADIUS = 60;

export class MobManager {
  constructor(world, player, factionSystem) {
    this.world = world;
    this.player = player;
    this.factions = factionSystem;
    this.mobs = [];
    this.spawnTimer = 0;
    this.projectiles = []; // {mesh, velocity, damage, life, owner}
    this.onPlayerHit = null;
    this.onMobKilled = null;
  }

  spawnMob(kind, pos) {
    const mob = new Mob(this.world, kind, pos);
    this.mobs.push(mob);
    return mob;
  }

  spawnAround(playerPos, isNight) {
    if (this.mobs.length >= MAX_MOBS) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_RADIUS_MIN + Math.random() * (SPAWN_RADIUS_MAX - SPAWN_RADIUS_MIN);
    const wx = Math.floor(playerPos.x + Math.cos(angle) * dist);
    const wz = Math.floor(playerPos.z + Math.sin(angle) * dist);
    const wy = this.world.getHeightAt(wx, wz) + 1;
    if (wy > 90 || wy < 2) return;

    let kind;
    const r = Math.random();
    if (isNight) {
      kind = r < 0.4 ? MobKind.ZOMBIE_KNIGHT : r < 0.7 ? MobKind.SKELETON_ARCHER : r < 0.85 ? MobKind.CAVE_SPIDER : MobKind.WOLF;
    } else {
      kind = r < 0.35 ? MobKind.DEER : r < 0.6 ? MobKind.BOAR : r < 0.8 ? MobKind.HORSE : MobKind.WOLF;
    }
    this.spawnMob(kind, new THREE.Vector3(wx + 0.5, wy, wz + 0.5));
  }

  update(dt, isNight, elapsed) {
    this.spawnTimer += dt;
    if (this.spawnTimer > 4) {
      this.spawnTimer = 0;
      this.spawnAround(this.player.position, isNight);
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      if (mob.hp <= 0) {
        this.onMobKilled?.(mob);
        mob.dispose();
        this.mobs.splice(i, 1);
        continue;
      }
      const distToPlayer = mob.distanceTo(this.player.position);
      if (distToPlayer > DESPAWN_RADIUS && !mob.tamed) {
        mob.dispose();
        this.mobs.splice(i, 1);
        continue;
      }
      this._updateMobAI(mob, dt, distToPlayer, elapsed);
      mob.applyPhysics(dt);
      mob.syncMesh();
    }

    this._updateProjectiles(dt);
  }

  _updateMobAI(mob, dt, distToPlayer, elapsed) {
    mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);
    mob.stateTimer -= dt;

    if (mob.tamed && mob.owner === 'player') {
      if (mob.rider) return; // controlled externally when ridden
      this._wander(mob, dt, mob.homePos, 6);
      return;
    }

    if (mob.isHostile) {
      if (distToPlayer < 16) mob.state = 'chase';
      if (mob.state === 'chase') {
        this._moveToward(mob, this.player.position, dt);
        if (mob.ranged) {
          if (distToPlayer < 14 && distToPlayer > 3 && mob.attackCooldown <= 0) {
            this._fireProjectile(mob);
            mob.attackCooldown = 2.2;
          }
        } else if (distToPlayer < mob.radius + 0.9 && mob.attackCooldown <= 0) {
          this.onPlayerHit?.(mob.damage, mob);
          mob.attackCooldown = 1.1;
        }
      }
      return;
    }

    if (mob.isPassive || mob.kind === 'horse') {
      if (mob.fleeFrom && mob.position.distanceTo(mob.fleeFrom) < 8) {
        this._moveAway(mob, mob.fleeFrom, dt);
      } else {
        mob.fleeFrom = null;
        this._wander(mob, dt, mob.homePos, 10);
      }
      return;
    }

    if (mob.kind === 'wolf' && !mob.tamed) {
      if (distToPlayer < 10 && Math.random() < 0.002) mob.state = 'chase';
      if (mob.state === 'chase') this._moveToward(mob, this.player.position, dt);
      else this._wander(mob, dt, mob.homePos, 12);
      return;
    }

    if (mob.isVillager) {
      this._runVillagerRoutine(mob, dt, elapsed);
    }
  }

  _moveToward(mob, targetPos, dt) {
    const dx = targetPos.x - mob.position.x, dz = targetPos.z - mob.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return;
    mob.yaw = Math.atan2(dx, dz);
    const spd = mob.speed;
    mob.velocity.x = (dx / dist) * spd;
    mob.velocity.z = (dz / dist) * spd;
    if (mob.onGround && this._blockedAhead(mob)) mob.velocity.y = 7.2;
    mob.animateWalk(performance.now() * 0.005, true);
  }

  _moveAway(mob, fromPos, dt) {
    const dx = mob.position.x - fromPos.x, dz = mob.position.z - fromPos.z;
    const dist = Math.hypot(dx, dz) || 1;
    mob.yaw = Math.atan2(dx, dz);
    mob.velocity.x = (dx / dist) * mob.speed * 1.3;
    mob.velocity.z = (dz / dist) * mob.speed * 1.3;
    if (mob.onGround && this._blockedAhead(mob)) mob.velocity.y = 7.2;
    mob.animateWalk(performance.now() * 0.005, true);
  }

  _wander(mob, dt, home, radius) {
    if (mob.stateTimer <= 0) {
      mob.stateTimer = 2 + Math.random() * 3;
      mob.wanderAngle = Math.random() * Math.PI * 2;
      mob.moving = Math.random() < 0.6;
    }
    if (mob.moving) {
      const dx = Math.cos(mob.wanderAngle), dz = Math.sin(mob.wanderAngle);
      const distFromHome = mob.position.distanceTo(home);
      if (distFromHome > radius) {
        mob.yaw = Math.atan2(home.x - mob.position.x, home.z - mob.position.z);
      } else {
        mob.yaw = Math.atan2(dx, dz);
      }
      mob.velocity.x = Math.sin(mob.yaw) * mob.speed * 0.4;
      mob.velocity.z = Math.cos(mob.yaw) * mob.speed * 0.4;
      if (mob.onGround && this._blockedAhead(mob)) mob.velocity.y = 6.6;
    } else {
      mob.velocity.x *= 0.8; mob.velocity.z *= 0.8;
    }
    mob.animateWalk(performance.now() * 0.005, mob.moving);
  }

  _blockedAhead(mob) {
    const fx = mob.position.x + Math.sin(mob.yaw) * 0.5;
    const fz = mob.position.z + Math.cos(mob.yaw) * 0.5;
    return isSolid(this.world.getBlock(Math.floor(fx), Math.floor(mob.position.y), Math.floor(fz)));
  }

  _runVillagerRoutine(mob, dt, elapsed) {
    // simple day cycle routine: work by day (wander near workplace), home at night
    const dayPhase = elapsed % 1;
    const isNightNow = dayPhase < 0.22 || dayPhase > 0.78;
    const target = isNightNow ? (mob.homePos) : (mob.workPos || mob.homePos);
    this._wander(mob, dt, target, isNightNow ? 2 : 8);
  }

  _fireProjectile(mob) {
    const dir = new THREE.Vector3(this.player.position.x - mob.position.x, (this.player.position.y + 1) - (mob.position.y + 1.2), this.player.position.z - mob.position.z).normalize();
    const geo = new THREE.ConeGeometry(0.05, 0.4, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xdadada });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(mob.position.x, mob.position.y + 1.2, mob.position.z);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.world.scene.add(mesh);
    this.projectiles.push({ mesh, velocity: dir.multiplyScalar(14), damage: mob.damage, life: 3, fromMob: true });
  }

  fireArrowFromPlayer(origin, dir, damage) {
    const geo = new THREE.ConeGeometry(0.05, 0.4, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf0e6c8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.world.scene.add(mesh);
    this.projectiles.push({ mesh, velocity: dir.clone().multiplyScalar(28), damage, life: 3, fromMob: false });
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 9.8 * dt * 0.4;

      let hit = false;
      if (p.fromMob) {
        if (p.mesh.position.distanceTo(this.player.position.clone().add(new THREE.Vector3(0, 1, 0))) < 0.7) {
          this.onPlayerHit?.(p.damage, null);
          hit = true;
        }
      } else {
        for (const mob of this.mobs) {
          if (p.mesh.position.distanceTo(mob.position.clone().add(new THREE.Vector3(0, 1, 0))) < mob.radius + 0.5) {
            const died = mob.takeDamage(p.damage, this.player.position);
            hit = true;
            break;
          }
        }
      }

      if (hit || p.life <= 0 || isSolid(this.world.getBlock(Math.floor(p.mesh.position.x), Math.floor(p.mesh.position.y), Math.floor(p.mesh.position.z)))) {
        this.world.scene.remove(p.mesh);
        p.mesh.geometry.dispose(); p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  meleeAttack(origin, dir, range, damage) {
    let closest = null, closestDist = range;
    for (const mob of this.mobs) {
      const toMob = mob.position.clone().add(new THREE.Vector3(0, mob.height / 2, 0)).sub(origin);
      const dist = toMob.length();
      if (dist > range) continue;
      const angle = toMob.normalize().angleTo(dir);
      if (angle < 0.55 && dist < closestDist) { closest = mob; closestDist = dist; }
    }
    if (closest) {
      const died = closest.takeDamage(damage, origin);
      return { mob: closest, died };
    }
    return null;
  }

  tameNearby(playerPos, itemUsed) {
    for (const mob of this.mobs) {
      if (!mob.isTameable || mob.tamed) continue;
      if (mob.position.distanceTo(playerPos) < 3) {
        const chance = itemUsed ? 0.55 : 0.15;
        if (Math.random() < chance) {
          mob.tamed = true; mob.owner = 'player';
          return mob;
        }
        return null;
      }
    }
    return null;
  }

  findMountable(playerPos) {
    for (const mob of this.mobs) {
      if (mob.tamed && mob.owner === 'player' && !mob.rider && mob.position.distanceTo(playerPos) < 3) return mob;
    }
    return null;
  }
}
