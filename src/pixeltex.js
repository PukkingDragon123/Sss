// pixeltex.js — procedural PIXEL-ART textures for the low-poly models.
// Every texture is a tiny (16–32px) tileable canvas sampled with NearestFilter, so it
// reads as crisp pixel art no matter how far it's stretched. The patterns are kept
// near-white / low-contrast on purpose: they're used as `.map` and MULTIPLY with each
// material's own colour, so per-stage tinting, rarity colours and flat-shading all still
// come through — the texture only adds a hand-stamped pixel grain on top.
//
// Self-contained & lazy: nothing touches the canvas at import time (so the node test can
// import model files without a DOM). Textures are module singletons flagged
// `userData.keep = true` so the various dispose() sweeps leave the shared atlas alone.
import * as THREE from 'three';

const _canvasCache = new Map(); // kind -> HTMLCanvasElement (the pattern, drawn once)
const _texCache = new Map();    // "kind@repeat" -> THREE.CanvasTexture

// tiny deterministic PRNG so a texture looks identical every load
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// grayscale value -> css. g in [0,1]; textures multiply, so ~1.0 = untouched.
const gc = (g) => { const v = Math.max(0, Math.min(255, Math.round(g * 255))); return `rgb(${v},${v},${v})`; };

// ---- pattern painters: each fills a size×size canvas with a tileable grayscale grain ----
const PAINTERS = {
  // woven cloth: a soft diagonal twill (robes, capes, hats, banners)
  cloth(ctx, n, r) {
    ctx.fillStyle = gc(0.95); ctx.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = (x + y) % 4;
      let g = d === 0 ? 0.86 : d === 2 ? 1.0 : 0.93;
      if (r() < 0.06) g *= 0.94;
      ctx.fillStyle = gc(g); ctx.fillRect(x, y, 1, 1);
    }
  },
  // faint speckle for skin / cream (barely there, just kills the plastic flatness)
  skin(ctx, n, r) {
    ctx.fillStyle = gc(0.97); ctx.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const q = r(); const g = q < 0.10 ? 0.9 : q > 0.92 ? 1.0 : 0.97;
      ctx.fillStyle = gc(g); ctx.fillRect(x, y, 1, 1);
    }
  },
  // grassy ground: mottled clumps + a few upright blades (used tiled hard across the floor)
  grass(ctx, n, r) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const q = r(); let g = 0.82 + (q - 0.5) * 0.36;
      ctx.fillStyle = gc(g); ctx.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < n * 0.9; i++) { const x = (r() * n) | 0, y = (r() * n) | 0, h = 1 + ((r() * 2) | 0); const g = r() < 0.5 ? 1.05 : 0.66; ctx.fillStyle = gc(g); ctx.fillRect(x, y, 1, h); }
  },
  // packed dirt / sand: mottled with tiny pebbles
  dirt(ctx, n, r) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const g = 0.86 + (r() - 0.5) * 0.26; ctx.fillStyle = gc(g); ctx.fillRect(x, y, 1, 1); }
    for (let i = 0; i < n * 0.6; i++) { const x = (r() * n) | 0, y = (r() * n) | 0; ctx.fillStyle = gc(r() < 0.5 ? 0.62 : 1.05); ctx.fillRect(x, y, 1, 1); }
  },
  // masonry / rock: blocky cells with darker mortar seams
  stone(ctx, n, r) {
    ctx.fillStyle = gc(0.9); ctx.fillRect(0, 0, n, n);
    const cell = Math.max(4, (n / 4) | 0);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const seam = (x % cell === 0) || (y % cell === ((((x / cell) | 0) % 2) ? (cell >> 1) % cell : 0));
      let g = 0.8 + r() * 0.22; if (seam) g = 0.56;
      ctx.fillStyle = gc(g); ctx.fillRect(x, y, 1, 1);
    }
  },
  // wooden planks: horizontal boards, seams + streaky grain + the odd knot
  wood(ctx, n, r) {
    const plank = Math.max(5, (n / 4) | 0);
    for (let y = 0; y < n; y++) {
      const seam = (y % plank === 0);
      for (let x = 0; x < n; x++) {
        let g = 0.9 + Math.sin((x + y * 0.3) * 0.7) * 0.08 + (r() - 0.5) * 0.09;
        if (seam) g = 0.55;
        ctx.fillStyle = gc(g); ctx.fillRect(x, y, 1, 1);
      }
    }
    for (let i = 0; i < 2; i++) { const kx = (r() * n) | 0, ky = (r() * n) | 0; ctx.fillStyle = gc(0.6); ctx.fillRect(kx, ky, 2, 1); }
  },
  // brushed metal / gold: horizontal streaks + a couple of rivets (trims, armour, coins)
  metal(ctx, n, r) {
    for (let y = 0; y < n; y++) { const base = 0.86 + Math.sin(y * 1.3) * 0.06; for (let x = 0; x < n; x++) { const g = base + (r() - 0.5) * 0.05; ctx.fillStyle = gc(g); ctx.fillRect(x, y, 1, 1); } }
    ctx.fillStyle = gc(1.0); ctx.fillRect(0, (n * 0.3) | 0, n, 1);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = gc(0.72); ctx.fillRect((r() * n) | 0, (r() * n) | 0, 1, 1); }
  },
  // leafy canopy: chunky overlapping leaf blobs (bright tops / dark undersides) for a clear,
  // readable 2D-leaf texture on trees & bushes — matches how visibly the grass floor reads
  leaf(ctx, n, r) {
    // mottled green base
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const g = 0.74 + (r() - 0.5) * 0.2; ctx.fillStyle = gc(g); ctx.fillRect(x, y, 1, 1); }
    // scatter little 2-3px leaf shapes: a lit crown pixel + a shaded body
    const leaves = Math.floor(n * n * 0.14);
    for (let i = 0; i < leaves; i++) {
      const x = (r() * n) | 0, y = (r() * n) | 0, lit = r() < 0.5;
      ctx.fillStyle = gc(lit ? 1.18 : 0.58);
      ctx.fillRect(x, y, 2, 1); ctx.fillRect(x, (y + 1) % n, 1, 1);          // a wee leaf
      ctx.fillStyle = gc(lit ? 0.7 : 0.48); ctx.fillRect((x + 1) % n, (y + 1) % n, 1, 1); // its shadow
    }
  },
  // crystal / gem: bright faces with a diagonal glint and a few dark facets
  gem(ctx, n, r) {
    ctx.fillStyle = gc(0.9); ctx.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { if ((x + y) % 6 === 0) { ctx.fillStyle = gc(1.0); ctx.fillRect(x, y, 1, 1); } else if (r() < 0.12) { ctx.fillStyle = gc(0.78); ctx.fillRect(x, y, 1, 1); } }
  },
};

