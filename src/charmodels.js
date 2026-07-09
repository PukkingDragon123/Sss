// charmodels.js — unique 3D "pixel" (voxel) character models, built from boxes/cones.
// Used two ways: (1) as the roaming tavern NPCs' bodies, and (2) rendered offscreen to a
// small pixel-art portrait dataURL for dialogue (replacing the old flat 2D faces).
// All procedural (no assets). The offscreen renderer is lazy + guarded; on any failure
// charPortrait returns '' and callers fall back to the 2D face / emoji.
import * as THREE from 'three';
import { faceImg } from './faces.js';
import { makeFace } from './facesprite.js';
import { outlineGroup } from './outline.js';
import { pxMap } from './pixeltex.js';

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

// round-primitive helpers (cute chibi look — flat-shaded so facets read chunky)
function S(g, r, color, x, y, z, o = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, flatShading: true,
    emissive: o.emis ?? 0x000000, emissiveIntensity: o.emisI ?? 1,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, o.seg ?? 10, o.seg2 ?? 8), mat);
  m.position.set(x, y, z);
  m.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  if (o.rotX) m.rotation.x = o.rotX; if (o.rotY) m.rotation.y = o.rotY; if (o.rotZ) m.rotation.z = o.rotZ;
  m.castShadow = true; g.add(m); return m;
}
function CAP(g, r, len, color, x, y, z, o = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, flatShading: true, emissive: o.emis ?? 0x000000 });
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat);
  m.position.set(x, y, z);
  if (o.rotX) m.rotation.x = o.rotX; if (o.rotY) m.rotation.y = o.rotY; if (o.rotZ) m.rotation.z = o.rotZ;
  m.castShadow = true; g.add(m); return m;
}
function CYL(g, rT, rB, h, color, x, y, z, o = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, flatShading: true, emissive: o.emis ?? 0x000000, emissiveIntensity: o.emisI ?? 1 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, o.seg ?? 12), mat);
  m.position.set(x, y, z);
  if (o.rotX) m.rotation.x = o.rotX; if (o.rotZ) m.rotation.z = o.rotZ;
  m.castShadow = true; g.add(m); return m;
}

