// world.js — the 3D top-down WORLD MAP of the realm, in full pixel-art style.
// Eight themed islands rise off a living sea: animated pixel water, drifting
// clouds with shadows, circling gulls, a little sailing boat, a glowing moon,
// stepping-stone routes that pulse toward your next conquest, waving victory
// flags, and a unique landmark on every island. Same primitives-only rules.
import * as THREE from 'three';
import { STAGE_ORDER, STAGES } from './story.js';
import { iconCanvas } from './pixelicons.js';
import { pxMap } from './pixeltex.js';

// where each region sits on the overworld + how it looks
const LAYOUT = {
  forest:    { x: -17, z: 8,   tone: 0x4f9e6a, icon: '🌲', deco: 'tree' },
  cave:      { x: -10, z: -3,  tone: 0x9a7a3a, icon: '🦇', deco: 'rock' },
  graveyard: { x: -2,  z: 8,   tone: 0x7a8aa8, icon: '⚰️', deco: 'grave' },
  swamp:     { x: 5,   z: -4,  tone: 0x5f8a4a, icon: '🐊', deco: 'swamp' },
  frost:     { x: 12,  z: 7,   tone: 0x9fd0ef, icon: '❄️', deco: 'ice' },
  inferno:   { x: 18,  z: -3,  tone: 0xd4541f, icon: '🔥', deco: 'lava' },
  clockwork: { x: 10,  z: -12, tone: 0x3fc0e0, icon: '🤖', deco: 'tech' },
  void:      { x: 1,   z: -13, tone: 0x9a6fd0, icon: '🌌', deco: 'void' },
};

// a floating map icon built from OUR pixel sprites (no emoji): the sprite canvas is
// drawn centred with a soft drop shadow so it pops against the sea
function iconSprite(key, px = 96) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const spr = iconCanvas(key, { scale: 6 });
  if (spr) {
    x.imageSmoothingEnabled = false;
    x.shadowColor = 'rgba(0,0,0,0.55)'; x.shadowBlur = 0; x.shadowOffsetY = 5;
    x.drawImage(spr, (128 - px) / 2, (128 - px) / 2 + 4, px, px);
  }
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(2.4, 2.4, 2.4); return s;
}
function labelSprite(text, tone) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 72;
  const x = c.getContext('2d');
  x.font = 'bold 32px "Trebuchet MS",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  // heavy dark outline + parchment fill + a tone underline — readable over any island
  x.lineWidth = 7; x.strokeStyle = 'rgba(8,5,14,0.95)'; x.strokeText(text, 128, 36);
  x.fillStyle = '#f6ecd2'; x.fillText(text, 128, 36);
  const w = Math.min(230, x.measureText(text).width + 14);
  x.fillStyle = tone; x.fillRect(128 - w / 2, 56, w, 6);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(7, 2, 1); return s;
}
const hx = (n) => '#' + ('000000' + n.toString(16)).slice(-6);

