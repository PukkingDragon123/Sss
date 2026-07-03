// charmodels.js — unique 3D "pixel" (voxel) character models, built from boxes/cones.
// Used two ways: (1) as the roaming tavern NPCs' bodies, and (2) rendered offscreen to a
// small pixel-art portrait dataURL for dialogue (replacing the old flat 2D faces).
// All procedural (no assets). The offscreen renderer is lazy + guarded; on any failure
// charPortrait returns '' and callers fall back to the 2D face / emoji.
import * as THREE from 'three';
import { faceImg } from './faces.js';

const darken = (hex, k = 0.78) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); };

// box primitive (its own geometry+material so disposal is always safe in both contexts)
function B(g, w, h, d, color, x, y, z, o = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.82, metalness: o.metal ?? 0.0,
    emissive: o.emis ?? 0x000000, emissiveIntensity: o.emisI ?? 1,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (o.rotX) m.rotation.x = o.rotX; if (o.rotY) m.rotation.y = o.rotY; if (o.rotZ) m.rotation.z = o.rotZ;
  m.castShadow = true; g.add(m); return m;
}
function CONE(g, r, h, color, x, y, z, o = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.82, metalness: o.metal ?? 0, emissive: o.emis ?? 0x000000 });
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, o.seg ?? 6), mat);
  m.position.set(x, y, z); if (o.rotZ) m.rotation.z = o.rotZ; if (o.rotX) m.rotation.x = o.rotX;
  m.castShadow = true; g.add(m); return m;
}

