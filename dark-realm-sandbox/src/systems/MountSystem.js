// ============================================================================
// Mount system: lets the player ride a tamed creature (horse/wolf), taking
// direct control of its movement while the player's own physics are
// suspended. Camera follows from the rider's eye position on the mount.
// ============================================================================
import * as THREE from 'three';
import { isSolid } from '../world/Blocks.js';

export class MountSystem {
  constructor(world, player) {
    this.world = world;
    this.player = player;
    this.current = null;
  }

  mount(mob) {
    if (!mob || !mob.tamed) return false;
    this.current = mob;
    mob.rider = this.player;
    this.player.mountedOn = mob;
    return true;
  }

  dismount() {
    if (!this.current) return;
    this.current.rider = null;
    this.player.mountedOn = null;
    this.player.position.copy(this.current.position).add(new THREE.Vector3(1, 0.2, 0));
    this.current = null;
  }

  update(dt, movementIntent, camera) {
    if (!this.current) return;
    const mob = this.current;
    const { forward, right, jump } = movementIntent;

    const sinYaw = Math.sin(this.player.yaw), cosYaw = Math.cos(this.player.yaw);
    const moveX = (right * cosYaw - forward * sinYaw);
    const moveZ = (-right * sinYaw - forward * cosYaw);
    const len = Math.hypot(moveX, moveZ);

    if (len > 0.01) {
      mob.yaw = Math.atan2(moveX, moveZ);
      const spd = mob.mountSpeed || 8;
      mob.velocity.x = (moveX / len) * spd;
      mob.velocity.z = (moveZ / len) * spd;
      mob.animateWalk(performance.now() * 0.006, true);
    } else {
      mob.velocity.x *= 0.85;
      mob.velocity.z *= 0.85;
      mob.animateWalk(performance.now() * 0.006, false);
    }

    if (jump && mob.onGround) mob.velocity.y = 8.4;
    mob.velocity.y -= 28 * dt;

    mob.applyPhysics(dt);
    mob.syncMesh();

    this.player.position.copy(mob.position);
    this.player.yaw = mob.yaw;
    camera.position.set(mob.position.x, mob.position.y + mob.height + 0.6, mob.position.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.player.yaw;
    camera.rotation.x = this.player.pitch;
  }
}
