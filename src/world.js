// world.js — a real 3D top-down WORLD MAP of the realm. Each of the eight haunts
// is a little themed island you can scout and enter directly (no node-path map).
import * as THREE from 'three';
import { STAGE_ORDER, STAGES } from './story.js';

// where each region sits on the overworld + how it looks
const LAYOUT = {
  forest:    { x: -17, z: 8,   tone: 0x4f9e6a, icon: '🌲', deco: 'tree' },
  cave:      { x: -10, z: -3,  tone: 0x9a7a3a, icon: '🦇', deco: 'rock' },
  graveyard: { x: -2,  z: 8,   tone: 0x7a8aa8, icon: '⚰️', deco: 'grave' },
  swamp:     { x: 5,   z: -4,  tone: 0x5f8a4a, icon: '🐊', deco: 'tree' },
  frost:     { x: 12,  z: 7,   tone: 0x9fd0ef, icon: '❄️', deco: 'ice' },
  inferno:   { x: 18,  z: -3,  tone: 0xd4541f, icon: '🔥', deco: 'lava' },
  clockwork: { x: 10,  z: -12, tone: 0x3fc0e0, icon: '🤖', deco: 'tech' },
  void:      { x: 1,   z: -13, tone: 0x9a6fd0, icon: '🌌', deco: 'void' },
};

