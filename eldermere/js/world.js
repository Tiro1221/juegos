// ============ ELDERMERE — Gestor de chunks voxel + mesher ============
import * as THREE from 'three';
import { CONFIG, BLOCKS, ID_TO_BLOCK } from './config.js';
import { generateChunk, columnData, biomeAt } from './worldgen.js';

const { CHUNK, WORLD_H, RENDER_DIST } = CONFIG;
const idx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;

// Caras: dirección y vértices de cada quad (orden CCW visto desde fuera)
const FACES = [
  { dir: [1, 0, 0],  corners: [[1,1,1],[1,0,1],[1,0,0],[1,1,0]] },   // +x
  { dir: [-1, 0, 0], corners: [[0,1,0],[0,0,0],[0,0,1],[0,1,1]] },   // -x
  { dir: [0, 1, 0],  corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },   // +y
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },   // -y
  { dir: [0, 0, 1],  corners: [[0,1,1],[0,0,1],[1,0,1],[1,1,1]] },   // +z
  { dir: [0, 0, -1], corners: [[1,1,0],[1,0,0],[0,0,0],[0,1,0]] },   // -z
];
const FACE_SHADE = [0.82, 0.82, 1.0, 0.55, 0.72, 0.72];

export class World {
  constructor(scene, atlas) {
    this.scene = scene;
    this.atlas = atlas;
    this.chunks = new Map();          // "cx,cz" -> { data:Uint8Array(ids), props, meshes:[], dirty }
    this.edits = new Map();           // "x,y,z" -> blockKey (modificaciones del jugador)
    this.matOpaque = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true });
    this.matTrans = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });
    this.matLeaves = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true, transparent: true, opacity: 0.95, alphaTest: 0.1 });
    this.grassColor = new THREE.Color();
    this.seasonSat = 1.0;
    this.pendingProps = [];           // props de chunks nuevos que main debe consumir
  }

  key(cx, cz) { return cx + ',' + cz; }

  // ---------- Acceso a bloques (coordenadas de mundo) ----------
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_H) return wy < 0 ? 'bedrock' : 'air';
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return 'air';
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    return ch.data[idx(lx, wy, lz)];
  }
  setBlock(wx, wy, wz, name) {
    if (wy < 0 || wy >= WORLD_H) return;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return;
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    ch.data[idx(lx, wy, lz)] = name;
    ch.dirty = true;
    // marcar vecinos si está en el borde
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK - 1) this.markDirty(cx, cz + 1);
  }
  markDirty(cx, cz) { const c = this.chunks.get(this.key(cx, cz)); if (c) c.dirty = true; }

  isSolid(wx, wy, wz) {
    const b = BLOCKS[this.getBlock(wx, wy, wz)];
    return !!(b && b.solid !== false && !b.liquid);
  }
  isLiquid(wx, wy, wz) {
    const b = BLOCKS[this.getBlock(wx, wy, wz)];
    return !!(b && b.liquid);
  }

  // ---------- Generación / streaming ----------
  ensureChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (this.chunks.has(k)) return this.chunks.get(k);
    const gen = generateChunk(cx, cz);
    // convertir nombres -> ids, aplicando edits del jugador
    const data = new Uint8Array(CHUNK * CHUNK * WORLD_H);
    for (let i = 0; i < data.length; i++) {
      const name = gen.data[i];
      data[i] = typeof name === 'string' ? (BLOCKS[name] ? BLOCKS[name].id : 0) : 0;
    }
    const chunk = { data, props: gen.props, meshes: [], dirty: true, cx, cz };
    this.chunks.set(k, chunk);
    this.pendingProps.push(gen.props);
    return chunk;
  }

  update(px, pz, buildBudget = 2) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    // crear chunks nuevos (en anillo, del centro hacia fuera)
    let built = 0;
    for (let r = 0; r <= RENDER_DIST && built < buildBudget; r++) {
      for (let dx = -r; dx <= r && built < buildBudget; dx++) {
        for (let dz = -r; dz <= r && built < buildBudget; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = pcx + dx, cz = pcz + dz;
          if (!this.chunks.has(this.key(cx, cz))) { this.ensureChunk(cx, cz); built++; }
        }
      }
    }
    // descartar lejanos
    for (const [k, ch] of this.chunks) {
      if (Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz)) > RENDER_DIST + 1) {
        for (const m of ch.meshes) { this.scene.remove(m); m.geometry.dispose(); }
        this.chunks.delete(k);
      }
    }
    // reconstruir sucios
    let rebuilt = 0;
    for (const [, ch] of this.chunks) {
      if (ch.dirty && rebuilt < 3) { this.buildMesh(ch); rebuilt++; }
    }
  }

  // ---------- Mesher ----------
  buildMesh(chunk) {
    chunk.dirty = false;
    for (const m of chunk.meshes) { this.scene.remove(m); m.geometry.dispose(); }
    chunk.meshes = [];

    const posOpaque = [], colOpaque = [], uvOpaque = [], idxOpaque = [];
    const posTrans = [], colTrans = [], uvTrans = [], idxTrans = [];
    const posLeaves = [], colLeaves = [], uvLeaves = [], idxLeaves = [];
    const cx0 = chunk.cx * CHUNK, cz0 = chunk.cz * CHUNK;

    const neighbor = (wx, wy, wz) => this.getBlock(wx, wy, wz);

    for (let y = 0; y < WORLD_H; y++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        for (let lx = 0; lx < CHUNK; lx++) {
          const id = chunk.data[idx(lx, y, lz)];
          if (id === 0) continue;
          const bkey = ID_TO_BLOCK[id];
          const b = BLOCKS[bkey];
          const wx = cx0 + lx, wz = cz0 + lz;

          // bloques "cross" (flores, antorchas, hongos): dos quads cruzados
          if (b.cross) { this.addCross(posLeaves, colLeaves, uvLeaves, idxLeaves, wx, y, wz, b); continue; }

          const targetTrans = b.transparent || b.liquid;
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nkey = neighbor(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
            const nb = BLOCKS[nkey];
            // culling
            if (nb && nb.solid !== false && !nb.transparent && !nb.liquid && !nb.cross) continue;
            if (targetTrans && nkey === bkey) continue;   // no caras internas entre agua-agua
            if (targetTrans && nb && (nb.transparent) && !nb.liquid && nkey !== 'air') continue;

            // elegir bucket
            let P, C, U, I;
            if (bkey === 'leaves' || bkey === 'leavesDark' || bkey === 'leavesSnow') { P = posLeaves; C = colLeaves; U = uvLeaves; I = idxLeaves; }
            else if (targetTrans) { P = posTrans; C = colTrans; U = uvTrans; I = idxTrans; }
            else { P = posOpaque; C = colOpaque; U = uvOpaque; I = idxOpaque; }

            // textura por cara
            const texName = f === 2 ? b.tex[0] : f === 3 ? b.tex[1] : b.tex[2];
            const [u0, v0, u1, v1] = this.atlas.uv(texName);
            const base = I.length ? P.length / 3 : P.length / 3;
            const shade = FACE_SHADE[f];
            // color: tinte de hierba por bioma en caras superiores de 'grass'
            let r = shade, g = shade, bl = shade;
            if (f === 2 && (bkey === 'grass' || bkey === 'snow' || bkey === 'mud' || bkey === 'farmland')) {
              const biome = BIOMES_BY_NAME[biomeAt(wx, wz)];
              if (bkey === 'grass' && biome) {
                const [hh, ss, ll] = biome.grassHue;
                this.grassColor.setHSL(hh, ss * this.seasonSat, ll);
                r *= this.grassColor.r * 1.9; g *= this.grassColor.g * 1.9; bl *= this.grassColor.b * 1.9;
              }
            }
            // hundir la cara superior del agua un poco
            const sink = (b.liquid && f === 2) ? 0.14 : 0;
            const uvs = [[u0, v1], [u0, v0], [u1, v0], [u1, v1]];
            for (let ci = 0; ci < 4; ci++) {
              const cnr = face.corners[ci];
              P.push(wx + cnr[0], y + cnr[1] - (cnr[1] === 1 ? sink : 0), wz + cnr[2]);
              C.push(r, g, bl);
              U.push(uvs[ci][0], uvs[ci][1]);
            }
            const vi = P.length / 3 - 4;
            I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
          }
        }
      }
    }

    const make = (P, C, U, I, mat) => {
      if (I.length === 0) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      geo.setIndex(I);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mat === this.matOpaque || mat === this.matLeaves;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      return mesh;
    };
    const m1 = make(posOpaque, colOpaque, uvOpaque, idxOpaque, this.matOpaque);
    const m2 = make(posTrans, colTrans, uvTrans, idxTrans, this.matTrans);
    const m3 = make(posLeaves, colLeaves, uvLeaves, idxLeaves, this.matLeaves);
    if (m1) chunk.meshes.push(m1);
    if (m2) chunk.meshes.push(m2);
    if (m3) chunk.meshes.push(m3);
  }

  addCross(P, C, U, I, wx, y, wz, b) {
    const [u0, v0, u1, v1] = this.atlas.uv(b.tex[2]);
    const quads = [
      [[0.15, 0, 0.15], [0.85, 0, 0.85]],
      [[0.85, 0, 0.15], [0.15, 0, 0.85]],
    ];
    for (const [a, c] of quads) {
      const vi = P.length / 3;
      P.push(wx + a[0], y, wz + a[2], wx + a[0], y + 1, wz + a[2], wx + c[0], y + 1, wz + c[2], wx + c[0], y, wz + c[2]);
      for (let i = 0; i < 4; i++) C.push(1, 1, 1);
      U.push(u0, v0, u0, v1, u1, v1, u1, v0);
      I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3, vi + 2, vi + 1, vi, vi + 3, vi + 2, vi);
    }
  }

  // ---------- Raycast voxel (DDA) ----------
  raycast(origin, dir, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
    let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
    let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxDist) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
      const bkey = this.getBlock(x, y, z);
      const b = BLOCKS[bkey];
      if (b && b.solid !== false && !b.liquid && bkey !== 'air') {
        return { x, y, z, nx, ny, nz, block: bkey, dist: t };
      }
    }
    return null;
  }

  surfaceHeight(wx, wz) {
    for (let y = WORLD_H - 1; y > 0; y--) {
      if (this.isSolid(wx, y, wz)) return y;
    }
    return 0;
  }
}

import { BIOMES } from './config.js';
const BIOMES_BY_NAME = BIOMES;
