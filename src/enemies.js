// enemies.js — five wobbling foes: goblin, bat, vampire, zombie, and the
// Goblin King boss. Survivor-style: they shamble toward the wizard and swarm.
import * as THREE from 'three';
import { ARENA } from './wizard.js';

const TYPES = {
  // forest
  goblin:  { hp: 12,  speed: 2.9, dmg: 6,  r: 0.6,  xp: 5,   color: 0x8fc24a, size: 1.0, baseY: 0 },
  bat:     { hp: 5,   speed: 5.0, dmg: 4,  r: 0.45, xp: 3,   color: 0x8c6fb8, size: 0.7, baseY: 1.4 },
  vampire: { hp: 26,  speed: 3.5, dmg: 9,  r: 0.7,  xp: 16,  color: 0xe6dcec, size: 1.15, baseY: 0 },
  zombie:  { hp: 52,  speed: 1.5, dmg: 11, r: 0.95, xp: 13,  color: 0x6f9e5a, size: 1.55, baseY: 0 },
  goblinking:  { hp: 850, speed: 1.9, dmg: 18, r: 2.0, xp: 220, color: 0x6fae3a, size: 3.2, baseY: 0, boss: true },
  // cave
  rat:      { hp: 8,  speed: 4.3, dmg: 5,  r: 0.45, xp: 3,  color: 0x8a7a66, size: 0.7, baseY: 0 },
  brutebat: { hp: 34, speed: 3.1, dmg: 10, r: 0.75, xp: 9,  color: 0x6a5a8c, size: 1.25, baseY: 1.2 },
  spider:   { hp: 22, speed: 3.4, dmg: 9,  r: 0.7,  xp: 10, color: 0x4a3a55, size: 1.05, baseY: 0 },
  spiderqueen: { hp: 1000, speed: 1.9, dmg: 18, r: 2.0, xp: 240, color: 0x6a2f6a, size: 3.0, baseY: 0, boss: true },
  // graveyard
  skeleton: { hp: 24, speed: 2.7, dmg: 9,  r: 0.65, xp: 9,  color: 0xe6e2d0, size: 1.05, baseY: 0 },
  wraith:   { hp: 18, speed: 3.9, dmg: 11, r: 0.65, xp: 12, color: 0x9fb0c8, size: 1.1, baseY: 0.9 },
  skeletonking: { hp: 1100, speed: 2.0, dmg: 20, r: 2.0, xp: 260, color: 0xd8d2bc, size: 3.1, baseY: 0, boss: true },
};

const MAX_ENEMIES = 140;

