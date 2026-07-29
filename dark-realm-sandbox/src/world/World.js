// ============================================================================
// World: manages the chunk grid around the player, streaming generation,
// meshing, and provides a unified block get/set API used by physics,
// interaction and game systems.
// ============================================================================
import * as THREE from 'three';
import { Chunk } from './Chunk.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, RENDER_DISTANCE } from '../core/Config.js';
import { BlockId, isSolid } from './Blocks.js';
import { terrainGen } from './TerrainGenerator.js';
import { decorateChunk } from './Vegetation.js';
import { generateAtlas } from './TextureAtlas.js';
import { createOpaqueMaterial, createTransparentMaterial, createCrossMaterial, createWaterMaterial } from './Materials.js';
import { StructureGenerator } from './Structures.js';

export class World {
  constructor(scene, renderDistance = RENDER_DISTANCE) {
    this.scene = scene;
    this.chunks = new Map(); // key "cx,cz" -> Chunk
    this.renderDistance = renderDistance;
    this.pendingGeneration = new Set();
    this.generationQueue = [];
    this.meshQueue = [];
    this.centerChunk = { cx: 0, cz: 0 };
    this.listeners = { blockChange: [] };
    this.time = 0;

    const atlas = generateAtlas();
    this.atlas = atlas;
    this.opaqueMaterial = createOpaqueMaterial(atlas.texture);
    this.transparentMaterial = createTransparentMaterial(atlas.texture);
    this.crossMaterial = createCrossMaterial(atlas.texture);
    this.waterMaterial = createWaterMaterial(atlas.texture);

    this.chunkGroup = new THREE.Group();
    this.chunkGroup.name = 'chunks';
    this.scene.add(this.chunkGroup);

    this.lightPositions = []; // aggregated torch/glow light sources [x,y,z,strength]

    this.structureGen = new StructureGenerator(terrainGen);
    this.pendingSpawns = []; // structure spawn requests waiting to be consumed by MobManager/loot
  }

  key(cx, cz) { return `${cx},${cz}`; }

  chunkAt(cx, cz) { return this.chunks.get(this.key(cx, cz)); }

  worldToChunk(wx, wz) {
    return { cx: Math.floor(wx / CHUNK_SIZE), cz: Math.floor(wz / CHUNK_SIZE) };
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return BlockId.AIR;
    const { cx, cz } = this.worldToChunk(wx, wz);
    const chunk = this.chunkAt(cx, cz);
    if (!chunk) return BlockId.AIR; // treat ungenerated as air (avoids collisions pre-load)
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    return chunk.getLocal(lx, Math.floor(wy), lz);
  }

  setBlock(wx, wy, wz, block, { skipMesh = false } = {}) {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return false;
    const { cx, cz } = this.worldToChunk(wx, wz);
    const chunk = this.chunkAt(cx, cz);
    if (!chunk) return false;
    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    chunk.setLocal(lx, Math.floor(wy), lz, block);
    if (!skipMesh) {
      chunk.buildMesh(this.atlas);
      // rebuild neighbor chunks if the edit is on a border (face culling needs update)
      if (lx === 0) this._rebuildIfExists(cx - 1, cz);
      if (lx === CHUNK_SIZE - 1) this._rebuildIfExists(cx + 1, cz);
      if (lz === 0) this._rebuildIfExists(cx, cz - 1);
      if (lz === CHUNK_SIZE - 1) this._rebuildIfExists(cx, cz + 1);
      this._refreshLights();
    }
    for (const cb of this.listeners.blockChange) cb(wx, wy, wz, block);
    return true;
  }

  _rebuildIfExists(cx, cz) {
    const c = this.chunkAt(cx, cz);
    if (c && c.ready) c.buildMesh(this.atlas);
  }

  onBlockChange(cb) { this.listeners.blockChange.push(cb); }

  isSolidAt(wx, wy, wz) { return isSolid(this.getBlock(wx, wy, wz)); }