function iconSprite(emoji, px = 96) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.font = px + 'px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 8; x.fillText(emoji, 64, 72);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(2.4, 2.4, 2.4); return s;
}
function labelSprite(text, tone) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const x = c.getContext('2d');
  x.font = 'bold 34px "Trebuchet MS",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillText(text, 130, 40); x.fillStyle = tone; x.fillText(text, 128, 38);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(7, 2, 1); return s;
}
const hx = (n) => '#' + ('000000' + n.toString(16)).slice(-6);

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this._ray = new THREE.Raycaster();
    this._t = 0; this._hover = -1; this._built = false;
    this.center = new THREE.Vector3(0, 0, -1.5);
    this.order = STAGE_ORDER.filter(id => LAYOUT[id] && STAGES[id]);
  }

  build() {
    if (this._built) return;
    const g = this.group;
    // ocean base + a soft landmass
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(80, 64), new THREE.MeshStandardMaterial({ color: 0x16314e, roughness: 0.7, metalness: 0.2, emissive: 0x0a1c30, emissiveIntensity: 0.5 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.4, -1.5); sea.receiveShadow = true; g.add(sea); this._sea = sea;
    // a faint shimmer band on the water + a soft coastline glow
    const shimmer = new THREE.Mesh(new THREE.RingGeometry(31, 38, 64), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    shimmer.rotation.x = -Math.PI / 2; shimmer.position.set(0, -0.35, -1.5); g.add(shimmer);
    const land = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x35543e, roughness: 1 }));
    land.rotation.x = -Math.PI / 2; land.position.set(0, -0.15, -1.5); land.scale.set(1.25, 1, 0.95); land.receiveShadow = true; g.add(land);
    const coast = new THREE.Mesh(new THREE.RingGeometry(29.4, 30.4, 64), new THREE.MeshBasicMaterial({ color: 0x8fd6b0, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
    coast.rotation.x = -Math.PI / 2; coast.position.set(0, -0.14, -1.5); coast.scale.set(1.25, 1, 0.95); g.add(coast);

    // drifting fireflies / motes for atmosphere
    this._motes = [];
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), moteMat);
      const ang = Math.random() * 6.28, rad = 6 + Math.random() * 22;
      m.position.set(Math.cos(ang) * rad, 0.6 + Math.random() * 3, -1.5 + Math.sin(ang) * rad * 0.8);
      m.userData = { base: m.position.y, sp: 0.3 + Math.random() * 0.5, ph: Math.random() * 6.28 };
      g.add(m); this._motes.push(m);
    }
    // shared glowing-red "lurker eyes" material (pulsed in update)
    this._eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a18, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

    this._views = []; this._hitMeshes = [];
    const order = this.order;
    // a clean translucent path winding between the islands (replaces the old scattered dots)
    const routeMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < order.length - 1; i++) {
      const a = LAYOUT[order[i]], b = LAYOUT[order[i + 1]];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      const path = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.5), routeMat);
      path.position.set((a.x + b.x) / 2, 0.06, (a.z + b.z) / 2);
      path.rotation.y = -Math.atan2(dz, dx); g.add(path);
    }

    for (let i = 0; i < order.length; i++) {
      const id = order[i], L = LAYOUT[id], s = STAGES[id];
      const view = new THREE.Group(); view.position.set(L.x, 0, L.z);
      // island platform
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.4, 0.7, 24), new THREE.MeshStandardMaterial({ color: L.tone, roughness: 0.85 }));
      base.position.y = 0.05; base.castShadow = true; base.receiveShadow = true; view.add(base);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.05, 0.14, 8, 28), new THREE.MeshBasicMaterial({ color: L.tone }));
      rim.rotation.x = -Math.PI / 2; rim.position.y = 0.42; view.add(rim);
      this._deco(view, L.deco, L.tone);
      // lurking red eyes peering out from the region (something waits in there…)
      const eyes = new THREE.Group();
      const spots = [[-1.8, 1.5], [1.8, 1.3], [0, -1.9], [-1.6, -1.4]];
      const pairs = 2 + (i % 2);
      for (let k = 0; k < pairs; k++) { const [ex, ez] = spots[k % spots.length]; for (const dx of [-0.17, 0.17]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), this._eyeMat); eye.position.set(ex + dx, 0.56, ez); eyes.add(eye); } }
      eyes.visible = false; view.add(eyes);
      const icon = iconSprite(L.icon); icon.position.y = 2.7; view.add(icon);
      const lock = iconSprite('🔒', 80); lock.position.y = 2.7; lock.visible = false; view.add(lock);
      const check = iconSprite('✅', 70); check.position.set(1.7, 2.7, 0); check.scale.set(1.3, 1.3, 1.3); check.visible = false; view.add(check);
      const label = labelSprite(`${i + 1}. ${s.name}`, hx(L.tone)); label.position.y = 0.9; view.add(label);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7, 10, 1, true), new THREE.MeshBasicMaterial({ color: L.tone, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 3.5; view.add(beam);
      const sel = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.16, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      sel.rotation.x = -Math.PI / 2; sel.position.y = 0.5; sel.visible = false; view.add(sel);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 4, 12), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.5; hit.userData.id = id; view.add(hit);
      g.add(view);
      this._hitMeshes.push(hit);
      this._views.push({ id, view, icon, lock, check, beam, sel, base, eyes });
    }
    // ---- a forest scattered across the land (beyond the island props) ----
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x274d30, roughness: 0.9 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.9 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 1 });
    const onIsland = (x, z) => order.some(id => { const L = LAYOUT[id]; return (x - L.x) ** 2 + (z - (L.z)) ** 2 < 18; });
    for (let i = 0; i < 34; i++) {
      const ang = Math.random() * 6.28, rad = 7 + Math.random() * 21;
      const x = Math.cos(ang) * rad * 1.15, z = -1.5 + Math.sin(ang) * rad * 0.82;
      if (onIsland(x, z)) continue;
      if (Math.random() < 0.78) {
        const t = new THREE.Group();
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.7, 5), trunkMat); tr.position.y = 0.35; tr.castShadow = true;
        const lf = new THREE.Mesh(new THREE.ConeGeometry(0.45 + Math.random() * 0.3, 1.0 + Math.random() * 0.6, 6), treeMat); lf.position.y = 1.05; lf.castShadow = true;
        t.add(tr, lf); t.position.set(x, -0.12, z); g.add(t);
      } else {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + Math.random() * 0.3, 0), rockMat); r.position.set(x, 0.05, z); r.castShadow = true; g.add(r);
      }
    }

    // ---- roaming monsters prowling the overworld (dark bodies, glowing red eyes) ----
    this._mobs = [];
    const mobMat = new THREE.MeshStandardMaterial({ color: 0x1a1420, roughness: 0.9 });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), mobMat); body.scale.set(1, 0.78, 1.12); body.position.y = 0.42; body.castShadow = true; m.add(body);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 6), mobMat); ear.position.set(0, 0.78, -0.05); m.add(ear);
      for (const dx of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), this._eyeMat); e.position.set(dx, 0.5, 0.34); m.add(e); }
      const ang = Math.random() * 6.28, rad = 6 + Math.random() * 17;
      m.position.set(Math.cos(ang) * rad * 1.1, -0.1, -1.5 + Math.sin(ang) * rad * 0.8);
      m.userData = { vx: (Math.random() - 0.5) * 1.1, vz: (Math.random() - 0.5) * 1.1, ph: Math.random() * 6.28 };
      g.add(m); this._mobs.push(m);
    }

    this._built = true;
  }

  _deco(view, kind, tone) {
    const M = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const add = (m, x, z) => { m.position.set(x, m.position.y, z); m.castShadow = true; view.add(m); };
    if (kind === 'tree') { for (const [x, z] of [[-1.4, 0.8], [1.2, -1], [0.2, 1.3]]) { const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.0, 6), M(0x4a3326)); tr.position.y = 0.9; const lf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 7), M(0x2f6e3f)); lf.position.y = 1.7; t.add(tr, lf); t.position.set(x, 0, z); view.add(t); } }
    else if (kind === 'rock') { for (const [x, z] of [[-1.2, 0.5], [1.1, -0.8], [0.3, 1.1]]) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.4, 0), M(0x6a5a44, 1)); r.position.y = 0.7; add(r, x, z); } }
    else if (kind === 'grave') { for (const [x, z] of [[-1.1, 0.6], [1.0, -0.7]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.2), M(0x8a8e9a, 1)); s.position.y = 0.9; s.rotation.z = (Math.random() - 0.5) * 0.3; add(s, x, z); } }
    else if (kind === 'ice') { for (const [x, z] of [[-1.2, 0.4], [1.0, -0.9], [0.4, 1.1]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xcfeaff, roughness: 0.25, emissive: 0x2a5a7a, emissiveIntensity: 0.2 })); c.position.y = 1.1; add(c, x, z); } }
    else if (kind === 'lava') { for (const [x, z] of [[-1.2, 0.5], [1.1, -0.8]]) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 6), M(0x3a1810, 1)); r.position.y = 1.0; add(r, x, z); } const pool = new THREE.Mesh(new THREE.CircleGeometry(1.0, 16), new THREE.MeshStandardMaterial({ color: 0xff6a2a, emissive: 0xff4a10, emissiveIntensity: 0.9 })); pool.rotation.x = -Math.PI / 2; pool.position.set(0.4, 0.46, 0.6); view.add(pool); }
    else if (kind === 'tech') { for (const [x, z] of [[-1.2, 0.5], [1.1, -0.8], [0.2, 1.1]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 8), M(0x46525e, 0.4)); p.position.y = 1.2; add(p, x, z); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 12), new THREE.MeshStandardMaterial({ color: 0x5fe0ff, emissive: 0x2fb0d0, emissiveIntensity: 0.9 })); ring.position.set(x, 1.6, z); ring.rotation.x = Math.PI / 2; view.add(ring); } }
    else if (kind === 'void') { for (const [x, z] of [[-1.0, 0.5], [1.0, -0.6], [0.2, 1.0]]) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0xb68fff, emissive: 0x6a3ad0, emissiveIntensity: 0.8, roughness: 0.25 })); c.position.y = 1.2; add(c, x, z); } }
  }

  refresh(unlockedFn, clearedFn) {
    this.build();
    for (const v of this._views) {
      const unlocked = unlockedFn(v.id), cleared = clearedFn(v.id);
      v.icon.visible = unlocked; v.lock.visible = !unlocked; v.check.visible = cleared;
      v.beam.material.opacity = unlocked ? 0.12 : 0;
      if (v.eyes) v.eyes.visible = unlocked && !cleared; // danger lurks in regions you've yet to conquer
      v.view.scale.setScalar(unlocked ? 1 : 0.9);   // locked islands sit a touch smaller/dimmer
    }
  }

  show(v) { this.group.visible = v; }

  select(id) { for (const v of this._views) v.sel.visible = (v.id === id); }

  update(dt) {
    if (!this.group.visible) return;
    this._t += dt;
    // lurking eyes pulse, and blink shut now and then
    if (this._eyeMat) { const blink = (this._t % 4) > 3.8 ? 0.1 : 1; this._eyeMat.opacity = (0.55 + Math.abs(Math.sin(this._t * 2.4)) * 0.4) * blink; }
    if (this._sea) this._sea.material.emissiveIntensity = 0.4 + Math.sin(this._t * 0.8) * 0.15;
    if (this._motes) for (const m of this._motes) { m.position.y = m.userData.base + Math.sin(this._t * m.userData.sp + m.userData.ph) * 0.5; m.position.x += Math.sin(this._t * 0.3 + m.userData.ph) * dt * 0.4; }
    // monsters prowl the land, hopping along; they turn back at the coast
    if (this._mobs) for (const m of this._mobs) {
      const u = m.userData;
      m.position.x += u.vx * dt; m.position.z += u.vz * dt;
      const r = Math.hypot(m.position.x / 1.22, (m.position.z + 1.5) / 0.9);
      if (r > 27) { u.vx = -u.vx; u.vz = -u.vz; m.position.x += u.vx * dt * 2; m.position.z += u.vz * dt * 2; }
      m.rotation.y = Math.atan2(u.vx, u.vz);
      m.position.y = -0.1 + Math.abs(Math.sin(this._t * 5 + u.ph)) * 0.14;
    }
    for (const v of this._views) {
      v.icon.position.y = 2.7 + Math.sin(this._t * 2 + v.view.position.x) * 0.16;
      v.lock.position.y = v.icon.position.y;
      if (v.sel.visible) { v.sel.rotation.z += dt * 1.5; v.sel.scale.setScalar(1 + Math.sin(this._t * 4) * 0.04); }
      v.beam.material.opacity = v.beam.material.opacity > 0 ? 0.08 + Math.abs(Math.sin(this._t * 2 + v.view.position.z)) * 0.1 : 0;
    }
  }

  hover(ndc, camera) {
    if (!this._hitMeshes) return -1;
    this._ray.setFromCamera(ndc, camera);
    const hits = this._ray.intersectObjects(this._hitMeshes, false);
    return hits.length ? hits[0].object.userData.id : null;
  }
  pick(clientX, clientY, camera) {
    const ndc = { x: (clientX / window.innerWidth) * 2 - 1, y: -(clientY / window.innerHeight) * 2 + 1 };
    this._ray.setFromCamera(ndc, camera);
    const hits = this._ray.intersectObjects(this._hitMeshes, false);
    return hits.length ? hits[0].object.userData.id : null;
  }
  regionPos(id) { const L = LAYOUT[id]; return L ? new THREE.Vector3(L.x, 0, L.z) : this.center.clone(); }
}