// ---- the parametric humanoid that most characters derive from ----
// Round chibi build: big head, ball body, googly eyes — every NPC is a cute round thing.
function _human(o) {
  const g = new THREE.Group();
  const limbs = {}; // captured leg/arm/hand refs so the tavern can walk/sit/drink them
  const skin = o.skin ?? 0xf0d6b8, robe = o.robe ?? 0x7a8bd0, robe2 = o.robe2 ?? darken(robe);
  const bodyR = o.wide ? 0.52 : 0.44;
  const metal = o.metalBody ? { metal: 0.7, rough: 0.4 } : {};

  // lower body: ghost tail, gown skirt, or two round feet
  if (o.float) {
    S(g, bodyR * 0.72, robe, 0, 0.5, 0, { sy: 0.9 });
    S(g, bodyR * 0.5, robe, -0.08, 0.26, 0);
    S(g, bodyR * 0.34, robe, 0.1, 0.12, 0);
  } else if (o.gown) {
    CYL(g, bodyR * 0.7, bodyR * 1.3, 0.7, robe, 0, 0.36, 0);
  } else {
    limbs.legL = S(g, 0.14, o.pants ?? robe2, -0.18, 0.13, 0.02);
    limbs.legR = S(g, 0.14, o.pants ?? robe2, 0.18, 0.13, 0.02);
  }
  // torso: one friendly ball
  S(g, bodyR, robe, 0, 0.78, 0, { sy: 1.14, ...metal });
  if (o.apron) S(g, bodyR * 0.62, o.apron, 0, 0.74, bodyR * 0.62, { sy: 1.1, sz: 0.45 });
  if (o.belt) { const b = CYL(g, bodyR + 0.03, bodyR + 0.03, 0.1, o.belt, 0, 0.66, 0, { metal: 0.5, rough: 0.4, emis: 0x3a2c00 }); b.scale.z = 0.96; }
  if (o.cracks) { B(g, 0.05, 0.3, 0.04, darken(robe, 0.5), -0.1, 0.82, bodyR - 0.02); B(g, 0.05, 0.2, 0.04, darken(robe, 0.5), 0.14, 0.9, bodyR - 0.02, { rotZ: 0.4 }); }

  // stubby arms + ball hands
  const ax = bodyR + 0.06;
  limbs.armL = CAP(g, 0.09, 0.26, robe, -ax, 0.86, 0, { rotZ: 0.55, ...metal });
  limbs.armR = CAP(g, 0.09, 0.26, robe, ax, 0.86, 0, { rotZ: -0.55, ...metal });
  limbs.handL = S(g, 0.11, skin, -ax - 0.1, 0.66, 0.04);
  limbs.handR = S(g, 0.11, skin, ax + 0.1, 0.66, 0.04);

  // big round head (chibi ratio)
  const hunch = o.hunch ? 0.14 : 0;
  const hy = 1.58, hw = 0.5;
  const head = S(g, 0.5, skin, 0, hy, hunch, { sy: 0.95, seg: 12, seg2: 10 });
  if (o.hunch) head.rotation.x = 0.14;

  // goofy 2D face — dot eyes + brows + a per-person mouth (replaces all 3D face parts).
  // Without an explicit faceMood, the seed picks this character's resting expression.
  const _fseed = (((o.robe || 0) >> 3) ^ ((o.skin || 0) >> 5) ^ (o.hat ? o.hat.length : 0)) & 7;
  const _moods = ['happy', 'neutral', 'grumpy', 'happy', 'surprised', 'happy', 'neutral', 'grumpy'];
  const _fmood = o.faceMood || (o.mad ? 'grumpy' : (o.glowEyes ? 'surprised' : _moods[_fseed]));
  const face = makeFace(0.64, _fmood, _fseed); face.position.set(0, hy, 0.51 + hunch); g.add(face);

  // ears / cat ears / tail (identity kept; face features now live on the 2D sprite)
  if (o.ears) { CONE(g, 0.1, 0.3, skin, -0.5, hy + 0.08, 0, { rotZ: 1.25, seg: 6 }); CONE(g, 0.1, 0.3, skin, 0.5, hy + 0.08, 0, { rotZ: -1.25, seg: 6 }); }
  if (o.catEars) { CONE(g, 0.13, 0.24, o.hair ?? skin, -0.2, hy + 0.44, 0, { seg: 5 }); CONE(g, 0.13, 0.24, o.hair ?? skin, 0.2, hy + 0.44, 0, { seg: 5 }); }
  if (o.tail) { S(g, 0.1, o.hair ?? robe, 0, 0.6, -bodyR - 0.12); S(g, 0.08, o.hair ?? robe, 0.06, 0.78, -bodyR - 0.26); }

  // hair: a round mop hugging the head
  if (o.hair && !o.mushroomCap) {
    S(g, 0.52, o.hair, 0, hy + 0.12, -0.06 + hunch, { sy: 0.72, seg: 10, seg2: 8 });
    if (o.longHair) CAP(g, 0.2, 0.4, o.hair, 0, hy - 0.28, -0.34 + hunch);
    if (o.hairBun) S(g, 0.2, o.hair, 0, hy + 0.22, -0.42 + hunch);
  }
  // beards: soft cones & tufts
  if (o.beard === 'long') CONE(g, 0.3, 0.56, o.beardColor ?? 0xe8e8e0, 0, hy - 0.5, 0.24 + hunch, { rotX: -0.22, seg: 9 });
  else if (o.beard === 'short') S(g, 0.24, o.beardColor ?? 0x4a2f1a, 0, hy - 0.32, 0.3 + hunch, { sy: 0.55 });
  else if (o.beard === 'mustache') { S(g, 0.12, o.beardColor ?? 0x3a2a1a, -0.11, hy - 0.16, 0.44 + hunch, { sy: 0.5 }); S(g, 0.12, o.beardColor ?? 0x3a2a1a, 0.11, hy - 0.16, 0.44 + hunch, { sy: 0.5 }); }

  // mushroom cap (replaces hair/hat)
  if (o.mushroomCap) {
    S(g, 0.66, o.mushroomCap, 0, hy + 0.34, 0, { sy: 0.6, seg: 12, seg2: 8 });
    S(g, 0.09, 0xfff3e0, -0.26, hy + 0.5, 0.26); S(g, 0.08, 0xfff3e0, 0.24, hy + 0.46, -0.2); S(g, 0.07, 0xfff3e0, 0.32, hy + 0.52, 0.12);
  }

  hat(g, o, hy, hw);
  acc(g, o, skin, ax);

  // post-process: transparency (ghost) + shadow opt-out
  if (o.opacity != null) g.traverse(m => { if (m.material) { m.material.transparent = true; m.material.opacity = o.opacity; } });
  if (o.noShadow) g.traverse(m => { if (m.isMesh) m.castShadow = false; });
  // stand taller than the old squat chibi — a touch bigger and noticeably taller (adult-ish)
  const s = o.scale ?? 1; g.scale.set(s * 1.06, s * 1.26, s * 1.06);
  g.userData.limbs = limbs; // { legL, legR, armL, armR, handL, handR } for walk/sit/drink anim
  return g;
}

