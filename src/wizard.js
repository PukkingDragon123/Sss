// wizard.js — Wobblesworth the Sloshed. A segmented, spring-driven rig that
// lurches, sways and overshoots so he always feels pleasantly drunk.
import * as THREE from 'three';

const ARENA = 46; // half-size of the playable floor

function spring(cur, vel, target, k, damp, dt) {
  const a = (target - cur) * k - vel * damp;
  vel += a * dt;
  cur += vel * dt;
  return [cur, vel];
}

export class Wizard {
  constructor(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3(0, 0, 0);

    this.yaw = 0;            // facing toward aim
    this.lean = { x: 0, z: 0 };       // primary body tilt
    this.leanV = { x: 0, z: 0 };
    this.headLean = { x: 0, z: 0 };   // secondary jiggle
    this.headV = { x: 0, z: 0 };
    this.hatLean = { x: 0, z: 0 };    // tertiary flop
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
    this.alive = true;

    this._build();
  }

  _build() {
    const root = new THREE.Group();
    this.root = root;
    this.scene.add(root);

    const leaner = new THREE.Group();   // world-space tilt
    const facer = new THREE.Group();     // yaw toward aim
    root.add(leaner);
    leaner.add(facer);
    this.leaner = leaner;
    this.facer = facer;

    const robeMat = new THREE.MeshStandardMaterial({ color: 0x6a4cb0, roughness: 0.85 });
    const robeMat2 = new THREE.MeshStandardMaterial({ color: 0x4a2f8a, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.9 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x201525, roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffcf5c, roughness: 0.4, metalness: 0.4, emissive: 0x3a2c00 });
    this.robeMat = robeMat; this.skinMat = skinMat;

    // legs (little waddly stubs)
    const legGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.5, 8);
    this.legL = new THREE.Mesh(legGeo, darkMat); this.legL.position.set(-0.22, 0.25, 0);
    this.legR = new THREE.Mesh(legGeo, darkMat); this.legR.position.set(0.22, 0.25, 0);
    facer.add(this.legL, this.legR);

    // robe / torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.78, 1.35, 14), robeMat);
    torso.position.y = 1.15;
    facer.add(torso);
    this.torso = torso;

