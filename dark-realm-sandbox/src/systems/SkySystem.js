// ============================================================================
// Dynamic sky, sun/moon, day-night cycle, dynamic lighting, fog and weather
// (rain, snow, storms, fog patches). Drives ambient mood of the dark-fantasy
// world.
// ============================================================================
import * as THREE from 'three';
import { DAY_LENGTH_SECONDS } from '../core/Config.js';

const SKY_TOP_DAY = new THREE.Color(0x4f8fd6);
const SKY_BOTTOM_DAY = new THREE.Color(0xbfe0f0);
const SKY_TOP_SUNSET = new THREE.Color(0xaa5a3f);
const SKY_BOTTOM_SUNSET = new THREE.Color(0xe6935a);
const SKY_TOP_NIGHT = new THREE.Color(0x030614);
const SKY_BOTTOM_NIGHT = new THREE.Color(0x0d1330);

const FOG_DAY = new THREE.Color(0xbcd6de);
const FOG_SUNSET = new THREE.Color(0xd69a72);
const FOG_NIGHT = new THREE.Color(0x03060f);
const FOG_STORM = new THREE.Color(0x2b3038);

export class SkySystem {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.timeOfDay = 0.28; // 0..1 (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
    this.dayLength = DAY_LENGTH_SECONDS;
    this.paused = false;
    this.weather = 'clear'; // clear | rain | snow | storm | fog
    this.weatherTimer = 0;
    this.nextWeatherCheck = 60 + Math.random() * 60;

    this._buildSkyDome();
    this._buildLights();
    this._buildStars();
    this._buildWeatherParticles();
    this._buildDustMotes();