function hat(g, o, hy, hw) {
  const top = hy + 0.34, c = o.hatColor ?? 0x333333;
  switch (o.hat) {
    case 'pointy':
      CYL(g, 0.56, 0.62, 0.09, c, 0, top, 0);
      CONE(g, 0.34, 0.95, c, 0, top + 0.5, 0, { rotZ: 0.08, seg: 9 });
      break;
    case 'wide':
      CYL(g, 0.74, 0.8, 0.07, c, 0, top, 0);
      CONE(g, 0.28, 0.55, c, 0, top + 0.3, 0, { seg: 9 });
      break;
    case 'cap':
      S(g, 0.52, c, 0, top - 0.04, 0, { sy: 0.5, seg: 10, seg2: 6 });
      CYL(g, 0.2, 0.24, 0.05, c, 0, top - 0.02, 0.4, { rotX: 0.12 });
      if (o.feather) CAP(g, 0.035, 0.3, o.feather, 0.24, top + 0.24, -0.02, { rotZ: -0.45 });
      break;
    case 'helm':
      S(g, 0.56, c, 0, hy + 0.06, 0, { sy: 0.92, metal: 0.7, rough: 0.4, seg: 12, seg2: 8 });
      B(g, 0.6, 0.08, 0.06, 0x101014, 0, hy + 0.04, 0.46); // visor slit
      if (o.plume) CONE(g, 0.1, 0.4, o.plume, 0, top + 0.34, -0.05, { seg: 5 });
      if (o.horns) { CONE(g, 0.09, 0.3, 0xeae0c8, -0.5, top, 0, { rotZ: 0.7, seg: 6 }); CONE(g, 0.09, 0.3, 0xeae0c8, 0.5, top, 0, { rotZ: -0.7, seg: 6 }); }
      break;
    case 'hood':
      S(g, 0.58, c, 0, hy + 0.04, -0.05, { sy: 1.02, seg: 12, seg2: 8 });
      CYL(g, 0.5, 0.52, 0.14, c, 0, hy + 0.02, 0.18, { rotX: 1.35 }); // brim shading the face
      break;
    case 'crown':
      CYL(g, 0.34, 0.36, 0.16, c, 0, top + 0.02, 0, { metal: 0.6, rough: 0.3, emis: darken(c, 0.4) });
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; CONE(g, 0.06, 0.14, c, Math.cos(a) * 0.3, top + 0.14, Math.sin(a) * 0.3, { seg: 5 }); }
      S(g, 0.06, 0xff3a5a, 0, top + 0.08, 0.34, { emis: 0x6a0a1a, emisI: 0.9 });
      break;
    case 'scarf':
      CYL(g, 0.54, 0.56, 0.24, c, 0, top - 0.1, 0);
      CAP(g, 0.1, 0.24, c, -0.34, hy - 0.16, 0.08, { rotZ: 0.3 }); CAP(g, 0.1, 0.24, c, 0.34, hy - 0.16, 0.08, { rotZ: -0.3 });
      break;
    default: break;
  }
}

