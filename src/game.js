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
import { rollUpgrades } from './upgrades.js';
import * as meta from './meta.js';
import { COMBO_META } from './meta.js';

const DEFAULT_STATS = () => ({
  hpMax: 130, moveSpeed: 7.2, wobble: 1.0,
  manaMax: 110, manaRegen: 17,
  damageMult: 1, cooldownMult: 1,
  fireballDmg: 24, fireballRadius: 3.4,
  lightningDmg: 14, lightningChains: 3,
  frostDmg: 10, frostRadius: 5, frostSlow: 0.5, frostSlowTime: 2.5,
  healAmount: 35,
  gustDmg: 5, gustRange: 9, gustForce: 16, gustSelfPush: 26,
  spikeDmg: 30, novaDmg: 26, novaRadius: 6,
  acidDmg: 40, shieldAmount: 60, quakeDmg: 30, quakeRadius: 6, orbDmg: 60, orbRadius: 4.2,
  pickupRadius: 2.6, hpRegen: 1.0, thorns: 0,
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
    this.renderer.toneMappingExposure = 1.12;

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
    this.aimPoint = new THREE.Vector3(0, 0, 5);
    this.gestureAim = this.aimPoint.clone();
    this.storyQueue = [];
    this.storyShowing = false;

    this.pickups = [];
    this._pickupPool = { xp: [], heart: [] };
    this._xpGeo = new THREE.OctahedronGeometry(0.28, 0);
    this._xpMat = new THREE.MeshStandardMaterial({ color: 0x6ee7a0, emissive: 0x1f7a47, roughness: 0.4 });
    this._heartGeo = new THREE.SphereGeometry(0.3, 10, 10);
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
    this.dir.shadow.bias = -0.0004;
    this.dir.shadow.normalBias = 0.03;
    this.scene.add(this.dir);
    this.scene.add(this.dir.target);
    this.ambient = new THREE.AmbientLight(0x3a4a6a, 0.45);
    this.scene.add(this.ambient);

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
    while (grp.children.length) { const c = grp.children.pop(); c.traverse((o) => { if (o.isMesh) o.geometry.dispose(); }); grp.remove(c); }
    const ring = (build) => { for (let i = 0; i < 44; i++) { const a = (i / 44) * Math.PI * 2; const r = ARENA + 2.5 + (i % 3) * 1.5; const o = build(); o.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); o.scale.setScalar(0.85 + Math.random() * 0.7); grp.add(o); } };
    if (kind === 'trees') {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.95 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6e3f, roughness: 0.9 });
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3a824a, roughness: 0.9 });
      ring(() => { const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 4, 8), trunkMat); tr.position.y = 2; tr.castShadow = true; const f1 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.6, 9), leafMat); f1.position.y = 4.3; f1.castShadow = true; const f2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.8, 9), leafMat2); f2.position.y = 6; f2.castShadow = true; t.add(tr, f1, f2); return t; });
    } else if (kind === 'rocks') {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a443e, roughness: 1 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0x5a524a, roughness: 1 });
      ring(() => { const g = new THREE.Group(); const base = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5 + Math.random() * 3, 7), rockMat); base.position.y = 2.5; base.castShadow = true; const tip = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2, 6), tipMat); tip.position.y = 5; g.add(base, tip); return g; });
    } else if (kind === 'graves') {
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6e7a, roughness: 1 });
      const deadMat = new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.95 });
      ring(() => {
        const g = new THREE.Group();
        if (Math.random() < 0.6) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.4), stoneMat); s.position.y = 1.1; s.rotation.z = (Math.random() - 0.5) * 0.3; s.castShadow = true; g.add(s); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 12, 1, false, 0, Math.PI), stoneMat); top.rotation.z = Math.PI / 2; top.position.y = 2.2; g.add(top); }
        else { const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 5, 7), deadMat); trunk.position.y = 2.5; trunk.castShadow = true; const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2, 5), deadMat); b1.position.set(0.8, 4, 0); b1.rotation.z = -0.9; g.add(trunk, b1); }
        return g;
      });
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

  gainXP(n) {
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

  // ---------- pickups ----------
  _getPickup(type) {
    const pool = this._pickupPool[type];
    if (pool.length) { const m = pool.pop(); m.visible = true; return m; }
    const mesh = type === 'xp' ? new THREE.Mesh(this._xpGeo, this._xpMat) : new THREE.Mesh(this._heartGeo, this._heartMat);
    this.scene.add(mesh);
    return mesh;
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

      if (d < 0.9) {
        if (it.type === 'xp') { this.gainXP(it.value); this.audio.play('xp'); }
        else { this.wizard.heal(it.value); this.audio.play('heal'); this.ui.toast(`+${it.value} HP`); }
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
    this.bossActive = false; this.bossKilled = true; this._stageCleared = true;
    this.showStory('The Spirit', [`${this.stage.bossName} falls! ${this.stage.name} is cleared. Pockets full, let\'s stagger home.`]);
    this._win();
  }

  _win() {
    if (this.state === 'win' || this.state === 'gameover') return;
    this._endState = 'win';
    this.audio.play('win');
  }
  _lose() {
    if (this.state === 'win' || this.state === 'gameover') return;
    this.state = 'gameover';
    this.audio.play('gameover');
    this._showEnd(false);
  }
  _showEnd(win) {
    const t = Math.floor(this.elapsed);
    const m = Math.floor(t / 60), s = t % 60;
    const wave = this.director ? this.director.wave : 0;
    if (win && !meta.tavernOwned()) { meta.setTavernOwned(true); this._justInherited = true; } // avenge -> inherit
    // ---- loot ----
    const base = 20;
    const kill = this.kills * 2;
    const waveB = wave * 18;
    const winB = win ? 200 : 0;
    const total = base + kill + waveB + winB;
    meta.addGold(total);
    const questDone = meta.evaluateQuest({ kills: this.kills, time: t, wave, bossKilled: this.bossKilled, win });
    meta.save();
    this.ui.closeModals();
    this.ui.setScreen('end');
    this.ui.showResults(win, {
      time: `${m}:${s.toString().padStart(2, '0')}`, kills: this.kills, level: this.level, wave, stage: this.stage ? this.stage.name : '',
      loot: { base, kill, wave: waveB, win: winB, total }, gold: meta.gold(), questDone,
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
      // opening cinematic (first launch)
      this._opened = true;
      this._openingCine = true;
      this.cineT = 0;
      this.ui.setScreen('cinematic');
      this.showStory(OPENING.speaker, OPENING.lines, () => { this._openingCine = false; this.enterTavern(); });
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
    this.tavern.reset();
    this.tavern.refreshDecor(meta);
    this.tavern.show(true);
    this.arenaGroup.visible = false;
    this.wizard.reset(this.stats);
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
    if (this.state !== 'play' || this.phase !== 'tavern' || !this.nearStation) return;
    let t = this.nearStation.type;
    this.audio.play('click');
    if (t === 'work') { this.startMinigame(); return; }
    if (t === 'door') t = 'stage';
    this._shopKind = t;
    this.state = 'menu';
    this.ui.openShop(t, this);
  }

  startMinigame() {
    this.state = 'menu';
    this.ui.showMinigame(25, (score) => {
      const earned = score * 4;
      meta.addGold(earned); meta.save();
      this.ui.setGold(meta.gold());
      this.ui.toast(`🍺 Earned ${earned}🪙 in tips!`);
      this.state = 'play';
    });
  }
  startRun(stageId) {
    this.ui.closeShop();
    this._shopKind = null;
    this.beginRun(stageId);
  }
  closeShop() {
    if (this.state !== 'menu') return;
    this._shopKind = null;
    this.ui.closeShop();
    this.tavern.refreshDecor(meta);
    this.ui.setGold(meta.gold());
    this.state = 'play';
  }

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

  // ---- a stage run ----
  enterArena(stage) {
    stage = stage || STAGES.forest;
    this.stage = stage;
    this.phase = 'arena';
    this.stats = DEFAULT_STATS();
    if (meta.consumeRest()) this.stats.hpMax += 30; // a good night's rest
    this._applyEquipment();
    this.loadout = meta.getLoadout();
    this.unlocked = new Set(this.loadout);
    this.activeCombos = meta.activeCombos(this.unlocked);
    // per-run recognizer: only the 3 equipped glyphs -> robust recognition
    this.recognizer = new Recognizer();
    for (const id of this.loadout) { const g = SPELLS[id].gesture; this.recognizer.add(g, TEMPLATES[g]); }
    this.elapsed = 0; this.level = 1; this.xp = 0; this.xpNeed = this._xpForLevel(1);
    this.kills = 0; this.chores = 0; this.pendingLevels = 0; this.bossActive = false;
    this.bossKilled = false; this._stageCleared = false; this.bossCine = 0;
    this._endState = null; this._exiting = false; this._lastCast = null;
    this.enemies.clear();
    this.spells.reset();
    this._clearPickups();
    this.director.reset();
    this.wizard.reset(this.stats);
    this.wizard.pos.set(0, 0, 0);
    this.tavern.show(false);
    this.arenaGroup.visible = true;
    this.camOffset.set(0, 27, 22);
    this._applyStageTheme(stage);
    this.ui.setPhase('arena', this.input.isTouch);
    this.ui.setLoadout(this.loadout);
    this.ui.hideJob();
    this.ui.fadeBlack(false);
    this.state = 'play';
    this.director.start(stage);
    this.showStory('The Spirit', stage.intro, () => {
      if (!this._guideShown) { this._guideShown = true; this._guideOpen = true; this.ui.showGuide(); this.state = 'paused'; }
    });
  }

  _applyEquipment() {
    const m = meta.equipMods();
    const s = this.stats;
    if (m.hpMax) s.hpMax += m.hpMax;
    if (m.manaRegen) s.manaRegen += m.manaRegen;
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

  // ---------- input ----------
  _handleInput() {
    const events = this.input.drain();
    for (const e of events) {
      if (e.type === 'mute') { this.toggleMute(); continue; }
      if (e.type === 'guide') { this.toggleGuide(); continue; }
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
    // opening cinematic: slow sweeping orbit over the world
    if (this._openingCine) {
      this.cineT += dt;
      const a = this.cineT * 0.25;
      this.camera.position.lerp(new THREE.Vector3(Math.sin(a) * 26, 16 + Math.sin(a * 0.5) * 4, Math.cos(a) * 26), Math.min(1, dt * 2));
      this.camera.lookAt(this.wizard.pos.x, 1.5, this.wizard.pos.z);
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
    // boss reveal: pull out and frame the boss as it emerges
    if (this.bossCine > 0 && this._bossEnemy && this._bossEnemy.alive) {
      const bp = this._bossEnemy.mesh.position;
      const mid = new THREE.Vector3((bp.x + this.wizard.pos.x) / 2, 0, (bp.z + this.wizard.pos.z) / 2);
      this.camera.position.lerp(new THREE.Vector3(mid.x, 22, mid.z + 20), Math.min(1, dt * 3));
      this.camera.lookAt(bp.x, 2, bp.z);
      return;
    }
    this.camTarget.lerp(this.wizard.pos, Math.min(1, dt * 6));
    const desired = this.camTarget.clone().add(this.camOffset);
    this.camera.position.lerp(desired, Math.min(1, dt * 6));
    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 4);
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.z += (Math.random() - 0.5) * this.shakeAmt;
    }
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + 1.5, this.camTarget.z);
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
      else this._updateArena(sdt);
    } else if (this.state === 'title' && !this._openingCine) {
      this._updateDemo(dt);
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

    if (!this.wizard.alive) this._lose();
    if (this.pendingLevels > 0 && this.state === 'play') this._openLevelUp();
    if (this._endState === 'win' && !this.storyShowing && this.state === 'play') { this.state = 'win'; this._showEnd(true); }
  }

  _updateTavern(sdt) {
    this.wizard.update(sdt, this);
    this.tavern.update(sdt, this);
    this.particles.update(sdt);
    if (meta.tavernOwned()) meta.accrueIdle(sdt); // tycoon ticks while you potter about
  }

  // ---- animated title screen: a drunk wizard auto-blasting waves of foes ----
  enterDemo() {
    this.phase = 'arena';
    this.tavernReady = true; this._openingCine = false; this.bossCine = 0;
    this.stats = DEFAULT_STATS();
    this.tavern.show(false);
    this.arenaGroup.visible = true;
    this._applyStageTheme(STAGES.forest);
    this.camOffset.set(0, 26, 22);
    this.enemies.clear(); this.spells.reset(); this._clearPickups();
    this.wizard.reset(this.stats);
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
