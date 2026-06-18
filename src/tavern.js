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
    this.ruckus = { props: 0, patrons: 0 };
    this.phase = 0;
    this.exited = false;
    this.start = new THREE.Vector3(0, 0, 5.5);
    this.door = new THREE.Vector3(DOOR_X, 0, NORTH);
    this._build();
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

    // glowing lanterns on posts
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffae42, emissiveIntensity: 1.2, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const lan = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), lanternMat);
      lan.position.set(-6 + i * 4, 3.0, -6 + (i % 2) * 6); g.add(lan);
    }

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

    // ---- patrons (solid: don't bump them) ----
    const shirtColors = [0x7a8bd0, 0xcf6f6f, 0x6fb08a, 0xc9a24a, 0x9a6fb0, 0xc98a5a];
    const patronPos = [[-6, 3], [2.5, -2], [-4, -4], [6.5, -5], [0.5, -9], [-7.5, -12]];
    patronPos.forEach((p, i) => {
      const person = new THREE.Group();
      const skin = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.8 });
      const shirt = new THREE.MeshStandardMaterial({ color: shirtColors[i % shirtColors.length], roughness: 0.85 });
      const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 10), shirt); bodyM.position.y = 1.0; bodyM.castShadow = true;
      const headM = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), skin); headM.position.y = 1.85; headM.castShadow = true;
      person.add(bodyM, headM);
      person.position.set(p[0], 0, p[1]);
      person.rotation.y = Math.random() * Math.PI * 2;
      g.add(person);
      this.npcs.push({ mesh: person, pos: new THREE.Vector3(p[0], 0, p[1]), r: 0.6, annoyedCd: 0, wob: 0, phase: Math.random() * 6 });
    });
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
    for (const n of this.npcs) { n.annoyedCd = 0; n.wob = 0; }
  }

  show(v) { this.group.visible = v; }

  update(dt, game) {
    if (this.exited) return;
    this.phase += dt;
    const w = game.wizard;
    const wr = 0.7;

    // patrons block the wizard (solid)
    for (const n of this.npcs) {
      n.phase += dt;
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

    this._arrow.position.y = 3.6 + Math.sin(this.phase * 3) * 0.2;

    // walls + door
    w.pos.x = Math.max(MINX, Math.min(MAXX, w.pos.x));
    if (w.pos.z < NORTH) {
      if (Math.abs(w.pos.x - DOOR_X) < DOOR_HALF) { this._exit(game); return; }
      w.pos.z = NORTH; w.vel.z *= -0.3;
    }
    if (w.pos.z > SOUTH) { w.pos.z = SOUTH; w.vel.z *= -0.3; }
  }

  _exit(game) {
    if (this.exited) return;
    this.exited = true;
    game.onTavernExit(this.ruckus.props + this.ruckus.patrons);
  }
}
