// ============================================================================
// Chunk: holds voxel data for a CHUNK_SIZE x CHUNK_HEIGHT x CHUNK_SIZE column
// and builds/rebuilds its render meshes (opaque, transparent/leaves, water,
// cross-shaped crops) on demand.
// ============================================================================
import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../core/Config.js';
import { BlockId, getBlock, isSolid, isTransparent, isLiquid } from './Blocks.js';
import { uvForTile } from './TextureAtlas.js';

export const idx = (x, y, z) => x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;

// Face definitions: normal + 4 corner offsets (CCW) for each direction
const FACES = [
  { dir: [1, 0, 0], corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], side: 'side', ao: [[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]] },
  { dir: [-1, 0, 0], corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]], side: 'side' },
  { dir: [0, 1, 0], corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], side: 'top' },
  { dir: [0, -1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], side: 'bottom' },
  { dir: [0, 0, 1], corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], side: 'side' },
  { dir: [0, 0, -1], corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]], side: 'side' },
];

const GRASS_TINT = new THREE.Color(0x8fbf5a);
const LEAF_TINT = new THREE.Color(0x5a9a4a);
const WATER_COLOR = new THREE.Color(0x2f8fae);

export class Chunk {
  constructor(world, cx, cz) {
    this.world = world;
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
    this.heightMap = null;
    this.biomeMap = null;
    this.opaqueMesh = null;
    this.transparentMesh = null;
    this.waterMesh = null;
    this.crossMesh = null;
    this.torchLights = []; // world positions of light-emitting blocks
    this.ready = false;
    this.dirty = true;
    this.group = new THREE.Group();
    this.group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  }

  worldX() { return this.cx * CHUNK_SIZE; }
  worldZ() { return this.cz * CHUNK_SIZE; }

  inBounds(x, y, z) {
    return x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT;
  }

  getLocal(x, y, z) {
    if (!this.inBounds(x, y, z)) return BlockId.AIR;
    return this.data[idx(x, y, z)];
  }

  setLocal(x, y, z, block) {
    if (!this.inBounds(x, y, z)) return;
    this.data[idx(x, y, z)] = block;
    this.dirty = true;
  }

  // Queries a block that might be outside this chunk (delegates to world)
  getNeighborAware(x, y, z) {
    if (this.inBounds(x, y, z)) return this.data[idx(x, y, z)];
    return this.world.getBlock(this.worldX() + x, y, this.worldZ() + z);
  }