    this.scene.fog = new THREE.FogExp2(0xbcd6de, 0.014);
  }

  _buildSkyDome() {
    const geo = new THREE.SphereGeometry(500, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: SKY_TOP_DAY.clone() },
        bottomColor: { value: SKY_BOTTOM_DAY.clone() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        starOpacity: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y * 0.5 + 0.5;
          vec3 col = mix(bottomColor, topColor, pow(max(h, 0.0), 0.55));
          float sunFactor = pow(max(dot(normalize(vWorldPos), normalize(sunDir)), 0.0), 12.0);
          col += vec3(1.0, 0.85, 0.55) * sunFactor * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthWrite: false,
    });
    this.skyDome = new THREE.Mesh(geo, mat);
    this.scene.add(this.skyDome);
  }

  _buildStars() {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 480;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.9); // upper hemisphere mostly
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi));
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, sizeAttenuation: false });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  _buildLights() {
    this.sun = new THREE.DirectionalLight(0xfff3d6, 1.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x8fa8d6, 0.0);
    this.scene.add(this.moon);

    this.hemi = new THREE.HemisphereLight(0x8fb0d0, 0x40372a, 0.65);
    this.scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x404050, 0.35);
    this.scene.add(this.ambient);
  }

  _buildWeatherParticles() {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.rainMat = new THREE.PointsMaterial({ color: 0x9fc4e0, size: 0.12, transparent: true, opacity: 0 });
    this.rain = new THREE.Points(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);

    const snowGeo = geo.clone();
    this.snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, transparent: true, opacity: 0 });
    this.snow = new THREE.Points(snowGeo, this.snowMat);
    this.snow.frustumCulled = false;
    this.scene.add(this.snow);

    this._weatherVelocities = new Float32Array(count).map(() => 6 + Math.random() * 4);
    this._weatherDrift = new Float32Array(count).map(() => (Math.random() - 0.5) * 1.2);
  }

  _buildDustMotes() {
    const count = 220;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = Math.random() * 8 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.dustMat = new THREE.PointsMaterial({ color: 0xffe8b0, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
    this._dustSeed = new Float32Array(count).map(() => Math.random() * Math.PI * 2);
  }

  setPaused(p) { this.paused = p; }

  update(dt, camera, playerPos, biomeFogColor) {
    if (!this.paused) {
      this.timeOfDay += dt / this.dayLength;
      if (this.timeOfDay >= 1) this.timeOfDay -= 1;
    }

    const t = this.timeOfDay;
    const angle = t * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(angle);
    const sunDir = new THREE.Vector3(Math.cos(angle) * 0.6, sunHeight, Math.sin(angle) * 0.4).normalize();

    this.sun.position.copy(playerPos).add(sunDir.clone().multiplyScalar(100));
    this.sun.target.position.copy(playerPos);
    this.sun.target.updateMatrixWorld();

    const dayFactor = THREE.MathUtils.clamp(sunHeight * 1.6 + 0.15, 0, 1);
    const sunsetFactor = THREE.MathUtils.clamp(1 - Math.abs(sunHeight) * 3.2, 0, 1) * (sunHeight > -0.15 ? 1 : 0);
    const nightFactor = THREE.MathUtils.clamp(-sunHeight * 1.6 + 0.15, 0, 1);

    this.sun.intensity = Math.max(0, sunHeight) * 1.5;
    this.sun.visible = sunHeight > -0.2;
    this.moon.position.copy(playerPos).add(sunDir.clone().multiplyScalar(-100));
    this.moon.intensity = Math.max(0, -sunHeight) * 0.55;

    this.hemi.intensity = 0.25 + dayFactor * 0.55;
    this.ambient.intensity = 0.15 + nightFactor * 0.25;

    // sky colors blend
    const top = new THREE.Color();
    const bottom = new THREE.Color();
    if (sunHeight > 0.25) {
      top.copy(SKY_TOP_DAY); bottom.copy(SKY_BOTTOM_DAY);
    } else if (sunHeight > -0.1) {
      const f = 1 - THREE.MathUtils.clamp((sunHeight + 0.1) / 0.35, 0, 1);
      top.copy(SKY_TOP_DAY).lerp(SKY_TOP_SUNSET, f);
      bottom.copy(SKY_BOTTOM_DAY).lerp(SKY_BOTTOM_SUNSET, f);
    } else {
      const f = THREE.MathUtils.clamp((-sunHeight - 0.1) / 0.3, 0, 1);
      top.copy(SKY_TOP_SUNSET).lerp(SKY_TOP_NIGHT, f);
      bottom.copy(SKY_BOTTOM_SUNSET).lerp(SKY_BOTTOM_NIGHT, f);
    }
    this.skyDome.material.uniforms.topColor.value.copy(top);
    this.skyDome.material.uniforms.bottomColor.value.copy(bottom);
    this.skyDome.material.uniforms.sunDir.value.copy(sunDir);
    this.skyDome.position.copy(playerPos);

    this.stars.material.opacity = nightFactor * 0.85;
    this.stars.position.copy(playerPos);

    // fog color blend of day/sunset/night + biome tint + weather
    let fogColor = new THREE.Color();
    if (sunHeight > 0.25) fogColor.copy(FOG_DAY);
    else if (sunHeight > -0.1) fogColor.copy(FOG_DAY).lerp(FOG_SUNSET, 1 - THREE.MathUtils.clamp((sunHeight + 0.1) / 0.35, 0, 1));
    else fogColor.copy(FOG_SUNSET).lerp(FOG_NIGHT, THREE.MathUtils.clamp((-sunHeight - 0.1) / 0.3, 0, 1));
    if (biomeFogColor) fogColor.lerp(new THREE.Color(biomeFogColor), 0.35);

    let fogDensity = 0.012;
    this._updateWeather(dt, playerPos);
    if (this.weather === 'storm') { fogColor.lerp(FOG_STORM, 0.6); fogDensity = 0.028; this.hemi.intensity *= 0.55; this.sun.intensity *= 0.4; }
    else if (this.weather === 'rain') { fogColor.lerp(FOG_STORM, 0.3); fogDensity = 0.02; }
    else if (this.weather === 'snow') { fogDensity = 0.02; }
    else if (this.weather === 'fog') { fogDensity = 0.045; }

    this.scene.fog.color.copy(fogColor);
    this.scene.fog.density = fogDensity;
    if (this.renderer) this.renderer.setClearColor(fogColor, 1);

    // dust motes drifting in light shafts
    const dpos = this.dust.geometry.attributes.position;
    for (let i = 0; i < dpos.count; i++) {
      const seed = this._dustSeed[i];
      dpos.array[i * 3 + 1] += Math.sin(performance.now() * 0.0003 + seed) * 0.0008 + 0.0009;
      if (dpos.array[i * 3 + 1] > 8) dpos.array[i * 3 + 1] = 0.2;
    }
    dpos.needsUpdate = true;
    this.dust.position.set(playerPos.x, 0, playerPos.z);
    this.dustMat.opacity = 0.35 + dayFactor * 0.3;

    return { sunHeight, dayFactor, nightFactor, sunsetFactor };
  }

  _updateWeather(dt, playerPos) {
    this.weatherTimer += dt;
    if (this.weatherTimer > this.nextWeatherCheck) {
      this.weatherTimer = 0;
      this.nextWeatherCheck = 90 + Math.random() * 120;
      const roll = Math.random();
      if (roll < 0.35) this.weather = 'clear';
      else if (roll < 0.55) this.weather = 'rain';
      else if (roll < 0.68) this.weather = 'storm';
      else if (roll < 0.85) this.weather = 'snow';
      else this.weather = 'fog';
    }

    const rainActive = this.weather === 'rain' || this.weather === 'storm';
    const snowActive = this.weather === 'snow';
    this.rainMat.opacity = THREE.MathUtils.damp(this.rainMat.opacity, rainActive ? 0.65 : 0, 4, dt);
    this.snowMat.opacity = THREE.MathUtils.damp(this.snowMat.opacity, snowActive ? 0.85 : 0, 4, dt);

    if (rainActive || this.rainMat.opacity > 0.01) {
      const pos = this.rain.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.array[i * 3 + 1] -= this._weatherVelocities[i] * dt;
        if (pos.array[i * 3 + 1] < 0) pos.array[i * 3 + 1] = 30;
      }
      pos.needsUpdate = true;
      this.rain.position.set(playerPos.x, 0, playerPos.z);
    }
    if (snowActive || this.snowMat.opacity > 0.01) {
      const pos = this.snow.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.array[i * 3 + 1] -= this._weatherVelocities[i] * 0.18 * dt;
        pos.array[i * 3] += this._weatherDrift[i] * dt;
        if (pos.array[i * 3 + 1] < 0) pos.array[i * 3 + 1] = 30;
      }
      pos.needsUpdate = true;
      this.snow.position.set(playerPos.x, 0, playerPos.z);
    }
  }

  isNight() { return Math.sin(this.timeOfDay * Math.PI * 2 - Math.PI / 2) < -0.05; }
}