// hand-scattered stylized water: layered wave strokes on a finer canvas with smooth
// filtering — clean low-poly-adjacent look rather than chunky pixels
function seaTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#14304e'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#112741';
  for (let i = 0; i < 46; i++) { const w = 8 + ((Math.random() * 14) | 0); x.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, w, 3); }
  x.fillStyle = '#1e4468';
  for (let i = 0; i < 40; i++) { const w = 7 + ((Math.random() * 10) | 0); x.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, w, 2); }
  x.fillStyle = 'rgba(79,158,207,0.9)';
  for (let i = 0; i < 22; i++) x.fillRect((Math.random() * 128) | 0, (Math.random() * 128) | 0, 5, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(6, 5);
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this._ray = new THREE.Raycaster();
    this._t = 0; this._hover = -1; this._built = false;
    this.center = new THREE.Vector3(0, 0, -1.5);
    this.order = STAGE_ORDER.filter(id => LAYOUT[id] && STAGES[id]);
  }

  build() {
    if (this._built) return;
    const g = this.group;
    const M = (c, r = 0.9, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: o.metal || 0, emissive: o.emis || 0x000000, emissiveIntensity: o.emisI != null ? o.emisI : 1, flatShading: true });

    // ---- the living pixel sea ----
    this._seaTex = seaTexture();
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(96, 76), new THREE.MeshStandardMaterial({ map: this._seaTex, color: 0xffffff, roughness: 0.65, metalness: 0.15, emissive: 0x0a1c30, emissiveIntensity: 0.55 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.4, -1.5); sea.receiveShadow = true; g.add(sea); this._sea = sea;

    // ---- the mainland: a layered pixel "cake" — grass, sand beach, dark shore ----
    const landG = new THREE.Mesh(new THREE.CircleGeometry(30, 48), M(0x35543e, 1));
    landG.rotation.x = -Math.PI / 2; landG.position.set(0, -0.13, -1.5); landG.scale.set(1.25, 1, 0.95); landG.receiveShadow = true; g.add(landG);
    const sand = new THREE.Mesh(new THREE.CircleGeometry(31.2, 48), M(0xc9b077, 1));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.22, -1.5); sand.scale.set(1.25, 1, 0.95); sand.receiveShadow = true; g.add(sand);
    const shore = new THREE.Mesh(new THREE.CircleGeometry(32.4, 48), M(0x2c4056, 1));
    shore.rotation.x = -Math.PI / 2; shore.position.set(0, -0.3, -1.5); shore.scale.set(1.25, 1, 0.95); g.add(shore);
    // breathing foam line hugging the beach
    const foam = new THREE.Mesh(new THREE.RingGeometry(31.4, 32.2, 64), new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(0, -0.21, -1.5); foam.scale.set(1.25, 1, 0.95); g.add(foam); this._foam = foam;

    // ---- a pixel moon + soft halo, low over the horizon ----
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf5eeda }));
    moon.position.set(-30, 9, -26); g.add(moon);
    const moonGlow = new THREE.Mesh(new THREE.SphereGeometry(4.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xcfd8ea, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    moonGlow.position.copy(moon.position); g.add(moonGlow);

    // drifting fireflies / motes for atmosphere
    this._motes = [];
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), moteMat);
      const ang = Math.random() * 6.28, rad = 6 + Math.random() * 22;
      m.position.set(Math.cos(ang) * rad, 0.6 + Math.random() * 3, -1.5 + Math.sin(ang) * rad * 0.8);
      m.userData = { base: m.position.y, sp: 0.3 + Math.random() * 0.5, ph: Math.random() * 6.28 };
      g.add(m); this._motes.push(m);
    }
    // shared glowing-red "lurker eyes" material (pulsed in update)
    this._eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a18, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });

    // ---- stepping-stone routes between islands, pulsing toward the frontier ----
    this._routes = [];
    for (let i = 0; i < this.order.length - 1; i++) {
      const a = LAYOUT[this.order[i]], b = LAYOUT[this.order[i + 1]];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      const n = Math.max(4, Math.round(len / 1.35));
      const dots = [];
      const mat = new THREE.MeshBasicMaterial({ color: 0xf2dfae, transparent: true, opacity: 0.7 });
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 8), mat);
        dot.position.set(a.x + dx * t + Math.sin(t * 9 + i) * 0.5, 0.06, a.z + dz * t + Math.cos(t * 7 + i) * 0.5);
        g.add(dot); dots.push(dot);
      }
      this._routes.push({ toIdx: i + 1, dots, mat });
    }

    // ---- the eight islands ----
    this._views = []; this._hitMeshes = [];
    for (let i = 0; i < this.order.length; i++) {
      const id = this.order[i], L = LAYOUT[id], s = STAGES[id];
      const view = new THREE.Group(); view.position.set(L.x, 0, L.z);
      // layered platform: dirt base, sand lip, themed grass top
      const dirt = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.9, 0.5, 22), M(0x5a4630, 1));
      dirt.position.y = -0.12; dirt.castShadow = dirt.receiveShadow = true; view.add(dirt);
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.5, 0.2, 22), M(0xc9b077, 1));
      lip.position.y = 0.2; view.add(lip);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.4, 0.5, 22), M(L.tone, 0.85));
      base.position.y = 0.5; base.castShadow = base.receiveShadow = true; view.add(base);
      this._deco(view, L.deco, L.tone);
      // lurking red eyes peering out from the region (something waits in there…)
      const eyes = new THREE.Group();
      const spots = [[-1.8, 1.5], [1.8, 1.3], [0, -1.9], [-1.6, -1.4]];
      const pairs = 2 + (i % 2);
      for (let k = 0; k < pairs; k++) { const [ex, ez] = spots[k % spots.length]; for (const dx of [-0.17, 0.17]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), this._eyeMat); eye.position.set(ex + dx, 0.95, ez); eyes.add(eye); } }
      eyes.visible = false; view.add(eyes);
      const icon = iconSprite(L.icon); icon.position.y = 3.4; view.add(icon);
      const lock = iconSprite('🔒', 80); lock.position.y = 3.4; lock.visible = false; view.add(lock);
      // victory flag: pole + a waving pixel banner, planted when the boss falls
      const flag = new THREE.Group(); flag.position.set(1.9, 0.7, 1.3);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6), M(0x6a4a2a, 0.9)); pole.position.y = 1.3; pole.castShadow = true; flag.add(pole);
      const bannerMat = M(0xffcf5c, 0.8, { emis: 0x4a3400, emisI: 0.6 }); bannerMat.side = THREE.DoubleSide;
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.62, 4, 1), bannerMat);
      banner.position.set(0.62, 2.25, 0); flag.add(banner);
      flag.visible = false; view.add(flag);
      const label = labelSprite(`${i + 1}. ${s.name}`, hx(L.tone)); label.position.y = 1.15; view.add(label);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 7, 10, 1, true), new THREE.MeshBasicMaterial({ color: L.tone, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
      beam.position.y = 3.8; view.add(beam);
      const sel = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.16, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      sel.rotation.x = -Math.PI / 2; sel.position.y = 0.55; sel.visible = false; view.add(sel);
      // a bouncing "you are here" pointer over the selected island
      const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
      ptr.rotation.x = Math.PI; ptr.position.y = 4.8; ptr.visible = false; view.add(ptr);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 4.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 1.6; hit.userData.id = id; view.add(hit);
      g.add(view);
      this._hitMeshes.push(hit);
      this._views.push({ id, view, icon, lock, flag, banner, beam, sel, ptr, base, eyes });
    }

    // ---- a forest scattered across the mainland (beyond the island props) ----
    const treeMat = M(0x274d30, 0.9), trunkMat = M(0x3a2a1e, 0.9), rockMat = M(0x4a4438, 1);
    const onIsland = (x, z) => this.order.some(id => { const L = LAYOUT[id]; return (x - L.x) ** 2 + (z - L.z) ** 2 < 20; });
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * 6.28, rad = 7 + Math.random() * 21;
      const x = Math.cos(ang) * rad * 1.15, z = -1.5 + Math.sin(ang) * rad * 0.82;
      if (onIsland(x, z)) continue;
      if (Math.random() < 0.78) {
        const t = new THREE.Group();
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.7, 5), trunkMat); tr.position.y = 0.35; tr.castShadow = true;
        const lf = new THREE.Mesh(new THREE.ConeGeometry(0.45 + Math.random() * 0.3, 1.0 + Math.random() * 0.6, 6), treeMat); lf.position.y = 1.05; lf.castShadow = true;
        t.add(tr, lf); t.position.set(x, -0.12, z); g.add(t);
      } else {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 + Math.random() * 0.3, 0), rockMat); r.position.set(x, 0.05, z); r.castShadow = true; g.add(r);
      }
    }

    // ---- roaming monsters prowling the overworld (dark bodies, glowing red eyes) ----
    this._mobs = [];
    const mobMat = M(0x1a1420, 0.9);
    for (let i = 0; i < 11; i++) {
      const m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), mobMat); body.scale.set(1, 0.78, 1.12); body.position.y = 0.42; body.castShadow = true; m.add(body);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 6), mobMat); ear.position.set(0, 0.78, -0.05); m.add(ear);
      for (const dx of [-0.13, 0.13]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), this._eyeMat); e.position.set(dx, 0.5, 0.34); m.add(e); }
      const ang = Math.random() * 6.28, rad = 6 + Math.random() * 17;
      m.position.set(Math.cos(ang) * rad * 1.1, -0.1, -1.5 + Math.sin(ang) * rad * 0.8);
      m.userData = { vx: (Math.random() - 0.5) * 1.1, vz: (Math.random() - 0.5) * 1.1, ph: Math.random() * 6.28 };
      g.add(m); this._mobs.push(m);
    }

    // ---- puffy pixel clouds sailing over the realm (with soft ground shadows) ----
    this._clouds = [];
    for (let i = 0; i < 5; i++) {
      const cl = new THREE.Group();
      const cm = new THREE.MeshBasicMaterial({ color: 0xe8eef6, transparent: true, opacity: 0.8 });
      const n = 3 + (i % 2);
      for (let k = 0; k < n; k++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + Math.random() * 0.8, 0), cm);
        puff.position.set(k * 1.1 - n * 0.5, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.2);
        puff.scale.y = 0.55; cl.add(puff);
      }
      const sh = new THREE.Mesh(new THREE.CircleGeometry(1.7 + n * 0.3, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; cl.userData = { shadow: sh, speed: 0.5 + Math.random() * 0.5 };
      g.add(sh);
      cl.position.set(-34 + Math.random() * 68, 6.5 + Math.random() * 2, -14 + Math.random() * 22);
      g.add(cl); this._clouds.push(cl);
    }

    // ---- gulls circling the bay ----
    this._birds = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Group();
      const wMat = new THREE.MeshBasicMaterial({ color: 0xdfe6ee });
      const wL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.14), wMat); wL.position.x = -0.26;
      const wR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.14), wMat); wR.position.x = 0.26;
      b.add(wL, wR); b.userData = { wL, wR, r: 10 + i * 6, sp: 0.25 + i * 0.06, ph: i * 2.1, h: 4.6 + i * 0.8 };
      g.add(b); this._birds.push(b);
    }

    // ---- a little sailing boat tacking around the isle ----
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.6), M(0x6a4526, 0.85)); hull.position.y = 0.1; hull.castShadow = true; boat.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 4), M(0x6a4526, 0.85)); bow.rotation.z = -Math.PI / 2; bow.position.set(0.95, 0.1, 0); boat.add(bow);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), M(0x4a3020, 0.9)); mast.position.y = 0.9; boat.add(mast);
    const sailMat = M(0xefe6cf, 0.85); sailMat.side = THREE.DoubleSide;
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.05, 3, 1), sailMat); sail.position.set(-0.5, 1.0, 0); boat.add(sail);
    boat.userData = { sail };
    g.add(boat); this._boat = boat;

    // pixel-art grain on every island prop (chosen by hue; sea/glow/transparent skipped)
    g.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline || !o.material || !o.material.isMeshStandardMaterial) return;
      const m = o.material; if (m.map || m.transparent || (m.emissiveIntensity || 0) >= 0.4) return;
      const c = m.color;
      const tk = m.metalness > 0.35 ? 'metal'
        : (c.g > c.r && c.g > c.b) ? 'leaf'
        : (c.r > 0.32 && c.b < c.r * 0.85) ? 'wood'
        : (Math.abs(c.r - c.g) < 0.09 && Math.abs(c.g - c.b) < 0.09) ? 'stone'
        : 'cloth';
      pxMap(m, tk, 2);
    });

    this._built = true;
  }

  // themed island landmarks — every region gets a proper centrepiece + set dressing
  _deco(view, kind, tone) {
    const M = (c, r = 0.9, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: o.metal || 0, emissive: o.emis || 0x000000, emissiveIntensity: o.emisI != null ? o.emisI : 1, flatShading: true });
    const add = (m, x, z, y) => { m.position.set(x, y != null ? y : m.position.y, z); m.castShadow = true; view.add(m); return m; };
    const TOP = 0.75; // island surface height
    const tree = (x, z, s = 1) => { const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 0.9 * s, 6), M(0x4a3326)); tr.position.y = 0.45 * s; tr.castShadow = true; const l1 = new THREE.Mesh(new THREE.ConeGeometry(0.65 * s, 1.2 * s, 7), M(0x2f6e3f)); l1.position.y = 1.25 * s; l1.castShadow = true; const l2 = new THREE.Mesh(new THREE.ConeGeometry(0.45 * s, 0.9 * s, 7), M(0x3a824a)); l2.position.y = 1.85 * s; t.add(tr, l1, l2); t.position.set(x, TOP, z); view.add(t); return t; };

    if (kind === 'tree') {
      tree(0, 0.2, 1.5); tree(-1.6, 0.9, 1.0); tree(1.4, -0.9, 0.9); tree(0.6, 1.5, 0.75);
      const shroom = new THREE.Group();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.26, 6), M(0xe8e0cc)); st.position.y = 0.13;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0xc0556a, 0.8, { emis: 0x3a0a14, emisI: 0.5 })); cap.position.y = 0.26;
      shroom.add(st, cap); shroom.position.set(-1.2, TOP, -1.2); view.add(shroom);
    } else if (kind === 'rock') {
      // a cave mouth: two pillars + lintel, black opening
      add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), M(0x6a5a44, 1)), -0.8, 0, TOP + 0.8);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), M(0x6a5a44, 1)), 0.8, 0, TOP + 0.8);
      add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.7), M(0x7a6a50, 1)), 0, 0, TOP + 1.85);
      add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.25, 0.2), M(0x0a0806, 1)), 0, 0.15, TOP + 0.62);
      const cr = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 5), M(0x6fd0e8, 0.3, { emis: 0x2a7a8a, emisI: 0.8 })); add(cr, -1.7, -1.0, TOP + 0.35).rotation.z = 0.2;
      const cr2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 5), M(0x6fd0e8, 0.3, { emis: 0x2a7a8a, emisI: 0.8 })); add(cr2, 1.6, -1.1, TOP + 0.25).rotation.z = -0.25;
    } else if (kind === 'grave') {
      // grand tomb + leaning stones + a dead tree
      const tomb = new THREE.Group();
      tomb.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.34), M(0x8a8e9a, 1)));
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.34, 12, 1, false, 0, Math.PI), M(0x8a8e9a, 1)); arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2; arch.position.y = 0.75; tomb.add(arch);
      tomb.position.set(0, TOP + 0.75, 0.4); tomb.castShadow = true; view.add(tomb);
      for (const [x, z, r] of [[-1.4, 0.8, 0.3], [1.3, -0.4, -0.24], [-0.9, -1.2, 0.18]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.8, 0.16), M(0x767a86, 1)); s.rotation.z = r; add(s, x, z, TOP + 0.4); }
      const dt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 1.6, 5), M(0x3a3026, 1)); dt.rotation.z = 0.24; add(dt, 1.6, 1.0, TOP + 0.8);
    } else if (kind === 'swamp') {
      const pond = new THREE.Mesh(new THREE.CircleGeometry(1.15, 14), M(0x27503a, 0.4, { emis: 0x0c2014, emisI: 0.6 })); pond.rotation.x = -Math.PI / 2; pond.position.set(0.5, TOP + 0.02, 0.5); view.add(pond);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.25, 8), M(0x3f7a42, 0.8)); pad.rotation.x = -Math.PI / 2; pad.position.set(0.7, TOP + 0.04, 0.3); view.add(pad);
      const dt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 1.7, 5), M(0x3a3322, 1)); dt.rotation.z = -0.2; add(dt, -1.2, -0.6, TOP + 0.85);
      const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), M(0x4a6a3a, 1)); moss.scale.y = 0.6; add(moss, -1.3, 0.7, TOP + 1.7);
      for (const [x, z] of [[-0.4, 1.4], [1.6, -0.8], [-1.7, -1.3]]) for (let r = 0; r < 3; r++) { const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.8 + Math.random() * 0.4, 4), M(0x6a8a4a, 0.9)); reed.position.set(x + (Math.random() - 0.5) * 0.3, TOP + 0.4, z + (Math.random() - 0.5) * 0.3); reed.rotation.z = (Math.random() - 0.5) * 0.2; view.add(reed); }
    } else if (kind === 'ice') {
      const spire = (x, z, h, r) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), new THREE.MeshStandardMaterial({ color: 0xcfeaff, roughness: 0.22, emissive: 0x2a5a7a, emissiveIntensity: 0.28 })); add(c, x, z, TOP + h / 2); return c; };
      spire(0, 0, 2.6, 0.7); spire(-1.2, 0.7, 1.5, 0.42).rotation.z = 0.14; spire(1.2, -0.5, 1.2, 0.36).rotation.z = -0.12;
      for (const [x, z] of [[-0.9, -1.2], [1.5, 0.9]]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), M(0xeef6ff, 0.95)); s.scale.y = 0.45; add(s, x, z, TOP + 0.14); }
    } else if (kind === 'lava') {
      // a mini volcano with a glowing caldera + lava trickle
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.7, 1.7, 9), M(0x3a1810, 1)); add(cone, 0, 0, TOP + 0.85);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), M(0xff6a2a, 0.5, { emis: 0xff4a10, emisI: 1.0 })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, TOP + 1.72, 0); view.add(pool);
      const drip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.1), M(0xff6a2a, 0.5, { emis: 0xff4a10, emisI: 0.9 })); drip.rotation.x = 0.35; add(drip, 0.5, 0.95, TOP + 1.1);
      for (const [x, z] of [[-1.5, 0.7], [1.4, -1.1]]) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.0, 5), M(0x3a1810, 1)); add(r, x, z, TOP + 0.5); }
    } else if (kind === 'tech') {
      // a great mainspring: rotating gear + pylons
      const gear = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.2, 6, 9), M(0x8a95a2, 0.4, { metal: 0.6 })); gear.add(ring);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.22), M(0x8a95a2, 0.4, { metal: 0.6 })); tooth.position.set(Math.cos(a) * 1.1, Math.sin(a) * 1.1, 0); gear.add(tooth); }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 8), M(0x5fe0ff, 0.4, { emis: 0x2fb0d0, emisI: 0.9 })); hub.rotation.x = Math.PI / 2; gear.add(hub);
      gear.position.set(0, TOP + 1.5, 0); view.add(gear); view.userData.gear = gear;
      for (const [x, z] of [[-1.5, 0.8], [1.4, -0.9]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.5, 7), M(0x46525e, 0.4, { metal: 0.6 })); add(p, x, z, TOP + 0.75); const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), M(0x5fe0ff, 0.4, { emis: 0x2fb0d0, emisI: 1 })); add(tip, x, z, TOP + 1.6); }
    } else if (kind === 'void') {
      // a floating, slowly turning monolith ringed by shards (animated in update)
      const mono = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.5), M(0x1a1430, 0.4, { metal: 0.3 }));
      mono.position.set(0, TOP + 1.9, 0); mono.castShadow = true; view.add(mono); view.userData.mono = mono;
      const shards = new THREE.Group(); shards.position.y = TOP + 1.7;
      for (let k = 0; k < 4; k++) { const sh = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), M(0xb68fff, 0.25, { emis: 0x6a3ad0, emisI: 0.9 })); sh.userData = { a: k / 4 * Math.PI * 2 }; shards.add(sh); }
      view.add(shards); view.userData.shards = shards;
    }
  }

  refresh(unlockedFn, clearedFn) {
    this.build();
    let frontier = 0; // index of the furthest unlocked region (routes pulse toward it)
    for (let i = 0; i < this._views.length; i++) {
      const v = this._views[i];
      const unlocked = unlockedFn(v.id), cleared = clearedFn(v.id);
      if (unlocked) frontier = i;
      v.icon.visible = unlocked; v.lock.visible = !unlocked;
      if (v.flag) v.flag.visible = cleared;
      v.beam.material.opacity = unlocked ? 0.12 : 0;
      if (v.eyes) v.eyes.visible = unlocked && !cleared; // danger lurks in regions you've yet to conquer
      v.view.scale.setScalar(unlocked ? 1 : 0.9);        // locked islands sit a touch smaller/dimmer
      v.base.material.color.setHex(LAYOUT[v.id].tone).multiplyScalar(unlocked ? 1 : 0.45);
      v._unlocked = unlocked;
    }
    for (const r of this._routes) {
      r.active = r.toIdx === frontier && !clearedFn(this.order[frontier]); // the road to your next conquest glows
      r.open = r.toIdx <= frontier;
      r.mat.opacity = r.open ? 0.75 : 0.18;
    }
  }

  show(v) { this.group.visible = v; }

  select(id) { for (const v of this._views) { v.sel.visible = (v.id === id); if (v.ptr) v.ptr.visible = (v.id === id); } }

  update(dt) {
    if (!this.group.visible) return;
    this._t += dt;
    const t = this._t;
    // pixel sea drifts + coast foam breathes
    if (this._seaTex) { this._seaTex.offset.x = t * 0.008; this._seaTex.offset.y = Math.sin(t * 0.22) * 0.02; }
    if (this._sea) this._sea.material.emissiveIntensity = 0.45 + Math.sin(t * 0.8) * 0.15;
    if (this._foam) { this._foam.material.opacity = 0.2 + Math.abs(Math.sin(t * 0.7)) * 0.18; this._foam.scale.setScalar(1 + Math.sin(t * 0.7) * 0.004); this._foam.scale.x = 1.25 * (1 + Math.sin(t * 0.7) * 0.004); }
    // lurking eyes pulse, and blink shut now and then
    if (this._eyeMat) { const blink = (t % 4) > 3.8 ? 0.1 : 1; this._eyeMat.opacity = (0.55 + Math.abs(Math.sin(t * 2.4)) * 0.4) * blink; }
    if (this._motes) for (const m of this._motes) { m.position.y = m.userData.base + Math.sin(t * m.userData.sp + m.userData.ph) * 0.5; m.position.x += Math.sin(t * 0.3 + m.userData.ph) * dt * 0.4; }
    // clouds sail; their shadows track underneath
    if (this._clouds) for (const c of this._clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 36) c.position.x = -36;
      c.position.y += Math.sin(t * 0.6 + c.position.z) * dt * 0.1;
      const sh = c.userData.shadow; if (sh) sh.position.set(c.position.x, -0.05, c.position.z);
    }
    // gulls circle & flap
    if (this._birds) for (const b of this._birds) {
      const u = b.userData; const a = t * u.sp + u.ph;
      b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 1.3 + u.ph) * 0.4, -1.5 + Math.sin(a) * u.r * 0.75);
      b.rotation.y = -a - Math.PI / 2;
      const flap = Math.sin(t * 9 + u.ph) * 0.65;
      u.wL.rotation.z = flap; u.wR.rotation.z = -flap;
    }
    // the boat tacks a slow circle, bobbing & heeling
    if (this._boat) {
      const a = t * 0.11;
      this._boat.position.set(Math.cos(a) * 41, -0.32 + Math.sin(t * 1.7) * 0.06, -1.5 + Math.sin(a) * 30);
      this._boat.rotation.y = -a - Math.PI / 2;
      this._boat.rotation.z = Math.sin(t * 1.7) * 0.06;
      if (this._boat.userData.sail) this._boat.userData.sail.rotation.y = Math.sin(t * 0.9) * 0.2;
    }
    // stepping-stones: a pulse travels the active route toward the frontier
    if (this._routes) for (const r of this._routes) {
      if (!r.active) { for (const d of r.dots) d.scale.setScalar(1); continue; }
      for (let i = 0; i < r.dots.length; i++) {
        const k = Math.max(0, Math.sin(t * 2.6 - i * 0.55));
        r.dots[i].scale.setScalar(1 + k * 0.8);
        r.dots[i].position.y = 0.06 + k * 0.12;
      }
    }
    // monsters prowl the land, hopping along; they turn back at the coast
    if (this._mobs) for (const m of this._mobs) {
      const u = m.userData;
      m.position.x += u.vx * dt; m.position.z += u.vz * dt;
      const r = Math.hypot(m.position.x / 1.22, (m.position.z + 1.5) / 0.9);
      if (r > 27) { u.vx = -u.vx; u.vz = -u.vz; m.position.x += u.vx * dt * 2; m.position.z += u.vz * dt * 2; }
      m.rotation.y = Math.atan2(u.vx, u.vz);
      m.position.y = -0.1 + Math.abs(Math.sin(t * 5 + u.ph)) * 0.14;
    }
    for (const v of this._views) {
      v.icon.position.y = 3.4 + Math.sin(t * 2 + v.view.position.x) * 0.16;
      v.lock.position.y = v.icon.position.y;
      if (v.sel.visible) { v.sel.rotation.z += dt * 1.5; v.sel.scale.setScalar(1 + Math.sin(t * 4) * 0.04); }
      if (v.ptr && v.ptr.visible) { v.ptr.position.y = 4.7 + Math.abs(Math.sin(t * 3.2)) * 0.5; v.ptr.rotation.y += dt * 2.4; }
      v.beam.material.opacity = v.beam.material.opacity > 0 ? 0.08 + Math.abs(Math.sin(t * 2 + v.view.position.z)) * 0.1 : 0;
      // victory banners ripple in the sea wind
      if (v.flag && v.flag.visible && v.banner) { v.banner.rotation.y = Math.sin(t * 2.6 + v.view.position.x) * 0.35; v.banner.position.x = 0.62 + Math.sin(t * 2.6) * 0.03; }
      // island landmark idle animation (gear spins, monolith bobs, shards orbit)
      const ud = v.view.userData;
      if (ud.gear) ud.gear.rotation.z += dt * 0.7;
      if (ud.mono) { ud.mono.position.y = 2.65 + Math.sin(t * 1.1 + 2) * 0.18; ud.mono.rotation.y += dt * 0.5; }
      if (ud.shards) { ud.shards.rotation.y += dt * 1.1; for (const sh of ud.shards.children) { const a = sh.userData.a; sh.position.set(Math.cos(a) * 1.1, Math.sin(t * 2 + a) * 0.3, Math.sin(a) * 1.1); } }
    }
  }

  hover(ndc, camera) {
    if (!this._hitMeshes) return -1;
    this._ray.setFromCamera(ndc, camera);
    const hits = this._ray.intersectObjects(this._hitMeshes, false);
    return hits.length ? hits[0].object.userData.id : null;
  }
  pick(clientX, clientY, camera) {
    const ndc = { x: (clientX / window.innerWidth) * 2 - 1, y: -(clientY / window.innerHeight) * 2 + 1 };
    this._ray.setFromCamera(ndc, camera);
    const hits = this._ray.intersectObjects(this._hitMeshes, false);
    return hits.length ? hits[0].object.userData.id : null;
  }
  regionPos(id) { const L = LAYOUT[id]; return L ? new THREE.Vector3(L.x, 0, L.z) : this.center.clone(); }
}
