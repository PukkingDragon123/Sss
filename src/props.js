// props.js — hand-made forest set-dressing: 3D props skinned with 2D PIXEL-ART sprites.
// Grass tufts, leafy trees (billboard leaf-clusters), textured rocks & mushrooms, fallen
// logs — plus a little cast of ambient CRITTERS (rabbit, bird, mouse, squirrel) that hop
// and scurry around the clearing so the forest feels alive.
//
// Everything is procedural (no assets). Sprite textures are tiny NearestFilter canvases
// with alpha, cached as module singletons flagged userData.keep = true so the arena's
// geometry-only dispose sweep never frees the shared atlas out from under another stage.
import * as THREE from 'three';
import { pxMap } from './pixeltex.js';

// ---- tiny deterministic PRNG (same texture every load) ----
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ===== 2D pixel-art SPRITE textures (colour + alpha, transparent background) =====
const _spriteCache = new Map();
function spriteTexture(kind, painter, size = 20) {
  if (_spriteCache.has(kind)) return _spriteCache.get(kind);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, size, size);
  painter(x, size, rng(kind.length * 131 + size));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace; t.userData = { keep: true };
  _spriteCache.set(kind, t); return t;
}
const px = (x, col, a, b, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(a, b, w, h); };

// a leafy clump: a rounded blob of mottled green leaves, lit top-left, shaded bottom-right
function paintLeaf(x, n, r) {
  const cx = n / 2, cy = n / 2, R = n * 0.46;
  const G = ['#3f7a3a', '#4f9a44', '#356b32', '#2b5a2c', '#5fb154'];
  for (let py = 0; py < n; py++) for (let qx = 0; qx < n; qx++) {
    const dx = qx - cx, dy = py - cy, d = Math.hypot(dx, dy);
    if (d > R + (r() - 0.5) * 2.2) continue;                 // irregular round edge
    const lit = (dx + dy) < -R * 0.15;                        // top-left catches light
    let g = G[(Math.floor(r() * 3) + (lit ? 3 : 0)) % G.length];
    if (d > R * 0.82) g = '#2b5a2c';                          // darker rim
    px(x, g, qx, py);
  }
  // a few bright leaf specks on top
  for (let i = 0; i < n * 0.5; i++) px(x, '#7ac96a', (r() * n) | 0, (r() * n * 0.6) | 0);
}
// a grass tuft: several upright blades on transparent ground
function paintGrass(x, n, r) {
  const blades = 6 + ((r() * 4) | 0);
  const C = ['#4f9a44', '#3f7a3a', '#5fb154', '#356b32'];
  for (let i = 0; i < blades; i++) {
    const bx = 2 + ((r() * (n - 4)) | 0);
    const h = (n * 0.45) + r() * (n * 0.5);
    const lean = (r() - 0.5) * 3;
    const col = C[(r() * C.length) | 0];
    for (let k = 0; k < h; k++) {
      const yy = n - 1 - k;
      const xx = Math.round(bx + (k / h) * lean);
      px(x, k > h * 0.7 ? '#6fbf58' : col, xx, yy);          // brighter tips
    }
  }
  // the odd tiny flower
  if (r() < 0.5) { const fx = 2 + ((r() * (n - 4)) | 0); px(x, r() < 0.5 ? '#e8d24a' : '#e0e8f0', fx, (n * 0.4) | 0); }
}
// a fern frond: a central stem with paired leaflets
function paintFern(x, n, r) {
  const cx = n / 2;
  for (let k = 0; k < n * 0.9; k++) {
    const yy = n - 1 - k;
    px(x, '#2f6b34', cx, yy);
    const spread = (k / n) * (n * 0.42);
    if (k % 2 === 0) { px(x, '#4f9a44', Math.round(cx - spread), yy); px(x, '#4f9a44', Math.round(cx + spread), yy); }
  }
}

// ---- shared sprite materials (singletons; scatter dispose is geometry-only so these live on) ----
let _leafMat, _grassMat, _fernMat;
function leafMat() { return _leafMat || (_leafMat = new THREE.MeshStandardMaterial({ map: spriteTexture('leaf', paintLeaf, 20), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, flatShading: true })); }
function grassMat() { return _grassMat || (_grassMat = new THREE.MeshStandardMaterial({ map: spriteTexture('grass', paintGrass, 16), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, emissive: 0x14200f, emissiveIntensity: 0.35 })); }
function fernMat() { return _fernMat || (_fernMat = new THREE.MeshStandardMaterial({ map: spriteTexture('fern', paintFern, 16), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, emissive: 0x14200f, emissiveIntensity: 0.3 })); }

