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
import { Director, STAGES, BLACKOUT_LINES, STAGE_GIMMICKS, STAGES_PER_REGION, gimmickFor } from './story.js';
import { MINIGAMES, MINIGAME_KEYS } from './minigames.js';
import { applyCardPerks } from './cards.js';
import { generateRunMap } from './runmap.js';
import { Jobs } from './jobs.js';
import { Tavern } from './tavern.js';
import { World } from './world.js';
import { LevelMap } from './levelmap.js';
import { Cinematics } from './cinematics.js';
import { rollUpgrades, rollArtifact, artifactById, ARCHETYPES, archetypeById } from './upgrades.js';
import * as meta from './meta.js';
import { COMBO_META } from './meta.js';
import { pxMap } from './pixeltex.js';
import { iconCanvas, PET_SPRITE } from './pixelicons.js';

// Cinematic color grade — runs LAST (after OutputPass), so it operates on sRGB display
// values in [0,1]: contrast/saturation/split-tone, a radial vignette for darkness/mood,
// faint film grain, and an ordered dither that kills banding right before the 8-bit write.
// Vector3 (not Color) tints so three's colour management never re-touches the verbatim values.
const CinematicGradeShader = {
  name: 'CinematicGradePass',
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 1.12 },
    uSaturation: { value: 1.08 },
    uShadowTint: { value: new THREE.Vector3(0.86, 0.92, 1.06) },
    uHighlightTint: { value: new THREE.Vector3(1.06, 1.01, 0.92) },
    uTintStrength: { value: 0.35 },
    uVignette: { value: 0.42 },
    uVignetteSoft: { value: 0.55 },
    uDither: { value: 1.4 },
    uGrain: { value: 0.02 },
    uTime: { value: 0.0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    uniform float uContrast, uSaturation, uTintStrength, uVignette, uVignetteSoft, uDither, uGrain, uTime;
    uniform vec3 uShadowTint, uHighlightTint;
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
    float bayer4x4(vec2 fragPx) {
      vec2 p = floor(mod(fragPx, 4.0));
      float v = mod((p.x + p.y * 4.0) + 8.0 * mod(floor(p.x * 0.5) + floor(p.y * 0.5), 2.0) + 2.0 * mod(p.x + p.y, 2.0), 16.0);
      return (v + 0.5) / 16.0 - 0.5;
    }
    float hash21(vec2 p) { p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      vec2 fragPx = gl_FragCoord.xy;
      col = (col - 0.5) * uContrast + 0.5;                                  // contrast around mid-gray
      float l = dot(col, LUMA);
      col = mix(vec3(l), col, uSaturation);                                // saturation
      float shadowMask = 1.0 - smoothstep(0.0, 0.5, l);
      float highlightMask = smoothstep(0.5, 1.0, l);
      vec3 tint = mix(vec3(1.0), uShadowTint, shadowMask * uTintStrength)
                * mix(vec3(1.0), uHighlightTint, highlightMask * uTintStrength);
      col *= tint;                                                         // cool shadows / warm highlights
      vec2 dv = vUv - 0.5;
      float r = length(dv) * 1.41421356;
      float vig = smoothstep(1.0, 1.0 - uVignetteSoft, r);
      col *= mix(1.0, vig, uVignette);                                     // vignette darkness
      float gr = hash21(fragPx + fract(uTime) * 311.7) - 0.5;
      col += gr * uGrain * (0.6 + 0.4 * (1.0 - l));                        // faint animated grain
      col += bayer4x4(fragPx) * (uDither / 255.0);                        // ordered dither (anti-banding)
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};

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
  // synergy-card hooks (each read at one call-site): bonus dmg to slowed foes,
  // mana refunded on a crit, and thorns that heal you for a fraction of their bite
  shatterDmg: 0, manaOnCrit: 0, thornsLifesteal: 0,
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
    this.renderer.toneMappingExposure = 1.05; // moodier baseline; _setMood/_applyStageTheme retune per scene

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7e7ec0);
    this.scene.fog = new THREE.FogExp2(0x8e8ecb, 0.0085);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camOffset = new THREE.Vector3(0, 27, 22);
    this.camTarget = new THREE.Vector3();
    this.camZoom = 1; // player zoom (wheel / pinch), multiplies the camera offset
    this.camYaw = 0;    // player camera turn (orbit around the wizard) — middle-drag / [ ] / on-screen buttons
    this.camPitch = 1;  // player camera pitch multiplier (1 = default top-down-ish; lower = more 3D angle)

    this._buildWorld();
    this.scene.environment = this._makeEnvMap(); // soft image-based lighting: metals/gems read as real material
    this._composer = null; this._initPostFX(); // optional bloom; falls back to direct render if addons don't load

    // subsystems
    this.audio = new AudioEngine();
    this.particles = new Particles(this.scene);
    this.enemies = new Enemies(this.scene);
    this.spells = new SpellSystem(this.scene);
    this.jobs = new Jobs(this.scene);
    this.tavern = new Tavern(this.scene);
    this.world = new World(this.scene);
    this.levelMap = new LevelMap(this.scene);
    this.wizard = new Wizard(this.scene);
    this.director = new Director();
    this.cine = new Cinematics(this);
    this.ui = new UI();
    this.input = new Input(this.canvas);
    // camera zoom is fixed (no wheel / pinch) — the framing stays constant; you can still turn it

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
    this._heartMat = new THREE.MeshStandardMaterial({ color: 0xff5d6c, emissive: 0x7a1f2a, roughness: 0.4 });

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
    this.dir.shadow.bias = -0.0003;
    this.dir.shadow.normalBias = 0.02;
    this.scene.add(this.dir);
    this.scene.add(this.dir.target);
    this.ambient = new THREE.AmbientLight(0x3a4a6a, 0.45);
    this.scene.add(this.ambient);
    // soft fill from the opposite side for nicer modelling (no shadow)
    this.fill = new THREE.DirectionalLight(0xbfd0ff, 0.4);
    this.fill.position.set(-24, 22, -16);
    this.scene.add(this.fill);
    // rim/back light for silhouette separation (the "posed character" pop) — retuned per scene
    this.rim = new THREE.DirectionalLight(0xffffff, 1.0);
    this.rim.position.set(-6, 12, -26);
    this.scene.add(this.rim);
    // a warm "hero light" that hugs the wizard in the arena — pops the character & nearby foes
    this.heroLight = new THREE.PointLight(0xffe0b0, 0, 15, 2);
    this.scene.add(this.heroLight);

    // ---- LOW-POLY DIORAMA GROUND (recoloured per stage) ----
    // Outer terrain: a faceted plane, dead-flat inside the arena, rising into
    // rolling triangulated hills beyond the tree line. Vertex colours hold a
    // grayscale patchwork jitter, so floorMat.color per-stage tinting still works.
    this.floorMat = new THREE.MeshStandardMaterial({ color: 0x2f4a32, roughness: 1, flatShading: true, vertexColors: true });
    pxMap(this.floorMat, 'grass', 60); // crisp pixel turf (multiplies with the per-stage tint)
    const floor = new THREE.Mesh(this._makeTerrainGeo(), this.floorMat);
    floor.receiveShadow = true; G.add(floor);
    // Inner clearing: a hand-triangulated meadow disc with per-face patchwork
    this.rugMat = new THREE.MeshStandardMaterial({ color: 0x3f6440, roughness: 1, flatShading: true, vertexColors: true });
    pxMap(this.rugMat, 'grass', 26);
    const rug = new THREE.Mesh(this._makeClearingGeo(), this.rugMat);
    rug.position.y = 0.012; rug.receiveShadow = true; G.add(rug);
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

  // faceted outer terrain: flat play surface, pseudo-noise hills past the tree line,
  // per-face grayscale jitter baked into vertex colours (tinted by floorMat.color)
  _makeTerrainGeo() {
    const g = new THREE.PlaneGeometry(260, 260, 52, 52);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const r = Math.hypot(x, z);
      if (r > ARENA * 1.03) {
        const t = Math.min(1, (r - ARENA * 1.03) / 26);            // ramp 0→1 past the edge
        const n = Math.sin(x * 0.13) * Math.cos(z * 0.11) * 2.4
                + Math.sin(x * 0.31 + z * 0.17) * 1.2
                + Math.sin(z * 0.23 - x * 0.07) * 0.8;
        pos.setY(i, Math.max(0, t * (2.2 + n)));                   // rolling hills, never below grade
      }
    }
    const flat = g.toNonIndexed();
    const n = flat.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let f = 0; f < n; f += 3) {                               // one shade per triangle = patchwork
      const v = 0.88 + Math.random() * 0.24;
      for (let k = 0; k < 3; k++) { col[(f + k) * 3] = v; col[(f + k) * 3 + 1] = v; col[(f + k) * 3 + 2] = v; }
    }
    flat.setAttribute('color', new THREE.BufferAttribute(col, 3));
    flat.computeVertexNormals();
    return flat;
  }
  // hand-triangulated clearing disc (rings × sectors → even triangles, no pie slivers)
  _makeClearingGeo() {
    const RINGS = 7, SEC = 40, verts = [], cols = [];
    const at = (ri, si) => {
      const r = (ri / RINGS) * ARENA, a = (si / SEC) * Math.PI * 2;
      return [Math.cos(a) * r, 0, Math.sin(a) * r];
    };
    const tri = (a, b, c) => {
      const v = 0.9 + Math.random() * 0.2;                         // per-face patchwork shade
      for (const p of [a, b, c]) { verts.push(p[0], p[1], p[2]); cols.push(v, v, v); }
    };
    for (let ri = 0; ri < RINGS; ri++) {
      for (let si = 0; si < SEC; si++) {
        const a = at(ri, si), b = at(ri + 1, si), c = at(ri + 1, si + 1), d = at(ri, si + 1);
        tri(a, b, c);
        if (ri > 0) tri(a, c, d);                                  // innermost ring: fan only
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 3));
    g.computeVertexNormals();
    return g;
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
    const DENSITY = 0.58; // thin the scatter out — the arena was too cluttered with foliage
    const place = (o, x, z, jitterY) => { o.position.set(x, o.position.y + (jitterY || 0), z); o.rotation.y = Math.random() * 6.28; grp.add(o); };
    const treeLine = (build, count = 64) => {
      count = Math.round(count * DENSITY);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.06;
        const r = ARENA - 3 + (i % 3) * 2.2 + Math.random() * 1.5; // ~43-49: a visible wall, two rows deep
        const o = build(); o.scale.setScalar(0.9 + Math.random() * 0.8);
        place(o, Math.cos(a) * r, Math.sin(a) * r);
      }
    };
    // scattered across the clearing, biased toward the centre (sqrt keeps it even, *0.86 pulls inward)
    const inside = (n, build, minR = 3, maxR = ARENA - 7) => {
      n = Math.round(n * DENSITY);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = (minR + Math.sqrt(Math.random()) * (maxR - minR)) * 0.92;
        const o = build(); o.scale.setScalar(0.75 + Math.random() * 0.7);
        place(o, Math.cos(a) * r, Math.sin(a) * r);
      }
    };

    if (kind === 'trees') {
      const trunkMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x4a3326, roughness: 0.95 });
      const leafMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x2f6e3f, roughness: 0.9 });
      const leafMat2 = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x3a824a, roughness: 0.9 });
      const leafMat3 = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x255a34, roughness: 0.9 });
      const bushMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x356b3e, roughness: 0.95 });
      const fernMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x418a4a, roughness: 0.95 });
      const capMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0xc0556a, roughness: 0.8 });
      const stalkMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0xe8e0cc, roughness: 0.9 });
      const rockMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x5a5e66, roughness: 1 });
      const flowerMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0xcdd8e8, roughness: 0.7 }); // pale moonlit bloom (no candy glow)
      const mkTree = () => { const t = new THREE.Group(); const h = 3.4 + Math.random() * 1.6; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, h, 8), trunkMat); tr.position.y = h / 2; tr.castShadow = true; const lm = [leafMat, leafMat2, leafMat3][Math.floor(Math.random() * 3)]; const f1 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.6, 9), lm); f1.position.y = h + 0.6; f1.castShadow = true; const f2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.8, 9), leafMat2); f2.position.y = h + 2.1; const f3 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2, 9), leafMat3); f3.position.y = h + 3.4; t.add(tr, f1, f2, f3); return t; };
      treeLine(mkTree, 54);
      inside(16, mkTree, 6, ARENA - 8);            // full trees dotted inside too
      inside(34, () => { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + Math.random() * 0.7, 0), Math.random() < 0.5 ? bushMat : fernMat); b.position.y = 0.55; b.castShadow = true; b.scale.y = 0.8; return b; });
      inside(20, () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 7), stalkMat); s.position.y = 0.25; const c = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat); c.position.y = 0.5; c.castShadow = true; g.add(s, c); return g; });
      inside(16, () => { const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.6, 0), rockMat); r.position.y = 0.32; r.castShadow = true; return r; });
      inside(18, () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), flowerMat); fl.position.set((Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.2, (Math.random() - 0.5) * 0.6); g.add(fl); } return g; });
    } else if (kind === 'rocks') {
      const rockMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x4a443e, roughness: 1 });
      const tipMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x5a524a, roughness: 1 });
      const crystalMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x6fd0e8, emissive: 0x2a7a8a, roughness: 0.25 });
      const mossMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x3a5a44, roughness: 1 });
      const mkStalagmite = () => { const g = new THREE.Group(); const h = 5 + Math.random() * 4; const base = new THREE.Mesh(new THREE.ConeGeometry(1.6, h, 7), rockMat); base.position.y = h / 2; base.castShadow = true; const tip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2, 6), tipMat); tip.position.y = h; g.add(base, tip); return g; };
      treeLine(mkStalagmite, 50);
      inside(16, mkStalagmite, 6, ARENA - 8);
      inside(30, () => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.8, 0), rockMat); r.position.y = 0.45; r.castShadow = true; return r; });
      inside(22, () => { const g = new THREE.Group(); const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9 + Math.random(), 5), crystalMat); c.position.set((Math.random() - 0.5) * 0.5, 0.5, (Math.random() - 0.5) * 0.5); c.rotation.z = (Math.random() - 0.5) * 0.4; c.castShadow = true; g.add(c); } return g; });
      inside(16, () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + Math.random() * 0.5, 0), mossMat); m.position.y = 0.3; m.scale.y = 0.6; return m; });
    } else if (kind === 'graves') {
      const stoneMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x6a6e7a, roughness: 1 });
      const deadMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x3a3026, roughness: 0.95 });
      const boneMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0xd8d2bc, roughness: 0.8 });
      const fenceMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x2a2a30, roughness: 0.7, metalness: 0.3 });
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
      const deadMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x3a3322, roughness: 0.95 });
      const mossMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x4a6a3a, roughness: 0.95 });
      const reedMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x6a8a4a, roughness: 0.9 });
      const padMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x2f5a32, roughness: 0.9 });
      const mkDead = () => { const t = new THREE.Group(); const h = 4 + Math.random() * 2.5; const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.65, h, 7), deadMat); tr.position.y = h / 2; tr.rotation.z = (Math.random() - 0.5) * 0.2; tr.castShadow = true; const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 0), mossMat); canopy.position.y = h; canopy.scale.y = 0.6; canopy.castShadow = true; const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 2.2, 5), deadMat); b1.position.set(0.9, h - 1.4, 0); b1.rotation.z = -0.8; t.add(tr, canopy, b1); return t; };
      treeLine(mkDead, 52);
      inside(20, mkDead, 6, ARENA - 8);
      inside(34, () => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.0 + Math.random() * 0.8, 5), reedMat); r.position.set((Math.random() - 0.5) * 0.7, 0.5, (Math.random() - 0.5) * 0.7); r.rotation.z = (Math.random() - 0.5) * 0.3; g.add(r); } return g; });
      inside(22, () => { const p = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.4, 12), padMat); p.rotation.x = -Math.PI / 2; p.position.y = 0.03; return p; });
      inside(14, () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.5, 0), mossMat); m.position.y = 0.3; m.scale.y = 0.6; m.castShadow = true; return m; });
    } else if (kind === 'ice') {
      const iceMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0xbfe0ff, roughness: 0.2, metalness: 0.1, emissive: 0x2a5a7a, emissiveIntensity: 0.15 });
      const snowMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0xeef6ff, roughness: 0.95 });
      const darkIce = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x8fb6d8, roughness: 0.3 });
      const mkSpire = () => { const g = new THREE.Group(); const h = 5 + Math.random() * 4; const s = new THREE.Mesh(new THREE.ConeGeometry(1.2, h, 6), iceMat); s.position.y = h / 2; s.castShadow = true; const s2 = new THREE.Mesh(new THREE.ConeGeometry(0.6, h * 0.6, 6), darkIce); s2.position.set(0.7, h * 0.3, 0.3); g.add(s, s2); return g; };
      treeLine(mkSpire, 56);
      inside(22, mkSpire, 6, ARENA - 8);
      inside(30, () => { const g = new THREE.Group(); const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.8 + Math.random(), 5), iceMat); c.position.set((Math.random() - 0.5) * 0.5, 0.4, (Math.random() - 0.5) * 0.5); c.rotation.z = (Math.random() - 0.5) * 0.4; c.castShadow = true; g.add(c); } return g; });
      inside(24, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 10, 8), snowMat); m.position.y = 0.2; m.scale.y = 0.5; m.receiveShadow = true; return m; });
    } else if (kind === 'hell') {
      const rockMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x3a1810, roughness: 1 });
      const lavaMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0xff6a2a, emissive: 0xff4a10, emissiveIntensity: 0.9, roughness: 0.5 });
      const boneMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x4a3328, roughness: 0.9 });
      const mkSpike = () => { const g = new THREE.Group(); const h = 4.5 + Math.random() * 4; const s = new THREE.Mesh(new THREE.ConeGeometry(1.3, h, 6), rockMat); s.position.y = h / 2; s.rotation.z = (Math.random() - 0.5) * 0.18; s.castShadow = true; const crack = new THREE.Mesh(new THREE.ConeGeometry(0.35, h * 0.7, 5), lavaMat); crack.position.y = h * 0.35; g.add(s, crack); return g; };
      treeLine(mkSpike, 54);
      inside(20, mkSpike, 6, ARENA - 8);
      inside(28, () => { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + Math.random() * 0.7, 0), rockMat); r.position.y = 0.4; r.castShadow = true; return r; });
      inside(18, () => { const g = new THREE.Group(); const pool = new THREE.Mesh(new THREE.CircleGeometry(0.7 + Math.random() * 0.5, 14), lavaMat); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.04; g.add(pool); return g; });
      inside(14, () => { const c = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 12, Math.PI), boneMat); c.position.y = 0.12; c.castShadow = true; return c; });
    } else if (kind === 'tech') {
      const metalMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x46525e, roughness: 0.4, metalness: 0.6 });
      const neonMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x5fe0ff, emissive: 0x2fb0d0, emissiveIntensity: 0.9, roughness: 0.3 });
      const panelMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x1f2c38, roughness: 0.5, metalness: 0.4 });
      const mkPylon = () => { const g = new THREE.Group(); const h = 5 + Math.random() * 4; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, h, 8), metalMat); p.position.y = h / 2; p.castShadow = true; for (let i = 1; i <= 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 14), neonMat); ring.rotation.x = Math.PI / 2; ring.position.y = (h / 4) * i; g.add(ring); } g.add(p); return g; };
      treeLine(mkPylon, 50);
      inside(18, mkPylon, 6, ARENA - 8);
      inside(28, () => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random() * 0.6, 0.8 + Math.random(), 0.8 + Math.random() * 0.6), panelMat); b.position.y = 0.5; b.castShadow = true; return b; });
      inside(22, () => { const n = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.25, 0), neonMat); n.position.y = 0.4; return n; });
    } else if (kind === 'void') {
      const monoMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0x1a1430, roughness: 0.4, metalness: 0.3 });
      const crystalMat = new THREE.MeshStandardMaterial({ flatShading: true, color: 0xb68fff, emissive: 0x6a3ad0, emissiveIntensity: 0.8, roughness: 0.25 });
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mkMono = () => { const g = new THREE.Group(); const h = 5 + Math.random() * 5; const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, h, 0.7), monoMat); m.position.y = h / 2; m.rotation.y = Math.random(); m.castShadow = true; const edge = new THREE.Mesh(new THREE.BoxGeometry(1.04, h, 0.08), crystalMat); edge.position.y = h / 2; edge.rotation.y = m.rotation.y; g.add(m, edge); return g; };
      treeLine(mkMono, 48);
      inside(18, mkMono, 6, ARENA - 8);
      inside(30, () => { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + Math.random() * 0.7, 0), crystalMat); c.position.y = 0.5 + Math.random() * 0.5; c.castShadow = true; return c; });
      inside(40, () => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 6, 6), starMat); s.position.y = 0.3 + Math.random() * 3; return s; });
    }

    // pixel-art grain on every scattered prop, chosen by hue (glow/transparent bits skipped;
    // silhouettes get their ink line from the post-process edge pass, not a hull twin)
    grp.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline || !o.material || !o.material.isMeshStandardMaterial) return;
      const m = o.material; if (m.map || m.transparent || (m.emissiveIntensity || 0) >= 0.4) return;
      const c = m.color;
      const tk = (c.g > c.r + 0.02 && c.g >= c.b) ? 'leaf' : (c.r > 0.28 && c.b < c.r * 0.92) ? 'wood' : 'stone';
      pxMap(m, tk, 3); // a touch denser so bushes/rocks/trees clearly read as pixel-textured
    });
  }

  // addon-free image-based lighting: bake a tiny gradient sky + a couple of bright
  // "light cards" into a PMREM env texture. Gives every MeshStandardMaterial a soft,
  // believable sheen/reflection (gold, brass, gems, gear) — the big "shading" upgrade.
  _makeEnvMap() {
    const s = new THREE.Scene();
    // a DIM sky drives the overall ambient lift (kept low so matte surfaces don't wash
    // out); the brighter cards give metals/gems their highlight & reflection.
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(12, 18, 10),
      new THREE.MeshBasicMaterial({ color: 0x46526a, side: THREE.BackSide }));
    s.add(sky);
    const card = (color, x, y, z, sz) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    };
    card(0xd6c2a0, 4, 7, 3, 7);    // warm key card (metal highlight)
    card(0x9fb2d4, -6, 4, -4, 5);  // cool fill card
    card(0x66665f, 0, -6, 2, 8);   // soft bounce from below
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const tex = pmrem.fromScene(s, 0.4).texture;
    pmrem.dispose();
    for (const m of s.children) { m.geometry.dispose(); m.material.dispose(); } // dispose ALL temp meshes (no GPU leak)
    return tex;
  }

  // single render entry point — through the bloom composer if it loaded, else direct.
  // any runtime composer error disables it permanently and falls back, so the game
  // can never end up on a black screen.
  present() {
    if (this._composer) {
      try { this._composer.render(); return; }
      catch (err) { console.warn('Composer render failed, falling back to direct:', err); this._composer = null; }
    }
    this.renderer.render(this.scene, this.camera);
  }
  // load post-processing lazily; a blocked CDN/CSP degrades gracefully to direct render.
  // PIXEL-ART pipeline: RenderPixelatedPass renders the whole scene chunky (shadows
  // included, for free) -> a modest bloom -> OutputPass for tone mapping/sRGB. No SMAA
  // (anti-aliasing would soften the very pixels we want crisp).
  async _initPostFX() {
    try {
      // ShaderPass is in the SAME Promise.all/try-catch — a missing symbol degrades the WHOLE
      // chain gracefully (composer=null → direct render), never throws mid-frame.
      const [{ EffectComposer }, { RenderPixelatedPass }, { UnrealBloomPass }, { OutputPass }, { ShaderPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPixelatedPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/postprocessing/ShaderPass.js'),
      ]);
      const w = window.innerWidth, h = window.innerHeight, pr = this.renderer.getPixelRatio();
      this._pr = pr;
      const c = new EffectComposer(this.renderer);
      const start = this._pixelWant || Math.max(1, Math.round(1 * pr)); // very light default
      // minimal block size (per the "less pixelation" ask) but STRONG edge lines — this is
      // what draws the Megabonk-style ink outline on every mesh silhouette & crease for free
      const px = new RenderPixelatedPass(start, this.scene, this.camera, { normalEdgeStrength: 0.5, depthEdgeStrength: 0.45 });
      this._pixelPass = px;
      if (this._pixelWant) px.setPixelSize(this._pixelWant); // honor a per-scene request made before load (resizes internal RTs)
      c.addPass(px);
      c.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.45, 0.85)); // restrained glow — clean, not blown out
      c.addPass(new OutputPass());            // tone mapping + sRGB (no longer the screen pass)
      const grade = new ShaderPass(CinematicGradeShader); // LAST: dither must hit the final 8-bit write
      this._gradePass = grade;
      c.addPass(grade);
      c.setSize(w, h); c.setPixelRatio(pr);
      this._composer = c;
    } catch (err) {
      console.warn('Post-FX unavailable, using direct render:', err);
      this._composer = null; this._pixelPass = null; this._gradePass = null;
    }
  }
  // dial the pixel chunkiness per scene, in CSS pixels so the block size looks the SAME on
  // dpr1 and dpr2 (the old pr-multiplied math made dpr1 round to 1 = no pixelation at all).
  _setPixel(mode) {
    const pr = this._pr || this.renderer.getPixelRatio() || 1;
    const cssBlock = mode === 'arena' ? 1 : 1.5;          // very light pixelation: barely-there texture
    const n = Math.max(1, Math.round(cssBlock * pr));      // device px; 1 = essentially no pixelation
    this._pixelWant = n;
    if (this._pixelPass) this._pixelPass.setPixelSize(n);
  }

  // re-aim the single shadow-casting light + tighten its frustum to the active scene,
  // so contact shadows actually land (arena is huge; tavern/room/world are small).
  _aimShadow(x, y, z, half) {
    this.dir.position.set(x, y, z);
    this.dir.target.position.set(0, 0, 0); this.dir.target.updateMatrixWorld();
    const sc = this.dir.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
    sc.updateProjectionMatrix();
  }

  _applyStageTheme(stage) {
    const t = stage.theme;
    this._aimShadow(28, 46, 18, 48); // arena frustum — tighter than before = more shadow texels/unit
    this.scene.background.setHex(t.bg);
    this.scene.fog.color.setHex(t.fog); this.scene.fog.density = t.fogD * 0.9; // light haze — the diorama must READ
    // clean low-poly light: lifted floors so every facet catches a readable shade,
    // with the keyed dir + rim still doing the sculpting.
    this.hemi.color.setHex(t.hemi); this.hemi.groundColor.setHex(t.hemiG); this.hemi.intensity = 0.92;
    this.dir.color.setHex(t.dir); this.dir.intensity = t.dirI;
    this.ambient.color.setHex(t.amb); this.ambient.intensity = 0.34;
    this.fill.color.setHex(0xbfd0ff); this.fill.intensity = 0.36;
    this.rim.color.setHex(t.rim != null ? t.rim : t.dir); this.rim.intensity = (t.rimI != null ? t.rimI : 1.15) + 0.3;
    this.floorMat.color.setHex(t.floor);
    this.rugMat.color.setHex(t.rug);
    this._buildScatter(t.scatter);
    this.renderer.toneMappingExposure = 1.04; // moody, saturated, Balatro-rich
    if (this._gradePass) { const u = this._gradePass.uniforms; // deep felt low-poly grade
      u.uContrast.value = 1.13; u.uSaturation.value = 1.19;
      u.uShadowTint.value.set(0.88, 0.93, 1.08); u.uHighlightTint.value.set(1.05, 1.01, 0.95);
      u.uTintStrength.value = 0.26; u.uVignette.value = 0.40; u.uVignetteSoft.value = 0.52;
      u.uGrain.value = 0.012;
      this._baseVig = 0.40; // authoritative vignette base for the low-HP pulse
    }
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (this._composer) this._composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx2d.width = w; this.fx2d.height = h;
  }

  // ---------- progression helpers ----------
  _xpForLevel(lvl) { return Math.floor(9 + (lvl - 1) * 7.5 + Math.pow(Math.max(0, lvl - 1), 1.72) * 2.6); }

  // sustain & rewards when a foe dies (on-kill boons)
  onKill(e, def) {
    const s = this.stats;
    if (s.lifeOnKill) this.wizard.heal(s.lifeOnKill);
    if (s.manaOnKill) this.wizard.mana = Math.min(s.manaMax, this.wizard.mana + s.manaOnKill);
    // ---- kill-combo: stack kills inside a short window for escalating reward + juice ----
    this.combo = (this.combo || 0) + 1;
    this.comboT = 3.2;                                   // time before the chain lapses
    if (this.combo > (this.comboBest || 0)) this.comboBest = this.combo;
    if (this.combo >= 3) this.ui.showCombo(this.combo);
    if (this.combo >= 5 && this.combo % 5 === 0) this._comboMilestone(e);
  }

  // a satisfying pop each 5-kill milestone — escalating shake/particles + a sip of mana reward
  _comboMilestone(e) {
    const tier = Math.min(4, Math.floor(this.combo / 5));
    this.audio.play('xp');
    this.shake(0.4 + tier * 0.12);
    const p = (e && e.mesh) ? e.mesh.position.clone().setY(1) : this.wizard.pos.clone().setY(1.4);
    this.particles.ring({ pos: p, color: 0xffb454, r0: 0.4, r1: 2 + tier, life: 0.5 });
    this.particles.burst({ pos: p, color: 0xffd98a, count: 10 + tier * 4, speed: 6, size: 0.3, life: 0.7, blend: 'add' });
    this.wizard.mana = Math.min(this.stats.manaMax, this.wizard.mana + 6); // chaining is rewarded
    if (this.combo >= 15) this._hitstop(0.08);           // a beat of weight on big chains
    this.ui.burstFX({ x: window.innerWidth / 2, y: window.innerHeight * 0.15 }, 'fire', 8 + tier * 3);
    // a punchy named call-out at each escalating tier
    const cry = document.getElementById('streak-cry');
    if (cry) { cry.textContent = ['NICE!', 'RAMPAGE!', 'UNSTOPPABLE!', 'GODLIKE!'][Math.min(3, tier - 1)] || 'GODLIKE!'; cry.classList.remove('show'); void cry.offsetWidth; cry.classList.add('show'); }
  }
  _hitstop(dur) { this._hitstopT = Math.max(this._hitstopT || 0, dur); }
  breakCombo() { if (this.combo > 0) { this.combo = 0; this.comboT = 0; this.ui.hideCombo(); } }

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
    // level-up flourish: a golden fountain of motes + a ground ring + a screen-space pop
    const lp = this.wizard.pos.clone().setY(1.2);
    this.particles.burst({ pos: lp, color: 0xffd97a, count: 26, speed: 5, size: 0.28, life: 1.0, up: 5.5, grav: 5, blend: 'add', floor: false, fadePow: 1.4 });
    this.particles.ring({ pos: this.wizard.pos.clone().setY(0.1), color: 0xffd97a, r0: 0.4, r1: 4.5, life: 0.6 });
    if (this.ui.burstFX) this.ui.burstFX({ x: window.innerWidth / 2, y: window.innerHeight * 0.42 }, 'sparkle', 14);
    this.shake(0.5);
    const choices = rollUpgrades(this, 3);
    this.ui.showLevelUp(choices, (u) => {
      this.applyAbility(u);
      // every level-up also patches you up a bit — keeps runs generous & moreish
      this.wizard.heal(Math.round(this.stats.hpMax * 0.2));
      this.pendingLevels--;
      if (this.pendingLevels > 0) this._openLevelUp();
      else this.state = 'play';
    });
  }

  // a one-off ability pick (rune shrines)
  offerUpgrade(onPicked) {
    this.state = 'levelup';
    this.audio.play('levelup');
    const choices = rollUpgrades(this, 3);
    this.ui.showLevelUp(choices, (u) => { this.applyAbility(u); if (onPicked) onPicked(); });
  }

  // ---------- pickups (each drop is a readable little model, not an abstract blob) ----------
  _getPickup(type) {
    const pool = this._pickupPool[type];
    if (pool.length) { const m = pool.pop(); m.visible = true; return m; }
    let mesh;
    if (type === 'xp') mesh = new THREE.Mesh(this._xpGeo, this._xpMat);
    else if (type === 'heart') mesh = this._buildHeartPickup();
    else if (type === 'mana') mesh = this._buildManaPickup();
    else mesh = this._buildChestPickup();
    this.scene.add(mesh);
    return mesh;
  }
  // a plump little heart: two lobes + a point
  _buildHeartPickup() {
    const g = new THREE.Group(); const m = this._heartMat;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.34, 8), m); tip.rotation.x = Math.PI; tip.position.y = 0.1; tip.castShadow = true;
    const lL = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 10), m); lL.position.set(-0.1, 0.3, 0);
    const lR = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 10), m); lR.position.set(0.1, 0.3, 0);
    g.add(tip, lL, lR);
    return g;
  }
  // a corked mana flask with glowing liquid
  _buildManaPickup() {
    const g = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ color: 0xaadcf0, roughness: 0.15, transparent: true, opacity: 0.55 });
    const liquid = new THREE.MeshStandardMaterial({ color: 0x56b8ff, emissive: 0x1c78c8, emissiveIntensity: 0.8, roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), glass); body.position.y = 0.18;
    const liq = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 10), liquid); liq.position.y = 0.15;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.15, 8), glass); neck.position.y = 0.4;
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.9 })); cork.position.y = 0.5;
    body.castShadow = true;
    g.add(body, liq, neck, cork);
    return g;
  }
  // gear drops land as a little banded treasure chest
  _buildChestPickup() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.8 });
    const wood2 = new THREE.MeshStandardMaterial({ color: 0xa4703c, roughness: 0.75 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.5, roughness: 0.3, emissive: 0x5a4400 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.36), wood); base.position.y = 0.14; base.castShadow = true;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 10, 1, false, 0, Math.PI), wood2);
    lid.rotation.z = Math.PI / 2; lid.position.y = 0.28; lid.castShadow = true;
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.38), gold); strapL.position.set(-0.15, 0.15, 0);
    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.38), gold); strapR.position.set(0.15, 0.15, 0);
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.05), gold); latch.position.set(0, 0.2, 0.19);
    g.add(base, lid, strapL, strapR, latch);
    return g;
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
  // on-kill drops are ONLY in-combat restores now (HP / mana). No auto gems or gear —
  // you claim gems by beating a stage / finishing a quest, and gear by breaking the chest.
  enemyDrop(pos, def) {
    if (def.boss) { this.spawnHeart(pos.clone()); return; }
    const big = def.size >= 1.4;
    const r = Math.random();
    if (r < (big ? 0.34 : 0.08)) this.spawnHeart(pos);
    else if (r < (big ? 0.56 : 0.16)) this.spawnMana(pos);
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
        if (it.mesh.position.y <= 0.4) {
          it.mesh.position.y = 0.4; it.grounded = true;
          // a bouncy landing pop for the meaningful drops (XP motes rain too thickly)
          if (it.type !== 'xp') { it.landT = 0.22; this.particles.ring({ pos: it.mesh.position.clone().setY(0.12), color: it.type === 'gear' ? 0xffd98a : 0xffffff, r0: 0.15, r1: 0.8, life: 0.3 }); }
        }
      }
      // magnet
      if (d < rad + (it.type === 'heart' ? 0.5 : 0)) {
        const pull = 14 + (rad - d) * 6;
        it.mesh.position.x += (dx / (d || 1)) * pull * dt;
        it.mesh.position.z += (dz / (d || 1)) * pull * dt;
      }
      it.mesh.position.y = 0.4 + Math.sin(it.phase) * 0.08;
      it.mesh.rotation.y += dt * 3;
      if (it.landT > 0) { it.landT -= dt; const k = Math.max(0, it.landT) / 0.22; it.mesh.scale.set(1 + 0.5 * k, 1 - 0.4 * k, 1 + 0.5 * k); }
      else it.mesh.scale.set(1, 1, 1);
      // chests glint on the ground so loot is never missed
      if (it.type === 'gear' && Math.random() < dt * 2.5) this.particles.burst({ pos: it.mesh.position.clone().setY(0.5), color: 0xffe08a, count: 1, speed: 1.2, size: 0.12, life: 0.6, grav: 2, blend: 'add' });

      if (d < 1.0) {
        // a collect pop so every vacuumed drop reads (kept feather-light for XP rain)
        const pc = it.type === 'xp' ? 0x6ee7a0 : it.type === 'heart' ? 0xff5d6c : it.type === 'mana' ? 0x56b8ff : 0xffd98a;
        this.particles.burst({ pos: it.mesh.position.clone().setY(0.6), color: pc, count: it.type === 'xp' ? 2 : 8, speed: 3, size: 0.14, life: 0.4, grav: -2, blend: 'add' });
        if (it.type !== 'xp') {
          this.particles.ring({ pos: it.mesh.position.clone().setY(0.15), color: pc, r0: 0.2, r1: 1.1, life: 0.3 });
          // a little streak of motes flies from the pickup into the wizard
          this.particles.streak(it.mesh.position.clone().setY(0.6), this.wizard.pos.clone().setY(1.1), { color: pc, count: 6, life: 0.4, size: 0.14 });
        }
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
  // returning to the hub: don't strand motes on the arena floor. Run XP doesn't carry
  // between runs (reset in enterArena), so just clear those; auto-collect dropped GEAR
  // though — that persists. (meta.addGear saves itself; no level-up popup in the hub.)
  _bankAndClearPickups() {
    for (const it of this.pickups) {
      if (it.type === 'gear') meta.addGear(it.gear);
      it.mesh.visible = false; this._pickupPool[it.type].push(it.mesh);
    }
    this.pickups.length = 0;
  }

  // ---------- effects helpers used by subsystems ----------
  shake(a) { if (this.shakeEnabled === false) return; this.shakeAmt = Math.min(3.2, this.shakeAmt + a); }
  // ranged enemies fire a hostile projectile at the wizard through the spell system
  spawnHostileOrb(from, dir, dmg) { if (this.spells) this.spells.spawnHostile(from, dir, dmg); }

  popDamage(worldPos, n) {
    const v = worldPos.clone(); v.y += 1.2;
    v.project(this.camera);
    if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const crit = n >= 24; // big hits pop bigger & gold
    const scale = Math.min(2.1, 0.9 + n / 34);            // Megabonk numbers: the harder the hit, the fatter the digits
    this.ui.floatNumber(x, y, Math.round(n), crit ? '#ffd36b' : '#ffe08a', crit, scale);
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
    this.showStory('Wisp', [`Nice work, that ${name} is done. Even drunk, you can multitask.`]);
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
    // boss-arrival shockwave: twin ground rings + a heavy dust ejecta at its feet
    if (e) {
      const bp = e.mesh.position.clone();
      this.particles.ring({ pos: bp.clone().setY(0.12), color: 0xff5a8a, r0: 0.5, r1: 10, life: 0.75 });
      this.particles.ring({ pos: bp.clone().setY(0.12), color: 0xffffff, r0: 0.3, r1: 5.5, life: 0.5 });
      this.particles.burst({ pos: bp.setY(1.2), color: 0xff5a8a, count: 30, speed: 9, size: 0.42, life: 1.0, up: 4, blend: 'normal' });
    }
    this.bossCine = 2.8; // dramatic focus + slow-mo
    this.shake(2);
    this.ui.bossBanner(stage.bossName);
    this.audio.play('gameover'); // ominous sting
  }

  // mark a mechanic as tried (fills the quest-log checklist) and let the wisp teach it the first time
  _learn(id, tip) { if (meta.markSeen(id) && tip && this.ui) this.ui.wispSay(tip); }

  onBossDead() {
    if (this._drinking) this._cancelDrink();
    this.bossActive = false; this.bossKilled = true; this._roomsCleared = this._forksTotal + 2;
    this._awardStageStars(STAGES_PER_REGION); // ⭐ the boss lair is the region's final level
    meta.bumpStat('bossKills', 1); // feeds the "defeat a boss" side quest
    this._hitstop(0.13); this.shake(1.4); // a big satisfying beat on the kill
    this._learn('boss', 'Boss down! It dropped an artifact and gemstones. Carry artifacts from your satchel into a run.');
    const nu = meta.unlockRandomUpgrade(); if (nu) { if (this._unlockedUpg) this._unlockedUpg.add(nu.id); this.ui.toast(`✨ New boon unlocked: ${nu.icon} ${nu.name}!`); } // achievement: bosses teach new boons
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
    this.shake(1.2);
    this.ui.deathTumble(() => this._showEnd(false)); // comedic spin-to-black, THEN the results
  }
  // backwards-compat alias used by the wizard-death check
  _lose() { this._loseRun(); }

  _showEnd(win) {
    if (win && this.stage) meta.markStageCleared(this.stage.id); // opens the next haunt on the world map
    if (win && !meta.tavernOwned()) { meta.setTavernOwned(true); this._justInherited = true; } // avenge -> inherit
    this.ui.hideCombo();
    const depth = this._roomsCleared || 0; // rooms cleared (boss = forks+2)
    // ventures pay in 💎 GEMS (gold is earned only by WORKING), plus a guaranteed boss gear drop
    // escalating bonuses make a deeper, hotter-streak run pay off — the "one more run" pull
    const waveBonus = Math.pow(1.07, Math.max(0, depth - 1));
    const comboBonus = 1 + Math.min(0.5, (this.comboBest || 0) * 0.01);
    const cardGemMult = (this.cardPerks && this.cardPerks.gemMult) || 1; // collectible-card bonus
    const gemReward = Math.max(1, Math.round((2 + depth * 1.2 + this.kills * 0.05 + (win ? 5 : 0)) * meta.gemBonusMult() * waveBonus * comboBonus * cardGemMult * meta.petGemMult()));
    meta.addGems(gemReward); // gems come from beating a stage (kept) — but NO auto gear anymore
    const earnedGems = Math.max(0, meta.gems() - (this._runGemStart || 0));
    const questDone = meta.evaluateQuest({ kills: this.kills, time: Math.floor(this.elapsed), wave: depth, bossKilled: this.bossKilled, win });
    const finishedResearch = meta.advanceDay(); // a venture spends a day (and ticks research)
    meta.save();
    this.ui.closeModals();
    this.ui.setScreen('end');
    const stagesReached = win ? STAGES_PER_REGION : Math.min(STAGES_PER_REGION, (this._forksDone || 0) + 1);
    this.ui.showResults(win, {
      nodes: depth, rooms: depth, kills: this.kills, level: this.level, stage: this.stage ? this.stage.name : '',
      stages: stagesReached, stagesTotal: STAGES_PER_REGION, missions: this._missionsWon || 0,
      artifact: win && this.runArtifacts.length ? this.runArtifacts[this.runArtifacts.length - 1].name : null,
      earnedGems, gems: meta.gems(), day: meta.currentDay(), combo: this.comboBest || 0,
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

    if (!this._opened && !meta.introSeen()) {
      // FIRST TIME ONLY (per save): a chain of real cutscenes — get drunk, wreck the bar
      // (QTE), get hurled out, wake in the forest with the wisp — then the guided fight.
      // Persisted so it never replays on later launches.
      this._opened = true; this._hubShown = false;
      this.cine.play('drunk', () =>
        this.cine.play('rampage', () =>
          this.cine.play('thrown', () =>
            this.cine.play('wisp', () => { meta.setIntroSeen(); this._introRun = true; this.enterArena(STAGES.forest); })))); // mark seen only once it's actually played through
    } else {
      // already seen the opening (or returning) — drop straight into the tavern hub
      this._opened = true;
      this.enterTavern();
    }
  }

  // ---- the Tavern hub: roam (drunkenly), shop at stations, leave via the door ----
  enterTavern() {
    this.phase = 'tavern';
    this._setPixel('menu'); // chunkier pixel look in the hub
    this._exiting = false;
    this.nearStation = null;
    this._bankAndClearPickups(); // no stray XP motes / loot left floating in the bar after a run
    this.storyQueue.length = 0; this.storyShowing = false;
    this.ui.closeModals();
    this.ui.setStageTint(null); this.ui.hideMission(); // drop any arena stage colour/mission HUD
    this._stageMods = null;
    this._runMap = null; this._mapNodeId = null; // a fresh map is rolled for the next venture
    if (this.ui.hideRunMap) this.ui.hideRunMap();
    this._chatNpc = null; this._chatStation = null; if (this.ui.hideChat) this.ui.hideChat();
    this._tipped = new Set(); // regular-patron coin tips reset each visit
    this.ui.fadeBlack(false);
    this.ui.setScreen('play');
    this.stats = DEFAULT_STATS();
    this.stats.wobble = 0.9;        // tipsy but steerable enough to shop
    this.drunkenness = 0.45;        // you spawn here good and sloshed — hence the queasy nausea swim
    this._drunkSurge = 0;
    this.tavern.reset();
    this.tavern.resetTables();       // seat fresh patrons & clear any half-poured order
    meta.refreshCustomers(2);        // top up walk-in quest-givers
    this.tavern.setupCustomers(meta.customerQuests()); // unique customers who roam & give quests
    this.tavern.refreshRoom(meta);
    this.tavern.show(true);
    this.tavern.showRoom(false);
    this.arenaGroup.visible = false;
    this.world.show(false);
    this.input.pointMode = false;
    this.wizard.reset(this.stats);
    this.wizard.setEquipment(meta.equippedGearFull()); // show worn gear in the hub too
    this.wizard.setVisible(true);
    this.wizard.pos.copy(this.tavern.start);
    this.aimPoint.set(this.tavern.door.x, 0, this.tavern.door.z);
    this.camOffset.set(0, 18, 16); this.resetCamera();
    this._setMood('tavern');
    this._aimShadow(14, 24, 10, 16); // tight frustum so the bar casts crisp contact shadows
    this.ui.setPhase('tavern', this.input.isTouch);
    this.ui.setGold(meta.gold());
    this.state = 'play';
    if (!this._hubShown) {
      // first time in the hub — point at the quest log + satchel buttons (top-right)
      this._hubShown = true; this._introShown = true;
      setTimeout(() => { if (this.phase === 'tavern') this.ui.wispSay('Tap 📜 quests and 🎒 satchel any time.', { big: true, ms: 5200 }); }, 900);
    }
    if (this._giftGear) {
      // present the intro-fight gear gift once the dust settles (it's already worn)
      const g0 = this._giftGear; this._giftGear = null;
      setTimeout(() => { if (this.phase === 'tavern') { this.ui.lootToast(g0); this.audio.play('levelup'); this.ui.wispSay('🎁 Looted you a staff! Manage gear in the Character Hall.', { big: true, ms: 5000 }); } }, 6400);
    }
    this.tavernReady = true;
    this._learn('customer', '🧑 Walk up (E) to chat: ❗ = quest, 💬 = coin tip.');
    if (this._justInherited) {
      this._justInherited = false;
      this.showStory('Wisp', [
        'You did it. The brute that ambushed old Barkeep Tomas lies in pieces.',
        'Tomas had no family, and a wizard who avenges him is family enough. The Tipsy Toad is yours now.',
        'Run the place! It earns coin even while you are out causing mayhem. Manage it at the Ledger.',
      ]);
    } else if (meta.tavernOwned() && meta.tavernBank() > 0) {
      this.ui.wispSay(`🍺 The Toad earned ${meta.tavernBank()} gold. Collect it at the Ledger.`);
    }
  }

  interact() {
    if (this.state !== 'play' || !this.nearStation) return;
    const s = this.nearStation, t = s.type;
    this.audio.play('click');
    if (this.phase === 'tavern') {
      if (t === 'door') { this.openWorldMap(); return; }
      if (t === 'stairs') { this.goUpstairs(); return; }
      if (t === 'customer') { this.startChat(s); return; }
    } else if (this.phase === 'room') {
      if (t === 'down') { this.goDownstairs(); return; }
      if (t === 'rest') { this.restAtBed(); return; }
      if (t === 'station') { this._openShop(s.kind); return; }
    }
  }

  _openShop(kind) { this._shopKind = kind; this.state = 'menu'; this.ui.openShop(kind, this); }

  // ---- cinematic tavern chat: walk up to a roaming patron, the camera frames them,
  // and you chat to take a quest (❗) or get a coin tip from a regular (💬) ----
  startChat(station) {
    const npc = station && station.npc; if (!npc) return;
    this._chatNpc = npc; this._chatStation = station; this._chatAsked = false;
    this.state = 'chat';
    this.audio.play('click');
    this.ui.showChat(this, station);
  }
  // dialogue choice: accept the offered job (RPG accept flow — only accepted quests log)
  chatAccept() {
    const st = this._chatStation; if (!st || !st.quest) return;
    if (meta.acceptCustomerQuest(st.quest.id)) { this.audio.play('levelup'); this.ui.chatResult(this, '"You\'ll take it on? Bless you, wizard — come back when it\'s done."', ''); }
  }
  // dialogue choice: "tell me more" — the patron elaborates, then the choices return
  chatAsk() { this._chatAsked = true; if (this._chatStation) this.ui.showChat(this, this._chatStation); }
  // the player pressed the main button in a chat
  chatClaim() {
    const st = this._chatStation; if (!st) return;
    if (st.quest) {
      const res = meta.claimCustomerQuest(st.quest.id);
      if (!res) { this.ui.wispSay('You can\'t fulfil that just yet.', { tone: 'warn' }); return; }
      const r = res.reward; const bits = [r.gold ? `+${r.gold}🪙` : '', r.gems ? `+${r.gems}💎` : ''].filter(Boolean).join(' ');
      this.audio.play('win'); this.ui.setGold(meta.gold()); this.ui.setGems(meta.gems());
      this._chatClaimed = true;
      this.ui.chatResult(this, `"Bless you, wizard! ${bits}."`, `🎁 ${bits}`);
    } else {
      // a regular's coin tip — once per visit (the bar's gold trickle now)
      if (!this._tipped) this._tipped = new Set();
      const id = (st.npc && st.npc.regularId) || 'reg';
      if (this._tipped.has(id)) { this.ui.chatResult(this, '"Already shared my coppers, friend. Off you pop!"', ''); return; }
      this._tipped.add(id);
      const tip = 6 + Math.floor(Math.random() * 5);
      meta.addGold(tip); this.ui.setGold(meta.gold()); this.audio.play('levelup');
      this._learn('work', 'Chat up the regulars (💬) for coin, and take the quest-givers\' (❗) requests. That\'s how the Toad earns now.');
      this.ui.chatResult(this, `"Cheers, lad! Here's ${tip} coppers."`, `🪙 +${tip}`);
    }
  }
  endChat() {
    const claimed = this._chatClaimed; this._chatClaimed = false; this._chatAsked = false;
    this._chatNpc = null; this._chatStation = null;
    this.ui.hideChat();
    if (this.state === 'chat') this.state = 'play';
    this.nearStation = null;
    if (claimed) { meta.refreshCustomers(2); this.tavern.setupCustomers(meta.customerQuests()); } // a fresh face wanders in
  }

  // ---- the 3D top-down WORLD MAP: scout a region, then venture straight in ----
  openWorldMap() {
    this.phase = 'world'; this.state = 'world'; this._worldDive = false; this._setPixel('menu');
    this.world.refresh((id) => this._stageUnlocked(id), (id) => meta.stageCleared(id));
    this.tavern.show(false); this.tavern.showRoom(false); this.arenaGroup.visible = false;
    this.world.show(true);
    this.wizard.setVisible(false);
    this.input.pointMode = true;
    this.scene.background.setHex(0x0a1424); this.scene.fog.color.setHex(0x0e1a2c); this.scene.fog.density = 0.003; // clear night air — the map must READ
    this.hemi.color.setHex(0xbfd0ff); this.hemi.groundColor.setHex(0x2a3a4a); this.hemi.intensity = 1.15;
    this.dir.color.setHex(0xffffff); this.dir.intensity = 1.45; this.ambient.color.setHex(0x44506a); this.ambient.intensity = 0.7;
    this.rim.color.setHex(0xbfe0ff); this.rim.intensity = 1.0;
    if (this.heroLight) this.heroLight.intensity = 0;
    this.renderer.toneMappingExposure = 1.1;
    if (this._gradePass) { const u = this._gradePass.uniforms; // moody storybook grade for the map
      u.uContrast.value = 1.11; u.uSaturation.value = 1.17;
      u.uShadowTint.value.set(0.89, 0.94, 1.07); u.uHighlightTint.value.set(1.05, 1.02, 0.94);
      u.uTintStrength.value = 0.28; u.uVignette.value = 0.38; u.uVignetteSoft.value = 0.58;
      u.uGrain.value = 0.014;
    }
    this._aimShadow(20, 40, 14, 40); // medium frustum for the world-map islands
    let sel = this.world.order[0];
    for (const id of this.world.order) if (this._stageUnlocked(id)) sel = id;
    this._worldSel = sel; this.world.select(sel);
    this.ui.setScreen('play'); this.ui.setPhase('world', this.input.isTouch);
    this.ui.showWorldHud(this, sel);
    this.ui.setGold(meta.gold());
  }
  _stageUnlocked(id) { const o = this.world.order, i = o.indexOf(id); return i <= 0 || meta.regionUnlockedByStars(i); }
  // tap a region → if it's open, DIVE straight in (camera plunge → 3D level map);
  // if it's locked, just highlight it and explain the star gate.
  selectWorldRegion(id) {
    if (!id || this._worldDive) return;
    this._worldSel = id; this.world.select(id); this.ui.showWorldHud(this, id);
    if (!this._stageUnlocked(id)) {
      this.audio.play('hiccup');
      const i = this.world.order.indexOf(id);
      this.ui.wispSay(`🔒 Need ⭐ ${meta.regionStarReq(i)} stars (${meta.totalStars()} so far).`, { tone: 'warn' });
      return;
    }
    this._diveIntoRegion(id);
  }
  ventureSelected() {
    const id = this._worldSel;
    if (!id || !this._stageUnlocked(id)) {
      const i = this.world.order.indexOf(id);
      this.ui.wispSay(`🔒 Earn ⭐ ${meta.regionStarReq(i)} stars to open this region — you have ${meta.totalStars()}. Win levels (with high HP) for more stars!`, { tone: 'warn' });
      return;
    }
    this._diveIntoRegion(id);
  }
  // cinematic plunge from the realm map into the chosen island, then the 3D level map
  _diveIntoRegion(id) {
    this.ui.hideWorldHud(); this.input.pointMode = false;
    this._worldSel = id; this.world.select(id); this._worldDive = true; this.audio.play('jobDone');
    setTimeout(() => { this._worldDive = false; this.ui.wipe('iris', () => this.openRegionMap(id)); }, 820);
  }
  closeWorldMap() { this.ui.hideWorldHud(); this.world.show(false); this.input.pointMode = false; this.enterTavern(); }
  openBuild() { if (this.state === 'play' && this.phase === 'room') { this.audio.play('click'); this._openShop('build'); } }
  // ---- in-world building: the ROOM is the grid. Hover the floor to preview a hologram of
  // the selected piece snapped to a cell; click to place; rotate before placing. ----
  _inBuild() { return this.state === 'menu' && this.ui && this.ui._shopKind === 'build'; }
  _buildCellAt(cx, cy) {
    const ndc = { x: (cx / window.innerWidth) * 2 - 1, y: -(cy / window.innerHeight) * 2 + 1 };
    this._ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(this._groundPlane, hit)) return null;
    const G = this.tavern._roomGrid;
    const gx = Math.round((hit.x - G.ox) / G.cell), gy = Math.round((hit.z - G.oz) / G.cell);
    if (gx < 0 || gy < 0 || gx >= meta.ROOM_GW || gy >= meta.ROOM_GH) return null;
    return { gx, gy };
  }
  buildHover(cx, cy) {
    if (!this._inBuild()) return;
    if (this.ui._buildPending) return; // a piece is parked awaiting Confirm — it stays put
    const sel = this.ui._buildSel;
    if (!sel) { this.tavern.hideGhost(); return; }
    const c = this._buildCellAt(cx, cy);
    if (!c) { this.tavern.hideGhost(); return; }
    const b = meta.buildableById(sel);
    const valid = !!b && !meta.cellOccupied(c.gx, c.gy) && meta.canAfford(b.cost);
    this.tavern.showGhost(sel, c.gx, c.gy, this.ui._buildRot || 0, valid);
  }
  // clicking the floor now PARKS the piece (awaiting Confirm) instead of building instantly.
  // clicking a built piece still sells it immediately; clicking a new tile re-parks (move it).
  buildPlaceAt(cx, cy) {
    if (!this._inBuild()) return;
    const c = this._buildCellAt(cx, cy);
    if (!c) return;
    if (meta.cellOccupied(c.gx, c.gy)) { this.ui._buildPending = null; this.ui._shopAction('place', c.gx + '_' + c.gy); return; } // sell back
    const sel = this.ui._buildSel; if (!sel) return;
    const b = meta.buildableById(sel);
    if (!b || !meta.canAfford(b.cost)) { this.audio.play('hiccup'); return; }
    // park the hologram here, lit as "ready", and surface the Confirm / Cancel bar
    this.ui._buildPending = { gx: c.gx, gy: c.gy };
    this.tavern.showGhost(sel, c.gx, c.gy, this.ui._buildRot || 0, true);
    this.audio.play('click');
    this.particles && null; // (no arena particles in room scene)
    this.ui._renderShop();
  }
  // COMMIT the parked piece: it raises inside a magic hologram over its build timer
  confirmBuild() {
    if (!this._inBuild()) return;
    const p = this.ui._buildPending; if (!p) return;
    this.ui._buildPending = null;
    this.ui._shopAction('place', p.gx + '_' + p.gy); // places + beginConstruct (hologram + timer)
    this.tavern.hideGhost();
  }
  cancelBuildPlacement() {
    if (!this.ui._buildPending) return;
    this.ui._buildPending = null;
    this.tavern.hideGhost();
    if (this.audio) this.audio.play('click');
    this.ui._renderShop();
  }
  rotateBuild() {
    this.ui._buildRot = (((this.ui._buildRot || 0) + Math.PI / 2) % (Math.PI * 2));
    if (this.audio) this.audio.play('click');
    const p = this.ui._buildPending; // spin the parked hologram in place
    if (p && this.ui._buildSel) this.tavern.showGhost(this.ui._buildSel, p.gx, p.gy, this.ui._buildRot, true);
  }
  restAtBed() { if (meta.rest()) this.ui.toast('🛏 Rested — you\'ll wake with +HP for the next run'); else this.ui.wispSay('🛏 You\'re already well-rested.', { tone: 'warn' }); }

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
    this.phase = 'room'; this.state = 'play'; this._setPixel('menu');
    this.nearStation = null; this.input.pointMode = false;
    this.tavern.refreshRoom(meta);
    this.tavern.show(false); this.tavern.showRoom(true);
    this.arenaGroup.visible = false; this.world.show(false);
    this.wizard.setVisible(true);
    this.stats = DEFAULT_STATS(); this.stats.wobble = 0.9;
    this.wizard.reset(this.stats);
    this.wizard.setEquipment(meta.equippedGearFull());
    this.wizard.pos.copy(this.tavern.roomStart);
    this.aimPoint.set(this.tavern.roomStart.x, 0, this.tavern.roomStart.z - 3);
    this.camOffset.set(0, 13, 13); this.resetCamera();
    this._setMood('tavern');
    this._aimShadow(8, 16, 6, 10); // tight frustum for the small room scene
    this.ui.setPhase('room', this.input.isTouch);
    this.ui.setScreen('play');
    this.ui.setGold(meta.gold());
  }

  // a customer served in the in-world bar loop — pay the tip; every 3 served is a day's work
  onTavernServe() {
    const tip = 5 + Math.floor(Math.random() * 4); // 5–8 gold (work the bar a while to pay the debt)
    meta.addGold(tip); meta.save();
    this.ui.setGold(meta.gold());
    this.audio.play('levelup');
    this._learn('work', 'Tip earned! Keep serving to pay off your debt. Track it in your quest log.');
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
    this.showStory('Wobblesworth', [
      'The last coin drops into the box. The debt is paid in full.',
      'The Tipsy Toad is mine now, free and clear. No more creditors, no more scolding.',
      'Now I drink, I brawl, and I get rich. To glorious mayhem!',
    ]);
  }
  startRun(stageId) { this._shopKind = null; this.beginRun(stageId); }
  closeShop() {
    if (this._chatNpc) this.endChat(); // self-heal: never leave a chat orphaned behind a menu
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
    this.ui.wipe('fade');   // a clean fade as you venture out
    this.ui.fadeBlack(true);
    setTimeout(() => {
      this.showStory(BLACKOUT_LINES.speaker, BLACKOUT_LINES.lines, () => this.enterArena(this._pendingStage));
    }, 1250);
  }

  // ---- one full level: a long survival fight, six waves then the boss ----
  enterArena(stage) {
    this.stage = stage; this.phase = 'arena';
    this._setPixel('arena'); // subtle pixelation during the fight (legible action)
    this.stats = DEFAULT_STATS();
    if (meta.consumeRest()) this.stats.hpMax += meta.REST_BONUS + meta.roomComfort() * 4; // a good night's rest, comfier room = more
    this._applyEquipment();
    this._spawnPetCompanion(); // 🐾 the carried creature joins the fight
    meta.applyResearch(this.stats); // completed research bonuses
    meta.applyBrews(this.stats);    // brewed-potion boons (permanent)
    // collectible-card passives (tiny): folded once per run
    const cp = applyCardPerks(this, meta.cardsOwned());
    if (cp.dmgMult !== 1) this.stats.damageMult = (this.stats.damageMult || 1) * cp.dmgMult;
    if (cp.manaBonus) this.stats.manaMax += cp.manaBonus;
    this.loadout = meta.getLoadout();
    this.unlocked = new Set(this.loadout);
    this._archetype = null; // playstyle pick removed — your build = collected cards + run upgrades
    this.activeCombos = meta.activeCombos(this.unlocked);
    this.recognizer = new Recognizer();
    for (const id of this.loadout) { const g = SPELLS[id].gesture; this.recognizer.add(g, TEMPLATES[g]); }
    this.level = 1; this.xp = 0; this.xpNeed = this._xpForLevel(1);
    this.kills = 0; this.chores = 0; this.pendingLevels = 0; this.elapsed = 0;
    this.combo = 0; this.comboBest = 0; this.comboT = 0; this._hitstopT = 0; if (this.ui) this.ui.hideCombo();
    this.drunkenness = 0.22; this._drunkSurge = 0; this._drinkCd = 0; this._drinking = false;
    this._artifactsTaken = new Set(meta.ownedArtifacts()); // don't re-drop ones you already own
    this._deckOff = new Set(meta.deckOffIds());             // your curated level-up deck
    this._unlockedUpg = new Set(meta.unlockedUpgradeIds()); // RPG unlock graph: only earned boons roll
    // ---- the run path: an entrance fight, then a left/right fork before each step
    // (combat / treasure / campfire / choice-event / skill-trial, Slay-the-Spire
    // style), then the boss + a guaranteed OP artifact previewed at the boss fork ----
    // a region is a ten-stage ladder: stage 1 = entrance, 10 = boss lair, 2–9 = forks.
    this._forksTotal = STAGES_PER_REGION - 2; // 8 forks: entrance(1) + 8 + boss(1) = 10 stages
    this._forksDone = 0;            // forks resolved so far (stageNum = _forksDone + 1)
    this._lastMerchantFork = -1;    // guards the wandering-merchant visit (every 3 forks)
    this._stageMods = null;         // per-stage gimmick mods read by enemies.js (speed/dmg)
    this._mission = null;           // the current stage's optional mission (bonus 💎)
    this._stageNoHit = true;        // tracks the no-hit mission across the stage
    this._stageComboPeak = 0;       // tracks the best combo for slayer missions
    this._stageStartT = 0;          // elapsed-time stamp for speed missions
    this._missionsWon = 0;          // stage missions cleared this run (for the results screen)
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
    this.enemies.clear(); this.spells.reset(); this._clearPickups(); this.director.reset(); this._disposeLootChest();
    this.world.show(false); this.tavern.show(false); this.tavern.showRoom(false); this.arenaGroup.visible = true;
    this.wizard.setVisible(true);
    this.wizard.reset(this.stats); this.wizard.pos.set(0, 0, 0);
    this.input.pointMode = false;
    this.camOffset.set(0, 27, 22); this.resetCamera();
    this._applyStageTheme(stage);
    this._spawnShrine();         // a rune shrine: draw a glyph at it to channel a relic
    this._spawnWisp();           // your glowing wisp guide-pet drifts along
    this.ui.setPhase('arena', this.input.isTouch);
    this.ui.setLoadout(this.loadout);
    this.ui.setScreen('play');
    this.ui.hideJob(); this.ui.closeModals(); this.ui.fadeBlack(false);
    this.ui.setGold(meta.gold());
    this.state = 'play';
    document.body.classList.remove('paused'); // never carry a stale pause dim into a fight
    if (this.ui.wispSay) this.ui.wispSay('⚔ Clear the waves — the boss guards an ✦ artifact.', { ms: 3600 });
    if (this._introRun) {
      // the wisp's cutscene already taught casting & mana — drop straight into the guided fight
      this.director.start(stage, { waves: 3, boss: false, hpScale: 0.9, sizeMult: 0.85 });
      this._guideShown = true;
      return;
    }
    this._beginRoom(false); // the entrance fight (no choice before it)
    this.showStory('Wisp', stage.intro);
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
    // your FIRST piece of gear — auto-worn, so the very first hub visit shows a
    // glowing staff in hand and teaches "loot changes how you look"
    const first = meta.genGear('staff', 'rare', 1);
    meta.addGear(first); meta.equipGear(first.id); meta.save();
    this._giftGear = first;
    this.state = 'blackout'; this.ui.fadeBlack(true); this.audio.play('win');
    setTimeout(() => this.cine.play('scold', () => this.enterTavern()), 900);
  }

  // ---- run path: a left/right fork before each step. Nodes are typed
  // (combat / elite / treasure / campfire / choice-event / skill-trial), Slay-the-
  // Spire style; the door previews what waits. The last fork leads to the boss. ----
  _beginRoom(isBoss, elite) {
    // descending from the 3D level map — bring the arena scene + combat HUD back on screen
    if (this.phase !== 'arena') { this.levelMap.show(false); if (this.ui.hideMapHud) this.ui.hideMapHud(); this.arenaGroup.visible = true; this.wizard.setVisible(true); this._restoreArenaLook(); this._setPixel('arena'); this.phase = 'arena'; this.ui.setPhase('arena', this.input.isTouch); }
    // which of the region's ten stages is this? (1 = entrance … 10 = boss lair)
    const stageNum = isBoss ? STAGES_PER_REGION : Math.min(STAGES_PER_REGION, this._forksDone + 1);
    const gim = gimmickFor(stageNum);
    this._stageMods = { speedMult: gim.speedMult, dmgMult: gim.dmgMult }; // read live by enemies.js
    const baseScale = (1 + this._forksDone * 0.12) * (elite ? 1.5 : 1);
    const scale = baseScale * gim.hpMult;
    const sizeMult = (1 + this._forksDone * 0.06 + (elite ? 0.2 : 0)) * gim.spawnMult;
    this.director.start(this.stage, { waves: isBoss ? 1 : 2, boss: isBoss, hpScale: scale, sizeMult });
    this.shake(0.45); this.wizard.squash(0.2, 1, 0.22); // a landing thump on stage entry
    // arrival poof: a ground dust ring + radial dust kicked up under the wizard
    if (this.particles) {
      const wp = this.wizard.pos.clone();
      this.particles.ring({ pos: wp.clone().setY(0.1), color: 0xece3cf, r0: 0.3, r1: 4, life: 0.5 });
      this.particles.burst({ pos: wp.setY(0.4), color: 0xbfae90, count: 14, speed: 5, size: 0.22, life: 0.6, up: 1.5, grav: -10, blend: 'normal' });
    }
    // (vignette base is owned by _applyStageTheme/_setMood — never recaptured from the live uniform)
    // every stage announces its gimmick and recolours the scene so it LOOKS different
    this.ui.showStageBanner(stageNum, STAGES_PER_REGION, gim);
    this.ui.setStageTint(gim.tint);
    meta.setRegionBest(this.stage.id, stageNum); // best X/10, shown on the world map
    // optional stage mission for bonus 💎 (no mission on the boss — beating it IS the goal)
    this._mission = isBoss ? null : { type: gim.mission, goal: gim.goal, reward: gim.reward };
    this._stageNoHit = true; this._stageComboPeak = 0; this._stageStartT = this.elapsed;
    if (this._mission) this.ui.showMission(this._missionLabel(this._mission));
    else this.ui.hideMission();
    this.ui.wispSay(`${gim.icon} Stage ${stageNum}/${STAGES_PER_REGION} — ${gim.name}: ${gim.desc}`);
  }
  _missionLabel(m) {
    if (m.type === 'nohit') return `🎯 Take no hits this stage · +${m.reward}💎`;
    if (m.type === 'speed') return `🎯 Clear within ${m.goal}s · +${m.reward}💎`;
    if (m.type === 'slayer') return `🎯 Hit a ${m.goal}-kill combo · +${m.reward}💎`;
    return `🎯 Survive the stage · +${m.reward}💎`;
  }
  // a stage cleared: judge its mission and pay out the bonus
  _evalMission() {
    const m = this._mission; if (!m) { this.ui.hideMission(); return; }
    this._mission = null;
    let won;
    if (m.type === 'nohit') won = this._stageNoHit;
    else if (m.type === 'speed') won = (this.elapsed - this._stageStartT) <= m.goal;
    else if (m.type === 'slayer') won = this._stageComboPeak >= m.goal;
    else won = true; // survive
    if (won) { this._missionsWon = (this._missionsWon || 0) + 1; meta.addGems(m.reward); this.ui.setGems(meta.gems()); this.ui.missionResult(true, m.reward); this.audio.play('xp'); }
    else this.ui.missionResult(false, 0);
  }

  // ⭐ candy-crush star rating for a completed level. For fights it's earned by HP left
  // (3 = flawless/near-full, 2 = comfortable, 1 = scraped through); reward levels (treasure,
  // rest, events) pass a `forced` rating. Keeps the player's best per level, pops the stars.
  _awardStageStars(stageNum, forced) {
    let stars;
    if (forced != null) stars = forced;
    else {
      const maxHp = (this.wizard && this.wizard._maxHp) || (this.stats && this.stats.hpMax) || 1;
      const hpFrac = this.wizard ? Math.max(0, this.wizard.hp / maxHp) : 0;
      stars = 1;
      if (this._stageNoHit || hpFrac >= 0.85) stars = 3;
      else if (hpFrac >= 0.45) stars = 2;
    }
    const region = this.stage ? this.stage.id : this._runRegion;
    const gained = meta.awardStars(region, stageNum, stars);
    if (this.ui && this.ui.starAward) this.ui.starAward(stars, gained);
    return stars;
  }

  // a combat room cleared -> a TREASURE CHEST rises; smash it for an RNG reward, THEN move on
  onEncounterCleared() {
    if (this._introRun) { this._finishIntroRun(); return; } // the guided first fight is over
    this._evalMission(); // judge this stage's optional mission, pay the bonus
    this._awardStageStars(Math.min(STAGES_PER_REGION, (this._forksDone || 0) + 1)); // ⭐ rate this level
    // the loot no longer just teleports into your bag — a chest appears and you break it open
    this._spawnLootChest(() => {
      if (this._pendingReward) { this._grantReward(this._pendingReward); this._pendingReward = null; } // the node's promised prize, folded in
      this._nextFork();
    });
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
    this.enemies.clear(); this._clearPickups(); this._disposeLootChest(); // a calm clearing to choose your path in
    // a wandering merchant drops by every 3 rooms cleared, before the next fork
    if (this._forksDone > 0 && this._forksDone % 3 === 0 && this._lastMerchantFork !== this._forksDone) {
      this._lastMerchantFork = this._forksDone;
      this.state = 'menu';
      this.audio.play('levelup');
      this.ui.showMerchant(this, () => this._showPath());
      return;
    }
    this._showPath();
  }
  // between stages: show the region's branching node map and let the player pick the next level
  _showPath() {
    if (!this._runMap) { this._runRegion = this.stage ? this.stage.id : 'forest'; this._runMap = this._buildRunMap(); this._mapNodeId = this._runMap.startId; this._mapVisited = new Set(); }
    this.audio.play('levelup');
    this._enterLevelMap();
  }
  _buildRunMap() {
    // a single winding trail (linear chain of levels), not a branch graph
    return generateRunMap(Math.random, { rows: STAGES_PER_REGION, cols: 1, paths: 1 });
  }
  // ----- region LEVEL MAP: a real 3D biome diorama you orbit, zoom & tap into -----
  openRegionMap(id) {
    this._worldSel = id; this._runRegion = id;
    this._runMap = this._buildRunMap();
    this._mapNodeId = null;          // null = run not started yet; entrance is the only choice
    this._mapVisited = new Set();
    this._enterLevelMap();
  }
  _mapStarsOf(nodeId) { const m = this._runMap; if (!m) return 0; const n = m.byId[nodeId]; return n ? meta.stageStars(this._runRegion, n.row + 1) : 0; }
  // build + reveal the 3D level-map scene (from the world map AND between stages in a run)
  _enterLevelMap() {
    this.phase = 'levelmap'; this.state = 'levelmap';
    this._worldDive = false; this._setPixel('menu');
    this.levelMap.build(this._runMap, this._runRegion, this.world.regionTone ? this.world.regionTone(this._runRegion) : 0x6a5ac0);
    this.levelMap.refresh(this);
    this.tavern.show(false); this.tavern.showRoom(false); this.arenaGroup.visible = false;
    this.world.show(false); this.wizard.setVisible(false); this.levelMap.show(true);
    this.input.pointMode = true;
    // start the scroll at where you are (or the entrance), then scroll up/down the trail
    this._mapScrollZ = this._mapNodeId ? this.levelMap.nodePos(this._mapNodeId).z : 0;
    // moody biome-night lighting keyed to the region so each diorama reads distinctly
    const B = this.levelMap.biome || {};
    this._aimShadow(24, 44, 16, 44);
    this.scene.background.setHex(B.sky != null ? B.sky : 0x0c1a12); this.scene.fog.color.setHex(B.fog != null ? B.fog : 0x10221a); this.scene.fog.density = 0.0055;
    this.hemi.color.setHex(B.hemi != null ? B.hemi : 0xbfe0c0); this.hemi.groundColor.setHex(B.hemiG != null ? B.hemiG : 0x1e3a24); this.hemi.intensity = 1.05;
    this.dir.color.setHex(B.key != null ? B.key : 0xfff2d8); this.dir.intensity = 1.35; this.ambient.color.setHex(0x3a4a3e); this.ambient.intensity = 0.6;
    this.fill.color.setHex(0xbfd0e8); this.fill.intensity = 0.34;
    this.rim.color.setHex(B.accent != null ? B.accent : 0x9bff9b); this.rim.intensity = 1.05;
    if (this.heroLight) this.heroLight.intensity = 0;
    this.renderer.toneMappingExposure = 1.08;
    if (this._gradePass) { const u = this._gradePass.uniforms; u.uContrast.value = 1.12; u.uSaturation.value = 1.18; u.uTintStrength.value = 0.2; u.uVignette.value = 0.44; u.uVignetteSoft.value = 0.6; u.uGrain.value = 0.016; }
    if (this.ui.hideRunMap) this.ui.hideRunMap();
    if (this.ui.hideWorldHud) this.ui.hideWorldHud();
    this.ui.setScreen('play'); this.ui.setPhase('world', this.input.isTouch);
    if (this.ui.showMapHud) this.ui.showMapHud(this);
  }
  // lightweight arena look restore (used when descending into a fight from the level map)
  _restoreArenaLook() {
    const t = this.stage && this.stage.theme; if (!t) return;
    this._aimShadow(28, 46, 18, 48);
    this.scene.background.setHex(t.bg); this.scene.fog.color.setHex(t.fog); this.scene.fog.density = t.fogD * 0.9;
    this.hemi.color.setHex(t.hemi); this.hemi.groundColor.setHex(t.hemiG); this.hemi.intensity = 0.92;
    this.dir.color.setHex(t.dir); this.dir.intensity = t.dirI; this.ambient.color.setHex(t.amb); this.ambient.intensity = 0.34;
    this.fill.color.setHex(0xbfd0ff); this.fill.intensity = 0.36;
    this.rim.color.setHex(t.rim != null ? t.rim : t.dir); this.rim.intensity = (t.rimI != null ? t.rimI : 1.15) + 0.3;
    this.renderer.toneMappingExposure = 1.04;
  }
  chooseMapNode(nodeId) {
    if (this.state !== 'levelmap') return;
    const map = this._runMap; if (!map) return;
    // first pick starts the run at the entrance
    if (this._mapNodeId == null) {
      if (nodeId !== map.startId) return;
      this.audio.play('click'); this._leaveLevelMap();
      this._mapNodeId = map.startId; if (this._mapVisited) this._mapVisited.add(map.startId);
      this.beginRun(this._runRegion);
      return;
    }
    const cur = map.byId[this._mapNodeId];
    if (!cur || !cur.next.includes(nodeId)) return; // only reachable nodes
    const mnode = map.byId[nodeId];
    this.audio.play('click'); this._leaveLevelMap();
    if (this._mapVisited) this._mapVisited.add(nodeId);
    this._mapNodeId = nodeId;
    this._forksDone = mnode.row;     // depth drives difficulty + the stage banner (stageNum = row+1)
    if (mnode.type === 'boss') { this._travel('Approaching the lair…', () => { this.state = 'play'; this._beginRoom(true); }); return; }
    const node = this._makeNode(mnode.type); // live reward / event / gameKey for this stage
    if (node.type === 'combat' || node.type === 'elite') {
      this._pendingReward = node.reward || null;
      const elite = node.type === 'elite';
      this._travel(null, () => { this.state = 'play'; this._beginRoom(false, elite); });
    } else if (node.type === 'treasure') {
      this._awardStageStars(mnode.row + 1, 3); // ⭐ a cache level: full marks for the loot
      this._grantReward(node.reward); this._nextFork();
    } else if (node.type === 'campfire') {
      this._awardStageStars(mnode.row + 1, 3); // ⭐ a rest level: full marks
      this.stats.hpMax += 12; this.wizard._maxHp = this.stats.hpMax; this.wizard.hp = this.stats.hpMax;
      this.wizard.mana = this.stats.manaMax; this.audio.play('heal');
      this.ui.toast('🔥 Rested — fully healed & +12 max HP'); this._nextFork();
    } else if (node.type === 'event') {
      this._awardStageStars(mnode.row + 1, 2); // ⭐ a mystery level cleared
      this.state = 'path'; this._curEvent = node.event; this.ui.showChoiceEvent(this, node.event);
    } else if (node.type === 'skill') {
      this._awardStageStars(mnode.row + 1, 2); // ⭐ a trial level cleared
      this.state = 'path'; this.ui.showSkillEvent(this);
    } else if (node.type === 'minigame') {
      this._awardStageStars(mnode.row + 1, 2); // ⭐ a game level cleared
      this.state = 'minigame'; this.ui.showMinigame(this, node.gameKey);
    } else { this._awardStageStars(mnode.row + 1, 2); this._nextFork(); }
  }
  _leaveLevelMap() { this.ui.hideRunMap && this.ui.hideRunMap(); this.levelMap.show(false); if (this.ui.hideMapHud) this.ui.hideMapHud(); }
  retreatFromMap() {
    this._leaveLevelMap();
    if (this._mapNodeId == null) { this.openWorldMap(); }   // hadn't started — back to the realm map
    else { this._runMap = null; this._mapNodeId = null; this.audio.play('click'); this.ui.wipe('fade', () => this.enterTavern()); } // give up the run — clean fade home
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
    } else if (node.type === 'minigame') {
      this.state = 'minigame'; this.ui.showMinigame(this, node.gameKey);
    } else { this._nextFork(); }
  }

  // ----- typed path nodes -----
  _makeNodePair(bossNext) {
    if (bossNext) { const a = this._makeNode('combat'); const b = this._makeNode('combat'); a.bossNext = b.bossNext = true; a.name = b.name = 'To the Boss'; return [a, b]; }
    const types = this._pickNodeTypes();
    return [this._makeNode(types[0]), this._makeNode(types[1])];
  }
  _pickNodeTypes() {
    const pool = [['combat', 4], ['elite', 2], ['treasure', 2], ['campfire', 2], ['event', 3], ['skill', 2], ['minigame', 3]];
    const pickFrom = (arr) => { let tot = 0; for (const [, w] of arr) tot += w; let r = Math.random() * tot; for (const e of arr) { r -= e[1]; if (r <= 0) return e[0]; } return arr[0][0]; };
    const a = pickFrom(pool);
    const b = pickFrom(pool.filter(e => e[0] !== a));
    return [a, b];
  }
  _makeNode(type) {
    const lvl = Math.max(1, this.level);
    if (type === 'combat') { const r = this._makeReward(this._randKind()); return { type, icon: '⚔️', name: 'Skirmish', desc: `Fight · win ${r.icon} ${r.name}`, reward: r, lurk: '⚔ foes ahead' }; }
    if (type === 'elite') { const r = this._makeReward(Math.random() < 0.5 ? 'gear' : 'ability'); return { type, icon: '💀', name: 'Elite Pack', desc: `Tough fight · win ${r.icon} ${r.name}`, reward: r, lurk: '💀 something big stirs' }; }
    if (type === 'treasure') { const r = this._makeReward('gems'); return { type, icon: '💰', name: 'Hidden Cache', desc: `Free · ${r.icon} ${r.name}`, reward: r, lurk: '✨ unguarded loot' }; }
    if (type === 'campfire') return { type, icon: '🔥', name: 'Campfire', desc: 'Rest — full heal & +12 max HP', lurk: '🔥 a safe little fire' };
    if (type === 'event') return { type, icon: '❓', name: 'Mystery', desc: 'A strange encounter — your call', event: this._pickEvent(), lurk: '❓ who knows what' };
    if (type === 'minigame') {
      const gameKey = MINIGAME_KEYS[Math.floor(Math.random() * MINIGAME_KEYS.length)];
      const mg = MINIGAMES[gameKey];
      return { type, gameKey, icon: '🎲', name: 'Party Game', desc: `Play "${mg.name}" — win gems & maybe a card`, lurk: '🎲 a curious contraption' };
    }
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
      else if (opt.gain === 'gear' || opt.gain === 'gems') { const amt = opt.gemAmt || 8; meta.addGems(amt); this.ui.toast(`💎 +${amt} gems`); } // gear only from chests now → pay gems
      this.audio.play('click');
    }
    this._nextFork();
  }
  resolveSkill(quality) {
    this.ui.hideEvent();
    let msg;
    if (quality >= 0.82) { const u = rollUpgrades(this, 1)[0]; if (u) this.applyAbility(u); meta.addGems(8); msg = `✶ PERFECT! ✦ ${u ? u.name : 'ability'} + 💎8`; this.audio.play('levelup'); }
    else if (quality >= 0.45) { meta.addGems(6); msg = '✶ Steady — 💎6'; this.audio.play('xp'); }
    else { meta.addGems(3); msg = '✶ Shaky hand — 💎3 for the effort'; this.audio.play('hiccup'); }
    this.ui.toast(msg);
    this._nextFork();
  }

  // a party minigame finished -> pay gems (×card gemMult) + a rarity-rolled card chance
  resolveMinigame(key, score) {
    this.ui.hideMinigame();
    // pay out inside try/finally so a thrown reward call can never strand the run
    // with the overlay gone and state stuck on 'minigame' (input is dead in that state)
    try {
      const mg = MINIGAMES[key];
      const bonus = (this.cardPerks && this.cardPerks.mgScoreBonus) || 0;
      const s = Math.max(0, Math.min(1, (score || 0) + bonus));
      const r = (mg && mg.reward) ? mg.reward(s) : { gems: 3, cardChance: 0 };
      const gemMult = (this.cardPerks && this.cardPerks.gemMult) || 1;
      const gems = Math.max(1, Math.round(r.gems * gemMult));
      meta.addGems(gems);
      const won = s >= 0.5, perfect = (score || 0) >= 0.95;
      if (won) { meta.bumpStat('mgWins', 1); meta.bumpStat('won_' + key, 1); }
      if (perfect) meta.bumpStat('mgPerfect', 1);
      let msg = `🎲 ${perfect ? 'PERFECT! ' : won ? 'Nice! ' : ''}💎 +${gems}`;
      if (Math.random() < (r.cardChance || 0)) { const card = meta.grantRandomCard(); if (card) { msg += `  ·  🃏 ${card.name}!`; this.audio.play('win'); } }
      this.ui.setGems(meta.gems());
      this.audio.play(won ? 'levelup' : 'hiccup');
      this.ui.toast(msg);
    } catch (e) { /* swallow — the finally below always returns the run to a safe state */ }
    finally { this._nextFork(); }
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
    this._learn('level', 'You leveled up! Pick a power, and lean into one playstyle for a strong build.');
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
    this.wizard.setEquipment(meta.equippedGearFull()); // worn gear shows on the model
    const m = meta.equipMods();
    const pm = meta.petMods(); for (const k in pm) m[k] = (m[k] || 0) + pm[k]; // fold in the carried pet's boons
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
    this._learn('cast');
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
      this.scene.background.setHex(0x1c130f);
      this.scene.fog.color.setHex(0x201612); this.scene.fog.density = 0.010; // gentle candle-lit haze
      this.hemi.color.setHex(0xe8b070); this.hemi.groundColor.setHex(0x241610); this.hemi.intensity = 0.78;
      this.dir.color.setHex(0xffd29a); this.dir.intensity = 1.35;
      this.ambient.color.setHex(0x3a2a24); this.ambient.intensity = 0.36; // lifted warm shadows
      this.fill.color.setHex(0xe8b483); this.fill.intensity = 0.3; // warm, soft fill
      this.rim.color.setHex(0xffe2b0); this.rim.intensity = 1.15;
      if (this.heroLight) this.heroLight.intensity = 0; // arena-only
      this.renderer.toneMappingExposure = 1.04;
      if (this._gradePass) { const u = this._gradePass.uniforms; // warm, moody tavern grade
        u.uContrast.value = 1.09; u.uSaturation.value = 1.19;
        u.uShadowTint.value.set(0.88, 0.94, 1.05); u.uHighlightTint.value.set(1.11, 1.02, 0.85);
        u.uTintStrength.value = 0.30; u.uVignette.value = 0.42; u.uVignetteSoft.value = 0.56; this._baseVig = 0.42;
        u.uGrain.value = 0.013;
      }
    } else {
      this.scene.background.setHex(0x101a30);
      this.scene.fog.color.setHex(0x101a30); this.scene.fog.density = 0.009;
      this.hemi.color.setHex(0x8ea2d8); this.hemi.groundColor.setHex(0x1a2418); this.hemi.intensity = 0.85;
      this.dir.color.setHex(0xcdd8ff); this.dir.intensity = 1.7;
      this.ambient.color.setHex(0x2c3a58); this.ambient.intensity = 0.3;
      this.fill.color.setHex(0xbfd0ff); this.fill.intensity = 0.32; // cool fill for arenas
      this.rim.color.setHex(0xbfe6ff); this.rim.intensity = 1.6;
      this.renderer.toneMappingExposure = 1.03;
      if (this._gradePass) { const u = this._gradePass.uniforms;
        u.uContrast.value = 1.13; u.uSaturation.value = 1.19;
        u.uShadowTint.value.set(0.88, 0.93, 1.08); u.uHighlightTint.value.set(1.05, 1.01, 0.95);
        u.uTintStrength.value = 0.26; u.uVignette.value = 0.40; u.uVignetteSoft.value = 0.52; this._baseVig = 0.40;
        u.uGrain.value = 0.012;
      }
    }
  }

  castById(id) { if (this.state === 'play' && this.phase === 'arena' && this.unlocked.has(id)) this._castAt(id, this.aimPoint, { accuracy: 0.8 }); }
  togglePause() {
    if (this.state === 'play') { this.state = 'paused'; document.body.classList.add('paused'); this.ui.toast('⏸ Paused'); }
    else if (this.state === 'paused') { this.state = 'play'; document.body.classList.remove('paused'); this.ui.toast('▶ Resumed'); }
  }
  toggleMute() { this.audio.resume(); this.audio.setMuted(!this.audio.muted); this.ui.setMuteIcon(this.audio.muted); }

  // ---- DRINK: a 3-second channel. He pulls out the tankard, chugs (progress bar),
  // and your mana fills to FULL. Costs sobriety — you get woozier. You can move
  // while chugging; what the brew does beyond mana depends on your beer abilities. ----
  drink() {
    if (this.state !== 'play' || this.phase !== 'arena' || !this.wizard.alive) return;
    if (this._drinking) return; // already chugging
    const w = this.wizard, s = this.stats;
    if (w.mana >= s.manaMax - 0.5) { this.ui.wispSay('🍺 Your mug\'s already full!', { tone: 'warn' }); return; }
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
    this._learn('chug');
    const w = this.wizard, s = this.stats;
    this._drinking = false; w.endDrink(); this.ui.hideDrinkBar();
    w.mana = s.manaMax;                        // chugged it dry → FULL mana
    if (s.drinkHeal) w.heal(s.drinkHeal);      // beer types
    if (s.drinkShield) w.addShield(s.drinkShield, 8);
    this.drunkenness = Math.min(1, this.drunkenness + 0.3 * (s.drinkChaos || 1));
    this._drunkSurge = 1;
    w.bob -= 0.7; w.leanV.x += (Math.random() - 0.5) * 6; w.leanV.z += (Math.random() - 0.5) * 6;
    w.squash(0.2, -1, 0.28); this.shake(0.35);   // a satisfying *gulp* pop
    this.audio.play('levelup');
    const hp = w.handPosition(); hp.y = 2.1;
    this.particles.burst({ pos: hp, color: 0xf6e3a0, count: 22, speed: 3.2, size: 0.22, life: 0.85, grav: 2, blend: 'add' });
    this.particles.ring({ pos: w.pos.clone().setY(0.2), color: 0xf6e3a0, r0: 0.3, r1: 2.2, life: 0.4 });
    this.ui.toast('🍺 *AHHH!* — full mana, room spinning');
  }

  _maybeDrink() { // touch/desktop drink button + Q key route here
    this.drink();
  }

  // ---------- input ----------
  _handleInput() {
    const events = this.input.drain();
    // cutscenes own their own input (Continue/skip buttons + the QTE mash listener);
    // ignore game input here so mashing can't fire interact/guide/drink and hide the set
    if (this.state === 'cutscene' || this.state === 'minigame' || this.state === 'runmap') return; // overlay owns its own input
    if (this.state === 'chat') { for (const e of events) { if (e.type === 'interact' || e.type === 'confirm') { this.endChat(); break; } } return; }
    for (const e of events) {
      if (e.type === 'mute') { this.toggleMute(); continue; }
      if (e.type === 'guide') { this.toggleGuide(); continue; }
      if (e.type === 'drink') { this.drink(); continue; }
      if (e.type === 'select') {
        if (this.state === 'world') { const id = this.world.pick(e.x, e.y, this.camera); if (id) this.selectWorldRegion(id); }
        else if (this.state === 'levelmap') { const nid = this.levelMap.pick(e.x, e.y, this.camera); if (nid) this.chooseMapNode(nid); }
        continue;
      }
      if (e.type === 'interact') { if (this.state === 'menu') { if (!this.ui.closeMerchant()) this.closeShop(); } else this.interact(); continue; }

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
      if (id) { this.ui.wispSay(`✋ ${SPELLS[id].name} is not equipped. Learn it at the Spell Table.`, { tone: 'warn' }); this.audio.play('hiccup'); return; }
    }
    // a fizzle — show a little puff so it still feels responsive
    this.audio.play('hiccup');
    this.ui.wispSay('The glyph fizzles. Try a cleaner line.', { tone: 'warn' });
    const hp = this.wizard.handPosition();
    this.particles.burst({ pos: hp, color: 0x6a5a82, count: 6, speed: 2, size: 0.2, life: 0.5, grav: 1, blend: 'normal' });
  }

  _castAt(id, aim, opts) {
    const saved = this.aimPoint;
    this.aimPoint = aim;
    const ok = this.spells.tryCast(this, id, opts);
    this.aimPoint = saved;
    if (ok) {
      this._registerCast(id);
      // muzzle flash at the casting hand — a satisfying pop of light on every cast
      const crit = !!(opts && opts.crit);
      const hp = this.wizard.castGlow ? this.wizard.castGlow.getWorldPosition(new THREE.Vector3()) : this.wizard.pos.clone().setY(1.4);
      // colour the muzzle flash by the spell's element (crit overrides to gold)
      const sm = meta.SPELL_META[id]; const el = sm && sm.element;
      const eCol = (el && meta.ELEMENTS[el]) ? new THREE.Color(meta.ELEMENTS[el].color).getHex() : 0xbfa3ff;
      const col = crit ? 0xffd36b : eCol;
      this.particles.burst({ pos: hp, color: col, count: crit ? 14 : 7, speed: crit ? 7 : 4.5, size: crit ? 0.28 : 0.2, life: 0.34, up: 1, blend: 'add', floor: false });
      this.particles.ring({ pos: hp, color: col, r0: 0.12, r1: crit ? 1.5 : 0.9, life: 0.26 });
      // a short trail from the hand toward the aim point sells the cast direction
      this.particles.streak(hp, new THREE.Vector3(this.aimPoint.x, 1.0, this.aimPoint.z), { color: col, count: 5, life: 0.3, size: 0.16 });
      if (crit) this.shake(0.4);
      if (this.lootChest) this._strikeLootChest(false); // a blast can crack the end-of-stage chest
    }
  }

  _updateAim() {
    this.reticle.visible = (this.state === 'play' && this.phase === 'arena');
    if (this.phase === 'tavern') {
      // the wizard faces the way he's staggering
      const mv = this.moveVector();
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
      const label = this._live.locked ? `${s.name} (locked)` : (this._live.score >= 0.9 ? `${s.glyph} ${s.name}  ✦CRIT` : `${s.glyph} ${s.name}`);
      ctx.fillText(label, last.x + 16, last.y - 18);
    }
  }

  // ---------- camera ----------
  // camera-relative movement: rotate the raw WASD / joystick vector by the camera yaw so
  // "up" always means "away from the camera", however the player has turned it.
  moveVector() {
    const mv = this.input.moveVector();
    const y = this.camYaw || 0;
    if (!y) return mv;
    const c = Math.cos(y), s = Math.sin(y);
    return { x: mv.x * c + mv.z * s, z: -mv.x * s + mv.z * c };
  }

  // per-frame camera turn/pitch from middle-drag and the [ ] keys (on-screen buttons snap
  // via turnCamera). Only active while you control the wizard, never in the fixed build cam.
  _updateCameraControls(dt) {
    if (this.state !== 'play') return;
    if (this.phase === 'room' && this.ui && this.ui._shopKind === 'build') return;
    const o = this.input.consumeOrbit();
    if (o.dx) this.camYaw += o.dx * 0.006;
    if (o.dy) this.camPitch = Math.max(0.55, Math.min(1.5, this.camPitch - o.dy * 0.004));
    const t = this.input.turnInput();
    if (t) this.camYaw += t * dt * 1.7;
    const z = this.input.consumeZoom ? this.input.consumeZoom() : 0; // wheel / pinch zoom in the fight
    if (z) this.camZoom = Math.max(0.62, Math.min(1.7, this.camZoom + z * 0.0011));
  }

  // on-screen / tap camera turn: dir -1 (left) / +1 (right) — a smooth 30° snap
  turnCamera(dir) { if (this.state === 'play') this.camYaw += dir * Math.PI / 6; }
  resetCamera() { this.camYaw = 0; this.camPitch = 1; }

  // 🐾 the carried pet: a little billboarded pixel sprite floating beside the wizard in a
  // run (also gives the 2D-sprite-in-3D "Megabonk" flavour). Rebuilt when the pet changes.
  _spawnPetCompanion() {
    const id = meta.equippedPetId ? meta.equippedPetId() : null;
    if (this._petSprite && this._petSpriteId === id) return; // unchanged — keep it
    if (this._petSprite) { this.scene.remove(this._petSprite); if (this._petSprite.material.map) this._petSprite.material.map.dispose(); this._petSprite.material.dispose(); this._petSprite = null; }
    this._petSpriteId = id; this._petXpAcc = 0;
    const recipe = id ? PET_SPRITE[id] : null; if (!recipe) return;
    const cv = iconCanvas(recipe, { scale: 8 }); if (!cv) return;
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(1.6, 1.6, 1.6); spr.userData.noOutline = true; spr.userData.noTex = true; spr.visible = false;
    this.scene.add(spr); this._petSprite = spr;
  }
  _updatePetCompanion(dt) {
    const spr = this._petSprite; if (!spr) return;
    const show = this.phase === 'arena' && this.wizard.alive && this.state !== 'gameover';
    spr.visible = show; if (!show) return;
    this._petT = (this._petT || 0) + dt;
    const w = this.wizard.pos;
    const tx = w.x - 1.8, tz = w.z + 0.7;
    spr.position.x += (tx - spr.position.x) * Math.min(1, dt * 5);
    spr.position.z += (tz - spr.position.z) * Math.min(1, dt * 5);
    spr.position.y = 1.9 + Math.sin(this._petT * 3) * 0.28;
  }
  // per-second auto boons from the carried pet (auto-XP / auto-mana / auto-heal)
  _tickPetAuto(sdt) {
    const pa = meta.petAuto ? meta.petAuto() : null; if (!pa || !this.wizard.alive) return;
    if (pa.kind === 'autoxp') { this._petXpAcc = (this._petXpAcc || 0) + pa.val * sdt; const whole = Math.floor(this._petXpAcc); if (whole >= 1) { this._petXpAcc -= whole; this.gainXP(whole); } }
    else if (pa.kind === 'automana') this.wizard.mana = Math.min(this.stats.manaMax, this.wizard.mana + pa.val * sdt);
    else if (pa.kind === 'autoheal') this.wizard.hp = Math.min(this.stats.hpMax, (this.wizard.hp || 0) + pa.val * sdt);
  }

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
    // tavern chat: dolly in on the patron you're talking to (cinematic conversation shot)
    if (this._chatNpc && this._chatNpc.pos) {
      const p = this._chatNpc.pos;
      this.camera.position.lerp(new THREE.Vector3(p.x + 3.0, 4.0, p.z + 5.2), Math.min(1, dt * 2.6));
      this.camera.rotation.z = 0;
      this.camera.lookAt(p.x, 1.6, p.z);
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
      if (this._worldDive) { // plunging into the chosen island before the level map opens
        this.camera.position.lerp(new THREE.Vector3(sel.x, 9, sel.z + 8), Math.min(1, dt * 2.6));
        this.camera.lookAt(sel.x, 1, sel.z);
        return;
      }
      const cx = sel.x * 0.4, cz = sel.z * 0.4 - 1.5;
      this.camera.position.lerp(new THREE.Vector3(cx, 40, cz + 7), Math.min(1, dt * 2.5));
      this.camera.lookAt(cx, 0, cz);
      return;
    }
    // 3D level map: an orbitable, zoomable angled view over the candy isle
    if (this.phase === 'levelmap') {
      // fixed top-down (slightly tilted) view; the player only scrolls up/down the trail
      const sz = this._mapScrollZ || 0;
      this.camera.position.lerp(new THREE.Vector3(0, 30, sz + 12), Math.min(1, dt * 4));
      this.camera.lookAt(0, 0, sz - 2);
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
    // build mode: swing up to a bird's-eye view over the whole den while you place furniture
    if (this.phase === 'room' && this.state === 'menu' && this.ui && this.ui._shopKind === 'build' && this.ui.el.shop && !this.ui.el.shop.classList.contains('hidden')) {
      this.camTarget.lerp(this._buildCenter || (this._buildCenter = new THREE.Vector3(0.5, 0, -0.4)), Math.min(1, dt * 3));
      const desired = new THREE.Vector3(this.camTarget.x, 21, this.camTarget.z + 6.5);
      this.camera.position.lerp(desired, Math.min(1, dt * 3));
      this.camera.rotation.z = 0;
      this.camera.lookAt(this.camTarget.x, 0, this.camTarget.z);
      return;
    }
    this.camTarget.lerp(this.wizard.pos, Math.min(1, dt * 6));
    // on the title screen, bias the framing left so the fight sits on the RIGHT (menu is on the left)
    const bx = this.state === 'title' ? -9 : 0;
    const focus = this.camTarget.clone(); focus.x += bx;
    if (this.phase === 'tavern') focus.y += (this.wizard.floorY || 0); // rise with him onto the upper deck
    // build the follow offset from the player's yaw + pitch so they can turn the camera
    // around the wizard and tilt to a more 3D angle (zoom multiplies the whole thing)
    const horiz = Math.hypot(this.camOffset.x, this.camOffset.z) || 22;
    const yaw = this.camYaw || 0;
    const off = new THREE.Vector3(Math.sin(yaw) * horiz, this.camOffset.y * (this.camPitch || 1), Math.cos(yaw) * horiz).multiplyScalar(this.camZoom);
    const desired = focus.clone().add(off);
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
    if (this._hitstopT > 0 && this.state === 'play') { this._hitstopT -= dt; this.timeScale = 0.05; } // a crisp beat of freeze on big impacts
    else { this._hitstopT = 0; this.timeScale += (targetScale - this.timeScale) * Math.min(1, dt * 12); }
    const sdt = dt * this.timeScale;

    if (this.state === 'play') {
      if (this.phase === 'tavern') this._updateTavern(sdt);
      else if (this.phase === 'room') this._updateRoom(sdt);
      else this._updateArena(sdt);
    } else if (this.state === 'world') {
      this._updateWorld(dt);
    } else if (this.state === 'levelmap') {
      this._updateLevelMap(dt);
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
    this._updateCameraControls(dt);
    this._updatePetCompanion(dt);
    if (this.tavern && this.tavern.tickConstructions) this.tavern.tickConstructions(dt, this); // COC build holograms (run even in the build menu)
    this._updateCamera(dt);
    if (this._gradePass) this._gradePass.uniforms.uTime.value = this.clock.getElapsedTime();
    this.present();
  }

  // ambient life: drifting motes/embers coloured by the stage, plus a throbbing low-HP
  // vignette that darkens (and quickens) the closer the wizard is to death.
  _ambientFX(sdt) {
    if (!this.particles) return;
    this._moteCd = (this._moteCd || 0) - sdt;
    if (this._moteCd <= 0) {
      this._moteCd = 0.4 + Math.random() * 0.3; // calmer, less-busy air (fewer drifting motes)
      const col = (this.stage && this.stage.theme && this.stage.theme.rim) || 0xbfe0ff;
      const w = this.wizard.pos, a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 13;
      this.particles.spawn({
        pos: new THREE.Vector3(w.x + Math.cos(a) * r, 0.4 + Math.random() * 3.4, w.z + Math.sin(a) * r),
        color: col, size: 0.055 + Math.random() * 0.06, life: 2.4 + Math.random() * 2.4,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.22 + Math.random() * 0.35, (Math.random() - 0.5) * 0.4),
        grav: 0, drag: 0.985, blend: 'add', floor: false, fadePow: 1.6,
      });
    }
    if (this._gradePass) {
      const u = this._gradePass.uniforms;
      // base comes from the grade (set in _applyStageTheme/_setMood), NEVER the live uniform —
      // capturing the live value would bake the low-HP pulse in and darken the screen forever.
      const base = this._baseVig != null ? this._baseVig : 0.40;
      const frac = this.wizard._maxHp ? this.wizard.hp / this.wizard._maxHp : 1;
      let target = base;
      if (frac < 0.3 && this.wizard.alive) target = base + 0.3 * (0.5 + 0.5 * Math.sin(this.clock.getElapsedTime() * 6)) * ((0.3 - frac) / 0.3);
      u.uVignette.value += (target - u.uVignette.value) * Math.min(1, sdt * 5);
    }
  }

  _updateArena(sdt) {
    this.elapsed += sdt;
    this._tickPetAuto(sdt); // 🐾 auto-XP / auto-mana / auto-heal from the carried pet
    this.wizard._hitThisFrame = false;   // any hit taken this frame will break the kill-combo
    // you slowly sober up between gulps; the post-gulp lurch fades fast
    this.drunkenness = Math.max(0, this.drunkenness - sdt * 0.05);
    if (this._drunkSurge > 0) this._drunkSurge = Math.max(0, this._drunkSurge - sdt * 1.6);
    if (this._drinkCd > 0) this._drinkCd = Math.max(0, this._drinkCd - sdt);
    if (this.heroLight) { this.heroLight.position.set(this.wizard.pos.x, 3.0, this.wizard.pos.z); this.heroLight.intensity = 1.25; this.heroLight.color.setHex(0xffcf8a); this.heroLight.distance = 13; }
    this.director.update(sdt, this);
    this.wizard.update(sdt, this);
    this.enemies.update(sdt, this);
    this.spells.update(sdt, this);
    this.jobs.update(sdt, this);
    this.particles.update(sdt);
    this._updatePickups(sdt);
    this._ambientFX(sdt);           // drifting motes/embers + low-HP vignette pulse

    // ---- kill-combo upkeep: lapses over time, snaps on any hit taken ----
    if (this.comboT > 0) { this.comboT -= sdt; if (this.comboT <= 0) this.breakCombo(); }
    if (this.wizard._hitThisFrame) { this.breakCombo(); this._stageNoHit = false; } // a hit blows the no-hit mission
    if (this._mission && this.combo > (this._stageComboPeak || 0)) this._stageComboPeak = this.combo; // track best combo (slayer)

    // thorns: enemies overlapping the wizard take a little damage
    if (this.stats.thorns > 0) {
      for (const e of this.enemies.list) {
        if (!e.alive) continue;
        const dx = e.mesh.position.x - this.wizard.pos.x, dz = e.mesh.position.z - this.wizard.pos.z;
        if (dx * dx + dz * dz < (e.r + 0.8) * (e.r + 0.8)) { this.enemies.damage(e, this.stats.thorns * sdt, this); if (this.stats.thornsLifesteal) this.wizard.heal(this.stats.thorns * sdt * this.stats.thornsLifesteal); }
      }
    }
    if (this.stats.hpRegen > 0 && this.wizard.alive) this.wizard.heal(this.stats.hpRegen * sdt);

    this._updateShrine(sdt);
    this._updateLootChest(sdt); // the end-of-stage treasure coffer
    this._updateDrink(sdt);
    this._updateWisp(sdt);

    if (!this.wizard.alive) this._loseRun();
    if (this.pendingLevels > 0 && this.state === 'play') this._openLevelUp();
    // boss slain -> win the whole level
    if (this._endState === 'win' && !this.storyShowing && this.state === 'play') { this.state = 'win'; this._showEnd(true); }
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
    if (near && !sh.hinted) { sh.hinted = true; this.ui.wispSay('✦ A rune shrine! Draw any glyph here to channel an ability.', { big: true, ms: 4200 }); }
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

  // ============================================================================
  //  END-OF-STAGE LOOT CHEST — a banded arcane coffer rises where you cleared the
  //  field. Blast it (or ram it) to crack it open, then a jackpot reward bursts out.
  // ============================================================================
  _spawnLootChest(onDone) {
    this._disposeLootChest();
    // drop it a few paces "up-screen" of the wizard so it's centred and reachable
    const wx = this.wizard.pos.x, wz = this.wizard.pos.z;
    const cx = Math.max(-16, Math.min(16, wx));
    const cz = Math.max(-16, Math.min(16, wz - 5.5));
    const mesh = this._buildChestModel();
    mesh.position.set(cx, 0, cz);
    mesh.scale.setScalar(0.01); // pops in with a bouncy rise
    this.arenaGroup.add(mesh);
    this.lootChest = { mesh, x: cx, z: cz, baseY: 0, hits: 0, maxHits: 3, broken: false, onDone, t: 0, rise: 0, shakeT: 0, touchCd: 0, near: false, hinted: false, revealT: 0, revealShown: false, lidVel: 0, lidSpin: 0 };
    this.audio.play('jobDone');
    // a herald ring + rune sparks announce the prize
    this.particles.ring({ pos: new THREE.Vector3(cx, 0.12, cz), color: 0xffd36b, r0: 0.3, r1: 4.5, life: 0.7 });
    this.particles.burst({ pos: new THREE.Vector3(cx, 0.9, cz), color: 0xffe08a, count: 18, speed: 4, size: 0.22, life: 1.0, up: 3, blend: 'add' });
    if (this.ui.wispSay) this.ui.wispSay('✦ A loot chest! Blast it open to claim your reward!', { big: true, ms: 4200 });
  }

  _buildChestModel() {
    const g = new THREE.Group();
    g.userData.glow = [];
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a3f1f, roughness: 0.9, metalness: 0.05, flatShading: true });
    pxMap(wood, 'wood', 3);
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8b23a, roughness: 0.35, metalness: 0.85, flatShading: true });
    pxMap(gold, 'metal', 3);
    // ---- body ----
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.0), wood);
    body.position.y = 0.55; body.castShadow = body.receiveShadow = true; g.add(body);
    // ---- domed lid (half-cylinder laid along the width) ----
    const lid = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.5, 16, 1, false, 0, Math.PI), wood);
    dome.rotation.z = Math.PI / 2; dome.castShadow = true; lid.add(dome);
    // lid trim bands
    for (const bx of [-0.55, 0, 0.55]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.055, 6, 14, Math.PI), gold); band.rotation.y = Math.PI / 2; band.position.x = bx; lid.add(band); }
    lid.position.set(0, 1.0, 0); g.add(lid); g.userData.lid = lid; g.userData.body = body;
    // ---- corner + front metal banding ----
    for (const sx of [-0.72, 0.72]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.94, 1.04), gold); b.position.set(sx, 0.55, 0); g.add(b); }
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.1, 1.04), gold); rim.position.y = 1.0; g.add(rim);
    // ---- lock plate with a glowing arcane keyhole ----
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.1), gold); lock.position.set(0, 0.9, 0.53); g.add(lock);
    const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), new THREE.MeshBasicMaterial({ color: 0x9be6ff, transparent: true, opacity: 0.95 }));
    keyhole.position.set(0, 0.9, 0.59); keyhole.userData.noOutline = true; g.add(keyhole); g.userData.glow.push(keyhole);
    // ---- magic seam of light between lid & body ----
    const seam = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 1.02), new THREE.MeshBasicMaterial({ color: 0xffe58a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    seam.position.y = 1.0; seam.userData.noOutline = true; g.add(seam); g.userData.glow.push(seam);
    // ---- floating rune orb + rising light beam above the lid ----
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: 0xffe58a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    orb.position.set(0, 1.9, 0); orb.userData.noOutline = true; g.add(orb); g.userData.orb = orb; g.userData.glow.push(orb);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 4, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.y = 2.6; beam.userData.noOutline = true; g.add(beam); g.userData.beam = beam; g.userData.glow.push(beam);
    return g;
  }

  _updateLootChest(sdt) {
    const lc = this.lootChest; if (!lc) return;
    lc.t += sdt;
    const ud = lc.mesh.userData;
    // bouncy pop-in
    if (lc.rise < 1) { lc.rise = Math.min(1, lc.rise + sdt * 3.2); const s = lc.rise < 1 ? 1 + Math.sin(lc.rise * Math.PI) * 0.18 : 1; lc.mesh.scale.setScalar(s * lc.rise); }
    // idle life — orb bob, glow pulse, gentle sway
    const pulse = 0.6 + Math.sin(lc.t * 4) * 0.4;
    if (ud.orb) { ud.orb.position.y = 1.9 + Math.sin(lc.t * 2.4) * 0.14; ud.orb.rotation.y += sdt * 1.6; ud.orb.rotation.x += sdt * 0.9; ud.orb.material.opacity = 0.7 + pulse * 0.3; }
    if (ud.beam) ud.beam.material.opacity = 0.12 + pulse * 0.12;
    if (ud.glow) for (const gp of ud.glow) if (gp.material && gp !== ud.orb && gp !== ud.beam) gp.material.opacity = 0.6 + pulse * 0.35;

    // ---- BREAK animation: lid tumbles off, beam blooms, then the reward reveal ----
    if (lc.broken) {
      lc.revealT -= sdt;
      if (ud.lid) { lc.lidVel -= sdt * 12; ud.lid.position.y += lc.lidVel * sdt; ud.lid.position.z -= sdt * 1.3; ud.lid.rotation.x += lc.lidSpin * sdt; ud.lid.rotation.z += lc.lidSpin * 0.6 * sdt; } // lid pops up & tumbles off
      if (ud.beam) { ud.beam.scale.x = ud.beam.scale.z = 1 + (0.8 - Math.max(0, lc.revealT)) * 1.5; ud.beam.material.opacity = Math.min(0.6, ud.beam.material.opacity + sdt * 1.2); }
      if (ud.orb) { ud.orb.position.y += sdt * 3; ud.orb.scale.setScalar(1 + (0.8 - Math.max(0, lc.revealT)) * 2); }
      if (Math.random() < sdt * 30) this.particles.burst({ pos: new THREE.Vector3(lc.x, 1.4, lc.z), color: 0xffe58a, count: 3, speed: 5, size: 0.2, life: 0.7, up: 5, blend: 'add' });
      if (lc.revealT <= 0 && !lc.revealShown) { lc.revealShown = true; this._openLootChestReward(); }
      return;
    }

    // ---- hit reaction shake ----
    if (lc.shakeT > 0) { lc.shakeT = Math.max(0, lc.shakeT - sdt); const j = lc.shakeT * 3; lc.mesh.rotation.z = Math.sin(lc.t * 60) * 0.06 * j; lc.mesh.position.y = lc.baseY + Math.abs(Math.sin(lc.t * 40)) * 0.12 * j; }
    else { lc.mesh.rotation.z *= 0.85; lc.mesh.position.y = lc.baseY; }

    // ---- proximity: prompt + body-slam fallback so you can never soft-lock ----
    const w = this.wizard.pos, dx = w.x - lc.x, dz = w.z - lc.z, d2 = dx * dx + dz * dz;
    lc.near = d2 < 4 * 4;
    if (lc.near && !lc.hinted) { lc.hinted = true; }
    if (!lc.near) lc.hinted = false;
    if (lc.touchCd > 0) lc.touchCd -= sdt;
    if (d2 < 1.5 * 1.5 && lc.touchCd <= 0) { lc.touchCd = 0.45; this._strikeLootChest(true); } // ram it
  }

  // a cast (or a body-slam) lands on the chest — 3 good hits crack it wide open
  _strikeLootChest(touch) {
    const lc = this.lootChest; if (!lc || lc.broken) return false;
    if (!touch) { // a spell counts if you're near the coffer OR your aim lands on it
      const w = this.wizard.pos, dw2 = (w.x - lc.x) ** 2 + (w.z - lc.z) ** 2;
      const a = this.aimPoint, da2 = a ? (a.x - lc.x) ** 2 + (a.z - lc.z) ** 2 : 999;
      if (dw2 > 7 * 7 && da2 > 3.5 * 3.5) return false;
    }
    lc.hits++;
    lc.shakeT = 0.3;
    this.audio.play('hit');
    this.shake(0.4);
    // wood chips + gold sparks fly off
    this.particles.burst({ pos: new THREE.Vector3(lc.x, 1.0, lc.z), color: 0x8a5a2f, count: 8, speed: 5, size: 0.16, life: 0.6, up: 2 });
    this.particles.burst({ pos: new THREE.Vector3(lc.x, 1.1, lc.z), color: 0xffe08a, count: 6, speed: 4, size: 0.14, life: 0.5, up: 3, blend: 'add' });
    // the lid creaks further open with each strike
    if (lc.mesh.userData.lid) lc.mesh.userData.lid.rotation.x = -0.12 * lc.hits;
    if (lc.hits >= lc.maxHits) this._breakLootChest();
    else if (this.ui.wispSay && lc.hits === 1) this.ui.wispSay('✦ Keep hitting it — it\'s about to burst!', { ms: 2200 });
    return true;
  }

  _breakLootChest() {
    const lc = this.lootChest; if (!lc || lc.broken) return;
    lc.broken = true; lc.revealT = 0.8; lc.lidVel = 6; lc.lidSpin = 7 + Math.random() * 4;
    this.audio.play('explosion');
    this.shake(1.4);
    this._hitstop(0.1);
    const p = new THREE.Vector3(lc.x, 1.2, lc.z);
    this.particles.ring({ pos: p.clone().setY(0.12), color: 0xffd36b, r0: 0.4, r1: 9, life: 0.7 });
    this.particles.ring({ pos: p.clone().setY(0.12), color: 0xffffff, r0: 0.2, r1: 5, life: 0.5 });
    this.particles.burst({ pos: p.clone(), color: 0xffe58a, count: 40, speed: 10, size: 0.3, life: 1.1, up: 6, blend: 'add' });
    this.particles.burst({ pos: p.clone(), color: 0xffd36b, count: 24, speed: 6, size: 0.24, life: 1.4, up: 8, grav: -3, blend: 'add' });
  }

  // roll the RNG prize, grant it, and show the treasure reveal; on dismiss, carry on
  _openLootChestReward() {
    const lc = this.lootChest; const onDone = lc ? lc.onDone : null;
    const reward = this._rollChestReward();
    this._grantReward(reward);
    if (reward.bonusGems) { meta.addGems(reward.bonusGems); }
    // every chest also yields a brewing gemstone — the only (claim-gated) source now that
    // enemies no longer auto-drop them, so the Cauldron never runs dry.
    if (meta.addGemstone && meta.ELEMENT_LIST) meta.addGemstone(meta.ELEMENT_LIST[Math.floor(Math.random() * meta.ELEMENT_LIST.length)]);
    this._disposeLootChest();
    this.state = 'reveal'; // freeze the field behind the reveal card
    const finish = () => { if (this.state === 'reveal') this.state = 'play'; if (onDone) onDone(); };
    if (this.ui.showChestReward) this.ui.showChestReward(reward, finish);
    else finish();
  }

  // weighted loot table — usually gems, often gear, rarely a jackpot legendary
  _rollChestReward() {
    const lvl = Math.max(1, this.level || 1);
    const depth = (this._forksDone || 0) + 1;
    const r = Math.random();
    if (r < 0.40) return { kind: 'gems', amount: 8 + Math.floor(Math.random() * 8) + depth * 2, tier: 'common' };
    if (r < 0.68) return { kind: 'gear', inst: meta.genGear(null, 'common', lvl), tier: 'common' };
    if (r < 0.83) return { kind: 'gems', amount: 26 + Math.floor(Math.random() * 20) + depth * 3, tier: 'rare' };
    if (r < 0.93) return { kind: 'gear', inst: meta.genGear(null, Math.random() < 0.55 ? 'rare' : 'epic', lvl), tier: 'epic' };
    if (r < 0.96) { const which = Math.random() < 0.5 ? 'heart' : 'brew'; return { kind: which, tier: 'epic' }; }
    // 4% JACKPOT — a legendary piece and a fistful of gems (rare enough to chase, common enough to hit)
    return { kind: 'gear', inst: meta.genGear(null, 'legendary', lvl), tier: 'legendary', bonusGems: 30 };
  }

  _disposeLootChest() {
    const lc = this.lootChest; if (!lc) return;
    if (lc.mesh) { lc.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material && o.material.dispose && !(o.material.userData && o.material.userData.keep)) o.material.dispose(); } }); if (lc.mesh.parent) lc.mesh.parent.remove(lc.mesh); }
    this.lootChest = null;
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

  // ---- the 3D level map: a top-down trail you scroll UP/DOWN with drag, wheel or W/S ----
  _updateLevelMap(dt) {
    this.levelMap.update(dt);
    this.particles.update(dt);
    const span = this.levelMap._span || 40;
    const o = this.input.consumeOrbit();          // reused as a vertical drag
    const z = this.input.consumeZoom ? this.input.consumeZoom() : 0; // wheel / pinch
    let sz = this._mapScrollZ || 0;
    if (o.dy) sz += o.dy * 0.03;                   // drag up → travel toward the boss
    if (z) sz -= z * 0.02;                         // wheel down → toward the boss
    const k = this.input.keys;                     // keyboard up/down also scroll
    if (k) { if (k.has('w') || k.has('arrowup')) sz -= dt * 14; if (k.has('s') || k.has('arrowdown')) sz += dt * 14; }
    this._mapScrollZ = Math.max(-span, Math.min(2, sz));
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
    this.wizard.setEquipment(meta.equippedGearFull()); // title-screen wizard wears your gear
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
    this._ambientFX(dt); // drifting motes on the title so the menu feels alive
    // the demo wizard is immortal
    this.wizard.hp = this.stats.hpMax; this.wizard.alive = true; this.wizard.invuln = 1;
  }
}