  getHeightAt(wx, wz) {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (isSolid(this.getBlock(wx, y, wz))) return y;
    }
    return 1;
  }

  // -- Streaming ------------------------------------------------------
  update(playerX, playerZ, budgetMs = 8) {
    const { cx, cz } = this.worldToChunk(playerX, playerZ);
    this.centerChunk = { cx, cz };

    // enqueue missing chunks within radius, sorted by distance
    const needed = [];
    for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
      for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
        const dist2 = dx * dx + dz * dz;
        if (dist2 > this.renderDistance * this.renderDistance) continue;
        const ncx = cx + dx, ncz = cz + dz;
        const k = this.key(ncx, ncz);
        if (!this.chunks.has(k) && !this.pendingGeneration.has(k)) {
          needed.push({ ncx, ncz, dist2 });
        }
      }
    }
    needed.sort((a, b) => a.dist2 - b.dist2);
    for (const n of needed) {
      this.pendingGeneration.add(this.key(n.ncx, n.ncz));
      this.generationQueue.push(n);
    }
    this.generationQueue.sort((a, b) => a.dist2 - b.dist2);

    const start = performance.now();
    while (this.generationQueue.length && performance.now() - start < budgetMs) {
      const { ncx, ncz } = this.generationQueue.shift();
      this._generateChunk(ncx, ncz);
    }
    let meshedAny = false;
    while (this.meshQueue.length && performance.now() - start < budgetMs * 1.6) {
      const chunk = this.meshQueue.shift();
      if (chunk && !chunk.disposed) { chunk.buildMesh(this.atlas); meshedAny = true; }
    }
    if (meshedAny) this._refreshLights();

    // unload far chunks
    const unloadDist = this.renderDistance + 2;
    for (const [k, chunk] of this.chunks) {
      const dx = chunk.cx - cx, dz = chunk.cz - cz;
      if (dx * dx + dz * dz > unloadDist * unloadDist) {
        this.chunkGroup.remove(chunk.group);
        chunk.dispose();
        this.chunks.delete(k);
      }
    }
  }

  _generateChunk(cx, cz) {
    const k = this.key(cx, cz);
    const chunk = new Chunk(this, cx, cz);
    const { data, heightMap, biomeMap } = terrainGen.generateChunkData(cx, cz);
    chunk.data.set(data);
    chunk.heightMap = heightMap;
    chunk.biomeMap = biomeMap;
    decorateChunk(chunk.data, cx, cz, terrainGen);
    const spawns = this.structureGen.applyToChunk(chunk.data, cx, cz);
    if (spawns.length) this.pendingSpawns.push(...spawns);
    this.chunks.set(k, chunk);
    this.chunkGroup.add(chunk.group);
    this.pendingGeneration.delete(k);
    this.meshQueue.push(chunk);
  }

  consumeSpawns() {
    const s = this.pendingSpawns;
    this.pendingSpawns = [];
    return s;
  }

  ensureSpawnArea(playerX, playerZ, radius = 2) {
    const { cx, cz } = this.worldToChunk(playerX, playerZ);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const ncx = cx + dx, ncz = cz + dz;
        if (!this.chunkAt(ncx, ncz)) this._generateChunk(ncx, ncz);
      }
    }
    for (const chunk of this.chunks.values()) {
      if (chunk.dirty) chunk.buildMesh(this.atlas);
    }
  }

  findSpawnPoint() {
    let wx = 0, wz = 0;
    for (let r = 0; r < 400; r += 4) {
      const angle = r * 0.7;
      wx = Math.round(Math.cos(angle) * r);
      wz = Math.round(Math.sin(angle) * r);
      const { height, biome, isRiver } = terrainGen.getHeightAndBiome(wx, wz);
      if (!isRiver && biome !== 'ocean' && height > 30) break;
    }
    const h = terrainGen.getHeightAndBiome(wx, wz).height;
    return { x: wx + 0.5, y: h + 2, z: wz + 0.5 };
  }

  _refreshLights() {
    const lights = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.torchLights) for (const l of chunk.torchLights) lights.push(l);
    }
    this.lightPositions = lights;
  }

  updateMaterialsTime(t) {
    this.time = t;
    for (const mat of [this.transparentMaterial, this.crossMaterial, this.waterMaterial]) {
      if (mat.userData.windUniforms) mat.userData.windUniforms.uTime.value = t;
    }
  }
}
