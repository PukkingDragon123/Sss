// levelmap.js — the region's LEVEL MAP as a real 3D candy-crush scene: a winding
// ribbon of glossy gumdrop node-pads climbing a floating candy isle toward the boss
// castle. Built from the pure runmap graph; rendered with the main camera so the
// player can orbit/zoom it with mouse & finger. Primitives-only, pixel-art flavoured.
import * as THREE from 'three';
import { iconCanvas } from './pixelicons.js';
import { pxMap } from './pixeltex.js';

const TYPE = {
  combat:   { icon: '⚔️', label: 'Skirmish', col: 0xff7a9c },
  elite:    { icon: '💀', label: 'Elite',    col: 0xc85a5a },
  treasure: { icon: '💰', label: 'Cache',    col: 0xffcf5c },
  campfire: { icon: '🔥', label: 'Rest',     col: 0xff9a5a },
  event:    { icon: '❓', label: 'Mystery',  col: 0x7fd0ff },
  skill:    { icon: '✶', label: 'Trial',    col: 0x9be6ff },
  minigame: { icon: '🎲', label: 'Game',     col: 0x9bff9b },
  boss:     { icon: '👑', label: 'Boss Lair', col: 0xffe08a },
};
const CANDY = [0xff7a9c, 0x9be6ff, 0xffcf5c, 0xb59bff, 0x9bff9b, 0xffb0d0, 0x7fd0ff];
const hx = (n) => '#' + ('000000' + n.toString(16)).slice(-6);

