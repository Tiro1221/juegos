// ============ ELDERMERE — Entidades: NPCs, criaturas, monturas, proyectiles ============
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32 } from './rng.js';

const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, c, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(boxGeo, mat(c));
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// ---------- Constructores de modelos low-poly ----------
function buildHumanoid(skin, cloth, hood = null) {
  const g = new THREE.Group();
  const body = box(0.5, 0.7, 0.28, cloth, 0, 1.05, 0);
  const head = box(0.34, 0.34, 0.34, skin, 0, 1.58, 0);
  const legL = box(0.18, 0.7, 0.2, 0x3a2e22, -0.13, 0.35, 0);
  const legR = box(0.18, 0.7, 0.2, 0x3a2e22, 0.13, 0.35, 0);
  const armL = box(0.14, 0.6, 0.16, cloth, -0.33, 1.1, 0);
  const armR = box(0.14, 0.6, 0.16, cloth, 0.33, 1.1, 0);
  g.add(body, head, legL, legR, armL, armR);
  g.userData = { legL, legR, armL, armR, head };
  if (hood) { const h = box(0.42, 0.4, 0.42, hood, 0, 1.62, 0); g.add(h); }
  return g;
}
function buildHorse() {
  const g = new THREE.Group();
  const c = 0x6a4a2e;
  g.add(box(0.55, 0.62, 1.5, c, 0, 1.0, 0));                 // cuerpo
  const head = box(0.3, 0.42, 0.55, c, 0, 1.62, -0.9);        // cabeza
  g.add(head);
  g.add(box(0.28, 0.5, 0.3, c, 0, 1.42, -0.62));              // cuello
  g.add(box(0.06, 0.16, 0.1, 0x2e2015, -0.08, 1.9, -0.95));   // orejas
  g.add(box(0.06, 0.16, 0.1, 0x2e2015, 0.08, 1.9, -0.95));
  g.add(box(0.08, 0.5, 0.5, 0x2e2015, 0, 1.55, -0.45));       // melena
  const legs = [];
  for (const [x, z] of [[-0.2, -0.55], [0.2, -0.55], [-0.2, 0.55], [0.2, 0.55]]) {
    const l = box(0.14, 0.72, 0.14, 0x54391f, x, 0.36, z);
    g.add(l); legs.push(l);
  }
  g.userData = { legs, head };
  return g;
}
function buildSkeleton() {
  const g = buildHumanoid(0xd8d0bc, 0xb8b0a0);
  g.children[1].material = mat(0xe2dac6);   // cráneo claro
  g.add(box(0.06, 0.06, 0.06, 0x1a1a1a, -0.08, 1.6, -0.18)); // ojos huecos
  g.add(box(0.06, 0.06, 0.06, 0x1a1a1a, 0.08, 1.6, -0.18));
  return g;
}
function buildWraith() {
  const g = new THREE.Group();
  const ghost = new THREE.MeshLambertMaterial({ color: 0x8a6ad0, transparent: true, opacity: 0.55, emissive: 0x3a2a68 });
  const body = new THREE.Mesh(boxGeo, ghost); body.scale.set(0.5, 1.1, 0.3); body.position.y = 1.0;
  const head = new THREE.Mesh(boxGeo, ghost); head.scale.set(0.36, 0.36, 0.36); head.position.y = 1.75;
  g.add(body, head);
  g.add(box(0.08, 0.08, 0.02, 0xffffff, -0.08, 1.78, -0.18));
  g.add(box(0.08, 0.08, 0.02, 0xffffff, 0.08, 1.78, -0.18));
  g.userData = { head, ghost: true };
  return g;
}
function buildSpider() {
  const g = new THREE.Group();
  g.add(box(0.7, 0.4, 0.9, 0x2a2030, 0, 0.5, 0));
  g.add(box(0.4, 0.3, 0.4, 0x1e1826, 0, 0.55, -0.6));
  g.add(box(0.07, 0.07, 0.04, 0xd83a3a, -0.1, 0.62, -0.8));
  g.add(box(0.07, 0.07, 0.04, 0xd83a3a, 0.1, 0.62, -0.8));
  const legs = [];
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const l = box(0.06, 0.5, 0.06, 0x241c2a, s * 0.45, 0.35, -0.3 + i * 0.22);
      l.rotation.z = s * 0.5;
      g.add(l); legs.push(l);
    }
  }
  g.userData = { legs };
  return g;
}
function buildBoss() {
  const g = buildHumanoid(0x4a3a5a, 0x2a1e38, 0x1a1226);
  g.scale.set(1.7, 1.7, 1.7);
  g.add(box(0.5, 0.12, 0.5, 0xc9a227, 0, 1.85, 0));          // corona rota
  g.add(box(0.1, 0.1, 0.03, 0xff3a3a, -0.09, 1.62, -0.2));   // ojos ardientes
  g.add(box(0.1, 0.1, 0.03, 0xff3a3a, 0.09, 1.62, -0.2));
  return g;
}
function buildWolf() {
  const g = new THREE.Group();
  g.add(box(0.4, 0.45, 1.0, 0x5a5a62, 0, 0.62, 0));
  g.add(box(0.28, 0.3, 0.4, 0x66666e, 0, 0.85, -0.6));
  g.add(box(0.05, 0.12, 0.08, 0x44444c, -0.08, 1.05, -0.62));
  g.add(box(0.05, 0.12, 0.08, 0x44444c, 0.08, 1.05, -0.62));
  const legs = [];
  for (const [x, z] of [[-0.14, -0.35], [0.14, -0.35], [-0.14, 0.35], [0.14, 0.35]]) {
    const l = box(0.1, 0.42, 0.1, 0x4c4c54, x, 0.21, z);
    g.add(l); legs.push(l);
  }
  g.userData = { legs };
  return g;
}
function buildDeer() {
  const g = new THREE.Group();
  g.add(box(0.4, 0.5, 1.1, 0x8a6a48, 0, 0.85, 0));
  g.add(box(0.24, 0.3, 0.36, 0x96754c, 0, 1.3, -0.62));
  g.add(box(0.04, 0.3, 0.04, 0x5a452c, -0.1, 1.6, -0.6));   // astas
  g.add(box(0.04, 0.3, 0.04, 0x5a452c, 0.1, 1.6, -0.6));
  const legs = [];
  for (const [x, z] of [[-0.14, -0.4], [0.14, -0.4], [-0.14, 0.4], [0.14, 0.4]]) {
    const l = box(0.09, 0.6, 0.09, 0x6a5238, x, 0.3, z);
    g.add(l); legs.push(l);
  }
  g.userData = { legs };
  return g;
}