// per-kind default look: canvas size + how many times it tiles across a mesh's UVs
const KINDS = {
  cloth: { size: 16, repeat: 3, paint: PAINTERS.cloth },
  skin:  { size: 16, repeat: 2, paint: PAINTERS.skin },
  grass: { size: 32, repeat: 48, paint: PAINTERS.grass },
  dirt:  { size: 32, repeat: 40, paint: PAINTERS.dirt },
  rug:   { size: 24, repeat: 8, paint: PAINTERS.cloth },
  stone: { size: 24, repeat: 4, paint: PAINTERS.stone },
  wood:  { size: 24, repeat: 3, paint: PAINTERS.wood },
  metal: { size: 16, repeat: 2, paint: PAINTERS.metal },
  leaf:  { size: 24, repeat: 2, paint: PAINTERS.leaf },
  gem:   { size: 16, repeat: 1, paint: PAINTERS.gem },
};

const SEED = { cloth: 7, skin: 11, grass: 23, dirt: 29, rug: 31, stone: 37, wood: 41, metal: 43, leaf: 47, gem: 53 };

function _canvas(kind) {
  let c = _canvasCache.get(kind); if (c) return c;
  const def = KINDS[kind] || KINDS.cloth, n = def.size;
  c = document.createElement('canvas'); c.width = c.height = n;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  def.paint(ctx, n, rng(SEED[kind] || 1));
  _canvasCache.set(kind, c); return c;
}

// Get a shared pixel-art texture. `repeat` overrides the per-kind tiling (a distinct
// repeat yields its own lightweight texture off the SAME canvas image).
export function pxTexture(kind, repeat) {
  const def = KINDS[kind] || KINDS.cloth;
  const rep = repeat != null ? repeat : def.repeat;
  const key = kind + '@' + rep;
  let t = _texCache.get(key); if (t) return t;
  t = new THREE.CanvasTexture(_canvas(kind));
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(rep, rep); t.anisotropy = 1; t.generateMipmaps = true;
  t.userData = { keep: true }; // shared singleton — dispose sweeps must skip it
  t.needsUpdate = true;
  _texCache.set(key, t); return t;
}

// Convenience: stamp a pixel texture straight onto a material (returns the material).
export function pxMap(material, kind, repeat) {
  if (!material || typeof document === 'undefined') return material;
  try { material.map = pxTexture(kind, repeat); material.needsUpdate = true; } catch (e) { /* no DOM → skip */ }
  return material;
}
