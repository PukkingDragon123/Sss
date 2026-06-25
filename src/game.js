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
import { Director, STAGES, TUTORIAL, BLACKOUT_LINES } from './story.js';
import { Jobs } from './jobs.js';
import { Tavern } from './tavern.js';
import { World } from './world.js';
import { Cinematics } from './cinematics.js';
import { rollUpgrades, rollArtifact, artifactById } from './upgrades.js';
import * as meta from './meta.js';
import { COMBO_META } from './meta.js';

const DEFAULT_STATS = () => ({
  hpMax: 130, moveSpeed: 7.2, wobble: 1.0,
  manaMax: 120, manaRegen: 0, // mana does NOT auto-regen — you must DRINK (Q) to refill it
  drinkPower: 50,             // mana restored per gulp (charm gear adds to this)
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
  // beer types: what a drink does besides refilling mana (set by beer abilities)
  drinkHeal: 0, drinkShield: 0,
});

// choice-based path events (Slay-the-Spire dilemmas). Each option is pure data:
// hp/heal/maxhp/gems(±)/mana/drunk deltas + an optional gain (ability|gear|gems).
// minGems disables an option you can't afford. (In a venture you spend 💎, not gold.)
const EVENTS = [
  { icon: '🏺', title: 'The Hungry Altar', prompt: 'A cracked altar hums, hungry for tribute. The air tastes of old magic.', opts: [
    { label: 'Offer blood', tip: '−18 HP · gain an ability', hp: -18, gain: 'ability' },
    { label: 'Pay tribute (💎6)', tip: '−💎6 · gain an ability', minGems: 6, gems: -6, gain: 'ability' },
    { label: 'Back away', tip: 'leave it be' },
  ] },
  { icon: '👻', title: 'The Tipsy Ghost', prompt: 'A see-through sot rattles a hidden gem-stash and a dusty bottle at you.', opts: [
    { label: 'Chug his brew', tip: '+💎4 · full mana · a buzz', mana: 'full', drunk: 0.25, gain: 'gems', gemAmt: 4 },
    { label: 'Pocket the gems', tip: '+💎9', gain: 'gems', gemAmt: 9 },
  ] },
  { icon: '🗡️', title: 'The Buried Blade', prompt: 'A faintly glowing weapon juts from a long-dead adventurer. It hums to be held.', opts: [
    { label: 'Wrench it free', tip: '−12 HP · take the gear', hp: -12, gain: 'gear' },
    { label: 'Say a prayer', tip: 'mend 35 HP', heal: 35 },
  ] },
  { icon: '🍄', title: 'The Glowing Cap', prompt: 'Luminous mushrooms pulse on a stump. Definitely magical. Probably edible.', opts: [
    { label: 'Gobble them', tip: 'gain an ability · +woozy', gain: 'ability', drunk: 0.3 },
    { label: 'Brew a tonic (💎4)', tip: '−💎4 · +20 max HP', minGems: 4, gems: -4, maxhp: 20 },
    { label: 'Leave them', tip: 'wise.' },
  ] },
  { icon: '⚖️', title: "A Devil's Bargain", prompt: 'A horned merchant grins. "Power now, pay later — only a sliver of your vigour."', opts: [
    { label: 'Take the deal', tip: '−25 max HP · gain an ability', maxhp: -25, gain: 'ability' },
    { label: 'Decline politely', tip: '+💎3 for your prudence', gain: 'gems', gemAmt: 3 },
  ] },
];

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
    this.world = new World(this.scene);
    this.wizard = new Wizard(this.scene);
    this.director = new Director();
    this.cine = new Cinematics(this);
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
    } else if (kind === 'swamp') {
      const deadMat = new THREE.MeshStandardMaterial({ color: 0x3a3322, roughness: 0.95 });
      const mossMat = new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.95 });
      const reedMat = new THREE.MeshStandardMaterial({ color: 0x6a8a4a, roughness: 0.9 });
      const padMat = new THREE.MeshStandardMaterial({ color: 0x2f5a32, roughness: 0.9 });
      const mkDead = () => { const t = new THREE.Group(); const h = 4 + Math.random() * 2.5; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.65, h, 7), deadMat); tr.position.y = h / 2; tr.rotation.z = (Math.random() - 0.5) * 0.2; tr.castShadow = true; const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), mossMat); canopy.position.y = h; canopy.scale.y = 0.6; canopy.castShadow = true; const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 2.2, 5), deadMat); b1.position.set(0.9, h - 1.4, 0); b1.rotation.z = -0.8; t.add(tr, canopy, b1); return t; };
      treeLine(mkDead, 52);
      inside(20, mkDead, 6, ARENA - 8);
      inside(34, () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.0 + Math.random() * 0.8, 5), reedMat); r.position.set((Math.random() - 0.5) * 0.7, 0.5, (Math.random() - 0.5) * 0.7); r.rotation.z = (Math.random() - 0.5) * 0.3; g.add(r); } return g; });
      inside(22, () => { const p = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.4, 12), padMat); p.rotation.x = -Math.PI / 2; p.position.y = 0.03; return p; });
      inside(14, () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.5, 0), mossMat); m.position.y = 0.3; m.scale.y = 0.6; m.castShadow = true; return m; });
    } else if (kind === 'ice') {
      const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfe0ff, roughness: 0.2, metalness: 0.1, emissive: 0x2a5a7a, emissiveIntensity: 0.15 });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xeef6ff, roughness: 0.95 });
      const darkIce = new THREE.MeshStandardMaterial({ color: 0x8fb6d8, roughness: 0.3 });
      const mkSpire = () => { const g = new THREE.Group(); const h = 5 + Math.random() * 4; const s = new THREE.Mesh(new THREE.ConeGeometry(1.2, h, 6), iceMat); s.position.y = h / 2; s.castShadow = true; const s2 = new THREE.Mesh(new THREE.ConeGeometry(0.6, h * 0.6, 6), darkIce); s2.position.set(0.7, h * 0.3, 0.3); g.add(s, s2); return g; };
      treeLine(mkSpire, 56);
      inside(22, mkSpire, 6, ARENA - 8);
      inside(30, () => { const g = new THREE.Group(); const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8 + Math.random(), 5), iceMat); c.position.set((Math.random() - 0.5) * 0.5, 0.4, (Math.random() - 0.5) * 0.5); c.rotation.z = (Math.random() - 0.5) * 0.4; c.castShadow = true; g.add(c); } return g; });
      inside(24, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 10, 8), snowMat); m.position.y = 0.2; m.scale.y = 0.5; m.receiveShadow = true; return m; });
    } else if (kind === 'hell') {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a1810, roughness: 1 });
      const lavaMat = new THREE.MeshStandardMaterial({ color: 0xff6a2a, emissive: 0xff4a10, emissiveIntensity: 0.9, roughness: 0.5 });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0x4a3328, roughness: 0.9 });
      const mkSpike = () => { const g = new THREE.Group(); const h = 4.5 + Math.random() * 4; const s = new THREE.Mesh(new THREE.ConeGeometry(1.3, h, 6), rockMat); s.position.y = h / 2; s.rotation.z = (Math.random() - 0.5) * 0.18; s.castShadow = true; const crack = new THREE.Mesh(new THREE.ConeGeometry(0.35, h * 0.7, 5), lavaMat); crack.position.y = h * 0.35; g.add(s, crack); return g; };
      treeLine(mkSpike, 54);
      inside(20, mkSpike, 6, ARENA - 8);
      inside(28, () => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.7, 0), rockMat); r.position.y = 0.4; r.castShadow = true; return r; });
      inside(18, () => { const g = new THREE.Group(); const pool = new THREE.Mesh(new THREE.CircleGeometry(0.7 + Math.random() * 0.5, 14), lavaMat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04; g.add(pool); return g; });
      inside(14, () => { const c = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 12, Math.PI), boneMat); c.position.y = 0.12; c.castShadow = true; return c; });
    } else if (kind === 'tech') {
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x46525e, roughness: 0.4, metalness: 0.6 });
      const neonMat = new THREE.MeshStandardMaterial({ color: 0x5fe0ff, emissive: 0x2fb0d0, emissiveIntensity: 0.9, roughness: 0.3 });
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x1f2c38, roughness: 0.5, metalness: 0.4 });
      const mkPylon = () => { const g = new THREE.Group(); const h = 5 + Math.random() * 4; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, h, 8), metalMat); p.position.y = h / 2; p.castShadow = true; for (let i = 1; i <= 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 14), neonMat); ring.rotation.x = Math.PI / 2; ring.position.y = (h / 4) * i; g.add(ring); } g.add(p); return g; };
      treeLine(mkPylon, 50);
      inside(18, mkPylon, 6, ARENA - 8);
      inside(28, () => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random() * 0.6, 0.8 + Math.random(), 0.8 + Math.random() * 0.6), panelMat); b.position.y = 0.5; b.castShadow = true; return b; });
      inside(22, () => { const n = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.25, 0), neonMat); n.position.y = 0.4; return n; });
    } else if (kind === 'void') {
      const monoMat = new THREE.MeshStandardMaterial({ color: 0x1a1430, roughness: 0.4, metalness: 0.3 });
      const crystalMat = new THREE.MeshStandardMaterial({ color: 0xb68fff, emissive: 0x6a3ad0, emissiveIntensity: 0.8, roughness: 0.25 });
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mkMono = () => { const g = new THREE.Group(); const h = 5 + Math.random() * 5; const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, h, 0.7), monoMat); m.position.y = h / 2; m.rotation.y = Math.random(); m.castShadow = true; const edge = new THREE.Mesh(new THREE.BoxGeometry(1.04, h, 0.08), crystalMat); edge.position.y = h / 2; edge.rotation.y = m.rotation.y; g.add(m, edge); return g; };
      treeLine(mkMono, 48);
      inside(18, mkMono, 6, ARENA - 8);
      inside(30, () => { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + Math.random() * 0.7, 0), crystalMat); c.position.y = 0.5 + Math.random() * 0.5; c.castShadow = true; return c; });
      inside(40, () => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 6, 6), starMat); s.position.y = 0.3 + Math.random() * 3; return s; });
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
  _xpForLevel(lvl) { return Math.floor(7 + (lvl - 1) * 6 + Math.pow(Math.max(0, lvl - 1), 1.72) * 2.3); }

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
      this.applyAbility(u);
      this.pendingLevels--;
      if (this.pendingLevels > 0) this._openLevelUp();
      else this.state = 'play';
    });
  }

  // a one-off ability pick (shrines / golden kegs)
  offerUpgrade(onPicked) {
    this.state = 'levelup';
    this.audio.play('levelup');
    const choices = rollUpgrades(this, 3);
    this.ui.showLevelUp(choices, (u) => { this.applyAbility(u); if (onPicked) onPicked(); });
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
    if (this._drinking) this._cancelDrink();
    this.bossActive = false; this.bossKilled = true; this._roomsCleared = this._forksTotal + 2;
    if (this._pendingReward) { this._grantReward(this._pendingReward); this._pendingReward = null; }
    this.grantArtifact(this._opArtifact); // the guaranteed, build-defining end-of-level relic
    this.audio.play('win');
    this._endState = 'win';
    this.state = 'reveal'; // freeze the field behind the reveal screen
    this.ui.showArtifactReveal(this._opArtifact, () => { this.state = 'win'; this._showEnd(true); });
  }

  _winRun() {
    if (this.state === 'win' || this.state === 'gameover') return;
    this.state = 'win';
    this._showEnd(true);
  }
  _loseRun() {
    if (this.state === 'win' || this.state === 'gameover') return;
    if (this._introRun) { this._finishIntroRun(); return; } // you can't fail the tutorial — just stagger home
    this.state = 'gameover';
    this.audio.play('gameover');
    this._showEnd(false);
  }
  // backwards-compat alias used by the wizard-death check
  _lose() { this._loseRun(); }

  _showEnd(win) {
    if (win && this.stage) meta.markStageCleared(this.stage.id); // opens the next haunt on the world map
    if (win && !meta.tavernOwned()) { meta.setTavernOwned(true); this._justInherited = true; } // avenge -> inherit
    const depth = this._roomsCleared || 0; // rooms cleared (boss = forks+2)
    // ventures pay in 💎 GEMS (gold is earned only by WORKING), plus a guaranteed boss gear drop
    const gemReward = Math.max(1, Math.round((3 + depth * 1.5 + this.kills * 0.06 + (win ? 7 : 0)) * meta.gemBonusMult()));
    meta.addGems(gemReward);
    if (win) meta.addGear(meta.dropGear(this.level + 3, true));
    const earnedGems = Math.max(0, meta.gems() - (this._runGemStart || 0));
    const questDone = meta.evaluateQuest({ kills: this.kills, time: Math.floor(this.elapsed), wave: depth, bossKilled: this.bossKilled, win });
    const finishedResearch = meta.advanceDay(); // a venture spends a day (and ticks research)
    meta.save();
    this.ui.closeModals();
    this.ui.setScreen('end');
    this.ui.showResults(win, {
      nodes: depth, rooms: depth, kills: this.kills, level: this.level, stage: this.stage ? this.stage.name : '',
      artifact: win && this.runArtifacts.length ? this.runArtifacts[this.runArtifacts.length - 1].name : null,
      earnedGems, gems: meta.gems(), day: meta.currentDay(),
      research: finishedResearch ? meta.researchById(finishedResearch).name : null, questDone,
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
      // first launch: a chain of real cutscenes — possess, wreck the bar (QTE),
      // get hurled out, wake in the forest with the wisp — then the guided fight.
      this._opened = true; this._hubShown = false;
      this.cine.play('possession', () =>
        this.cine.play('rampage', () =>
          this.cine.play('thrown', () =>
            this.cine.play('wisp', () => { this._introRun = true; this.enterArena(STAGES.forest); }))));
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
    this.tavern.resetTables();       // seat fresh patrons & clear any half-poured order
    this.tavern.refreshRoom(meta);
    this.tavern.show(true);
    this.tavern.showRoom(false);
    this.arenaGroup.visible = false;
    this.world.show(false);
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
    if (!this._hubShown) {
      // first time in the hub (after the opening cutscenes) — a quick how-to
      this._hubShown = true; this._introShown = true; this.tavernReady = false; this.cineT = 0;
      this.showStory(TUTORIAL.speaker, TUTORIAL.lines, () => { this.tavernReady = true; });
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
      if (t === 'door') { this.openWorldMap(); return; }
      if (t === 'stairs') { this.goUpstairs(); return; }
      if (t === 'serve') { this.tavern.barAction(this); return; }
      if (t === 'table') { this.tavern.tableAction(s.table, this); return; }
    } else if (this.phase === 'room') {
      if (t === 'down') { this.goDownstairs(); return; }
      if (t === 'rest') { this.restAtBed(); return; }
      if (t === 'station') { this._openShop(s.kind); return; }
    }
  }

  _openShop(kind) { this._shopKind = kind; this.state = 'menu'; this.ui.openShop(kind, this); }

  // ---- the 3D top-down WORLD MAP: scout a region, then venture straight in ----
  openWorldMap() {
    this.phase = 'world'; this.state = 'world';
    this.world.refresh((id) => this._stageUnlocked(id), (id) => meta.stageCleared(id));
    this.tavern.show(false); this.tavern.showRoom(false); this.arenaGroup.visible = false;
    this.world.show(true);
    this.wizard.setVisible(false);
    this.input.pointMode = true;
    this.scene.background.setHex(0x0a1424); this.scene.fog.color.setHex(0x0e1a2c); this.scene.fog.density = 0.006;
    this.hemi.color.setHex(0xbfd0ff); this.hemi.groundColor.setHex(0x2a3a4a); this.hemi.intensity = 1.0;
    this.dir.color.setHex(0xffffff); this.dir.intensity = 1.3; this.ambient.color.setHex(0x44506a); this.ambient.intensity = 0.6;
    let sel = this.world.order[0];
    for (const id of this.world.order) if (this._stageUnlocked(id)) sel = id;
    this._worldSel = sel; this.world.select(sel);
    this.ui.setScreen('play'); this.ui.setPhase('world', this.input.isTouch);
    this.ui.showWorldHud(this, sel);
    this.ui.setGold(meta.gold());
  }
  _stageUnlocked(id) { const o = this.world.order, i = o.indexOf(id); return i <= 0 || meta.stageCleared(o[i - 1]); }
  selectWorldRegion(id) {
    if (!id) return;
    this._worldSel = id; this.world.select(id); this.audio.play('click'); this.ui.showWorldHud(this, id);
  }
  ventureSelected() {
    const id = this._worldSel;
    if (!id || !this._stageUnlocked(id)) { this.ui.toast('🔒 Conquer the region before it to open this one'); return; }
    this.ui.hideWorldHud(); this.input.pointMode = false; this.beginRun(id);
  }
  closeWorldMap() { this.ui.hideWorldHud(); this.world.show(false); this.input.pointMode = false; this.enterTavern(); }
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
    this.arenaGroup.visible = false; this.world.show(false);
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
      meta.addGold(tips);
      const fin = meta.advanceDay(); // a day's work passes (and ticks research)
      meta.save();
      this.ui.setGold(meta.gold());
      this.ui.toast(`🍺 Shift over — ${tips}🪙 in tips!`);
      if (fin) this.ui.toast(`🔬 Research complete: ${meta.researchById(fin).name}`);
      this.state = 'play';
    });
  }
  // a customer served in the in-world bar loop — pay the tip; every 3 served is a day's work
  onTavernServe() {
    const tip = 7 + Math.floor(Math.random() * 6); // 7–12 gold
    meta.addGold(tip); meta.save();
    this.ui.setGold(meta.gold());
    this.audio.play('levelup');
    this.ui.toast(`🍺 Served! +${tip}🪙 tip`);
    this._servedToday = (this._servedToday || 0) + 1;
    if (this._servedToday % 3 === 0) {
      const fin = meta.advanceDay();
      this.ui.toast('☀️ A good day\'s work — a day passes');
      if (fin) this.ui.toast(`🔬 Research complete: ${meta.researchById(fin).name}`);
    }
  }
  // the main quest is done — the tavern is yours, free and clear
  onDebtCleared() {
    this.audio.play('win');
    for (const f of meta.FEATURE_ORDER) meta.unlockFeature(f); // owning the place opens everything
    meta.setTavernOwned(true);
    this.ui.setGold(meta.gold());
    this.showStory('The Spirit', [
      'The last coin clinks into the strongbox. The debt is PAID — in full.',
      'The Tipsy Toad is ours now, free and clear. No more creditors, no more scolding.',
      'Now we drink, we brawl, and we get filthy rich. To glorious, catastrophic mayhem!',
    ]);
  }
  startRun(stageId) { this._shopKind = null; this.beginRun(stageId); }
  closeShop() {
    if (this.state !== 'menu' || !this._shopKind) return; // bar shift has its own button
    this._shopKind = null;
    this.ui.closeShop();
    this.tavern.refreshRoom(meta);   // reflect any newly built/sold furniture
    this.ui.setGold(meta.gold());
    this.state = 'play';
  }

  // Leave the world map -> black out -> drop straight into the chosen level.
  beginRun(stageId) {
    if (this._exiting) return;
    this._exiting = true;
    this._pendingStage = STAGES[stageId] || STAGES.forest;
    this.audio.play('jobDone');
    this.state = 'blackout';
    this.ui.fadeBlack(true);
    setTimeout(() => {
      this.showStory(BLACKOUT_LINES.speaker, BLACKOUT_LINES.lines, () => this.enterArena(this._pendingStage));
    }, 1250);
  }

  // ---- one full level: a long survival fight, six waves then the boss ----
  enterArena(stage) {
    this.stage = stage; this.phase = 'arena';
    this.stats = DEFAULT_STATS();
    if (meta.consumeRest()) this.stats.hpMax += meta.REST_BONUS + meta.roomComfort() * 4; // a good night's rest, comfier room = more
    this._applyEquipment();
    meta.applyResearch(this.stats); // completed research bonuses
    this.loadout = meta.getLoadout();
    this.unlocked = new Set(this.loadout);
    this.activeCombos = meta.activeCombos(this.unlocked);
    this.recognizer = new Recognizer();
    for (const id of this.loadout) { const g = SPELLS[id].gesture; this.recognizer.add(g, TEMPLATES[g]); }
    this.level = 1; this.xp = 0; this.xpNeed = this._xpForLevel(1);
    this.kills = 0; this.chores = 0; this.pendingLevels = 0; this.elapsed = 0;
    this.drunkenness = 0.22; this._drunkSurge = 0; this._drinkCd = 0; this._drinking = false;
    this._artifactsTaken = new Set(meta.ownedArtifacts()); // don't re-drop ones you already own
    this._deckOff = new Set(meta.deckOffIds());             // your curated level-up deck
    // ---- the run path: an entrance fight, then a left/right fork before each step
    // (combat / treasure / campfire / choice-event / skill-trial, Slay-the-Spire
    // style), then the boss + a guaranteed OP artifact previewed at the boss fork ----
    this._forksTotal = 3;           // normal forks before the boss fork
    this._forksDone = 0;            // forks resolved so far
    this._roomsCleared = 0;         // depth, for loot & quests
    this._pendingReward = null;     // the prize the combat node you entered promised
    this._nextIsBoss = false;
    this.runAbilities = new Map();  // id -> {icon,name,count}  (shown top-left)
    this.runArtifacts = [];         // [{icon,name}]            (the OP relics)
    this._opArtifact = rollArtifact(this); // the end-of-level relic, previewed on the path
    // carry your equipped artifacts into the run — each applies its bonus & shows in the tray
    for (const id of meta.equippedArtifacts()) { const a = artifactById(id); if (a) { a.apply(this); this.runArtifacts.push({ icon: a.icon, name: a.name }); } }
    this.ui.setAbilities([...this.runAbilities.values()], this.runArtifacts);
    this._runGemStart = meta.gems(); this.bossKilled = false;
    this.bossActive = false; this.bossCine = 0; this._endState = null; this._exiting = false; this._lastCast = null;
    this.enemies.clear(); this.spells.reset(); this._clearPickups(); this.director.reset();
    this.world.show(false); this.tavern.show(false); this.tavern.showRoom(false); this.arenaGroup.visible = true;
    this.wizard.setVisible(true);
    this.wizard.reset(this.stats); this.wizard.pos.set(0, 0, 0);
    this.input.pointMode = false;
    this.camOffset.set(0, 27, 22);
    this._applyStageTheme(stage);
    this._spawnBarrels();        // refreshing beer kegs scattered in the arena
    this._spawnShrine();         // a rune shrine: draw a glyph at it to channel a relic
    this._spawnWisp();           // your glowing wisp guide-pet drifts along
    this.ui.setPhase('arena', this.input.isTouch);
    this.ui.setLoadout(this.loadout);
    this.ui.setScreen('play');
    this.ui.hideJob(); this.ui.closeModals(); this.ui.fadeBlack(false);
    this.ui.setGold(meta.gold());
    this.state = 'play';
    if (this._introRun) {
      // ===== the guided first fight (the wisp cutscene already taught the basics) =====
      this.director.start(stage, { waves: 3, boss: false, hpScale: 0.9, sizeMult: 0.85 });
      if (!this._guideShown) { this._guideShown = true; this._guideOpen = true; this.ui.showGuide(); this.state = 'paused'; }
      this._introTutorial();
      return;
    }
    this._beginRoom(false); // the entrance fight (no choice before it)
    this.showStory('The Spirit', stage.intro, () => {
      if (!this._guideShown) { this._guideShown = true; this._guideOpen = true; this.ui.showGuide(); this.state = 'paused'; }
    });
  }
  // wisp tutorial: a few timed, friendly prompts during the first fight
  _introTutorial() {
    const say = (t, ms) => setTimeout(() => { if (this._introRun) { this.ui.toast(t); this.audio.play('xp'); } }, ms);
    say('✨ Wisp: hold RIGHT-CLICK (or draw on the right on phone) and trace a glyph to cast!', 600);
    say('✨ Wisp: low on beer? It\'s your mana — press Q to CHUG and refill (it\'ll spin the room).', 7000);
    say('✨ Wisp: soak up the glowing motes for XP. Survive all three waves!', 13000);
  }
  // a glowing wisp guide-pet that bobs along beside the wizard
  _spawnWisp() {
    if (!this.wisp) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      const light = new THREE.PointLight(0x8fe0ff, 1.1, 8);
      g.add(core, halo, light);
      this.wisp = g; this.wisp.userData = { p: new THREE.Vector3(), core };
      this.arenaGroup.add(g);
    }
    this.wisp.visible = true;
    this.wisp.userData.p.copy(this.wizard.pos).add(new THREE.Vector3(1.3, 2.1, 1.3));
  }
  _updateWisp(sdt) {
    if (!this.wisp || !this.wisp.visible) return;
    const w = this.wizard.pos;
    const tx = w.x - Math.sin(this.wizard.yaw) * 1.1 + 1.0;
    const tz = w.z - Math.cos(this.wizard.yaw) * 1.1 + 1.0;
    const ty = 2.0 + Math.sin(this.elapsed * 2) * 0.28;
    this.wisp.userData.p.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, sdt * 3));
    this.wisp.position.copy(this.wisp.userData.p);
    this.wisp.userData.core.material.opacity = 0.7 + Math.sin(this.elapsed * 6) * 0.25;
  }
  // the guided first fight is cleared — thrown back to the bar for a scolding
  _finishIntroRun() {
    this._introRun = false;
    meta.addGems(3); // a little starter pocketful
    this.state = 'blackout'; this.ui.fadeBlack(true); this.audio.play('win');
    setTimeout(() => this.cine.play('scold', () => this.enterTavern()), 900);
  }

  // ---- run path: a left/right fork before each step. Nodes are typed
  // (combat / elite / treasure / campfire / choice-event / skill-trial), Slay-the-
  // Spire style; the door previews what waits. The last fork leads to the boss. ----
  _beginRoom(isBoss, elite) {
    const scale = (1 + this._forksDone * 0.12) * (elite ? 1.5 : 1);
    this.director.start(this.stage, { waves: isBoss ? 1 : 2, boss: isBoss, hpScale: scale, sizeMult: 1 + this._forksDone * 0.06 + (elite ? 0.2 : 0) });
    this.ui.toast(isBoss ? '👑 The boss lair — survive!' : elite ? '💀 An elite pack!' : '⚔ A skirmish');
  }

  // a combat room cleared -> pay out its promised reward, then offer the next fork
  onEncounterCleared() {
    if (this._introRun) { this._finishIntroRun(); return; } // the guided first fight is over
    if (this._pendingReward) { this._grantReward(this._pendingReward); this._pendingReward = null; }
    this._nextFork();
  }

  // a short travelling beat between nodes (a little cutscene)
  _travel(line, cb) {
    const lines = ['Traveling deeper into the dark…', 'Onward, wizard — mind your step…', 'The path winds on through the trees…', 'Something watches from the dark…'];
    this.state = 'loading';
    this.ui.showLoadScene(line || lines[Math.floor(Math.random() * lines.length)]);
    setTimeout(() => { this.ui.hideLoadScene(); cb(); }, 1150);
  }

  _nextFork() {
    this._roomsCleared = this._forksDone;
    this.enemies.clear(); this._clearPickups(); // a calm clearing to choose your path in
    this.state = 'path';
    this.audio.play('levelup');
    const bossNext = this._forksDone >= this._forksTotal;
    this._nextIsBoss = bossNext;
    this._pathNodes = this._makeNodePair(bossNext);
    this.ui.showPathChoice(this, {
      bossNext, stage: this.stage, nodes: this._pathNodes,
      cur: Math.min(this._forksDone + 1, this._forksTotal + 1), total: this._forksTotal + 1,
      artifact: bossNext ? this._opArtifact : null,
    });
  }
  choosePath(i) {
    if (this.state !== 'path') return;
    const node = this._pathNodes && this._pathNodes[i];
    if (!node) return;
    this.audio.play('click');
    this.ui.hidePathChoice();
    this._forksDone++;
    if (node.type === 'combat' || node.type === 'elite') {
      this._pendingReward = node.reward || null;
      const boss = !!node.bossNext, elite = node.type === 'elite';
      this._travel(boss ? 'Approaching the lair…' : null, () => { this.state = 'play'; this._beginRoom(boss, elite); });
    } else if (node.type === 'treasure') {
      this._grantReward(node.reward); this._nextFork();
    } else if (node.type === 'campfire') {
      this.stats.hpMax += 12; this.wizard._maxHp = this.stats.hpMax; this.wizard.hp = this.stats.hpMax;
      this.wizard.mana = this.stats.manaMax; this.audio.play('heal');
      this.ui.toast('🔥 Rested — fully healed & +12 max HP'); this._nextFork();
    } else if (node.type === 'event') {
      this.state = 'path'; this._curEvent = node.event; this.ui.showChoiceEvent(this, node.event);
    } else if (node.type === 'skill') {
      this.state = 'path'; this.ui.showSkillEvent(this);
    } else { this._nextFork(); }
  }

  // ----- typed path nodes -----
  _makeNodePair(bossNext) {
    if (bossNext) { const a = this._makeNode('combat'); const b = this._makeNode('combat'); a.bossNext = b.bossNext = true; a.name = b.name = 'To the Boss'; return [a, b]; }
    const types = this._pickNodeTypes();
    return [this._makeNode(types[0]), this._makeNode(types[1])];
  }
  _pickNodeTypes() {
    const pool = [['combat', 4], ['elite', 2], ['treasure', 2], ['campfire', 2], ['event', 3], ['skill', 2]];
    const pickFrom = (arr) => { let tot = 0; for (const [, w] of arr) tot += w; let r = Math.random() * tot; for (const e of arr) { r -= e[1]; if (r <= 0) return e[0]; } return arr[0][0]; };
    const a = pickFrom(pool);
    const b = pickFrom(pool.filter(e => e[0] !== a));
    return [a, b];
  }
  _makeNode(type) {
    const lvl = Math.max(1, this.level);
    if (type === 'combat') { const r = this._makeReward(this._randKind()); return { type, icon: '⚔️', name: 'Skirmish', desc: `Fight · win ${r.icon} ${r.name}`, reward: r, lurk: '⚔ foes ahead' }; }
    if (type === 'elite') { const r = this._makeReward(Math.random() < 0.5 ? 'gear' : 'ability'); return { type, icon: '💀', name: 'Elite Pack', desc: `Tough fight · win ${r.icon} ${r.name}`, reward: r, lurk: '💀 something big stirs' }; }
    if (type === 'treasure') { const r = this._makeReward(Math.random() < 0.5 ? 'gems' : 'gear'); return { type, icon: '💰', name: 'Hidden Cache', desc: `Free · ${r.icon} ${r.name}`, reward: r, lurk: '✨ unguarded loot' }; }
    if (type === 'campfire') return { type, icon: '🔥', name: 'Campfire', desc: 'Rest — full heal & +12 max HP', lurk: '🔥 a safe little fire' };
    if (type === 'event') return { type, icon: '❓', name: 'Mystery', desc: 'A strange encounter — your call', event: this._pickEvent(), lurk: '❓ who knows what' };
    return { type: 'skill', icon: '✶', name: 'Trial of Nerve', desc: 'Stop the marker on the mark to win', lurk: '✶ a test of nerve' };
  }
  _randKind() { const k = ['gems', 'heart', 'brew', 'gear', 'ability', 'ability']; return k[Math.floor(Math.random() * k.length)]; }

  // ----- choice events (Slay-the-Spire style dilemmas) -----
  _pickEvent() {
    const pool = EVENTS.filter(e => !e.minGoldAny || meta.gold() >= 0);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  resolveEvent(i) {
    const ev = this._curEvent; if (!ev) { this._nextFork(); return; }
    const opt = ev.opts[i]; this.ui.hideEvent();
    if (opt) {
      const w = this.wizard, s = this.stats;
      if (opt.hp) w.hp = Math.max(1, w.hp + opt.hp);
      if (opt.heal) w.heal(opt.heal);
      if (opt.maxhp) { s.hpMax = Math.max(40, s.hpMax + opt.maxhp); w._maxHp = s.hpMax; w.hp = Math.max(1, Math.min(w.hp + opt.maxhp, s.hpMax)); }
      if (opt.gems) { if (opt.gems < 0) meta.spendGems(-opt.gems); else meta.addGems(opt.gems); }
      if (opt.mana === 'full') w.mana = s.manaMax;
      if (opt.drunk) { this.drunkenness = Math.min(1, this.drunkenness + opt.drunk); this._drunkSurge = 1; }
      if (opt.gain === 'ability') { const u = rollUpgrades(this, 1)[0]; if (u) { this.applyAbility(u); this.ui.toast(`✦ ${u.name}`); } }
      else if (opt.gain === 'gear') { const inst = meta.dropGear(Math.max(1, this.level) + 1, Math.random() < 0.4); meta.addGear(inst); this.ui.lootToast(inst); }
      else if (opt.gain === 'gems') { const amt = opt.gemAmt || 4; meta.addGems(amt); this.ui.toast(`💎 +${amt} gems`); }
      this.audio.play('click');
    }
    this._nextFork();
  }
  resolveSkill(quality) {
    this.ui.hideEvent();
    let msg;
    if (quality >= 0.82) { const u = rollUpgrades(this, 1)[0]; if (u) this.applyAbility(u); meta.addGems(8); msg = `✶ PERFECT! ✦ ${u ? u.name : 'ability'} + 💎8`; this.audio.play('levelup'); }
    else if (quality >= 0.45) { const inst = meta.dropGear(Math.max(1, this.level), Math.random() < 0.3); meta.addGear(inst); msg = `✶ Steady — ${meta.RARITIES[inst.rarity].name} ${inst.slot}!`; this.audio.play('xp'); }
    else { meta.addGems(3); msg = '✶ Shaky hand — 💎3 for the effort'; this.audio.play('hiccup'); }
    this.ui.toast(msg);
    this._nextFork();
  }

  _makeReward(kind) {
    const lvl = Math.max(1, this.level);
    if (kind === 'gems') { const amount = 3 + Math.floor(Math.random() * 3) + Math.floor(lvl / 3); return { kind, icon: '💎', name: 'Gem Vein', desc: `+${amount} gems`, amount }; }
    if (kind === 'heart') return { kind, icon: '❤️', name: 'Heart Idol', desc: '+25 max HP & a full heal' };
    if (kind === 'brew') return { kind, icon: '🍺', name: 'Brewfont', desc: '+30 max mana, +20/gulp & refill' };
    if (kind === 'gear') { const inst = meta.dropGear(lvl + 1, Math.random() < 0.3); const rc = meta.RARITIES[inst.rarity]; return { kind, icon: '🎁', name: inst.name, desc: `${rc.name} ${inst.slot}`, color: rc.color, inst }; }
    const u = rollUpgrades(this, 1)[0]; return { kind: 'ability', icon: u.icon, name: u.name, desc: u.desc, u };
  }
  _grantReward(r) {
    if (!r) return;
    if (r.kind === 'gems') { meta.addGems(r.amount); this.ui.toast(`💎 +${r.amount} gems`); }
    else if (r.kind === 'heart') { this.stats.hpMax += 25; this.wizard._maxHp = this.stats.hpMax; this.wizard.hp = this.stats.hpMax; this.ui.toast('❤️ +25 max HP — fully healed'); }
    else if (r.kind === 'brew') { this.stats.manaMax += 30; this.stats.drinkHeal += 20; this.wizard.mana = this.stats.manaMax; this.ui.toast('🍺 Brewfont — bigger mug & a heartier brew'); }
    else if (r.kind === 'gear') { meta.addGear(r.inst); this.ui.lootToast(r.inst); }
    else if (r.kind === 'ability') { this.applyAbility(r.u); this.ui.toast(`✦ ${r.name}`); }
    this.audio.play('levelup');
  }

  // apply a chosen ability (level-up / shrine / keg) and log it in the top-left tray
  applyAbility(u) {
    u.apply(this);
    const e = this.runAbilities.get(u.id) || { icon: u.icon, name: u.name, count: 0 };
    e.count++; this.runAbilities.set(u.id, e);
    this._refreshBoonHud();
  }
  // collect a very-OP artifact into your persistent stash (carry it into future runs)
  grantArtifact(a) {
    if (!a) return;
    const fresh = meta.addArtifact(a.id); // adds to the collection (auto-carried if you have a free slot)
    if (!fresh) meta.addGems(10);          // already owned → a few gems instead
  }
  _refreshBoonHud() { if (this.ui.setAbilities) this.ui.setAbilities([...this.runAbilities.values()], this.runArtifacts); }

  _applyEquipment() {
    const m = meta.equipMods();
    const s = this.stats;
    if (m.hpMax) s.hpMax += m.hpMax;
    if (m.manaMax) s.manaMax += m.manaMax;
    if (m.hpRegen) s.hpRegen += m.hpRegen;
    if (m.manaRegen) s.drinkPower += m.manaRegen * 2.2; // gear "mana" rolls now boost how much each gulp restores
    if (m.moveSpeed) s.moveSpeed += m.moveSpeed;
    if (m.pickupRadius) s.pickupRadius += m.pickupRadius;
    if (m.thorns) s.thorns += m.thorns;
    if (m.damageMult) s.damageMult += m.damageMult;
    if (m.cooldownMult) s.cooldownMult *= (1 + m.cooldownMult);
    if (m.lifeOnKill) s.lifeOnKill += m.lifeOnKill;
    if (m.critMult) s.critMult += m.critMult;
    if (m.xpMult) s.xpMult += m.xpMult;
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

  // ---- DRINK: a 3-second channel. He pulls out the tankard, chugs (progress bar),
  // and your mana fills to FULL. Costs sobriety — you get woozier. You can move
  // while chugging; what the brew does beyond mana depends on your beer abilities. ----
  drink() {
    if (this.state !== 'play' || this.phase !== 'arena' || !this.wizard.alive) return;
    if (this._drinking) return; // already chugging
    const w = this.wizard, s = this.stats;
    if (w.mana >= s.manaMax - 0.5) { this.ui.toast('🍺 Mug\'s already full'); return; }
    this._drinking = true; this._drinkProg = 0; this._drinkDur = 3;
    w.startDrink(this._drinkDur);
    this.audio.play('heal');
    this.ui.showDrinkBar();
    this.ui.toast('🍺 Chugging…');
  }
  _updateDrink(sdt) {
    if (!this._drinking) return;
    if (!this.wizard.alive || this.state !== 'play') { this._cancelDrink(); return; }
    this._drinkProg += sdt / this._drinkDur;
    this.ui.setDrinkProg(Math.min(1, this._drinkProg));
    if (Math.random() < sdt * 7) { const hp = this.wizard.handPosition(); hp.y = 2.0; this.particles.burst({ pos: hp, color: 0xfff3c0, count: 2, speed: 1.2, size: 0.12, life: 0.5, grav: 1, blend: 'normal' }); }
    if (this._drinkProg >= 1) this._finishDrink();
  }
  _cancelDrink() { this._drinking = false; this.wizard.endDrink(); this.ui.hideDrinkBar(); }
  _finishDrink() {
    const w = this.wizard, s = this.stats;
    this._drinking = false; w.endDrink(); this.ui.hideDrinkBar();
    w.mana = s.manaMax;                        // chugged it dry → FULL mana
    if (s.drinkHeal) w.heal(s.drinkHeal);      // beer types
    if (s.drinkShield) w.addShield(s.drinkShield, 8);
    this.drunkenness = Math.min(1, this.drunkenness + 0.3 * (s.drinkChaos || 1));
    this._drunkSurge = 1;
    w.bob -= 0.7; w.leanV.x += (Math.random() - 0.5) * 6; w.leanV.z += (Math.random() - 0.5) * 6;
    this.audio.play('levelup');
    const hp = w.handPosition(); hp.y = 2.1;
    this.particles.burst({ pos: hp, color: 0xf6e3a0, count: 16, speed: 2.8, size: 0.2, life: 0.8, grav: 2, blend: 'normal' });
    this.ui.toast('🍺 *AHHH!* — full mana, room spinning');
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
      if (e.type === 'select') { if (this.state === 'world') { const id = this.world.pick(e.x, e.y, this.camera); if (id) this.selectWorldRegion(id); } continue; }
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
        const channeled = this._maybeChannelShrine(); // drawing at the shrine claims a relic
        if (!crit && !channeled) this.ui.accuracyToast(accuracy);
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
    // world map: a true top-down view of the realm, easing toward the selected region
    if (this.phase === 'world') {
      const sel = this._worldSel ? this.world.regionPos(this._worldSel) : this.world.center;
      const cx = sel.x * 0.4, cz = sel.z * 0.4 - 1.5;
      this.camera.position.lerp(new THREE.Vector3(cx, 40, cz + 7), Math.min(1, dt * 2.5));
      this.camera.lookAt(cx, 0, cz);
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
    // cutscenes drive their own camera, actors & render — bypass the normal loop
    if (this.state === 'cutscene') { this.cine.update(dt); return; }
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
    } else if (this.state === 'world') {
      this._updateWorld(dt);
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

    this._updateBarrels(sdt);
    this._updateShrine(sdt);
    this._updateDrink(sdt);
    this._updateWisp(sdt);

    if (!this.wizard.alive) this._loseRun();
    if (this.pendingLevels > 0 && this.state === 'play') this._openLevelUp();
    // boss slain -> win the whole level
    if (this._endState === 'win' && !this.storyShowing && this.state === 'play') { this.state = 'win'; this._showEnd(true); }
  }

  // ---- interactive beer kegs scattered in the arena (drink for sustain / a golden one grants an artifact) ----
  _spawnBarrels() {
    if (!this._barrelGroup) { this._barrelGroup = new THREE.Group(); this.arenaGroup.add(this._barrelGroup); }
    const grp = this._barrelGroup;
    for (let i = grp.children.length - 1; i >= 0; i--) { const c = grp.children[i]; c.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); grp.remove(c); }
    this.barrels = [];
    const spots = [[-16, -11], [16, -11], [-13, 15], [13, 15], [0, -21]];
    spots.forEach((p, i) => {
      const golden = i === spots.length - 1;
      const m = this._buildKeg(golden); m.position.set(p[0], 0, p[1]); grp.add(m);
      this.barrels.push({ mesh: m, golden, full: true, t: 0, x: p[0], z: p[1] });
    });
  }
  _buildKeg(golden) {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: golden ? 0xffce5c : 0x7a5230, roughness: 0.7, metalness: golden ? 0.4 : 0, emissive: golden ? 0x6a4a00 : 0x000000, emissiveIntensity: golden ? 0.5 : 0 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x33323a, roughness: 0.6, metalness: 0.3 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 1.4, 14), woodMat); body.position.y = 0.7; body.castShadow = true; g.add(body);
    for (const y of [0.35, 1.05]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.06, 6, 16), ironMat); r.position.y = y; r.rotation.x = Math.PI / 2; g.add(r); }
    const foam = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: golden ? 0xfff0b0 : 0xfff7e8, transparent: true, opacity: 0.95 })); foam.position.y = 1.5; foam.scale.y = 0.4; g.add(foam); g.userData.foam = foam;
    const mk = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: golden ? 0xffd86a : 0x9bff7a, transparent: true, opacity: 0.9 })); mk.position.y = 2.2; g.add(mk); g.userData.mark = mk;
    return g;
  }
  _updateBarrels(sdt) {
    if (!this.barrels) return;
    const w = this.wizard.pos;
    for (const b of this.barrels) {
      const mk = b.mesh.userData.mark, foam = b.mesh.userData.foam;
      if (!b.full) {
        b.t -= sdt;
        if (b.t <= 0) { b.full = true; foam.visible = true; if (mk) mk.visible = true; } else { foam.visible = false; if (mk) mk.visible = false; }
        continue;
      }
      if (mk) { mk.rotation.y += sdt * 2; mk.position.y = 2.2 + Math.sin(this.elapsed * 3 + b.x) * 0.12; }
      const dx = w.x - b.x, dz = w.z - b.z;
      if (dx * dx + dz * dz < 2.4 * 2.4) { this._drinkBarrel(b); if (b.golden) return; }
    }
  }
  _drinkBarrel(b) {
    b.full = false; b.t = b.golden ? 50 : 15;
    this.audio.play('heal');
    this.particles.burst({ pos: new THREE.Vector3(b.x, 1.6, b.z), color: b.golden ? 0xffe0a0 : 0xf6e3a0, count: b.golden ? 16 : 10, speed: 3, size: 0.2, life: 0.8, grav: 2, blend: 'normal' });
    if (b.golden) {
      this.ui.toast('🍺✦ A golden brew — gain an ability!');
      this.offerUpgrade(() => { this.state = 'play'; });
    } else {
      this.wizard.heal(22); this.wizard.mana = Math.min(this.stats.manaMax, this.wizard.mana + 50);
      this.drunkenness = Math.min(1, this.drunkenness + 0.18); this._drunkSurge = 1;
      this.ui.toast('🍺 A keg! +HP & mana — and a buzz');
    }
  }

  // ---- rune shrine: walk up & DRAW a glyph to channel a free artifact (re-arms slowly) ----
  _spawnShrine() {
    if (!this._shrineGroup) { this._shrineGroup = new THREE.Group(); this.arenaGroup.add(this._shrineGroup); }
    const grp = this._shrineGroup;
    for (let i = grp.children.length - 1; i >= 0; i--) { const c = grp.children[i]; c.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); grp.remove(c); }
    const sx = 0, sz = 12;
    const m = this._buildShrine(); m.position.set(sx, 0, sz); grp.add(m);
    this.shrine = { mesh: m, x: sx, z: sz, armed: true, t: 0, near: false, hinted: false };
  }
  _buildShrine() {
    const g = new THREE.Group();
    g.userData.lit = []; // the glowing parts toggled on/off with arming
    const stone = new THREE.MeshStandardMaterial({ color: 0x4a4458, roughness: 0.85, metalness: 0.1 });
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.45, 16), stone); dais.position.y = 0.22; dais.castShadow = dais.receiveShadow = true; g.add(dais);
    const step = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.3, 16), stone); step.position.y = 0.55; g.add(step);
    // four little obelisks around the rim
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const o = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.28), stone); o.position.set(Math.cos(a) * 1.45, 0.75, Math.sin(a) * 1.45); o.castShadow = true; g.add(o); }
    // glowing ring + floating rune core
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.08, 8, 28), new THREE.MeshBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: 0.9 }));
    ring.position.y = 1.6; ring.rotation.x = Math.PI / 2; g.add(ring); g.userData.ring = ring; g.userData.lit.push(ring);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: 0xc9b6ff, transparent: true, opacity: 0.95 }));
    core.position.y = 2.0; g.add(core); g.userData.core = core; g.userData.lit.push(core);
    // orbiting rune shards
    const runes = [];
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TetrahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: 0x9bff7a, transparent: true, opacity: 0.9 })); g.add(r); runes.push(r); g.userData.lit.push(r); }
    g.userData.runes = runes;
    // a soft beam of light rising from the dais
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.95, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 3.2; g.add(beam); g.userData.beam = beam; g.userData.lit.push(beam);
    return g;
  }
  _updateShrine(sdt) {
    const sh = this.shrine; if (!sh) return;
    const ud = sh.mesh.userData;
    for (const o of ud.lit) o.visible = sh.armed; // dim the whole rune array while spent
    if (sh.armed) {
      const pulse = 0.6 + Math.sin(this.elapsed * 3) * 0.4;
      if (ud.core) { ud.core.rotation.y += sdt * 1.4; ud.core.rotation.x += sdt * 0.7; ud.core.position.y = 2.0 + Math.sin(this.elapsed * 2) * 0.15; ud.core.material.opacity = 0.7 + pulse * 0.3; }
      if (ud.ring) ud.ring.rotation.z += sdt * 0.8;
      if (ud.beam) ud.beam.material.opacity = 0.14 + pulse * 0.16;
      if (ud.runes) ud.runes.forEach((r, i) => { const a = this.elapsed * 1.2 + i * (Math.PI * 2 / 3); r.position.set(Math.cos(a) * 1.5, 1.2 + Math.sin(this.elapsed * 2 + i) * 0.2, Math.sin(a) * 1.5); r.rotation.y += sdt * 2; });
    } else {
      sh.t -= sdt; if (sh.t <= 0) { sh.armed = true; sh.hinted = false; }
    }
    const w = this.wizard.pos, dx = w.x - sh.x, dz = w.z - sh.z;
    const near = sh.armed && dx * dx + dz * dz < 3.4 * 3.4;
    sh.near = near;
    if (near && !sh.hinted) { sh.hinted = true; this.ui.toast('✦ Rune shrine — draw any glyph to channel an ability!'); }
    if (!near) sh.hinted = false;
  }
  _maybeChannelShrine() {
    const sh = this.shrine;
    if (!sh || !sh.armed || !sh.near) return false;
    sh.armed = false; sh.t = 55; sh.hinted = false; sh.near = false;
    this.audio.play('levelup');
    this.particles.burst({ pos: new THREE.Vector3(sh.x, 1.8, sh.z), color: 0x9b7bff, count: 24, speed: 4.5, size: 0.24, life: 1.1, grav: 0, blend: 'add' });
    this.ui.toast('✦ The runes answer — gain an ability!');
    this.offerUpgrade(() => { this.state = 'play'; });
    return true;
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

  // ---- the 3D world map ----
  _updateWorld(dt) {
    this.world.update(dt);
    this.particles.update(dt);
  }

  // ---- animated title screen: a drunk wizard auto-blasting waves of foes ----
  enterDemo() {
    this.phase = 'arena';
    this.tavernReady = true; this._openingCine = false; this.bossCine = 0;
    this.stats = DEFAULT_STATS();
    this.tavern.show(false);
    this.tavern.showRoom(false);
    this.world.show(false);
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
