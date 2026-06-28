// atmosphere.js — fake-but-convincing volumetrics with ZERO binary assets:
// procedural god-ray light shafts + a floating dust-mote cloud. Core three only, so it
// can never trip the post-FX composer's "addon failed → disable everything" fallback.
// All canvas/texture creation is guarded (returns null → that piece is skipped). Added to
// the persistent scene as one group, toggled per phase, ZERO per-frame allocations.
import * as THREE from 'three';

const SHAFT_COUNT = 5;
const DUST_COUNT = 140;       // single draw call, mobile-safe
const DUST_RADIUS = 26;
const DUST_HEIGHT = 16;

// Per-mood palette. Opacities deliberately LOW — bloom amplifies additive overlaps.
const MOODS = {
  tavern: { shaft: 0xffcf86, shaftOp: 0.13, dust: 0xffe2b0, dustOp: 0.10 },
  arena: { shaft: 0xbcd2ff, shaftOp: 0.085, dust: 0xd6e6ff, dustOp: 0.06 },
  world: { shaft: 0x9fc0ff, shaftOp: 0.06, dust: 0xcfe0ff, dustOp: 0.05 },
};

export class Atmosphere {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    this.shafts = [];
    this.group = new THREE.Group();
    this.group.renderOrder = 10;
    scene.add(this.group);
    this._shaftTex = this._makeShaftTexture(); // null → shafts skipped
    this._dustTex = this._makeDustTexture();   // null → dust skipped
    this._buildShafts();
    this._buildDust();
    this.setMood('arena');
  }

  _makeShaftTexture() {
    try {
      const c = document.createElement('canvas'); c.width = 64; c.height = 256;
      const g = c.getContext('2d'); if (!g) return null;
      const grad = g.createLinearGradient(0, 0, 0, 256);            // bright top → faded bottom
      grad.addColorStop(0.0, 'rgba(255,255,255,0.85)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.40)');
      grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
      g.fillStyle = grad; g.fillRect(0, 0, 64, 256);
      const h = g.createLinearGradient(0, 0, 64, 0);                // feather the side edges to nothing
      h.addColorStop(0.0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1.0, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = h; g.fillRect(0, 0, 64, 256);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
    } catch (err) { console.warn('shaft texture failed:', err); return null; }
  }

  _makeDustTexture() {
    try {
      const c = document.createElement('canvas'); c.width = 32; c.height = 32;
      const g = c.getContext('2d'); if (!g) return null;
      const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0.0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.6)'); grad.addColorStop(1.0, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
    } catch (err) { console.warn('dust texture failed:', err); return null; }
  }

  _buildShafts() {
    if (!this._shaftTex) return;
    const SUN = new THREE.Vector3(28, 46, 18);                      // == game.dir.position (key light)
    const sunDir = SUN.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion().setFromUnitVectors(up, sunDir);
    this._geo = new THREE.PlaneGeometry(1, 1);                      // shared, scaled per shaft
    const spots = [[-10, 9, -6], [6, 11, -2], [-2, 8, 8], [12, 10, 6], [-14, 9, 4]];
    for (let i = 0; i < SHAFT_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this._shaftTex, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, depthTest: true, fog: false,            // fog:false REQUIRED (additive+fog = glowing rects)
        side: THREE.DoubleSide, opacity: 0.1, color: 0xffffff,
      });
      const m = new THREE.Mesh(this._geo, mat);
      const [x, y, z] = spots[i % spots.length]; m.position.set(x, y, z);
      m.quaternion.copy(quat);
      m.rotateOnAxis(up.clone().applyQuaternion(quat), (i / SHAFT_COUNT) * Math.PI); // splay the beams
      m.scale.set(5 + ((i * 2.3) % 4), 30 + ((i * 5.1) % 12), 1);
      m.renderOrder = 11;
      this.group.add(m);
      this.shafts.push({ mesh: m, phase: i * 1.27, drift: 0.15 + (i % 3) * 0.07, baseRot: m.rotation.y, baseOp: 0.1 });
    }
  }

  _buildDust() {
    if (!this._dustTex) return;
    const n = DUST_COUNT, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(Math.random()) * DUST_RADIUS, a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 1 + Math.random() * DUST_HEIGHT; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustMat = new THREE.PointsMaterial({
      map: this._dustTex, size: 0.55, sizeAttenuation: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false, opacity: 0.07, color: 0xffffff,
    });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.renderOrder = 12; this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  setMood(mood) {
    const m = MOODS[mood] || MOODS.arena; this._mood = m;
    for (const s of this.shafts) { s.mesh.material.color.setHex(m.shaft); s.baseOp = m.shaftOp; }
    if (this.dustMat) { this.dustMat.color.setHex(m.dust); this.dustMat.opacity = m.dustOp; this._dustBaseOp = m.dustOp; }
  }

  setVisible(v) { this.group.visible = v; }

  update(dt) {
    if (!this.group.visible) return;                               // hidden = free
    this.t += dt;
    for (const s of this.shafts) {
      const pulse = 0.75 + 0.25 * Math.sin(this.t * 0.5 + s.phase);
      s.mesh.material.opacity = (s.baseOp || 0.1) * pulse;
      s.mesh.rotation.y = s.baseRot + Math.sin(this.t * s.drift + s.phase) * 0.06; // lazy sway
    }
    if (this.dust) {
      this.dust.position.y = Math.sin(this.t * 0.35) * 0.5;        // whole-cloud bob — no per-particle upload
      this.dust.rotation.y = this.t * 0.02;
      const dp = 0.8 + 0.2 * Math.sin(this.t * 0.9);
      this.dustMat.opacity = (this._dustBaseOp || 0.07) * dp;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    for (const s of this.shafts) s.mesh.material.dispose();
    if (this._geo) this._geo.dispose();
    if (this.dust) { this.dust.geometry.dispose(); this.dustMat.dispose(); }
    if (this._shaftTex) this._shaftTex.dispose();
    if (this._dustTex) this._dustTex.dispose();
  }
}
