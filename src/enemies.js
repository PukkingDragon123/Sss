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
  // inferno
  imp:      { hp: 14, speed: 4.6, dmg: 7,  r: 0.5,  xp: 6,  color: 0xff5a3a, size: 0.8, baseY: 0, emissive: 0x661508 },
  hellhound:{ hp: 40, speed: 3.6, dmg: 13, r: 0.8,  xp: 14, color: 0x8a2a1a, size: 1.25, baseY: 0, emissive: 0x3a0a04 },
  demonlord:{ hp: 1500, speed: 2.0, dmg: 24, r: 2.1, xp: 320, color: 0xc23020, size: 3.3, baseY: 0, boss: true, emissive: 0x4a0a04 },
  // clockwork / future
  drone:    { hp: 16, speed: 4.5, dmg: 7,  r: 0.5,  xp: 6,  color: 0x4fd0e8, size: 0.8, baseY: 1.4, emissive: 0x155a6a },
  bot:      { hp: 46, speed: 2.6, dmg: 12, r: 0.8,  xp: 14, color: 0x9fb0bc, size: 1.3, baseY: 0, metalness: 0.5 },
  overmind: { hp: 1650, speed: 1.8, dmg: 24, r: 2.1, xp: 340, color: 0x6fe0ef, size: 3.2, baseY: 0, boss: true, emissive: 0x1f6a7a, metalness: 0.4 },
  // swamp / frost / void bosses
  bogwretch:{ hp: 1250, speed: 1.8, dmg: 21, r: 2.0, xp: 290, color: 0x5a7a3a, size: 3.1, baseY: 0, boss: true, emissive: 0x16240e },
  frostmaw: { hp: 1400, speed: 2.1, dmg: 22, r: 2.0, xp: 300, color: 0xbfe6ff, size: 3.2, baseY: 0, boss: true, emissive: 0x2a5a7a },
  voidmaw:  { hp: 1900, speed: 2.0, dmg: 26, r: 2.2, xp: 400, color: 0x7a4ad0, size: 3.4, baseY: 0, boss: true, emissive: 0x2a1060 },
  // ---- special-ability foes (woven into the regions for variety) ----
  houndling:  { hp: 30,  speed: 3.2, dmg: 13, r: 0.7,  xp: 11, color: 0xc2702a, size: 1.05, baseY: 0, ability: 'charge', atkInterval: 3.0 },
  cultist:    { hp: 22,  speed: 2.3, dmg: 6,  r: 0.6,  xp: 13, color: 0x7a4ad0, size: 1.05, baseY: 0, emissive: 0x2a1060, ability: 'shoot', atkInterval: 2.4, shotDmg: 8 },
  splitslime: { hp: 40,  speed: 1.8, dmg: 9,  r: 0.85, xp: 12, color: 0x4ad08a, size: 1.2,  baseY: 0, splitInto: 'goblin', splitCount: 2 },
  broodmother:{ hp: 120, speed: 1.5, dmg: 10, r: 1.1,  xp: 34, color: 0x8a3a6a, size: 1.7,  baseY: 0, ability: 'summon', atkInterval: 4.2, summonType: 'bat' },
  warden:     { hp: 60,  speed: 2.0, dmg: 11, r: 0.9,  xp: 18, color: 0x9aa6c0, size: 1.3,  baseY: 0, metalness: 0.3, shield: 50, ability: 'guard', atkInterval: 3.5 },
  bomber:     { hp: 16,  speed: 3.4, dmg: 6,  r: 0.6,  xp: 9,  color: 0xff7a2a, size: 0.95, baseY: 0, emissive: 0x5a2008, explodeDmg: 22, explodeR: 3.2 },
};