// crossed billboard quads: two (or three) intersecting planes so a flat sprite reads 3D
function crossQuads(mat, w, h, planes = 2) {
  const g = new THREE.Group();
  for (let i = 0; i < planes; i++) {
    const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    q.rotation.y = (i / planes) * Math.PI;
    q.position.y = h / 2;
    q.userData.noOutline = true; q.userData.noTex = true;
    g.add(q);
  }
  return g;
}

// ===== forest prop builders (each returns a fresh Group; materials are shared) =====

// a 3D tree: tapered trunk + a canopy built from several 2D leaf-sprite clumps
export function makeLeafyTree() {
  const t = new THREE.Group();
  const h = 3.0 + Math.random() * 1.8;
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3326, roughness: 0.95, flatShading: true });
  pxMap(trunkMat, 'wood', 3);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.55, h, 7), trunkMat);
  tr.position.y = h / 2; tr.castShadow = true; t.add(tr);
  // a knot/root flare
  const root = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.6, 7), trunkMat); root.position.y = 0.28; t.add(root);
  // canopy: a cluster of leaf-sprite quads at varied heights → a full, leafy crown
  const lm = leafMat();
  const clumps = 4 + ((Math.random() * 2) | 0);
  for (let i = 0; i < clumps; i++) {
    const a = (i / clumps) * Math.PI * 2 + Math.random();
    const rad = 0.5 + Math.random() * 0.9;
    const sz = 1.6 + Math.random() * 1.1;
    const cq = crossQuads(lm, sz, sz, 2);
    cq.position.set(Math.cos(a) * rad, h + 0.3 + Math.random() * 1.6 - sz / 2, Math.sin(a) * rad);
    t.add(cq);
  }
  // a leafy top cap so the crown closes over
  const top = crossQuads(lm, 2.0, 2.0, 3); top.position.set(0, h + 1.7, 0); t.add(top);
  return t;
}

// a grass tuft (crossed sprite quads)
export function makeGrass() {
  const g = crossQuads(grassMat(), 0.85 + Math.random() * 0.5, 0.7 + Math.random() * 0.5, 2);
  return g;
}
// a fern (crossed sprite quads, a bit taller)
export function makeFern() {
  return crossQuads(fernMat(), 1.0 + Math.random() * 0.4, 1.0 + Math.random() * 0.5, 2);
}

// a mossy boulder: faceted stone with a pixel grain + a moss patch + tiny pebbles
export function makeRock() {
  const g = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 1, flatShading: true });
  pxMap(rockMat, 'stone', 3);
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + Math.random() * 0.5, 0), rockMat);
  r.position.y = 0.34; r.scale.y = 0.82; r.rotation.set(Math.random(), Math.random(), Math.random() * 0.3); r.castShadow = true; g.add(r);
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1, flatShading: true });
  const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 + Math.random() * 0.2, 0), mossMat); moss.position.set(0.1, 0.55, 0.1); moss.scale.y = 0.4; g.add(moss);
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.09, 0), rockMat); p.position.set((Math.random() - 0.5) * 1.1, 0.09, (Math.random() - 0.5) * 1.1); g.add(p); }
  return g;
}

// a toadstool cluster: 1-3 stalks with domed caps, white-dotted, pixel-textured
export function makeMushroom() {
  const g = new THREE.Group();
  const n = 1 + ((Math.random() * 3) | 0);
  const capCol = [0xcf3a3a, 0xd8654a, 0xd8a24a, 0xb0553a][(Math.random() * 4) | 0];
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 0.9, flatShading: true });
  pxMap(stalkMat, 'skin', 2);
  const capMat = new THREE.MeshStandardMaterial({ color: capCol, roughness: 0.72, flatShading: true });
  const spotMat = new THREE.MeshStandardMaterial({ color: 0xfff3e0, roughness: 0.6, flatShading: true });
  for (let i = 0; i < n; i++) {
    const ox = (Math.random() - 0.5) * 0.5, oz = (Math.random() - 0.5) * 0.5;
    const sc = 0.6 + Math.random() * 0.6;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * sc, 0.15 * sc, 0.5 * sc, 7), stalkMat); s.position.set(ox, 0.25 * sc, oz); s.castShadow = true; g.add(s);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34 * sc, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), capMat); cap.position.set(ox, 0.5 * sc, oz); cap.scale.y = 0.78; cap.castShadow = true; g.add(cap);
    for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.SphereGeometry(0.055 * sc, 6, 5), spotMat); sp.position.set(ox + Math.cos(a) * 0.18 * sc, 0.56 * sc, oz + Math.sin(a) * 0.18 * sc); sp.scale.y = 0.4; g.add(sp); }
  }
  return g;
}

