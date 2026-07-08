// facesprite.js — goofy 2D pixel faces for EVERY humanoid in the 3D world. A single
// flat textured plane mounted on the FRONT of the head (turns with the character),
// replacing the old 3D eye/nose/brow meshes. Paper-Mario / Megabonk flavour: big
// cartoon eyes + a simple mouth, a few moods + seed variants so a crowd isn't clones.
import * as THREE from 'three';

const _cache = new Map();
const PUPIL = '#0a0a12', WHITE = '#fbf7ef';

function faceCanvas(mood, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  const ey = 27, sp = 13;                              // eye row + spacing
  const dx = ((seed % 3) - 1) * 2, dy = (Math.floor(seed / 3) % 2) * 2; // little gaze offset
  for (const s of [-1, 1]) {
    const ex = 32 + s * sp;
    x.fillStyle = WHITE; x.beginPath(); x.ellipse(ex, ey, 8, 10, 0, 0, 7); x.fill();
    x.fillStyle = PUPIL; x.beginPath(); x.ellipse(ex + dx, ey + dy, 4, 5, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillRect(ex + dx - 3, ey + dy - 4, 2, 2); // catch-light
  }
  if (mood === 'grumpy') {                              // angry brows
    x.strokeStyle = PUPIL; x.lineWidth = 3; x.beginPath();
    x.moveTo(32 - sp - 7, ey - 12); x.lineTo(32 - sp + 5, ey - 7);
    x.moveTo(32 + sp + 7, ey - 12); x.lineTo(32 + sp - 5, ey - 7); x.stroke();
  }
  x.fillStyle = 'rgba(255,120,120,0.32)';              // rosy goofy cheeks
  x.beginPath(); x.ellipse(19, 40, 4, 3, 0, 0, 7); x.ellipse(45, 40, 4, 3, 0, 0, 7); x.fill();
  x.strokeStyle = PUPIL; x.lineWidth = 3; x.lineCap = 'round'; x.beginPath();
  if (mood === 'surprised') { x.fillStyle = PUPIL; x.ellipse(32, 46, 4, 5, 0, 0, 7); x.fill(); }
  else if (mood === 'grumpy') { x.arc(32, 52, 8, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke(); }
  else if (mood === 'neutral') { x.moveTo(26, 46); x.lineTo(38, 46); x.stroke(); }
  else { x.arc(32, 42, 8, 0.12 * Math.PI, 0.88 * Math.PI); x.stroke(); } // happy smile
  return c;
}

export function faceTexture(mood = 'happy', seed = 0) {
  const key = mood + ':' + (seed % 6);
  if (_cache.has(key)) return _cache.get(key);
  const t = new THREE.CanvasTexture(faceCanvas(mood, seed % 6));
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
