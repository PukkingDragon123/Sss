// game.js — the conductor. Owns the renderer, the world, the state machine
// and the main loop; wires every subsystem together.
import * as THREE from 'three';
import { Wizard, ARENA } from './wizard.js';
import { Enemies } from './enemies.js';
import { Particles } from './particles.js';
import { SpellSystem, SPELL_ORDER, GESTURE_TO_SPELL } from './spells.js';
import { Recognizer, TEMPLATES } from './recognizer.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Director, TAVERN_INTRO, BLACKOUT_LINES } from './story.js';
import { Jobs } from './jobs.js';
import { Tavern } from './tavern.js';
import { rollUpgrades } from './upgrades.js';

const DEFAULT_STATS = () => ({
  hpMax: 100, moveSpeed: 7, wobble: 1.0,
  manaMax: 100, manaRegen: 14,
  damageMult: 1, cooldownMult: 1,
  fireballDmg: 22, fireballRadius: 3.2,
  lightningDmg: 14, lightningChains: 3,
  frostDmg: 10, frostRadius: 5, frostSlow: 0.5, frostSlowTime: 2.5,
  healAmount: 35,
  gustDmg: 4, gustRange: 9, gustForce: 16,
  pickupRadius: 2.2, hpRegen: 0.5, thorns: 0,
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
    this._setMood('forest'); // title screen shows the moonlit forest

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

    // forest floor + mossy clearing
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x2f4a32, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; G.add(floor);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(ARENA, 64), new THREE.MeshStandardMaterial({ color: 0x3f6440, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = 0.01; rug.receiveShadow = true; G.add(rug);
    const rugRing = new THREE.Mesh(new THREE.RingGeometry(ARENA - 0.7, ARENA, 96), new THREE.MeshBasicMaterial({ color: 0xbfe0c2, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    rugRing.rotation.x = -Math.PI / 2; rugRing.position.y = 0.02; G.add(rugRing);

    // a ring of pine trees forms the forest "wall"
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6e3f, roughness: 0.9 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3a824a, roughness: 0.9 });
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2;
      const r = ARENA + 2.5 + (i % 3) * 1.5;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.75, 4, 8), trunkMat); trunk.position.y = 2; trunk.castShadow = true;
      const f1 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.6, 9), leafMat); f1.position.y = 4.3; f1.castShadow = true;
      const f2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.8, 9), leafMat2); f2.position.y = 6.0; f2.castShadow = true;
      tree.add(trunk, f1, f2);
      tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      tree.scale.setScalar(0.85 + Math.random() * 0.7);
      G.add(tree);
    }

    // scattered rocks & toadstools for flavour
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 1 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xc0556a, roughness: 0.8 });
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.9 });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, r = ARENA * (0.2 + Math.random() * 0.55);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (i % 3 === 0) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.5, 7), stalkMat); stalk.position.set(x, 0.25, z); stalk.castShadow = true;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat); cap.position.set(x, 0.5, z); cap.castShadow = true;
        G.add(stalk, cap);
      } else {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.7, 0), rockMat);
        rock.position.set(x, 0.3, z); rock.castShadow = true; rock.receiveShadow = true; G.add(rock);
      }
    }

    // aim reticle on the ground
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 24),
      new THREE.MeshBasicMaterial({ color: 0x6f5fd0, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
    );
    this.reticle.rotation.x = -Math.PI / 2; this.reticle.position.y = 0.05;
    G.add(this.reticle);
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
    const choices = rollUpgrades(3);
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
  shake(a) { this.shakeAmt = Math.min(2.5, this.shakeAmt + a); }

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

  startBoss() {
    if (this.bossActive) return;
    this.bossActive = true;
    const hpScale = 1 + this.elapsed * 0.004; // gentler than trash mobs so it stays beatable
    this.enemies.spawn('boss', hpScale, this.wizard.pos);
    this.ui.toast('👑 THE GOBLIN KING 👑');
    this.shake(2);
    this.audio.play('explosion');
  }

  onBossDead() { this.bossActive = false; this.showStory('The Spirit', ['The GOBLIN KING topples like a felled oak! The forest falls quiet. You survived the night, you glorious sot!']); this._win(); }

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
    const m = Math.floor(this.elapsed / 60), s = Math.floor(this.elapsed % 60);
    this.ui.closeModals();
    this.ui.setScreen('end');
    this.ui.showEnd(win, { time: `${m}:${s.toString().padStart(2, '0')}`, kills: this.kills, level: this.level, chores: this.chores });
  }

  // ---------- lifecycle ----------
  startGame() {
    this.stats = DEFAULT_STATS();
    this.elapsed = 0; this.level = 1; this.xp = 0; this.xpNeed = this._xpForLevel(1);
    this.kills = 0; this.chores = 0; this.pendingLevels = 0; this.bossActive = false;
    this.shakeAmt = 0; this.timeScale = 1; this._endState = null; this._exiting = false;
    this.storyQueue.length = 0; this.storyShowing = false;

    this.enemies.clear();
    this.spells.reset();
    this._clearPickups();
    this.jobs._cleanup();
    this.director.reset();

    this.ui.closeModals();
    this.ui.hideJob();
    this.ui.fadeBlack(false);
    this.ui.setScreen('play');
    this.ui.setMuteIcon(this.audio.muted);

    this.enterTavern();
  }

  // ---- phase 1: the drunk stagger out of the tavern ----
  enterTavern() {
    this.phase = 'tavern';
    this.tavernReady = false;
    this.cineT = 0;
    this._exiting = false;
    this.stats.wobble = 1.8;        // extra sloshed and hard to steer
    this.stats.moveSpeed = 6.5;
    this.tavern.reset();
    this.tavern.show(true);
    this.arenaGroup.visible = false;
    this.wizard.reset(this.stats);
    this.wizard.pos.copy(this.tavern.start);
    this.aimPoint.set(this.tavern.door.x, 0, this.tavern.door.z);
    this.camOffset.set(0, 16, 15);
    this._setMood('tavern');
    this.ui.setPhase('tavern', this.input.isTouch);
    this.ui.bumpTavern(0);
    this.state = 'play';
    this.showStory(TAVERN_INTRO.speaker, TAVERN_INTRO.lines, () => { this.tavernReady = true; });
  }

  onTavernExit(ruckus) {
    if (this._exiting) return;
    this._exiting = true;
    this.lastRuckus = ruckus || 0;
    this.audio.play('jobDone');
    this.state = 'blackout';
    this.ui.fadeBlack(true);
    setTimeout(() => {
      const tally = this.lastRuckus === 0
        ? 'And not a single thing knocked over. Suspiciously graceful.'
        : `You left ${this.lastRuckus} bit(s) of carnage behind. The landlady will remember.`;
      this.showStory(BLACKOUT_LINES.speaker, [...BLACKOUT_LINES.lines, tally], () => this.enterArena());
    }, 1250);
  }

  // ---- phase 2: wake up in the moonlit forest and fight ----
  enterArena() {
    this.phase = 'arena';
    this.stats = DEFAULT_STATS();
    this.elapsed = 0; this.level = 1; this.xp = 0; this.xpNeed = this._xpForLevel(1);
    this.kills = 0; this.chores = 0; this.pendingLevels = 0; this.bossActive = false;
    this._endState = null;
    this.enemies.clear();
    this.spells.reset();
    this._clearPickups();
    this.jobs._cleanup();
    this.director.reset();
    this.wizard.reset(this.stats);
    this.wizard.pos.set(0, 0, 0);
    this.tavern.show(false);
    this.arenaGroup.visible = true;
    this.camOffset.set(0, 27, 22);
    this._setMood('forest');
    this.ui.setPhase('arena', this.input.isTouch);
    this.ui.hideJob();
    this.ui.fadeBlack(false);
    this.state = 'play';
    this.ui.toast('🌲 A moonlit forest…');
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

  castById(id) { if (this.state === 'play' && this.phase === 'arena') this._castAt(id, this.aimPoint); }
  togglePause() {
    if (this.state === 'play') { this.state = 'paused'; this.ui.toast('⏸ Paused'); }
    else if (this.state === 'paused') { this.state = 'play'; this.ui.toast('▶ Resumed'); }
  }
  toggleMute() { this.audio.resume(); this.audio.setMuted(!this.audio.muted); this.ui.setMuteIcon(this.audio.muted); }

  // ---------- input ----------
  _handleInput() {
    const events = this.input.drain();
    for (const e of events) {
      if (e.type === 'mute') { this.audio.setMuted(!this.audio.muted); this.ui.toast(this.audio.muted ? '🔇 Muted' : '🔊 Sound on'); continue; }

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
      else if (e.type === 'quickcast') { const id = SPELL_ORDER[e.index]; if (id) this._castAt(id, this.aimPoint); }
    }
  }

  _resolveGesture(points) {
    if (!points || points.length < 8) { return; }
    const res = this.recognizer.recognize(points);
    if (res && res.score > 0.62) {
      const id = GESTURE_TO_SPELL[res.name];
      if (id) { this._castAt(id, this.gestureAim); return; }
    }
    // a fizzle — show a little puff so it still feels responsive
    this.audio.play('hiccup');
    this.ui.toast('…the glyph fizzles');
    const hp = this.wizard.handPosition();
    this.particles.burst({ pos: hp, color: 0x6a5a82, count: 6, speed: 2, size: 0.2, life: 0.5, grav: 1, blend: 'normal' });
  }

  _castAt(id, aim) {
    const saved = this.aimPoint;
    this.aimPoint = aim;
    this.spells.tryCast(this, id);
    this.aimPoint = saved;
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
    if (this.phase !== 'arena' || !this.input.drawing || this.input.points.length < 2) return;
    const pts = this.input.points;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // glow
    ctx.strokeStyle = 'rgba(155,123,255,0.35)'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    // core
    ctx.strokeStyle = 'rgba(220,205,255,0.95)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    // a dot at the pen tip
    const last = pts[pts.length - 1];
    ctx.fillStyle = 'rgba(255,207,92,0.95)';
    ctx.beginPath(); ctx.arc(last.x, last.y, 6, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- camera ----------
  _updateCamera(dt) {
    // tavern intro: a slow cinematic orbit of the room before you take control
    if (this.phase === 'tavern' && !this.tavernReady) {
      this.cineT += dt;
      const a = this.cineT * 0.35;
      this.camera.position.lerp(new THREE.Vector3(Math.sin(a) * 13, 11, -3 + Math.cos(a) * 13), Math.min(1, dt * 2));
      this.camera.lookAt(this.wizard.pos.x, 1.4, this.wizard.pos.z);
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

    // slow-mo while drawing a glyph (forest fight only)
    const targetScale = (this.state === 'play' && this.phase === 'arena' && this.input.drawing) ? 0.32 : 1;
    this.timeScale += (targetScale - this.timeScale) * Math.min(1, dt * 12);
    const sdt = dt * this.timeScale;

    if (this.state === 'play') {
      if (this.phase === 'tavern') this._updateTavern(sdt);
      else this._updateArena(sdt);
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
  }
}
