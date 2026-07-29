// ============ ELDERMERE — Partículas de juego (rotura de bloques, magia) ============
import * as THREE from 'three';

const MAX = 700;

export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);      // 0 = muerta
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.14, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
    this.tmpColor = new THREE.Color();
  }

  emit(x, y, z, colorHex, n = 12, spread = 2.4, up = 3) {
    this.tmpColor.setHex(colorHex);
    for (let i = 0; i < n; i++) {
      const k = this.cursor; this.cursor = (this.cursor + 1) % MAX;
      this.pos[k * 3] = x + (Math.random() - 0.5) * 0.7;
      this.pos[k * 3 + 1] = y + Math.random() * 0.7;
      this.pos[k * 3 + 2] = z + (Math.random() - 0.5) * 0.7;
      this.vel[k * 3] = (Math.random() - 0.5) * spread;
      this.vel[k * 3 + 1] = Math.random() * up;
      this.vel[k * 3 + 2] = (Math.random() - 0.5) * spread;
      const shade = 0.7 + Math.random() * 0.5;
      this.col[k * 3] = this.tmpColor.r * shade;
      this.col[k * 3 + 1] = this.tmpColor.g * shade;
      this.col[k * 3 + 2] = this.tmpColor.b * shade;
      this.life[k] = 0.5 + Math.random() * 0.5;
    }
  }

  update(dt) {
    for (let k = 0; k < MAX; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      if (this.life[k] <= 0) { this.pos[k * 3 + 1] = -999; continue; }
      this.vel[k * 3 + 1] -= 9 * dt;
      this.pos[k * 3] += this.vel[k * 3] * dt;
      this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt;
      this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