// a fallen mossy log: a tipped-over trunk with cut ends, moss and a couple of shelf mushrooms
export function makeFallenLog() {
  const g = new THREE.Group();
  const len = 2.4 + Math.random() * 1.8;
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.95, flatShading: true });
  pxMap(woodMat, 'wood', 4);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9, flatShading: true });
  pxMap(ringMat, 'wood', 2);
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, len, 9), woodMat);
  log.rotation.z = Math.PI / 2; log.position.y = 0.36; log.castShadow = true; g.add(log);
  // cut end faces (lighter rings)
  for (const sx of [-1, 1]) { const end = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 9), ringMat); end.rotation.z = Math.PI / 2; end.position.set(sx * len / 2, 0.36, 0); g.add(end); }
  // moss along the top
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1, flatShading: true });
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + Math.random() * 0.12, 0), mossMat); m.position.set((Math.random() - 0.5) * len * 0.7, 0.6, (Math.random() - 0.5) * 0.2); m.scale.y = 0.4; g.add(m); }
  // a shelf mushroom or two
  const capMat = new THREE.MeshStandardMaterial({ color: 0xd8a24a, roughness: 0.7, flatShading: true });
  for (let i = 0; i < 2; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat); c.position.set((Math.random() - 0.5) * len * 0.6, 0.42, 0.34); c.scale.set(1, 0.5, 0.7); g.add(c); }
  return g;
}

// a leafy shrub: a dark 3D core wrapped in a few billboard leaf-clumps — a rounded bush
export function makeBush() {
  const g = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x2f5f2e, roughness: 1, flatShading: true });
  pxMap(coreMat, 'leaf', 2);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.3, 0), coreMat);
  core.position.y = 0.42; core.scale.y = 0.8; core.castShadow = true; g.add(core);
  const lm = leafMat();
  const clumps = 2 + ((Math.random() * 2) | 0);
  for (let i = 0; i < clumps; i++) {
    const sz = 0.9 + Math.random() * 0.6;
    const cq = crossQuads(lm, sz, sz, 2);
    cq.position.set((Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.25, (Math.random() - 0.5) * 0.5);
    g.add(cq);
  }
  // a berry or two on some bushes
  if (Math.random() < 0.5) { const berryMat = new THREE.MeshStandardMaterial({ color: 0xc0324a, roughness: 0.6, flatShading: true }); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), berryMat); b.position.set((Math.random() - 0.5) * 0.7, 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.4 + 0.2); g.add(b); } }
  return g;
}
// a little wildflower cluster: green stems topped with bright pixel-bright blooms
export function makeFlower() {
  const g = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 1, flatShading: true });
  const cols = [0xe86a9a, 0xe8d24a, 0xe0e8f0, 0x9a6ad0, 0xe88a4a];
  const n = 2 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const ox = (Math.random() - 0.5) * 0.6, oz = (Math.random() - 0.5) * 0.6;
    const h = 0.35 + Math.random() * 0.35;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, h, 5), stemMat);
    stem.position.set(ox, h / 2, oz); g.add(stem);
    const bloomMat = new THREE.MeshStandardMaterial({ color: cols[(Math.random() * cols.length) | 0], roughness: 0.7, flatShading: true, emissive: 0x201010, emissiveIntensity: 0.2 });
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), bloomMat); p.position.set(ox + Math.cos(a) * 0.08, h, oz + Math.sin(a) * 0.08); p.scale.set(1, 0.5, 1); g.add(p); }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshStandardMaterial({ color: 0xf4d24a, roughness: 0.6, flatShading: true })); center.position.set(ox, h + 0.02, oz); g.add(center);
  }
  return g;
}

// ===== ambient critters: little animals that wander & hop around the clearing =====
// Each critter is a tiny low-poly animal with a simple wander AI + a hop/scurry gait.
// They flee from the wizard so they feel alive without ever being in the way.
const CRITTERS = {
  rabbit: { body: 0xd8cdbc, accent: 0xf0e8dc, size: 0.9, speed: 2.4, hop: 0.5, hopH: 0.42 },
  squirrel: { body: 0x9a5a2a, accent: 0xc08048, size: 0.8, speed: 2.8, hop: 0.32, hopH: 0.3 },
  mouse: { body: 0x8a8078, accent: 0xb0a89c, size: 0.55, speed: 3.4, hop: 0.18, hopH: 0.12 },
  bird: { body: 0x6a8ad0, accent: 0xe0a040, size: 0.55, speed: 3.0, hop: 0.34, hopH: 0.22, fly: true },
  fox: { body: 0xd0692a, accent: 0xf2ead8, size: 1.0, speed: 3.0, hop: 0.28, hopH: 0.2, canine: true },
  wolf: { body: 0x6c7076, accent: 0x9aa0a8, size: 1.2, speed: 2.6, hop: 0.2, hopH: 0.13, canine: true },
};

