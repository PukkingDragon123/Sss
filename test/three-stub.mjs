// Minimal Three.js + DOM stub so we can unit-test runmap.js graph generation
// in plain Node (no browser, no real three). Only the surface runmap.js touches.
class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { this.x = this.y = this.z = s; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  normalize() { const l = Math.hypot(this.x, this.y, this.z) || 1; return this.multiplyScalar(1 / l); }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  lerp() { return this; }
  lerpVectors() { return this; }
}
class Obj3D {
  constructor() { this.position = new Vec3(); this.rotation = new Vec3(); this.scale = new Vec3(1, 1, 1); this.quaternion = { setFromUnitVectors() {} }; this.children = []; this.userData = {}; this.visible = true; this.parent = null; }
  add(...o) { for (const c of o) { c.parent = this; this.children.push(c); } return this; }
  remove(o) { const i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
}
class Mesh extends Obj3D { constructor(geo, mat) { super(); this.isMesh = true; this.geometry = geo || { dispose() {} }; this.material = mat || {}; } }
class Sprite extends Obj3D { constructor(mat) { super(); this.material = mat || {}; } }
class Light extends Obj3D {}
class Geo { dispose() {} }
class Mat { constructor(o = {}) { Object.assign(this, o); this.color = { setHex() {} }; this.emissive = { setRGB() {}, setHex() {} }; } }

export const Group = Obj3D;
export { Mesh, Sprite, Vec3 as Vector3 };
export const Raycaster = class { setFromCamera() {} intersectObjects() { return []; } };
export const PointLight = Light;
export const CanvasTexture = class { constructor() { this.anisotropy = 0; } };
export const SpriteMaterial = Mat; export const MeshStandardMaterial = Mat; export const MeshBasicMaterial = Mat;
export const CylinderGeometry = Geo; export const TorusGeometry = Geo; export const PlaneGeometry = Geo;
export const BoxGeometry = Geo; export const SphereGeometry = Geo; export const ConeGeometry = Geo;
export const AdditiveBlending = 2; export const DoubleSide = 2;

// minimal DOM for iconSprite()'s canvas
globalThis.document = {
  createElement() {
    return { width: 0, height: 0, getContext() { return { font: '', textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0, fillText() {} }; } };
  },
};
