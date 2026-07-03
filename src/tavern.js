// tavern.js — TWO scenes:
//   • the Bar (hub): a polished, normal tavern. Just a bar — no management
//     stations. You can tend the bar for tips, head out the door on a run, or
//     climb the stairs to your room.
//   • your Room (separate scene): starts bare but for a bed. You craft & place
//     functional stations (Spell Table, Cauldron, Wardrobe, Anvil, Ledger,
//     Quest Board) and comforts here with gold, then walk up to use them.
import * as THREE from 'three';
import { buildCharModel } from './charmodels.js';
import { iconCanvas } from './pixelicons.js';

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
    this.tables = [];                              // the 4 serving tables
    this.questNpcs = [];                            // unique walk-in customers (quest givers)
    this.order = { table: null, stage: 'idle' };   // 'idle' | 'taken' | 'carrying'
    this._build();
    this._buildAmbience();
    this._buildBarFittings();
    this._buildTavernTables();
    this._buildRoomScene();
    this.roomItems = new THREE.Group(); this.roomScene.add(this.roomItems); // player-placed things
  }

  // ===================== THE BAR =====================
  _build() {
    const g = this.group;
    // warm plank floor with alternating boards + an inlaid border
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.005, -4); floor.receiveShadow = true; g.add(floor);
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x6a4528, roughness: 0.92 });
    for (let i = -5; i <= 5; i++) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 24), plankMat); pl.rotation.x = -Math.PI / 2; pl.position.set(i * 2.1, 0.008, -4); g.add(pl); }

    // walls + wainscoting band + crown trim for a finished, less-flat look
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.92 });
    const wainMat = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.7 });
    const WH = 3.2, WY = 1.6;
    const wall = (w, h, d, x, y, z, horiz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
      // wainscoting (lower panel) + crown trim, sized to the wall run
      const run = horiz ? w : d;
      const wain = new THREE.Mesh(horiz ? new THREE.BoxGeometry(run, 1.0, d + 0.12) : new THREE.BoxGeometry(w + 0.12, 1.0, run), wainMat); wain.position.set(x, 0.5, z); g.add(wain);
      const crown = new THREE.Mesh(horiz ? new THREE.BoxGeometry(run, 0.18, d + 0.18) : new THREE.BoxGeometry(w + 0.18, 0.18, run), trimMat); crown.position.set(x, WH - 0.1, z); g.add(crown);
      return m;
    };
    wall(26, WH, 0.6, 0, WY, SOUTH + 0.6, true);
    wall(0.6, WH, 24, MINX - 0.6, WY, -4, false);
    wall(0.6, WH, 24, MAXX + 0.6, WY, -4, false);
    wall(9.2, WH, 0.6, -6.9, WY, NORTH - 0.6, true);
    wall(9.2, WH, 0.6, 6.9, WY, NORTH - 0.6, true);

    // glowing exit door (venture out)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffb74d, emissiveIntensity: 1.3, roughness: 0.6 });
    const doorway = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HALF * 2, 3.6, 0.3), doorMat);
    doorway.position.set(DOOR_X, 1.8, NORTH - 0.5); g.add(doorway);
    const glow = new THREE.PointLight(0xffd08a, 3, 14); glow.position.set(DOOR_X, 2.2, NORTH); g.add(glow);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 4), new THREE.MeshBasicMaterial({ color: 0xfff0c2, transparent: true, opacity: 0.9 }));
    arrow.position.set(DOOR_X, 3.4, NORTH + 0.5); arrow.rotation.x = Math.PI; g.add(arrow);
    this._arrow = arrow;

    // bar counter along the west — base + polished overhanging top + brass foot rail
    const barMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
    const barTopMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.45, metalness: 0.15 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9a84a, roughness: 0.4, metalness: 0.6 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2, 1.1, 12), barMat);
    bar.position.set(-9.2, 0.55, -4); bar.castShadow = true; bar.receiveShadow = true; g.add(bar);
    const barTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 12.4), barTopMat); barTop.position.set(-9.1, 1.16, -4); barTop.castShadow = true; g.add(barTop);
    const footRail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 12, 8), brassMat); footRail.rotation.x = Math.PI / 2; footRail.position.set(-8.1, 0.22, -4); g.add(footRail);
    for (const z of [-9, -4, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), brassMat); post.position.set(-8.1, 0.11, z); g.add(post); }

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

    // a tidy wooden staircase tucked into the back-east corner, climbing to a
    // door set flush against the wall — reads as a single floor with a "way up".
    const stair = new THREE.Group();
    const STEPS = 4, RISE = 0.34, DEPTH = 0.6, SX = 9, topZ = -13.2;
    for (let i = 0; i < STEPS; i++) {
      const y = (i + 0.5) * RISE, z = topZ + (STEPS - 1 - i) * DEPTH;
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, RISE, DEPTH + 0.02), wood);
      step.position.set(SX, y, z); step.castShadow = true; step.receiveShadow = true; stair.add(step);
    }
    const topY = STEPS * RISE;
    // closed side panel + handrail on the open (west) side
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.22, topY, STEPS * DEPTH + 0.2), woodD);
    side.position.set(SX - 1.31, topY / 2, topZ + (STEPS - 1) * DEPTH / 2 - 0.1); side.castShadow = true; stair.add(side);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, STEPS * DEPTH + 0.4), new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.6 }));
    rail.position.set(SX - 1.31, topY + 0.55, topZ + (STEPS - 1) * DEPTH / 2 - 0.1); rail.rotation.x = -Math.atan2(topY, STEPS * DEPTH); stair.add(rail);
    // landing flush with the top step
    const landing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 1.1), wood); landing.position.set(SX, topY - 0.14, topZ - 0.85); landing.castShadow = true; stair.add(landing);
    // a real door + frame against the back wall (sized to sit under the wall top)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.85 });
    const DOORH = 1.7, doorZ = topZ - 1.4, baseY = topY;
    const upDoor = new THREE.Mesh(new THREE.BoxGeometry(1.4, DOORH, 0.14), doorMat); upDoor.position.set(SX, baseY + DOORH / 2, doorZ); stair.add(upDoor);
    const fL = new THREE.Mesh(new THREE.BoxGeometry(0.16, DOORH + 0.2, 0.22), frameMat); fL.position.set(SX - 0.8, baseY + DOORH / 2, doorZ);
    const fR = fL.clone(); fR.position.x = SX + 0.8;
    const fT = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 0.22), frameMat); fT.position.set(SX, baseY + DOORH + 0.1, doorZ);
    stair.add(fL, fR, fT);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd9a84a, metalness: 0.6, roughness: 0.4 })); knob.position.set(SX + 0.45, baseY + DOORH / 2, doorZ + 0.1); stair.add(knob);
    const upGlow = new THREE.PointLight(0xffb060, 1.1, 8); upGlow.position.set(SX, baseY + 1.0, doorZ + 1.2); upGlow.castShadow = false; stair.add(upGlow);
    g.add(stair);
    // no floating marker — the staircase + its warm doorway glow read clearly, and the interact prompt guides you
    this.stations.push({ type: 'stairs', label: 'climb to your Room', pos: new THREE.Vector3(SX, 0, -10.4), mark: null });

    // (the bar no longer has a serving job — patrons walk the room and you chat them up)

    // the venture door
    this.stations.push({ type: 'door', label: 'venture out on a run', pos: this.door.clone(), mark: null });
  }

  // ===================== the 4 serving tables (the WORK loop) =====================
  _makeBubble() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(2.4, 2.4, 2.4);
    s.userData = { canvas: c, ctx, tex };
    return s;
  }
  _drawBubble(table, icon) {
    const s = table.bubble, ud = s.userData, x = ud.ctx;
    x.clearRect(0, 0, 256, 256);
    // pointer triangle aimed down at the patron
    x.fillStyle = 'rgba(255,255,255,0.97)'; x.beginPath(); x.moveTo(98, 168); x.lineTo(128, 232); x.lineTo(158, 168); x.closePath(); x.fill();
    // the bubble: white disc with a soft drop shadow so it reads against any background
    x.save(); x.shadowColor = 'rgba(0,0,0,0.4)'; x.shadowBlur = 16; x.shadowOffsetY = 7;
    x.fillStyle = 'rgba(255,255,255,0.97)'; x.beginPath(); x.arc(128, 100, 86, 0, 6.28); x.fill(); x.restore();
    // a bold gold ring + thin dark outline for contrast
    x.lineWidth = 9; x.strokeStyle = '#ffcf5c'; x.beginPath(); x.arc(128, 100, 84, 0, 6.28); x.stroke();
    x.lineWidth = 3; x.strokeStyle = 'rgba(20,12,28,0.5)'; x.beginPath(); x.arc(128, 100, 89, 0, 6.28); x.stroke();
    // the order icon, large and centred — one of OUR pixel sprites, not an emoji
    const spr = iconCanvas(icon, { scale: 8 });
    if (spr) { x.imageSmoothingEnabled = false; x.drawImage(spr, 128 - 56, 100 - 56, 112, 112); }
    ud.tex.needsUpdate = true;
    table.want = icon;
  }
  _buildTavernTables() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6a4528, roughness: 0.88 });
    const robeColors = [0x7a8bd0, 0xcf6f6f, 0x6fb08a, 0xc9a24a];
    const pos = [[-4.6, 2], [4.6, 2], [-4.6, -8.5], [4.6, -8.5]];
    pos.forEach(([x, z], i) => {
      const grp = new THREE.Group(); grp.position.set(x, 0, z);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.16, 16), woodMat); top.position.y = 0.92; top.castShadow = true; top.receiveShadow = true; grp.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.92, 8), woodMat); leg.position.y = 0.46; grp.add(leg);
      const cust = this._buildPatron(robeColors[i % robeColors.length], i % 2 === 0);
      cust.position.set(0, 0, -1.05); cust.rotation.y = 0; cust.scale.setScalar(0.92); cust.visible = false; grp.add(cust);
      const bubble = this._makeBubble(); bubble.position.set(0, 2.9, -1.0); bubble.visible = false; grp.add(bubble);
      this.group.add(grp);
      // tables are now just set dressing (the serving job is gone) — keep them empty
      const table = { grp, top, cust, bubble, pos: new THREE.Vector3(x, 0, z), state: 'off', t: Infinity, phase: Math.random() * 6 };
      this.tables.push(table);
    });
    // a full mug that rides in the wizard's hands while carrying a drink to a table
    this.carryMug = new THREE.Group();
    const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.6 }));
    const foam = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff7e8, roughness: 0.7 })); foam.position.y = 0.17; foam.scale.y = 0.55;
    this.carryMug.add(mb, foam); this.carryMug.visible = false; this.group.add(this.carryMug);
  }

  // ===================== unique walk-in customers (quest givers) =====================
  // a bobbing "!" marker (canvas sprite) hovering over a quest-giver's head
  _makeQuestMarker(icon) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.save(); x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 10; x.shadowOffsetY = 4;
    x.fillStyle = '#ffcf5c'; x.beginPath(); x.arc(64, 56, 40, 0, 6.28); x.fill(); x.restore();
    x.lineWidth = 5; x.strokeStyle = '#1a1020'; x.beginPath(); x.arc(64, 56, 40, 0, 6.28); x.stroke();
    const spr = iconCanvas(icon || 'bang', { scale: 6 });
    if (spr) { x.imageSmoothingEnabled = false; x.drawImage(spr, 64 - 28, 56 - 28, 56, 56); }
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(1.0, 1.0, 1.0);
    return s;
  }
  // (re)build the walk-around patrons: quest-givers (❗) + a few regulars (💬) you can chat
  // up for a small tip. This is the bar's loop now (no serving).
  setupCustomers(quests) {
    for (const qn of this.questNpcs) {
      this.group.remove(qn.mesh);
      qn.mesh.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material; if (m) { if (m.map) m.map.dispose(); m.dispose(); }
      });
    }
    this.questNpcs.length = 0;
    this.stations = this.stations.filter(s => s.type !== 'customer');
    const spots = [[-7.5, -1], [7.2, -2.5], [-2, -7], [6, 3.5], [-5, 4.5]];
    const colors = [0x7a8bd0, 0xcf6f6f, 0x6fb08a, 0xc9a24a, 0xb06fa0];
    const REGULARS = [
      { name: 'Old Bram', icon: '🧔', model: 'dwarf', line: 'Cold night out there, eh? Here — wet your beard on me.' },
      { name: 'Maid Wynn', icon: '👩', model: 'barmaid', line: 'You look parched, dearie. A little something for the road.' },
      { name: 'Frodric the Fat', icon: '🧓', model: 'merchant', line: 'Hah! A real wizard in the Toad. Have a few coppers, lad.' },
    ];
    const cast = [];
    for (const q of (quests || [])) cast.push({ kind: 'quest', quest: q, name: q.npc.name, icon: q.npc.icon, color: q.npc.color, model: q.npc.kind, line: q.npc.line });
    for (let i = 0; cast.length < spots.length && i < REGULARS.length; i++) { const r = REGULARS[i]; cast.push({ kind: 'regular', id: 'reg' + i, name: r.name, icon: r.icon, model: r.model, line: r.line, color: colors[cast.length % colors.length] }); }
    cast.slice(0, spots.length).forEach((c, i) => {
      // each patron gets their own unique 3D pixel model (falls back to the generic patron)
      let person; try { person = c.model ? buildCharModel(c.model) : this._buildPatron(c.color, i % 2 === 0); } catch (e) { person = this._buildPatron(c.color, i % 2 === 0); }
      const [sx, sz] = spots[i];
      person.position.set(sx, 0, sz); person.rotation.y = Math.random() * Math.PI * 2;
      // every quest-giver wears the "!" badge (their FACE is their 3D model already);
      // regulars get a chat bubble — both painted from our pixel sprite set
      const marker = this._makeQuestMarker(c.kind === 'quest' ? 'bang' : 'bubble'); marker.position.set(0, 2.5, 0); person.add(marker);
      this.group.add(person);
      const station = { type: 'customer', label: `chat with ${c.name}`, pos: new THREE.Vector3(sx, 0, sz), mark: null, quest: c.kind === 'quest' ? c.quest : null };
      const qn = { mesh: person, marker, pos: new THREE.Vector3(sx, 0, sz), target: new THREE.Vector3(sx, 0, sz), r: 0.6, phase: Math.random() * 6, repathCd: Math.random() * 3, speed: 0.9 + Math.random() * 0.5, yaw: 0, station, name: c.name, icon: c.icon, model: c.model, line: c.line, quest: station.quest, regularId: c.kind === 'regular' ? c.id : null };
      station.npc = qn;
      this.questNpcs.push(qn);
      this.stations.push(station);
    });
  }

  resetTables() {
    // serving removed — tables stay empty set-dressing; patrons roam & are chatted up instead
    this.order = { table: null, stage: 'idle' };
    if (this.carryMug) this.carryMug.visible = false;
    for (const tb of this.tables) { tb.state = 'off'; tb.t = Infinity; if (tb.cust) tb.cust.visible = false; if (tb.bubble) tb.bubble.visible = false; }
  }

  // interact with a table: take an order, or serve the drink you're carrying
  tableAction(table, game) {
    const o = this.order;
    if (o.stage === 'carrying' && o.table === table) {
      // serve!
      this.order = { table: null, stage: 'idle' };
      this.carryMug.visible = false;
      table.state = 'happy'; table.t = 3 + Math.random() * 4; this._drawBubble(table, '😄');
      game.onTavernServe();
      return;
    }
    if (table.state !== 'waiting') { game.ui.wispSay('Nobody\'s waiting at that table.', { tone: 'warn' }); return; }
    if (o.stage === 'idle') {
      this.order = { table, stage: 'taken' };
      this._drawBubble(table, '✅'); game.audio.play('click');
      game.ui.toast('📝 Order taken — now pour it at the Bar!');
    } else if (o.stage === 'carrying') {
      game.ui.wispSay('That pint is for another table!', { tone: 'warn' });
    } else {
      game.ui.wispSay('You\'ve already taken an order — pour it at the Bar.', { tone: 'warn' });
    }
  }
  // interact at the bar: pour the taken order, then you carry it
  barAction(game) {
    const o = this.order;
    if (o.stage === 'taken') {
      o.stage = 'carrying'; this.carryMug.visible = true;
      game.audio.play('levelup');
      game.ui.toast('🍺 Poured! Carry it to the table — mind the crowd, don\'t spill!');
    } else if (o.stage === 'carrying') {
      game.ui.wispSay('Already poured — take it to the table!', { tone: 'warn' });
    } else {
      game.ui.wispSay('Take an order from a waiting table first.', { tone: 'warn' });
    }
  }
  _spill(game) {
    if (this.order.stage !== 'carrying') return;
    this.order.stage = 'taken';
    this.carryMug.visible = false;
    game.audio.play('hiccup'); game.shake(0.6);
    game.ui.wispSay('💦 You sloshed it everywhere! Re-pour at the Bar.', { tone: 'warn' });
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

    // stairs back down (front-right)
    const downStair = new THREE.Group();
    for (let i = 0; i < 5; i++) { const step = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 0.6), new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.9 })); step.position.set(6, 0.2 - i * 0.18, 4.0 + i * 0.5); downStair.add(step); }
    g.add(downStair);

    // a small rug + the "empty room" feel
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.0, 24), new THREE.MeshStandardMaterial({ color: 0x6a3a5a, roughness: 0.95 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0.5, 0.02, 1); rug.receiveShadow = true; g.add(rug);

    // fixed room interactables — no floating markers (the bed & stairs are obvious; the prompt guides you)
    this._roomFixedStations = [
      { type: 'rest', label: 'your Bed — rest before a run', pos: new THREE.Vector3(-5.4, 0, -4.4), mark: null },
      { type: 'down', label: 'head back down to the Bar', pos: new THREE.Vector3(6, 0, 4.4), mark: null },
    ];
  }

  // (re)build placed items + their interactables from the save
  get _roomGrid() { return { ox: -4.6, oz: -3.4, cell: 1.9 }; }
  refreshRoom(meta) {
    const grp = this.roomItems;
    for (let i = grp.children.length - 1; i >= 0; i--) {
      const c = grp.children[i];
      c.traverse(o => {
        if (o.isMesh) { if (o.geometry) o.geometry.dispose(); const m = o.material; if (Array.isArray(m)) m.forEach(x => x && x.dispose()); else if (m) m.dispose(); }
        if (o.isLight && o.dispose) o.dispose();
      });
      grp.remove(c);
    }
    this.roomStations = this._roomFixedStations.slice();
    const G = this._roomGrid;
    for (const p of meta.placedItems()) {
      const b = meta.buildableById(p.id);
      const m = this._buildPlaced(p.id); if (!m) continue;
      const x = G.ox + p.gx * G.cell, z = G.oz + p.gy * G.cell;
      m.position.set(x, 0, z); m.rotation.y = (p.rot !== undefined) ? p.rot : ((p.gx * 1.7 + p.gy) % 6.28); grp.add(m);
      if (b && b.station) {
        this.roomStations.push({ type: 'station', kind: b.station, label: `the ${b.name}`, pos: new THREE.Vector3(x, 0, z), mark: null });
      }
    }
  }

  _buildPlaced(id) {
    const M = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const E = (c, i = 0.9, col) => new THREE.MeshStandardMaterial({ color: col || c, emissive: c, emissiveIntensity: i, roughness: 0.4 });
    const GLOW = (c, o = 0.85) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
    const wood = M(0x7a5230, 0.9), woodDk = M(0x5a3a20, 0.92), gold = M(0xffd98a, 0.4, 0.5), iron = M(0x33323a, 0.55, 0.35), cloth = M(0x8a3a52, 0.95);
    const g = new THREE.Group();
    const add = (mesh, recv) => { mesh.castShadow = true; if (recv) mesh.receiveShadow = true; g.add(mesh); return mesh; };
    // four little turned legs at a corner span, height h, top y
    const legs = (span, h, mat, y = 0) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, h, 7), mat)); l.position.set(sx * span, y + h / 2, sz * span); } };
    switch (id) {
      // ---- functional stations ----
      case 'spelltable': {
        legs(0.62, 0.86, woodDk);
        const top = add(new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.16, 1.05), wood)); top.position.y = 0.94;
        const trim = add(new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.06, 1.12), gold)); trim.position.y = 1.02;
        // open spellbook with two pages
        const spine = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.5), M(0x5b3fa0, 0.7))); spine.position.set(0, 1.08, 0); spine.rotation.y = 0.25;
        for (const s of [-1, 1]) { const page = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.46), M(0xf2efe0, 0.85))); page.position.set(s * 0.2, 1.135, 0); page.rotation.y = 0.25; page.rotation.z = s * 0.16; }
        // candle
        const candle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 8), M(0xede2c0, 0.8))); candle.position.set(0.55, 1.14, -0.3);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 7), GLOW(0xffb35c, 0.95)); flame.position.set(0.55, 1.32, -0.3); g.add(flame);
        // floating rune ring + gem
        const rune = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 20), GLOW(0x9b7bff)); rune.rotation.x = Math.PI / 2; rune.position.y = 1.5; g.add(rune);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), E(0x9b7bff, 1.1, 0xcdbcff)); gem.position.y = 1.5; g.add(gem);
        break;
      }
      case 'cauldron': {
        for (const a of [0, 2.094, 4.188]) { const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.46, 6), iron)); leg.position.set(Math.cos(a) * 0.42, 0.22, Math.sin(a) * 0.42); leg.rotation.z = Math.cos(a) * 0.18; leg.rotation.x = -Math.sin(a) * 0.18; }
        const belly = add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 14), iron)); belly.scale.set(1, 0.86, 1); belly.position.y = 0.72;
        const rim = add(new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.08, 8, 18), iron)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.98;
        const brew = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 16), GLOW(0xb06ad8, 0.9)); brew.position.y = 0.99; g.add(brew);
        const brewLight = new THREE.PointLight(0xb06ad8, 0.7, 4); brewLight.position.y = 1.2; brewLight.castShadow = false; g.add(brewLight);
        for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06 + i * 0.02, 8, 8), GLOW(0xd9b6ff, 0.8)); b.position.set((i - 1) * 0.16, 1.05 + i * 0.06, 0); g.add(b); }
        const ladle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), gold)); ladle.position.set(0.34, 1.18, 0.1); ladle.rotation.z = 0.5;
        break;
      }
      case 'wardrobe': {
        const cab = add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.78, 0.62), M(0x4a3322))); cab.position.y = 0.92;
        const cornice = add(new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.16, 0.74), woodDk)); cornice.position.y = 1.86;
        for (const s of [-1, 1]) { const door = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.06), M(0x5a4030, 0.85))); door.position.set(s * 0.27, 0.95, 0.32); const panel = add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.0, 0.04), M(0x6f5fc4, 0.6))); panel.position.set(s * 0.27, 1.0, 0.36); const knob = add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), gold)); knob.position.set(s * 0.06, 0.95, 0.37); }
        for (const sx of [-1, 1]) { const foot = add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.5), woodDk)); foot.position.set(sx * 0.42, 0.06, 0); }
        break;
      }
      case 'anvil': {
        const stump = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.6, 12), woodDk)); stump.position.y = 0.3;
        const ring = add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 16), iron)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.5;
        const waist = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.5), M(0x3a3a42, 0.5, 0.5))); waist.position.y = 0.72;
        const top = add(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.46), M(0x44444e, 0.45, 0.55))); top.position.y = 0.9;
        const horn = add(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 10), M(0x44444e, 0.45, 0.55))); horn.rotation.z = -Math.PI / 2; horn.position.set(0.6, 0.9, 0);
        const hammer = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), wood)); hammer.position.set(-0.3, 0.78, 0.28); hammer.rotation.z = 0.9;
        const head = add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), iron)); head.position.set(-0.1, 1.02, 0.28);
        for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), GLOW(0xffb454, 0.9)); sp.position.set(0.1 + Math.random() * 0.2, 1.02 + Math.random() * 0.15, (Math.random() - 0.5) * 0.2); g.add(sp); }
        break;
      }
      case 'ledger': {
        const desk = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.82), wood)); desk.position.y = 0.86;
        legs(0.6, 0.82, woodDk);
        for (const sx of [-1, 1]) { const drawer = add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.7), M(0x6a4628, 0.9))); drawer.position.set(sx * 0.36, 0.55, 0); const k = add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), gold)); k.position.set(sx * 0.36, 0.55, 0.36); }
        const book = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.38), M(0x7a3a2a, 0.7))); book.position.set(-0.32, 0.97, 0); book.rotation.z = -0.06;
        const ink = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), iron)); ink.position.set(0.18, 0.97, 0.18);
        const quill = add(new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.02, 0.3, 5), M(0xf2efe0, 0.6))); quill.position.set(0.2, 1.1, 0.18); quill.rotation.z = 0.5;
        for (let i = 0; i < 4; i++) { const c = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12), gold)); c.position.set(0.42, 0.94 + i * 0.06, -0.18); }
        break;
      }
      case 'library': {
        const frame = add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.78, 0.42), M(0x3a2c4a))); frame.position.y = 0.9;
        const cornice = add(new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.14, 0.5), woodDk)); cornice.position.y = 1.84;
        for (const sy of [0.42, 1.0, 1.58]) { const sh = add(new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.06, 0.4), woodDk)); sh.position.set(0, sy, 0); }
        const cols = [0x6f5fc4, 0x4a7ab0, 0x6fb08a, 0xc9a24a, 0xb04a4a, 0x9b7bff];
        for (let i = 0; i < 12; i++) { const bw = 0.12 + Math.random() * 0.05, bh = 0.4 + Math.random() * 0.08; const b = add(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.32), M(cols[i % 6]))); b.position.set(-0.46 + (i % 6) * 0.18, [0.7, 1.28][Math.floor(i / 6)] + bh / 2 - 0.2, 0.02); b.rotation.z = (Math.random() - 0.5) * 0.14; }
        const tome = add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.3), M(0x2a1f44, 0.6))); tome.position.set(0, 0.5, 0.22); tome.rotation.x = -0.5;
        const rune = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 16), GLOW(0x9b7bff)); rune.rotation.x = -0.5; rune.position.set(0, 0.64, 0.27); g.add(rune);
        const glow = new THREE.PointLight(0x9b7bff, 0.5, 4); glow.position.set(0, 0.8, 0.4); glow.castShadow = false; g.add(glow);
        break;
      }
      case 'questboard': { const board = add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.1), M(0x4a3322))); board.position.y = 1.2; for (let i = 0; i < 4; i++) { const note = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.02), M([0xece0c0, 0xf2efe6, 0xe8d8b0][i % 3], 0.9))); note.position.set(-0.35 + (i % 2) * 0.6, 1.05 + Math.floor(i / 2) * 0.45, 0.07); } const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), wood)); post.position.y = 0.7; break; }
      // ---- comforts (decor) ----
      case 'rug': {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.03, 24), M(0x9a3a4a, 0.96)); r.position.y = 0.02; r.receiveShadow = true; g.add(r);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 6, 24), M(0xe0c060, 0.9)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.035; g.add(ring);
        const star = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.035, 6), M(0xd8b050, 0.9)); star.position.y = 0.036; g.add(star);
        break;
      }
      case 'chair': {
        const seat = add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.56), wood)); seat.position.y = 0.5;
        const cushion = add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), cloth)); cushion.position.y = 0.6;
        const back = add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.1), wood)); back.position.set(0, 0.96, -0.23);
        for (const sx of [-0.22, 0, 0.22]) { const slat = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.06), wood)); slat.position.set(sx, 0.76, -0.23); }
        for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), woodDk)); l.position.set(x, 0.25, z); } break;
      }
      case 'table': {
        const top = add(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 18), wood)); top.position.y = 0.72;
        const edge = add(new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 6, 20), woodDk)); edge.rotation.x = Math.PI / 2; edge.position.y = 0.7;
        const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.66, 10), woodDk)); leg.position.y = 0.36;
        const foot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12), woodDk)); foot.position.y = 0.04;
        const mug = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.16, 10), M(0xc9a24a, 0.5))); mug.position.set(0.18, 0.85, 0.1);
        break;
      }
      case 'lamp': {
        const foot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 12), iron)); foot.position.y = 0.04;
        const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.3, 8), iron)); pole.position.y = 0.7;
        const shade = add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.34, 14, 1, true), M(0xd8a24a, 0.8))); shade.position.y = 1.42;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), GLOW(0xffd98a, 0.95)); bulb.position.y = 1.34; g.add(bulb);
        const li = new THREE.PointLight(0xffcf8a, 0.7, 6); li.position.y = 1.34; li.castShadow = false; g.add(li);
        break;
      }
      case 'plant': {
        const pot = add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.36, 12), M(0xb06a3a, 0.9))); pot.position.y = 0.18;
        const rim = add(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 14), M(0x8a5230, 0.9))); rim.rotation.x = Math.PI / 2; rim.position.y = 0.36;
        for (const [x, y, z, s] of [[0, 0.62, 0, 0.32], [-0.18, 0.5, 0.1, 0.2], [0.18, 0.52, -0.08, 0.22], [0.05, 0.78, 0.05, 0.18]]) { const leaf = add(new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), M([0x3a824a, 0x469a56, 0x2f6e40][Math.floor(Math.random() * 3)], 0.85))); leaf.position.set(x, y, z); leaf.scale.y = 1.2; }
        const flower = add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), E(0xff6aa0, 0.5, 0xff8ab8))); flower.position.set(0.05, 0.94, 0.05);
        break;
      }
      case 'shelf': {
        const frame = add(new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.62, 0.42), M(0x4a3322))); frame.position.y = 0.81;
        for (const sy of [0.34, 0.92, 1.5]) { const board = add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.4), woodDk)); board.position.set(0, sy, 0); }
        const bookCols = [0xb04a4a, 0x4a7ab0, 0x6fb08a, 0xc9a24a, 0x8a5ad0, 0xd86a3a];
        for (let i = 0; i < 9; i++) { const bw = 0.1 + Math.random() * 0.05; const bh = 0.34 + Math.random() * 0.08; const b = add(new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.3), M(bookCols[i % 6]))); b.position.set(-0.4 + (i % 5) * 0.2, (i < 5 ? 0.56 : 1.14) + bh / 2 - 0.17, 0.04); b.rotation.z = (Math.random() - 0.5) * 0.12; }
        const potion = add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), GLOW(0x6ad8b0, 0.85))); potion.position.set(0.34, 1.0, 0.04);
        break;
      }
      case 'trophy': {
        const plinth = add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.52), M(0x4a4e5a, 0.9, 0.2))); plinth.position.y = 0.21;
        const plaque = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.03), gold)); plaque.position.set(0, 0.24, 0.27);
        const stem = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.18, 10), gold)); stem.position.y = 0.5;
        const cup = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 0.3, 14), gold)); cup.position.y = 0.72;
        for (const s of [-1, 1]) { const handle = add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI), gold)); handle.position.set(s * 0.22, 0.74, 0); handle.rotation.z = s * Math.PI / 2; }
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), E(0xffe08a, 0.7, 0xfff0c0)); star.position.y = 0.98; g.add(star);
        break;
      }
      case 'chest': {
        const base = add(new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.42, 0.5), M(0x6a4422, 0.9))); base.position.y = 0.22;
        const lid = add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.74, 14, 1, false, 0, Math.PI), M(0x6a4422, 0.9))); lid.rotation.z = Math.PI / 2; lid.position.y = 0.43;
        for (const sx of [-0.3, 0.3]) { const band = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.54), gold)); band.position.set(sx, 0.22, 0); }
        const lock = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.06), gold)); lock.position.set(0, 0.3, 0.27);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), GLOW(0xffe08a, 0.7)); glow.position.set(0, 0.46, 0.18); g.add(glow);
        break;
      }
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

    // wall-mounted tavern sign above the bar (no longer floating in mid-air)
    const sign = new THREE.Group(); sign.position.set(MINX + 0.45, 2.5, -4); sign.rotation.y = Math.PI / 2;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.12), M(0x6a4426, 0.9)); plank.castShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.16), M(0xffd98a, 0.5, 0.3)); trim.position.y = 0.48;
    const trimB = trim.clone(); trimB.position.y = -0.48;
    const toad = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), M(0x6fbf5a, 0.7)); toad.position.set(0, 0, 0.1); toad.scale.set(1.2, 0.9, 1);
    const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), M(0xffffff, 0.6)); eyeW.position.set(-0.13, 0.18, 0.28);
    const eyeW2 = eyeW.clone(); eyeW2.position.x = 0.13;
    sign.add(plank, trim, trimB, toad, eyeW, eyeW2); g.add(sign);

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
        if (this.order.stage === 'carrying') this._spill(game); // bumped a patron — spill!
        if (n.annoyedCd <= 0) { n.annoyedCd = 1.2; n.wob = 1; this.ruckus.patrons++; game.audio.play('hurt'); game.shake(0.5); if (this.ruckus.patrons === 1) game.showStory('Patron', ['OI! Watch where you\'re flailing, you soggy old fool!']); }
      }
      if (n.annoyedCd > 0) n.annoyedCd -= dt;
      if (n.wob > 0) { n.wob -= dt * 2; n.mesh.rotation.z = Math.sin(this.phase * 22) * 0.15 * Math.max(0, n.wob); } else { n.mesh.rotation.z = Math.sin(n.phase) * 0.03; }
    }

    // unique quest-giver customers: roam gently, bob their "!" marker, keep their
    // (moving) interact-station in sync so you can walk up and talk to them
    for (const qn of this.questNpcs) {
      qn.phase += dt; qn.repathCd -= dt;
      const reached = qn.pos.distanceTo(qn.target) < 0.4;
      if (qn.repathCd <= 0 || reached) { qn.repathCd = 2.5 + Math.random() * 3.5; qn.target.set(-8 + Math.random() * 16, 0, -8 + Math.random() * 12); }
      const tx = qn.target.x - qn.pos.x, tz = qn.target.z - qn.pos.z, td = Math.hypot(tx, tz) || 1e-4, step = Math.min(td, qn.speed * dt);
      qn.pos.x += (tx / td) * step; qn.pos.z += (tz / td) * step; if (td > 0.1) qn.yaw = Math.atan2(tx, tz);
      qn.mesh.position.set(qn.pos.x, Math.abs(Math.sin(qn.phase * 5)) * 0.06, qn.pos.z);
      qn.mesh.rotation.y = qn.yaw; qn.mesh.rotation.z = Math.sin(qn.phase) * 0.04;
      qn.marker.position.y = 2.5 + Math.sin(this.phase * 3 + qn.pos.x) * 0.14;
      qn.station.pos.set(qn.pos.x, 0, qn.pos.z);
    }

    for (const p of this.props) {
      if (!p.knocked) {
        const dx = p.mesh.position.x - w.pos.x, dz = p.mesh.position.z - w.pos.z; const d = Math.hypot(dx, dz) || 1e-4;
        if (d < wr + p.r) {
          p.knocked = true; this.ruckus.props++;
          if (this.order.stage === 'carrying') this._spill(game); // knocked furniture — spill!
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

    // ---- serving tables: customers trickle in, bubbles bob ----
    for (const tb of this.tables) {
      tb.phase += dt;
      if (tb.bubble.visible) tb.bubble.position.y = 2.5 + Math.sin(this.phase * 2 + tb.pos.x) * 0.12;
      if (tb.cust.visible) { tb.cust.position.y = Math.abs(Math.sin(this.phase * 3 + tb.phase)) * 0.04; tb.cust.rotation.y = Math.sin(this.phase + tb.phase) * 0.15; }
      if (tb.state === 'empty') { tb.t -= dt; if (tb.t <= 0) { tb.state = 'waiting'; tb.cust.visible = true; tb.bubble.visible = true; this._drawBubble(tb, '🍺'); } }
      else if (tb.state === 'happy') { tb.t -= dt; if (tb.t <= 0) { tb.state = 'empty'; tb.cust.visible = false; tb.bubble.visible = false; tb.t = 5 + Math.random() * 7; } }
    }
    // the full mug rides in the wizard's hands while delivering
    if (this.carryMug && this.carryMug.visible) {
      const fwd = new THREE.Vector3(Math.sin(w.yaw), 0, Math.cos(w.yaw));
      this.carryMug.position.set(w.pos.x + fwd.x * 0.5, 1.45 + Math.sin(this.phase * 8) * 0.03, w.pos.z + fwd.z * 0.5);
    }
    // contextual labels for the prompt
    for (const s of this.stations) {
      if (s.type === 'serve') s.label = this.order.stage === 'taken' ? 'pour the drink (the Bar)' : 'tend the Bar';
      else if (s.type === 'table') {
        const tb = s.table;
        s.label = (this.order.stage === 'carrying' && this.order.table === tb) ? 'serve the drink here'
          : (tb.state === 'waiting' && this.order.stage === 'idle') ? 'take their order'
            : 'a table';
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