function buildCritter(kind) {
  const def = CRITTERS[kind];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: def.body, roughness: 0.85, flatShading: true });
  const accMat = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.85, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x201814, roughness: 0.6, flatShading: true });
  const s = def.size;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24 * s, 8, 6), bodyMat); body.position.y = 0.22 * s; body.scale.set(1, 0.9, 1.25); body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), bodyMat); head.position.set(0, 0.34 * s, 0.24 * s); head.castShadow = true; g.add(head);
  // eyes (tiny black dots)
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 5, 4), darkMat); e.position.set(sx * 0.07 * s, 0.37 * s, 0.36 * s); g.add(e); }
  // belly
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 7, 5), accMat); belly.position.set(0, 0.16 * s, 0.28 * s); belly.scale.set(1, 0.9, 0.6); g.add(belly);
  if (kind === 'rabbit') {
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.04 * s, 0.24 * s, 2, 5), bodyMat); ear.position.set(sx * 0.07 * s, 0.55 * s, 0.18 * s); ear.rotation.x = -0.2; g.add(ear); const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.02 * s, 0.16 * s, 2, 4), accMat); inner.position.copy(ear.position).z += 0.02; inner.rotation.x = -0.2; g.add(inner); }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 6, 5), accMat); tail.position.set(0, 0.24 * s, -0.28 * s); g.add(tail);
  } else if (kind === 'squirrel') {
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.12 * s, 5), bodyMat); ear.position.set(sx * 0.09 * s, 0.47 * s, 0.2 * s); g.add(ear); }
    const tail = new THREE.Group(); tail.position.set(0, 0.3 * s, -0.3 * s);
    for (let i = 0; i < 3; i++) { const seg = new THREE.Mesh(new THREE.SphereGeometry((0.16 - i * 0.02) * s, 7, 6), accMat); seg.position.set(0, 0.1 * s * i, -0.05 * s * i); tail.add(seg); }
    g.add(tail); g.userData.tail = tail;
  } else if (kind === 'mouse') {
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CircleGeometry(0.09 * s, 8), accMat); ear.position.set(sx * 0.1 * s, 0.42 * s, 0.2 * s); ear.rotation.y = sx * 0.4; ear.material.side = THREE.DoubleSide; g.add(ear); }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.008 * s, 0.5 * s, 5), accMat); tail.position.set(0, 0.16 * s, -0.4 * s); tail.rotation.x = 1.4; g.add(tail);
  } else if (kind === 'bird') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.14 * s, 5), accMat); beak.position.set(0, 0.34 * s, 0.42 * s); beak.rotation.x = Math.PI / 2; g.add(beak);
    const wings = [];
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.36 * s, 4), bodyMat); w.geometry.rotateZ(Math.PI / 2); w.position.set(sx * 0.2 * s, 0.24 * s, 0); if (sx > 0) w.rotation.y = Math.PI; g.add(w); wings.push(w); }
    g.userData.wings = wings;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1 * s, 0.24 * s, 4), bodyMat); tail.position.set(0, 0.24 * s, -0.3 * s); tail.rotation.x = -1.4; g.add(tail);
  } else if (def.canine) {
    // fox / wolf: a longer low body, a snout, pointy ears, four legs and a bushy tail
    body.scale.set(1.15, 0.82, 1.5); body.position.y = 0.3 * s;
    head.position.set(0, 0.38 * s, 0.34 * s);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.1 * s, 0.26 * s, 6), bodyMat); snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.34 * s, 0.56 * s); g.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 6, 5), darkMat); nose.position.set(0, 0.34 * s, 0.7 * s); g.add(nose);
    for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, 0.22 * s, 5), bodyMat); ear.position.set(sx * 0.13 * s, 0.56 * s, 0.28 * s); g.add(ear); }
    for (const [lx, lz] of [[-0.14, 0.2], [0.14, 0.2], [-0.14, -0.2], [0.14, -0.2]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * s, 0.05 * s, 0.24 * s, 5), darkMat); leg.position.set(lx * s, 0.12 * s, lz * s); leg.castShadow = true; g.add(leg); }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15 * s, 0.44 * s, 6), kind === 'fox' ? bodyMat : bodyMat); tail.position.set(0, 0.4 * s, -0.46 * s); tail.rotation.x = -0.8; g.add(tail);
    if (kind === 'fox') { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11 * s, 7, 6), accMat); tip.position.set(0, 0.58 * s, -0.62 * s); g.add(tip); const belly = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 7, 5), accMat); belly.position.set(0, 0.34 * s, 0.5 * s); belly.scale.set(0.8, 0.7, 0.5); g.add(belly); }
  }
  g.userData.def = def; g.userData.kind = kind;
  return g;
}

