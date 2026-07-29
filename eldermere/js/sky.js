// ============ ELDERMERE — Cielo: día/noche, clima, niebla, partículas ============
import * as THREE from 'three';
import { CONFIG, BIOMES, SEASONS } from './config.js';

const { DAY_LENGTH, DAYS_PER_SEASON } = CONFIG;

// Claves del ciclo día/noche: hora (0..1, 0.25=amanecer, 0.5=mediodía, 0.75=atardecer, 0/1=medianoche)
const SKY_KEYS = [
  { t: 0.00, sky: 0x0a0e1e, fog: 0x0a0e1e, sun: 0.0,  amb: 0.22, hemi: 0.10 },
  { t: 0.20, sky: 0x141c38, fog: 0x141c38, sun: 0.0,  amb: 0.24, hemi: 0.12 },
  { t: 0.25, sky: 0xc8784a, fog: 0xd8986a, sun: 0.35, amb: 0.38, hemi: 0.28 },  // amanecer
  { t: 0.32, sky: 0x87b5d9, fog: 0xbfd4e8, sun: 0.85, amb: 0.55, hemi: 0.55 },
  { t: 0.50, sky: 0x7ab3e0, fog: 0xc4d8ec, sun: 1.15, amb: 0.62, hemi: 0.72 },  // mediodía
  { t: 0.68, sky: 0x86aec9, fog: 0xb8c8d8, sun: 0.8,  amb: 0.52, hemi: 0.5 },
  { t: 0.75, sky: 0xd97a4a, fog: 0xc98858, sun: 0.4,  amb: 0.4,  hemi: 0.3 },   // atardecer
  { t: 0.82, sky: 0x1c2444, fog: 0x1c2444, sun: 0.05, amb: 0.26, hemi: 0.14 },
  { t: 1.00, sky: 0x0a0e1e, fog: 0x0a0e1e, sun: 0.0,  amb: 0.22, hemi: 0.10 },
];

function lerpKeys(keys, t) {
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      const lerpC = (ca, cb) => new THREE.Color(ca).lerp(new THREE.Color(cb), k);
      return { sky: lerpC(a.sky, b.sky), fog: lerpC(a.fog, b.fog),
        sun: a.sun + (b.sun - a.sun) * k, amb: a.amb + (b.amb - a.amb) * k, hemi: a.hemi + (b.hemi - a.hemi) * k };
    }
  }
  const e = keys[keys.length - 1];
  return { sky: new THREE.Color(e.sky), fog: new THREE.Color(e.fog), sun: e.sun, amb: e.amb, hemi: e.hemi };
}

const WEATHERS = ['clear', 'clear', 'clear', 'rain', 'storm', 'fog', 'snow'];

export class Sky {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.timeOfDay = 0.32;      // empezar de mañana
    this.dayCount = 1;
    this.weather = 'clear';
    this.weatherTimer = 40;
    this.fogNear = 30; this.fogFar = 110;
    this.targetFogDensity = 0.008;

    scene.fog = new THREE.FogExp2(0xbfd4e8, 0.008);

