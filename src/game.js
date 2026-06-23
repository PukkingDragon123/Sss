// game.js — the conductor. Owns the renderer, the world, the state machine
// and the main loop; wires every subsystem together.
import * as THREE from 'three';
import { Wizard, ARENA } from './wizard.js';
import { Enemies } from './enemies.js';
import { Particles } from './particles.js';
import { SpellSystem, SPELLS, SPELL_ORDER, GESTURE_TO_SPELL } from './spells.js';
import { Recognizer, TEMPLATES } from './recognizer.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Director, STAGES, OPENING, TAVERN_INTRO, BLACKOUT_LINES } from './story.js';
import { Jobs } from './jobs.js';
import { Tavern } from './tavern.js';
import { RunMap, NODE_META } from './runmap.js';
import { rollUpgrades } from './upgrades.js';
import * as meta from './meta.js';
import { COMBO_META } from './meta.js';

const DEFAULT_STATS = () => ({
  hpMax: 130, moveSpeed: 7.2, wobble: 1.0,
  manaMax: 110, manaRegen: 0, // mana does NOT auto-regen — you must DRINK (Q) to refill it
  drinkPower: 46,             // mana restored per gulp (charm gear adds to this)
  damageMult: 1, cooldownMult: 1,
  fireballDmg: 24, fireballRadius: 3.4,
  lightningDmg: 14, lightningChains: 3,
  frostDmg: 10, frostRadius: 5, frostSlow: 0.5, frostSlowTime: 2.5,
  healAmount: 35,
  gustDmg: 5, gustRange: 9, gustForce: 16, gustSelfPush: 26,
  spikeDmg: 30, novaDmg: 26, novaRadius: 6,
  acidDmg: 40, shieldAmount: 60, quakeDmg: 30, quakeRadius: 6, orbDmg: 60, orbRadius: 4.2,
  pickupRadius: 2.6, hpRegen: 1.0, thorns: 0,
  // run-boon hooks (level-up cards): on-kill sustain, crit & drunk scaling, etc.
  lifeOnKill: 0, manaOnKill: 0, xpMult: 1, critMult: 2, angryDrunk: 0, drinkChaos: 1,
});