    // a rope belt
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 18), goldMat);
    belt.rotation.x = Math.PI / 2; belt.position.y = 0.95;
    facer.add(belt);

    // head
    const head = new THREE.Group(); head.position.y = 1.95;
    facer.add(head); this.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 14), skinMat);
    head.add(skull);
    // rosy drunk cheeks
    const cheekMat = new THREE.MeshStandardMaterial({ color: 0xe87a6a, roughness: 0.8, transparent: true, opacity: 0.6 });
    const cheekGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const cl = new THREE.Mesh(cheekGeo, cheekMat); cl.position.set(-0.26, -0.04, 0.3);
    const cr = new THREE.Mesh(cheekGeo, cheekMat); cr.position.set(0.26, -0.04, 0.3);
    head.add(cl, cr);
    // eyes (half-lidded = two squished dark blobs)
    const eyeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const el = new THREE.Mesh(eyeGeo, darkMat); el.position.set(-0.16, 0.06, 0.37); el.scale.y = 0.6;
    const er = new THREE.Mesh(eyeGeo, darkMat); er.position.set(0.16, 0.06, 0.37); er.scale.y = 0.6;
    head.add(el, er);
    // bulbous red nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshStandardMaterial({ color: 0xd9543f, roughness: 0.7 }));
    nose.position.set(0, -0.05, 0.44);
    head.add(nose);
    // beard
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 12), whiteMat);
    beard.position.set(0, -0.34, 0.18); beard.rotation.x = -0.2;
    head.add(beard);

    // hat (group so it can flop independently)
    const hat = new THREE.Group(); hat.position.y = 0.36;
    head.add(hat); this.hat = hat;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.6, 0.08, 16), robeMat2);
    hat.add(brim);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 14), robeMat2);
    cone.position.y = 0.62; cone.rotation.z = 0.16; // jaunty tilt
    hat.add(cone);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.06, 8, 18), goldMat);
    band.rotation.x = Math.PI / 2; band.position.y = 0.1;
    hat.add(band);
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), goldMat);
    star.position.set(0.18, 0.9, 0.3);
    hat.add(star);

    // arms
    const armGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.85, 8);
    armGeo.translate(0, -0.42, 0); // pivot at shoulder
    this.armL = new THREE.Group(); this.armL.position.set(-0.5, 1.55, 0);
    this.armR = new THREE.Group(); this.armR.position.set(0.5, 1.55, 0);
    const sleeveL = new THREE.Mesh(armGeo, robeMat); const sleeveR = new THREE.Mesh(armGeo, robeMat);
    this.armL.add(sleeveL); this.armR.add(sleeveR);
    const handGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const handL = new THREE.Mesh(handGeo, skinMat); handL.position.y = -0.85;
    const handR = new THREE.Mesh(handGeo, skinMat); handR.position.y = -0.85;
    this.armL.add(handL); this.armR.add(handR);
    facer.add(this.armL, this.armR);
    this.armL.rotation.z = 0.3; this.armR.rotation.z = -0.3;

    // a foamy tankard in the left hand (he never lets go)
    const mug = new THREE.Group(); mug.position.y = -0.95;
    const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.26, 10), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.6 }));
    const foam = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), whiteMat); foam.position.y = 0.15; foam.scale.y = 0.6;
    mug.add(mugBody, foam);
    this.armL.add(mug);

    // glowing cast-spark at the right hand
    this.castGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xbfa3ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.armR.add(this.castGlow); this.castGlow.position.y = -0.95;

    // a soft point light following the hand for that magical bloom
    this.handLight = new THREE.PointLight(0x9b7bff, 0, 6);
    this.armR.add(this.handLight); this.handLight.position.y = -0.95;

    // little soft shadow blob under him
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.02;
    root.add(this.shadow);
  }

  reset(stats) {
    this.pos.set(0, 0, 0); this.vel.set(0, 0, 0);
    this.lean = { x: 0, z: 0 }; this.leanV = { x: 0, z: 0 };
    this._maxHp = stats.hpMax;
    this.hp = stats.hpMax; this.mana = stats.manaMax;
    this.alive = true; this.invuln = 0; this.flash = 0; this.castTimer = 0;
  }

  spendMana(n) { if (this.mana >= n) { this.mana -= n; return true; } return false; }

  heal(n) { this.hp = Math.min(this._maxHp, this.hp + n); }

  takeDamage(n, fromPos) {
    if (this.invuln > 0 || !this.alive) return false;
    this.hp -= n;
    this.invuln = 0.7;
    this.flash = 0.25;
    if (fromPos) {
      const k = new THREE.Vector3().subVectors(this.pos, fromPos).setY(0).normalize().multiplyScalar(6);
      this.vel.add(k);
      this.leanV.x += k.x * 0.4; this.leanV.z += k.z * 0.4;
    }
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return true;
  }

  triggerCast(dir) {
    this.castTimer = 0.42;
    this.castDir.copy(dir).setY(0).normalize();
    // kick a little recoil into the lean for oomph
    this.leanV.x -= this.castDir.x * 2.2;
    this.leanV.z -= this.castDir.z * 2.2;
  }

  // World position of the casting hand (approx; ignores lean for stability).
  handPosition(out = new THREE.Vector3()) {
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    out.copy(this.pos).addScaledVector(fwd, 0.55).addScaledVector(right, 0.5);
    out.y = 1.4;
    return out;
  }

  update(dt, game) {
    const s = game.stats;
    this._maxHp = s.hpMax;

    // ---- movement: accelerate toward input, with drunk overshoot ----
    const mv = game.input ? game.input.moveVector() : { x: 0, z: 0 };
    const accel = 60;
    const maxSpeed = s.moveSpeed;
    if (this.alive) {
      this.vel.x += mv.x * accel * dt;
      this.vel.z += mv.z * accel * dt;
    }
    // damping (less damping = more sliding = wonkier)
    const damp = Math.pow(0.0009, dt);
    this.vel.x *= damp; this.vel.z *= damp;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp > maxSpeed) { this.vel.x *= maxSpeed / sp; this.vel.z *= maxSpeed / sp; }
    this.pos.addScaledVector(this.vel, dt);

    // arena bounds (bounce softly off the walls — wonky)
    if (this.pos.x < -ARENA) { this.pos.x = -ARENA; this.vel.x *= -0.4; }
    if (this.pos.x > ARENA) { this.pos.x = ARENA; this.vel.x *= -0.4; }
    if (this.pos.z < -ARENA) { this.pos.z = -ARENA; this.vel.z *= -0.4; }
    if (this.pos.z > ARENA) { this.pos.z = ARENA; this.vel.z *= -0.4; }

    // ---- facing toward aim ----
    if (game.aimPoint) {
      const dx = game.aimPoint.x - this.pos.x;
      const dz = game.aimPoint.z - this.pos.z;
      const target = Math.atan2(dx, dz);
      let d = target - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 10);
    }

    // ---- drunken sway + hiccups ----
    this.drunk += dt * (1.5 + s.wobble);
    this.hiccupIn -= dt;
    if (this.hiccupIn <= 0 && this.alive) {
      this.hiccupIn = 4 + Math.random() * 6;
      this.leanV.x += (Math.random() - 0.5) * 9 * s.wobble;
      this.leanV.z += (Math.random() - 0.5) * 9 * s.wobble;
      this.vel.y = 0;
      this.bob -= 1.4; // little hop
      if (game.audio) game.audio.play('hiccup');
      if (game.particles) game.particles.burst({ pos: this.handPosition().setY(2.4), color: 0xb9ff7a, count: 5, speed: 2, size: 0.18, grav: 1, life: 0.7 });
    }

    // ---- spring the body lean toward (movement lurch + drunk sway) ----
    const swayAmp = 0.16 * s.wobble;
    const targetX = -this.vel.x * 0.05 + Math.sin(this.drunk) * swayAmp + Math.sin(this.drunk * 0.37) * swayAmp * 0.6;
    const targetZ = this.vel.z * 0.05 + Math.cos(this.drunk * 0.9) * swayAmp + Math.cos(this.drunk * 0.23) * swayAmp * 0.6;
    const k = 70, dmp = 7;
    [this.lean.x, this.leanV.x] = spring(this.lean.x, this.leanV.x, targetX, k, dmp, dt);
    [this.lean.z, this.leanV.z] = spring(this.lean.z, this.leanV.z, targetZ, k, dmp, dt);
    // secondary (head) and tertiary (hat) lag behind for jiggle
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

    // ---- apply transforms ----
    this.root.position.set(this.pos.x, bobY, this.pos.z);
    this.leaner.rotation.set(this.lean.z, 0, -this.lean.x);
    this.facer.rotation.y = this.yaw;
    this.head.rotation.set((this.headLean.z - this.lean.z) * 0.8, 0, -(this.headLean.x - this.lean.x) * 0.8);
    this.hat.rotation.set((this.hatLean.z - this.headLean.z) * 1.2, 0, -(this.hatLean.x - this.headLean.x) * 1.2);
    this.shadow.position.set(this.pos.x, 0.02, this.pos.z);
    this.shadow.scale.setScalar(1 - bobY * 1.5);

    // ---- casting pose ----
    if (this.castTimer > 0) {
      this.castTimer -= dt;
      const t = Math.max(0, this.castTimer / 0.42);
      // raise right arm forward (toward aim is already facer-forward)
      this.armR.rotation.x = -2.1 * t - 0.2;
      this.armR.rotation.z = -0.1;
      this.armL.rotation.x = -0.6 * t;
      this.castGlow.material.opacity = t;
      this.castGlow.scale.setScalar(0.6 + t * 1.4);
      this.handLight.intensity = t * 4;
    } else {
      // idle arm sway
      const swing = Math.sin(this.bob) * 0.25 * Math.min(1, sp / 3);
      this.armR.rotation.x = swing;
      this.armR.rotation.z = -0.3 - Math.sin(this.drunk * 0.7) * 0.06;
      this.armL.rotation.x = -swing;
      this.armL.rotation.z = 0.3 + Math.sin(this.drunk * 0.7) * 0.06;
      this.castGlow.material.opacity *= 0.85;
      this.handLight.intensity *= 0.85;
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

    // ---- mana regen ----
    this.mana = Math.min(s.manaMax, this.mana + s.manaRegen * dt);
  }
}

export { ARENA };
