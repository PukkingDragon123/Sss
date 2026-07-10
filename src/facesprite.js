// facesprite.js — goofy 2D pixel faces for EVERY humanoid in the 3D world. A single
// flat textured plane mounted on the FRONT of the head (turns with the character),
// replacing the old 3D eye/nose/brow meshes. The look: SMALL DOT EYES (always),
// expressive eyebrows, and a per-seed mouth so every NPC reads as a different person.
import * as THREE from 'three';

const _cache = new Map();
const PUPIL = '#050508'; // near-black ink — features must READ at gameplay distance

// SMALL DOT EYES always, brows always, a mouth that varies — every seed reads as a
// different person, but the dot-eye look never changes.
function faceCanvas(mood, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const ey = 29, sp = 11.5;                             // eye row + spacing
  const gx = ((seed % 3) - 1) * 1.5;                    // little gaze offset
  // --- dot eyes: bigger, near-black, with a bright catch-light — dark and VISIBLE ---
  for (const s of [-1, 1]) {
    const ex = 32 + s * sp + gx;
    x.fillStyle = PUPIL; x.beginPath(); x.ellipse(ex, ey, 4.4, 5.2, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillRect(ex - 2.6, ey - 3.6, 2.2, 2.2);
  }
  // --- thick eyebrows (always) — tilt varies by seed; grumpy slants hard, surprised sits high ---
  const browTilt = mood === 'grumpy' ? 6 : mood === 'surprised' ? -2.5 : ((seed % 4) - 1.5) * 1.8;
  const browY = mood === 'surprised' ? ey - 13.5 : ey - 10.5;
  x.strokeStyle = PUPIL; x.lineWidth = 4.6; x.lineCap = 'round';
  for (const s of [-1, 1]) {
    const ex = 32 + s * sp;
    x.beginPath(); x.moveTo(ex - s * 6.5, browY + browTilt * 0.5); x.lineTo(ex + s * 6.5, browY - browTilt * 0.5); x.stroke();
  }
  // --- rosy cheeks / freckles (seed variety) ---
  if (seed % 2 === 0) { x.fillStyle = 'rgba(255,110,110,0.38)'; x.beginPath(); x.ellipse(17, 40, 4.5, 3.2, 0, 0, 7); x.ellipse(47, 40, 4.5, 3.2, 0, 0, 7); x.fill(); }
  if (seed % 8 >= 6) { x.fillStyle = 'rgba(110,70,45,0.7)'; for (const [fx, fy] of [[19, 36], [23, 38], [43, 37]]) x.fillRect(fx, fy, 2, 2); }
  // --- mouth: mood wins; otherwise the seed picks this face's resting mouth ---
  const style = mood === 'grumpy' ? 'frown' : mood === 'surprised' ? 'o' : mood === 'neutral' ? 'flat'
    : mood === 'happy' ? 'smile' : ['smile', 'flat', 'frown', 'smile', 'o', 'smile', 'flat', 'smile'][seed % 8];
  x.strokeStyle = PUPIL; x.lineWidth = 4.4; x.beginPath();
  if (style === 'o') { x.fillStyle = PUPIL; x.ellipse(32, 46, 4.2, 5.2, 0, 0, 7); x.fill(); }
  else if (style === 'frown') { x.arc(32, 53, 8, 1.16 * Math.PI, 1.84 * Math.PI); x.stroke(); }
  else if (style === 'flat') { x.moveTo(25.5, 46); x.lineTo(38.5, 46); x.stroke(); }
  else { x.arc(32, 41, 8, 0.14 * Math.PI, 0.86 * Math.PI); x.stroke(); } // smile
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
