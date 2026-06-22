// runmap.js — a Slay-the-Spire-style branching journey, rendered in 3D.
// Leaving the tavern drops you onto a winding road map: rows of encounter nodes
// (skirmish / elite / treasure / campfire / shop) climbing toward the boss at the
// top, half-lost in fog. You pick a path one node at a time; nodes unlock as you
// advance. The whole thing lives in the game's scene as a toggleable group.
import * as THREE from 'three';

export const NODE_META = {
  fight:    { icon: '⚔️', color: 0x9b7bff, ring: 0xbfa3ff, label: 'Skirmish', blurb: 'A pack of beasts. Survive a couple of waves.' },
  elite:    { icon: '💀', color: 0xff6a6a, ring: 0xff9a9a, label: 'Elite', blurb: 'A tougher brood — but the loot is richer.' },
  treasure: { icon: '💰', color: 0xffd166, ring: 0xffe6a8, label: 'Treasure', blurb: 'A stash. Free gold and maybe a trinket.' },
  rest:     { icon: '🔥', color: 0xff9a4a, ring: 0xffc080, label: 'Campfire', blurb: 'Mend your wounds, or sharpen your craft.' },
  shop:     { icon: '🛒', color: 0x6ee7a0, ring: 0xa6f2c8, label: 'Pop-up Shop', blurb: 'Spend gold on potions and gear.' },
  boss:     { icon: '👑', color: 0xff4040, ring: 0xff8080, label: 'Boss', blurb: 'The beast that took Tomas. End it.' },
};

const ROWS = 7;        // row 0 = start picks, row ROWS-1 = boss
const ROW_GAP = 7.5;
const COL_GAP = 5.2;
const Z0 = 8;          // z of row 0 (near the camera)

function iconSprite(emoji) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.font = '96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 8;
  x.fillText(emoji, 64, 72);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat); s.scale.set(2.0, 2.0, 2.0);
  return s;
}

