// enemies.js — five wobbling foes: goblin, bat, vampire, zombie, and the
// Goblin King boss. Survivor-style: they shamble toward the wizard and swarm.
import * as THREE from 'three';
import { ARENA } from './wizard.js';
import { outlineGroup } from './outline.js';
import { pxMap } from './pixeltex.js';

const TYPES = {
  // forest
  goblin:  { hp: 12,  speed: 2.9, dmg: 6,  r: 0.6,  xp: 5,   color: 0x8fc24a, size: 1.0, baseY: 0 },
  bat:     { hp: 5,   speed: 5.0, dmg: 4,  r: 0.45, xp: 3,   color: 0x8c6fb8, size: 0.7, baseY: 1.4 },
  vampire: { hp: 26,  speed: 3.5, dmg: 9,  r: 0.7,  xp: 16,  color: 0xe6dcec, size: 1.15, baseY: 0 },
  zombie:  { hp: 52,  speed: 1.5, dmg: 11, r: 0.95, xp: 13,  color: 0x6f9e5a, size: 1.55, baseY: 0 },
  slime:   { hp: 20,  speed: 2.2, dmg: 7,  r: 0.7,  xp: 7,   color: 0x4ad0a8, size: 1.0, baseY: 0 },
  mushroomcap: { hp: 60, speed: 1.4, dmg: 10, r: 0.85, xp: 12, color: 0xc44a5a, size: 1.35, baseY: 0 },
  goblinking:  { hp: 850, speed: 1.9, dmg: 18, r: 2.0, xp: 220, color: 0x6fae3a, size: 3.2, baseY: 0, boss: true },
  // cave
  rat:      { hp: 8,  speed: 4.3, dmg: 5,  r: 0.45, xp: 3,  color: 0x8a7a66, size: 0.7, baseY: 0 },
  brutebat: { hp: 34, speed: 3.1, dmg: 10, r: 0.75, xp: 9,  color: 0x6a5a8c, size: 1.25, baseY: 1.2 },
  spider:   { hp: 22, speed: 3.4, dmg: 9,  r: 0.7,  xp: 10, color: 0x4a3a55, size: 1.05, baseY: 0 },
  stonegolem: { hp: 70, speed: 1.6, dmg: 13, r: 0.9, xp: 15, color: 0x8a8f96, size: 1.45, baseY: 0, metalness: 0.2 },
  spiderqueen: { hp: 1000, speed: 1.9, dmg: 18, r: 2.0, xp: 240, color: 0x6a2f6a, size: 3.0, baseY: 0, boss: true },
  // graveyard
  skeleton: { hp: 24, speed: 2.7, dmg: 9,  r: 0.65, xp: 9,  color: 0xe6e2d0, size: 1.05, baseY: 0 },
  wraith:   { hp: 18, speed: 3.9, dmg: 11, r: 0.65, xp: 12, color: 0x9fb0c8, size: 1.1, baseY: 0.9 },
  wispling: { hp: 10, speed: 4.8, dmg: 6, r: 0.5, xp: 6, color: 0xbfe6ff, size: 0.75, baseY: 1.3, emissive: 0x2a6a8a },
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
    // Megabonk-style: FLAT-SHADED low-poly materials — every facet reads as a hard plane
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: def.metalness ? 0.4 : 0.85, metalness: def.metalness || 0, emissive: def.emissive || 0x000000, emissiveIntensity: def.emissive ? 0.6 : 0, flatShading: true });
    pxMap(bodyMat, 'cloth', 2); // pixel-art hide grain (multiplies with the type colour)
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.7, flatShading: true });
    const anim = { wings: null, cape: null };

    const fierce = !!(def.boss || def.emissive || type === 'vampire' || type === 'warden' || type === 'spider' || type === 'spiderqueen');

    // chunky faceted gem-blob body (low-poly icosphere, squashed tall)
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), bodyMat);
    body.scale.set(1, 1.1, 1);
    body.position.y = 0.62;
    body.castShadow = true;
    g.add(body);

    // googly eyes: pale eyeball (ink hull rings it -> crisp outline) + dark pupil dot (opted
    // out of the hull); bigger + red-tinted with angry brows on fierce foes. Untextured mats.
    const scleraMat = new THREE.MeshStandardMaterial({ color: fierce ? 0xffdccf : 0xf2ece0, roughness: 0.6, flatShading: true });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.5, flatShading: true });
    const er0 = fierce ? 0.13 : 0.11;
    const eGeo = new THREE.SphereGeometry(er0, 7, 6);
    const pGeo = new THREE.SphereGeometry(er0 * 0.5, 6, 5);
    for (const sx of [-1, 1]) {
      const sc = new THREE.Mesh(eGeo, scleraMat); sc.position.set(sx * 0.2, 0.95, 0.52); sc.scale.set(1, 1.08, 0.72); g.add(sc);
      const pu = new THREE.Mesh(pGeo, pupilMat); pu.position.set(sx * 0.2, 0.95, 0.6); pu.userData.noOutline = true; g.add(pu);
      if (fierce) { const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.08), pupilMat); brow.position.set(sx * 0.2, 1.13, 0.5); brow.rotation.z = sx * 0.5; g.add(brow); }
    }

    // little feet (flyers/floaters have none)
    if (type !== 'bat' && type !== 'brutebat' && type !== 'wraith' && type !== 'drone' && type !== 'wispling') {
      const footGeo = new THREE.SphereGeometry(0.17, 6, 5);
      const fL = new THREE.Mesh(footGeo, darkMat); fL.position.set(-0.26, 0.12, 0.05); fL.castShadow = true;
      const fR = new THREE.Mesh(footGeo, darkMat); fR.position.set(0.26, 0.12, 0.05); fR.castShadow = true;
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
      const goldMat = pxMap(new THREE.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.55, roughness: 0.32, emissive: 0x4a3400, emissiveIntensity: 0.5, flatShading: true }), 'metal', 2);
      const gemMat = pxMap(new THREE.MeshStandardMaterial({ color: 0xff3a5a, emissive: 0x6a0a1a, emissiveIntensity: 0.85, roughness: 0.2, metalness: 0.2, flatShading: true }), 'gem', 1);
      const crown = new THREE.Group(); crown.position.y = 1.5;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 12), goldMat); crown.add(band);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.36, 5), goldMat); spike.position.set(Math.cos(a) * 0.48, 0.26, Math.sin(a) * 0.48); crown.add(spike); }
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), gemMat); gem.position.set(0, 0.06, 0.5); crown.add(gem);
      crown.castShadow = true; g.add(crown);
      const capeMat = new THREE.MeshStandardMaterial({ color: 0x6a1020, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x1a0206, flatShading: true });
      const cape = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.7, 14, 1, true), capeMat); cape.position.set(0, 0.7, -0.36); cape.castShadow = true; g.add(cape); if (!anim.cape) anim.cape = cape;
      const palMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, metalness: 0.5, roughness: 0.4, flatShading: true });
      for (const side of [-1, 1]) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.27, 6, 5), palMat); p.position.set(side * 0.62, 0.96, 0); p.scale.set(1, 0.68, 1); p.castShadow = true; g.add(p); }
      const aura = new THREE.Mesh(new THREE.SphereGeometry(0.88, 16, 12), new THREE.MeshBasicMaterial({ color: def.emissive ? def.color : 0xff5a8a, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })); aura.position.y = 0.7; g.add(aura); anim.aura = aura;
    }
    // horns for the fiery folk
    if (type === 'imp' || type === 'hellhound' || type === 'demonlord') {
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: 0.6, flatShading: true });
      const hgGeo = new THREE.ConeGeometry(0.13, 0.42, 6);
      const hL = new THREE.Mesh(hgGeo, hornMat); hL.position.set(-0.28, 1.0, 0); hL.rotation.z = 0.5; hL.castShadow = true;
      const hR = new THREE.Mesh(hgGeo, hornMat); hR.position.set(0.28, 1.0, 0); hR.rotation.z = -0.5; hR.castShadow = true;
      g.add(hL, hR);
      // a barbed devil tail with a glowing tip
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.7, 6), hornMat); tail.position.set(0, 0.45, -0.5); tail.rotation.x = -0.9; tail.castShadow = true; g.add(tail);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 5), new THREE.MeshStandardMaterial({ color: def.color, emissive: def.emissive || 0x000000, emissiveIntensity: 0.7, roughness: 0.5, flatShading: true })); tip.position.set(0, 0.8, -0.76); tip.rotation.x = 0.5; g.add(tip);
    }
    // antenna + rotor for the machines
    if (type === 'drone' || type === 'bot' || type === 'overmind') {
      const techMat = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, metalness: 0.5, roughness: 0.3, emissive: 0x2a6a7a, emissiveIntensity: 0.5, flatShading: true });
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), techMat); ant.position.y = 1.15; g.add(ant);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), techMat); bulb.position.y = 1.4; g.add(bulb);
      if (type === 'drone') { const wingMat = new THREE.MeshStandardMaterial({ color: 0x3fb0c8, metalness: 0.4, roughness: 0.4, side: THREE.DoubleSide, flatShading: true }); const wgeo = new THREE.BoxGeometry(0.6, 0.04, 0.3); const wL = new THREE.Mesh(wgeo, wingMat); wL.position.set(-0.5, 0.7, 0); const wR = new THREE.Mesh(wgeo, wingMat); wR.position.set(0.5, 0.7, 0); g.add(wL, wR); anim.wings = [wL, wR]; }
    }
    if (type === 'bat' || type === 'brutebat') {
      const wingMat = new THREE.MeshStandardMaterial({ color: type === 'brutebat' ? 0x3a2f4a : 0x4a3a66, roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
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
      const fangMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d6, roughness: 0.4, flatShading: true });
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
      const boneMat = new THREE.MeshStandardMaterial({ color: type === 'skeletonking' ? 0xd8d2bc : 0xeae6d6, roughness: 0.7, flatShading: true });
      for (let r = 0; r < 3; r++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.32 - r * 0.05, 0.04, 6, 14), boneMat); rib.position.set(0, 0.5 + r * 0.18, 0.2); rib.rotation.x = Math.PI / 2; g.add(rib); }
      const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.7, 6); armGeo.translate(0, -0.35, 0);
      const aL = new THREE.Mesh(armGeo, boneMat); aL.position.set(-0.45, 0.95, 0.1); aL.rotation.x = -1.2; aL.castShadow = true;
      const aR = new THREE.Mesh(armGeo, boneMat); aR.position.set(0.45, 0.95, 0.1); aR.rotation.x = -1.2; aR.castShadow = true;
      g.add(aL, aR);
    }
    if (type === 'wraith') {
      // tattered hood + wispy tail (no feet, floats)
      const robe = new THREE.MeshStandardMaterial({ color: 0x6a7a9a, roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide, flatShading: true });
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 12, 1, true), robe); hood.position.set(0, 0.5, 0); hood.castShadow = true;
      g.add(hood); anim.cape = hood;
    }
    if (type === 'vampire') {
      // a swishy cape + pale slicked look
      const capeMat = new THREE.MeshStandardMaterial({ color: 0x2a0e1a, roughness: 0.7, side: THREE.DoubleSide, flatShading: true });
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
    if (type === 'slime') {
      // squashed gelatinous blob with a few drips sliding off it + a glossy inner shine
      body.scale.set(1.3, 0.72, 1.3);
      for (const [ox, oz, s] of [[-0.36, 0.18, 0.17], [0.34, -0.12, 0.14], [0.08, 0.38, 0.12]]) {
        const drip = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 6), bodyMat); drip.position.set(ox, 0.16, oz); drip.scale.y = 1.4; drip.castShadow = true; g.add(drip);
      }
      const shine = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), new THREE.MeshStandardMaterial({ color: 0xe6fff6, roughness: 0.25, flatShading: true })); shine.position.set(-0.18, 0.7, 0.32); g.add(shine);
    }
    if (type === 'mushroomcap') {
      // a big domed toadstool cap crowning the squat fungus body, dotted white
      const capMat = new THREE.MeshStandardMaterial({ color: 0xd8465e, roughness: 0.75, flatShading: true });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), capMat); cap.position.y = 1.02; cap.scale.set(1, 0.7, 1); cap.castShadow = true; g.add(cap);
      const spotMat = new THREE.MeshStandardMaterial({ color: 0xf4ece0, roughness: 0.6, flatShading: true });
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const rr = 0.3 + (k % 3) * 0.13; const yy = 1.02 + Math.sqrt(Math.max(0, 0.85 * 0.85 - rr * rr)) * 0.7; const sp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), spotMat); sp.position.set(Math.cos(a) * rr, yy, Math.sin(a) * rr); sp.scale.y = 0.45; g.add(sp); }
      body.scale.set(1.05, 0.9, 1.05);
    }
    if (type === 'wispling') {
      // a floating will-o'-wisp: the glowing body wrapped in a soft additive halo, dripping a wispy tail
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 12), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.y = 0.62; g.add(halo); anim.aura = halo;
      const tailGeo = new THREE.ConeGeometry(0.32, 1.1, 8, 1, true); tailGeo.rotateX(Math.PI);
      const tail = new THREE.Mesh(tailGeo, new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); tail.position.set(0, 0.1, 0); g.add(tail); anim.cape = tail;
    }
    if (type === 'stonegolem') {
      // a lumbering rock brute: chunky boxy shoulders, heavy boulder fists, jagged crown crag
      const rockMat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: def.metalness || 0.2, flatShading: true });
      for (const side of [-1, 1]) {
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.5), rockMat); shoulder.position.set(side * 0.6, 1.0, 0); shoulder.rotation.y = side * 0.3; shoulder.rotation.z = side * 0.15; shoulder.castShadow = true; g.add(shoulder);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), rockMat); arm.position.set(side * 0.72, 0.5, 0.12); arm.rotation.z = side * 0.12; arm.castShadow = true; g.add(arm);
        const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 0), rockMat); fist.position.set(side * 0.78, 0.16, 0.16); fist.castShadow = true; g.add(fist);
      }
      const crag = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), rockMat); crag.position.set(0, 1.28, -0.1); crag.rotation.y = 0.5; crag.castShadow = true; g.add(crag);
      body.scale.set(1.15, 1.05, 1.1);
    }

    g.scale.setScalar(def.size);
    // Megabonk ink contour around the whole critter (eyes/aura/FX are skipped by the helper)
    outlineGroup(g, { thick: 0.04 });
    this.group.add(g);
    return { mesh: g, bodyMat, anim, _baseEmissive: new THREE.Color(def.emissive || 0x000000) };
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
    e.dying = 0;
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
    if (game) {
      game.popDamage(e.mesh.position, n);
      if (game.particles && e.hp > 0) {
        const hy = 0.6 * TYPES[e.type].size;
        game.particles.burst({ pos: e.mesh.position.clone().setY(hy), color: 0xfff2c0, count: 5, speed: 5, size: 0.16, life: 0.28, up: 1.5 }); // chip sparks
        game.particles.ring({ pos: e.mesh.position.clone().setY(hy * 0.8), color: 0xffffff, r0: 0.1, r1: 0.7 * TYPES[e.type].size + 0.4, life: 0.16 }); // crisp hit pop
      }
      if (n >= 40) game._hitstop(0.05); // a beat of weight on a heavy blow
    }
    if (e.hp <= 0) this._kill(e, game);
  }

  applySlow(e, factor, time) {
    e.slow = Math.max(e.slow, factor);
    e.slowT = Math.max(e.slowT, time);
  }

  _kill(e, game) {
    e.alive = false;
    e.dying = 0.16; e.dyingMax = 0.16; // hand the mesh to the squish-pop in update()
    const def = TYPES[e.type];
    if (game) {
      game.audio.play('enemyDie');
      const dp = e.mesh.position.clone().setY(0.7 * def.size);
      game.particles.burst({ pos: dp, color: def.color, count: def.boss ? 54 : 18, speed: def.boss ? 11 : 7, size: 0.35 * def.size, life: 0.9, up: 3, blend: 'normal' });
      game.particles.burst({ pos: dp.clone(), color: def.color, count: def.boss ? 22 : 7, speed: 3.5, size: 0.55 * def.size, life: 1.1, grav: -15, up: 4.5, blend: 'normal' }); // heavy gibs that arc & tumble
      game.particles.burst({ pos: dp.clone(), color: 0xffffff, count: def.boss ? 16 : 10, speed: 8, size: 0.26, life: 0.5 });               // white spark flash
      game.particles.burst({ pos: dp.clone(), color: 0xfff0b0, count: def.boss ? 14 : 6, speed: 2.4, size: 0.18, life: 1.3, grav: 5, up: 3, blend: 'add' }); // upward "soul" motes
      game.particles.ring({ pos: e.mesh.position.clone().setY(0.2), color: 0xffffff, r0: 0.2, r1: 1.4 * def.size + 0.8, life: 0.32 }); // a crisp white pop
      game.particles.ring({ pos: e.mesh.position.clone().setY(0.18), color: def.color, r0: 0.2, r1: 2.4 * def.size + 1.2, life: 0.5 });   // a wider colored shock
      if (!def.boss) game.shake(0.3 + def.size * 0.2);
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
        game.shake(1.0); if (game._hitstop) game._hitstop(0.1);
        const pd = Math.hypot(game.wizard.pos.x - e.mesh.position.x, game.wizard.pos.z - e.mesh.position.z);
        if (pd < R) game.wizard.takeDamage(def.explodeDmg * (game._stageMods ? game._stageMods.dmgMult : 1), e.mesh.position);
      }
    }
  }

  update(dt, game) {
    const player = game.wizard.pos;
    // per-stage gimmick mods (e.g. Frenzy = faster, Glass Fangs = bigger bite)
    const mods = game._stageMods, spdM = mods ? mods.speedMult : 1, dmgM = mods ? mods.dmgMult : 1;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (!e.alive) {
        if (e.dying > 0) {                                   // squish-pop before it vanishes — juicy kill
          e.dying -= dt;
          const dsz = TYPES[e.type].size;
          const u = 1 - Math.max(0, e.dying) / (e.dyingMax || 0.16); // 0→1
          const m = u < 0.32 ? 1 + (u / 0.32) * 0.75 : Math.max(0.01, 1.75 * (1 - (u - 0.32) / 0.68));
          e.mesh.scale.set(dsz * m * 1.18, dsz * m * 0.78, dsz * m * 1.18); // pop wide then implode
          e.mesh.rotation.y += dt * 14;
          e.mesh.position.y += dt * 1.8;
          if (e.dying > 0) continue;
        }
        e.mesh.visible = false; this.pools[e.type].push(e); this.list.splice(i, 1); continue;
      }

      const sz = TYPES[e.type].size;
      // emerging from a portal — scale up, don't move or bite yet
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        e.phase += dt * 6;
        // easeOutBack: pop up past full size, then settle — a springy "boing" emerge
        const t = Math.max(0, Math.min(1, 1 - e.spawnT / 0.45));
        const c1 = 1.70158, c3 = c1 + 1, x = t - 1;
        const emerge = Math.max(0.01, 1 + c3 * x * x * x + c1 * x * x);
        e.mesh.scale.setScalar(sz * emerge);
        e.mesh.rotation.y = Math.atan2(player.x - e.mesh.position.x, player.z - e.mesh.position.z);
        e.mesh.position.y = e.baseY;
        continue;
      }

      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      const speed = e.speed * (1 - e.slow) * spdM;

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
        if (!o.alive) continue; // dying corpses (mid death-pop) shouldn't shove the living
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
      const rx = e.charging > 0 ? -0.28 : e.mesh.rotation.x * 0.8;
      e.mesh.rotation.x = Math.abs(rx) < 1e-3 ? 0 : rx; // lean into a lunge, then settle flat
      const amp = 0.13 + (e.charging > 0 ? 0.14 : 0); // jellier idle jiggle
      let squash = 1 + Math.sin(e.phase * 2) * amp;
      if (e.squashT > 0) { e.squashT -= dt; const k = e.squashT / 0.16; squash *= (1 - 0.52 * k * k); } // squishier flatten on a hit
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
        const f = e.flash * 8, b = e._baseEmissive; // white hit-flash ON TOP of the baseline glow
        e.bodyMat.emissive.setRGB(b.r + f, b.g + f, b.b + f);
      } else {
        e.bodyMat.emissive.copy(e._baseEmissive); // restore the designed glow (don't go black)
      }

      if (e.contactCd > 0) e.contactCd -= dt;
      const pr = 0.7 + e.r;
      if (d < pr && e.contactCd <= 0) {
        if (adef.explodeDmg) { this._kill(e, game); continue; } // bombers detonate on contact
        if (game.wizard.takeDamage(e.dmg * dmgM, e.mesh.position)) {
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