export class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.fx2d = document.getElementById('fx2d');
    this.fxctx = this.fx2d.getContext('2d');

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft Human-Fall-Flat shadows
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7e7ec0);
    this.scene.fog = new THREE.FogExp2(0x8e8ecb, 0.0085);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camOffset = new THREE.Vector3(0, 27, 22);
    this.camTarget = new THREE.Vector3();

    this._buildWorld();

    // subsystems
    this.audio = new AudioEngine();
    this.particles = new Particles(this.scene);
    this.enemies = new Enemies(this.scene);
    this.spells = new SpellSystem(this.scene);
    this.jobs = new Jobs(this.scene);
    this.tavern = new Tavern(this.scene);
    this.runmap = new RunMap(this.scene);
    this.wizard = new Wizard(this.scene);
    this.director = new Director();
    this.ui = new UI();
    this.input = new Input(this.canvas);

    this.recognizer = new Recognizer();
    this.recognizer.add('triangle', TEMPLATES.triangle);
    this.recognizer.add('zigzag', TEMPLATES.zigzag);
    this.recognizer.add('circle', TEMPLATES.circle);
    this.recognizer.add('vee', TEMPLATES.vee);
    this.recognizer.add('line', TEMPLATES.line);

    // runtime state
    this.stats = DEFAULT_STATS();
    this.state = 'title';
    this.phase = 'arena';      // 'tavern' (drunk walk) or 'arena' (forest fight)
    this.tavernReady = true;
    this.cineT = 0;
    this._exiting = false;
    this.lastRuckus = 0;
    meta.useSlot(0);
    this.unlocked = new Set(['fireball', 'gust']); // equipped spells in a run
    this.activeCombos = [];
    this._lastCast = null;     // for combo detection
    this.nearStation = null;   // hub interaction target
    this._guideOpen = false;
    this._guideShown = false;
    this._shopKind = null;
    this._introShown = false;
    this._live = null; // live gesture prediction while drawing
    this.elapsed = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = this._xpForLevel(1);
    this.kills = 0;
    this.chores = 0;
    this.pendingLevels = 0;
    this.bossActive = false;
    this.timeScale = 1;
    this.shakeAmt = 0;
    this.drunkenness = 0;   // 0..1 — drives the nausea wobble & extra body sway. Rises when you DRINK.
    this._drunkSurge = 0;   // a brief lurch right after a gulp
    this._drinkCd = 0;      // anti-spam between gulps
    this.aimPoint = new THREE.Vector3(0, 0, 5);
    this.gestureAim = this.aimPoint.clone();
    this.storyQueue = [];
    this.storyShowing = false;

    this.pickups = [];
    this._pickupPool = { xp: [], heart: [], mana: [], gear: [] };
    this._xpGeo = new THREE.OctahedronGeometry(0.28, 0);
    this._xpMat = new THREE.MeshStandardMaterial({ color: 0x6ee7a0, emissive: 0x1f7a47, roughness: 0.4 });
    this._heartGeo = new THREE.SphereGeometry(0.3, 10, 10);
    this._heartMat = new THREE.MeshStandardMaterial({ color: 0xff5d6c, emissive: 0x7a1f2a, roughness: 0.4 });
    this._manaGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.42, 8);
    this._manaMat = new THREE.MeshStandardMaterial({ color: 0x56b8ff, emissive: 0x1c5a8a, roughness: 0.4 });
    this._gearGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
    this._gearMat = new THREE.MeshStandardMaterial({ color: 0xffcf5c, emissive: 0x5a4400, roughness: 0.35, metalness: 0.4 });

    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ray = new THREE.Raycaster();

    this.ui.init(this);
    this.ui.hideLoading();
    this.ui.setScreen('title');
    this.ui.setMuteIcon(false);
    this.enterDemo(); // animated title: wizard auto-fights waves behind the menu

    window.addEventListener('resize', () => this._resize());
    this._resize();

    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---------- world ----------
  _buildWorld() {
    // arena objects live in their own group so we can hide them in the tavern
    this.arenaGroup = new THREE.Group();
    this.scene.add(this.arenaGroup);
    const G = this.arenaGroup;

    // lighting (colour/intensity are re-tuned per phase in _setMood)
    this.hemi = new THREE.HemisphereLight(0x9fb6e8, 0x223a2a, 0.95);
    this.scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xcdd8ff, 1.5);
    this.dir.position.set(28, 46, 18);
    this.dir.castShadow = true;
    this.dir.shadow.mapSize.set(2048, 2048);
    const sc = this.dir.shadow.camera;
    sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 1; sc.far = 200;
    this.dir.shadow.bias = -0.0004;
    this.dir.shadow.normalBias = 0.03;
    this.scene.add(this.dir);
    this.scene.add(this.dir.target);
    this.ambient = new THREE.AmbientLight(0x3a4a6a, 0.45);
    this.scene.add(this.ambient);
    // soft fill from the opposite side for nicer modelling (no shadow)
    this.fill = new THREE.DirectionalLight(0xbfd0ff, 0.4);
    this.fill.position.set(-24, 22, -16);
    this.scene.add(this.fill);

    // floor + clearing (recoloured per stage)
    this.floorMat = new THREE.MeshStandardMaterial({ color: 0x2f4a32, roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), this.floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; G.add(floor);
    this.rugMat = new THREE.MeshStandardMaterial({ color: 0x3f6440, roughness: 1 });
    const rug = new THREE.Mesh(new THREE.CircleGeometry(ARENA, 64), this.rugMat);
    rug.rotation.x = -Math.PI / 2; rug.position.y = 0.01; rug.receiveShadow = true; G.add(rug);
    const rugRing = new THREE.Mesh(new THREE.RingGeometry(ARENA - 0.7, ARENA, 96), new THREE.MeshBasicMaterial({ color: 0xbfe0c2, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    rugRing.rotation.x = -Math.PI / 2; rugRing.position.y = 0.02; G.add(rugRing);

    // per-stage scatter (trees / rocks / graves) rebuilt on stage change
    this.scatterGroup = new THREE.Group(); G.add(this.scatterGroup);
    this._buildScatter('trees');

    // aim reticle on the ground
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 24),
      new THREE.MeshBasicMaterial({ color: 0x6f5fd0, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
    );
    this.reticle.rotation.x = -Math.PI / 2; this.reticle.position.y = 0.05;
    G.add(this.reticle);
  }

  _buildScatter(kind) {
    const grp = this.scatterGroup;
    for (let i = grp.children.length - 1; i >= 0; i--) { const c = grp.children[i]; c.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); grp.remove(c); }

    // Two layers of decoration:
    //  - treeLine(): a dense ring of big landmarks edging the clearing. Kept
    //    just inside the arena (and within fog range) so it actually reads as a
    //    forest/cave/graveyard wall instead of vanishing into the haze.
    //  - inside(): foliage sprinkled across the playfield. CRUCIAL: it only sets
    //    x/z and PRESERVES the y the build() chose, so nothing gets buried at 0.
    const place = (o, x, z, jitterY) => { o.position.set(x, o.position.y + (jitterY || 0), z); o.rotation.y = Math.random() * 6.28; grp.add(o); };
    const treeLine = (build, count = 64) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.06;
        const r = ARENA - 3 + (i % 3) * 2.2 + Math.random() * 1.5; // ~43-49: a visible wall, two rows deep
        const o = build(); o.scale.setScalar(0.9 + Math.random() * 0.8);
        place(o, Math.cos(a) * r, Math.sin(a) * r);
      }
    };
    // scattered across the clearing, biased toward the centre (sqrt keeps it even, *0.86 pulls inward)
    const inside = (n, build, minR = 3, maxR = ARENA - 7) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = (minR + Math.sqrt(Math.random()) * (maxR - minR)) * 0.92;
        const o = build(); o.scale.setScalar(0.75 + Math.random() * 0.7);
        place(o, Math.cos(a) * r, Math.sin(a) * r);
      }
    };

    if (kind === 'trees') {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.95 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6e3f, roughness: 0.9 });
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3a824a, roughness: 0.9 });
      const leafMat3 = new THREE.MeshStandardMaterial({ color: 0x255a34, roughness: 0.9 });
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x356b3e, roughness: 0.95 });
      const fernMat = new THREE.MeshStandardMaterial({ color: 0x418a4a, roughness: 0.95 });
      const capMat = new THREE.MeshStandardMaterial({ color: 0xc0556a, roughness: 0.8 });
      const stalkMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.9 });
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 1 });
      const flowerMat = new THREE.MeshStandardMaterial({ color: 0xe8d24a, emissive: 0x4a4010, roughness: 0.7 });
      const mkTree = () => { const t = new THREE.Group(); const h = 3.4 + Math.random() * 1.6; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, h, 8), trunkMat); tr.position.y = h / 2; tr.castShadow = true; const lm = [leafMat, leafMat2, leafMat3][Math.floor(Math.random() * 3)]; const f1 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.6, 9), lm); f1.position.y = h + 0.6; f1.castShadow = true; const f2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.8, 9), leafMat2); f2.position.y = h + 2.1; const f3 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2, 9), leafMat3); f3.position.y = h + 3.4; t.add(tr, f1, f2, f3); return t; };
      treeLine(mkTree, 54);
      inside(16, mkTree, 6, ARENA - 8);            // full trees dotted inside too
      inside(34, () => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + Math.random() * 0.7, 0), Math.random() < 0.5 ? bushMat : fernMat); b.position.y = 0.55; b.castShadow = true; b.scale.y = 0.8; return b; });
      inside(20, () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 7), stalkMat); s.position.y = 0.25; const c = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat); c.position.y = 0.5; c.castShadow = true; g.add(s, c); return g; });
      inside(16, () => { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.6, 0), rockMat); r.position.y = 0.32; r.castShadow = true; return r; });
      inside(18, () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), flowerMat); fl.position.set((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.2, (Math.random() - 0.5) * 0.6); g.add(fl); } return g; });
    } else if (kind === 'rocks') {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a443e, roughness: 1 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0x5a524a, roughness: 1 });
      const crystalMat = new THREE.MeshStandardMaterial({ color: 0x6fd0e8, emissive: 0x2a7a8a, roughness: 0.25 });
      const mossMat = new THREE.MeshStandardMaterial({ color: 0x3a5a44, roughness: 1 });
      const mkStalagmite = () => { const g = new THREE.Group(); const h = 5 + Math.random() * 4; const base = new THREE.Mesh(new THREE.ConeGeometry(1.6, h, 7), rockMat); base.position.y = h / 2; base.castShadow = true; const tip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2, 6), tipMat); tip.position.y = h; g.add(base, tip); return g; };
      treeLine(mkStalagmite, 50);
      inside(16, mkStalagmite, 6, ARENA - 8);
      inside(30, () => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.8, 0), rockMat); r.position.y = 0.45; r.castShadow = true; return r; });
      inside(22, () => { const g = new THREE.Group(); const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9 + Math.random(), 5), crystalMat); c.position.set((Math.random() - 0.5) * 0.5, 0.5, (Math.random() - 0.5) * 0.5); c.rotation.z = (Math.random() - 0.5) * 0.4; c.castShadow = true; g.add(c); } return g; });
      inside(16, () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.5, 0), mossMat); m.position.y = 0.3; m.scale.y = 0.6; return m; });
    } else if (kind === 'graves') {
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6e7a, roughness: 1 });
      const deadMat = new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.95 });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xd8d2bc, roughness: 0.8 });
      const fenceMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7, metalness: 0.3 });
      const mkLandmark = () => {
        const g = new THREE.Group();
        if (Math.random() < 0.55) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.4), stoneMat); s.position.y = 1.1; s.rotation.z = (Math.random() - 0.5) * 0.3; s.castShadow = true; g.add(s); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 12, 1, false, 0, Math.PI), stoneMat); top.rotation.z = Math.PI / 2; top.position.y = 2.2; g.add(top); }
        else { const h = 4.5 + Math.random() * 2; const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, h, 7), deadMat); trunk.position.y = h / 2; trunk.castShadow = true; const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 2, 5), deadMat); b1.position.set(0.8, h - 1, 0); b1.rotation.z = -0.9; const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.6, 5), deadMat); b2.position.set(-0.7, h - 1.6, 0); b2.rotation.z = 0.9; g.add(trunk, b1, b2); }
        return g;
      };
      treeLine(mkLandmark, 50);
      inside(26, () => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.3), stoneMat); s.position.y = 0.65; s.rotation.z = (Math.random() - 0.5) * 0.4; s.castShadow = true; return s; });
      inside(20, () => { const c = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 6, 12, Math.PI), boneMat); c.position.y = 0.14; c.castShadow = true; return c; });
      inside(16, () => { const g = new THREE.Group(); const cross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), deadMat); cross.position.y = 0.55; const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), deadMat); arm.position.y = 0.8; g.add(cross, arm); return g; });
      inside(14, () => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), fenceMat); f.position.y = 0.45; f.castShadow = true; return f; });
    }
  }

  _applyStageTheme(stage) {
    const t = stage.theme;
    this.scene.background.setHex(t.bg);
    this.scene.fog.color.setHex(t.fog); this.scene.fog.density = t.fogD;
    this.hemi.color.setHex(t.hemi); this.hemi.groundColor.setHex(t.hemiG); this.hemi.intensity = 1.0;
    this.dir.color.setHex(t.dir); this.dir.intensity = t.dirI;
    this.ambient.color.setHex(t.amb); this.ambient.intensity = 0.5;
    this.floorMat.color.setHex(t.floor);
    this.rugMat.color.setHex(t.rug);
    this._buildScatter(t.scatter);
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx2d.width = w; this.fx2d.height = h;
  }

  // ---------- progression helpers ----------
  _xpForLevel(lvl) { return Math.floor(5 + (lvl - 1) * 4 + Math.pow(Math.max(0, lvl - 1), 1.6) * 1.6); }

  // sustain & rewards when a foe dies (on-kill boons)
  onKill(e, def) {
    const s = this.stats;
    if (s.lifeOnKill) this.wizard.heal(s.lifeOnKill);
    if (s.manaOnKill) this.wizard.mana = Math.min(s.manaMax, this.wizard.mana + s.manaOnKill);
  }

  gainXP(n) {
    n = Math.round(n * (this.stats.xpMult || 1));
    this.xp += n;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.pendingLevels++;
      this.xpNeed = this._xpForLevel(this.level);
    }
    if (this.pendingLevels > 0 && this.state === 'play') this._openLevelUp();
  }

  _openLevelUp() {
    this.state = 'levelup';
    this.audio.play('levelup');
    const choices = rollUpgrades(this, 3);
    this.ui.showLevelUp(choices, (u) => {
      u.apply(this);
      this.pendingLevels--;
      if (this.pendingLevels > 0) this._openLevelUp();
      else this.state = 'play';
    });
  }

  // a one-off boon pick (used by the campfire "Study" option on the map)
  offerUpgrade(onPicked) {
    this.state = 'levelup';
    this.audio.play('levelup');
    const choices = rollUpgrades(this, 3);
    this.ui.showLevelUp(choices, (u) => { u.apply(this); if (onPicked) onPicked(); });
  }

  // ---------- pickups ----------
  _getPickup(type) {
    const pool = this._pickupPool[type];
    if (pool.length) { const m = pool.pop(); m.visible = true; return m; }
    const geo = type === 'xp' ? this._xpGeo : type === 'heart' ? this._heartGeo : type === 'mana' ? this._manaGeo : this._gearGeo;
    const mat = type === 'xp' ? this._xpMat : type === 'heart' ? this._heartMat : type === 'mana' ? this._manaMat : this._gearMat;
    const mesh = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);
    return mesh;
  }

  spawnMana(pos) {
    const mesh = this._getPickup('mana');
    mesh.position.copy(pos).setY(0.5);
    this.pickups.push({ mesh, type: 'mana', value: 40, vel: new THREE.Vector3(0, 5, 0), phase: 0, grounded: false });
  }
  spawnGear(pos, inst) {
    const mesh = this._getPickup('gear');
    mesh.position.copy(pos).setY(0.5);
    this.pickups.push({ mesh, type: 'gear', gear: inst, vel: new THREE.Vector3((Math.random() - 0.5) * 3, 5, (Math.random() - 0.5) * 3), phase: 0, grounded: false });
  }
  // loot table when an enemy dies
  enemyDrop(pos, def) {
    const lvl = Math.max(1, this.level);
    if (def.boss) { // bosses always drop a good piece + a potion
      this.spawnGear(pos.clone(), meta.dropGear(lvl + 2, true));
      this.spawnHeart(pos.clone().add(new THREE.Vector3(1, 0, 0)));
      return;
    }
    const big = def.size >= 1.4;
    const r = Math.random();
    if (r < (big ? 0.30 : 0.06)) this.spawnHeart(pos);
    else if (r < (big ? 0.50 : 0.13)) this.spawnMana(pos);
    else if (r < (big ? 0.62 : 0.16)) this.spawnGear(pos, meta.dropGear(lvl, false));
  }

  spawnXP(pos, value) {
    if (this.pickups.length > 360) { // safety valve — auto-bank the oldest
      const old = this.pickups.shift();
      this.gainXP(old.value);
      old.mesh.visible = false; this._pickupPool[old.type].push(old.mesh);
    }
    const mesh = this._getPickup('xp');
    mesh.position.copy(pos).setY(0.4);
    this.pickups.push({ mesh, type: 'xp', value, vel: new THREE.Vector3((Math.random() - 0.5) * 4, 4, (Math.random() - 0.5) * 4), phase: Math.random() * 6, grounded: false });
  }

  spawnHeart(pos) {
    const mesh = this._getPickup('heart');
    mesh.position.copy(pos).setY(0.5);
    this.pickups.push({ mesh, type: 'heart', value: 22, vel: new THREE.Vector3(0, 5, 0), phase: 0, grounded: false });
  }

  _updatePickups(dt) {
    const p = this.wizard.pos;
    const rad = this.stats.pickupRadius;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      it.phase += dt * 4;
      const dx = p.x - it.mesh.position.x, dz = p.z - it.mesh.position.z;
      const d = Math.hypot(dx, dz);

      if (!it.grounded) {
        it.vel.y -= 18 * dt;
        it.mesh.position.addScaledVector(it.vel, dt);
        if (it.mesh.position.y <= 0.4) { it.mesh.position.y = 0.4; it.grounded = true; }
      }
      // magnet
      if (d < rad + (it.type === 'heart' ? 0.5 : 0)) {
        const pull = 14 + (rad - d) * 6;
        it.mesh.position.x += (dx / (d || 1)) * pull * dt;
        it.mesh.position.z += (dz / (d || 1)) * pull * dt;
      }
      it.mesh.position.y = 0.4 + Math.sin(it.phase) * 0.08;
      it.mesh.rotation.y += dt * 3;

      if (d < 1.0) {
        if (it.type === 'xp') { this.gainXP(it.value); this.audio.play('xp'); }
        else if (it.type === 'heart') { this.wizard.heal(it.value); this.audio.play('heal'); this.ui.toast(`❤ +${it.value} HP`); }
        else if (it.type === 'mana') { this.wizard.mana = Math.min(this.stats.manaMax, this.wizard.mana + it.value); this.audio.play('heal'); this.ui.toast(`🧪 +${it.value} mana`); }
        else if (it.type === 'gear') { meta.addGear(it.gear); meta.save(); this.audio.play('levelup'); this.ui.lootToast(it.gear); }
        it.mesh.visible = false;
        this._pickupPool[it.type].push(it.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  _clearPickups() {
    for (const it of this.pickups) { it.mesh.visible = false; this._pickupPool[it.type].push(it.mesh); }
    this.pickups.length = 0;
  }

  // ---------- effects helpers used by subsystems ----------
  shake(a) { if (this.shakeEnabled === false) return; this.shakeAmt = Math.min(2.5, this.shakeAmt + a); }

  popDamage(worldPos, n) {
    const v = worldPos.clone(); v.y += 1.2;
    v.project(this.camera);
    if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.ui.floatNumber(x, y, Math.round(n), '#ffe08a');
  }

  notifySpell(tags, pos) { this.jobs.onSpell(tags, pos, this); }

  // floor is flat now (the room is a separate scene, not an in-scene deck)
  floorHeightAt() { return 0; }

  // ---------- story queue ----------
  showStory(speaker, lines, onComplete) {
    this.storyQueue.push({ speaker, lines, onComplete });
    if (!this.storyShowing) this._nextStory();
  }
  _nextStory() {
    if (this.storyQueue.length === 0) { this.storyShowing = false; if (this.state === 'story') this.state = 'play'; return; }
    this.storyShowing = true;
    if (this.state === 'play') this.state = 'story';
    const item = this.storyQueue.shift();
    this.ui.showStory(item.speaker, item.lines, () => { if (item.onComplete) item.onComplete(); this._nextStory(); });
  }

  // ---------- jobs / boss ----------
  onJobComplete(name) {
    this.chores++;
    this.ui.hideJob();
    this.ui.toast(`✓ ${name}!`);
    this.gainXP(14);
    this.showStory('The Spirit', [`"${name}" — done! Who says a drunk can\'t multitask? (+XP)`]);
  }

  announceWave(w, total, isBoss) {
    this.audio.play(isBoss ? 'explosion' : 'levelup');
    this.ui.bannerWave(w, total, isBoss);
  }

  startBossCinematic(stage) {
    if (this.bossActive) return;
    this.bossActive = true;
    const e = this.enemies.spawn(stage.bossType, 1.0, this.wizard.pos, this);
    this._bossEnemy = e;
    this.bossCine = 2.8; // dramatic focus + slow-mo
    this.shake(2);
    this.ui.bossBanner(stage.bossName);
    this.audio.play('gameover'); // ominous sting
  }

  onBossDead() {
    this.bossActive = false; this.bossKilled = true;
    this.showStory('The Spirit', [`${this.stage.bossName} falls! ${this.stage.name} is conquered. Let's stagger home rich.`]);
    this._endState = 'cleared';
    this.audio.play('win');
  }

  _winRun() {
    if (this.state === 'win' || this.state === 'gameover') return;
    this.state = 'win';
    this._showEnd(true);
  }
  _loseRun() {
    if (this.state === 'win' || this.state === 'gameover') return;
    this.state = 'gameover';
    this.audio.play('gameover');
    this._showEnd(false);
  }
  // backwards-compat alias used by the wizard-death check
  _lose() { this._loseRun(); }

  _showEnd(win) {
    if (win && !meta.tavernOwned()) { meta.setTavernOwned(true); this._justInherited = true; } // avenge -> inherit
    const earned = Math.max(0, meta.gold() - (this.runGoldStart || 0));
    const questDone = meta.evaluateQuest({ kills: this.kills, time: Math.floor(this.elapsed), wave: this.nodesCleared, bossKilled: this.bossKilled, win });
    meta.save();
    this.ui.closeModals();
    this.ui.setScreen('end');
    this.ui.showResults(win, {
      nodes: this.nodesCleared, kills: this.kills, level: this.level, stage: this.stage ? this.stage.name : '',
      earned, gold: meta.gold(), questDone,
    });
  }

  // ---------- lifecycle ----------
  startGame() {
    this.shakeAmt = 0; this.timeScale = 1; this._endState = null; this._exiting = false;
    this._guideOpen = false; this.bossCine = 0;
    this.storyQueue.length = 0; this.storyShowing = false;

    this.enemies.clear();
    this.spells.reset();
    this._clearPickups();
    this.director.reset();

    this.ui.closeModals();
    this.ui.hideJob();
    this.ui.fadeBlack(false);
    this.ui.setMuteIcon(this.audio.muted);

    if (!this._opened) {
      // opening cinematic (first launch): a distinct dark "possession" scene —
      // the wizard alone in the void as the spirit pours into him.
      this._opened = true;
      this._openingCine = true;
      this.cineT = 0;
      this.phase = 'intro'; this.state = 'story';
      this.stats = DEFAULT_STATS();
      this.arenaGroup.visible = false; this.tavern.show(false); this.tavern.showRoom(false); this.runmap.show(false);
      this.wizard.reset(this.stats); this.wizard.setVisible(true); this.wizard.pos.set(0, 0, 0);
      this.scene.background.setHex(0x05040a);
      this.scene.fog.color.setHex(0x06050c); this.scene.fog.density = 0.035;
      this.hemi.intensity = 0.25; this.dir.intensity = 0.6; this.ambient.intensity = 0.2;
      this.ui.setScreen('cinematic');
      this.showStory(OPENING.speaker, OPENING.lines, () => {
        this.ui.fadeBlack(true);
        setTimeout(() => { this._openingCine = false; this.enterTavern(); }, 520);
      });
    } else {
      this.enterTavern();
    }
  }

  // ---- the Tavern hub: roam (drunkenly), shop at stations, leave via the door ----
  enterTavern() {
    this.phase = 'tavern';
    this._exiting = false;
    this.nearStation = null;
    this.storyQueue.length = 0; this.storyShowing = false;
    this.ui.closeModals();
    this.ui.fadeBlack(false);
    this.ui.setScreen('play');
    this.stats = DEFAULT_STATS();
    this.stats.wobble = 0.9;        // tipsy but steerable enough to shop
    this.drunkenness = 0.45;        // you spawn here good and sloshed — hence the queasy nausea swim
    this._drunkSurge = 0;
    this.tavern.reset();
    this.tavern.refreshRoom(meta);
    this.tavern.show(true);
    this.tavern.showRoom(false);
    this.arenaGroup.visible = false;
    this.runmap.show(false);
    this.input.pointMode = false;
    this.wizard.reset(this.stats);
    this.wizard.setVisible(true);
    this.wizard.pos.copy(this.tavern.start);
    this.aimPoint.set(this.tavern.door.x, 0, this.tavern.door.z);
    this.camOffset.set(0, 18, 16);
    this._setMood('tavern');
    this.ui.setPhase('tavern', this.input.isTouch);
    this.ui.setGold(meta.gold());
    this.state = 'play';
    if (!this._introShown) {
      this._introShown = true; this.tavernReady = false; this.cineT = 0;
      this.showStory(TAVERN_INTRO.speaker, TAVERN_INTRO.lines, () => { this.tavernReady = true; });
    } else {
      this.tavernReady = true;
    }
    if (this._justInherited) {
      this._justInherited = false;
      this.showStory('The Spirit', [
        'You did it — the brute that ambushed old Barkeep Tomas lies in pieces.',
        'Tomas had no kin… and a wizard who avenges him is kin enough. The Tipsy Toad is YOURS now.',
        'Run the place! It earns coin even while we\'re out causing mayhem — manage it at the Ledger.',
      ]);
    } else if (meta.tavernOwned() && meta.tavernBank() > 0) {
      this.ui.toast(`🍺 The Toad earned ${meta.tavernBank()}🪙 — collect at the Ledger`);
    }
  }

  interact() {
    if (this.state !== 'play' || !this.nearStation) return;
    const s = this.nearStation, t = s.type;
    this.audio.play('click');
    if (this.phase === 'tavern') {
      if (t === 'door') { this._openShop('stage'); return; }
      if (t === 'stairs') { this.goUpstairs(); return; }
      if (t === 'serve') { this.startMinigame(); return; }
    } else if (this.phase === 'room') {
      if (t === 'down') { this.goDownstairs(); return; }
      if (t === 'rest') { this.restAtBed(); return; }
      if (t === 'station') { this._openShop(s.kind); return; }
    }
  }

  _openShop(kind) { this._shopKind = kind; this.state = 'menu'; this.ui.openShop(kind, this); }
  openBuild() { if (this.state === 'play' && this.phase === 'room') { this.audio.play('click'); this._openShop('build'); } }
  restAtBed() { if (meta.rest()) this.ui.toast('🛏 Rested — you\'ll wake with +HP for the next run'); else this.ui.toast('🛏 Already well-rested'); }

  // ---- stairs: a quick loading transition between the bar and your room ----
  goUpstairs() {
    if (this.state !== 'play') return;
    this.state = 'loading';
    this.ui.showLoadScene('Up the creaky stairs…');
    setTimeout(() => { this.enterRoom(); this.ui.hideLoadScene(); }, 900);
  }
  goDownstairs() {
    if (this.state !== 'play') return;
    this.state = 'loading';
    this.ui.showLoadScene('Back down to the bar…');
    setTimeout(() => { this.enterTavern(); this.ui.hideLoadScene(); }, 900);
  }

  // ---- your room: a separate scene; build & place facilities here ----
  enterRoom() {
    this.phase = 'room'; this.state = 'play';
    this.nearStation = null; this.input.pointMode = false;
    this.tavern.refreshRoom(meta);
    this.tavern.show(false); this.tavern.showRoom(true);
    this.arenaGroup.visible = false; this.runmap.show(false);
    this.wizard.setVisible(true);
    this.stats = DEFAULT_STATS(); this.stats.wobble = 0.9;
    this.wizard.reset(this.stats);
    this.wizard.pos.copy(this.tavern.roomStart);
    this.aimPoint.set(this.tavern.roomStart.x, 0, this.tavern.roomStart.z - 3);
    this.camOffset.set(0, 13, 13);
    this._setMood('tavern');
    this.ui.setPhase('room', this.input.isTouch);
    this.ui.setScreen('play');
    this.ui.setGold(meta.gold());
  }

  startMinigame() {
    this.state = 'menu';
    this.ui.showBar((tips) => {
      meta.addGold(tips); meta.save();
      this.ui.setGold(meta.gold());
      this.ui.toast(`🍺 Shift over — ${tips}🪙 in tips!`);
      this.state = 'play';
    });
  }
  startRun(stageId) {
    this.ui.closeShop();
    this._shopKind = null;
    this.beginRun(stageId);
  }
  closeShop() {
    if (this.state !== 'menu' || !this._shopKind) return; // bar shift & node events have their own buttons
    this._shopKind = null;
    this.ui.closeShop();
    this.tavern.refreshRoom(meta);   // reflect any newly built/sold furniture
    this.ui.setGold(meta.gold());
    this.state = 'play';
  }

  // Leave the tavern -> black out -> wake on the journey MAP for this haunt.
  beginRun(stageId) {
    if (this._exiting) return;
    this._exiting = true;
    this._pendingStage = STAGES[stageId] || STAGES.forest;
    this.audio.play('jobDone');
    this.state = 'blackout';
    this.ui.fadeBlack(true);
    setTimeout(() => {
      this.showStory(BLACKOUT_LINES.speaker, BLACKOUT_LINES.lines, () => this._startRunMap(this._pendingStage));
    }, 1250);
  }

  // initialise run-wide state (persists across every node of the journey)
  _startRunMap(stage) {
    this.stage = stage;
    this.stats = DEFAULT_STATS();
    if (meta.consumeRest()) this.stats.hpMax += meta.REST_BONUS + meta.roomComfort() * 4; // a good night's rest, comfier room = more
    this._applyEquipment();
    this.loadout = meta.getLoadout();
    this.unlocked = new Set(this.loadout);
    this.activeCombos = meta.activeCombos(this.unlocked);
    this.recognizer = new Recognizer();
    for (const id of this.loadout) { const g = SPELLS[id].gesture; this.recognizer.add(g, TEMPLATES[g]); }
    this.level = 1; this.xp = 0; this.xpNeed = this._xpForLevel(1);
    this.kills = 0; this.chores = 0; this.pendingLevels = 0;
    this.drunkenness = 0.2; this._drunkSurge = 0; this._drinkCd = 0;
    this.runGoldStart = meta.gold();   // to tally what the run earned
    this.nodesCleared = 0; this.bossKilled = false;
    this.wizard.reset(this.stats);     // full HP/mana — the only full reset of the run
    this.enemies.clear(); this.spells.reset(); this._clearPickups();
    this.ui.setLoadout(this.loadout);
    this.runmap.generate(stage);
    this.runmap.setCurrent(-1);
    this._enterMap(true);
  }

  // show the journey map and hand control to the path-picker
  _enterMap(intro) {
    this.phase = 'map'; this.state = 'map';
    this._exiting = false; this.bossActive = false; this.bossCine = 0; this._endState = null;
    this.enemies.clear(); this.spells.reset(); this._clearPickups();
    this.tavern.show(false); this.tavern.showRoom(false); this.arenaGroup.visible = false; this.runmap.show(true);
    this.wizard.setVisible(false);               // the spirit-orb marker stands in for him on the road
    this._applyStageTheme(this.stage);          // fog/colours match the haunt
    this.input.pointMode = true;                 // taps select nodes
    this.ui.setPhase('map', this.input.isTouch);
    this.ui.setScreen('map');
    this.ui.setGold(meta.gold());
    this.ui.closeModals();
    this.ui.fadeBlack(false);
    this.ui.mapInfo(null);
    if (intro) {
      this.state = 'story';
      this.showStory('The Spirit', [
        `${this.stage.name}. The road forks ahead, winding up into the murk.`,
        'Pick our path one step at a time — fights, loot, a campfire to mend… and that crown up top? That\'s our quarry.',
      ], () => { this.state = 'map'; });
    }
  }

  // travel the spirit to a chosen node, then resolve what's there
  travelTo(idx) {
    if (this.state !== 'map' || !this.runmap.isReachable(idx)) return;
    const node = this.runmap.node(idx);
    this.state = 'traveling';
    this.input.pointMode = false;
    this.audio.play('click');
    this.runmap.travelTo(idx, () => this._resolveNode(node));
  }

  _resolveNode(node) {
    this._currentNode = node;
    if (node.type === 'fight' || node.type === 'elite' || node.type === 'boss') {
      this._enterArenaNode(node);
    } else {
      // non-combat node: a quick event, then back to the map
      this.state = 'menu';
      this.ui.showNodeEvent(node, this, () => { this._afterNode(node); });
    }
  }

  _enterArenaNode(node) {
    this.phase = 'arena';
    this._currentNode = node;
    this.input.pointMode = false;
    this.bossActive = false; this.bossKilled = false; this.bossCine = 0;
    this._endState = null; this._exiting = false; this._lastCast = null;
    this.elapsed = 0;
    this.drunkenness = Math.min(this.drunkenness, 0.3);
    this.wizard.mana = this.stats.manaMax;     // stocked up before the fight (HP persists!)
    this.wizard.pos.set(0, 0, 0); this.wizard.vel.set(0, 0, 0); this.wizard.alive = true;
    this.enemies.clear(); this.spells.reset(); this._clearPickups(); this.director.reset();
    this.runmap.show(false); this.tavern.show(false); this.tavern.showRoom(false); this.arenaGroup.visible = true;
    this.wizard.setVisible(true);
    this.camOffset.set(0, 27, 22);
    this._applyStageTheme(this.stage);
    this.ui.setPhase('arena', this.input.isTouch);
    this.ui.setLoadout(this.loadout);
    this.ui.hideJob(); this.ui.fadeBlack(false);
    this.state = 'play';
    const enc = node.type === 'boss' ? { waves: 1, boss: true, hpScale: 1, sizeMult: 1 }
      : node.type === 'elite' ? { waves: 3, boss: false, hpScale: 1.4, sizeMult: 1.25 }
      : { waves: 3, boss: false, hpScale: 1, sizeMult: 1 };
    this.director.start(this.stage, enc);
    if (!this._guideShown) {
      this._guideShown = true;
      this.showStory('The Spirit', this.stage.intro, () => { this._guideOpen = true; this.ui.showGuide(); this.state = 'paused'; });
    } else if (node.type === 'boss') {
      this.ui.toast('👑 The boss awaits…');
    }
  }

  // called by the Director when a non-boss encounter is fully cleared
  onEncounterCleared() {
    if (this.state === 'gameover') return;
    this._endState = 'cleared';
  }

  _afterNode(node) {
    this.runmap.setCurrent(node.i);   // mark done + unlock the next row
    this.nodesCleared++;
    // gold reward by node type (combat already added kill gold)
    const reward = { fight: 18, elite: 45, treasure: 60, rest: 0, shop: 0, boss: 220 }[node.type] || 0;
    if (reward > 0) { meta.addGold(reward); }
    if (node.type === 'elite' || node.type === 'boss') { meta.dropGear && meta.addGear(meta.dropGear(this.level + (node.type === 'boss' ? 3 : 1), node.type === 'boss')); }
    meta.save();
    this.ui.setGold(meta.gold());
    if (node.type === 'boss') { this._winRun(); return; }
    this._enterMap(false);
  }

  _applyEquipment() {
    const m = meta.equipMods();
    const s = this.stats;
    if (m.hpMax) s.hpMax += m.hpMax;
    if (m.manaRegen) s.drinkPower += m.manaRegen * 2.2; // gear "mana" rolls now boost how much each gulp restores
    if (m.moveSpeed) s.moveSpeed += m.moveSpeed;
    if (m.pickupRadius) s.pickupRadius += m.pickupRadius;
    if (m.thorns) s.thorns += m.thorns;
    if (m.damageMult) s.damageMult += m.damageMult;
    if (m.cooldownMult) s.cooldownMult *= (1 + m.cooldownMult);
  }

  _applyEquipment() {
    const m = meta.equipMods();
    const s = this.stats;
    if (m.hpMax) s.hpMax += m.hpMax;
    if (m.manaRegen) s.drinkPower += m.manaRegen * 2.2; // gear "mana" rolls now boost how much each gulp restores
    if (m.moveSpeed) s.moveSpeed += m.moveSpeed;
    if (m.pickupRadius) s.pickupRadius += m.pickupRadius;
    if (m.thorns) s.thorns += m.thorns;
    if (m.damageMult) s.damageMult += m.damageMult;
    if (m.cooldownMult) s.cooldownMult *= (1 + m.cooldownMult);
  }

  _registerCast(id) {
    const now = performance.now() / 1000;
    if (this._lastCast && now - this._lastCast.t < 1.4) {
      const prev = this._lastCast.id;
      for (const cid of this.activeCombos) {
        const m = COMBO_META[cid];
        if ((m.a === prev && m.b === id) || (m.a === id && m.b === prev)) {
          this.spells.castCombo(this, cid);
          this._lastCast = null;
          return;
        }
      }
    }
    this._lastCast = { id, t: now };
  }

  toggleGuide() {
    if (this._guideOpen) { this._guideOpen = false; this.ui.hideGuide(); if (this.state === 'paused') this.state = 'play'; }
    else if (this.state === 'play' && this.phase === 'arena') { this._guideOpen = true; this.ui.showGuide(); this.state = 'paused'; }
  }

  _setMood(mood) {
    if (mood === 'tavern') {
      this.scene.background.setHex(0x241a18);
      this.scene.fog.color.setHex(0x241a18); this.scene.fog.density = 0.02;
      this.hemi.color.setHex(0xffd9a0); this.hemi.groundColor.setHex(0x3a2418); this.hemi.intensity = 0.7;
      this.dir.color.setHex(0xffd29a); this.dir.intensity = 1.0;
      this.ambient.color.setHex(0x6a4a3a); this.ambient.intensity = 0.5;
    } else {
      this.scene.background.setHex(0x16223a);
      this.scene.fog.color.setHex(0x1b2b44); this.scene.fog.density = 0.011;
      this.hemi.color.setHex(0x9fb6e8); this.hemi.groundColor.setHex(0x223a2a); this.hemi.intensity = 0.95;
      this.dir.color.setHex(0xcdd8ff); this.dir.intensity = 1.5;
      this.ambient.color.setHex(0x3a4a6a); this.ambient.intensity = 0.45;
    }
  }

  castById(id) { if (this.state === 'play' && this.phase === 'arena' && this.unlocked.has(id)) this._castAt(id, this.aimPoint, { accuracy: 0.8 }); }
  togglePause() {
    if (this.state === 'play') { this.state = 'paused'; this.ui.toast('⏸ Paused'); }
    else if (this.state === 'paused') { this.state = 'play'; this.ui.toast('▶ Resumed'); }
  }
  toggleMute() { this.audio.resume(); this.audio.setMuted(!this.audio.muted); this.ui.setMuteIcon(this.audio.muted); }

  // ---- DRINK: the only way to refill mana. Costs sobriety — you get woozier. ----
  drink() {
    if (this.state !== 'play' || this.phase !== 'arena' || !this.wizard.alive) return;
    if (this._drinkCd > 0) return;
    const w = this.wizard, s = this.stats;
    if (w.mana >= s.manaMax - 0.5) { this.ui.toast('🍺 Mug\'s already brimming'); return; }
    this._drinkCd = 0.45;
    w.mana = Math.min(s.manaMax, w.mana + s.drinkPower);
    // the gulp makes the spirit's puppet woozier — the core risk/reward
    this.drunkenness = Math.min(1, this.drunkenness + 0.26 * (s.drinkChaos || 1));
    this._drunkSurge = 1;
    w.bob -= 0.6; w.leanV.x += (Math.random() - 0.5) * 5; w.leanV.z += (Math.random() - 0.5) * 5;
    this.audio.play('heal');
    const hp = w.handPosition(); hp.y = 2.1;
    this.particles.burst({ pos: hp, color: 0xf6e3a0, count: 9, speed: 2.4, size: 0.18, life: 0.7, grav: 2, blend: 'normal' });
    this.ui.toast('🍺 *gulp* — mana up, room spinning');
  }

  _maybeDrink() { // touch/desktop drink button + Q key route here
    this.drink();
  }

  // ---------- input ----------
  _handleInput() {
    const events = this.input.drain();
    for (const e of events) {
      if (e.type === 'mute') { this.toggleMute(); continue; }
      if (e.type === 'guide') { this.toggleGuide(); continue; }
      if (e.type === 'drink') { this.drink(); continue; }
      if (e.type === 'select') { if (this.state === 'map') { const i = this.runmap.pick(e.x, e.y, this.camera); if (i >= 0) this.travelTo(i); } continue; }
      if (e.type === 'interact') { if (this.state === 'menu') this.closeShop(); else this.interact(); continue; }

      if (this.storyShowing) {
        if (e.type === 'confirm' || e.type === 'primary') this.ui._storyAdvance();
        continue;
      }

      if (this.state === 'title') {
        if (e.type === 'confirm') { this.audio.resume(); this.startGame(); }
        continue;
      }
      if (this.state === 'gameover' || this.state === 'win') {
        if (e.type === 'confirm') this.startGame();
        continue;
      }
      if (this.state === 'levelup') continue;

      if (this.state === 'play' || this.state === 'paused') {
        if (e.type === 'pause') { this.state = this.state === 'paused' ? 'play' : 'paused'; this.ui.toast(this.state === 'paused' ? '⏸ Paused' : '▶ Resumed'); continue; }
      }
      if (this.state !== 'play') continue;
      if (this.phase !== 'arena') continue; // no spellcasting during the tavern walk

      if (e.type === 'drawstart') { this.gestureAim.copy(this.aimPoint); }
      else if (e.type === 'gesture') { this._resolveGesture(e.points); }
      else if (e.type === 'quickcast') {
        const id = this.loadout ? this.loadout[e.index] : null;
        if (id) this._castAt(id, this.aimPoint, { accuracy: 0.8 });
      }
    }
  }

  _resolveGesture(points) {
    if (!points || points.length < 7) return;
    const res = this.recognizer.recognize(points);
    if (res && res.score > 0.6) {
      const id = GESTURE_TO_SPELL[res.name];
      if (id && this.unlocked.has(id)) {
        // map recognition score -> damage: sloppy 0.5x … clean 1x … perfect crit
        const accuracy = Math.max(0.5, Math.min(1, (res.score - 0.6) / (0.92 - 0.6) * 0.5 + 0.5));
        const crit = res.score >= 0.9;
        this._castAt(id, this.gestureAim, { accuracy, crit });
        if (!crit) this.ui.accuracyToast(accuracy);
        return;
      }
      if (id) { this.ui.toast(`✋ ${SPELLS[id].name} — not equipped`); this.audio.play('hiccup'); return; }
    }
    // a fizzle — show a little puff so it still feels responsive
    this.audio.play('hiccup');
    this.ui.toast('…the glyph fizzles');
    const hp = this.wizard.handPosition();
    this.particles.burst({ pos: hp, color: 0x6a5a82, count: 6, speed: 2, size: 0.2, life: 0.5, grav: 1, blend: 'normal' });
  }

  _castAt(id, aim, opts) {
    const saved = this.aimPoint;
    this.aimPoint = aim;
    const ok = this.spells.tryCast(this, id, opts);
    this.aimPoint = saved;
    if (ok) this._registerCast(id);
  }

  _updateAim() {
    this.reticle.visible = (this.state === 'play' && this.phase === 'arena');
    if (this.phase === 'tavern') {
      // the wizard faces the way he's staggering
      const mv = this.input.moveVector();
      if (Math.hypot(mv.x, mv.z) > 0.1) this.aimPoint.set(this.wizard.pos.x + mv.x * 5, 0, this.wizard.pos.z + mv.z * 5);
      return;
    }
    if (this.state !== 'play') return;
    if (this.input.drawing) {
      // aim is locked to where you started drawing
    } else if (this.input.isTouch) {
      // no mouse on touch — auto-aim the nearest foe
      const near = this.enemies.nearest(this.wizard.pos, 34);
      if (near) this.aimPoint.set(near.mesh.position.x, 0, near.mesh.position.z);
      else this.aimPoint.set(this.wizard.pos.x + Math.sin(this.wizard.yaw) * 6, 0, this.wizard.pos.z + Math.cos(this.wizard.yaw) * 6);
    } else {
      this._ray.setFromCamera(this.input.ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this._ray.ray.intersectPlane(this._groundPlane, hit)) {
        hit.x = Math.max(-ARENA, Math.min(ARENA, hit.x));
        hit.z = Math.max(-ARENA, Math.min(ARENA, hit.z));
        this.aimPoint.copy(hit);
      }
    }
    const a = this.input.drawing ? this.gestureAim : this.aimPoint;
    this.reticle.position.set(a.x, 0.05, a.z);
    this.reticle.material.opacity = this.input.drawing ? 1 : 0.55;
    this.reticle.material.color.setHex(this.input.drawing ? 0xffcf5c : 0x6f5fd0);
  }

  // ---------- gesture trail rendering ----------
  _drawTrail() {
    const ctx = this.fxctx;
    ctx.clearRect(0, 0, this.fx2d.width, this.fx2d.height);
    this._live = null;
    if (this.phase !== 'arena' || !this.input.drawing || this.input.points.length < 2) return;
    const pts = this.input.points;

    // live prediction — recolour the trail by how clean the glyph is
    let rgb = [180, 170, 200];
    if (pts.length >= 7) {
      const res = this.recognizer.recognize(pts);
      if (res && res.score > 0.5) {
        const id = GESTURE_TO_SPELL[res.name];
        if (id && this.unlocked.has(id)) {
          this._live = { id, score: res.score };
          rgb = res.score >= 0.9 ? [255, 216, 120] : res.score >= 0.75 ? [120, 240, 150] : res.score >= 0.6 ? [240, 220, 120] : [220, 150, 120];
        } else if (id) { this._live = { id, score: res.score, locked: true }; rgb = [210, 120, 120]; }
      }
    }
    const c = rgb.join(',');

    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${c},0.30)`; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${c},0.95)`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    // start dot (green) + pen-tip dot
    ctx.fillStyle = 'rgba(120,240,150,0.95)';
    ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 7, 0, Math.PI * 2); ctx.fill();
    const last = pts[pts.length - 1];
    ctx.fillStyle = `rgba(${c},1)`;
    ctx.beginPath(); ctx.arc(last.x, last.y, 6, 0, Math.PI * 2); ctx.fill();

    // predicted-spell label at the pen tip
    if (this._live) {
      const s = SPELLS[this._live.id];
      ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(${c},1)`;
      const label = this._live.locked ? `🔒 ${s.name}` : (this._live.score >= 0.9 ? `${s.glyph} ${s.name}  ✦CRIT` : `${s.glyph} ${s.name}`);
      ctx.fillText(label, last.x + 16, last.y - 18);
    }
  }

  // ---------- camera ----------
  _updateCamera(dt) {
    // opening cinematic: an intimate orbit as the spirit pours into the wizard
    if (this._openingCine) {
      this.cineT += dt;
      const a = this.cineT * 0.4;
      this.camera.position.lerp(new THREE.Vector3(Math.sin(a) * 8, 4.2 + Math.sin(a * 0.7) * 1.2, Math.cos(a) * 8), Math.min(1, dt * 2.5));
      this.camera.lookAt(0, 1.6, 0);
      // wisps of spirit spiralling into him
      if (this.particles && Math.random() < 0.7) {
        const ang = this.cineT * 5 + Math.random() * 6.28, r = 2.4 + Math.random() * 1.6;
        this.particles.burst({ pos: new THREE.Vector3(Math.cos(ang) * r, 0.4 + Math.random() * 3, Math.sin(ang) * r), color: 0x9b7bff, count: 1, speed: 0.4, size: 0.16, life: 1.0, grav: -1.2, blend: 'add' });
      }
      return;
    }
    // tavern intro: a slow cinematic orbit of the room before you take control
    if (this.phase === 'tavern' && !this.tavernReady) {
      this.cineT += dt;
      const a = this.cineT * 0.35;
      this.camera.position.lerp(new THREE.Vector3(Math.sin(a) * 13, 11, -3 + Math.cos(a) * 13), Math.min(1, dt * 2));
      this.camera.lookAt(this.wizard.pos.x, 1.4, this.wizard.pos.z);
      return;
    }
    // journey map: float behind the spirit, gazing up the winding road toward the boss
    if (this.phase === 'map') {
      const mk = this.runmap.marker ? this.runmap.marker.position : new THREE.Vector3();
      const desired = new THREE.Vector3(mk.x * 0.35, 12.5, mk.z + 15.5);
      this.camera.position.lerp(desired, Math.min(1, dt * 3));
      const look = new THREE.Vector3(mk.x * 0.2, 1.5, mk.z - 9);
      this.camera.lookAt(look.x, look.y, look.z);
      return;
    }
    // boss reveal: pull out and frame the boss as it emerges
    if (this.bossCine > 0 && this._bossEnemy && this._bossEnemy.alive) {
      const bp = this._bossEnemy.mesh.position;
      const mid = new THREE.Vector3((bp.x + this.wizard.pos.x) / 2, 0, (bp.z + this.wizard.pos.z) / 2);
      this.camera.position.lerp(new THREE.Vector3(mid.x, 22, mid.z + 20), Math.min(1, dt * 3));
      this.camera.lookAt(bp.x, 2, bp.z);
      return;
    }
    this.camTarget.lerp(this.wizard.pos, Math.min(1, dt * 6));
    // on the title screen, bias the framing left so the fight sits on the RIGHT (menu is on the left)
    const bx = this.state === 'title' ? -9 : 0;
    const focus = this.camTarget.clone(); focus.x += bx;
    if (this.phase === 'tavern') focus.y += (this.wizard.floorY || 0); // rise with him onto the upper deck
    const desired = focus.clone().add(this.camOffset);
    this.camera.position.lerp(desired, Math.min(1, dt * 6));
    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 4);
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.z += (Math.random() - 0.5) * this.shakeAmt;
    }
    this.camera.lookAt(focus.x, focus.y + 1.5, focus.z);
    // drunk nausea: a queasy camera roll + slow swim, strongest right after a gulp
    const dz = Math.min(1.2, (this.drunkenness || 0) + (this._drunkSurge || 0) * 0.7);
    if (dz > 0.01) {
      const t = performance.now() / 1000;
      this.camera.rotation.z += (Math.sin(t * 1.25) * 0.030 + Math.sin(t * 0.66) * 0.016) * dz;
      this.camera.position.x += Math.sin(t * 0.9) * 0.28 * dz;
      this.camera.position.y += Math.sin(t * 1.7 + 1) * 0.20 * dz;
    }
  }

  // ---------- main loop ----------
  _loop() {
    requestAnimationFrame(this._loop);
    let dt = this.clock.getDelta();
    if (dt > 0.05) dt = 0.05; // clamp big hitches

    this._handleInput();
    this._updateAim();
    this._drawTrail();
    if (this.bossCine > 0) this.bossCine -= dt;

    // slow-mo while drawing a glyph, or during the boss reveal (forest fight only)
    let targetScale = 1;
    if (this.state === 'play' && this.phase === 'arena') {
      if (this.bossCine > 0) targetScale = 0.35;
      else if (this.input.drawing) targetScale = 0.32;
    }
    this.timeScale += (targetScale - this.timeScale) * Math.min(1, dt * 12);
    const sdt = dt * this.timeScale;

    if (this.state === 'play') {
      if (this.phase === 'tavern') this._updateTavern(sdt);
      else if (this.phase === 'room') this._updateRoom(sdt);
      else this._updateArena(sdt);
    } else if (this.state === 'map' || this.state === 'traveling' || (this.state === 'story' && this.phase === 'map')) {
      this._updateMap(dt);
    } else if (this.state === 'title' && !this._openingCine) {
      this._updateDemo(dt);
    } else if (this._openingCine) {
      // possession scene: the wizard sways in the void, the spirit swirling in
      this.wizard.update(dt, this);
      this.particles.update(dt);
    } else {
      // keep particles/wizard idle-breathing alive in menus for life
      this.particles.update(dt);
      if (this.state !== 'title') this.wizard.update(0.0001, this);
    }

    this.ui.updateHUD(this);
    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _updateArena(sdt) {
    this.elapsed += sdt;
    // you slowly sober up between gulps; the post-gulp lurch fades fast
    this.drunkenness = Math.max(0, this.drunkenness - sdt * 0.05);
    if (this._drunkSurge > 0) this._drunkSurge = Math.max(0, this._drunkSurge - sdt * 1.6);
    if (this._drinkCd > 0) this._drinkCd = Math.max(0, this._drinkCd - sdt);
    this.director.update(sdt, this);
    this.wizard.update(sdt, this);
    this.enemies.update(sdt, this);
    this.spells.update(sdt, this);
    this.jobs.update(sdt, this);
    this.particles.update(sdt);
    this._updatePickups(sdt);

    // thorns: enemies overlapping the wizard take a little damage
    if (this.stats.thorns > 0) {
      for (const e of this.enemies.list) {
        if (!e.alive) continue;
        const dx = e.mesh.position.x - this.wizard.pos.x, dz = e.mesh.position.z - this.wizard.pos.z;
        if (dx * dx + dz * dz < (e.r + 0.8) * (e.r + 0.8)) this.enemies.damage(e, this.stats.thorns * sdt, this);
      }
    }
    if (this.stats.hpRegen > 0 && this.wizard.alive) this.wizard.heal(this.stats.hpRegen * sdt);

    if (!this.wizard.alive) this._loseRun();
    if (this.pendingLevels > 0 && this.state === 'play') this._openLevelUp();
    // encounter cleared -> back to the map (or win the run if that was the boss)
    if (this._endState === 'cleared' && !this.storyShowing && this.state === 'play') { this._endState = null; this._afterNode(this._currentNode); }
  }

  _updateTavern(sdt) {
    this.wizard.update(sdt, this);
    this.tavern.update(sdt, this);
    this.particles.update(sdt);
    if (meta.tavernOwned()) meta.accrueIdle(sdt); // tycoon ticks while you potter about
  }

  _updateRoom(sdt) {
    this.wizard.update(sdt, this);
    this.tavern.updateRoom(sdt, this);
    this.particles.update(sdt);
    if (meta.tavernOwned()) meta.accrueIdle(sdt);
  }

  // ---- the journey map ----
  _updateMap(dt) {
    this.runmap.update(dt, this);
    this.particles.update(dt);
    this.ui.mapStatus(this);
    if (this.state === 'map') {
      const idx = this.runmap.hover(this.input.ndc, this.camera);
      this.ui.mapInfo(idx >= 0 ? this.runmap.node(idx) : null);
    }
  }

  // ---- animated title screen: a drunk wizard auto-blasting waves of foes ----
  enterDemo() {
    this.phase = 'arena';
    this.tavernReady = true; this._openingCine = false; this.bossCine = 0;
    this.stats = DEFAULT_STATS();
    this.tavern.show(false);
    this.tavern.showRoom(false);
    this.runmap.show(false);
    this.arenaGroup.visible = true;
    this._applyStageTheme(STAGES.forest);
    this.camOffset.set(0, 26, 22);
    this.enemies.clear(); this.spells.reset(); this._clearPickups();
    this.wizard.reset(this.stats);
    this.wizard.setVisible(true);
    this.recognizer = new Recognizer();
    this.recognizer.add('triangle', TEMPLATES.triangle);
    this._demoSpawn = 0.5; this._demoCast = 1; this._demoMove = 0;
    this.activeCombos = [];
  }

  _updateDemo(dt) {
    // wander the wizard a little
    this._demoMove -= dt;
    if (this._demoMove <= 0) { this._demoMove = 1.5 + Math.random() * 2; this._demoDir = new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5)); }
    if (this._demoDir) { this.wizard.vel.addScaledVector(this._demoDir, 18 * dt); }
    // spawn foes
    this._demoSpawn -= dt;
    if (this._demoSpawn <= 0 && this.enemies.count() < 14) { this._demoSpawn = 1.0; this.enemies.spawn(Math.random() < 0.7 ? 'goblin' : 'bat', 1, this.wizard.pos, this); }
    // auto-aim + auto-cast
    const near = this.enemies.nearest(this.wizard.pos, 40);
    if (near) this.aimPoint.set(near.mesh.position.x, 0, near.mesh.position.z);
    this._demoCast -= dt;
    if (this._demoCast <= 0 && near) { this._demoCast = 0.55 + Math.random() * 0.35; this.wizard.mana = this.stats.manaMax; this._castAt('fireball', this.aimPoint, { accuracy: 0.85 }); }
    // sim
    this.wizard.update(dt, this);
    this.enemies.update(dt, this);
    this.spells.update(dt, this);
    this._updatePickups(dt);
    this.particles.update(dt);
    // the demo wizard is immortal
    this.wizard.hp = this.stats.hpMax; this.wizard.alive = true; this.wizard.invuln = 1;
  }
}