function acc(g, o, skin, ax) {
  switch (o.acc) {
    case 'star': S(g, 0.1, 0xffe14a, 0, 2.62, 0, { emis: 0xffc83a, emisI: 1.6 }); break;
    case 'lute': S(g, 0.2, 0x8a5a2a, -0.4, 0.9, -0.3, { sy: 1.3, sz: 0.5 }); CYL(g, 0.03, 0.03, 0.5, 0x6a4420, -0.28, 1.24, -0.32, { rotZ: 0.5 }); break;
    case 'dagger': CAP(g, 0.03, 0.22, 0xcfd6dd, ax + 0.08, 0.72, 0.06, { metal: 0.7, rough: 0.3 }); S(g, 0.06, 0x5a3a22, ax + 0.08, 0.88, 0.06); break;
    case 'cane': CYL(g, 0.03, 0.04, 1.0, 0x6a4a2a, ax + 0.12, 0.52, 0.12); S(g, 0.07, 0x8a6a44, ax + 0.12, 1.04, 0.12); break;
    case 'coin': S(g, 0.12, 0x6a4a2a, ax - 0.02, 0.6, 0.1); CYL(g, 0.07, 0.07, 0.03, 0xffd24a, ax - 0.02, 0.74, 0.12, { rotX: 0.3, emis: 0x6a4a00 }); break;
    case 'tray': CYL(g, 0.2, 0.2, 0.03, 0x9a7a4a, ax + 0.16, 0.78, 0.18); CYL(g, 0.05, 0.06, 0.12, 0xe8c060, ax + 0.16, 0.86, 0.18); break;
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
  wizard: () => _human({ skin: 0xf2e0c9, robe: 0x8f7bd6, robe2: 0x6f5fc4, hat: 'pointy', hatColor: 0x6f5fc4, beard: 'long', beardColor: 0xf7f4ec, noseColor: 0xe06a55, cheeks: 0xe89a8a, belt: 0xffd98a, acc: 'star', faceMood: 'happy' }),
  // Barkeep Tomas — the SAME model stands in the cutscene bar now (grumpy: he scolds you)
  barkeep: () => _human({ skin: 0xf0c89a, robe: 0x6a4d34, apron: 0xd8c39a, beard: 'mustache', beardColor: 0x6a4326, hair: 0x6a4326, wide: true, faceMood: 'grumpy' }),
  wisp: () => _wisp(),
  knight: () => _human({ skin: 0xeac49a, robe: 0x7f93b8, robe2: 0x55637e, metalBody: true, hat: 'helm', hatColor: 0x8a97ac, plume: 0xd8434d, belt: 0xd9a84a }),
  witch: () => _human({ skin: 0x8fb868, robe: 0x46285e, robe2: 0x2e1a40, hat: 'wide', hatColor: 0x201432, hair: 0x231b2c, longHair: true, noseColor: 0x6f9a4e, belt: 0xc9a24a }),
  bard: () => _human({ skin: 0xeac49a, robe: 0x2f8a8a, robe2: 0x1f5f60, hat: 'cap', hatColor: 0x22646a, feather: 0xffd24a, acc: 'lute', hair: 0x6b4423, belt: 0x8a5a2a }),
  goblin: () => _human({ skin: 0x6fb04a, robe: 0x6a5230, ears: true, tooth: true, scale: 0.82, noseColor: 0x5a9040, eyeColor: 0xffe08a }),
  dwarf: () => _human({ skin: 0xeac49a, robe: 0x7a4a2a, wide: true, scale: 0.92, beard: 'long', beardColor: 0xb5651d, hat: 'helm', hatColor: 0x8a8f96, horns: true }),
  frogfolk: () => _human({ skin: 0x6cae54, robe: 0x3a6a8a, topEyes: true, wideMouth: true, noseColor: 0x5a9040, nose: false }),
  mushroom: () => _human({ skin: 0xefe2c4, robe: 0x9a7a5a, mushroomCap: 0xcf3a3a, nose: false, scale: 0.9 }),
  catfolk: () => _human({ skin: 0xb89a6a, robe: 0x7a6fb0, catEars: true, tail: true, whiskers: true, hair: 0x8a7050, noseColor: 0xd98a72 }),
  ghost: () => _human({ skin: 0xeaf2ff, robe: 0xdfeaff, float: true, opacity: 0.72, glowEyes: true, eyeColor: 0x9fd8ff, nose: false, noShadow: true }),
  golem: () => _human({ skin: 0x8a8f86, robe: 0x6f746c, robe2: 0x565a54, wide: true, scale: 1.12, glowEyes: true, eyeColor: 0xffa23a, cracks: true, nose: false }),
  noble: () => _human({ skin: 0xf0d6b8, robe: 0xa62a4e, robe2: 0x741a36, hat: 'crown', hatColor: 0xffcf4a, hair: 0x2c1f14, longHair: true, gown: true, belt: 0xffcf4a, cheeks: 0xe89a8a }),
  rogue: () => _human({ skin: 0x2e2828, robe: 0x272e3a, robe2: 0x1a2029, hat: 'hood', hatColor: 0x1e242e, glowEyes: true, eyeColor: 0x7fe8d0, acc: 'dagger', nose: false, belt: 0x4a5568 }),
  granny: () => _human({ skin: 0xe8c8a8, robe: 0x8a6f9a, hat: 'scarf', hatColor: 0xb06fa0, hunch: true, scale: 0.86, acc: 'cane' }),
  elder: () => _human({ skin: 0xe8c8a8, robe: 0x9a7a4a, beard: 'long', beardColor: 0xc8c8c8, hair: 0xc8c8c8, acc: 'cane', hunch: true }),
  merchant: () => _human({ skin: 0xeac49a, robe: 0x5d8038, robe2: 0x415c24, hat: 'wide', hatColor: 0x7a5a30, beard: 'short', acc: 'coin', belt: 0xd9a84a, wide: true }),
  barmaid: () => _human({ skin: 0xf0d6b8, robe: 0xcf6f8a, apron: 0xead6c0, hair: 0xb5651d, longHair: true, hairBun: true, acc: 'tray' }),
  // matches the tavern/cutscene patrons: hatless, beardless, periwinkle robe
  patron: () => _human({ skin: 0xf0d6b8, robe: 0x7a8bd0, noseColor: 0xd98a72 }),
};

export const CHAR_KINDS = Object.keys(KINDS);

// stamp a subtle pixel-art grain on the solid materials, then add a Megabonk ink outline
function _dress(g) {
  g.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || o.userData.noTex) return;
    const m = o.material;
    if (m && m.isMeshStandardMaterial && !m.map && !m.transparent) pxMap(m, m.metalness > 0.3 ? 'metal' : 'cloth', 2);
  });
  outlineGroup(g, { thick: 0.045 });
  return g;
}
export function buildCharModel(kind) {
  const g = (KINDS[kind] || KINDS.patron)();
  const out = kind === 'wisp' ? g : _dress(g); // the wisp is a glowing orb — no ink outline / grain
  out.userData._dressed = true; // grained + outlined already — tavern's re-texturize guard skips it
  return out;
}
// dispose a built model WITHOUT killing shared resources (the cached outline material &
// the singleton pixel-art textures, both flagged so they survive per-model teardown)
function disposeModel(g) {
  g.traverse((m) => {
    if (m.userData.isOutline) return;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material;
    if (mat && !mat.userData.outline) { if (mat.map && !mat.map.userData?.keep) mat.map.dispose(); mat.dispose(); }
  });
}

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
