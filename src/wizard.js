// wizard.js — Wobblesworth the Sloshed.
// Body: a spring-driven torso/head/hat that sways and overshoots (drunk wobble).
// Limbs: real verlet-physics arms that dangle, swing and flop like a ragdoll —
// the Human: Fall Flat signature. They're simulated in world space and lag
// behind the shoulders, so every stagger sends them swinging.
import * as THREE from 'three';

const ARENA = 46;
const UP = new THREE.Vector3(0, 1, 0);

function spring(cur, vel, target, k, damp, dt) {
  const a = (target - cur) * k - vel * damp;
  vel += a * dt;
  cur += vel * dt;
  return [cur, vel];
}

// orient a unit-height cylinder mesh to span from a -> b
function orientSegment(mesh, a, b, baseLen) {
  const dir = b.clone().sub(a);
  const len = dir.length() || 0.0001;
  dir.multiplyScalar(1 / len);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir);
  mesh.scale.set(1, len / baseLen, 1);
}

export class Wizard {
  constructor(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3(0, 0, 0);

    this.yaw = 0;
    this.lean = { x: 0, z: 0 };
    this.leanV = { x: 0, z: 0 };
    this.headLean = { x: 0, z: 0 };
    this.headV = { x: 0, z: 0 };
    this.hatLean = { x: 0, z: 0 };
    this.hatV = { x: 0, z: 0 };

    this.bob = 0;
    this.drunk = Math.random() * 10;
    this.castTimer = 0;
    this.castDir = new THREE.Vector3(0, 0, 1);
    this.invuln = 0;
    this.flash = 0;
    this.hiccupIn = 3 + Math.random() * 4;

    this.hp = 100;
    this.mana = 100;
    this._maxHp = 100;
    this.shield = 0;
    this.shieldT = 0;
    this.alive = true;

    this._armReady = false;
    this._tmp = new THREE.Vector3();
    this._build();
  }