// ---- the parametric humanoid that most characters derive from ----
function _human(o) {
  const g = new THREE.Group();
  const skin = o.skin ?? 0xf0d6b8, robe = o.robe ?? 0x7a8bd0, robe2 = o.robe2 ?? darken(robe);
  const tw = o.wide ? 0.8 : 0.62;

  // lower body: a gown/skirt, or two legs, or a wavy ghost tail
  if (o.float) {
    B(g, tw * 0.9, 0.5, 0.4, robe, 0, 0.95, 0);
    B(g, tw * 0.78, 0.34, 0.34, robe, 0, 0.55, 0);
    B(g, tw * 0.5, 0.26, 0.24, robe, -0.1, 0.28, 0); B(g, tw * 0.42, 0.2, 0.2, robe, 0.14, 0.18, 0);
  } else if (o.gown) {
    B(g, tw * 1.25, 0.7, 0.5, robe, 0, 0.4, 0); B(g, tw, 0.6, 0.44, robe, 0, 0.95, 0);
  } else {
    B(g, 0.2, 0.5, 0.24, o.pants ?? robe2, -0.16, 0.25, 0);
    B(g, 0.2, 0.5, 0.24, o.pants ?? robe2, 0.16, 0.25, 0);
    B(g, tw, 0.7, 0.42, robe, 0, 0.95, 0, { metal: o.metalBody ? 0.7 : 0, rough: o.metalBody ? 0.4 : 0.82 });
  }
  if (o.apron) B(g, tw * 0.66, 0.5, 0.06, o.apron, 0, 0.9, 0.22);
  if (o.belt) B(g, tw + 0.04, 0.12, 0.46, o.belt, 0, 0.68, 0, { metal: 0.5, rough: 0.4, emis: 0x3a2c00 });
  if (o.cracks) { B(g, 0.05, 0.34, 0.04, darken(robe, 0.5), -0.1, 0.95, 0.22); B(g, 0.05, 0.22, 0.04, darken(robe, 0.5), 0.14, 1.05, 0.22, { rotZ: 0.4 }); }

  // arms + hands
  const ax = tw / 2 + 0.1;
  B(g, 0.16, 0.5, 0.18, robe, -ax, 0.98, 0, { rotZ: 0.12, metal: o.metalBody ? 0.7 : 0 });
  B(g, 0.16, 0.5, 0.18, robe, ax, 0.98, 0, { rotZ: -0.12, metal: o.metalBody ? 0.7 : 0 });
  B(g, 0.14, 0.14, 0.14, skin, -ax - 0.04, 0.72, 0.03); B(g, 0.14, 0.14, 0.14, skin, ax + 0.04, 0.72, 0.03);

  // neck + head
  const hunch = o.hunch ? 0.12 : 0;
  B(g, 0.18, 0.12, 0.18, skin, 0, 1.36, hunch * 0.5);
  const hy = 1.66, hw = 0.5;
  const head = B(g, hw, 0.5, 0.46, skin, 0, hy, hunch, o.hunch ? { rotX: 0.18 } : {});

  // eyes
  const eC = o.eyeColor ?? 0x141414, eo = o.glowEyes ? { emis: eC, emisI: 2.2 } : {};
  B(g, 0.09, 0.12, 0.05, eC, -0.12, hy + 0.02, 0.24 + hunch, eo);
  B(g, 0.09, 0.12, 0.05, eC, 0.12, hy + 0.02, 0.24 + hunch, eo);
  if (o.nose !== false) B(g, 0.1, 0.1, 0.1, o.noseColor ?? 0xd98a72, 0, hy - 0.06, 0.26 + hunch);
  if (o.cheeks) { B(g, 0.1, 0.08, 0.05, o.cheeks, -0.19, hy - 0.06, 0.24 + hunch); B(g, 0.1, 0.08, 0.05, o.cheeks, 0.19, hy - 0.06, 0.24 + hunch); }
  if (o.wideMouth) B(g, 0.32, 0.06, 0.05, 0x6a2a2a, 0, hy - 0.18, 0.24 + hunch);
  if (o.tooth) B(g, 0.06, 0.1, 0.04, 0xffffff, 0.06, hy - 0.16, 0.25 + hunch);

  // ears / cat ears / frog eye-bumps
  if (o.ears) { B(g, 0.1, 0.22, 0.14, skin, -0.3, hy + 0.04, 0, { rotZ: -0.5 }); B(g, 0.1, 0.22, 0.14, skin, 0.3, hy + 0.04, 0, { rotZ: 0.5 }); }
  if (o.catEars) { CONE(g, 0.12, 0.22, o.hair ?? skin, -0.16, hy + 0.3, 0, { seg: 4 }); CONE(g, 0.12, 0.22, o.hair ?? skin, 0.16, hy + 0.3, 0, { seg: 4 }); }
  if (o.whiskers) { B(g, 0.26, 0.02, 0.02, 0xffffff, -0.24, hy - 0.04, 0.22); B(g, 0.26, 0.02, 0.02, 0xffffff, 0.24, hy - 0.04, 0.22); }
  if (o.tail) B(g, 0.1, 0.1, 0.5, o.hair ?? robe, 0, 0.7, -0.36, { rotX: -0.5 });
  if (o.topEyes) { B(g, 0.16, 0.16, 0.16, skin, -0.16, hy + 0.28, 0.04); B(g, 0.16, 0.16, 0.16, skin, 0.16, hy + 0.28, 0.04); B(g, 0.08, 0.08, 0.05, 0x141414, -0.16, hy + 0.3, 0.13); B(g, 0.08, 0.08, 0.05, 0x141414, 0.16, hy + 0.3, 0.13); }

  // hair
  if (o.hair && !o.mushroomCap) {
    B(g, hw + 0.04, 0.16, 0.5, o.hair, 0, hy + 0.27, hunch);
    if (o.longHair) B(g, hw + 0.06, 0.42, 0.16, o.hair, 0, hy - 0.1, -0.26);
    if (o.hairBun) B(g, 0.22, 0.22, 0.22, o.hair, 0, hy + 0.14, -0.3);
  }
  // beard
  if (o.beard === 'long') B(g, 0.36, 0.42, 0.14, o.beardColor ?? 0xe8e8e0, 0, hy - 0.28, 0.2 + hunch);
  else if (o.beard === 'short') B(g, 0.38, 0.16, 0.12, o.beardColor ?? 0x4a2f1a, 0, hy - 0.22, 0.22 + hunch);
  else if (o.beard === 'mustache') B(g, 0.3, 0.07, 0.08, o.beardColor ?? 0x3a2a1a, 0, hy - 0.1, 0.25 + hunch);

  // mushroom cap (replaces hair/hat)
  if (o.mushroomCap) {
    B(g, 0.9, 0.3, 0.9, o.mushroomCap, 0, hy + 0.34, 0); B(g, 0.7, 0.2, 0.7, o.mushroomCap, 0, hy + 0.54, 0);
    B(g, 0.14, 0.05, 0.14, 0xfff3e0, -0.22, hy + 0.5, 0.18); B(g, 0.12, 0.05, 0.12, 0xfff3e0, 0.2, hy + 0.46, -0.16); B(g, 0.1, 0.05, 0.1, 0xfff3e0, 0.26, hy + 0.5, 0.1);
  }

  hat(g, o, hy, hw);
  acc(g, o, skin, ax);

  // post-process: transparency (ghost) + shadow opt-out
  if (o.opacity != null) g.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = o.opacity; } });
  if (o.noShadow) g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  if (o.scale) g.scale.setScalar(o.scale);
  return g;
}