export class RunMap {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this.nodes = [];
    this.edges = [];
    this.current = -1;       // index of the node we're standing on (-1 = before row 0)
    this.reachable = new Set();
    this._raf = 0; this._t = 0;
    this._ray = new THREE.Raycaster();
    this._hover = -1;
    this._travel = null;     // {from:Vector3,to:Vector3,t:0,dur,onArrive}
    this.marker = null;
    this._built = false;
  }

  // ---------- generation ----------
  generate(stage) {
    this.stage = stage;
    this.nodes = []; this.edges = [];
    this.current = -1; this.reachable.clear();

    // lay out nodes row by row
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      let count;
      if (r === 0) count = 3;
      else if (r === ROWS - 1) count = 1;            // boss
      else count = 2 + Math.floor(Math.random() * 3); // 2..4
      const row = [];
      for (let c = 0; c < count; c++) {
        const x = (c - (count - 1) / 2) * COL_GAP + (Math.random() - 0.5) * 1.2;
        const z = Z0 - r * ROW_GAP;
        const type = this._pickType(r, count, c);
        const node = { i: this.nodes.length, r, c, type, x, z, done: false, to: [], from: [] };
        row.push(node); this.nodes.push(node);
      }
      rows.push(row);
    }
    // connect rows (non-crossing-ish, fully reachable)
    for (let r = 0; r < ROWS - 1; r++) {
      const A = rows[r], B = rows[r + 1];
      for (let i = 0; i < A.length; i++) {
        const j = Math.round(i * (B.length - 1) / Math.max(1, A.length - 1));
        this._link(A[i], B[j]);
        const extra = Math.random();
        if (extra < 0.38 && B[j + 1]) this._link(A[i], B[j + 1]);
        else if (extra < 0.62 && B[j - 1]) this._link(A[i], B[j - 1]);
      }
      // guarantee every B node has an incoming edge
      for (let j = 0; j < B.length; j++) {
        if (B[j].from.length === 0) {
          let best = A[0], bd = Infinity;
          for (const a of A) { const d = Math.abs(a.x - B[j].x); if (d < bd) { bd = d; best = a; } }
          this._link(best, B[j]);
        }
      }
    }
    this.rows = rows;
    this._build(stage);
    // first picks: all of row 0
    for (const n of rows[0]) this.reachable.add(n.i);
    this._refreshNodeStates();
  }

  _link(a, b) {
    if (a.to.includes(b.i)) return;
    a.to.push(b.i); b.from.push(a.i); this.edges.push([a.i, b.i]);
  }

  _pickType(r, count, c) {
    if (r === 0) return 'fight';
    if (r === ROWS - 1) return 'boss';
    if (r === ROWS - 2) return Math.random() < 0.7 ? 'rest' : 'shop'; // campfire row before boss
    const roll = Math.random();
    if (r >= 2 && roll < 0.16) return 'elite';
    if (roll < 0.30) return 'treasure';
    if (roll < 0.42) return 'shop';
    if (roll < 0.54) return 'rest';
    return 'fight';
  }

  // ---------- 3D build ----------
  _build(stage) {
    const g = this.group;
    for (let i = g.children.length - 1; i >= 0; i--) {
      const c = g.children[i];
      if (c === this.marker) continue; // the spirit marker persists across regenerations
      c.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); g.remove(c);
    }
    this._hitMeshes = []; this._nodeViews = [];

    const t = stage.theme;
    // long road bed receding into the fog
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, ROWS * ROW_GAP + 40), new THREE.MeshStandardMaterial({ color: t.floor, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, Z0 - (ROWS - 1) * ROW_GAP / 2); ground.receiveShadow = true; g.add(ground);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(14, ROWS * ROW_GAP + 30), new THREE.MeshStandardMaterial({ color: t.rug, roughness: 1 }));
    path.rotation.x = -Math.PI / 2; path.position.set(0, -0.03, ground.position.z); path.receiveShadow = true; g.add(path);

    // edges as glowing trails
    this._edgeMeshes = [];
    const edgeGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 6);
    for (const [ai, bi] of this.edges) {
      const a = this.nodes[ai], b = this.nodes[bi];
      const m = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color: 0x4a4368, transparent: true, opacity: 0.6 }));
      const ax = new THREE.Vector3(a.x, 0.35, a.z), bx = new THREE.Vector3(b.x, 0.35, b.z);
      m.position.copy(ax).add(bx).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bx.clone().sub(ax).normalize());
      m.scale.set(1, ax.distanceTo(bx), 1);
      m.userData.edge = [ai, bi];
      g.add(m); this._edgeMeshes.push(m);
    }

    // nodes
    for (const n of this.nodes) {
      const meta = NODE_META[n.type];
      const view = new THREE.Group(); view.position.set(n.x, 0, n.z);
      const isBoss = n.type === 'boss';
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(isBoss ? 1.8 : 1.1, isBoss ? 2.1 : 1.4, 0.5, 16), new THREE.MeshStandardMaterial({ color: meta.color, emissive: meta.color, emissiveIntensity: 0.25, roughness: 0.6 }));
      ped.position.y = 0.25; ped.castShadow = true; view.add(ped);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(isBoss ? 2.3 : 1.55, 0.1, 8, 28), new THREE.MeshBasicMaterial({ color: meta.ring, transparent: true, opacity: 0.5 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; view.add(ring);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(isBoss ? 1.9 : 1.2, isBoss ? 1.9 : 1.2, 6, 12, 1, true), new THREE.MeshBasicMaterial({ color: meta.ring, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      pillar.position.y = 3; view.add(pillar);
      const icon = iconSprite(meta.icon); icon.position.y = isBoss ? 2.6 : 1.9; if (isBoss) icon.scale.set(3, 3, 3); view.add(icon);
      const check = iconSprite('✅'); check.position.y = isBoss ? 2.6 : 1.9; check.visible = false; view.add(check);
      // raycast target
      const hit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.6, 3.4), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.4; hit.userData.idx = n.i; view.add(hit);
      g.add(view);
      this._hitMeshes.push(hit);
      this._nodeViews.push({ node: n, view, ped, ring, pillar, icon, check });
    }

    // the spirit marker that walks the road
    if (!this.marker) {
      const mk = new THREE.Group();
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 14), new THREE.MeshBasicMaterial({ color: 0xbfa3ff, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending }));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0x6f5fc4, roughness: 0.7 })); hat.position.y = 0.55;
      const light = new THREE.PointLight(0x9b7bff, 1.4, 10); light.castShadow = false;
      mk.add(orb, core, hat, light);
      this.marker = mk; this.group.add(mk);
    }
    // park the spirit marker just below row 0, ready to set off
    this.marker.position.set(0, 1.1, Z0 + ROW_GAP * 0.7);
    this._built = true;
  }

  // ---------- state ----------
  setCurrent(i) {
    this.current = i;
    if (i >= 0) this.nodes[i].done = true;
    this.reachable.clear();
    if (i < 0) { for (const n of this.rows[0]) this.reachable.add(n.i); }
    else { for (const j of this.nodes[i].to) this.reachable.add(j); }
    this._refreshNodeStates();
  }

  isReachable(i) { return this.reachable.has(i); }
  node(i) { return this.nodes[i]; }
  isBossNext() { // boss is the only node left to reach
    return this.reachable.size > 0 && [...this.reachable].every(i => this.nodes[i].type === 'boss');
  }

  _refreshNodeStates() {
    for (const v of this._nodeViews) {
      const reach = this.reachable.has(v.node.i);
      const done = v.node.done;
      v.check.visible = done;
      v.icon.visible = !done;
      v.pillar.material.opacity = reach ? 0.16 : 0;
      v.ring.material.opacity = done ? 0.7 : reach ? 0.9 : 0.28;
      v.ring.material.color.setHex(done ? 0x6ee7a0 : NODE_META[v.node.type].ring);
      v.ped.material.emissiveIntensity = reach ? 0.55 : done ? 0.4 : 0.18;
    }
    // brighten edges leading to reachable nodes from current
    for (const m of this._edgeMeshes) {
      const [a, b] = m.userData.edge;
      const live = (a === this.current && this.reachable.has(b)) || (this.current < 0 && this.rows[0].some(n => n.i === b));
      m.material.color.setHex(live ? 0xffe08a : 0x4a4368);
      m.material.opacity = live ? 0.95 : 0.5;
    }
  }

  // ---------- per-frame ----------
  show(v) { this.group.visible = v; }

  update(dt, game) {
    if (!this.group.visible) return;
    this._t += dt;
    // bob + spin reachable nodes; pulse pillars
    for (const v of this._nodeViews) {
      const reach = this.reachable.has(v.node.i);
      v.icon.position.y = (v.node.type === 'boss' ? 2.6 : 1.9) + Math.sin(this._t * 2 + v.node.i) * (reach ? 0.18 : 0.06);
      v.ring.rotation.z += dt * (reach ? 1.2 : 0.3);
      if (reach) v.pillar.material.opacity = 0.10 + Math.abs(Math.sin(this._t * 2 + v.node.i)) * 0.12;
    }
    // marker idle glow
    if (this.marker) {
      this.marker.children[0].scale.setScalar(1 + Math.sin(this._t * 4) * 0.08);
      if (!this._travel) this.marker.position.y = 1.1 + Math.sin(this._t * 2) * 0.12;
    }
    // travel animation
    if (this._travel) {
      const tr = this._travel; tr.t += dt / tr.dur;
      const k = Math.min(1, tr.t);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.marker.position.lerpVectors(tr.from, tr.to, e); this.marker.position.y = 1.1 + Math.sin(k * Math.PI) * 1.2;
      if (k >= 1) { const cb = tr.onArrive; this._travel = null; if (cb) cb(); }
    }
  }

  travelTo(i, onArrive) {
    const n = this.nodes[i];
    const from = this.marker.position.clone();
    const to = new THREE.Vector3(n.x, 1.1, n.z);
    this._travel = { from, to, t: 0, dur: 0.6, onArrive };
  }

  // hover highlight from a screen ndc
  hover(ndc, camera) {
    if (!this._hitMeshes) return;
    this._ray.setFromCamera(ndc, camera);
    const hits = this._ray.intersectObjects(this._hitMeshes, false);
    let idx = -1;
    for (const h of hits) { const i = h.object.userData.idx; if (this.reachable.has(i)) { idx = i; break; } }
    if (idx !== this._hover) {
      this._hover = idx;
      for (const v of this._nodeViews) v.view.scale.setScalar(v.node.i === idx ? 1.18 : 1);
    }
    return idx;
  }

  // raycast a click; returns the chosen reachable node index or -1
  pick(clientX, clientY, camera) {
    const ndc = { x: (clientX / window.innerWidth) * 2 - 1, y: -(clientY / window.innerHeight) * 2 + 1 };
    this._ray.setFromCamera(ndc, camera);
    const hits = this._ray.intersectObjects(this._hitMeshes, false);
    for (const h of hits) { const i = h.object.userData.idx; if (this.reachable.has(i)) return i; }
    return -1;
  }

  currentPos() {
    if (this.current < 0) return new THREE.Vector3(0, 0, Z0 + ROW_GAP);
    const n = this.nodes[this.current];
    return new THREE.Vector3(n.x, 0, n.z);
  }
}
