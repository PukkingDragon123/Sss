// facesprite.js — goofy 2D pixel faces for EVERY humanoid in the 3D world. A single
// flat textured plane mounted on the FRONT of the head (turns with the character),
// replacing the old 3D eye/nose/brow meshes. The look: SMALL DOT EYES (always),
// expressive eyebrows, and a per-seed mouth so every NPC reads as a different person.
import * as THREE from 'three';

const _cache = new Map();
const PUPIL = '#0a0a12';

// SMALL DOT EYES always, brows always, a mouth that varies — every seed reads as a
// different person, but the dot-eye look never changes.
function faceCanvas(mood, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const ey = 29, sp = 11;                               // eye row + spacing
  const gx = ((seed % 3) - 1) * 1.5;                    // little gaze offset
  // --- small black dot eyes (with a 1px catch-light) ---
  for (const s of [-1, 1]) {
    const ex = 32 + s * sp + gx;
    x.fillStyle = PUPIL; x.beginPath(); x.ellipse(ex, ey, 3.4, 4, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(ex - 2, ey - 3, 1.6, 1.6);
  }
  // --- eyebrows (always) — tilt varies by seed; grumpy slants hard inward, surprised sits high ---
  const browTilt = mood === 'grumpy' ? 5 : mood === 'surprised' ? -2 : ((seed % 4) - 1.5) * 1.6;
  const browY = mood === 'surprised' ? ey - 12 : ey - 9;
  x.strokeStyle = PUPIL; x.lineWidth = 3; x.lineCap = 'round';
  for (const s of [-1, 1]) {
    const ex = 32 + s * sp;
    x.beginPath(); x.moveTo(ex - s * 5, browY + browTilt * 0.5); x.lineTo(ex + s * 5, browY - browTilt * 0.5); x.stroke();
  }
  // --- rosy cheeks / freckles (seed variety) ---
  if (seed % 2 === 0) { x.fillStyle = 'rgba(255,120,120,0.3)'; x.beginPath(); x.ellipse(18, 39, 4, 3, 0, 0, 7); x.ellipse(46, 39, 4, 3, 0, 0, 7); x.fill(); }
  if (seed % 8 >= 6) { x.fillStyle = 'rgba(120,80,50,0.55)'; for (const [fx, fy] of [[20, 36], [24, 38], [42, 37]]) x.fillRect(fx, fy, 1.6, 1.6); }
  // --- mouth: mood wins; otherwise the seed picks this face's resting mouth ---
  const style = mood === 'grumpy' ? 'frown' : mood === 'surprised' ? 'o' : mood === 'neutral' ? 'flat'
    : mood === 'happy' ? 'smile' : ['smile', 'flat', 'frown', 'smile', 'o', 'smile', 'flat', 'smile'][seed % 8];
  x.strokeStyle = PUPIL; x.lineWidth = 3; x.beginPath();
  if (style === 'o') { x.fillStyle = PUPIL; x.ellipse(32, 45, 3.4, 4.4, 0, 0, 7); x.fill(); }
  else if (style === 'frown') { x.arc(32, 51, 7, 1.18 * Math.PI, 1.82 * Math.PI); x.stroke(); }
  else if (style === 'flat') { x.moveTo(27, 45); x.lineTo(37, 45); x.stroke(); }
  else { x.arc(32, 41, 7, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); } // smile
  return c;
}

export function faceTexture(mood = 'happy', seed = 0) {
  const key = mood + ':' + (seed % 8);
  if (_cache.has(key)) return _cache.get(key);
  const t = new THREE.CanvasTexture(faceCanvas(mood, seed % 8));
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.userData = { keep: true }; // shared singleton — dispose sweeps must leave it alone
  _cache.set(key, t); return t;
}

// a flat goofy face plane to mount on the FRONT of a head (size ≈ head width).
// tagged noOutline/noTex/isFace so the outline + pixel-texture sweeps skip it.
export function makeFace(size = 0.9, mood = 'happy', seed = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: faceTexture(mood, seed), transparent: true, depthWrite: false }));
  m.userData.noOutline = true; m.userData.noTex = true; m.userData.isFace = true;
  return m;
}