function hat(g, o, hy, hw) {
  const top = hy + 0.27, c = o.hatColor ?? 0x333333;
  switch (o.hat) {
    case 'pointy':
      B(g, hw + 0.18, 0.08, hw + 0.18, c, 0, top, 0);
      CONE(g, 0.3, 0.95, c, 0, top + 0.55, 0, { rotZ: 0.06, seg: 6 });
      break;
    case 'wide':
      B(g, hw + 0.5, 0.07, hw + 0.5, c, 0, top, 0);
      CONE(g, 0.26, 0.6, c, 0, top + 0.36, 0, { seg: 6 });
      break;
    case 'cap':
      B(g, hw + 0.04, 0.18, hw + 0.02, c, 0, top, 0);
      B(g, hw + 0.04, 0.05, 0.2, c, 0, top - 0.02, 0.28);
      if (o.feather) B(g, 0.05, 0.4, 0.05, o.feather, 0.22, top + 0.24, -0.02, { rotZ: -0.4 });
      break;
    case 'helm':
      B(g, hw + 0.06, 0.52, hw + 0.06, c, 0, hy + 0.02, 0, { metal: 0.7, rough: 0.4 });
      B(g, hw + 0.02, 0.07, 0.06, 0x101014, 0, hy + 0.02, 0.27); // visor slit
      if (o.plume) CONE(g, 0.1, 0.4, o.plume, 0, top + 0.3, -0.05, { seg: 5 });
      if (o.horns) { CONE(g, 0.09, 0.26, 0xeae0c8, -0.3, top + 0.1, 0, { rotZ: 0.5, seg: 5 }); CONE(g, 0.09, 0.26, 0xeae0c8, 0.3, top + 0.1, 0, { rotZ: -0.5, seg: 5 }); }
      break;
    case 'hood':
      B(g, hw + 0.12, 0.56, hw + 0.12, c, 0, hy + 0.04, -0.04);
      B(g, hw + 0.08, 0.5, 0.1, c, 0, hy + 0.02, 0.24); // brim shadowing the face
      break;
    case 'crown':
      B(g, hw + 0.02, 0.1, hw, c, 0, top, 0, { metal: 0.6, rough: 0.3, emis: darken(c, 0.4) });
      B(g, 0.06, 0.12, 0.06, c, 0, top + 0.1, 0.18, { metal: 0.6 }); B(g, 0.06, 0.1, 0.06, c, -0.18, top + 0.08, 0, { metal: 0.6 }); B(g, 0.06, 0.1, 0.06, c, 0.18, top + 0.08, 0, { metal: 0.6 });
      break;
    case 'scarf':
      B(g, hw + 0.06, 0.3, hw + 0.06, c, 0, top - 0.05, -0.02);
      B(g, 0.14, 0.34, 0.1, c, -0.28, hy - 0.04, 0.04); B(g, 0.14, 0.34, 0.1, c, 0.28, hy - 0.04, 0.04);
      break;
    default: break;
  }
}