const BUILDERS = {
  villager: () => buildHumanoid(0xc89878, 0x5a6a8a),
  merchant: () => buildHumanoid(0xc89878, 0x8a6a2e),
  sage:     () => buildHumanoid(0xd8b898, 0x4a3a6a, 0x3a2a58),
  warden:   () => buildHumanoid(0xc89878, 0x3a5a3e, 0x2e4a32),
  horse: buildHorse, skeleton: buildSkeleton, wraith: buildWraith,
  spider: buildSpider, boss: buildBoss, wolf: buildWolf, deer: buildDeer,
};

// ---------- Diálogos y rutinas NPC ----------
const NPC_DATA = {
  villager: { name: ['Aldric el Leñador', 'Berta la Tejedora', 'Osric el Granjero', 'Edith la Herbolaria', 'Wilmund el Carpintero'],
    faction: 'aldoria',
    lines: ['Los Colmillo de Ceniza quemaron el molino del norte… la guerra nunca acaba.',
      'Dicen que bajo las ruinas hay oro de los Antiguos. ¡Y espectros que lo guardan!',
      'Si vas a las montañas, lleva antorchas. Los esqueletos salen de noche.',
      'Mi abuelo vio al Guardián del castillo. Desde entonces no sale de casa.'],
    tips: 'Las aldeas de la Corona de Aldoria te dan cobijo. Comercia y gana su favor.' },
  merchant: { name: ['Mercader Godwin', 'Mercader Sybil', 'Mercader Rurik'], faction: 'aldoria',
    lines: ['¿Lingotes de hierro? ¡Los compro a buen precio! La guerra paga bien.',
      'Tengo monturas, pociones y flechas. Oro primero, preguntas después.',
      'El Aquelarre paga fortunas por cristales arcanos. Yo no pregunto para qué.'],
    tips: 'El mercader intercambia objetos por lingotes de oro.' },
  sage: { name: ['Sabio Morvain', 'Sabia Elspeth', 'Sabio Corvuss'], faction: 'veil',
    lines: ['Los Antiguos sellaron algo bajo estas tierras. Las runas aún susurran.',
      'Tráeme cristales arcanos y el Velo te recordará con gratitud.',
      'La obsidiana del trono del castillo oculta un poder… y una maldición.'],
    tips: 'El Aquelarre del Velo valora los cristales y las runas antiguas.' },
  warden: { name: ['Guardiana Sylven', 'Guardián Thorn', 'Guardiana Rowan'], faction: 'wardens',
    lines: ['Cada árbol que talas sin replantar es una herida en el bosque.',
      'Los ciervos y caballos son hermanos nuestros. Domar, sí. Cazar… con respeto.',
      'Los lobos solo atacan a quien invade su territorio en la noche helada.'],
    tips: 'Los Guardianes del Bosque premian a quien respeta la naturaleza.' },
};