  buildMesh(atlas) {
    const opaquePos = [], opaqueNorm = [], opaqueUv = [], opaqueColor = [], opaqueIdx = [];
    const transPos = [], transNorm = [], transUv = [], transColor = [], transIdx = [];
    const waterPos = [], waterNorm = [], waterUv = [], waterIdx = [];
    const crossPos = [], crossNorm = [], crossUv = [], crossColor = [], crossIdx = [];
    this.torchLights = [];

    let oCount = 0, tCount = 0, wCount = 0, cCount = 0;

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const id = this.data[idx(x, y, z)];
          if (id === BlockId.AIR) continue;
          const def = getBlock(id);

          if (def.light) {
            this.torchLights.push([this.worldX() + x + 0.5, y + (def.name === 'Torch' ? 0.6 : 0.5), this.worldZ() + z + 0.5, def.light]);
          }

          if (def.cross) {
            // billboard cross-shaped plant (2 crossed quads)
            const tile = def.top;
            const { u0, v0, u1, v1 } = uvForTile(tile.col, tile.row, atlas.cols, atlas.rows);
            const cx = x + 0.5, cz = z + 0.5;
            const quads = [
              [[cx - 0.4, y, cz - 0.4], [cx - 0.4, y + 1, cz - 0.4], [cx + 0.4, y + 1, cz + 0.4], [cx + 0.4, y, cz + 0.4]],
              [[cx - 0.4, y, cz + 0.4], [cx - 0.4, y + 1, cz + 0.4], [cx + 0.4, y + 1, cz - 0.4], [cx + 0.4, y, cz - 0.4]],
            ];
            for (const q of quads) {
              const base = cCount;
              for (const p of q) crossPos.push(p[0], p[1], p[2]);
              crossNorm.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
              crossUv.push(u0,v0, u0,v1, u1,v1, u1,v0);
              for (let i = 0; i < 4; i++) crossColor.push(1,1,1);
              crossIdx.push(base, base+1, base+2, base, base+2, base+3);
              cCount += 4;
            }
            continue;
          }

          for (const face of FACES) {
            const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
            const neighbor = this.getNeighborAware(nx, ny, nz);
            const neighborDef = getBlock(neighbor);

            if (isLiquid(id)) {
              if (face.dir[1] !== 1) continue; // only render water top for simplicity + sides against air
              if (!isTransparent(neighbor) ) continue;
              if (isLiquid(neighbor)) continue;
              const base = wCount;
              for (const c of face.corners) waterPos.push(x + c[0], y + c[1] - 0.1, z + c[2]);
              for (let i = 0; i < 4; i++) waterNorm.push(...face.dir);
              waterUv.push(0,0, 0,1, 1,1, 1,0);
              waterIdx.push(base, base+1, base+2, base, base+2, base+3);
              wCount += 4;
              continue;
            }

            if (neighborDef.solid && !neighborDef.transparent) continue; // hidden face
            if (id === neighbor) continue; // same block type touching (e.g. leaves-leaves) - skip for perf except when transparent needed for glass-like; leaves ok to cull
            if (!def.transparent && neighborDef.solid && neighborDef.transparent === undefined) continue;

            const tileDef = face.side === 'top' ? (def.top || def.side) : face.side === 'bottom' ? (def.bottom || def.side) : (def.side || def.top);
            const { u0, v0, u1, v1 } = uvForTile(tileDef.col, tileDef.row, atlas.cols, atlas.rows);

            const targetPos = def.transparent ? transPos : opaquePos;
            const targetNorm = def.transparent ? transNorm : opaqueNorm;
            const targetUv = def.transparent ? transUv : opaqueUv;
            const targetColor = def.transparent ? transColor : opaqueColor;
            const targetIdx = def.transparent ? transIdx : opaqueIdx;
            const base = def.transparent ? tCount : oCount;

            for (const c of face.corners) targetPos.push(x + c[0], y + c[1], z + c[2]);
            for (let i = 0; i < 4; i++) targetNorm.push(...face.dir);
            targetUv.push(u0,v0, u0,v1, u1,v1, u1,v0);

            let tint = { r: 1, g: 1, b: 1 };
            if (def.tint) {
              const t = id === BlockId.LEAVES || id === BlockId.PALM_LEAVES ? LEAF_TINT : GRASS_TINT;
              tint = t;
            }
            // simple face-direction shading (fake AO / directional light bake)
            const shade = face.dir[1] === 1 ? 1.0 : (face.dir[1] === -1 ? 0.55 : (face.dir[0] !== 0 ? 0.78 : 0.85));
            for (let i = 0; i < 4; i++) targetColor.push(tint.r * shade, tint.g * shade, tint.b * shade);

            targetIdx.push(base, base+1, base+2, base, base+2, base+3);
            if (def.transparent) tCount += 4; else oCount += 4;
          }
        }
      }
    }

    this._disposeMeshes();

    if (oCount > 0) this.opaqueMesh = this._buildMeshFromArrays(opaquePos, opaqueNorm, opaqueUv, opaqueColor, opaqueIdx, this.world.opaqueMaterial);
    if (tCount > 0) this.transparentMesh = this._buildMeshFromArrays(transPos, transNorm, transUv, transColor, transIdx, this.world.transparentMaterial);
    if (cCount > 0) this.crossMesh = this._buildMeshFromArrays(crossPos, crossNorm, crossUv, crossColor, crossIdx, this.world.crossMaterial, true);
    if (wCount > 0) this.waterMesh = this._buildMeshFromArrays(waterPos, waterNorm, waterUv, null, waterIdx, this.world.waterMaterial);

    if (this.opaqueMesh) this.group.add(this.opaqueMesh);
    if (this.transparentMesh) this.group.add(this.transparentMesh);
    if (this.crossMesh) this.group.add(this.crossMesh);
    if (this.waterMesh) this.group.add(this.waterMesh);

    this.dirty = false;
    this.ready = true;
  }

  _buildMeshFromArrays(pos, norm, uv, color, indices, material, doubleSideGrass = false) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (color) geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = !doubleSideGrass;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }

  _disposeMeshes() {
    for (const m of [this.opaqueMesh, this.transparentMesh, this.crossMesh, this.waterMesh]) {
      if (m) {
        this.group.remove(m);
        m.geometry.dispose();
      }
    }
    this.opaqueMesh = this.transparentMesh = this.crossMesh = this.waterMesh = null;
  }

  dispose() {
    this._disposeMeshes();
  }
}