// manages a small roaming population of critters within the clearing
export class Critters {
  constructor(parent, radius = 40) {
    this.group = new THREE.Group(); parent.add(this.group);
    this.radius = radius; this.list = [];
  }
  clear() {
    for (const c of this.list) {
      c.mesh.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material && !o.material.userData?.keep) o.material.dispose(); } });
      this.group.remove(c.mesh);
    }
    this.list.length = 0;
  }
  // populate with a themed mix (kinds vary by biome); count 0 clears
  populate(kinds, count = 7) {
    this.clear();
    if (!kinds || !kinds.length || count <= 0) return;
    for (let i = 0; i < count; i++) {
      const kind = kinds[(Math.random() * kinds.length) | 0];
      const mesh = buildCritter(kind); this.group.add(mesh);
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * (this.radius - 12);
      const c = {
        mesh, kind, def: mesh.userData.def,
        x: Math.cos(a) * r, z: Math.sin(a) * r, yaw: Math.random() * 6.28,
        tx: 0, tz: 0, wait: Math.random() * 2, phase: Math.random() * 6.28, hopT: Math.random(),
      };
      this._newTarget(c); mesh.position.set(c.x, 0, c.z);
      this.list.push(c);
    }
  }
  _newTarget(c) {
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (this.radius - 10);
    c.tx = Math.cos(a) * r; c.tz = Math.sin(a) * r;
  }
  update(dt, playerPos) {
    for (const c of this.list) {
      c.phase += dt;
      // flee if the wizard gets close, otherwise amble toward the wander target
      let tx = c.tx, tz = c.tz, fleeing = false;
      if (playerPos) {
        const fx = c.x - playerPos.x, fz = c.z - playerPos.z, fd = Math.hypot(fx, fz);
        if (fd < 7) { tx = c.x + (fx / (fd || 1)) * 12; tz = c.z + (fz / (fd || 1)) * 12; fleeing = true; }
      }
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz) || 1e-4;
      const def = c.def;
      if (!fleeing && d < 0.6) { c.wait -= dt; if (c.wait <= 0) { c.wait = 0.6 + Math.random() * 2.4; this._newTarget(c); } }
      const moving = d > 0.6 || fleeing;
      if (moving) {
        const spd = def.speed * (fleeing ? 1.7 : 1);
        // hop cadence: move in little bursts, arcing up between steps
        c.hopT -= dt;
        const step = spd * dt;
        c.x += (dx / d) * step; c.z += (dz / d) * step;
        c.yaw = Math.atan2(dx, dz);
        // keep them inside the clearing
        const rr = Math.hypot(c.x, c.z); if (rr > this.radius - 3) { c.x *= (this.radius - 3) / rr; c.z *= (this.radius - 3) / rr; this._newTarget(c); }
      }
      // hop / bob height
      const hopSpeed = def.fly ? 6 : (moving ? 9 : 0);
      const hopH = def.fly ? def.hopH : (moving ? def.hopH : 0);
      const y = def.fly ? 0.6 + Math.sin(c.phase * 3) * 0.25 : Math.abs(Math.sin(c.phase * hopSpeed * 0.5)) * hopH;
      c.mesh.position.set(c.x, y, c.z);
      c.mesh.rotation.y = c.yaw;
      c.mesh.rotation.x = moving ? Math.sin(c.phase * hopSpeed) * 0.14 : 0;
      // flappy wings / bushy tail flourishes
      if (c.mesh.userData.wings) { const f = Math.sin(c.phase * 18) * 0.7; c.mesh.userData.wings[0].rotation.z = 0.4 + f; c.mesh.userData.wings[1].rotation.z = -0.4 - f; }
      if (c.mesh.userData.tail) c.mesh.userData.tail.rotation.x = Math.sin(c.phase * 6) * 0.2 - 0.2;
    }
  }
}

// which critters suit each scatter biome (empty = none)
export const BIOME_CRITTERS = {
  trees: ['rabbit', 'squirrel', 'fox', 'wolf', 'bird'],
  swamp: ['bird', 'mouse', 'fox'],
  graves: ['mouse', 'wolf'],
  ice: ['rabbit', 'fox', 'wolf'],
};
