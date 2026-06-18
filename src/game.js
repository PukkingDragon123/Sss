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
import { Director, INTRO } from './story.js';
import { Jobs } from './jobs.js';
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

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x140d20);
    this.scene.fog = new THREE.FogExp2(0x140d20, 0.012);

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);
    this.camOffset = new THREE.Vector3(0, 30, 22);
    this.camTarget = new THREE.Vector3();

    this._buildWorld();

    // subsystems
    this.audio = new AudioEngine();
    this.particles = new Particles(this.scene);
    this.enemies = new Enemies(this.scene);
    this.spells = new SpellSystem(this.scene);
    this.jobs = new Jobs(this.scene);
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

    window.addEventListener('resize', () => this._resize());
    this._resize();

    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---------- world ----------
  _buildWorld() {
    const hemi = new THREE.HemisphereLight(0x6a5a9c, 0x241830, 0.9);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffe6b0, 1.1);
    dir.position.set(20, 40, 12);
    this.scene.add(dir);
    this.scene.add(new THREE.AmbientLight(0x402d5a, 0.4));

    // floor (tavern boards)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({ color: 0x3a2a44, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // a warm circular rug to mark the brawl zone
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA, 48),
      new THREE.MeshStandardMaterial({ color: 0x5a2f3a, roughness: 1 })
    );
    rug.rotation.x = -Math.PI / 2; rug.position.y = 0.01;
    this.scene.add(rug);
    const rugRing = new THREE.Mesh(
      new THREE.RingGeometry(ARENA - 0.6, ARENA, 64),
      new THREE.MeshBasicMaterial({ color: 0xffcf5c, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    rugRing.rotation.x = -Math.PI / 2; rugRing.position.y = 0.02;
    this.scene.add(rugRing);

    // perimeter walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x241830, roughness: 1 });
    const wallGeo = new THREE.BoxGeometry(ARENA * 2 + 4, 4, 2);
    const mkWall = (x, z, ry) => { const w = new THREE.Mesh(wallGeo, wallMat); w.position.set(x, 2, z); w.rotation.y = ry; this.scene.add(w); };
    mkWall(0, -ARENA - 1, 0); mkWall(0, ARENA + 1, 0);
    mkWall(-ARENA - 1, 0, Math.PI / 2); mkWall(ARENA + 1, 0, Math.PI / 2);

    // decorative barrels & glowing lanterns (emissive only — no extra real lights)
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffcf5c, emissive: 0xff9a3a, emissiveIntensity: 1.2, roughness: 0.5 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = ARENA - 2;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.6, 12), barrelMat);
      barrel.position.set(Math.cos(a) * r, 0.8, Math.sin(a) * r);
      this.scene.add(barrel);
      if (i % 2 === 0) {
        const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), lanternMat);
        lantern.position.set(Math.cos(a) * r, 2.0, Math.sin(a) * r);
        this.scene.add(lantern);
      }
    }

    // aim reticle on the ground
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 24),
      new THREE.MeshBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
    );
    this.reticle.rotation.x = -Math.PI / 2; this.reticle.position.y = 0.05;
    this.scene.add(this.reticle);
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
  showStory(speaker, lines) {
    this.storyQueue.push({ speaker, lines });
    if (!this.storyShowing) this._nextStory();
  }
  _nextStory() {
    if (this.storyQueue.length === 0) { this.storyShowing = false; if (this.state === 'story') this.state = 'play'; return; }
    this.storyShowing = true;
    if (this.state === 'play') this.state = 'story';
    const { speaker, lines } = this.storyQueue.shift();
    this.ui.showStory(speaker, lines, () => this._nextStory());
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
    this.ui.toast('⚠ THE TAB COLLECTOR ⚠');
    this.shake(2);
    this.audio.play('explosion');
  }

  onBossDead() { this.bossActive = false; this.showStory('The Spirit', ['The Tab Collector falls! The pub is saved, the dishes are… mostly done. You win, you glorious sot!']); this._win(); }

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
    this.shakeAmt = 0; this.timeScale = 1; this._endState = null;
    this.storyQueue.length = 0; this.storyShowing = false;

    this.enemies.clear();
    this.spells.reset();
    this._clearPickups();
    this.jobs._cleanup();
    this.director.reset();
    this.wizard.reset(this.stats);

    this.aimPoint.set(0, 0, 6);
    this.ui.closeModals();
    this.ui.hideJob();
    this.ui.setScreen('play');
    this.state = 'play';

    // opening narration
    this.showStory(INTRO.speaker, INTRO.lines);
  }

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
    this.reticle.visible = (this.state === 'play');
    if (this.state !== 'play') return;
    if (!this.input.drawing) {
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
    this.reticle.material.color.setHex(this.input.drawing ? 0xffcf5c : 0x9b7bff);
  }

  // ---------- gesture trail rendering ----------
  _drawTrail() {
    const ctx = this.fxctx;
    ctx.clearRect(0, 0, this.fx2d.width, this.fx2d.height);
    if (!this.input.drawing || this.input.points.length < 2) return;
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

    // slow-mo while drawing a glyph
    const targetScale = (this.state === 'play' && this.input.drawing) ? 0.32 : 1;
    this.timeScale += (targetScale - this.timeScale) * Math.min(1, dt * 12);
    const sdt = dt * this.timeScale;

    if (this.state === 'play') {
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
      // passive regen
      if (this.stats.hpRegen > 0 && this.wizard.alive) this.wizard.heal(this.stats.hpRegen * sdt);

      if (!this.wizard.alive) this._lose();

      // level-ups earned while a story/chore popup was up still open promptly
      if (this.pendingLevels > 0 && this.state === 'play') this._openLevelUp();

      // deferred win (after the boss-death narration has been dismissed)
      if (this._endState === 'win' && !this.storyShowing && this.state === 'play') { this.state = 'win'; this._showEnd(true); }
    } else {
      // keep particles/wizard idle-breathing alive in menus for life
      this.particles.update(dt);
      if (this.state !== 'title') this.wizard.update(0.0001, this);
    }

    this.ui.updateHUD(this);
    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
