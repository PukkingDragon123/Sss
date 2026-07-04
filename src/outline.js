// outline.js — Megabonk-style ink outlines via the inverted-hull trick.
//
// For each mesh we add a CHILD mesh that shares the SAME geometry, drawn back-faces-only
// in near-black and pushed outward a hair. The front mesh covers the middle, leaving a
// crisp dark contour around the silhouette. Because the outline is a child sharing the
// geometry, it inherits every bit of the parent's animation for free (verlet arm swings,
// squash-and-stretch, spins) and costs no extra geometry memory.
//
// The push is along `normalize(localPosition)` (falling back to the normal), NOT the raw
// vertex normal. Our models are built from origin-centred primitives (spheres, cones,
// cylinders, capsules, icospheres), so the position direction is CONTINUOUS across hard
// flat-shaded facets — no split/cracked outline at the edges the way per-face normals give.
import * as THREE from 'three';

const _matCache = new Map(); // "color@thick" -> material

// A back-face hull material. `thick` is a local-space offset; our characters are all a
// similar ~2u tall, so one value reads consistently across them.
export function outlineMaterial(color = 0x0b0a12, thick = 0.04) {
  const key = color + '@' + thick;
  let m = _matCache.get(key); if (m) return m;
  m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.fog = true;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uThick = { value: thick };
    shader.vertexShader = 'uniform float uThick;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vec3 oDir = length(position) > 1e-4 ? normalize(position) : normalize(normal);\n  transformed += oDir * uThick;'
    );
  };
  m.userData.outline = true;
  _matCache.set(key, m); return m;
}

// Add a single outline twin to `mesh`. Safe to call once per mesh.
export function addOutline(mesh, { color, thick = 0.04 } = {}) {
  if (!mesh || !mesh.geometry || mesh.userData.hasOutline) return null;
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(color, thick));
  o.userData.isOutline = true;
  o.castShadow = false; o.receiveShadow = false;
  o.renderOrder = (mesh.renderOrder || 0) - 1;
  mesh.userData.hasOutline = true;
  mesh.add(o);
  return o;
}

// Walk a built model and outline every solid mesh in it. Skips FX (transparent/basic
// glow) meshes, existing outlines, and anything flagged `userData.noOutline`. Collects
// targets FIRST so we never traverse into the outlines we're adding.
export function outlineGroup(root, { color, thick = 0.04, filter } = {}) {
  if (!root) return root;
  const targets = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || o.userData.noOutline || o.userData.hasOutline) return;
    const m = o.material;
    if (!m || Array.isArray(m) || m.transparent || m.userData.outline) return;
    if (filter && !filter(o)) return;
    targets.push(o);
  });
  for (const o of targets) addOutline(o, { color, thick });
  return root;
}