let nextId = 1;

export class Entity {
  constructor(type, x, y, z, seed = 0) {
    this.id = nextId++;
    this.type = type;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.group = BUILDERS[type]();
    this.group.position.copy(this.pos);
    this.dead = false;
    this.seed = seed;
    this.animT = Math.random() * 10;
    // atributos por tipo
    const stats = {
      villager: { hp: 30, hostile: false, speed: 1.6 },
      merchant: { hp: 30, hostile: false, speed: 1.4 },
      sage:     { hp: 30, hostile: false, speed: 1.3 },
      warden:   { hp: 40, hostile: false, speed: 1.8 },
      horse:    { hp: 40, hostile: false, speed: 2.4, mountable: true },
      deer:     { hp: 20, hostile: false, speed: 3.0, drops: [['item_meat', 2], ['item_leather', 1]] },
      wolf:     { hp: 30, hostile: true, dmg: 8, speed: 3.4, drops: [['item_meat', 1], ['item_leather', 2]], nightHunter: true },
      skeleton: { hp: 35, hostile: true, dmg: 10, speed: 2.2, drops: [['item_bone', 2], ['arrow', 3]] },
      spider:   { hp: 25, hostile: true, dmg: 7, speed: 3.2, drops: [['item_ectoplasm', 1]] },
      wraith:   { hp: 45, hostile: true, dmg: 13, speed: 1.9, drops: [['item_ectoplasm', 2], ['item_crystal', 1]] },
      boss:     { hp: 260, hostile: true, dmg: 22, speed: 2.6, drops: [['item_mithril', 3], ['item_crystal', 3], ['item_rune', 1], ['item_gold', 4]], boss: true },
    }[type];
    Object.assign(this, stats);
    this.maxHp = this.hp;
    this.attackCd = 0;
    this.wanderT = 0;
    this.targetYaw = this.yaw;
    // NPC
    if (NPC_DATA[type]) {
      const r = mulberry32(seed || this.id * 999);
      this.npcName = NPC_DATA[type].name[(r() * NPC_DATA[type].name.length) | 0];
      this.faction = NPC_DATA[type].faction;
      this.lines = NPC_DATA[type].lines;
      this.tips = NPC_DATA[type].tips;
      this.routinePhase = 'idle';
    }
    if (this.boss) this.name = 'Guardián de las Ruinas';
  }

  hurt(dmg, game, fromPlayer = true) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flashT = 0.15;
    if (!this.hostile && fromPlayer) game.audio.sfx('hurt');
    if (this.hp <= 0) {
      this.dead = true;
      game.onEntityDeath(this, fromPlayer);
    } else if (fromPlayer && this.hostile) {
      // al dañar, la criatura persigue
      this.aggro = true;
    }
  }

  animate(dt, moving) {
    this.animT += dt * (moving ? 9 : 2);
    const u = this.group.userData;
    const s = Math.sin(this.animT);
    if (u.legL) { u.legL.rotation.x = moving ? s * 0.7 : 0; u.legR.rotation.x = moving ? -s * 0.7 : 0; }
    if (u.armL) { u.armL.rotation.x = moving ? -s * 0.5 : s * 0.06; u.armR.rotation.x = moving ? s * 0.5 : -s * 0.06; }
    if (u.legs) for (let i = 0; i < u.legs.length; i++) u.legs[i].rotation.x = moving ? Math.sin(this.animT + i * 1.6) * 0.5 : 0;
    if (u.ghost) { this.group.position.y = this.pos.y + Math.sin(this.animT * 0.6) * 0.25 + 0.3; this.group.rotation.y += dt * 0.4; }
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.group.traverse((o) => { if (o.material && o.material.emissive) o.material.emissive.setHex(0x882222); });
    } else {
      this.group.traverse((o) => { if (o.material && o.material.emissive && !u.ghost) o.material.emissive.setHex(0x000000); });
    }
  }
}