function acc(g, o, skin, ax) {
  switch (o.acc) {
    case 'star': B(g, 0.12, 0.12, 0.08, 0xffe14a, 0, 2.55, 0, { emis: 0xffc83a, emisI: 1.6, rotZ: 0.6 }); break;
    case 'lute': B(g, 0.34, 0.5, 0.12, 0x8a5a2a, -0.34, 1.0, -0.28, { rotZ: 0.5 }); B(g, 0.06, 0.5, 0.06, 0x6a4420, -0.18, 1.32, -0.3, { rotZ: 0.5 }); break;
    case 'dagger': B(g, 0.05, 0.3, 0.05, 0xcfd6dd, ax + 0.06, 0.7, 0.06, { metal: 0.7, rough: 0.3 }); B(g, 0.1, 0.06, 0.06, 0x5a3a22, ax + 0.06, 0.86, 0.06); break;
    case 'cane': B(g, 0.05, 1.1, 0.05, 0x6a4a2a, ax + 0.1, 0.55, 0.12); B(g, 0.12, 0.06, 0.06, 0x8a6a44, ax + 0.07, 1.08, 0.12); break;
    case 'coin': B(g, 0.16, 0.16, 0.1, 0x6a4a2a, ax - 0.02, 0.62, 0.1); B(g, 0.08, 0.08, 0.04, 0xffd24a, ax - 0.02, 0.74, 0.13, { emis: 0x6a4a00 }); break;
    case 'tray': B(g, 0.34, 0.04, 0.26, 0x9a7a4a, ax + 0.14, 0.78, 0.18); B(g, 0.08, 0.12, 0.08, 0xe8c060, ax + 0.14, 0.86, 0.18); break;
    default: break;
  }
}

// a portrait model for the wisp guide: a glowing cyan orb with a halo and motes
// (matches the cutscene/pet wisp — core 0xdff4ff, halo 0x7fd0ff, motes 0xbfeaff)
function _wisp() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 18, 16),
    new THREE.MeshStandardMaterial({ color: 0xdff4ff, emissive: 0x9fe0ff, emissiveIntensity: 1.6, roughness: 0.3 })
  );
  core.position.y = 1.35; g.add(core);
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 14),
    new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  halo.position.y = 1.35; g.add(halo);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const mote = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0xbfeaff, emissiveIntensity: 1.2 })
    );
    mote.position.set(Math.cos(a) * 0.95, 1.35 + Math.sin(a * 2) * 0.4, Math.sin(a) * 0.5);
    g.add(mote);
  }
  return g;
}

// ===== the cast of unique models (each visually distinct + fun) =====
const KINDS = {
  // Wobblesworth's portrait mirrors the ACTUAL player rig (wizard.js): soft-purple
  // robe 0x8f7bd6, deep-purple hat 0x6f5fc4, white beard, red nose, blush, gold belt
  wizard: () => _human({ skin: 0xf2e0c9, robe: 0x8f7bd6, robe2: 0x6f5fc4, hat: 'pointy', hatColor: 0x6f5fc4, beard: 'long', beardColor: 0xf7f4ec, noseColor: 0xe06a55, cheeks: 0xe89a8a, belt: 0xffd98a, acc: 'star' }),
  // Barkeep Tomas' portrait mirrors his cutscene set model (cinematics.js:61-68)
  barkeep: () => _human({ skin: 0xf0c89a, robe: 0x6a4d34, apron: 0xd8c39a, beard: 'mustache', beardColor: 0x6a4326, hair: 0x6a4326, wide: true }),
  wisp: () => _wisp(),
  knight: () => _human({ skin: 0xeac49a, robe: 0x9aa3ad, robe2: 0x6f7780, metalBody: true, hat: 'helm', plume: 0xc83a3a }),
  witch: () => _human({ skin: 0x9fc27a, robe: 0x5a3a7a, hat: 'wide', hatColor: 0x281a3a, hair: 0x2a2030, longHair: true, noseColor: 0x7faa5a }),
  bard: () => _human({ skin: 0xeac49a, robe: 0x3a8a5a, hat: 'cap', hatColor: 0x2a6a44, feather: 0xffd24a, acc: 'lute', hair: 0x6b4423 }),
  goblin: () => _human({ skin: 0x6fb04a, robe: 0x6a5230, ears: true, tooth: true, scale: 0.82, noseColor: 0x5a9040, eyeColor: 0xffe08a }),
  dwarf: () => _human({ skin: 0xeac49a, robe: 0x7a4a2a, wide: true, scale: 0.92, beard: 'long', beardColor: 0xb5651d, hat: 'helm', hatColor: 0x8a8f96, horns: true }),
  frogfolk: () => _human({ skin: 0x6cae54, robe: 0x3a6a8a, topEyes: true, wideMouth: true, noseColor: 0x5a9040, nose: false }),
  mushroom: () => _human({ skin: 0xefe2c4, robe: 0x9a7a5a, mushroomCap: 0xcf3a3a, nose: false, scale: 0.9 }),
  catfolk: () => _human({ skin: 0xb89a6a, robe: 0x7a6fb0, catEars: true, tail: true, whiskers: true, hair: 0x8a7050, noseColor: 0xd98a72 }),
  ghost: () => _human({ skin: 0xeaf2ff, robe: 0xdfeaff, float: true, opacity: 0.72, glowEyes: true, eyeColor: 0x9fd8ff, nose: false, noShadow: true }),
  golem: () => _human({ skin: 0x8a8f86, robe: 0x6f746c, robe2: 0x565a54, wide: true, scale: 1.12, glowEyes: true, eyeColor: 0xffa23a, cracks: true, nose: false }),
  noble: () => _human({ skin: 0xf0d6b8, robe: 0xb83a5a, robe2: 0x8a2a44, hat: 'crown', hatColor: 0xffcf4a, hair: 0x3a2a1a, longHair: true, gown: true }),
  rogue: () => _human({ skin: 0x3a3030, robe: 0x3a4250, robe2: 0x2a3038, hat: 'hood', hatColor: 0x2a3038, glowEyes: true, eyeColor: 0xbfe0ff, acc: 'dagger', nose: false }),
  granny: () => _human({ skin: 0xe8c8a8, robe: 0x8a6f9a, hat: 'scarf', hatColor: 0xb06fa0, hunch: true, scale: 0.86, acc: 'cane' }),
  elder: () => _human({ skin: 0xe8c8a8, robe: 0x9a7a4a, beard: 'long', beardColor: 0xc8c8c8, hair: 0xc8c8c8, acc: 'cane', hunch: true }),
  merchant: () => _human({ skin: 0xeac49a, robe: 0x6a8a4a, hat: 'wide', hatColor: 0x8a6a3a, beard: 'short', acc: 'coin' }),
  barmaid: () => _human({ skin: 0xf0d6b8, robe: 0xcf6f8a, apron: 0xead6c0, hair: 0xb5651d, longHair: true, hairBun: true, acc: 'tray' }),
  // matches the tavern/cutscene patrons: hatless, beardless, periwinkle robe
  patron: () => _human({ skin: 0xf0d6b8, robe: 0x7a8bd0, noseColor: 0xd98a72 }),
};