    // Sol (directional con sombras suaves)
    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 220;
    const s = 55;
    this.sun.shadow.camera.left = -s; this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s; this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.radius = 4;               // sombras suaves
    scene.add(this.sun); scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x8aa8d0, 0.0);
    scene.add(this.moon); scene.add(this.moon.target);

    this.ambient = new THREE.AmbientLight(0xbfd4e8, 0.5);
    scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xbad4f0, 0x54503c, 0.5);
    scene.add(this.hemi);

    // Luz puntual que sigue al jugador (antorchas cercanas simuladas por main)
    this.playerLight = new THREE.PointLight(0xffb43a, 0, 14, 1.8);
    scene.add(this.playerLight);

    // Sol y luna visibles (sprites)
    const sunTex = this.makeDiscTexture('#ffedb8', '#ffb43a');
    const moonTex = this.makeDiscTexture('#e8eef8', '#8aa8d0');
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }));
    this.sunSprite.scale.set(28, 28, 1);
    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, fog: false, depthWrite: false }));
    this.moonSprite.scale.set(18, 18, 1);
    scene.add(this.sunSprite, this.moonSprite);

    // Estrellas
    this.stars = this.makeStars();
    scene.add(this.stars);

    // Nubes low-poly
    this.clouds = this.makeClouds();
    scene.add(this.clouds);

    // Partículas de polvo en rayos de luz
    this.dust = this.makeDust();
    scene.add(this.dust);

    // Precipitación (lluvia/nieve)
    this.precip = this.makePrecip();
    scene.add(this.precip.points);
    this.precipActive = 0;
  }

  makeDiscTexture(inner, outer) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, inner); g.addColorStop(0.45, inner); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  makeStars() {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      const r = 380;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) + 30;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xdde8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    return new THREE.Points(geo, mat);
  }

  makeClouds() {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, fog: false });
    this.cloudMat = mat;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 26; i++) {
      const cloud = new THREE.Group();
      const nBoxes = 2 + (Math.random() * 3 | 0);
      for (let j = 0; j < nBoxes; j++) {
        const b = new THREE.Mesh(geo, mat);
        b.scale.set(10 + Math.random() * 22, 2.5 + Math.random() * 2, 7 + Math.random() * 14);
        b.position.set(j * 9 - nBoxes * 4, Math.random() * 1.5, Math.random() * 8 - 4);
        cloud.add(b);
      }
      cloud.position.set((Math.random() - 0.5) * 420, 86 + Math.random() * 16, (Math.random() - 0.5) * 420);
      cloud.userData.speed = 0.7 + Math.random() * 0.8;
      group.add(cloud);
    }
    return group;
  }

  makeDust() {
    const n = 320, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
      seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffe9b0, size: 0.08, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.userData.seed = seed;
    pts.frustumCulled = false;
    return pts;
  }

  makePrecip() {
    const n = 1800, pos = new Float32Array(n * 3), vel = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      vel[i] = 18 + Math.random() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9ec8e8, size: 0.14, transparent: true, opacity: 0, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return { points, vel, n };
  }

  get season() { return Math.floor((this.dayCount - 1) / DAYS_PER_SEASON) % 4; }
  get seasonInfo() { return SEASONS[this.season]; }
  get isNight() { return this.timeOfDay < 0.24 || this.timeOfDay > 0.8; }

  dayPhaseName() {
    const t = this.timeOfDay;
    if (t < 0.22 || t > 0.85) return 'Noche';
    if (t < 0.3) return 'Amanecer';
    if (t < 0.45) return 'Mañana';
    if (t < 0.6) return 'Mediodía';
    if (t < 0.72) return 'Tarde';
    return 'Atardecer';
  }
  weatherName() {
    return { clear: 'Despejado', rain: '🌧 Lluvia', storm: '⛈ Tormenta', fog: '🌫 Niebla densa', snow: '🌨 Nevada' }[this.weather];
  }

  update(dt, playerPos, biomeKey) {
    // avance del tiempo
    const prev = this.timeOfDay;
    this.timeOfDay += dt / DAY_LENGTH;
    if (this.timeOfDay >= 1) { this.timeOfDay -= 1; this.dayCount++; }

    // clima dinámico
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const roll = Math.random();
      let w = WEATHERS[(roll * WEATHERS.length) | 0];
      if (w === 'snow' && this.season !== 3 && biomeKey !== 'TUNDRA' && biomeKey !== 'MOUNTAIN') w = 'rain';
      if (this.season === 3 && (w === 'rain' || w === 'storm')) w = 'snow';
      this.weather = w;
      this.weatherTimer = 60 + Math.random() * 120;
    }

    const k = lerpKeys(SKY_KEYS, this.timeOfDay);
    const season = this.seasonInfo;

    // niebla: bioma + clima + estación
    let density = 0.0075 * season.fogMul;
    if (this.weather === 'fog') density *= 3.4;
    else if (this.weather === 'rain') density *= 1.7;
    else if (this.weather === 'storm') density *= 2.0;
    else if (this.weather === 'snow') density *= 2.2;
    this.targetFogDensity = density;
    this.scene.fog.density += (density - this.scene.fog.density) * Math.min(1, dt * 0.8);

    // tinte de bioma mezclado
    const biome = BIOMES[biomeKey];
    const fogCol = k.fog.clone();
    if (biome) fogCol.lerp(new THREE.Color(biome.fogTint), 0.25);
    if (this.weather === 'storm') fogCol.multiplyScalar(0.55);
    if (this.weather === 'rain') fogCol.multiplyScalar(0.75);
    this.scene.fog.color.copy(fogCol);

    const skyCol = k.sky.clone();
    if (this.weather === 'storm') skyCol.multiplyScalar(0.5);
    else if (this.weather === 'rain' || this.weather === 'snow') skyCol.multiplyScalar(0.72);
    this.scene.background = skyCol;

    // sol / luna
    const ang = (this.timeOfDay - 0.25) * Math.PI * 2;   // 0.25 => horizonte este
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    const sunI = Math.max(0, k.sun) * (this.weather === 'storm' ? 0.35 : this.weather === 'clear' ? 1 : 0.6);
    this.sun.intensity = sunI;
    this.sun.color.setHSL(0.09, 0.5, this.timeOfDay > 0.7 || this.timeOfDay < 0.3 ? 0.62 : 0.72);
    this.sun.position.copy(playerPos).addScaledVector(sunDir, 110);
    this.sun.target.position.copy(playerPos);
    this.sunSprite.position.copy(playerPos).addScaledVector(sunDir, 330);
    this.sunSprite.material.opacity = Math.max(0, Math.min(1, sunDir.y * 3)) * (this.weather === 'clear' ? 1 : 0.25);

    const moonI = this.isNight ? 0.34 : 0;
    this.moon.intensity = moonI;
    this.moon.position.copy(playerPos).addScaledVector(sunDir, -110);
    this.moon.target.position.copy(playerPos);
    this.moonSprite.position.copy(playerPos).addScaledVector(sunDir, -320);
    this.moonSprite.material.opacity = this.isNight ? 0.9 : 0;

    this.ambient.intensity = k.amb * (this.weather === 'storm' ? 0.7 : 1);
    this.ambient.color.copy(fogCol).lerp(new THREE.Color(0xffffff), 0.3);
    this.hemi.intensity = k.hemi;
    this.stars.material.opacity = this.isNight ? 0.9 : 0;
    this.stars.position.copy(playerPos);

    // nubes: siguen al jugador y derivan con el viento
    for (const c of this.clouds.children) {
      c.position.x += c.userData.speed * dt;
      const dx = c.position.x - playerPos.x, dz = c.position.z - playerPos.z;
      if (dx > 240) c.position.x -= 480; if (dx < -240) c.position.x += 480;
      if (dz > 240) c.position.z -= 480; if (dz < -240) c.position.z += 480;
    }
    this.cloudMat.opacity = this.weather === 'clear' ? 0.5 : 0.8;

    // polvo en rayos de luz (visible de día con sol)
    const dustOn = sunI > 0.4 && this.weather === 'clear';
    this.dust.material.opacity += ((dustOn ? 0.5 : 0) - this.dust.material.opacity) * Math.min(1, dt * 2);
    if (this.dust.material.opacity > 0.02) {
      this.dust.position.set(playerPos.x, Math.max(0, playerPos.y - 6), playerPos.z);
      const p = this.dust.geometry.attributes.position, seed = this.dust.userData.seed;
      const t = performance.now() * 0.001;
      for (let i = 0; i < p.count; i++) {
        p.array[i * 3] += Math.sin(t * 0.4 + seed[i]) * 0.004;
        p.array[i * 3 + 1] += Math.cos(t * 0.3 + seed[i] * 2) * 0.003 + 0.0012;
        if (p.array[i * 3 + 1] > 14) p.array[i * 3 + 1] = 0;
      }
      p.needsUpdate = true;
    }

    // precipitación
    const precipOn = this.weather === 'rain' || this.weather === 'storm' || this.weather === 'snow';
    const mat = this.precip.points.material;
    mat.opacity += ((precipOn ? (this.weather === 'storm' ? 0.85 : 0.6) : 0) - mat.opacity) * Math.min(1, dt * 1.5);
    if (this.weather === 'snow') { mat.size = 0.22; mat.color.set(0xeef4f8); }
    else { mat.size = 0.13; mat.color.set(0x9ec8e8); }
    if (mat.opacity > 0.02) {
      this.precip.points.position.set(playerPos.x, playerPos.y - 8, playerPos.z);
      const p = this.precip.points.geometry.attributes.position;
      const fall = this.weather === 'snow' ? 0.3 : 1;
      const t = performance.now() * 0.001;
      for (let i = 0; i < this.precip.n; i++) {
        p.array[i * 3 + 1] -= this.precip.vel[i] * dt * fall;
        if (this.weather === 'snow') p.array[i * 3] += Math.sin(t + i) * 0.008;
        if (p.array[i * 3 + 1] < 0) {
          p.array[i * 3 + 1] = 30;
          p.array[i * 3] = (Math.random() - 0.5) * 60;
          p.array[i * 3 + 2] = (Math.random() - 0.5) * 60;
        }
      }
      p.needsUpdate = true;
    }
  }
}