// ---------- Gestor de entidades ----------
export class EntityManager {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.entities = [];
    this.projectiles = [];
    this.spawnTimer = 5;
    this.arrowGeo = new THREE.BoxGeometry(0.05, 0.05, 0.5);
    this.arrowMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  }

  spawn(type, x, y, z, seed) {
    // límite de población
    if (this.entities.length > 46) return null;
    const e = new Entity(type, x, y, z, seed);
    e.home = { x, y, z };
    this.entities.push(e);
    this.scene.add(e.group);
    return e;
  }

  fireArrow(from, dir, power, game, byPlayer = true) {
    const m = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    m.position.copy(from);
    const p = { mesh: m, vel: dir.clone().multiplyScalar(26), life: 3, power, byPlayer };
    m.lookAt(from.clone().add(dir));
    this.scene.add(m);
    this.projectiles.push(p);
    game.audio.sfx('bow');
  }

  despawnFar(px, pz) {
    for (const e of this.entities) {
      const d = Math.hypot(e.pos.x - px, e.pos.z - pz);
      if (d > 130 && !e.boss) { e.dead = true; e.silent = true; }
    }
  }

  update(dt, sky) {
    const game = this.game;
    const player = game.player;
    const ppos = player.pos;

    // spawn ambiental: animales de día, monstruos de noche
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 6 + Math.random() * 8;
      const ang = Math.random() * Math.PI * 2;
      const dist = 34 + Math.random() * 30;
      const sx = Math.floor(ppos.x + Math.cos(ang) * dist);
      const sz = Math.floor(ppos.z + Math.sin(ang) * dist);
      const sy = this.world.surfaceHeight(sx, sz) + 1;
      if (sy > CONFIG.SEA_LEVEL) {
        if (sky.isNight) {
          const mobs = ['skeleton', 'spider', 'wolf', 'skeleton', 'spider'];
          this.spawn(mobs[(Math.random() * mobs.length) | 0], sx + .5, sy, sz + .5);
        } else {
          const critters = ['deer', 'deer', 'horse', 'deer'];
          this.spawn(critters[(Math.random() * critters.length) | 0], sx + .5, sy, sz + .5);
        }
      }
    }
    this.despawnFar(ppos.x, ppos.z);

    for (const e of this.entities) {
      if (e.dead) continue;
      const distP = e.pos.distanceTo(ppos);
      if (distP > 90) continue;      // dormir entidades lejanas

      let moving = false;
      const isMounted = player.mount === e;

      if (!isMounted) {
        // ---------- IA ----------
        if (e.hostile) {
          const nightBoost = e.nightHunter ? sky.isNight : true;
          const aggroRange = e.boss ? 20 : 14;
          if (((distP < aggroRange && nightBoost) || e.aggro) && !player.dead) {
            if (e.boss && !e.roared) { e.roared = true; game.audio.sfx('bossRoar'); }
            // perseguir
            const dir = new THREE.Vector3().subVectors(ppos, e.pos); dir.y = 0; dir.normalize();
            e.yaw = Math.atan2(-dir.x, -dir.z);
            e.pos.addScaledVector(dir, e.speed * dt * (e.boss ? 1 : 1));
            moving = true;
            // ataque cuerpo a cuerpo
            e.attackCd -= dt;
            if (distP < (e.boss ? 2.6 : 1.6) && e.attackCd <= 0) {
              e.attackCd = 1.1;
              player.damage(e.dmg, game, e.boss ? 'el Guardián' : e.type);
              game.audio.sfx('enemyHit');
            }
            // esqueletos disparan flechas a distancia
            if (e.type === 'skeleton' && distP > 4 && distP < 16 && e.attackCd <= 0) {
              e.attackCd = 2.2;
              const aim = new THREE.Vector3().subVectors(player.eyePos(), new THREE.Vector3(e.pos.x, e.pos.y + 1.5, e.pos.z)).normalize();
              this.fireArrow(new THREE.Vector3(e.pos.x, e.pos.y + 1.5, e.pos.z), aim, 6, game, false);
            }
          } else if (!e.nightHunter || !sky.isNight) {
            // deambular
            e.wanderT -= dt;
            if (e.wanderT <= 0) { e.wanderT = 2 + Math.random() * 4; e.targetYaw = Math.random() * Math.PI * 2; }
            e.yaw += (e.targetYaw - e.yaw) * Math.min(1, dt * 2);
            e.pos.x -= Math.sin(e.yaw) * e.speed * 0.3 * dt;
            e.pos.z -= Math.cos(e.yaw) * e.speed * 0.3 * dt;
            moving = true;
          }
        } else if (e.npcName) {
          // ---------- Rutinas diarias de NPC ----------
          const t = sky.timeOfDay;
          const home = e.home;
          let goal = null;
          if (t > 0.28 && t < 0.45) goal = { x: home.x + Math.sin(e.id) * 8, z: home.z + Math.cos(e.id) * 8, phase: 'trabajando' };       // mañana: trabajar fuera
          else if (t >= 0.45 && t < 0.62) goal = { x: home.x, z: home.z, phase: 'en la plaza' };                                          // mediodía: reunirse
          else if (t >= 0.62 && t < 0.78) goal = { x: home.x + Math.cos(e.id * 2) * 6, z: home.z + Math.sin(e.id * 2) * 6, phase: 'paseando' };
          else goal = { x: home.x, z: home.z, phase: 'durmiendo' };                                                                       // noche: casa
          e.routinePhase = goal.phase;
          const dx = goal.x - e.pos.x, dz = goal.z - e.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 1.4) {
            const dir = { x: dx / d, z: dz / d };
            e.yaw = Math.atan2(-dir.x, -dir.z);
            e.pos.x += dir.x * e.speed * dt;
            e.pos.z += dir.z * e.speed * dt;
            moving = true;
          }
        } else {
          // animales: deambular, huir si el jugador se acerca
          if (distP < 6 && e.type !== 'horse') {
            const dir = new THREE.Vector3().subVectors(e.pos, ppos); dir.y = 0; dir.normalize();
            e.yaw = Math.atan2(-dir.x, -dir.z);
            e.pos.addScaledVector(dir, e.speed * dt);
            moving = true;
          } else {
            e.wanderT -= dt;
            if (e.wanderT <= 0) { e.wanderT = 3 + Math.random() * 5; e.targetYaw = Math.random() * Math.PI * 2; e.graze = Math.random() > 0.5; }
            if (!e.graze) {
              e.yaw += (e.targetYaw - e.yaw) * Math.min(1, dt * 1.5);
              e.pos.x -= Math.sin(e.yaw) * e.speed * 0.35 * dt;
              e.pos.z -= Math.cos(e.yaw) * e.speed * 0.35 * dt;
              moving = true;
            }
          }
        }

        // gravedad y suelo
        const gy = this.world.surfaceHeight(Math.floor(e.pos.x), Math.floor(e.pos.z));
        if (!e.group.userData.ghost) e.pos.y += ((gy + 0.02) - e.pos.y) * Math.min(1, dt * 10);
        else e.pos.y = gy;

        e.group.position.copy(e.pos);
        e.group.rotation.y = e.yaw;
      }

      e.animate(dt, moving);
    }

    // purgar muertos
    for (let i = this.entities.length - 1; i >= 0; i--) {
      if (this.entities[i].dead) {
        this.scene.remove(this.entities[i].group);
        this.entities.splice(i, 1);
      }
    }

    // ---------- Proyectiles ----------
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vel.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      let hit = false;
      // bloque
      const bp = p.mesh.position;
      if (this.world.isSolid(Math.floor(bp.x), Math.floor(bp.y), Math.floor(bp.z))) hit = true;
      // entidad / jugador
      if (!hit) {
        if (p.byPlayer) {
          for (const e of this.entities) {
            if (e.dead || !e.hostile) continue;
            const ep = new THREE.Vector3(e.pos.x, e.pos.y + 1, e.pos.z);
            if (ep.distanceTo(bp) < 1.1) { e.hurt(p.power, game, true); hit = true; break; }
          }
        } else {
          const ep = new THREE.Vector3(ppos.x, ppos.y + 1, ppos.z);
          if (ep.distanceTo(bp) < 0.9) { player.damage(p.power, game, 'una flecha'); hit = true; }
        }
      }
      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  nearestInteractable(pos, maxDist = 3) {
    let best = null, bd = maxDist;
    for (const e of this.entities) {
      if (e.dead) continue;
      if (!e.npcName && !e.mountable) continue;
      const d = e.pos.distanceTo(pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  nearestHostile(pos, maxDist = 2.4) {
    let best = null, bd = maxDist;
    for (const e of this.entities) {
      if (e.dead || !e.hostile) continue;
      const d = e.pos.distanceTo(pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  get boss() { return this.entities.find((e) => e.boss && !e.dead) || null; }
}