export class Enemies {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.list = [];
    this.pools = {};
    for (const k of Object.keys(TYPES)) this.pools[k] = [];
    this.bossAlive = false;
  }

  count() { return this.list.length; }
  countNonBoss() { let n = 0; for (const e of this.list) if (e.alive && !TYPES[e.type].boss) n++; return n; }

  clear() {
    for (const e of this.list) { e.mesh.visible = false; this.pools[e.type].push(e); }
    this.list.length = 0;
    this.bossAlive = false;
  }

  _buildMesh(type) {
    const def = TYPES[type];
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.7 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5 });
    const anim = { wings: null, cape: null };

    // squat blobby body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), bodyMat);
    body.scale.set(1, 1.15, 1);
    body.position.y = 0.6;
    body.castShadow = true;
    g.add(body);

    // eyes (recoloured for vampires)
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const pupMat = type === 'vampire' ? new THREE.MeshStandardMaterial({ color: 0xff2a3a, emissive: 0x661017, roughness: 0.5 }) : darkMat;
    const eGeo = new THREE.SphereGeometry(0.17, 10, 10);
    const eL = new THREE.Mesh(eGeo, eyeW); eL.position.set(-0.2, 0.85, 0.42);
    const eR = new THREE.Mesh(eGeo, eyeW); eR.position.set(0.2, 0.85, 0.42);
    const pGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const pL = new THREE.Mesh(pGeo, pupMat); pL.position.set(-0.2, 0.85, 0.55);
    const pR = new THREE.Mesh(pGeo, pupMat); pR.position.set(0.2, 0.85, 0.55);
    g.add(eL, eR, pL, pR);

    // little feet (flyers/floaters have none)
    if (type !== 'bat' && type !== 'brutebat' && type !== 'wraith') {
      const footGeo = new THREE.SphereGeometry(0.16, 8, 8);
      const fL = new THREE.Mesh(footGeo, darkMat); fL.position.set(-0.25, 0.12, 0.05); fL.castShadow = true;
      const fR = new THREE.Mesh(footGeo, darkMat); fR.position.set(0.25, 0.12, 0.05); fR.castShadow = true;
      g.add(fL, fR);
    }

    if (type === 'goblin' || type === 'goblinking' || type === 'rat') {
      // pointy ears
      const er = type === 'rat' ? 0.6 : 0.52, ey = type === 'rat' ? 0.95 : 0.78;
      const earGeo = new THREE.ConeGeometry(0.16, type === 'rat' ? 0.5 : 0.42, 6);
      const earL = new THREE.Mesh(earGeo, bodyMat); earL.position.set(-er, ey, 0); earL.rotation.z = 1.1; earL.castShadow = true;
      const earR = new THREE.Mesh(earGeo, bodyMat); earR.position.set(er, ey, 0); earR.rotation.z = -1.1; earR.castShadow = true;
      g.add(earL, earR);
      if (type === 'rat') { // long tail + snout
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.9, 6), bodyMat); tail.position.set(0, 0.4, -0.6); tail.rotation.x = 1.1; g.add(tail);
        body.scale.set(1.1, 0.85, 1.3);
      }
    }
    if (type === 'goblinking' || type === 'spiderqueen' || type === 'skeletonking') {
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.3, roughness: 0.4, emissive: 0x3a2c00 });
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.55, 5), crownMat);
      crown.position.y = 1.45; crown.rotation.z = 0.18; crown.castShadow = true;
      g.add(crown);
    }
    if (type === 'bat' || type === 'brutebat') {
      const wingMat = new THREE.MeshStandardMaterial({ color: type === 'brutebat' ? 0x3a2f4a : 0x4a3a66, roughness: 0.8, side: THREE.DoubleSide });
      const wingGeo = new THREE.ConeGeometry(0.5, 0.9, 3); wingGeo.rotateZ(Math.PI / 2);
      const wL = new THREE.Mesh(wingGeo, wingMat); wL.position.set(-0.55, 0.7, 0); wL.castShadow = true;
      const wR = new THREE.Mesh(wingGeo, wingMat); wR.position.set(0.55, 0.7, 0); wR.rotation.y = Math.PI; wR.castShadow = true;
      g.add(wL, wR); anim.wings = [wL, wR];
    }
    if (type === 'spider' || type === 'spiderqueen') {
      // 8 legs as angled cylinders
      const legGeo = new THREE.CylinderGeometry(0.06, 0.04, 1.0, 6); legGeo.translate(0, -0.5, 0);
      for (let s = 0; s < 4; s++) {
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(legGeo, darkMat);
          leg.position.set(side * 0.45, 0.7, -0.3 + s * 0.22);
          leg.rotation.z = side * (0.9 + Math.random() * 0.2); leg.rotation.x = (s - 1.5) * 0.2; leg.castShadow = true;
          g.add(leg);
        }
      }
      body.scale.set(1.2, 0.8, 1.1);
    }
    if (type === 'zombie') {
      body.position.y = 0.62; body.scale.set(1.05, 1.0, 1.05);
      const armGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.8, 8); armGeo.translate(0, -0.4, 0);
      const aL = new THREE.Mesh(armGeo, bodyMat); aL.position.set(-0.4, 0.9, 0.2); aL.rotation.x = -1.4; aL.castShadow = true;
      const aR = new THREE.Mesh(armGeo, bodyMat); aR.position.set(0.4, 0.9, 0.2); aR.rotation.x = -1.4; aR.castShadow = true;
      g.add(aL, aR);
    }
    if (type === 'skeleton' || type === 'skeletonking') {
      // ribcage hint + bony arms
      const boneMat = new THREE.MeshStandardMaterial({ color: type === 'skeletonking' ? 0xd8d2bc : 0xeae6d6, roughness: 0.7 });
      for (let r = 0; r < 3; r++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.32 - r * 0.05, 0.04, 6, 14), boneMat); rib.position.set(0, 0.5 + r * 0.18, 0.2); rib.rotation.x = Math.PI / 2; g.add(rib); }
      const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.7, 6); armGeo.translate(0, -0.35, 0);
      const aL = new THREE.Mesh(armGeo, boneMat); aL.position.set(-0.45, 0.95, 0.1); aL.rotation.x = -1.2; aL.castShadow = true;
      const aR = new THREE.Mesh(armGeo, boneMat); aR.position.set(0.45, 0.95, 0.1); aR.rotation.x = -1.2; aR.castShadow = true;
      g.add(aL, aR);
    }
    if (type === 'wraith') {
      // tattered hood + wispy tail (no feet, floats)
      const robe = new THREE.MeshStandardMaterial({ color: 0x6a7a9a, roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 12, 1, true), robe); hood.position.set(0, 0.5, 0); hood.castShadow = true;
      g.add(hood); anim.cape = hood;
    }
    if (type === 'vampire') {
      // a swishy cape + pale slicked look
      const capeMat = new THREE.MeshStandardMaterial({ color: 0x2a0e1a, roughness: 0.7, side: THREE.DoubleSide });
      const cape = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 12, 1, true), capeMat);
      cape.position.set(0, 0.7, -0.3); cape.castShadow = true;
      const collar = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.4, 12, 1, true), capeMat);
      collar.position.set(0, 1.05, -0.1); collar.rotation.x = -0.4;
      g.add(cape, collar);
      anim.cape = cape;
    }

    g.scale.setScalar(def.size);
    this.group.add(g);
    return { mesh: g, bodyMat, anim };
  }

  spawn(type, hpScale = 1, near = null, game = null) {
    const def = TYPES[type];
    if (!def) return null;
    if (this.list.length >= MAX_ENEMIES && !def.boss) return null;
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
    e.baseY = def.baseY;
    e.alive = true;
    e.slow = 0; e.slowT = 0;
    e.contactCd = 0;
    e.flash = 0;
    e.phase = Math.random() * 10;
    e.spawnT = 0.45; // emerging from a portal
    e.knock = new THREE.Vector3();

    const center = near || new THREE.Vector3();
    const ang = Math.random() * Math.PI * 2;
    const dist = def.boss ? 22 : 24 + Math.random() * 9;
    let x = center.x + Math.cos(ang) * dist;
    let z = center.z + Math.sin(ang) * dist;
    x = Math.max(-ARENA + 1, Math.min(ARENA - 1, x));
    z = Math.max(-ARENA + 1, Math.min(ARENA - 1, z));
    e.mesh.position.set(x, e.baseY, z);
    e.mesh.scale.setScalar(0.01);
    // portal effect
    if (game) {
      game.particles.ring({ pos: new THREE.Vector3(x, 0.1, z), color: def.boss ? 0xff5a8a : 0x9b7bff, r0: 0.3, r1: def.boss ? 5 : 2.4, life: 0.5 });
      game.particles.burst({ pos: new THREE.Vector3(x, 0.6, z), color: 0x9b7bff, count: def.boss ? 24 : 8, speed: 5, size: 0.3, life: 0.6 });
    }
    this.list.push(e);
    if (def.boss) { this.bossAlive = true; e.bossPos = new THREE.Vector3(x, 0, z); }
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
      game.particles.burst({ pos: e.mesh.position.clone().setY(0.7 * def.size), color: def.color, count: def.boss ? 44 : 12, speed: def.boss ? 11 : 6, size: 0.35 * def.size, life: 0.9, up: 3, blend: 'normal' });
      game.particles.burst({ pos: e.mesh.position.clone().setY(0.7 * def.size), color: 0xffffff, count: 6, speed: 7, size: 0.25, life: 0.5 });
      game.spawnXP(e.mesh.position.clone(), e.xp);
      game.enemyDrop(e.mesh.position.clone(), def);
      if (def.boss) { this.bossAlive = false; game.particles.ring({ pos: e.mesh.position.clone(), color: 0xffd98a, r0: 1, r1: 16, life: 0.9 }); game.onBossDead(); }
      game.kills++;
      if (game.onKill) game.onKill(e, def);
    }
  }

  update(dt, game) {
    const player = game.wizard.pos;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.alive) { e.mesh.visible = false; this.pools[e.type].push(e); this.list.splice(i, 1); continue; }

      const sz = TYPES[e.type].size;
      // emerging from a portal — scale up, don't move or bite yet
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        e.phase += dt * 6;
        const emerge = Math.max(0.01, 1 - e.spawnT / 0.45);
        e.mesh.scale.setScalar(sz * emerge);
        e.mesh.rotation.y = Math.atan2(player.x - e.mesh.position.x, player.z - e.mesh.position.z);
        e.mesh.position.y = e.baseY;
        continue;
      }

      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      const speed = e.speed * (1 - e.slow);

      const dx = player.x - e.mesh.position.x;
      const dz = player.z - e.mesh.position.z;
      const d = Math.hypot(dx, dz) || 1;
      let vx = (dx / d) * speed;
      let vz = (dz / d) * speed;

      // separation
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

      e.mesh.position.x += vx * dt + e.knock.x * dt;
      e.mesh.position.z += vz * dt + e.knock.z * dt;
      e.knock.multiplyScalar(Math.pow(0.02, dt));
      e.mesh.position.x = Math.max(-ARENA, Math.min(ARENA, e.mesh.position.x));
      e.mesh.position.z = Math.max(-ARENA, Math.min(ARENA, e.mesh.position.z));

      // wobble (the wonk)
      e.phase += dt * (4 + speed);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.mesh.rotation.z = Math.sin(e.phase) * 0.18;
      const squash = 1 + Math.sin(e.phase * 2) * 0.07;
      e.mesh.scale.y = TYPES[e.type].size * squash;
      e.mesh.scale.x = TYPES[e.type].size * (2 - squash);
      const hover = e.baseY > 0 ? e.baseY + Math.sin(e.phase * 1.4) * 0.35 : Math.abs(Math.sin(e.phase)) * 0.12 * TYPES[e.type].size;
      e.mesh.position.y = hover;
      if (e.anim.wings) { const f = Math.sin(e.phase * 6); e.anim.wings[0].rotation.y = f * 0.7; e.anim.wings[1].rotation.y = Math.PI - f * 0.7; }
      if (e.anim.cape) e.anim.cape.rotation.x = Math.sin(e.phase * 1.5) * 0.12;

      if (e.flash > 0) {
        e.flash -= dt;
        e.bodyMat.emissive.setRGB(e.flash * 8, e.flash * 8, e.flash * 8);
      } else if (e.bodyMat.emissive.r !== 0) {
        e.bodyMat.emissive.setRGB(0, 0, 0);
      }

      if (e.contactCd > 0) e.contactCd -= dt;
      const pr = 0.7 + e.r;
      if (d < pr && e.contactCd <= 0) {
        if (game.wizard.takeDamage(e.dmg, e.mesh.position)) {
          game.audio.play('hurt');
          game.shake(0.5 + e.dmg * 0.02);
          if (e.type === 'vampire') { // lifesteal
            e.hp = Math.min(e.maxHp, e.hp + e.dmg * 0.6);
            game.particles.burst({ pos: e.mesh.position.clone().setY(1), color: 0xff2a3a, count: 5, speed: 3, size: 0.2, life: 0.5 });
          }
        }
        e.contactCd = 0.8;
        e.knock.x -= (dx / d) * 8;
        e.knock.z -= (dz / d) * 8;
      }
    }
  }

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