  _build() {
    const root = new THREE.Group();
    this.root = root;
    this.scene.add(root);

    const leaner = new THREE.Group();
    const facer = new THREE.Group();
    root.add(leaner);
    leaner.add(facer);
    this.leaner = leaner;
    this.facer = facer;

    // soft "clay" palette
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x8f7bd6, roughness: 0.85 });
    const robeMat2 = new THREE.MeshStandardMaterial({ color: 0x6f5fc4, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf2e0c9, roughness: 0.8 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a2f4a, roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, roughness: 0.45, metalness: 0.3, emissive: 0x3a2c00 });
    this.robeMat = robeMat; this.skinMat = skinMat;
    this.armMat = robeMat; this.handMat = skinMat;

    const shadowed = (m) => { m.castShadow = true; return m; };

    // legs (soft rounded stubs)
    const legGeo = new THREE.CapsuleGeometry(0.17, 0.3, 4, 8);
    this.legL = shadowed(new THREE.Mesh(legGeo, darkMat)); this.legL.position.set(-0.24, 0.34, 0);
    this.legR = shadowed(new THREE.Mesh(legGeo, darkMat)); this.legR.position.set(0.24, 0.34, 0);
    facer.add(this.legL, this.legR);

    // robe / torso (rounded, soft)
    const skirt = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.82, 1.0, 16), robeMat));
    skirt.position.y = 0.95;
    const torso = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.52, 16, 14), robeMat));
    torso.position.y = 1.5; torso.scale.set(1, 0.95, 0.92);
    facer.add(skirt, torso);
    this.torso = torso;

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 8, 20), goldMat);
    belt.rotation.x = Math.PI / 2; belt.position.y = 1.02;
    facer.add(belt);

    // head
    const head = new THREE.Group(); head.position.y = 2.05;
    facer.add(head); this.head = head;
    const skull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.44, 18, 16), skinMat));
    head.add(skull);
    const cheekMat = new THREE.MeshStandardMaterial({ color: 0xe89a8a, roughness: 0.8, transparent: true, opacity: 0.55 });
    const cheekGeo = new THREE.SphereGeometry(0.13, 8, 8);
    const cl = new THREE.Mesh(cheekGeo, cheekMat); cl.position.set(-0.27, -0.05, 0.31);
    const cr = new THREE.Mesh(cheekGeo, cheekMat); cr.position.set(0.27, -0.05, 0.31);
    head.add(cl, cr);
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const el = new THREE.Mesh(eyeGeo, darkMat); el.position.set(-0.15, 0.07, 0.39); el.scale.y = 0.62;
    const er = new THREE.Mesh(eyeGeo, darkMat); er.position.set(0.15, 0.07, 0.39); er.scale.y = 0.62;
    head.add(el, er);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), new THREE.MeshStandardMaterial({ color: 0xe06a55, roughness: 0.7 }));
    nose.position.set(0, -0.04, 0.45);
    head.add(nose);
    const beard = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.62, 14), whiteMat));
    beard.position.set(0, -0.36, 0.2); beard.rotation.x = -0.2;
    head.add(beard);

    // hat (springy flop)
    const hat = new THREE.Group(); hat.position.y = 0.38;
    head.add(hat); this.hat = hat;
    const brim = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.64, 0.1, 18), robeMat2));
    hat.add(brim);
    const cone = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.44, 1.3, 16), robeMat2));
    cone.position.y = 0.66; cone.rotation.z = 0.16;
    hat.add(cone);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 8, 20), goldMat);
    band.rotation.x = Math.PI / 2; band.position.y = 0.12;
    hat.add(band);
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), goldMat);
    star.position.set(0.2, 0.95, 0.32);
    hat.add(star);

    // shoulder anchors (empties inside the body, read in world space each frame)
    this.shoulderL = new THREE.Object3D(); this.shoulderL.position.set(-0.54, 1.62, 0.04);
    this.shoulderR = new THREE.Object3D(); this.shoulderR.position.set(0.54, 1.62, 0.04);
    facer.add(this.shoulderL, this.shoulderR);

    // ---- verlet arms live in world space ----
    this.armGroup = new THREE.Group();
    this.scene.add(this.armGroup);
    const upperGeo = new THREE.CylinderGeometry(0.14, 0.12, 1, 8);
    const foreGeo = new THREE.CylinderGeometry(0.12, 0.1, 1, 8);
    const mittenGeo = new THREE.SphereGeometry(0.18, 10, 10);
    const mkArm = (handMatOverride) => {
      const upper = shadowed(new THREE.Mesh(upperGeo, robeMat));
      const fore = shadowed(new THREE.Mesh(foreGeo, robeMat));
      const hand = shadowed(new THREE.Mesh(mittenGeo, handMatOverride || skinMat));
      hand.scale.set(1, 0.8, 1);
      this.armGroup.add(upper, fore, hand);
      return {
        p1: new THREE.Vector3(), p1p: new THREE.Vector3(),
        p2: new THREE.Vector3(), p2p: new THREE.Vector3(),
        len0: 0.64, len1: 0.64, upper, fore, hand,
      };
    };
    this.armL = mkArm();
    this.armR = mkArm();
    // pose the arms at rest immediately so the wizard looks right before the
    // first sim tick (e.g. on the title screen)
    this.root.updateMatrixWorld(true);
    this._verletArm(this.armL, this.shoulderL.getWorldPosition(new THREE.Vector3()), 0.016, 0, new THREE.Vector3(), -26);
    this._verletArm(this.armR, this.shoulderR.getWorldPosition(new THREE.Vector3()), 0.016, 0, new THREE.Vector3(), -26);

    // foamy tankard, glued to the left mitten
    this.mug = new THREE.Group();
    const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.28, 12), new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.6 }));
    const foam = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), whiteMat); foam.position.y = 0.16; foam.scale.y = 0.6;
    this.mug.add(mugBody, foam);
    this.armGroup.add(this.mug);

    // glowing cast-spark + light follow the right mitten
    this.castGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xbfa3ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.armGroup.add(this.castGlow);
    this.handLight = new THREE.PointLight(0x9b7bff, 0, 7);
    this.armGroup.add(this.handLight);
  }

  reset(stats) {
    this.pos.set(0, 0, 0); this.vel.set(0, 0, 0);
    this.lean = { x: 0, z: 0 }; this.leanV = { x: 0, z: 0 };
    this.headLean = { x: 0, z: 0 }; this.headV = { x: 0, z: 0 };
    this.hatLean = { x: 0, z: 0 }; this.hatV = { x: 0, z: 0 };
    this._maxHp = stats.hpMax;
    this.hp = stats.hpMax; this.mana = stats.manaMax;
    this.shield = 0; this.shieldT = 0;
    this.alive = true; this.invuln = 0; this.flash = 0; this.castTimer = 0;
    this._armReady = false;
  }

  setVisible(v) { this.root.visible = v; this.armGroup.visible = v; }

  spendMana(n) { if (this.mana >= n) { this.mana -= n; return true; } return false; }
  heal(n) { this.hp = Math.min(this._maxHp, this.hp + n); }
  addShield(n, dur) { this.shield = Math.max(this.shield, n); this.shieldT = Math.max(this.shieldT, dur); }

  takeDamage(n, fromPos) {
    if (this.invuln > 0 || !this.alive) return false;
    if (this.shield > 0) { const a = Math.min(this.shield, n); this.shield -= a; n -= a; }
    this.hp -= n;
    this.invuln = 0.7;
    this.flash = 0.25;
    if (fromPos) {
      const k = this._tmp.subVectors(this.pos, fromPos).setY(0).normalize().multiplyScalar(6);
      this.vel.add(k);
      this.leanV.x += k.x * 0.4; this.leanV.z += k.z * 0.4;
    }
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return true;
  }

  triggerCast(dir) {
    this.castTimer = 0.45;
    this.castDir.copy(dir).setY(0).normalize();
    this.leanV.x -= this.castDir.x * 2.2;
    this.leanV.z -= this.castDir.z * 2.2;
  }

  // stable "muzzle" point for spell origins (independent of the floppy hands)
  handPosition(out = new THREE.Vector3()) {
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    out.copy(this.pos).addScaledVector(fwd, 0.6).addScaledVector(right, 0.5);
    out.y = 1.5;
    return out;
  }

  _verletArm(arm, anchor, dt, casting, castTarget, grav) {
    if (!this._armReady) {
      arm.p1.copy(anchor); arm.p1.y -= arm.len0; arm.p1p.copy(arm.p1);
      arm.p2.copy(arm.p1); arm.p2.y -= arm.len1; arm.p2p.copy(arm.p2);
      orientSegment(arm.upper, anchor, arm.p1, 1);
      orientSegment(arm.fore, arm.p1, arm.p2, 1);
      arm.hand.position.copy(arm.p2);
      return;
    }
    const damp = 0.9;
    const gdt = grav * dt * dt;
    // integrate elbow (p1) & hand (p2)
    for (const p of [arm.p1, arm.p2]) {
      const pp = (p === arm.p1) ? arm.p1p : arm.p2p;
      const vx = (p.x - pp.x) * damp, vy = (p.y - pp.y) * damp, vz = (p.z - pp.z) * damp;
      pp.copy(p);
      // clamp velocity so a violent stagger can't explode the chain
      const v = Math.hypot(vx, vy, vz), vmax = 3;
      const s = v > vmax ? vmax / v : 1;
      p.x += vx * s; p.y += vy * s + gdt; p.z += vz * s;
    }
    // casting pulls the hand toward a raised target
    if (casting > 0) {
      arm.p2.lerp(castTarget, Math.min(0.6, 0.5 * casting));
      this._tmp.copy(anchor).add(castTarget).multiplyScalar(0.5);
      arm.p1.lerp(this._tmp, Math.min(0.4, 0.35 * casting));
    }
    // satisfy distance constraints
    for (let it = 0; it < 6; it++) {
      // shoulder -> elbow (shoulder pinned)
      let dx = arm.p1.x - anchor.x, dy = arm.p1.y - anchor.y, dz = arm.p1.z - anchor.z;
      let d = Math.hypot(dx, dy, dz) || 1e-4, diff = (d - arm.len0) / d;
      arm.p1.x -= dx * diff; arm.p1.y -= dy * diff; arm.p1.z -= dz * diff;
      // elbow -> hand (split)
      dx = arm.p2.x - arm.p1.x; dy = arm.p2.y - arm.p1.y; dz = arm.p2.z - arm.p1.z;
      d = Math.hypot(dx, dy, dz) || 1e-4; diff = (d - arm.len1) / d * 0.5;
      arm.p1.x += dx * diff; arm.p1.y += dy * diff; arm.p1.z += dz * diff;
      arm.p2.x -= dx * diff; arm.p2.y -= dy * diff; arm.p2.z -= dz * diff;
    }
    // don't let the mittens sink through the floor
    if (arm.p1.y < 0.18) arm.p1.y = 0.18;
    if (arm.p2.y < 0.14) arm.p2.y = 0.14;
    // render
    orientSegment(arm.upper, anchor, arm.p1, 1);
    orientSegment(arm.fore, arm.p1, arm.p2, 1);
    arm.hand.position.copy(arm.p2);
  }

  update(dt, game) {
    const s = game.stats;
    this._maxHp = s.hpMax;

    // ---- movement with drunk overshoot ----
    const mv = game.input ? game.input.moveVector() : { x: 0, z: 0 };
    const accel = 60;
    const maxSpeed = s.moveSpeed;
    if (this.alive) { this.vel.x += mv.x * accel * dt; this.vel.z += mv.z * accel * dt; }
    const damp = Math.pow(0.0009, dt);
    this.vel.x *= damp; this.vel.z *= damp;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > maxSpeed) { this.vel.x *= maxSpeed / sp; this.vel.z *= maxSpeed / sp; }
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.x < -ARENA) { this.pos.x = -ARENA; this.vel.x *= -0.4; }
    if (this.pos.x > ARENA) { this.pos.x = ARENA; this.vel.x *= -0.4; }
    if (this.pos.z < -ARENA) { this.pos.z = -ARENA; this.vel.z *= -0.4; }
    if (this.pos.z > ARENA) { this.pos.z = ARENA; this.vel.z *= -0.4; }

    // ---- face the aim ----
    if (game.aimPoint) {
      const target = Math.atan2(game.aimPoint.x - this.pos.x, game.aimPoint.z - this.pos.z);
      let d = target - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 10);
    }

    // ---- drunken sway + hiccups (amplified by how sloshed the spirit is) ----
    const dWob = 1 + (game.drunkenness || 0) * 1.4; // DRINK -> woozier puppet
    this.drunk += dt * (1.5 + s.wobble * dWob);
    this.hiccupIn -= dt;
    if (this.hiccupIn <= 0 && this.alive) {
      this.hiccupIn = (4 + Math.random() * 6) / dWob; // hiccup more often when drunk
      this.leanV.x += (Math.random() - 0.5) * 9 * s.wobble * dWob;
      this.leanV.z += (Math.random() - 0.5) * 9 * s.wobble * dWob;
      this.bob -= 1.4;
      // a hiccup also flings the arms
      this.armL.p2p.y -= 0.25; this.armR.p2p.y -= 0.25;
      if (game.audio) game.audio.play('hiccup');
      if (game.particles) game.particles.burst({ pos: this.handPosition().setY(2.5), color: 0xb9ff7a, count: 5, speed: 2, size: 0.18, grav: 1, life: 0.7 });
    }

    // ---- spring lean (movement lurch + drunk sway) ----
    const swayAmp = 0.16 * s.wobble * dWob;
    const targetX = -this.vel.x * 0.05 + Math.sin(this.drunk) * swayAmp + Math.sin(this.drunk * 0.37) * swayAmp * 0.6;
    const targetZ = this.vel.z * 0.05 + Math.cos(this.drunk * 0.9) * swayAmp + Math.cos(this.drunk * 0.23) * swayAmp * 0.6;
    [this.lean.x, this.leanV.x] = spring(this.lean.x, this.leanV.x, targetX, 70, 7, dt);
    [this.lean.z, this.leanV.z] = spring(this.lean.z, this.leanV.z, targetZ, 70, 7, dt);
    [this.headLean.x, this.headV.x] = spring(this.headLean.x, this.headV.x, this.lean.x, 55, 5.5, dt);
    [this.headLean.z, this.headV.z] = spring(this.headLean.z, this.headV.z, this.lean.z, 55, 5.5, dt);
    [this.hatLean.x, this.hatV.x] = spring(this.hatLean.x, this.hatV.x, this.headLean.x, 40, 4, dt);
    [this.hatLean.z, this.hatV.z] = spring(this.hatLean.z, this.hatV.z, this.headLean.z, 40, 4, dt);

    // ---- walk bob & leg waddle ----
    this.bob += dt * (4 + sp * 1.6);
    const bobAmt = Math.min(0.18, 0.04 + sp * 0.02);
    const bobY = Math.abs(Math.sin(this.bob)) * bobAmt;
    this.legL.rotation.x = Math.sin(this.bob) * 0.5 * Math.min(1, sp / 3);
    this.legR.rotation.x = -Math.sin(this.bob) * 0.5 * Math.min(1, sp / 3);

    // ---- apply body transforms (floorY lets him climb the tavern's upper deck) ----
    this.floorY = game.floorHeightAt ? game.floorHeightAt(this.pos.x, this.pos.z) : 0;
    this.root.position.set(this.pos.x, this.floorY + bobY, this.pos.z);
    this.leaner.rotation.set(this.lean.z, 0, -this.lean.x);
    this.facer.rotation.y = this.yaw;
    this.head.rotation.set((this.headLean.z - this.lean.z) * 0.8, 0, -(this.headLean.x - this.lean.x) * 0.8);
    this.hat.rotation.set((this.hatLean.z - this.headLean.z) * 1.2, 0, -(this.hatLean.x - this.headLean.x) * 1.2);

    // refresh world matrices so we can read shoulder anchors
    this.root.updateMatrixWorld(true);
    const aL = this.shoulderL.getWorldPosition(new THREE.Vector3());
    const aR = this.shoulderR.getWorldPosition(new THREE.Vector3());

    // ---- verlet arms ----
    const casting = this.castTimer > 0 ? Math.max(0, this.castTimer / 0.45) : 0;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const reach = this.armR.len0 + this.armR.len1;
    const targetR = aR.clone().addScaledVector(fwd, reach * 0.85).setY(aR.y + reach * 0.25);
    const targetL = aL.clone().addScaledVector(fwd, reach * 0.6).setY(aL.y + reach * 0.1);
    const grav = -26;
    this._verletArm(this.armL, aL, dt, casting, targetL, grav);
    this._verletArm(this.armR, aR, dt, casting, targetR, grav);
    if (!this._armReady) this._armReady = true;

    // mug rides on the left mitten
    this.mug.position.copy(this.armL.p2).add(new THREE.Vector3(0, -0.12, 0));

    // cast spark + light at the right mitten
    if (this.castTimer > 0) {
      this.castTimer -= dt;
      const t = Math.max(0, this.castTimer / 0.45);
      this.castGlow.position.copy(this.armR.p2);
      this.castGlow.material.opacity = t;
      this.castGlow.scale.setScalar(0.6 + t * 1.4);
      this.handLight.position.copy(this.armR.p2);
      this.handLight.intensity = t * 4;
    } else {
      this.castGlow.material.opacity *= 0.85;
      this.handLight.intensity *= 0.85;
      this.castGlow.position.copy(this.armR.p2);
      this.handLight.position.copy(this.armR.p2);
    }

    // ---- damage flash + i-frames ----
    if (this.invuln > 0) this.invuln -= dt;
    if (this.flash > 0) {
      this.flash -= dt;
      const f = Math.max(0, this.flash / 0.25);
      this.robeMat.emissive.setRGB(f, 0, 0);
      this.skinMat.emissive.setRGB(f, 0, 0);
    } else {
      this.robeMat.emissive.setRGB(0, 0, 0);
      this.skinMat.emissive.setRGB(0, 0, 0);
    }

    // ---- shield (mana does NOT auto-regen — drink to refill it) ----
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }
    if (s.manaRegen > 0) this.mana = Math.min(s.manaMax, this.mana + s.manaRegen * dt); // 0 by default
  }
}

export { ARENA };
