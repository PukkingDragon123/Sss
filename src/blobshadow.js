// blobshadow.js — shared pixel-style contact ("blob") shadow, Buckshot-Roulette style.
// One radial CanvasTexture reused by every blob; NearestFilter so the RenderPixelatedPass
// keeps it crunchy. Browser-only (never imported by the node test suite). Fully guarded.
import * as THREE from 'three';

let _tex = null;
function blobTexture() {
  if (_tex) return _tex;
  try {
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0.0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
    g.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    _tex = new THREE.CanvasTexture(c);
    _tex.colorSpace = THREE.SRGBColorSpace;
    _tex.magFilter = THREE.NearestFilter;
    _tex.minFilter = THREE.NearestFilter;
  } catch (e) { _tex = null; }
  return _tex;
}

// A flat ground disc (or null on failure). Caller positions/scales it each frame.
export function makeBlob(radius = 0.6) {
  const tex = blobTexture(); if (!tex) return null;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1; m.name = 'blobShadow'; m.userData.r = radius;
  return m;
}
