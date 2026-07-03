// cinematics.js — a little cutscene director: keyframed camera moves, letterbox,
// dialogue with portraits, posed real 3D models on dedicated, dressed sets, a smash
// QTE, a drunk-chug beat, a thrown-out-the-door beat, and the wisp's animated
// entrance + draw-a-glyph lesson. Self-contained: it owns its sets, its actors, and
// the #cinema DOM.
import * as THREE from 'three';
import { faceDataURL } from './faces.js';
import { charPortrait } from './charmodels.js';

const $ = (id) => document.getElementById(id);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
// cutscene speakers → their unique 3D pixel model (others fall back to a generic patron).
// Every speaker — including the wisp — gets a portrait rendered from its REAL model,
// so the face in the dialogue box always matches the character on screen.
const SPEAKER_KIND = { 'Wobblesworth': 'wizard', 'Barkeep Tomas': 'barkeep', 'The Patrons': 'patron', 'Wisp': 'wisp' };

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
    const glow = (c, o = 0.95) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });

    // ===== the cutscene BAR set (a composed, dressed corner — NOT the playable tavern) =====
    const bar = this.bar = new THREE.Group(); bar.visible = false; this.scene.add(bar);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 32), M(0x3a2614, 0.95)); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; bar.add(floor);
    for (let i = -5; i <= 5; i++) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 18), M(0x2a1a0e, 0.95)); pl.rotation.x = -Math.PI / 2; pl.position.set(i * 1.1, 0.01, -2); bar.add(pl); }
    // a worn red rug under the centre of the room
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 5), M(0x6a2420, 0.98)); rug.rotation.x = -Math.PI / 2; rug.position.set(0.5, 0.02, 0.2); bar.add(rug);
    const rugTrim = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.15, 4), M(0xb88a3a, 0.9)); rugTrim.rotation.x = -Math.PI / 2; rugTrim.position.set(0.5, 0.025, 0.2); rugTrim.rotation.z = Math.PI / 4; bar.add(rugTrim);
    // walls
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(34, 11, 0.5), M(0x4a3422, 0.95)); backWall.position.set(0, 4, -6); bar.add(backWall);
    // tall, wide side walls on BOTH sides so the cutscene camera never sees past the set into the void
    const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 24), M(0x42301f, 0.95)); sideWallL.position.set(-15, 4, -2); bar.add(sideWallL);
    const sideWallR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 24), M(0x42301f, 0.95)); sideWallR.position.set(15, 4, -2); bar.add(sideWallR);
    // wainscot stripe
    const wains = new THREE.Mesh(new THREE.BoxGeometry(34, 1.4, 0.1), M(0x35241600, 0.9)); wains.material.color.setHex(0x35241a); wains.position.set(0, 1.0, -5.72); bar.add(wains);

    // ---- bar counter + back shelf ----
    const counter = new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 1.5), M(0x5a3a22, 0.85)); counter.position.set(-4.5, 0.55, -3.5); counter.castShadow = true; bar.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.18, 1.8), M(0x8a5a34, 0.4, 0.15)); top.position.set(-4.5, 1.17, -3.5); bar.add(top);
    const bottleCols = [0x6fb08a, 0xb04a4a, 0x4a7ab0, 0xc9a24a, 0x8a5ad0];
    for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.4, 8), M(bottleCols[i % 5], 0.4)); b.position.set(-7 + i * 0.55, 2.1, -5.6); bar.add(b); }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5, 0.16, 0.5), M(0x4a3018)); shelf.position.set(-5, 1.85, -5.6); bar.add(shelf);
    // hanging mugs over the bar
    const mugRail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 0.08), M(0x2a1c10)); mugRail.position.set(-4.5, 2.7, -4.2); bar.add(mugRail);
    for (let i = 0; i < 5; i++) { const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 8), M(0x8a5a34, 0.5)); mug.position.set(-6.3 + i * 0.9, 2.5, -4.2); bar.add(mug); }

    // ---- BARKEEP TOMAS (behind the counter; he speaks in 'scold') ----
    const tomas = this._tomas = new THREE.Group();
    const tBody = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), M(0x6a4d34)); tBody.position.y = 1.0; tBody.scale.set(1, 1.25, 1); tomas.add(tBody);
    const tApron = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.18), M(0xd8c39a, 0.95)); tApron.position.set(0, 0.95, 0.42); tomas.add(tApron);
    const tHead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), M(0xf0c89a)); tHead.position.y = 1.75; tomas.add(tHead);
    const tMous = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.12), M(0x6a4326)); tMous.position.set(0, 1.66, 0.3); tomas.add(tMous);
    const tHair = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 6, 14), M(0x6a4326)); tHair.position.set(0, 1.82, 0); tHair.rotation.x = Math.PI / 2; tomas.add(tHair);
    for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 4, 8), M(0x6a4d34)); arm.position.set(sx * 0.5, 1.0, 0.18); arm.rotation.z = sx * 0.5; tomas.add(arm); }
    tomas.position.set(-4.5, 0, -4.7); tomas.traverse(o => { if (o.isMesh) o.castShadow = true; }); bar.add(tomas);

    // ---- FIREPLACE (back wall, right of centre) with a live flicker light ----
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 0.7), M(0x52504e, 0.96)); hearth.position.set(3.2, 1.4, -5.7); bar.add(hearth);
    const fireMouth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 0.4), M(0x140a06, 1)); fireMouth.position.set(3.2, 0.85, -5.5); bar.add(fireMouth);
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.28, 0.95), M(0x7a5230, 0.7)); mantel.position.set(3.2, 2.95, -5.6); bar.add(mantel);
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 7), M(0x3a2414)); logs.rotation.z = Math.PI / 2; logs.position.set(3.2, 0.45, -5.45); bar.add(logs);
    const fire = this._fire = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 10), glow(0xff9a3a, 0.92)); fire.position.set(3.2, 1.0, -5.45); bar.add(fire);
    const fireCore = this._fireCore = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), glow(0xffe27a, 0.95)); fireCore.position.set(3.2, 0.95, -5.4); bar.add(fireCore);
    const fireLight = this._fireLight = new THREE.PointLight(0xff8a3a, 2.4, 18); fireLight.position.set(3.2, 1.2, -5.0); bar.add(fireLight);

    // ---- wall sconces (warm) ----
    this._sconces = [];
    for (const sx of [-2.2, 0.4]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.3, 8), M(0x3a2a1a)); cup.position.set(sx, 3.4, -5.6); bar.add(cup);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), glow(0xffd9a0, 0.95)); flame.position.set(sx, 3.62, -5.55); bar.add(flame);
      const sl = new THREE.PointLight(0xffca88, 0.9, 9); sl.position.set(sx, 3.7, -5.2); bar.add(sl);
      this._sconces.push({ flame, light: sl, base: 0.9 });
    }
    // a hanging lamp (warm, central)
    const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), glow(0xffd9a0)); lampGlow.position.set(0, 4.2, -1.5); bar.add(lampGlow); this._barFlame = lampGlow;
    const barLight = new THREE.PointLight(0xffca88, 2.2, 26); barLight.position.set(0, 4.2, -1.5); bar.add(barLight);

    // ---- wall decor: dartboard + two framed pictures ----
    const dart = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), M(0xc8503a, 0.9)); dart.position.set(-1.4, 3.0, -5.7); bar.add(dart);
    const dartIn = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18), M(0xe8d8b0, 0.9)); dartIn.position.set(-1.4, 3.0, -5.69); bar.add(dartIn);
    const dartBull = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), M(0x2a1c10, 0.9)); dartBull.position.set(-1.4, 3.0, -5.68); bar.add(dartBull);
    for (const [fx, fc] of [[5.0, 0x2a5a7a], [5.9, 0x6a4a2a]]) { const fr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.08), M(0x3a2a1a)); fr.position.set(fx, 3.2, -5.68); bar.add(fr); const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.8), M(fc, 0.95)); pic.position.set(fx, 3.2, -5.62); bar.add(pic); }

    // ---- stacked barrels in the corner ----
    for (const [bx, bz, by] of [[-8.6, -3.0, 0.55], [-8.6, -4.3, 0.55], [-8.55, -3.65, 1.55]]) { const bl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.55, 1.1, 14), M(0x6a4528, 0.85)); bl.position.set(bx, by, bz); bl.castShadow = true; bar.add(bl); for (const ry of [0.32, -0.32]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 18), M(0x2a1c10, 0.6, 0.3)); hoop.position.set(bx, by + ry, bz); hoop.rotation.x = Math.PI / 2; bar.add(hoop); } }

    // ---- the DOOR (the wizard gets HURLED through it in 'thrown') ----
    const door = this._door = new THREE.Group(); door.position.set(8.0, 0, -5.7);
    const night = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.4), M(0x0a1430, 1, 0, 0x0a1430)); night.position.set(0, 1.7, -0.05); door.add(night);
    for (let i = 0; i < 6; i++) { const star = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), glow(0xdfeaff, 0.9)); star.position.set((Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 2, 0); door.add(star); }
    const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.7, 0.5), M(0x3a2818)); jambL.position.set(-1.15, 1.85, 0); door.add(jambL);
    const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.7, 0.5), M(0x3a2818)); jambR.position.set(1.15, 1.85, 0); door.add(jambR);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.35, 0.5), M(0x3a2818)); lintel.position.set(0, 3.75, 0); door.add(lintel);
    const panel = this._doorPanel = new THREE.Group(); panel.position.set(-1.0, 0, 0.18);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.4, 0.14), M(0x5a3c22, 0.85)); slab.position.set(0.95, 1.7, 0); panel.add(slab);
    door.add(panel); bar.add(door);

    // ---- patrons on stools (they yell during 'thrown') ----
    this._patrons = [];
    for (const [x, c] of [[-2.4, 0x7a8bd0], [-6.6, 0x6fb08a]]) {
      const p = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), M(c)); body.position.y = 1.0; body.scale.set(1, 1.15, 1); p.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), M(0xf0d6b8)); head.position.y = 1.62; p.add(head);
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.7, 10), M(0x5a3a22)); stool.position.y = 0.35; p.add(stool);
      p.position.set(x, 0, -2.4); p.traverse(o => { if (o.isMesh) o.castShadow = true; }); bar.add(p);
      this._patrons.push({ mesh: p, home: p.position.clone() });
    }

    // ---- smashables (knocked over during the rampage QTE) ----
    this._barProps = [];
    for (const [x, z] of [[1.6, -1], [3.4, 0.2], [2.4, 1.6], [0.2, 1.2]]) {
      const t = new THREE.Group();
      const tabletop = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.14, 14), M(0x7a5230)); tabletop.position.y = 0.95;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.95, 8), M(0x6a4528)); leg.position.y = 0.47; t.add(tabletop, leg);
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.26, 10), M(0x9a6a3a)); mug.position.y = 1.15; t.add(mug);
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.6, 9), M(0x5a3a22)); stool.position.set(0.85, 0.3, 0.2); t.add(stool);
      t.position.set(x, 0, z); t.traverse(o => { if (o.isMesh) o.castShadow = true; }); bar.add(t);
      this._barProps.push({ mesh: t, home: t.position.clone(), down: false });
    }

    // (no possessing spirit — the wizard is simply, gloriously drunk)

    // ===== the FOREST set (moonlit) =====
    const forest = this.forest = new THREE.Group(); forest.visible = false; this.scene.add(forest);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(16, 40), M(0x223018, 1)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; forest.add(ground);
    // a worn dirt path leading off into the trees
    const path = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 16), M(0x4a3a22, 1)); path.rotation.x = -Math.PI / 2; path.position.set(0.5, 0.015, -3); forest.add(path);
    const trunkM = M(0x3a2a1e, 0.9), leafM = M(0x1f3a26, 0.9);
    this._eyes = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, r = 7 + (i % 4) * 1.4;
      const x = Math.cos(a) * r, z = Math.sin(a) * r - 2;
      const h = 1.6 + (i % 3) * 0.5;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, h, 6), trunkM); tr.position.set(x, h / 2, z); tr.castShadow = true; forest.add(tr);
      const lf = new THREE.Mesh(new THREE.ConeGeometry(0.8 + (i % 3) * 0.25, 2.0 + (i % 2) * 0.8, 7), leafM); lf.position.set(x, h + 0.9, z); lf.castShadow = true; forest.add(lf);
      if (i % 3 === 0) { for (const dx of [-0.16, 0.16]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2a18, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); eye.position.set(x + dx, 1.1, z + 0.5); forest.add(eye); this._eyes.push(eye); } }
    }
    // ---- the waking spot: a dead campfire, a bedroll, a fallen log, mossy rocks ----
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), M(0x6a6a66, 0.95)); stone.position.set(-1.4 + Math.cos(a) * 0.6, 0.12, 1.2 + Math.sin(a) * 0.6); forest.add(stone); }
    const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 12), M(0x2a2622, 1)); ash.position.set(-1.4, 0.05, 1.2); forest.add(ash);
    for (const rot of [0.5, -0.7]) { const cl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.8, 6), M(0x1e160e)); cl.rotation.z = Math.PI / 2; cl.rotation.y = rot; cl.position.set(-1.4, 0.12, 1.2); forest.add(cl); }
    const ember = this._ember = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), glow(0xff7a2a, 0.7)); ember.position.set(-1.4, 0.12, 1.2); forest.add(ember);
    const emberLight = this._emberLight = new THREE.PointLight(0xff7a2a, 0.5, 5); emberLight.position.set(-1.4, 0.3, 1.2); forest.add(emberLight);
    const bedroll = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.3, 4, 8), M(0x7a4530, 0.95)); bedroll.rotation.z = Math.PI / 2; bedroll.position.set(0.4, 0.28, 1.6); forest.add(bedroll);
    const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 3.4, 8), M(0x3a2a1c, 0.95)); fallen.rotation.z = Math.PI / 2; fallen.position.set(2.6, 0.3, 0.6); fallen.castShadow = true; forest.add(fallen);
    for (const [rx, rz, rs] of [[-3.2, 2.2, 0.5], [3.8, 2.4, 0.65], [-4.4, 0.4, 0.4]]) { const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rs, 0), M(0x5a5a54, 0.96)); rock.position.set(rx, rs * 0.7, rz); rock.castShadow = true; forest.add(rock); }
    // ---- drifting fireflies ----
    this._fireflies = [];
    for (let i = 0; i < 10; i++) { const ff = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), glow(0xc6ff8a, 0.9)); ff.position.set((Math.random() - 0.5) * 12, 0.6 + Math.random() * 2.2, (Math.random() - 0.5) * 10 - 2); forest.add(ff); this._fireflies.push({ mesh: ff, phase: i * 0.9, base: ff.position.clone() }); }
    const mist = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ color: 0x6f8a9a, transparent: true, opacity: 0.08 })); mist.rotation.x = -Math.PI / 2; mist.position.y = 0.4; forest.add(mist);
    const moon = new THREE.PointLight(0x9fc4ff, 1.4, 40); moon.position.set(-8, 10, -6); forest.add(moon);

    // the wisp actor (for the forest cutscene) — built, hidden, animated to appear
    const wisp = this.wisp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), glow(0xdff4ff, 0.95));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 14), glow(0x7fd0ff, 0.25));
    const wlight = new THREE.PointLight(0x9fe8ff, 0, 10);
    wisp.add(core, halo, wlight); wisp.userData = { core, halo, light: wlight, motes: [] };
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), glow(0xbfeaff, 0.9)); wisp.add(m); wisp.userData.motes.push(m); }
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
    // reset any set state that a prior cutscene left dirty
    this._resetSets();
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

  _resetSets() {
    for (const p of this._barProps) { p.down = false; p.mesh.rotation.set(0, 0, 0); p.mesh.position.copy(p.home); }
    for (const p of this._patrons) { p.mesh.position.copy(p.home); p.mesh.rotation.set(0, 0, 0); p.lurch = false; }
    if (this._doorPanel) this._doorPanel.rotation.y = 0;
    this._drunk = null; this._throw = null; this._wispBurst = false;
  }

  _setScene(which) {
    const g = this.game;
    // ALWAYS set visibility first — a prior same-scene cutscene leaves scene_ stale while
    // _finish() hid the set, so gating visibility behind the guard left the set invisible
    // (the bug where the rampage/thrown bar showed empty). The guard only skips the heavy
    // fog/light churn when the scene is genuinely unchanged.
    this.bar.visible = which === 'bar'; this.forest.visible = which === 'forest';
    if (this.scene_ === which && this._sceneSet) return;
    this.scene_ = which; this._sceneSet = true;
    if (which === 'bar') {
      g.scene.background.setHex(0x241a18); g.scene.fog.color.setHex(0x241a18); g.scene.fog.density = 0.008;
      g.hemi.color.setHex(0xffd9a0); g.hemi.groundColor.setHex(0x3a2418); g.hemi.intensity = 0.5;
      g.dir.color.setHex(0xffd29a); g.dir.intensity = 0.6; g.ambient.color.setHex(0x6a4a3a); g.ambient.intensity = 0.36;
    } else {
      g.scene.background.setHex(0x0a1020); g.scene.fog.color.setHex(0x0c1426); g.scene.fog.density = 0.011;
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
      this._typer = { full: b.text, n: 0 };            // typewriter reveal (advanced in update)
      this.el.line.textContent = '';
      if (this.el.portrait) this.el.portrait.classList.add('speaking');
      // portrait = a render of the speaker's REAL 3D model, held constant across
      // the whole conversation so the face always matches who's talking
      const url = b.speaker ? (charPortrait(SPEAKER_KIND[b.speaker] || 'patron') || faceDataURL(b.speaker)) : '';
      if (url) {
        this.el.portrait.textContent = '';
        this.el.portrait.style.backgroundImage = `url(${url})`;
        this.el.portrait.classList.add('has-face');
      } else {
        this.el.portrait.style.backgroundImage = '';
        this.el.portrait.classList.remove('has-face');
        this.el.portrait.textContent = '';
      }
    } else { this._typer = null; if (this.el.portrait) this.el.portrait.classList.remove('speaking'); this.el.dialogue.classList.add('hidden'); }
    // specials
    this.qte = null; this.el.qte.classList.add('hidden'); this._demo = null;
    if (b.special === 'rampage') this._startRampage();
    else if (b.special === 'drawDemo') this._demo = { t: 0 };
    else if (b.special === 'getDrunk') { this._drunk = { t: 0, done: false }; }
    else if (b.special === 'throw') { this._throw = { t: 0, from: V(b.pose || [4.5, 0.6, -2]) }; }
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
    if (b.special === 'getDrunk' && this._drunk && this._drunk.t < 1.1) return; // let the gulp land
    if (b.special === 'throw' && this._throw && this._throw.t < 1.3) return;      // let him fly
    if (this._typer) { // first click finishes the typewriter; next click advances
      this.el.line.textContent = this._typer.full; this._typer = null;
      if (this.el.portrait) this.el.portrait.classList.remove('speaking');
      this.game.audio.play('click'); return;
    }
    this.game.audio.play('click');
    this._next();
  }

  _finish() {
    if (!this.active) return;
    this.active = false; this.qte = null; this._typer = null;
    if (this.el.portrait) this.el.portrait.classList.remove('speaking');
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
    this.el.qtePrompt.textContent = 'MASH TO SMASH!';
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

    // typewriter: reveal the current line character-by-character
    if (this._typer) {
      this._typer.n += dt * 46;
      const full = this._typer.full;
      if (this._typer.n >= full.length) { this.el.line.textContent = full; this._typer = null; if (this.el.portrait) this.el.portrait.classList.remove('speaking'); }
      else this.el.line.textContent = full.slice(0, Math.floor(this._typer.n));
    }

    // ambient set life: lamp + fireplace flicker, sconces, fireflies, eyes
    if (this.bar.visible) {
      if (this._barFlame) this._barFlame.material.opacity = 0.8 + Math.sin(this.beatT * 9) * 0.12;
      if (this._fire) { const fl = 0.85 + Math.sin(this.beatT * 13) * 0.12 + Math.sin(this.beatT * 27) * 0.06; this._fire.material.opacity = fl; this._fire.scale.y = 0.9 + (fl - 0.85) * 1.4; this._fireCore.material.opacity = 0.85 + Math.sin(this.beatT * 19) * 0.12; this._fireLight.intensity = 2.0 + (fl - 0.85) * 7; }
      for (const s of this._sconces) { s.light.intensity = s.base + Math.sin(this.beatT * 11 + s.flame.position.x) * 0.2; s.flame.material.opacity = 0.85 + Math.sin(this.beatT * 14 + s.flame.position.x) * 0.12; }
    }

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

    // keep the actor alive (idle sway / arms)
    g.wizard.update(dt, g);
    if (b && b.special === 'throw') {
      this._updateThrow(dt);              // throw drives the wizard's position itself
    } else {
      const pose = b && b.pose ? V(b.pose) : g.wizard.pos.clone();
      g.wizard.pos.copy(pose); g.wizard.vel.set(0, 0, 0);
    }
    g.particles.update(dt);

    // animate downed props during/after the rampage
    if (this._barProps) for (const p of this._barProps) { if (p.down) { p.mesh.rotation.z = Math.min(1.45, p.mesh.rotation.z + dt * 4); p.mesh.position.y = Math.max(0.2, p.mesh.position.y - dt * 0.6); } }

    // forest life: eyes shimmer + fireflies drift + embers pulse
    if (this.forest.visible) {
      if (this._eyes) { const o = 0.5 + Math.abs(Math.sin(this.beatT * 2)) * 0.5; for (const e of this._eyes) e.material.opacity = o; }
      if (this._fireflies) for (const f of this._fireflies) { const t = this.beatT + f.phase; f.mesh.position.set(f.base.x + Math.sin(t * 0.8) * 0.7, f.base.y + Math.sin(t * 1.3) * 0.4, f.base.z + Math.cos(t * 0.7) * 0.7); f.mesh.material.opacity = 0.5 + Math.abs(Math.sin(t * 2.2)) * 0.5; }
      if (this._ember) { const e = 0.55 + Math.abs(Math.sin(this.beatT * 1.6)) * 0.4; this._ember.material.opacity = e; this._emberLight.intensity = 0.35 + e * 0.4; }
    }

    // specials
    if (b && b.special === 'wispAppear') this._updateWisp(dt);
    else if (b && b.special === 'drawDemo') this._updateDemo(dt);
    else if (b && b.special === 'getDrunk') this._updateDrunk(dt);
    else if (this.wisp.visible && this.forest.visible) this._updateWisp(dt); // keep the wisp bobbing once it's appeared

    if (b && !b.text && !this.qte && b.special !== 'drawDemo' && b.special !== 'getDrunk' && b.special !== 'throw' && this.beatT >= (b.dur || 2.2)) this._next();

    g.present();
  }

  // the wizard tips his mug back and CHUGS — a big amber gulp, a hiccup, a woozy lurch
  _updateDrunk(dt) {
    const p = this._drunk, w = this.game.wizard; if (!p) return;
    p.t += dt;
    if (p.t < 0.8) { w.leanV.z -= dt * 7; }     // tip the head back, chugging
    if (p.t >= 0.8 && !p.done) {
      p.done = true;
      w.leanV.x += (Math.random() - 0.5) * 9; w.leanV.z += 11; w.bob -= 1.0; // the gulp lands; he reels
      this.game.shake(1.2);
      this.game.particles.burst({ pos: w.pos.clone().setY(1.7), color: 0xffd07a, count: 20, speed: 5, size: 0.2, life: 0.9, grav: 3, blend: 'normal' });
      this.game.audio.play('hiccup');
    }
  }

  // the patrons hurl the wizard up in a tumbling arc, out through the door
  _updateThrow(dt) {
    const th = this._throw, w = this.game.wizard, g = this.game; if (!th) return;
    th.t += dt;
    const T = Math.min(1, th.t / 1.1);
    // arc from the launch point toward & through the doorway (x≈8.0, z≈-5.7)
    const ex = 8.0, ez = -6.6, ey = 1.4;
    w.pos.x = th.from.x + (ex - th.from.x) * T;
    w.pos.z = th.from.z + (ez - th.from.z) * T;
    w.pos.y = th.from.y + Math.sin(T * Math.PI) * 2.6 + (ey - th.from.y) * T;
    w.yaw += dt * 9; w.leanV.x += dt * 8; w.leanV.z += dt * 6; // tumble
    w.vel.set(0, 0, 0);
    if (!th.kicked && th.t > 0.02) { // launch puff + door bang + shove
      th.kicked = true;
      this.game.shake(1.8); this.game.audio.play('hit');
      this.game.particles.burst({ pos: th.from.clone().setY(0.6), color: 0xb89a6a, count: 22, speed: 7, size: 0.3, life: 0.8, grav: -10, blend: 'normal' });
      for (const p of this._patrons) p.lurch = true;
    }
    if (this._doorPanel) this._doorPanel.rotation.y = -Math.min(1.3, T * 1.6); // door flings open
    for (const p of this._patrons) if (p.lurch) p.mesh.position.x = p.home.x + Math.min(1.2, th.t * 2.5); // patrons surge after him
    if (T >= 1) { g.wizard.setVisible(false); } // gone into the night
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
// cam pos/look in world units; portrait = an emoji "face". Lines kept short + punchy.
const SCRIPTS = {
  // 1) DRUNK — Wobblesworth drinks himself silly at the bar (no spirit — he's just plastered)
  drunk: [
    { scene: 'bar', pose: [0, 0, 0], yaw: 0.2, cam: { pos: [3.2, 1.6, 5], look: [0, 1.5, 0], push: true }, speaker: 'Wobblesworth', text: 'Another ale, Tomas! Keep them coming. It has been a long, dry week.' },
    { scene: 'bar', pose: [0, 0, 0], cam: { pos: [-1.4, 1.9, 3.2], look: [0, 1.5, 0] }, special: 'getDrunk', speaker: 'Wobblesworth', text: 'Gulp. Whew. The room is going all swimmy. I feel great.' },
    { scene: 'bar', cam: { pos: [0, 1.4, 4.5], look: [0, 1.6, 0], push: true }, speaker: 'Wobblesworth', text: 'You know what this dusty old place needs? A bit of chaos. Hehe.' },
  ],
  // 2) RAMPAGE — just the drunk wizard wrecking the place; a smash QTE, no narration.
  // Wide shots keep the whole dressed bar (counter, fireplace, barrels, tables) in frame.
  rampage: [
    { scene: 'bar', pose: [0, 0, 0], yaw: 0.4, cam: { pos: [0, 3.0, 8], look: [0.4, 1.2, -0.5], push: true }, dur: 1.7 },
    { scene: 'bar', pose: [0, 0, 0], cam: { pos: [0.4, 3.0, 7.6], look: [0.5, 1.0, -0.4] }, special: 'rampage' },
    { scene: 'bar', cam: { pos: [-1.6, 2.6, 7], look: [0.4, 1.0, -0.2], push: true }, dur: 1.9 },
  ],
  // 3) THROWN OUT — the patrons hurl the wizard through the door
  thrown: [
    { scene: 'bar', pose: [4.5, 0, -2], yaw: 2.4, cam: { pos: [1.4, 2.0, 1.5], look: [4.4, 1.4, -4], snap: true }, speaker: 'Barkeep Tomas', text: 'Out! Get out, you clumsy fool!' },
    { scene: 'bar', pose: [4.5, 0.6, -2], cam: { pos: [1.4, 2.7, 2.2], look: [6.0, 1.5, -4.5] }, special: 'throw', speaker: 'The Patrons', text: 'And stay out!' },
  ],
  // 4) WISP — wake in the forest; the wisp ZOOMS IN and is the SOLE teacher of every
  // core mechanic (cast, crit, mana/chug, motes/level, gems vs gold). Short lines.
  wisp: [
    { scene: 'forest', pose: [0, 0, 0], yaw: 0, cam: { pos: [0, 1.0, 5.5], look: [0, 1.0, 0], push: true }, speaker: 'Wobblesworth', text: 'Ugh. Cold moss and moonlight. This is not home.' },
    { scene: 'forest', cam: { pos: [1.75, 1.9, 2.6], look: [1.6, 1.78, 0.5], push: true }, special: 'wispAppear', speaker: 'Wisp', text: 'Hello there, wizard. I am your wisp, your guide. Stay close and I will teach you everything.' },
    { scene: 'forest', cam: { pos: [0, 1.2, 4.4], look: [0, 1.4, 0] }, special: 'drawDemo', speaker: 'Wisp', text: 'To cast a spell you draw a shape. A triangle makes a fireball. Watch me draw it.' },
    { scene: 'forest', cam: { pos: [1.6, 1.85, 2.8], look: [1.6, 1.78, 0.5], push: true }, special: 'wispAppear', speaker: 'Wisp', text: 'Now you try. Hold right click, or draw on the right side on a phone. Neater shapes hit harder, and a perfect one is a critical hit.' },
    { scene: 'forest', cam: { pos: [1.55, 1.85, 2.9], look: [1.6, 1.78, 0.5] }, special: 'wispAppear', speaker: 'Wisp', text: 'Spells cost mana, and your mana is beer. It does not refill on its own. Tap the beer button to chug and fill it up. It will make the room spin.' },
    { scene: 'forest', cam: { pos: [1.65, 1.85, 3.0], look: [1.6, 1.78, 0.5], push: true }, special: 'wispAppear', speaker: 'Wisp', text: 'Beaten foes drop glowing motes. Soak them up to level up and pick a new power. Winning a run earns gems for new spells.' },
    { scene: 'forest', cam: { pos: [-1.5, 1.4, 4], look: [0, 1.3, 0], push: true }, special: 'wispAppear', speaker: 'Wisp', text: 'Gold you earn back at the bar. That is the gist of it. They are coming now. Get up and draw!' },
  ],
  // 5) SCOLD — back at the bar, get an earful and the debt
  scold: [
    { scene: 'bar', pose: [0, 0, 0], yaw: 0.1, cam: { pos: [2.5, 1.6, 4.5], look: [0, 1.5, 0], push: true }, speaker: 'Barkeep Tomas', text: 'You! You wrecked my tavern and then passed out in the woods.' },
    { scene: 'bar', cam: { pos: [0.5, 1.8, 3], look: [0, 1.6, 0] }, speaker: 'Barkeep Tomas', text: 'You owe me 600 gold. Track it in your quest log and work it off.' },
    { scene: 'bar', cam: { pos: [-2, 1.5, 4.5], look: [0, 1.6, 0], push: true }, speaker: 'Wobblesworth', text: 'Fine, you old goat. I will get rich and pay off your debt. Now, to mayhem!' },
  ],
};