export const CHAR_KINDS = Object.keys(KINDS);
export function buildCharModel(kind) { return (KINDS[kind] || KINDS.patron)(); }
function disposeModel(g) { g.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); }

// ===== offscreen portrait rig: render a model once to a small pixel dataURL (cached) =====
const _cache = new Map();
let _rig = null;
function ensureRig() {
  if (_rig) return _rig.ok ? _rig : null;
  _rig = { ok: false };
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 72;
    // preserveDrawingBuffer so toDataURL() is reliable regardless of compositing timing
    const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(72, 72); renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    cam.position.set(1.15, 1.55, 4.6); cam.lookAt(0, 1.2, 0); // full body incl. tall hats
    const key = new THREE.DirectionalLight(0xfff0d8, 2.2); key.position.set(2.5, 4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xbfe0ff, 0.9); rim.position.set(-2, 2, -2); scene.add(rim);
    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a2230, 1.0));
    _rig = { ok: true, renderer, scene, cam };
  } catch (e) { console.warn('portrait rig failed:', e); _rig = { ok: false }; }
  return _rig.ok ? _rig : null;
}

// pixel-art portrait dataURL for a character kind ('' on failure → caller keeps a 2D/emoji fallback)
export function charPortrait(kind) {
  if (_cache.has(kind)) return _cache.get(kind);
  let url = '';
  try {
    const rig = ensureRig();
    if (rig) {
      const model = buildCharModel(kind); model.rotation.y = 0.5; // 3/4 view
      rig.scene.add(model);
      rig.renderer.render(rig.scene, rig.cam);
      url = rig.renderer.domElement.toDataURL('image/png');
      rig.scene.remove(model); disposeModel(model);
    }
  } catch (e) { url = ''; }
  _cache.set(kind, url);
  return url;
}

// DOM convenience for dialogue: a pixelated <img> of the 3D model, falling back to the 2D
// canvas face, then to an emoji — so a portrait always shows something.
export function charImg(kind, seed, emoji, cls = '') {
  const url = charPortrait(kind);
  if (url) return `<img class="pixface ${cls}" src="${url}" alt="">`;
  return faceImg(seed || kind || 'patron', emoji, cls);
}
