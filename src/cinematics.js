// cinematics.js — a little cutscene director: keyframed camera moves, letterbox,
// dialogue with portraits, posed real 3D models on dedicated sets, a smash QTE,
// and the wisp's animated entrance + draw-a-glyph lesson. Self-contained: it owns
// its sets, its wisp actor, and the #cinema DOM.
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// triangle stroke (Fireball glyph) the wisp traces during the draw lesson
const DEMO_GLYPH = [[0, -1], [-0.92, 0.6], [0.92, 0.6], [0, -1]];

export class Cinematics {
  constructor(game) {
    this.game = game; this.scene = game.scene;
    this.active = false; this.script = null; this.idx = 0; this.beatT = 0; this.onDone = null;
    this.scene_ = 'bar';
    this.look = new THREE.Vector3();
    this._build();
    this._bindDom();
  }

  // ---------- sets ----------
  _build() {
    const M = (c, r = 0.85, m = 0, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e, emissiveIntensity: e ? 0.7 : 0 });
    // ===== the cutscene BAR set (a composed corner — NOT the playable tavern) =====
    const bar = this.bar = new THREE.Group(); bar.visible = false; this.scene.add(bar);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), M(0x3a2614, 0.95)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; bar.add(floor);
    for (let i = -4; i <= 4; i++) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 16), M(0x2e1d10, 0.95)); pl.rotation.x = -Math.PI / 2; pl.position.set(i * 1.1, 0.01, -2); bar.add(pl); }
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 0.5), M(0x4a3422, 0.95)); backWall.position.set(0, 3, -6); bar.add(backWall);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 1.5), M(0x5a3a22, 0.85)); counter.position.set(-4.5, 0.55, -3.5); counter.castShadow = true; bar.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.18, 1.8), M(0x8a5a34, 0.4, 0.15)); top.position.set(-4.5, 1.17, -3.5); bar.add(top);
    // bottle shelf
    const bottleCols = [0x6fb08a, 0xb04a4a, 0x4a7ab0, 0xc9a24a, 0x8a5ad0];
    for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.4, 8), M(bottleCols[i % 5], 0.4)); b.position.set(-7 + i * 0.55, 2.1, -5.6); bar.add(b); }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5, 0.16, 0.5), M(0x4a3018)); shelf.position.set(-5, 1.85, -5.6); bar.add(shelf);
    // a hanging lamp (warm)
    const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95 })); lampGlow.position.set(0, 4.2, -1.5); bar.add(lampGlow); this._barFlame = lampGlow;
    const barLight = new THREE.PointLight(0xffca88, 2.6, 26); barLight.position.set(0, 4.2, -1.5); bar.add(barLight);
    const barLight2 = new THREE.PointLight(0xff9a4a, 1.4, 16); barLight2.position.set(-4.5, 2.4, -2); bar.add(barLight2);
    // a couple of patrons watching from stools
    this._barProps = [];
    for (const [x, c] of [[-2.4, 0x7a8bd0], [-6.6, 0x6fb08a]]) {
      const p = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), M(c)); body.position.y = 1.0; body.scale.set(1, 1.15, 1); p.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), M(0xf0d6b8)); head.position.y = 1.62; p.add(head);
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.7, 10), M(0x5a3a22)); stool.position.y = 0.35; p.add(stool);
      p.position.set(x, 0, -2.4); p.traverse(o => { if (o.isMesh) o.castShadow = true; }); bar.add(p);
    }
    // smashables (knocked over during the rampage QTE)
    for (const [x, z] of [[1.6, -1], [3.4, 0.2], [2.4, 1.6], [0.2, 1.2]]) {
      const t = new THREE.Group();
      const tabletop = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.14, 14), M(0x7a5230)); tabletop.position.y = 0.95;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.95, 8), M(0x6a4528)); leg.position.y = 0.47; t.add(tabletop, leg);
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.26, 10), M(0x9a6a3a)); mug.position.y = 1.15; t.add(mug);
      t.position.set(x, 0, z); t.traverse(o => { if (o.isMesh) o.castShadow = true; }); bar.add(t);
      this._barProps.push({ mesh: t, home: t.position.clone(), down: false });
    }

    // ===== the FOREST set (moonlit) =====
    const forest = this.forest = new THREE.Group(); forest.visible = false; this.scene.add(forest);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(16, 40), M(0x223018, 1)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; forest.add(ground);
    const trunkM = M(0x3a2a1e, 0.9), leafM = M(0x1f3a26, 0.9);
    this._eyes = [];
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2, r = 7 + Math.random() * 5;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 2;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.0, 6), trunkM); tr.position.set(x, 0.5, z); tr.castShadow = true; forest.add(tr);
      const lf = new THREE.Mesh(new THREE.ConeGeometry(0.7 + Math.random() * 0.4, 1.8 + Math.random(), 7), leafM); lf.position.set(x, 1.7, z); lf.castShadow = true; forest.add(lf);
      if (i % 3 === 0) { for (const dx of [-0.16, 0.16]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2a18, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); eye.position.set(x + dx, 1.1, z + 0.5); forest.add(eye); this._eyes.push(eye); } }
    }
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ color: 0x6f8a9a, transparent: true, opacity: 0.08 })); mist.rotation.x = -Math.PI / 2; mist.position.y = 0.4; forest.add(mist);
    const moon = new THREE.PointLight(0x9fc4ff, 1.4, 40); moon.position.set(-8, 10, -6); forest.add(moon);

    // the wisp actor (for the forest cutscene) — built, hidden, animated to appear
    const wisp = this.wisp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 14), new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    const wlight = new THREE.PointLight(0x9fe8ff, 0, 10);
    wisp.add(core, halo, wlight); wisp.userData = { core, halo, light: wlight, motes: [] };
    // little orbiting motes (the "more wisps" sparkle)
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); wisp.add(m); wisp.userData.motes.push(m); }
    wisp.visible = false; forest.add(wisp);
  }

  _bindDom() {
    this.el = {
      cinema: $('cinema'), dialogue: $('cine-dialogue'), speaker: $('cine-speaker'), line: $('cine-line'),
      portrait: $('cine-portrait'), next: $('cine-next'), qte: $('cine-qte'), qtePrompt: $('cine-qte-prompt'),
      qteFill: $('cine-qte-fill'), skip: $('cine-skip'),
    };
    if (this.el.next) this.el.next.addEventListener('click', () => this._click());
    if (this.el.skip) this.el.skip.addEventListener('click', () => this._finish());
    this._qteHandler = () => this._qteTap(); // bound to window only while a QTE runs
  }

  // ---------- public ----------
  play(name, onDone) {
    this.script = SCRIPTS[name]; if (!this.script) { if (onDone) onDone(); return; }
    this.active = true; this.idx = -1; this.onDone = onDone || null; this.qte = null;
    this.game.state = 'cutscene';
    this.game.wizard.setVisible(true);
    this.game.tavern.show(false); this.game.tavern.showRoom(false); this.game.arenaGroup.visible = false; this.game.world.show(false);
    // clear menus & the title/HUD so only the cinema shows
    this.game.ui.closeModals();
    this.game.ui.el.title.classList.add('hidden'); this.game.ui.el.end.classList.add('hidden'); this.game.ui.el.hud.classList.add('hidden');
    this.el.cinema.classList.remove('hidden');
    // snap camera near the first beat so it eases into frame
    const b0 = this.script[0];
    if (b0 && b0.cam) { this.game.camera.position.copy(V(b0.cam.pos)).add(new THREE.Vector3(0, 0.6, 1.2)); this.look.copy(V(b0.cam.look)); }
    this._next();
  }

  _setScene(which) {
    if (this.scene_ === which && this._sceneSet) return;
    this.scene_ = which; this._sceneSet = true;
    const g = this.game;
    this.bar.visible = which === 'bar'; this.forest.visible = which === 'forest';
    if (which === 'bar') {
      g.scene.background.setHex(0x241a18); g.scene.fog.color.setHex(0x241a18); g.scene.fog.density = 0.018;
      g.hemi.color.setHex(0xffd9a0); g.hemi.groundColor.setHex(0x3a2418); g.hemi.intensity = 0.55;
      g.dir.color.setHex(0xffd29a); g.dir.intensity = 0.7; g.ambient.color.setHex(0x6a4a3a); g.ambient.intensity = 0.4;
    } else {
      g.scene.background.setHex(0x0a1020); g.scene.fog.color.setHex(0x0c1426); g.scene.fog.density = 0.02;
      g.hemi.color.setHex(0x8fa6d8); g.hemi.groundColor.setHex(0x16241a); g.hemi.intensity = 0.5;
      g.dir.color.setHex(0xbfd0ff); g.dir.intensity = 0.6; g.ambient.color.setHex(0x2a3650); g.ambient.intensity = 0.4;
    }
  }

  _enterBeat() {
    const b = this.script[this.idx]; if (!b) return;
    this.beatT = 0;
    if (this.game.fxctx) this.game.fxctx.clearRect(0, 0, this.game.fx2d.width, this.game.fx2d.height);
    if (b.scene) this._setScene(b.scene);
    // pose the actor
    const w = this.game.wizard;
    if (b.pose) { w.pos.copy(V(b.pose)); w.vel.set(0, 0, 0); }
    if (typeof b.yaw === 'number') { w.yaw = b.yaw; this.game.aimPoint.set(w.pos.x + Math.sin(b.yaw) * 4, 0, w.pos.z + Math.cos(b.yaw) * 4); }
    // dialogue
    if (b.text) {
      this.el.dialogue.classList.remove('hidden');
      this.el.speaker.textContent = b.speaker || '';
      this.el.line.textContent = b.text;
      this.el.portrait.textContent = b.portrait || '🧙';
    } else { this.el.dialogue.classList.add('hidden'); }
    // specials
    this.qte = null; this.el.qte.classList.add('hidden'); this._demo = null;
    if (b.special === 'rampage') this._startRampage();
    else if (b.special === 'drawDemo') this._demo = { t: 0 };
    // (wispAppear: the wisp grows in once, then keeps bobbing — handled in _updateWisp)
  }

  _next() {
    this.idx++;
    if (this.idx >= this.script.length) { this._finish(); return; }
    this._enterBeat();
  }

  _click() {
    const b = this.script[this.idx]; if (!b) return;
    if (this.qte) return;                 // can't skip a QTE with the continue button
    if (b.special === 'wispAppear' && this._wispT < 1.2) return; // let the entrance finish
    if (b.special === 'drawDemo' && this._demo && this._demo.t < 2.6) return; // let the lesson finish
    this.game.audio.play('click');
    this._next();
  }

  _finish() {
    if (!this.active) return;
    this.active = false; this.qte = null;
    window.removeEventListener('pointerdown', this._qteHandler);
    this.el.cinema.classList.add('hidden');
    this.bar.visible = false; this.forest.visible = false;
    if (this.game.fxctx) this.game.fxctx.clearRect(0, 0, this.game.fx2d.width, this.game.fx2d.height);
    const cb = this.onDone; this.onDone = null;
    if (cb) cb();
  }

  // ---------- QTE ----------
  _startRampage() {
    this.qte = { taps: 0, target: 16 };
    for (const p of this._barProps) { p.down = false; p.mesh.rotation.set(0, 0, 0); p.mesh.position.copy(p.home); }
    this.el.qte.classList.remove('hidden');
    this.el.qtePrompt.textContent = '🍺 MASH TO SMASH! 🍺';
    this.el.qteFill.style.width = '0%';
    window.addEventListener('pointerdown', this._qteHandler); // mash anywhere
  }
  _qteTap() {
    const q = this.qte; if (!q) return;
    q.taps++;
    this.el.qteFill.style.width = Math.min(100, q.taps / q.target * 100) + '%';
    this.game.audio.play('hit'); this.game.shake(0.7);
    // lurch the wizard + splinter a prop
    const w = this.game.wizard; w.leanV.x += (Math.random() - 0.5) * 9; w.leanV.z += (Math.random() - 0.5) * 9; w.bob -= 0.6;
    const standing = this._barProps.filter(p => !p.down);
    if (standing.length && Math.random() < 0.5) {
      const p = standing[Math.floor(Math.random() * standing.length)]; p.down = true;
      this.game.particles.burst({ pos: p.home.clone().setY(1), color: 0x7a5230, count: 12, speed: 6, size: 0.28, life: 0.7, grav: -14, blend: 'normal' });
      this.game.audio.play('hiccup');
    }
    if (q.taps >= q.target) {
      this.qte = null; this.el.qte.classList.add('hidden');
      window.removeEventListener('pointerdown', this._qteHandler);
      for (const p of this._barProps) p.down = true;
      this.game.shake(2.5);
      this.game.particles.burst({ pos: new THREE.Vector3(0, 1.2, 0), color: 0xffd166, count: 30, speed: 9, size: 0.3, life: 0.9, blend: 'normal' });
      setTimeout(() => this._next(), 700);
    }
  }

  // ---------- per-frame ----------
  update(dt) {
    if (!this.active) return;
    const g = this.game, b = this.script[this.idx];
    this.beatT += dt;
    if (this._barFlame) this._barFlame.material.opacity = 0.8 + Math.sin(this.beatT * 9) * 0.15;

    // camera: ease toward the beat's keyframe + a gentle handheld drift / slow push-in
    if (b && b.cam) {
      const targetPos = V(b.cam.pos);
      const push = b.cam.push ? Math.min(1, this.beatT * 0.12) : 0; // slow dolly-in
      targetPos.lerp(V(b.cam.look), push * 0.18);
      targetPos.x += Math.sin(this.beatT * 0.7) * 0.06; targetPos.y += Math.sin(this.beatT * 0.9 + 1) * 0.05;
      g.camera.position.lerp(targetPos, Math.min(1, dt * (b.cam.snap ? 6 : 2.2)));
      this.look.lerp(V(b.cam.look), Math.min(1, dt * 2.6));
      g.camera.lookAt(this.look);
    }

    // keep the actor alive (idle sway / arms) but pinned to its pose
    const pose = b && b.pose ? V(b.pose) : g.wizard.pos.clone();
    g.wizard.update(dt, g);
    g.wizard.pos.copy(pose); g.wizard.vel.set(0, 0, 0);
    g.particles.update(dt);

    // animate downed props during/after the rampage
    if (this._barProps) for (const p of this._barProps) { if (p.down) { p.mesh.rotation.z = Math.min(1.45, p.mesh.rotation.z + dt * 4); p.mesh.position.y = Math.max(0.2, p.mesh.position.y - dt * 0.6); } }

    // forest eyes shimmer
    if (this.forest.visible && this._eyes) { const o = 0.5 + Math.abs(Math.sin(this.beatT * 2)) * 0.5; for (const e of this._eyes) e.material.opacity = o; }

    // specials
    if (b && b.special === 'wispAppear') this._updateWisp(dt);
    else if (b && b.special === 'drawDemo') this._updateDemo(dt);
    else if (this.wisp.visible) this._updateWisp(dt); // keep the wisp bobbing once it's appeared

    if (b && !b.text && !this.qte && b.special !== 'drawDemo' && this.beatT >= (b.dur || 2.2)) this._next();

    g.renderer.render(g.scene, g.camera);
  }

  _updateWisp(dt) {
    const w = this.wisp, ud = w.userData;
    if (!w.visible) { w.visible = true; this._wispT = 0; }
    this._wispT = (this._wispT || 0) + dt;
    const grow = Math.min(1, this._wispT / 1.0);
    const ease = 1 - Math.pow(1 - grow, 3);
    w.position.set(1.6, 1.7 + Math.sin(this._wispT * 2) * 0.18, 0.5);
    w.scale.setScalar(0.05 + ease * 1.0);
    ud.core.material.opacity = ease * (0.7 + Math.sin(this._wispT * 6) * 0.25);
    ud.halo.material.opacity = ease * 0.25; ud.light.intensity = ease * 1.4;
    ud.motes.forEach((m, i) => { const a = this._wispT * 2.5 + i * 1.25; m.position.set(Math.cos(a) * 0.6, Math.sin(a * 1.3) * 0.4, Math.sin(a) * 0.6); });
    if (grow >= 1 && !this._wispBurst) { this._wispBurst = true; this.game.particles.burst({ pos: new THREE.Vector3(1.6, 1.8, 0.5), color: 0x9fe8ff, count: 22, speed: 4, size: 0.16, life: 1.0, blend: 'add' }); this.game.audio.play('levelup'); }
  }

  // the wisp traces a glyph in the air (on the 2D fx canvas) to teach drawing
  _updateDemo(dt) {
    this._updateWisp(dt);
    const d = this._demo; if (!d) return; d.t += dt;
    const cv = this.game.fx2d, ctx = this.game.fxctx; if (!cv || !ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const cx = cv.width * 0.5, cy = cv.height * 0.46, s = Math.min(cv.width, cv.height) * 0.16;
    const pts = DEMO_GLYPH.map(p => [cx + p[0] * s, cy + p[1] * s]);
    const prog = Math.min(1, d.t / 1.8);             // reveal the stroke over 1.8s
    const total = pts.length - 1, seg = prog * total;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(159,232,255,0.35)'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    let lx = pts[0][0], ly = pts[0][1];
    for (let i = 1; i <= total; i++) { const f = Math.max(0, Math.min(1, seg - (i - 1))); const x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f; ctx.lineTo(x, y); lx = x; ly = y; if (f < 1) break; }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(223,244,255,0.95)'; ctx.lineWidth = 5; ctx.stroke();
    // the wisp "pen" rides the tip
    ctx.fillStyle = '#dff4ff'; ctx.beginPath(); ctx.arc(lx, ly, 9, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#6ee7a0'; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 7, 0, 6.28); ctx.fill(); // start dot
    if (prog >= 1 && d.t > 2.6 && !d.done) { d.done = true; } // ready to continue
  }
}

// ---------- the 5 cutscenes ----------
// cam pos/look in world units near origin; portrait = an emoji "face"
const SCRIPTS = {
  // 1) POSSESSION — the spirit slips into the snoring wizard at the bar
  possession: [
    { scene: 'bar', pose: [0, 0, 0], yaw: 0.2, cam: { pos: [3.5, 1.6, 5], look: [0, 1.5, 0], push: true }, speaker: 'A Mischievous Spirit', portrait: '👻', text: 'Centuries of drifting, and not a single body to borrow… until tonight.' },
    { scene: 'bar', cam: { pos: [1.2, 1.7, 3], look: [0, 1.7, 0], push: true }, speaker: 'A Mischievous Spirit', portrait: '👻', text: 'There — snoring into his beard: Wobblesworth the Sloshed, the realm\'s drunkest wizard. Perfect.' },
    { scene: 'bar', cam: { pos: [-2, 2.2, 4], look: [0, 1.6, 0] }, special: 'fx', dur: 1.4, speaker: 'The Spirit', portrait: '🌀', text: 'Up you get, old man. Let us… move in.' },
    { scene: 'bar', cam: { pos: [0, 1.4, 4.5], look: [0, 1.6, 0], push: true }, speaker: 'The Spirit', portrait: '🧙', text: 'Ahh — a warm sack of mead and misfired magic, and nobody home. We are going to make BEAUTIFUL mayhem.' },
  ],
  // 2) RAMPAGE — a smash QTE
  rampage: [
    { scene: 'bar', pose: [0, 0, 0], yaw: 0.4, cam: { pos: [0, 2.4, 6], look: [0.6, 1.2, 0] }, speaker: 'The Spirit', portrait: '🧙', text: 'Look at all this lovely BREAKABLE furniture. Let\'s announce ourselves properly…' },
    { scene: 'bar', pose: [0, 0, 0], cam: { pos: [2.5, 2.2, 5], look: [0.5, 1.0, 0.3], snap: true }, special: 'rampage' },
    { scene: 'bar', cam: { pos: [-1.5, 1.6, 5], look: [0.4, 1.0, 0.4], push: true }, speaker: 'The Spirit', portrait: '😈', text: 'HAH! Magnificent. Absolute carnage. Old Tomas is going to be SO cross.' },
  ],
  // 3) THROWN OUT — the patrons hurl the wizard into the night
  thrown: [
    { scene: 'bar', pose: [0, 0, 0], yaw: 3.1, cam: { pos: [0, 2, -5.5], look: [0, 1.4, 0], snap: true }, speaker: 'The Patrons', portrait: '😡', text: 'OUT! Get OUT, you flailing menace! That\'s the LAST pint you smash here!' },
    { scene: 'bar', cam: { pos: [0, 3.5, -7], look: [0, 0.6, 1] }, special: 'fx', dur: 1.6, speaker: 'The Patrons', portrait: '👊', text: '(They seize the wizard by the robes and HURL him through the door, into the cold dark…)' },
  ],
  // 4) WISP — wake in the forest; the wisp appears and teaches the first glyph
  wisp: [
    { scene: 'forest', pose: [0, 0, 0], yaw: 0, cam: { pos: [0, 1.0, 5.5], look: [0, 1.0, 0], push: true }, speaker: 'The Spirit', portrait: '🥴', text: 'Cold moss. Moonlight. A forest, far from any tavern. This is NOT the way home.' },
    { scene: 'forest', cam: { pos: [2, 1.6, 3.5], look: [1.2, 1.6, 0.5] }, special: 'wispAppear', speaker: 'A Wisp', portrait: '✨', text: 'A little light blooms out of the dark and drifts close — a WISP. "Hello, possessed one."' },
    { scene: 'forest', cam: { pos: [1.4, 1.7, 3.2], look: [1.0, 1.7, 0.5], push: true }, special: 'wispAppear', speaker: 'Wisp', portrait: '✨', text: 'I\'ll be your guide. Those red eyes in the trees mean you harm — but you have MAGIC. Let me show you.' },
    { scene: 'forest', cam: { pos: [0, 1.2, 4.4], look: [0, 1.4, 0] }, special: 'drawDemo', speaker: 'Wisp', portrait: '✍️', text: 'To cast Fireball, trace a TRIANGLE — like this. Hold Right-Mouse (or draw on the right on phone) and follow the line!' },
    { scene: 'forest', cam: { pos: [-1.5, 1.4, 4], look: [0, 1.3, 0], push: true }, special: 'wispAppear', speaker: 'Wisp', portrait: '✨', text: 'Cleaner lines hit harder — a perfect glyph CRITS. Now — they\'re coming. Up, wizard, and DRAW!' },
  ],
  // 5) SCOLD — back at the bar, get an earful and the debt
  scold: [
    { scene: 'bar', pose: [0, 0, 0], yaw: 0.1, cam: { pos: [2.5, 1.6, 4.5], look: [0, 1.5, 0], push: true }, speaker: 'Barkeep Tomas', portrait: '😠', text: 'YOU. You wrecked my tavern, then passed out face-down in the woods. Wonderful.' },
    { scene: 'bar', cam: { pos: [0.5, 1.8, 3], look: [0, 1.6, 0] }, speaker: 'Barkeep Tomas', portrait: '🧾', text: 'You owe me for the damages — SIX HUNDRED gold. There\'s a Quest Board you can build for work. Pay. Up.' },
    { scene: 'bar', cam: { pos: [-2, 1.5, 4.5], look: [0, 1.6, 0], push: true }, speaker: 'The Spirit', portrait: '🧙', text: 'Hah. Fine, old goat. We\'ll pay your debt — by getting GLORIOUSLY rich out there. To mayhem!' },
  ],
};
