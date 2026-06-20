// tavern.js — the opening level: steer a hopelessly drunk wizard out the door.
// Real-ish physics, deliberately hard to control. Bump patrons (they block you)
// or knock furniture flying (it topples) and the spirit keeps score.
import * as THREE from 'three';

// room bounds
const MINX = -11.5, MAXX = 11.5, SOUTH = 7, NORTH = -14.5;
const DOOR_X = 0, DOOR_HALF = 2.1;

export class Tavern {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.props = [];
    this.npcs = [];
    this.stations = [];   // hub interactables (door + shops)
    this.decor = {};      // toggleable bought decorations
    this.ruckus = { props: 0, patrons: 0 };
    this.phase = 0;
    this.exited = false;
    this.start = new THREE.Vector3(0, 0, 4.5);
    this.door = new THREE.Vector3(DOOR_X, 0, NORTH);
    this._build();
    this._buildStations();
    this._buildDecor();
  }

  _build() {
    const g = this.group;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2c, roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.005, -4); floor.receiveShadow = true;
    g.add(floor);

    // low diorama walls (roofless, so the top-down camera can see inside)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.95 });
    const WH = 3.2, WY = 1.6;
    const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    wall(26, WH, 0.6, 0, WY, SOUTH + 0.6);               // south
    wall(0.6, WH, 24, MINX - 0.6, WY, -4);               // west
    wall(0.6, WH, 24, MAXX + 0.6, WY, -4);               // east
    wall(9.2, WH, 0.6, -6.9, WY, NORTH - 0.6);           // north (split around door)
    wall(9.2, WH, 0.6, 6.9, WY, NORTH - 0.6);

    // the glowing exit door
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffb74d, emissiveIntensity: 1.3, roughness: 0.6 });
    const doorway = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF * 2, 3.6, 0.3), doorMat);
    doorway.position.set(DOOR_X, 1.8, NORTH - 0.5); g.add(doorway);
    const glow = new THREE.PointLight(0xffd08a, 3, 14); glow.position.set(DOOR_X, 2.2, NORTH); g.add(glow);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), new THREE.MeshBasicMaterial({ color: 0xfff0c2, transparent: true, opacity: 0.9 }));
    arrow.position.set(DOOR_X, 3.4, NORTH + 0.5); arrow.rotation.x = Math.PI; g.add(arrow);
    this._arrow = arrow;

    // bar counter along the west
    const barMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 12), barMat);
    bar.position.set(-9.2, 0.6, -4); bar.castShadow = true; bar.receiveShadow = true; g.add(bar);

    // ---- knockable furniture ----
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
    const mugMat = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 });
    const addProp = (mesh, x, z, r, mass = 1) => {
      mesh.position.set(x, mesh.position.y, z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      this.props.push({ mesh, home: new THREE.Vector3(x, mesh.position.y, z), homeY: mesh.position.y, r, knocked: false, vel: new THREE.Vector3(), fall: 0, axis: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), mass });
    };
    // round tables with a mug on top
    const tablePos = [[-3, 2], [4, 0], [-2, -6], [5, -8], [-5, -10]];
    for (const [x, z] of tablePos) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.18, 16), woodMat); top.position.y = 1.0;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 8), woodMat); leg.position.y = 0.5; top.add(leg);
      addProp(top, x, z, 1.2, 2.2);
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.34, 10), mugMat); mug.position.y = 1.3;
      addProp(mug, x + 0.4, z, 0.3, 0.3);
    }
    // barrels & stools
    for (const [x, z] of [[8, 4], [-7, 1], [7, -3], [-8, -8], [9, -11]]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 1.4, 12), woodMat); barrel.position.y = 0.7;
      addProp(barrel, x, z, 0.7, 1.6);
    }
    for (const [x, z] of [[-2.4, 3], [3, 1.5], [-1, -5], [6, -7]]) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.6, 10), woodMat); stool.position.y = 0.3;
      addProp(stool, x, z, 0.45, 0.6);
    }

    // ---- patrons: same clay-wizard look as the hero, wandering the room ----
    const robeColors = [0x7a8bd0, 0xcf6f6f, 0x6fb08a, 0xc9a24a, 0x9a6fb0, 0xc98a5a];
    const patronPos = [[-6, 3], [2.5, -2], [-4, -4], [6.5, -5], [0.5, -9], [4, -11]];
    patronPos.forEach((p, i) => {
      const person = this._buildPatron(robeColors[i % robeColors.length], i % 2 === 0);
      person.position.set(p[0], 0, p[1]);
      person.rotation.y = Math.random() * Math.PI * 2;
      g.add(person);
      this.npcs.push({
        mesh: person, pos: new THREE.Vector3(p[0], 0, p[1]), home: new THREE.Vector3(p[0], 0, p[1]),
        r: 0.6, annoyedCd: 0, wob: 0, phase: Math.random() * 6,
        target: new THREE.Vector3(p[0], 0, p[1]), repathCd: Math.random() * 3, speed: 1.2 + Math.random() * 0.8, yaw: 0,
      });
    });
  }

  // a rounded clay humanoid in a robe + pointy hat (matches the wizard's style)
  _buildPatron(robeColor, hasHat) {
    const person = new THREE.Group();
    const robe = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.85 });
    const robe2 = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.85 });
    robe2.color.multiplyScalar(0.8);
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0d6b8, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.7 });

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 0.85, 14), robe); skirt.position.y = 0.72; skirt.castShadow = true;
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), robe); torso.position.y = 1.2; torso.scale.set(1, 0.95, 0.92); torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), skin); head.position.y = 1.72; head.castShadow = true;
    person.add(skirt, torso, head);
    // simple face
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const eL = new THREE.Mesh(eyeGeo, dark); eL.position.set(-0.12, 1.76, 0.3); eL.scale.y = 0.7;
    const eR = new THREE.Mesh(eyeGeo, dark); eR.position.set(0.12, 1.76, 0.3); eR.scale.y = 0.7;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd98a72, roughness: 0.75 }));
    nose.position.set(0, 1.68, 0.34);
    person.add(eL, eR, nose);
    // stubby arms
    const armGeo = new THREE.CapsuleGeometry(0.1, 0.5, 4, 8);
    const aL = new THREE.Mesh(armGeo, robe); aL.position.set(-0.44, 1.15, 0); aL.rotation.z = 0.5; aL.castShadow = true;
    const aR = new THREE.Mesh(armGeo, robe); aR.position.set(0.44, 1.15, 0); aR.rotation.z = -0.5; aR.castShadow = true;
    person.add(aL, aR);
    // mug in one hand
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 10), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 }));
    mug.position.set(0.6, 1.0, 0.1); person.add(mug);
    if (hasHat) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 14), robe2); brim.position.y = 1.98; brim.castShadow = true;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 14), robe2); cone.position.y = 2.4; cone.rotation.z = 0.12; cone.castShadow = true;
      person.add(brim, cone);
    }
    person._mug = mug;
    return person;
  }

  // hub interactables: the door out, plus the shop stations
  _buildStations() {
    const g = this.group;
    const gold = new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0x4a3400, metalness: 0.3, roughness: 0.5 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
    const mk = (type, label, x, z, build) => {
      const grp = new THREE.Group(); grp.position.set(x, 0, z);
      if (build) build(grp);
      // floating marker
      const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.95 }));
      mark.position.y = 2.6; grp.add(mark);
      g.add(grp);
      this.stations.push({ type, label, pos: new THREE.Vector3(x, 0, z), mark });
    };
    // Spell Table (skill tree)
    mk('skilltree', 'the Spell Table', 7, -8, (grp) => {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 1.2), wood); top.position.y = 1.0; top.castShadow = true;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 8), wood); leg.position.y = 0.5; grp.add(top, leg);
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x6f5fc4, roughness: 0.7 })); book.position.set(0, 1.18, 0); book.rotation.y = 0.3; grp.add(book);
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 18), new THREE.MeshBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: 0.8 })); rune.rotation.x = Math.PI / 2; rune.position.y = 1.5; grp.add(rune);
    });
    // Cauldron (combos)
    mk('cauldron', 'the Cauldron', -6, -11, (grp) => {
      const iron = new THREE.MeshStandardMaterial({ color: 0x33323a, roughness: 0.7, metalness: 0.3 });
      const pot = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), iron); pot.rotation.x = Math.PI; pot.position.y = 0.85; pot.castShadow = true; grp.add(pot);
      const brew = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 14), new THREE.MeshBasicMaterial({ color: 0x9bff7a, transparent: true, opacity: 0.8 })); brew.position.y = 1.15; grp.add(brew);
    });
    // Tavern Manager (quest giver)
    mk('manager', 'the Tavern Manager', -7.5, -1, (grp) => {
      const p = this._buildPatron(0x9a6a3a, true);
      p.scale.setScalar(1.05); grp.add(p);
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.15), new THREE.MeshStandardMaterial({ color: 0xece0c0, roughness: 0.9 })); apron.position.set(0, 0.95, 0.4); grp.add(apron);
    });
    // Bed / room
    mk('room', 'your Room', 8.5, 3, (grp) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.4), wood); frame.position.y = 0.3; frame.castShadow = true;
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 2.2), new THREE.MeshStandardMaterial({ color: 0x8a7bc0, roughness: 0.9 })); mattress.position.y = 0.6; grp.add(frame, mattress);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 })); pillow.position.set(0, 0.78, -0.85); grp.add(pillow);
    });
    // Wardrobe (equipment)
    mk('wardrobe', 'the Wardrobe', 9, -8, (grp) => {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.4, 1.6, 8), wood); stand.position.y = 0.8; stand.castShadow = true;
      const torso = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshStandardMaterial({ color: 0x6f5fc4, roughness: 0.85 })); torso.position.y = 1.5; torso.scale.set(1, 1.2, 0.7); torso.castShadow = true;
      grp.add(stand, torso);
    });
    // Door out (start a run)
    this.stations.push({ type: 'door', label: 'leave on a run', pos: this.door.clone(), mark: null });
  }

  _buildDecor() {
    const g = this.group;
    const M = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 24), M(0x9a3a4a, 0.95));
    rug.rotation.x = -Math.PI / 2; rug.position.set(8.5, 0.02, 4.5); rug.receiveShadow = true; g.add(rug);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshStandardMaterial({ color: 0x4a2f8a, roughness: 0.9, side: THREE.DoubleSide }));
    banner.position.set(11.2, 3, 3); banner.rotation.y = -Math.PI / 2; g.add(banner);
    const plant = new THREE.Group();
    plant.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.45, 10), M(0x8a5a2b)));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), M(0x3a824a)); leaf.position.y = 0.5; plant.add(leaf);
    plant.position.set(6.4, 0.2, 4.6); g.add(plant);
    // new decos
    const torch = new THREE.Group();
    for (const x of [-11, 11]) { const t = new THREE.Group(); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 6), M(0x3a2a1a)); br.position.set(x, 2.4, -8); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.9 })); fl.position.set(x, 2.8, -8); fl.scale.y = 1.4; t.add(br, fl); torch.add(t); }
    g.add(torch);
    const bookshelf = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.5), M(0x4a3322)); frame.position.set(-11, 1.3, 1); frame.castShadow = true; bookshelf.add(frame);
    for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.4), M([0xb04a4a, 0x4a7ab0, 0x6fb08a, 0xc9a24a][i % 4])); b.position.set(-11 + 0.25, 0.7 + (i % 4) * 0.55, 1 - 0.6 + Math.floor(i / 4) * 1.2); bookshelf.add(b); }
    g.add(bookshelf);
    const statue = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.9), M(0x6a6e7a, 1)); base.position.set(-9, 0.2, 5.5);
    const gar = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), M(0x7a7e88, 1)); gar.position.set(-9, 0.95, 5.5); gar.castShadow = true; statue.add(base, gar); g.add(statue);
    const crystal = new THREE.Group();
    const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x7fd0ff, emissive: 0x2a6a9a, roughness: 0.3 })); cr.position.set(3.5, 1.2, 5.5); crystal.add(cr); g.add(crystal);
    const fireplace = new THREE.Group();
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.8), M(0x5a5050, 1)); hearth.position.set(0, 0.8, 6.6); fireplace.add(hearth);
    const flames = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 8), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.85 })); flames.position.set(0, 0.9, 6.3); fireplace.add(flames);
    g.add(fireplace);

    this.decor = { rug, banner, plant, torch, bookshelf, statue, crystal, fireplace };
    for (const k in this.decor) this.decor[k].visible = false;
  }

  refreshDecor(meta) {
    for (const k in this.decor) this.decor[k].visible = meta.ownsDecor(k);
  }

  // nearest interactable station within range (for the hub prompt)
  nearestStation(pos, range = 2.8) {
    let best = null, bd = range * range;
    for (const s of this.stations) {
      const dx = s.pos.x - pos.x, dz = s.pos.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  reset() {
    this.exited = false;
    this.ruckus.props = 0; this.ruckus.patrons = 0;
    this.phase = 0;
    for (const p of this.props) {
      p.knocked = false; p.fall = 0; p.vel.set(0, 0, 0);
      p.mesh.position.copy(p.home);
      p.mesh.rotation.set(0, 0, 0);
    }
    for (const n of this.npcs) {
      n.annoyedCd = 0; n.wob = 0; n.repathCd = Math.random() * 3;
      n.pos.copy(n.home); n.target.copy(n.home);
      n.mesh.position.set(n.home.x, 0, n.home.z);
    }
  }

  show(v) { this.group.visible = v; }

  update(dt, game) {
    if (this.exited) return;
    this.phase += dt;
    const w = game.wizard;
    const wr = 0.7;

    // patrons wander the room, and block the wizard (solid)
    for (const n of this.npcs) {
      n.phase += dt;
      // pick a new wander target now and then
      n.repathCd -= dt;
      const reached = n.pos.distanceTo(n.target) < 0.4;
      if (n.repathCd <= 0 || reached) {
        n.repathCd = 2.5 + Math.random() * 3.5;
        n.target.set(-6 + Math.random() * 16, 0, -13 + Math.random() * 18); // open floor area
      }
      // stroll toward it (but freeze briefly when annoyed)
      if (n.annoyedCd <= 0.6) {
        const tx = n.target.x - n.pos.x, tz = n.target.z - n.pos.z;
        const td = Math.hypot(tx, tz) || 1e-4;
        const step = Math.min(td, n.speed * dt);
        n.pos.x += (tx / td) * step; n.pos.z += (tz / td) * step;
        if (td > 0.1) n.yaw = Math.atan2(tx, tz);
      }
      n.mesh.position.set(n.pos.x, Math.abs(Math.sin(n.phase * 5)) * 0.06, n.pos.z);
      n.mesh.rotation.y = n.yaw;

      const dx = w.pos.x - n.pos.x, dz = w.pos.z - n.pos.z;
      const d = Math.hypot(dx, dz) || 1e-4;
      const minD = wr + n.r;
      if (d < minD) {
        const push = (minD - d);
        w.pos.x += (dx / d) * push; w.pos.z += (dz / d) * push;
        w.vel.x += (dx / d) * 3; w.vel.z += (dz / d) * 3;
        w.leanV.x += (dx / d) * 5; w.leanV.z += (dz / d) * 5;
        if (n.annoyedCd <= 0) {
          n.annoyedCd = 1.2; n.wob = 1; this.ruckus.patrons++;
          game.audio.play('hurt'); game.shake(0.5);
          game.ui.bumpTavern(this.ruckus.props + this.ruckus.patrons);
          if (this.ruckus.patrons === 1) game.showStory('Patron', ['OI! Watch where you\'re flailing, you soggy old fool!']);
        }
      }
      if (n.annoyedCd > 0) n.annoyedCd -= dt;
      if (n.wob > 0) { n.wob -= dt * 2; n.mesh.rotation.z = Math.sin(this.phase * 22) * 0.15 * Math.max(0, n.wob); }
      else { n.mesh.rotation.z = Math.sin(n.phase) * 0.03; }
    }

    // furniture topples when bumped (doesn't block — you plough through it)
    for (const p of this.props) {
      if (!p.knocked) {
        const dx = p.mesh.position.x - w.pos.x, dz = p.mesh.position.z - w.pos.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        if (d < wr + p.r) {
          p.knocked = true; this.ruckus.props++;
          const sp = Math.max(2, 6 - p.mass) + Math.hypot(w.vel.x, w.vel.z) * 0.4;
          p.vel.set((dx / d) * sp, 2, (dz / d) * sp);
          // bumping staggers the wizard
          w.leanV.x -= (dx / d) * 4 / p.mass; w.leanV.z -= (dz / d) * 4 / p.mass;
          game.audio.play('hit'); game.shake(0.4);
          const wp = p.mesh.position.clone().setY(0.6);
          game.particles.burst({ pos: wp, color: 0x7a5230, count: 8, speed: 4, size: 0.25, life: 0.6, grav: -12, blend: 'normal' });
          game.ui.bumpTavern(this.ruckus.props + this.ruckus.patrons);
          if (this.ruckus.props === 1) game.showStory('The Spirit', ['Smooth. Real smooth. Try NOT to redecorate on the way out.']);
        }
      } else {
        // simple topple + slide
        p.fall = Math.min(1, p.fall + dt * 2.4);
        p.vel.y -= 12 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        if (p.mesh.position.y < p.homeY * 0.4 + 0.1) { p.mesh.position.y = p.homeY * 0.4 + 0.1; p.vel.set(p.vel.x * 0.4, 0, p.vel.z * 0.4); }
        p.vel.x *= Math.pow(0.05, dt); p.vel.z *= Math.pow(0.05, dt);
        p.mesh.rotation.x = p.axis.z * p.fall * 1.5;
        p.mesh.rotation.z = -p.axis.x * p.fall * 1.5;
        // keep toppled props inside the room
        p.mesh.position.x = Math.max(MINX, Math.min(MAXX, p.mesh.position.x));
        p.mesh.position.z = Math.max(NORTH, Math.min(SOUTH, p.mesh.position.z));
      }
    }

    this._arrow.position.y = 3.4 + Math.sin(this.phase * 3) * 0.2;

    // animate station markers + report the nearest one for the hub prompt
    for (const s of this.stations) if (s.mark) { s.mark.rotation.y += dt * 2; s.mark.position.y = 2.6 + Math.sin(this.phase * 3 + s.pos.x) * 0.18; }
    game.nearStation = this.nearestStation(w.pos);

    // walls (leaving the tavern is done by interacting with the door, not walking out)
    w.pos.x = Math.max(MINX, Math.min(MAXX, w.pos.x));
    w.pos.z = Math.max(NORTH, Math.min(SOUTH, w.pos.z));
  }
}
