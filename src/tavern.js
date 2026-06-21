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
    this._buildAmbience();
    this._buildUpperFloor();
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

    // ---- a little furniture in the MAIN HALL only (kept clear of stations) ----
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
    const mugMat = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 });
    const addProp = (mesh, x, z, r, mass = 1) => {
      mesh.position.set(x, mesh.position.y, z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      this.props.push({ mesh, home: new THREE.Vector3(x, mesh.position.y, z), homeY: mesh.position.y, r, knocked: false, vel: new THREE.Vector3(), fall: 0, axis: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), mass });
    };
    // a couple of tables near the entrance with mugs
    for (const [x, z] of [[-4.5, 5], [4.5, 5]]) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 16), woodMat); top.position.y = 1.0;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 8), woodMat); leg.position.y = 0.5; top.add(leg);
      addProp(top, x, z, 1.1, 2.2);
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.34, 10), mugMat); mug.position.y = 1.3;
      addProp(mug, x + 0.4, z, 0.3, 0.3);
    }
    // barrels stacked by the bar (decor)
    for (const [x, z] of [[-10.6, -9], [-10.6, 1]]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 1.4, 12), woodMat); barrel.position.y = 0.7;
      addProp(barrel, x, z, 0.7, 1.6);
    }

    // ---- patrons: clay-wizard look, milling about the MAIN HALL only ----
    const robeColors = [0x7a8bd0, 0xcf6f6f, 0x6fb08a, 0xc9a24a];
    const patronPos = [[-3, 4], [5, 3], [-5, 1], [2.5, -3]];
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
    // ===== MAIN HALL (front) =====
    mk('skilltree', 'the Spell Table', 6, -3, (grp) => {
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 1.2), wood); top.position.y = 1.0; top.castShadow = true;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 8), wood); leg.position.y = 0.5; grp.add(top, leg);
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x6f5fc4, roughness: 0.7 })); book.position.set(0, 1.18, 0); book.rotation.y = 0.3; grp.add(book);
      const rune = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 18), new THREE.MeshBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: 0.8 })); rune.rotation.x = Math.PI / 2; rune.position.y = 1.5; grp.add(rune);
    });
    mk('cauldron', 'the Cauldron', -6, -6, (grp) => {
      const iron = new THREE.MeshStandardMaterial({ color: 0x33323a, roughness: 0.7, metalness: 0.3 });
      const pot = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), iron); pot.rotation.x = Math.PI; pot.position.y = 0.85; pot.castShadow = true; grp.add(pot);
      const brew = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 14), new THREE.MeshBasicMaterial({ color: 0x9bff7a, transparent: true, opacity: 0.8 })); brew.position.y = 1.15; grp.add(brew);
    });
    mk('manager', 'the Tavern Manager', -7.5, -1, (grp) => {
      const p = this._buildPatron(0x9a6a3a, true);
      p.scale.setScalar(1.05); grp.add(p);
      const apron = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.15), new THREE.MeshStandardMaterial({ color: 0xece0c0, roughness: 0.9 })); apron.position.set(0, 0.95, 0.4); grp.add(apron);
    });
    mk('wardrobe', 'the Wardrobe', 8, -6, (grp) => {
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.4, 1.6, 8), wood); stand.position.y = 0.8; stand.castShadow = true;
      const torso = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshStandardMaterial({ color: 0x6f5fc4, roughness: 0.85 })); torso.position.y = 1.5; torso.scale.set(1, 1.2, 0.7); torso.castShadow = true;
      grp.add(stand, torso);
    });
    mk('ledger', 'the Tavern Ledger', 2.5, 3, (grp) => {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.9), wood); desk.position.y = 0.5; desk.castShadow = true; grp.add(desk);
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.45), new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 0.7 })); book.position.set(-0.3, 1.06, 0); grp.add(book);
      for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 10), gold); c.position.set(0.4, 1.06 + i * 0.07, 0.1); grp.add(c); }
    });
    mk('blacksmith', 'the Blacksmith', -1, -6.5, (grp) => {
      const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.6, metalness: 0.4 });
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.8, 10), wood); stump.position.y = 0.4; stump.castShadow = true;
      const anvilBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.9), iron); anvilBase.position.y = 0.95;
      const anvilTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), iron); anvilTop.position.y = 1.15; anvilTop.castShadow = true;
      grp.add(stump, anvilBase, anvilTop);
    });

    // partition wall dividing the back rooms from the hall (doorway gap in the middle)
    const partMat = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.95 });
    const part = (w, x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2.9, 0.4), partMat); m.position.set(x, 1.45, -9); m.castShadow = true; m.receiveShadow = true; g.add(m); };
    part(8.2, -6.9); part(8.2, 6.9); // gap: x in [-2.8, 2.8]

    // ===== BEDROOM (back-right) — starts EMPTY but for the bed. Everything else
    //       (stations, comforts) is bought & placed via the Room decor menu. =====
    mk('room', 'your Room — bare but yours', 7, -12, (grp) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.4), wood); frame.position.y = 0.3; frame.castShadow = true;
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 2.2), new THREE.MeshStandardMaterial({ color: 0x8a7bc0, roughness: 0.9 })); mattress.position.y = 0.6; grp.add(frame, mattress);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.5), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 })); pillow.position.set(0, 0.78, -0.85); grp.add(pillow);
    });
    // ===== KITCHEN (back-left) — work a shift (mini-game) =====
    mk('work', 'the Kitchen — work a shift', -7, -12, (grp) => {
      const stove = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.0), new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.6, metalness: 0.3 })); stove.position.y = 0.55; stove.castShadow = true; grp.add(stove);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x55555c, roughness: 0.6, metalness: 0.3 })); pot.position.set(0, 1.3, 0); grp.add(pot);
      const steam = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })); steam.position.set(0, 1.7, 0); grp.add(steam);
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

  // Warm, lived-in dressing for the main hall — purely decorative (no collision),
  // so it never blocks the wizard or topples. Sconces + chandelier give the
  // cozy, polished tavern glow.
  _buildAmbience() {
    const g = this.group;
    const M = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.92 });
    const iron = M(0x2c2c34, 0.6, 0.4), wood = M(0x5a3a22, 0.9);
    this._flames = [];

    // ---- chandelier over the hall ----
    const chand = new THREE.Group(); chand.position.set(0, 3.05, -1);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), iron); chain.position.y = 0.7; chand.add(chain);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 8, 24), iron); ring.rotation.x = Math.PI / 2; chand.add(ring);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.18, 8), M(0xe8d8b0, 0.8)); cup.position.set(Math.cos(a) * 1.05, 0.12, Math.sin(a) * 1.05); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), flameMat); fl.position.set(Math.cos(a) * 1.05, 0.3, Math.sin(a) * 1.05); fl.scale.y = 1.5; this._flames.push(fl); chand.add(cup, fl); }
    const chLight = new THREE.PointLight(0xffca96, 2.6, 22); chLight.position.y = 0.1; chLight.castShadow = false; chand.add(chLight);
    g.add(chand);

    // ---- wall sconces (one west, one east) ----
    const sconce = (x, z) => { const s = new THREE.Group(); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.5, 6), iron); br.position.set(x, 2.5, z); br.rotation.z = x < 0 ? -0.5 : 0.5; const fl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), flameMat); fl.position.set(x + (x < 0 ? 0.18 : -0.18), 2.75, z); fl.scale.y = 1.5; this._flames.push(fl); const li = new THREE.PointLight(0xff9a4a, 1.1, 9); li.position.set(x + (x < 0 ? 0.4 : -0.4), 2.8, z); li.castShadow = false; s.add(br, fl, li); g.add(s); };
    sconce(-11.2, -4); sconce(11.2, -4);

    // ---- back-bar: shelf of bottles behind the west counter ----
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 9), wood); shelf.position.set(-11, 1.9, -4); shelf.castShadow = true; g.add(shelf);
    const shelf2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 9), wood); shelf2.position.set(-11, 2.6, -4); g.add(shelf2);
    const bottleCols = [0x6fb08a, 0xb04a4a, 0x4a7ab0, 0xc9a24a, 0x8a5ad0];
    for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.34, 8), M(bottleCols[i % 5], 0.5)); b.position.set(-11, (i % 2 ? 2.78 : 2.08), -8 + i * 0.55); g.add(b); }

    // ---- bar stools in front of the counter ----
    for (const z of [-7.5, -4, -0.5]) { const st = new THREE.Group(); const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), M(0x7a3a2a)); seat.position.y = 0.95; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), wood); leg.position.y = 0.45; st.add(seat, leg); st.position.set(-7.7, 0, z); st.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(st); }

    // ---- kegs by the bar ----
    for (const [x, z, y] of [[-10.4, 4.4, 0.55], [-9.4, 4.6, 0.55], [-9.9, 4.5, 1.5]]) { const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.0, 12), wood); keg.rotation.z = Math.PI / 2; keg.position.set(x, y, z); keg.castShadow = true; const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.04, 6, 16), iron); ring1.position.copy(keg.position); ring1.rotation.y = Math.PI / 2; g.add(keg, ring1); }

    // ---- hanging tavern sign: "The Tipsy Toad" (a painted plank + a toad) ----
    const sign = new THREE.Group(); sign.position.set(0, 2.7, -10.4);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.12), M(0x6a4426, 0.9)); plank.castShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.16), M(0xffd98a, 0.5, 0.3)); trim.position.y = 0.48;
    const toad = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), M(0x6fbf5a, 0.7)); toad.position.set(0, 0, 0.1); toad.scale.set(1.2, 0.9, 1);
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), M(0xffffff, 0.6)); eyeW.position.set(-0.13, 0.18, 0.28);
    const eyeW2 = eyeW.clone(); eyeW2.position.x = 0.13;
    for (const cx of [-1.0, 1.0]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), iron); ch.position.set(cx, 0.62, 0); sign.add(ch); }
    sign.add(plank, trim, toad, eyeW, eyeW2); g.add(sign);

    // ---- moonlit windows on the side walls ----
    const paneMat = new THREE.MeshStandardMaterial({ color: 0x9fc4ff, emissive: 0x4a6aa0, emissiveIntensity: 0.8, roughness: 0.4 });
    for (const [x, z] of [[-11.6, 1.5], [11.6, 1.5], [11.6, -8]]) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.2), paneMat); win.position.set(x, 2.1, z); const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.08), wood); bar1.position.set(x, 2.1, z); const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 1.2), wood); bar2.position.set(x, 2.1, z); g.add(win, bar1, bar2); }

    // ---- a long runner rug down the middle of the hall ----
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 14), M(0x7a2f3a, 0.95)); runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.012, -2); runner.receiveShadow = true; g.add(runner);
  }

  // A minstrels' gallery over the entrance — gives the tavern a clear second
  // floor without occluding any ground-floor station (it spans only the centre).
  _buildUpperFloor() {
    const g = this.group;
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
    const woodD = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.9 });
    const Y = 3.25; // gallery deck height

    // deck (centre only: x in [-5.5,5.5], over the entrance z in [-14.6,-10.6])
    const deck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 4), woodD); deck.position.set(0, Y, -12.6); deck.castShadow = true; deck.receiveShadow = true; g.add(deck);

    // support posts down to the floor
    for (const x of [-5.2, 5.2]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, Y, 8), wood); post.position.set(x, Y / 2, -10.7); post.castShadow = true; g.add(post); }

    // front railing (faces into the room)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.12), wood); rail.position.set(0, Y + 0.7, -10.7); g.add(rail);
    const railBase = new THREE.Mesh(new THREE.BoxGeometry(11, 0.1, 0.1), wood); railBase.position.set(0, Y + 0.18, -10.7); g.add(railBase);
    for (let i = 0; i <= 14; i++) { const bx = -5.3 + i * (10.6 / 14); const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.62, 6), wood); bal.position.set(bx, Y + 0.4, -10.7); g.add(bal); }

    // staircase up the east side (decorative — no collision; you manage from below)
    const stair = new THREE.Group();
    for (let i = 0; i < 8; i++) { const step = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.7), wood); step.position.set(9.2, 0.2 + i * (Y / 8), -6 - i * 0.62); step.castShadow = true; stair.add(step); }
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.18, Y + 0.3, 5.2), woodD); stringer.position.set(8.6, Y / 2, -8.6); stringer.rotation.x = -0.32; stair.add(stringer);
    g.add(stair);

    // upstairs dressing: a small table, two barrels and a lantern so it reads as usable
    const upTable = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.14, 14), wood); upTable.position.set(-3, Y + 0.55, -13); const upLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), wood); upLeg.position.set(-3, Y + 0.18, -13); g.add(upTable, upLeg);
    for (const [x, z] of [[3, -13.4], [3.8, -12.6]]) { const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.95, 12), wood); barrel.position.set(x, Y + 0.5, z); barrel.castShadow = true; g.add(barrel); }
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.9 })); lantern.position.set(-3, Y + 0.85, -13); g.add(lantern);
    const upLight = new THREE.PointLight(0xffb060, 0.9, 8); upLight.position.set(0, Y + 1, -12.6); upLight.castShadow = false; g.add(upLight);

    // hanging banners from the gallery front
    for (const [x, c] of [[-3.5, 0x4a2f8a], [3.5, 0x7a2f3a]]) { const ban = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.6), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })); ban.position.set(x, Y - 0.5, -10.6); g.add(ban); }
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
    this._prevWz = this.start.z;
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
        n.target.set(-4 + Math.random() * 11, 0, -6 + Math.random() * 11); // main hall only
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
    // flicker the hearth/sconce/chandelier flames for a cozy, living glow
    if (this._flames) for (let i = 0; i < this._flames.length; i++) { const f = this._flames[i]; const s = 1 + Math.sin(this.phase * 9 + i * 1.7) * 0.18; f.scale.set(s, 1.5 * s, s); f.material.opacity = 0.8 + Math.sin(this.phase * 13 + i) * 0.12; }

    // animate station markers + report the nearest one for the hub prompt
    for (const s of this.stations) if (s.mark) { s.mark.rotation.y += dt * 2; s.mark.position.y = 2.6 + Math.sin(this.phase * 3 + s.pos.x) * 0.18; }
    game.nearStation = this.nearestStation(w.pos);

    // walls (leaving the tavern is done by interacting with the door, not walking out)
    w.pos.x = Math.max(MINX, Math.min(MAXX, w.pos.x));
    w.pos.z = Math.max(NORTH, Math.min(SOUTH, w.pos.z));
    // interior partition at z = -9, walkable only through the central doorway gap
    const PZ = -9, GAP = 2.8;
    if (Math.abs(w.pos.x) > GAP) {
      const prev = this._prevWz == null ? w.pos.z : this._prevWz;
      if ((prev >= PZ && w.pos.z < PZ) || (prev <= PZ && w.pos.z > PZ)) { w.pos.z = prev >= PZ ? PZ + 0.7 : PZ - 0.7; w.vel.z *= -0.3; }
    }
    this._prevWz = w.pos.z;
  }
}
