// enemies.js — wobbling foes that shamble toward the wizard, swarm-survivor style.
import * as THREE from 'three';
import { ARENA } from './wizard.js';

const TYPES = {
  goblin: { hp: 14, speed: 3.0, dmg: 8, r: 0.6, xp: 4, color: 0x9ed172, size: 1.0 },
  bat:    { hp: 6,  speed: 5.2, dmg: 5, r: 0.45, xp: 2, color: 0xb6a3e0, size: 0.7 },
  brute:  { hp: 70, speed: 1.7, dmg: 16, r: 1.0, xp: 12, color: 0xe89a78, size: 1.7 },
  boss:   { hp: 1200, speed: 2.0, dmg: 24, r: 2.0, xp: 140, color: 0xd980b0, size: 3.2 },
};

const MAX_ENEMIES = 140;

export class Enemies {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.list = [];
    this.pools = { goblin: [], bat: [], brute: [], boss: [] };
    this.bossAlive = false;
  }

  count() { return this.list.length; }

  clear() {
    for (const e of this.list) { e.mesh.visible = false; this.pools[e.type].push(e); }
    this.list.length = 0;
    this.bossAlive = false;
  }

  _buildMesh(type) {
    const def = TYPES[type];
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1620, roughness: 0.7 });

    // squat blobby body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), bodyMat);
    body.scale.set(1, 1.15, 1);
    body.position.y = 0.6;
    body.castShadow = true;
    g.add(body);
    // big goofy eyes
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const eGeo = new THREE.SphereGeometry(0.17, 10, 10);
    const eL = new THREE.Mesh(eGeo, eyeW); eL.position.set(-0.2, 0.85, 0.42);
    const eR = new THREE.Mesh(eGeo, eyeW); eR.position.set(0.2, 0.85, 0.42);
    const pGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const pL = new THREE.Mesh(pGeo, darkMat); pL.position.set(-0.2, 0.85, 0.55);
    const pR = new THREE.Mesh(pGeo, darkMat); pR.position.set(0.2, 0.85, 0.55);
    g.add(eL, eR, pL, pR);
    // little feet
    const footGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const fL = new THREE.Mesh(footGeo, darkMat); fL.position.set(-0.25, 0.12, 0.05); fL.castShadow = true;
    const fR = new THREE.Mesh(footGeo, darkMat); fR.position.set(0.25, 0.12, 0.05); fR.castShadow = true;
    g.add(fL, fR);
    if (type === 'boss') {
      // a crooked crown
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.3, roughness: 0.4, emissive: 0x3a2c00 }));
      crown.position.y = 1.35; crown.rotation.z = 0.2; crown.castShadow = true;
      g.add(crown);
    }
    g.scale.setScalar(def.size);
    this.group.add(g);
    return { mesh: g, bodyMat, feet: [fL, fR] };
  }

  spawn(type, hpScale = 1, near = null) {
    if (this.list.length >= MAX_ENEMIES && type !== 'boss') return null;
    const def = TYPES[type];
    let e = this.pools[type].pop();
    if (!e) e = this._buildMesh(type);
    e.type = type;
    e.mesh.visible = true;
    e.maxHp = def.hp * hpScale;
    e.hp = e.maxHp;
    e.speed = def.speed * (0.85 + Math.random() * 0.3);
    e.dmg = def.dmg;
    e.r = def.r * def.size;
    e.xp = def.xp;
    e.alive = true;
    e.slow = 0; e.slowT = 0;
    e.contactCd = 0;
    e.flash = 0;
    e.phase = Math.random() * 10;
    e.knock = new THREE.Vector3();

    // spawn on a ring around the wizard, just off-screen, clamped to arena
    const center = near || new THREE.Vector3();
    const ang = Math.random() * Math.PI * 2;
    const dist = 26 + Math.random() * 8;
    let x = center.x + Math.cos(ang) * dist;
    let z = center.z + Math.sin(ang) * dist;
    x = Math.max(-ARENA + 1, Math.min(ARENA - 1, x));
    z = Math.max(-ARENA + 1, Math.min(ARENA - 1, z));
    e.mesh.position.set(x, 0, z);
    this.list.push(e);
    if (type === 'boss') this.bossAlive = true;
    return e;
  }

  damage(e, n, game, knockDir = null, knockAmt = 0) {
    if (!e.alive) return;
    e.hp -= n;
    e.flash = 0.12;
    if (knockDir && knockAmt) e.knock.addScaledVector(knockDir.clone().setY(0).normalize(), knockAmt);
    if (game) game.popDamage(e.mesh.position, n);
    if (e.hp <= 0) this._kill(e, game);
  }

  applySlow(e, factor, time) {
    e.slow = Math.max(e.slow, factor);
    e.slowT = Math.max(e.slowT, time);
  }

  _kill(e, game) {
    e.alive = false;
    const def = TYPES[e.type];
    if (game) {
      game.audio.play('enemyDie');
      game.particles.burst({ pos: e.mesh.position.clone().setY(0.7 * def.size), color: def.color, count: e.type === 'boss' ? 40 : 12, speed: e.type === 'boss' ? 10 : 6, size: 0.35 * def.size, life: 0.9, up: 3, blend: 'normal' });
      game.particles.burst({ pos: e.mesh.position.clone().setY(0.7 * def.size), color: 0xffffff, count: 6, speed: 7, size: 0.25, life: 0.5 });
      game.spawnXP(e.mesh.position.clone(), e.xp);
      if (e.type === 'boss') { game.particles.ring({ pos: e.mesh.position.clone(), color: 0xffcf5c, r0: 1, r1: 14, life: 0.8 }); game.onBossDead(); }
      else if (Math.random() < (e.type === 'brute' ? 0.5 : 0.06)) game.spawnHeart(e.mesh.position.clone());
      game.kills++;
    }
  }

  update(dt, game) {
    const player = game.wizard.pos;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.alive) { e.mesh.visible = false; this.pools[e.type].push(e); this.list.splice(i, 1); continue; }

      // slow timer
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      const speed = e.speed * (1 - e.slow);

      // steer toward player
      const dx = player.x - e.mesh.position.x;
      const dz = player.z - e.mesh.position.z;
      const d = Math.hypot(dx, dz) || 1;
      let vx = (dx / d) * speed;
      let vz = (dz / d) * speed;

      // light separation from neighbours so they don't perfectly stack
      for (let j = 0; j < this.list.length; j++) {
        if (j === i) continue;
        const o = this.list[j];
        const ox = e.mesh.position.x - o.mesh.position.x;
        const oz = e.mesh.position.z - o.mesh.position.z;
        const od = ox * ox + oz * oz;
        const minD = (e.r + o.r) * 0.9;
        if (od < minD * minD && od > 0.0001) {
          const f = (minD - Math.sqrt(od)) * 3;
          vx += (ox / Math.sqrt(od)) * f;
          vz += (oz / Math.sqrt(od)) * f;
        }
      }

      // knockback
      e.mesh.position.x += (vx) * dt + e.knock.x * dt;
      e.mesh.position.z += (vz) * dt + e.knock.z * dt;
      e.knock.multiplyScalar(Math.pow(0.02, dt));

      // keep inside arena
      e.mesh.position.x = Math.max(-ARENA, Math.min(ARENA, e.mesh.position.x));
      e.mesh.position.z = Math.max(-ARENA, Math.min(ARENA, e.mesh.position.z));

      // face & wobble (the wonk)
      e.phase += dt * (4 + speed);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.mesh.rotation.z = Math.sin(e.phase) * 0.18;
      const squash = 1 + Math.sin(e.phase * 2) * 0.07;
      e.mesh.scale.y = TYPES[e.type].size * squash;
      e.mesh.scale.x = TYPES[e.type].size * (2 - squash);
      e.mesh.position.y = Math.abs(Math.sin(e.phase)) * 0.12 * TYPES[e.type].size;

      // flash on hit
      if (e.flash > 0) {
        e.flash -= dt;
        e.bodyMat.emissive.setRGB(e.flash * 8, e.flash * 8, e.flash * 8);
      } else if (e.bodyMat.emissive.r !== 0) {
        e.bodyMat.emissive.setRGB(0, 0, 0);
      }

      // contact damage
      if (e.contactCd > 0) e.contactCd -= dt;
      const pr = 0.7 + e.r;
      if (d < pr && e.contactCd <= 0) {
        if (game.wizard.takeDamage(e.dmg, e.mesh.position)) {
          game.audio.play('hurt');
          game.shake(0.5 + e.dmg * 0.02);
        }
        e.contactCd = 0.8;
        // bonk the enemy back a touch
        e.knock.x -= (dx / d) * 8;
        e.knock.z -= (dz / d) * 8;
      }
    }
  }

  // Nearest live enemy to a point, optionally excluding a set, within maxDist.
  nearest(point, maxDist = Infinity, exclude = null) {
    let best = null, bestD = maxDist * maxDist;
    for (const e of this.list) {
      if (!e.alive || (exclude && exclude.has(e))) continue;
      const dx = e.mesh.position.x - point.x;
      const dz = e.mesh.position.z - point.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  inRadius(point, radius) {
    const out = [];
    const r2 = radius * radius;
    for (const e of this.list) {
      if (!e.alive) continue;
      const dx = e.mesh.position.x - point.x;
      const dz = e.mesh.position.z - point.z;
      if (dx * dx + dz * dz <= r2) out.push(e);
    }
    return out;
  }
}

export { TYPES };