// per-type special behaviours, fired on each enemy's attack cooldown. (e,def,game,d,dx,dz)
const ENEMY_ABILITIES = {
  shoot(e, def, game, d, dx, dz) {                       // ranged: lob a hostile orb at the wizard
    if (d > 24 || !game.spawnHostileOrb) return;
    const from = e.mesh.position.clone().setY(1.0);
    const dir = new THREE.Vector3(dx, 0, dz);
    game.spawnHostileOrb(from, dir, def.shotDmg || 8);
    game.particles.burst({ pos: from, color: 0xff7aa0, count: 5, speed: 3, size: 0.18, life: 0.4, blend: 'add' });
  },
  charge(e, def, game, d) {                              // lunge in a quick burst when fairly close
    if (d < 11 && d > 1.6) { e.charging = 0.45; game.particles.burst({ pos: e.mesh.position.clone().setY(0.35), color: 0xffcaa0, count: 6, speed: 4, size: 0.2, life: 0.4 }); }
  },
  summon(e, def, game) {                                 // birth little minions near itself
    if (game.enemies.countNonBoss() > 92) return;
    const c = game.enemies.spawn(def.summonType || 'bat', 0.6, e.mesh.position.clone(), game);
    if (c) c.spawnT = 0.3;
  },
  guard(e, def, game) {                                  // re-shield self + buff nearby allies
    e.shield = Math.max(e.shield, def.shield || 50);
    for (const o of game.enemies.inRadius(e.mesh.position, 5)) { if (o !== e && !TYPES[o.type].boss) o.shield = Math.max(o.shield || 0, 20); }
  },
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
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: def.metalness ? 0.4 : 0.85, metalness: def.metalness || 0, emissive: def.emissive || 0x000000, emissiveIntensity: def.emissive ? 0.6 : 0 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.7 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5 });
    const anim = { wings: null, cape: null };

    const fierce = !!(def.boss || def.emissive || type === 'vampire' || type === 'warden' || type === 'spider' || type === 'spiderqueen');

    // squat blobby body (smoother now) + a paler belly patch for a bit of shape
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 16), bodyMat);
    body.scale.set(1, 1.15, 1);
    body.position.y = 0.6;
    body.castShadow = true;
    g.add(body);
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.9, depthWrite: false });
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), bellyMat); belly.scale.set(0.9, 1.0, 0.6); belly.position.set(0, 0.52, 0.32); g.add(belly);

    // eyes (recoloured for vampires) + glints so they read as alive
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const pupMat = (type === 'vampire' || fierce && def.emissive) ? new THREE.MeshStandardMaterial({ color: 0xff2a3a, emissive: 0x661017, emissiveIntensity: 0.7, roughness: 0.5 }) : darkMat;
    const eGeo = new THREE.SphereGeometry(0.17, 12, 12);
    const eL = new THREE.Mesh(eGeo, eyeW); eL.position.set(-0.2, 0.85, 0.42);
    const eR = new THREE.Mesh(eGeo, eyeW); eR.position.set(0.2, 0.85, 0.42);
    const pGeo = new THREE.SphereGeometry(0.08, 10, 10);
    const pL = new THREE.Mesh(pGeo, pupMat); pL.position.set(-0.2, 0.85, 0.55);
    const pR = new THREE.Mesh(pGeo, pupMat); pR.position.set(0.2, 0.85, 0.55);
    const glGeo = new THREE.SphereGeometry(0.035, 6, 6);
    const glL = new THREE.Mesh(glGeo, eyeW); glL.position.set(-0.23, 0.9, 0.61);
    const glR = new THREE.Mesh(glGeo, eyeW); glR.position.set(0.17, 0.9, 0.61);
    g.add(eL, eR, pL, pR, glL, glR);

    // brows (angrier on dangerous foes) + a little mouth for character
    const browGeo = new THREE.BoxGeometry(0.2, 0.055, 0.07);
    const bL = new THREE.Mesh(browGeo, darkMat); bL.position.set(-0.2, 1.02, 0.46); bL.rotation.z = fierce ? -0.5 : -0.16;
    const bR = new THREE.Mesh(browGeo, darkMat); bR.position.set(0.2, 1.02, 0.46); bR.rotation.z = fierce ? 0.5 : 0.16;
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(fierce ? 0.3 : 0.2, 0.05, 0.05), darkMat); mouth.position.set(0, 0.62, 0.5); mouth.rotation.z = fierce ? 0 : 0.0;
    g.add(bL, bR, mouth);

    // little feet (flyers/floaters have none)
    if (type !== 'bat' && type !== 'brutebat' && type !== 'wraith' && type !== 'drone') {
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
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), bodyMat); nose.position.set(0, 0.74, 0.56); nose.rotation.x = Math.PI / 2; nose.castShadow = true; g.add(nose);
      if (type === 'rat') { // long tail + snout
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.9, 6), bodyMat); tail.position.set(0, 0.4, -0.6); tail.rotation.x = 1.1; g.add(tail);
        body.scale.set(1.1, 0.85, 1.3);
      }
    }
    if (def.boss) {
      // ---- regal KING kit: a jewelled crown, royal cape, pauldrons & a menacing aura ----
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.55, roughness: 0.32, emissive: 0x4a3400, emissiveIntensity: 0.5 });
      const gemMat = new THREE.MeshStandardMaterial({ color: 0xff3a5a, emissive: 0x6a0a1a, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.2 });
      const crown = new THREE.Group(); crown.position.y = 1.5;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 12), goldMat); crown.add(band);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 5), goldMat); spike.position.set(Math.cos(a) * 0.48, 0.26, Math.sin(a) * 0.48); crown.add(spike); }
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), gemMat); gem.position.set(0, 0.06, 0.5); crown.add(gem);
      crown.castShadow = true; g.add(crown);
      const capeMat = new THREE.MeshStandardMaterial({ color: 0x6a1020, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x1a0206 });
      const cape = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.7, 14, 1, true), capeMat); cape.position.set(0, 0.7, -0.36); cape.castShadow = true; g.add(cape); if (!anim.cape) anim.cape = cape;
      const palMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.5, roughness: 0.4 });
      for (const side of [-1, 1]) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), palMat); p.position.set(side * 0.62, 0.96, 0); p.scale.set(1, 0.68, 1); p.castShadow = true; g.add(p); }
      const aura = new THREE.Mesh(new THREE.SphereGeometry(0.88, 16, 12), new THREE.MeshBasicMaterial({ color: def.emissive ? def.color : 0xff5a8a, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })); aura.position.y = 0.7; g.add(aura); anim.aura = aura;
    }
    // horns for the fiery folk
    if (type === 'imp' || type === 'hellhound' || type === 'demonlord') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: 0.6 });
      const hgGeo = new THREE.ConeGeometry(0.13, 0.42, 6);
      const hL = new THREE.Mesh(hgGeo, hornMat); hL.position.set(-0.28, 1.0, 0); hL.rotation.z = 0.5; hL.castShadow = true;
      const hR = new THREE.Mesh(hgGeo, hornMat); hR.position.set(0.28, 1.0, 0); hR.rotation.z = -0.5; hR.castShadow = true;
      g.add(hL, hR);
      // a barbed devil tail with a glowing tip
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.7, 6), hornMat); tail.position.set(0, 0.45, -0.5); tail.rotation.x = -0.9; tail.castShadow = true; g.add(tail);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 5), new THREE.MeshStandardMaterial({ color: def.color, emissive: def.emissive || 0x000000, emissiveIntensity: 0.7, roughness: 0.5 })); tip.position.set(0, 0.8, -0.76); tip.rotation.x = 0.5; g.add(tip);
    }
    // antenna + rotor for the machines
    if (type === 'drone' || type === 'bot' || type === 'overmind') {
      const techMat = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, metalness: 0.5, roughness: 0.3, emissive: 0x2a6a7a, emissiveIntensity: 0.5 });
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), techMat); ant.position.y = 1.15; g.add(ant);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), techMat); bulb.position.y = 1.4; g.add(bulb);
      if (type === 'drone') { const wingMat = new THREE.MeshStandardMaterial({ color: 0x3fb0c8, metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide }); const wgeo = new THREE.BoxGeometry(0.6, 0.04, 0.3); const wL = new THREE.Mesh(wgeo, wingMat); wL.position.set(-0.5, 0.7, 0); const wR = new THREE.Mesh(wgeo, wingMat); wR.position.set(0.5, 0.7, 0); g.add(wL, wR); anim.wings = [wL, wR]; }
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
      // dripping mandible fangs
      const fangMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d6, roughness: 0.4 });
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 5), fangMat); f.position.set(sx * 0.12, 0.5, 0.5); f.rotation.x = 2.3; f.castShadow = true; g.add(f); }
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
      // little fangs
      const fangMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), fangMat); f.position.set(sx * 0.07, 0.56, 0.52); f.rotation.x = Math.PI; g.add(f); }
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
    e.r = def.r; // collision radius (already final — do NOT multiply by size again; that was the boss hitbox bug)
    e.xp = def.xp;
    e.baseY = def.baseY;
    e.alive = true;
    e.slow = 0; e.slowT = 0;
    e.contactCd = 0;
    e.flash = 0;
    e.phase = Math.random() * 10;
    e.spawnT = 0.45; // emerging from a portal
    e.knock = new THREE.Vector3();
    e.atkCd = def.atkInterval ? def.atkInterval * (0.5 + Math.random() * 0.6) : 0; // stagger first ability use
    e.shield = def.shield || 0;
    e.charging = 0;
    e.squashT = 0;
    e.mesh.rotation.x = 0;

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
    if (game && e.slow > 0 && game.stats && game.stats.shatterDmg) n *= (1 + game.stats.shatterDmg); // Shatter: bonus vs slowed
    if (e.shield > 0) { const a = Math.min(e.shield, n); e.shield -= a; n -= a; e.flash = 0.12; e.squashT = 0.16; if (n <= 0) { if (game) game.popDamage(e.mesh.position, a); return; } }
    e.hp -= n;
    e.flash = 0.12;
    e.squashT = 0.16;   // recoil squash on a hit
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
      game.particles.burst({ pos: e.mesh.position.clone().setY(0.7 * def.size), color: def.color, count: def.boss ? 54 : 16, speed: def.boss ? 11 : 7, size: 0.35 * def.size, life: 0.9, up: 3, blend: 'normal' });
      game.particles.burst({ pos: e.mesh.position.clone().setY(0.7 * def.size), color: 0xffffff, count: 8, speed: 8, size: 0.26, life: 0.45 });
      game.particles.ring({ pos: e.mesh.position.clone().setY(0.2), color: 0xffffff, r0: 0.2, r1: 1.4 * def.size + 0.8, life: 0.32 }); // a crisp death pop
      game.spawnXP(e.mesh.position.clone(), e.xp);
      game.enemyDrop(e.mesh.position.clone(), def);
      if (def.boss) { this.bossAlive = false; game.particles.ring({ pos: e.mesh.position.clone(), color: 0xffd98a, r0: 1, r1: 16, life: 0.9 }); game.onBossDead(); }
      game.kills++;
      if (game.onKill) game.onKill(e, def);
      // splitter: birth smaller foes where it died
      if (def.splitInto && this.countNonBoss() < MAX_ENEMIES - 4) {
        for (let k = 0; k < (def.splitCount || 2); k++) { const c = this.spawn(def.splitInto, 0.5, e.mesh.position.clone(), game); if (c) c.spawnT = 0.15; }
      }
      // bomber: a final AoE blast that can catch the wizard
      if (def.explodeDmg) {
        const R = def.explodeR || 3;
        game.particles.ring({ pos: e.mesh.position.clone().setY(0.3), color: 0xff7a3a, r0: 0.4, r1: R, life: 0.5 });
        game.particles.burst({ pos: e.mesh.position.clone().setY(0.6), color: 0xff7a3a, count: 22, speed: 8, size: 0.32, life: 0.7 });
        game.shake(1.0);
        const pd = Math.hypot(game.wizard.pos.x - e.mesh.position.x, game.wizard.pos.z - e.mesh.position.z);
        if (pd < R) game.wizard.takeDamage(def.explodeDmg, e.mesh.position);
      }
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
      // special abilities (ranged shots / summons / shield upkeep); chargers lunge in bursts
      const adef = TYPES[e.type];
      if (adef.ability) { e.atkCd -= dt; if (e.atkCd <= 0) { e.atkCd = adef.atkInterval; const fn = ENEMY_ABILITIES[adef.ability]; if (fn) fn(e, adef, game, d, dx, dz); } }
      let chargeMul = 1; if (e.charging > 0) { e.charging -= dt; chargeMul = 3; }
      let vx = (dx / d) * speed * chargeMul;
      let vz = (dz / d) * speed * chargeMul;

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

      // wobble (the wonk) — squishier now: idle jiggle + harder pulse while charging + recoil on hits
      e.phase += dt * (4 + speed);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.mesh.rotation.z = Math.sin(e.phase) * 0.18;
      e.mesh.rotation.x = e.charging > 0 ? -0.28 : (e.mesh.rotation.x ? e.mesh.rotation.x * 0.8 : 0); // lean into a lunge
      const amp = 0.09 + (e.charging > 0 ? 0.12 : 0);
      let squash = 1 + Math.sin(e.phase * 2) * amp;
      if (e.squashT > 0) { e.squashT -= dt; const k = e.squashT / 0.16; squash *= (1 - 0.3 * k * k); } // flatten on a hit, spring back
      const baseSz = TYPES[e.type].size;
      e.mesh.scale.y = baseSz * squash;
      e.mesh.scale.x = baseSz * (2 - squash);
      e.mesh.scale.z = baseSz * (1 + (squash - 1) * 0.4);
      const hover = e.baseY > 0 ? e.baseY + Math.sin(e.phase * 1.4) * 0.35 : Math.abs(Math.sin(e.phase)) * 0.12 * TYPES[e.type].size;
      e.mesh.position.y = hover;
      if (e.anim.wings) { const f = Math.sin(e.phase * 6); e.anim.wings[0].rotation.y = f * 0.7; e.anim.wings[1].rotation.y = Math.PI - f * 0.7; }
      if (e.anim.cape) e.anim.cape.rotation.x = Math.sin(e.phase * 1.5) * 0.12;
      if (e.anim.aura) { e.anim.aura.material.opacity = 0.1 + Math.abs(Math.sin(e.phase * 1.4)) * 0.12; e.anim.aura.scale.setScalar(1 + Math.sin(e.phase) * 0.06); }

      if (e.flash > 0) {
        e.flash -= dt;
        e.bodyMat.emissive.setRGB(e.flash * 8, e.flash * 8, e.flash * 8);
      } else if (e.bodyMat.emissive.r !== 0) {
        e.bodyMat.emissive.setRGB(0, 0, 0);
      }

      if (e.contactCd > 0) e.contactCd -= dt;
      const pr = 0.7 + e.r;
      if (d < pr && e.contactCd <= 0) {
        if (adef.explodeDmg) { this._kill(e, game); continue; } // bombers detonate on contact
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
