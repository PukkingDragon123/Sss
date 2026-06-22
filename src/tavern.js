// tavern.js — TWO scenes:
//   • the Bar (hub): a polished, normal tavern. Just a bar — no management
//     stations. You can tend the bar for tips, head out the door on a run, or
//     climb the stairs to your room.
//   • your Room (separate scene): starts bare but for a bed. You craft & place
//     functional stations (Spell Table, Cauldron, Wardrobe, Anvil, Ledger,
//     Quest Board) and comforts here with gold, then walk up to use them.
import * as THREE from 'three';

// bar bounds
const MINX = -11.5, MAXX = 11.5, SOUTH = 7, NORTH = -14.5;
const DOOR_X = 0, DOOR_HALF = 2.1;
// room bounds
const RMINX = -7.5, RMAXX = 7.5, RSOUTH = 6.5, RNORTH = -6.5;

export class Tavern {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);          // the bar
    this.roomScene = new THREE.Group(); this.roomScene.visible = false; scene.add(this.roomScene); // your room
    this.props = [];
    this.npcs = [];
    this.stations = [];      // bar interactables (door / stairs / serve)
    this.roomStations = [];  // room interactables (bed / down / placed stations)
    this.ruckus = { props: 0, patrons: 0 };
    this.phase = 0; this.exited = false;
    this.start = new THREE.Vector3(0, 0, 4.5);       // bar spawn
    this.roomStart = new THREE.Vector3(-1.5, 0, 4.5); // room spawn
    this.door = new THREE.Vector3(DOOR_X, 0, NORTH);
    this._build();
    this._buildAmbience();
    this._buildBarFittings();
    this._buildRoomScene();
    this.roomItems = new THREE.Group(); this.roomScene.add(this.roomItems); // player-placed things
  }

  // ===================== THE BAR =====================
  _build() {
    const g = this.group;
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2c, roughness: 0.95 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.005, -4); floor.receiveShadow = true; g.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.95 });
    const WH = 3.2, WY = 1.6;
    const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    wall(26, WH, 0.6, 0, WY, SOUTH + 0.6);
    wall(0.6, WH, 24, MINX - 0.6, WY, -4);
    wall(0.6, WH, 24, MAXX + 0.6, WY, -4);
    wall(9.2, WH, 0.6, -6.9, WY, NORTH - 0.6);
    wall(9.2, WH, 0.6, 6.9, WY, NORTH - 0.6);

    // glowing exit door (venture out)
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

    // knockable furniture (the wonky-physics fun stays)
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
    const mugMat = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 });
    const addProp = (mesh, x, z, r, mass = 1) => {
      mesh.position.set(x, mesh.position.y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
      this.props.push({ mesh, home: new THREE.Vector3(x, mesh.position.y, z), homeY: mesh.position.y, r, knocked: false, vel: new THREE.Vector3(), fall: 0, axis: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), mass });
    };
    for (const [x, z] of [[-3.5, 4.5], [3.5, 4.5], [1, -2]]) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 16), woodMat); top.position.y = 1.0;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 8), woodMat); leg.position.y = 0.5; top.add(leg);
      addProp(top, x, z, 1.1, 2.2);
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.34, 10), mugMat); mug.position.y = 1.3;
      addProp(mug, x + 0.4, z, 0.3, 0.3);
    }
    for (const [x, z] of [[-10.6, -9], [-10.6, 1]]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 1.4, 12), woodMat); barrel.position.y = 0.7;
      addProp(barrel, x, z, 0.7, 1.6);
    }

    // patrons milling about
    const robeColors = [0x7a8bd0, 0xcf6f6f, 0x6fb08a, 0xc9a24a];
    const patronPos = [[-3, 2], [5, 1], [-5, -2], [3, -5]];
    patronPos.forEach((p, i) => {
      const person = this._buildPatron(robeColors[i % robeColors.length], i % 2 === 0);
      person.position.set(p[0], 0, p[1]); person.rotation.y = Math.random() * Math.PI * 2; g.add(person);
      this.npcs.push({ mesh: person, pos: new THREE.Vector3(p[0], 0, p[1]), home: new THREE.Vector3(p[0], 0, p[1]), r: 0.6, annoyedCd: 0, wob: 0, phase: Math.random() * 6, target: new THREE.Vector3(p[0], 0, p[1]), repathCd: Math.random() * 3, speed: 1.2 + Math.random() * 0.8, yaw: 0 });
    });
  }

  _buildPatron(robeColor, hasHat) {
    const person = new THREE.Group();
    const robe = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.85 });
    const robe2 = new THREE.MeshStandardMaterial({ color: robeColor, roughness: 0.85 }); robe2.color.multiplyScalar(0.8);
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0d6b8, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 0.7 });
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 0.85, 14), robe); skirt.position.y = 0.72; skirt.castShadow = true;
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), robe); torso.position.y = 1.2; torso.scale.set(1, 0.95, 0.92); torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), skin); head.position.y = 1.72; head.castShadow = true;
    person.add(skirt, torso, head);
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const eL = new THREE.Mesh(eyeGeo, dark); eL.position.set(-0.12, 1.76, 0.3); eL.scale.y = 0.7;
    const eR = new THREE.Mesh(eyeGeo, dark); eR.position.set(0.12, 1.76, 0.3); eR.scale.y = 0.7;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd98a72, roughness: 0.75 })); nose.position.set(0, 1.68, 0.34);
    person.add(eL, eR, nose);
    const armGeo = new THREE.CapsuleGeometry(0.1, 0.5, 4, 8);
    const aL = new THREE.Mesh(armGeo, robe); aL.position.set(-0.44, 1.15, 0); aL.rotation.z = 0.5; aL.castShadow = true;
    const aR = new THREE.Mesh(armGeo, robe); aR.position.set(0.44, 1.15, 0); aR.rotation.z = -0.5; aR.castShadow = true;
    person.add(aL, aR);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 10), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7 })); mug.position.set(0.6, 1.0, 0.1); person.add(mug);
    if (hasHat) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 14), robe2); brim.position.y = 1.98; brim.castShadow = true;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 14), robe2); cone.position.y = 2.4; cone.rotation.z = 0.12; cone.castShadow = true;
      person.add(brim, cone);
    }
    person._mug = mug;
    return person;
  }

  // Bar fittings: the venture door, a staircase up to your room, and the
  // "tend the bar" spot — that's it. No management clutter.
  _buildBarFittings() {
    const g = this.group;
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
    const woodD = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.9 });
    const markGeo = new THREE.OctahedronGeometry(0.28, 0);
    const mk = (type, label, x, z, color) => {
      const mark = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({ color: color || 0xffe6a8, transparent: true, opacity: 0.95 }));
      mark.position.set(x, 2.4, z); g.add(mark);
      this.stations.push({ type, label, pos: new THREE.Vector3(x, 0, z), mark });
    };

    // staircase up to the room (back-right corner)
    const stair = new THREE.Group();
    for (let i = 0; i < 7; i++) { const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.26, 0.7), woodD); step.position.set(9, 0.22 + i * 0.42, -11.5 + i * 0.62); step.castShadow = true; stair.add(step); }
    const landing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 2.0), woodD); landing.position.set(9, 3.1, -13.2); stair.add(landing);
    const upDoor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x6f5fc4, emissive: 0x3a2c6a, emissiveIntensity: 0.7, roughness: 0.6 })); upDoor.position.set(9, 4.3, -14.1); stair.add(upDoor);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 5), wood); rail.position.set(7.85, 1.6, -9.6); rail.rotation.x = -0.62; stair.add(rail);
    g.add(stair);
    mk('stairs', 'climb to your Room', 8, -8.4, 0xbfa3ff);

    // "tend the bar" spot in front of the counter
    mk('serve', 'tend the Bar (earn tips)', -7.3, -4, 0x9bff7a);

    // the venture door
    this.stations.push({ type: 'door', label: 'venture out on a run', pos: this.door.clone(), mark: null });
  }

  // ===================== YOUR ROOM (separate scene) =====================
  _buildRoomScene() {
    const g = this.roomScene;
    // cosy, distinct palette from the bar
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 16), new THREE.MeshStandardMaterial({ color: 0x4a3a55, roughness: 0.96 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.004; floor.receiveShadow = true; g.add(floor);
    const planks = new THREE.Mesh(new THREE.PlaneGeometry(12, 11), new THREE.MeshStandardMaterial({ color: 0x6a4a6a, roughness: 0.95 }));
    planks.rotation.x = -Math.PI / 2; planks.position.set(0, 0.01, 0); planks.receiveShadow = true; g.add(planks);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a2f4a, roughness: 0.95 });
    const WH = 3.0, WY = 1.5;
    const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(x, y, z); m.receiveShadow = true; g.add(m); };
    wall(16, WH, 0.5, 0, WY, RNORTH - 0.5);
    wall(16, WH, 0.5, 0, WY, RSOUTH + 0.5);
    wall(0.5, WH, 14, RMINX - 0.5, WY, 0);
    wall(0.5, WH, 14, RMAXX + 0.5, WY, 0);
    // a moonlit window
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 2.4), new THREE.MeshStandardMaterial({ color: 0x9fc4ff, emissive: 0x4a6aa0, emissiveIntensity: 0.8, roughness: 0.4 })); pane.position.set(RMINX - 0.2, 2.0, -1); g.add(pane);
    // warm lamp
    const lamp = new THREE.PointLight(0xffcaa0, 1.6, 24); lamp.position.set(0, 4, 0); lamp.castShadow = false; g.add(lamp);
    const moon = new THREE.PointLight(0x6a8aff, 0.7, 18); moon.position.set(RMINX, 3, -1); moon.castShadow = false; g.add(moon);

    // the bed (always here) — interact to rest
    const bed = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.6), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 })); frame.position.y = 0.3; frame.castShadow = true;
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 2.4), new THREE.MeshStandardMaterial({ color: 0x8a7bc0, roughness: 0.9 })); mattress.position.y = 0.6;
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.6), new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 })); pillow.position.set(0, 0.78, -0.9);
    bed.add(frame, mattress, pillow); bed.position.set(-5.4, 0, -4.4); bed.rotation.y = 0.2; g.add(bed);
    const bedMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), new THREE.MeshBasicMaterial({ color: 0xb6a6ff, transparent: true, opacity: 0.95 })); bedMark.position.set(-5.4, 2.2, -4.4); g.add(bedMark);

    // stairs back down (front-right)
    const downStair = new THREE.Group();
    for (let i = 0; i < 5; i++) { const step = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 0.6), new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.9 })); step.position.set(6, 0.2 - i * 0.18, 4.0 + i * 0.5); downStair.add(step); }
    g.add(downStair);
    const downMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.95 })); downMark.position.set(6, 2.0, 4.4); g.add(downMark);

    // a small rug + the "empty room" feel
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.0, 24), new THREE.MeshStandardMaterial({ color: 0x6a3a5a, roughness: 0.95 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.5, 0.02, 1); rug.receiveShadow = true; g.add(rug);

    this._roomFixed = { bedMark, downMark };
    // fixed room interactables (placed stations get added in refreshRoom)
    this._roomFixedStations = [
      { type: 'rest', label: 'your Bed — rest before a run', pos: new THREE.Vector3(-5.4, 0, -4.4), mark: bedMark },
      { type: 'down', label: 'head back down to the Bar', pos: new THREE.Vector3(6, 0, 4.4), mark: downMark },
    ];
  }

  // (re)build placed items + their interactables from the save
  get _roomGrid() { return { ox: -4.6, oz: -3.4, cell: 1.9 }; }
  refreshRoom(meta) {
    const grp = this.roomItems;
    for (let i = grp.children.length - 1; i >= 0; i--) { const c = grp.children[i]; c.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); grp.remove(c); }
    this.roomStations = this._roomFixedStations.slice();
    const G = this._roomGrid;
    for (const p of meta.placedItems()) {
      const b = meta.buildableById(p.id);
      const m = this._buildPlaced(p.id); if (!m) continue;
      const x = G.ox + p.gx * G.cell, z = G.oz + p.gy * G.cell;
      m.position.set(x, 0, z); m.rotation.y = (p.gx * 1.7 + p.gy) % 6.28; grp.add(m);
      if (b && b.station) {
        const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.95 }));
        mark.position.set(x, 1.9, z); grp.add(mark);
        this.roomStations.push({ type: 'station', kind: b.station, label: `the ${b.name}`, pos: new THREE.Vector3(x, 0, z), mark });
      }
    }
  }

  _buildPlaced(id) {
    const M = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const wood = M(0x7a5230, 0.9), gold = M(0xffd98a, 0.45, 0.4), iron = M(0x33323a, 0.6, 0.3);
    const g = new THREE.Group();
    const add = (mesh) => { mesh.castShadow = true; g.add(mesh); return mesh; };
    switch (id) {
      // ---- functional stations ----
      case 'spelltable': { const top = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 1.0), wood)); top.position.y = 0.95; const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.95, 8), wood)); leg.position.y = 0.47; const book = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.42), M(0x6f5fc4, 0.7))); book.position.set(0, 1.1, 0); book.rotation.y = 0.3; const rune = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 18), new THREE.MeshBasicMaterial({ color: 0x9b7bff, transparent: true, opacity: 0.85 })); rune.rotation.x = Math.PI / 2; rune.position.y = 1.42; g.add(rune); break; }
      case 'cauldron': { const pot = add(new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), iron)); pot.rotation.x = Math.PI; pot.position.y = 0.68; const brew = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.08, 14), new THREE.MeshBasicMaterial({ color: 0x9bff7a, transparent: true, opacity: 0.8 })); brew.position.y = 0.92; g.add(brew); for (const a of [0, 2.1, 4.2]) { const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), iron)); leg.position.set(Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4); } break; }
      case 'wardrobe': { const cab = add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.6), M(0x4a3322))); cab.position.y = 0.9; const dl = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.05), M(0x6f5fc4, 0.7))); dl.position.set(-0.27, 0.95, 0.31); const dr = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.05), M(0x6f5fc4, 0.7))); dr.position.set(0.27, 0.95, 0.31); const knob = add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), gold)); knob.position.set(0.05, 0.95, 0.34); break; }
      case 'anvil': { const stump = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.7, 10), wood)); stump.position.y = 0.35; const base = add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.8), M(0x3a3a42, 0.6, 0.4))); base.position.y = 0.84; const topa = add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.16, 0.42), M(0x3a3a42, 0.6, 0.4))); topa.position.y = 1.02; break; }
      case 'ledger': { const desk = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.8), wood)); desk.position.y = 0.45; const book = add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.4), M(0x7a3a2a, 0.7))); book.position.set(-0.3, 0.97, 0); for (let i = 0; i < 3; i++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), gold)); c.position.set(0.4, 0.97 + i * 0.07, 0.1); } break; }
      case 'questboard': { const board = add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.1), M(0x4a3322))); board.position.y = 1.2; for (let i = 0; i < 4; i++) { const note = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.02), M([0xece0c0, 0xf2efe6, 0xe8d8b0][i % 3], 0.9))); note.position.set(-0.35 + (i % 2) * 0.6, 1.05 + Math.floor(i / 2) * 0.45, 0.07); note.rotation.z = (Math.random() - 0.5) * 0.2; } const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), wood)); post.position.y = 0.7; break; }
      // ---- comforts (decor) ----
      case 'rug': { const r = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 1.3), M(0x9a3a4a, 0.95)); r.position.y = 0.02; r.receiveShadow = true; g.add(r); break; }
      case 'chair': { const seat = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), wood)); seat.position.y = 0.5; const back = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1), wood)); back.position.set(0, 0.8, -0.2); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), wood)); l.position.set(x, 0.25, z); } break; }
      case 'table': { const top = add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14), wood)); top.position.y = 0.7; const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8), wood)); leg.position.y = 0.35; break; }
      case 'lamp': { const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.3, 8), iron)); pole.position.y = 0.65; const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.95 })); bulb.position.y = 1.4; g.add(bulb); const li = new THREE.PointLight(0xffcf8a, 0.6, 6); li.position.y = 1.4; li.castShadow = false; g.add(li); break; }
      case 'plant': { const pot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.4, 10), M(0x8a5a2b))); pot.position.y = 0.2; const leaf = add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), M(0x3a824a))); leaf.position.y = 0.65; break; }
      case 'shelf': { const frame = add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.4), M(0x4a3322))); frame.position.y = 0.8; for (let i = 0; i < 6; i++) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.34), M([0xb04a4a, 0x4a7ab0, 0x6fb08a, 0xc9a24a][i % 4]))); b.position.set(-0.3 + (i % 3) * 0.3, 0.6 + Math.floor(i / 3) * 0.55, 0.05); } break; }
      case 'trophy': { const plinth = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), M(0x6a6e7a, 1))); plinth.position.y = 0.25; const cup = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 0.3, 12), gold)); cup.position.y = 0.65; const ball = add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), gold)); ball.position.y = 0.86; break; }
      case 'chest': { const base = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.45), wood)); base.position.y = 0.2; const lid = add(new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.7, 12, 1, false, 0, Math.PI), wood)); lid.rotation.z = Math.PI / 2; lid.position.y = 0.4; const lock = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.06), gold)); lock.position.set(0, 0.34, 0.24); break; }
      default: return null;
    }
    return g;
  }

  // legacy no-op (decor is the build system now)
  refreshDecor() {}

  // ===================== shared =====================
  _buildAmbience() {
    const g = this.group;
    const M = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0.92 });
    const iron = M(0x2c2c34, 0.6, 0.4), wood = M(0x5a3a22, 0.9);
    this._flames = [];

    const chand = new THREE.Group(); chand.position.set(0, 3.05, -1);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), iron); chain.position.y = 0.7; chand.add(chain);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 8, 24), iron); ring.rotation.x = Math.PI / 2; chand.add(ring);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.18, 8), M(0xe8d8b0, 0.8)); cup.position.set(Math.cos(a) * 1.05, 0.12, Math.sin(a) * 1.05); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), flameMat); fl.position.set(Math.cos(a) * 1.05, 0.3, Math.sin(a) * 1.05); fl.scale.y = 1.5; this._flames.push(fl); chand.add(cup, fl); }
    const chLight = new THREE.PointLight(0xffca96, 2.6, 22); chLight.position.y = 0.1; chLight.castShadow = false; chand.add(chLight);
    g.add(chand);

    const sconce = (x, z) => { const s = new THREE.Group(); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.5, 6), iron); br.position.set(x, 2.5, z); br.rotation.z = x < 0 ? -0.5 : 0.5; const fl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), flameMat); fl.position.set(x + (x < 0 ? 0.18 : -0.18), 2.75, z); fl.scale.y = 1.5; this._flames.push(fl); const li = new THREE.PointLight(0xff9a4a, 1.1, 9); li.position.set(x + (x < 0 ? 0.4 : -0.4), 2.8, z); li.castShadow = false; s.add(br, fl, li); g.add(s); };
    sconce(-11.2, -4); sconce(11.2, -4);

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 9), wood); shelf.position.set(-11, 1.9, -4); shelf.castShadow = true; g.add(shelf);
    const shelf2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 9), wood); shelf2.position.set(-11, 2.6, -4); g.add(shelf2);
    const bottleCols = [0x6fb08a, 0xb04a4a, 0x4a7ab0, 0xc9a24a, 0x8a5ad0];
    for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.34, 8), M(bottleCols[i % 5], 0.5)); b.position.set(-11, (i % 2 ? 2.78 : 2.08), -8 + i * 0.55); g.add(b); }

    for (const z of [-7.5, -4, -0.5]) { const st = new THREE.Group(); const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 12), M(0x7a3a2a)); seat.position.y = 0.95; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), wood); leg.position.y = 0.45; st.add(seat, leg); st.position.set(-7.7, 0, z); st.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.add(st); }

    for (const [x, z, y] of [[-10.4, 4.4, 0.55], [-9.4, 4.6, 0.55], [-9.9, 4.5, 1.5]]) { const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.0, 12), wood); keg.rotation.z = Math.PI / 2; keg.position.set(x, y, z); keg.castShadow = true; const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.04, 6, 16), iron); ring1.position.copy(keg.position); ring1.rotation.y = Math.PI / 2; g.add(keg, ring1); }

    const sign = new THREE.Group(); sign.position.set(0, 2.7, -10.4);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.12), M(0x6a4426, 0.9)); plank.castShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.16), M(0xffd98a, 0.5, 0.3)); trim.position.y = 0.48;
    const toad = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), M(0x6fbf5a, 0.7)); toad.position.set(0, 0, 0.1); toad.scale.set(1.2, 0.9, 1);
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), M(0xffffff, 0.6)); eyeW.position.set(-0.13, 0.18, 0.28);
    const eyeW2 = eyeW.clone(); eyeW2.position.x = 0.13;
    for (const cx of [-1.0, 1.0]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), iron); ch.position.set(cx, 0.62, 0); sign.add(ch); }
    sign.add(plank, trim, toad, eyeW, eyeW2); g.add(sign);

    const paneMat = new THREE.MeshStandardMaterial({ color: 0x9fc4ff, emissive: 0x4a6aa0, emissiveIntensity: 0.8, roughness: 0.4 });
    for (const [x, z] of [[-11.6, 1.5], [11.6, 1.5], [11.6, -8]]) { const win = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.2), paneMat); win.position.set(x, 2.1, z); const bar1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.08), wood); bar1.position.set(x, 2.1, z); const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 1.2), wood); bar2.position.set(x, 2.1, z); g.add(win, bar1, bar2); }

    const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 14), M(0x7a2f3a, 0.95)); runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.012, -2); runner.receiveShadow = true; g.add(runner);
    // hearth
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.6), M(0x5a5050, 1)); hearth.position.set(6, 0.8, 6.4); g.add(hearth);
    const flames = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.0, 8), flameMat); flames.position.set(6, 0.9, 6.1); flames.scale.y = 1; this._flames.push(flames); g.add(flames);
    const fireLight = new THREE.PointLight(0xff8a3a, 1.2, 12); fireLight.position.set(6, 1.2, 6); fireLight.castShadow = false; g.add(fireLight);
  }

  nearestStation(pos, list, range = 2.4) {
    let best = null, bd = range * range;
    for (const s of list) { const dx = s.pos.x - pos.x, dz = s.pos.z - pos.z; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = s; } }
    return best;
  }

  reset() {
    this.exited = false; this.ruckus.props = 0; this.ruckus.patrons = 0; this.phase = 0;
    this._prevWz = this.start.z;
    for (const p of this.props) { p.knocked = false; p.fall = 0; p.vel.set(0, 0, 0); p.mesh.position.copy(p.home); p.mesh.rotation.set(0, 0, 0); }
    for (const n of this.npcs) { n.annoyedCd = 0; n.wob = 0; n.repathCd = Math.random() * 3; n.pos.copy(n.home); n.target.copy(n.home); n.mesh.position.set(n.home.x, 0, n.home.z); }
  }

  show(v) { this.group.visible = v; }
  showRoom(v) { this.roomScene.visible = v; }

  _flicker() { if (this._flames) for (let i = 0; i < this._flames.length; i++) { const f = this._flames[i]; const s = 1 + Math.sin(this.phase * 9 + i * 1.7) * 0.18; f.scale.set(s, 1.5 * s, s); f.material.opacity = 0.8 + Math.sin(this.phase * 13 + i) * 0.12; } }

  update(dt, game) {
    this.phase += dt;
    const w = game.wizard;
    const wr = 0.7;

    for (const n of this.npcs) {
      n.phase += dt;
      n.repathCd -= dt;
      const reached = n.pos.distanceTo(n.target) < 0.4;
      if (n.repathCd <= 0 || reached) { n.repathCd = 2.5 + Math.random() * 3.5; n.target.set(-5 + Math.random() * 13, 0, -7 + Math.random() * 12); }
      if (n.annoyedCd <= 0.6) {
        const tx = n.target.x - n.pos.x, tz = n.target.z - n.pos.z; const td = Math.hypot(tx, tz) || 1e-4; const step = Math.min(td, n.speed * dt);
        n.pos.x += (tx / td) * step; n.pos.z += (tz / td) * step; if (td > 0.1) n.yaw = Math.atan2(tx, tz);
      }
      n.mesh.position.set(n.pos.x, Math.abs(Math.sin(n.phase * 5)) * 0.06, n.pos.z); n.mesh.rotation.y = n.yaw;
      const dx = w.pos.x - n.pos.x, dz = w.pos.z - n.pos.z; const d = Math.hypot(dx, dz) || 1e-4; const minD = wr + n.r;
      if (d < minD) {
        const push = (minD - d); w.pos.x += (dx / d) * push; w.pos.z += (dz / d) * push; w.vel.x += (dx / d) * 3; w.vel.z += (dz / d) * 3; w.leanV.x += (dx / d) * 5; w.leanV.z += (dz / d) * 5;
        if (n.annoyedCd <= 0) { n.annoyedCd = 1.2; n.wob = 1; this.ruckus.patrons++; game.audio.play('hurt'); game.shake(0.5); if (this.ruckus.patrons === 1) game.showStory('Patron', ['OI! Watch where you\'re flailing, you soggy old fool!']); }
      }
      if (n.annoyedCd > 0) n.annoyedCd -= dt;
      if (n.wob > 0) { n.wob -= dt * 2; n.mesh.rotation.z = Math.sin(this.phase * 22) * 0.15 * Math.max(0, n.wob); } else { n.mesh.rotation.z = Math.sin(n.phase) * 0.03; }
    }

    for (const p of this.props) {
      if (!p.knocked) {
        const dx = p.mesh.position.x - w.pos.x, dz = p.mesh.position.z - w.pos.z; const d = Math.hypot(dx, dz) || 1e-4;
        if (d < wr + p.r) {
          p.knocked = true; this.ruckus.props++;
          const sp = Math.max(2, 6 - p.mass) + Math.hypot(w.vel.x, w.vel.z) * 0.4; p.vel.set((dx / d) * sp, 2, (dz / d) * sp);
          w.leanV.x -= (dx / d) * 4 / p.mass; w.leanV.z -= (dz / d) * 4 / p.mass; game.audio.play('hit'); game.shake(0.4);
          game.particles.burst({ pos: p.mesh.position.clone().setY(0.6), color: 0x7a5230, count: 8, speed: 4, size: 0.25, life: 0.6, grav: -12, blend: 'normal' });
        }
      } else {
        p.fall = Math.min(1, p.fall + dt * 2.4); p.vel.y -= 12 * dt; p.mesh.position.addScaledVector(p.vel, dt);
        if (p.mesh.position.y < p.homeY * 0.4 + 0.1) { p.mesh.position.y = p.homeY * 0.4 + 0.1; p.vel.set(p.vel.x * 0.4, 0, p.vel.z * 0.4); }
        p.vel.x *= Math.pow(0.05, dt); p.vel.z *= Math.pow(0.05, dt);
        p.mesh.rotation.x = p.axis.z * p.fall * 1.5; p.mesh.rotation.z = -p.axis.x * p.fall * 1.5;
        p.mesh.position.x = Math.max(MINX, Math.min(MAXX, p.mesh.position.x)); p.mesh.position.z = Math.max(NORTH, Math.min(SOUTH, p.mesh.position.z));
      }
    }

    this._arrow.position.y = 3.4 + Math.sin(this.phase * 3) * 0.2;
    this._flicker();
    for (const s of this.stations) if (s.mark) { s.mark.rotation.y += dt * 2; s.mark.position.y = 2.4 + Math.sin(this.phase * 3 + s.pos.x) * 0.16; }
    game.nearStation = this.nearestStation(w.pos, this.stations);

    w.pos.x = Math.max(MINX, Math.min(MAXX, w.pos.x));
    w.pos.z = Math.max(NORTH, Math.min(SOUTH, w.pos.z));
  }

  updateRoom(dt, game) {
    this.phase += dt;
    const w = game.wizard;
    this._flicker();
    for (const s of this.roomStations) if (s.mark) { s.mark.rotation.y += dt * 2; s.mark.position.y = (s.type === 'station' ? 1.9 : 2.0) + Math.sin(this.phase * 3 + s.pos.x) * 0.14; }
    game.nearStation = this.nearestStation(w.pos, this.roomStations, 1.9);
    w.pos.x = Math.max(RMINX, Math.min(RMAXX, w.pos.x));
    w.pos.z = Math.max(RNORTH, Math.min(RSOUTH, w.pos.z));
  }
}
