// particles.js — pooled particle bits + expanding shockwave rings.
// Deliberately chunky and "sloppy" for that wonky, satisfying splatter feel.
import * as THREE from 'three';

const MAX_PARTICLES = 700;
const MAX_RINGS = 40;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.geo = new THREE.IcosahedronGeometry(0.5, 0); // faceted little chunks
    this.pool = [];
    this.ringPool = [];
    this.ringGeo = new THREE.RingGeometry(0.62, 1.0, 28);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false });
      const m = new THREE.Mesh(this.geo, mat);
      m.visible = false;
      this.group.add(m);
      this.pool.push({ mesh: m, active: false, vel: new THREE.Vector3(), life: 0, max: 1, grav: 0, drag: 0.9, spin: new THREE.Vector3(), scale0: 1, fadePow: 1 });
    }
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false });
      const m = new THREE.Mesh(this.ringGeo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.group.add(m);
      this.ringPool.push({ mesh: m, active: false, life: 0, max: 1, r0: 1, r1: 5 });
    }
  }

  _free() {
    for (const p of this.pool) if (!p.active) return p;
    return null;
  }

  spawn(opts) {
    const p = this._free();
    if (!p) return;
    const { pos, color = 0xffffff, vel = new THREE.Vector3(), life = 0.8, size = 0.4, grav = -9, drag = 0.86, blend = 'add', fadePow = 1 } = opts;
    p.active = true;
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.vel.copy(vel);
    p.life = life; p.max = life; p.grav = grav; p.drag = drag; p.fadePow = fadePow;
    p.scale0 = size;
    p.mesh.scale.setScalar(size);
    p.spin.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    p.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = 1;
    p.mesh.material.blending = blend === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending;
  }

  // A spray of bits from a point.
  burst({ pos, color = 0xffffff, count = 14, speed = 6, spread = 1, life = 0.8, size = 0.4, grav = -9, up = 2, blend = 'add' }) {
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2 * spread,
        Math.random() * spread + up * 0.15,
        (Math.random() - 0.5) * 2 * spread
      ).normalize();
      const s = speed * (0.5 + Math.random());
      this.spawn({
        pos: pos.clone(),
        color,
        vel: dir.multiplyScalar(s).add(new THREE.Vector3(0, up, 0)),
        life: life * (0.6 + Math.random() * 0.7),
        size: size * (0.6 + Math.random() * 0.8),
        grav, blend,
      });
    }
  }

  ring({ pos, color = 0xffffff, r0 = 0.5, r1 = 6, life = 0.5 }) {
    let r = null;
    for (const x of this.ringPool) if (!x.active) { r = x; break; }
    if (!r) return;
    r.active = true; r.mesh.visible = true;
    r.life = life; r.max = life; r.r0 = r0; r.r1 = r1;
    r.mesh.position.copy(pos); r.mesh.position.y += 0.15;
    r.mesh.scale.setScalar(r0);
    r.mesh.material.color.setHex(color);
    r.mesh.material.opacity = 0.9;
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; p.mesh.visible = false; continue; }
      p.vel.y += p.grav * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vel.multiplyScalar(d);
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.1) { p.mesh.position.y = 0.1; p.vel.y *= -0.4; p.vel.x *= 0.7; p.vel.z *= 0.7; }
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;
      const t = p.life / p.max;
      p.mesh.material.opacity = Math.pow(t, p.fadePow);
      p.mesh.scale.setScalar(p.scale0 * (0.3 + 0.7 * t));
    }
    for (const r of this.ringPool) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) { r.active = false; r.mesh.visible = false; continue; }
      const t = 1 - r.life / r.max;
      const rad = r.r0 + (r.r1 - r.r0) * t;
      r.mesh.scale.setScalar(rad);
      r.mesh.material.opacity = 0.9 * (1 - t);
    }
  }
}