function numSprite(text, big) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.font = `900 ${big ? 84 : 72}px "Trebuchet MS",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 12; x.strokeStyle = 'rgba(8,5,14,0.95)'; x.strokeText(text, 64, 66);
  x.fillStyle = '#fff8e8'; x.fillText(text, 64, 66);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.5, 1.5, 1.5); return s;
}
function iconSprite(key, px = 92) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const spr = iconCanvas(key, { scale: 6 });
  if (spr) { x.imageSmoothingEnabled = false; x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowOffsetY = 4; x.drawImage(spr, (128 - px) / 2, (128 - px) / 2 + 3, px, px); }
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(1.7, 1.7, 1.7); return s;
}
function labelSprite(text, tone) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 76;
  const x = c.getContext('2d');
  x.font = 'bold 34px "Trebuchet MS",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 8; x.strokeStyle = 'rgba(8,5,14,0.95)'; x.strokeText(text, 160, 34);
  x.fillStyle = '#f6ecd2'; x.fillText(text, 160, 34);
  const w = Math.min(300, x.measureText(text).width + 16);
  x.fillStyle = tone; x.fillRect(160 - w / 2, 60, w, 7);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(9, 2.1, 1); return s;
}

export class LevelMap {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this._ray = new THREE.Raycaster();
    this._t = 0; this._nodes = []; this._hitMeshes = []; this.center = new THREE.Vector3();
  }

  // lay the node chain out along a serpentine trail; return {id -> {x,z}}
  _layout(map) {
    const ordered = map.nodes.slice().sort((a, b) => a.row - b.row);
    const STEP = 4.4, AMP = 6.5;
    const pos = {};
    for (let i = 0; i < ordered.length; i++) {
      const n = ordered[i];
      pos[n.id] = { x: Math.sin(i * 0.9 + 0.4) * AMP, z: -i * STEP, node: n, i };
    }
    return { ordered, pos, span: (ordered.length - 1) * STEP };
  }

  build(map, regionTone) {
    this.dispose();
    const g = this.group;
    const M = (c, r = 0.9, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: o.metal || 0, emissive: o.emis || 0x000000, emissiveIntensity: o.emisI != null ? o.emisI : 1, flatShading: true });
    const tone = regionTone || 0x6a5ac0;
    const L = this._layout(map);
    this._span = L.span;
    const midZ = -L.span / 2;
    this.center.set(0, 0, midZ);

    // ---- floating candy isle the trail sits on ----
    const isle = new THREE.Mesh(new THREE.CylinderGeometry(14, 12, 1.4, 40), M(0x3a2f5a, 1));
    isle.scale.z = (L.span + 20) / 28; isle.position.set(0, -0.8, midZ); isle.receiveShadow = true; g.add(isle);
    const icing = new THREE.Mesh(new THREE.CylinderGeometry(14.3, 14.3, 0.5, 40), M(0xf4e9ff, 0.7));
    icing.scale.z = (L.span + 20) / 28; icing.position.set(0, -0.15, midZ); icing.receiveShadow = true; g.add(icing);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(13, 13.4, 0.6, 40), M(tone, 0.85));
    top.scale.z = (L.span + 20) / 28; top.position.set(0, 0.05, midZ); top.receiveShadow = true; g.add(top);

    // ---- ribbon trail: candy stepping dots between nodes ----
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.85 });
    this._trailDots = [];
    for (let i = 0; i < L.ordered.length - 1; i++) {
      const a = L.pos[L.ordered[i].id], b = L.pos[L.ordered[i + 1].id];
      const seg = 5;
      for (let k = 1; k < seg; k++) {
        const t = k / seg;
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), dotMat);
        d.position.set(a.x + (b.x - a.x) * t, 0.5, a.z + (b.z - a.z) * t);
        d.userData = { seg: i, k }; g.add(d); this._trailDots.push(d);
      }
    }

    // ---- the node pads ----
    for (const n of L.ordered) {
      const p = L.pos[n.id];
      const def = TYPE[n.type] || TYPE.combat;
      const isBoss = n.type === 'boss';
      const view = new THREE.Group(); view.position.set(p.x, 0, p.z);
      // pedestal
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 0.7, 16), M(0xffffff, 0.6)); stem.position.y = 0.45; stem.castShadow = true; view.add(stem);
      let cap;
      if (isBoss) {
        // a little candy castle
        const keep = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 2.0), M(0x5a4a7a, 0.85)); keep.position.y = 1.85; keep.castShadow = true; view.add(keep);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 2.6, 10), M(0x6a5a90, 0.85)); tw.position.set(sx * 1.05, 1.9, sz * 1.05); tw.castShadow = true; view.add(tw);
          const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.8, 10), M(0xff7a9c, 0.8, { emis: 0x5a1030, emisI: 0.4 })); roof.position.set(sx * 1.05, 3.35, sz * 1.05); view.add(roof);
        }
        cap = keep;
      } else {
        // glossy gumdrop
        const gum = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), M(CANDY[p.i % CANDY.length], 0.35, { emis: CANDY[p.i % CANDY.length], emisI: 0.06 }));
        gum.position.y = 0.82; gum.castShadow = true; view.add(gum);
        cap = gum;
        const num = numSprite(String(n.row + 1)); num.position.set(0, 1.5, 0.9); num.scale.set(1.4, 1.4, 1.4); view.add(num);
      }
      // type badge floating above
      const badge = iconSprite(def.icon, isBoss ? 108 : 88); badge.position.y = isBoss ? 4.5 : 2.7; view.add(badge);
      // star pips
      const stars = new THREE.Group(); stars.position.y = isBoss ? 3.4 : 2.0;
      const starMeshes = [];
      for (let s = 0; s < 3; s++) {
        const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0x4a4038 }));
        st.position.set((s - 1) * 0.5, 0, 0); stars.add(st); starMeshes.push(st);
      }
      view.add(stars);
      // glow ring (reachable/current)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.11, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; view.add(ring);
      // bouncing "you are here" pointer
      const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      ptr.rotation.x = Math.PI; ptr.position.y = isBoss ? 5.4 : 3.7; ptr.visible = false; view.add(ptr);
      // label
      const label = labelSprite(def.label, hx(def.col)); label.position.y = isBoss ? -0.2 : -0.35; label.scale.set(6, 1.4, 1); view.add(label);
      // invisible hit target
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 4.5, 10), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.8; hit.userData.id = n.id; view.add(hit);

      g.add(view);
      this._hitMeshes.push(hit);
      this._nodes.push({ id: n.id, node: n, view, cap, ring, ptr, badge, stars: starMeshes, isBoss });
    }

    // pixel grain on the solid pieces
    g.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.isMeshStandardMaterial) return;
      const m = o.material; if (m.map || m.transparent || (m.emissiveIntensity || 0) >= 0.3) return;
      const c = m.color;
      const tk = (c.g > c.r && c.g > c.b) ? 'leaf' : (Math.abs(c.r - c.g) < 0.12 && Math.abs(c.g - c.b) < 0.12) ? 'stone' : 'cloth';
      pxMap(m, tk, 2);
    });
  }

  // paint node states from the live game (current / reachable / visited / stars)
  refresh(game) {
    const map = game._runMap; if (!map) return;
    const cur = game._mapNodeId, visited = game._mapVisited || new Set();
    const reach = new Set();
    if (cur == null) reach.add(map.startId);
    else { const c = map.byId[cur]; if (c) c.next.forEach(id => reach.add(id)); }
    const starsOf = game._mapStarsOf ? (id) => game._mapStarsOf(id) : () => 0;
    for (const nd of this._nodes) {
      const isCur = nd.id === cur, isReach = reach.has(nd.id), isVis = visited.has(nd.id) && !isCur;
      nd._reach = isReach; nd._cur = isCur;
      nd.ptr.visible = isCur;
      nd.ring.material.color.setHex(isCur ? 0xffe08a : isReach ? 0x9be6ff : 0xffe08a);
      nd._ringTarget = (isCur || isReach) ? 0.9 : 0;
      const dim = !isReach && !isVis && !isCur;
      nd.view.scale.setScalar(dim ? 0.86 : 1);
      if (nd.cap && nd.cap.material) nd.cap.material.emissiveIntensity = isReach ? 0.35 : (nd.isBoss ? 0.4 : 0.06);
      const got = starsOf(nd.id);
      for (let s = 0; s < nd.stars.length; s++) nd.stars[s].material.color.setHex(s < got ? 0xffdf5a : 0x4a4038);
    }
  }

  show(v) { this.group.visible = v; }
  pick(clientX, clientY, camera) {
    const ndc = { x: (clientX / window.innerWidth) * 2 - 1, y: -(clientY / window.innerHeight) * 2 + 1 };
    this._ray.setFromCamera(ndc, camera);
    const hits = this._ray.intersectObjects(this._hitMeshes, false);
    return hits.length ? hits[0].object.userData.id : null;
  }
  nodePos(id) { const nd = this._nodes.find(n => n.id === id); return nd ? nd.view.position.clone() : this.center.clone(); }

  update(dt) {
    if (!this.group.visible) return;
    this._t += dt; const t = this._t;
    if (this._trailDots) for (const d of this._trailDots) { const k = Math.max(0, Math.sin(t * 2.4 - d.userData.seg * 0.5 - d.userData.k * 0.4)); d.scale.setScalar(1 + k * 0.6); d.position.y = 0.5 + k * 0.18; }
    for (const nd of this._nodes) {
      if (nd.cap) nd.cap.position.y = (nd.isBoss ? 1.85 : 0.82) + Math.sin(t * 2 + nd.view.position.z) * 0.08;
      if (nd.badge) nd.badge.position.y = (nd.isBoss ? 4.5 : 2.7) + Math.sin(t * 2.2 + nd.view.position.x) * 0.14;
      const rt = nd._ringTarget || 0; const rm = nd.ring.material;
      rm.opacity += (rt - rm.opacity) * Math.min(1, dt * 6);
      if (rt > 0) { nd.ring.rotation.z += dt * 1.2; nd.ring.scale.setScalar(1 + Math.sin(t * 4 + nd.view.position.z) * 0.05); }
      if (nd.ptr.visible) { nd.ptr.position.y = (nd.isBoss ? 5.3 : 3.6) + Math.abs(Math.sin(t * 3.2)) * 0.5; nd.ptr.rotation.y += dt * 2.4; }
    }
  }

  dispose() {
    const g = this.group;
    for (let i = g.children.length - 1; i >= 0; i--) {
      const c = g.children[i];
      c.traverse && c.traverse(o => { if (o.isMesh) { o.geometry && o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose && o.material.dispose(); } } if (o.isSprite && o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      g.remove(c);
    }
    this._nodes = []; this._hitMeshes = []; this._trailDots = [];
  }
}
