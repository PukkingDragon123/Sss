// levelmap.js — the region's LEVEL MAP as a real 3D BIOME DIORAMA: a thick,
// atmospheric slice of the region (deep forest, bone-cold frost, haunted graveyard,
// glowing cave, …) with a winding dirt trail of mossy stone waystones climbing past
// dense foliage and prowling creatures toward the boss lair at the summit. Built from
// the pure runmap graph; rendered with the main camera so it orbits & zooms with
// mouse & finger. Primitives-only, low-poly + pixel-textured — no candy anywhere.
import * as THREE from 'three';
import { pxMap } from './pixeltex.js';

// per node TYPE: floating badge + accent tint + a little landmark prop on the pad
const TYPE = {
  combat:   { icon: '⚔️', label: 'Skirmish', col: 0xff7a6a, prop: 'banner' },
  elite:    { icon: '💀', label: 'Elite',    col: 0xd85a5a, prop: 'skull' },
  treasure: { icon: '💰', label: 'Cache',    col: 0xffcf5c, prop: 'chest' },
  campfire: { icon: '🔥', label: 'Rest',     col: 0xff9a5a, prop: 'fire' },
  event:    { icon: '❓', label: 'Mystery',  col: 0x7fd0ff, prop: 'obelisk' },
  skill:    { icon: '✶', label: 'Trial',    col: 0x9be6ff, prop: 'rune' },
  minigame: { icon: '🎲', label: 'Game',     col: 0x9bff9b, prop: 'totem' },
  boss:     { icon: '👑', label: 'Boss Lair', col: 0xffe08a, prop: 'lair' },
};

// per-region biome dressing — ground palette, tree archetype, undergrowth, mood
const BIOME = {
  forest:    { grass: 0x3f7a44, grass2: 0x336237, dirt: 0x6a4a2a, path: 0x7a5a38, rock: 0x5b5a4e, tree: 'pine',   leaf: 0x2f6e3f, leaf2: 0x3f8a4a, under: ['fern', 'mushroom', 'bush'], mob: 0x241c14, accent: 0x9fe0d0, fog: 0x1a3048, sky: 0x14243a, hemi: 0x9fb6e8, hemiG: 0x223a2a, key: 0xcdd8ff },
  cave:      { grass: 0x5a5040, grass2: 0x47402f, dirt: 0x4a4236, path: 0x6a6250, rock: 0x6a5a44, tree: 'rock',   leaf: 0x6fd0e8, leaf2: 0x8fe0f0, under: ['crystal', 'rock', 'mushroom'], mob: 0x181420, accent: 0x6fd0e8, fog: 0x0e1418, sky: 0x0a1014, hemi: 0x9fd0e0, hemiG: 0x2a2a34 },
  graveyard: { grass: 0x54604f, grass2: 0x45503f, dirt: 0x4a4438, path: 0x6a6656, rock: 0x767a86, tree: 'dead',   leaf: 0x3a3026, leaf2: 0x4a4030, under: ['grave', 'bush', 'rock'], mob: 0x1a1a24, accent: 0x9fb0d0, fog: 0x161a22, sky: 0x10131c, hemi: 0xaab6cc, hemiG: 0x2a2e3a },
  swamp:     { grass: 0x4a5e34, grass2: 0x3c4e2c, dirt: 0x4a4228, path: 0x5e5232, rock: 0x4a5240, tree: 'willow', leaf: 0x3f7a3a, leaf2: 0x5a8a44, under: ['reed', 'mushroom', 'bush'], mob: 0x1c2416, accent: 0x8fd06a, fog: 0x141c14, sky: 0x0e1610, hemi: 0xb0c890, hemiG: 0x243020 },
  frost:     { grass: 0xcfe0ee, grass2: 0xb6cee0, dirt: 0x9fb2c4, path: 0xdfeaf4, rock: 0x8fa2b6, tree: 'snow',   leaf: 0x9fc0e0, leaf2: 0xd8ecfa, under: ['ice', 'rock', 'snowmound'], mob: 0x1c2430, accent: 0xbfe8ff, fog: 0x243040, sky: 0x1a2436, hemi: 0xdfeeff, hemiG: 0x3a4656 },
  inferno:   { grass: 0x4a2a1e, grass2: 0x3a1f16, dirt: 0x3a2018, path: 0x5a3020, rock: 0x3a1810, tree: 'charred', leaf: 0x6a3020, leaf2: 0x8a3a20, under: ['emberrock', 'rock'], mob: 0x241010, accent: 0xff7a3a, fog: 0x1e0e0a, sky: 0x160a08, hemi: 0xffb090, hemiG: 0x3a1810 },
  clockwork: { grass: 0x4a525c, grass2: 0x3c434c, dirt: 0x46525e, path: 0x5a6672, rock: 0x46525e, tree: 'pylon',  leaf: 0x5fe0ff, leaf2: 0x8fe8ff, under: ['gear', 'rock'], mob: 0x181c24, accent: 0x5fe0ff, fog: 0x0e161c, sky: 0x0a1016, hemi: 0xaad0e0, hemiG: 0x263038 },
  void:      { grass: 0x2a2440, grass2: 0x231e36, dirt: 0x2c2648, path: 0x3a3258, rock: 0x3a3258, tree: 'shard',  leaf: 0xb68fff, leaf2: 0xd0b6ff, under: ['shard', 'rock'], mob: 0x140f22, accent: 0xb68fff, fog: 0x120e22, sky: 0x0c0818, hemi: 0xc8b6ff, hemiG: 0x2a2444 },
};
const hx = (n) => '#' + ('000000' + n.toString(16)).slice(-6);
const lerpHex = (a, b, t) => { const ca = new THREE.Color(a), cb = new THREE.Color(b); return ca.lerp(cb, t).getHex(); };

// A big, unmistakable Candy-Crush-style LEVEL MEDALLION billboard: a glossy round
// button with a thick dark ring, a huge readable number (or crown for the boss),
// a padlock when locked, a type glyph, and three star pips. Redrawn on state change.
function makeMedallion(number, typeDef, isBoss) {
  const S = 192;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const cx = S / 2, cy = S / 2 - 12, R = isBoss ? 68 : 60;
  const draw = (state, stars) => {
    x.clearRect(0, 0, S, S);
    const locked = state === 'locked';
    let disc, ring, ink, gloss = 'rgba(255,255,255,0.28)';
    if (locked) { disc = '#6a6470'; ring = '#3a3640'; ink = '#26232c'; }
    else if (state === 'current') { disc = '#ffd45a'; ring = '#9a6a16'; ink = '#3a2600'; }
    else if (state === 'done') { disc = '#74c268'; ring = '#2c6330'; ink = '#0f350f'; }
    else { disc = hx(typeDef.col); ring = '#221a12'; ink = '#181008'; } // reachable → type colour
    // ground shadow
    x.fillStyle = 'rgba(0,0,0,0.38)'; x.beginPath(); x.ellipse(cx, cy + R + 12, R * 0.78, 11, 0, 0, 7); x.fill();
    // outer ring + disc
    x.beginPath(); x.arc(cx, cy, R + 11, 0, 7); x.fillStyle = ring; x.fill();
    x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fillStyle = disc; x.fill();
    // glossy top highlight
    x.beginPath(); x.ellipse(cx, cy - R * 0.42, R * 0.66, R * 0.36, 0, 0, 7); x.fillStyle = gloss; x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (locked) {                                   // padlock
      x.fillStyle = ink; x.beginPath(); x.roundRect(cx - 20, cy - 2, 40, 34, 6); x.fill();
      x.lineWidth = 9; x.strokeStyle = ink; x.beginPath(); x.arc(cx, cy - 6, 15, Math.PI, 0); x.stroke();
      x.fillStyle = disc; x.beginPath(); x.arc(cx, cy + 12, 5, 0, 7); x.fill();
    } else if (isBoss) {                            // crown for the lair
      x.font = '900 68px sans-serif'; x.fillStyle = ink; x.fillText('♛', cx, cy + 4);
    } else {                                        // the level number, huge & outlined
      x.font = '900 76px "Trebuchet MS",Arial,sans-serif';
      x.lineWidth = 10; x.strokeStyle = ink; x.strokeText(String(number), cx, cy + 4);
      x.fillStyle = '#fff8e6'; x.fillText(String(number), cx, cy + 4);
    }
    // a small type glyph above (skip plain combat & boss)
    if (!locked && !isBoss && typeDef && typeDef.icon && typeDef !== TYPE.combat) { x.font = '34px sans-serif'; x.fillText(typeDef.icon, cx, cy - R - 6); }
    // three star pips beneath
    for (let s = 0; s < 3; s++) { x.font = '30px sans-serif'; x.fillStyle = s < (stars || 0) ? '#ffdf5a' : 'rgba(255,255,255,0.24)'; x.fillText('★', cx + (s - 1) * 30, cy + R + 22); }
    tex.needsUpdate = true;
  };
  draw('locked', 0);
  const sc = isBoss ? 4.0 : 3.2; spr.scale.set(sc, sc, sc);
  return { spr, draw };
}

export class LevelMap {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this._ray = new THREE.Raycaster();
    this._t = 0; this._nodes = []; this._hitMeshes = []; this._mobs = []; this._motes = [];
    this.center = new THREE.Vector3(); this.biome = BIOME.forest;
  }

  // lay the node chain as a STRAIGHT vertical block-road climbing into the distance
  _layout(map) {
    const ordered = map.nodes.slice().sort((a, b) => a.row - b.row);
    const STEP = 5.0;                            // one clean straight column of levels
    const pos = {};
    for (let i = 0; i < ordered.length; i++) {
      const n = ordered[i];
      pos[n.id] = { x: 0, z: -i * STEP, node: n, i };
    }
    return { ordered, pos, span: (ordered.length - 1) * STEP };
  }

  build(map, regionId, tone) {
    this.dispose();
    const B = this.biome = BIOME[regionId] || BIOME.forest;
    const g = this.group;
    const M = (c, r = 0.92, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: o.metal || 0, emissive: o.emis || 0x000000, emissiveIntensity: o.emisI != null ? o.emisI : 1, flatShading: true });
    const basic = (c, o = 0.9) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
    const L = this._layout(map);
    this._span = L.span;
    const midZ = -L.span / 2;
    this.center.set(0, 0, midZ);
    const RW = 15, RD = L.span / 2 + 12; // ground half-extents

    // ---- the ground: an organic earthen plateau, grass on top, dirt & rock at the rim ----
    const groundTop = M(B.grass, 1);
    const gt = new THREE.Mesh(new THREE.CylinderGeometry(RW, RW + 1.5, 1.6, 44), groundTop);
    gt.scale.z = RD / RW; gt.position.set(0, -0.2, midZ); gt.receiveShadow = true; g.add(gt);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(RW + 1.4, RW + 2.6, 2.2, 44), M(B.dirt, 1));
    rim.scale.z = (RD + 1.6) / RW; rim.position.set(0, -1.0, midZ); rim.receiveShadow = true; g.add(rim);
    // darker grass dapples for texture variety
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * 6.28, r = Math.random();
      const px = Math.cos(a) * RW * 0.9 * Math.sqrt(r), pz = midZ + Math.sin(a) * RD * 0.9 * Math.sqrt(r);
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.8 + Math.random() * 1.6, 7), M(B.grass2, 1));
      patch.rotation.x = -Math.PI / 2; patch.position.set(px, 0.62, pz); g.add(patch);
    }

    // ---- the straight BLOCK ROAD: one bold ribbon of packed earth with kerb edges ----
    const pathMat = M(B.path, 1);
    const roadLen = L.span + 3;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(3.6, roadLen), pathMat);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.64, midZ); g.add(road);
    // stone kerbs down both sides of the block road
    const kerbMat = M(0x8a8474, 0.95);
    for (const sx of [-1, 1]) { const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, roadLen), kerbMat); kerb.position.set(sx * 1.95, 0.7, midZ); kerb.castShadow = true; g.add(kerb); }
    // faint guiding wisps marching straight up the centre of the road toward the frontier
    this._trailDots = [];
    for (let i = 0; i < L.ordered.length - 1; i++) {
      const a = L.pos[L.ordered[i].id], b = L.pos[L.ordered[i + 1].id];
      const seg = 3;
      for (let k = 1; k < seg; k++) {
        const t = k / seg;
        const wisp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), basic(B.accent, 0.0));
        wisp.position.set(0, 1.1, a.z + (b.z - a.z) * t); g.add(wisp);
        this._trailDots.push({ wisp, seg: i, k });
      }
    }

    // ---- the node waystones: a clean disc pad + a big candy-crush level medallion ----
    for (const n of L.ordered) {
      const p = L.pos[n.id];
      const def = TYPE[n.type] || TYPE.combat;
      const isBoss = n.type === 'boss';
      const view = new THREE.Group(); view.position.set(p.x, 0.64, p.z);
      // a low mossy stone pad (kept small & tidy)
      const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.4, 0.5, 14), M(B.rock, 0.95)); dais.position.y = 0.25; dais.castShadow = dais.receiveShadow = true; view.add(dais);
      const moss = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.12, 14), M(lerpHex(B.grass, 0x4a6a34, 0.5), 0.9)); moss.position.y = 0.5; view.add(moss);
      if (isBoss) this._nodeProp(view, 'lair', def.col, true, M, basic); // keep the dramatic lair landmark
      // the big readable medallion (billboard — always faces the camera)
      const med = makeMedallion(n.row + 1, def, isBoss); med.spr.position.y = isBoss ? 3.6 : 2.6; view.add(med.spr);
      // a soft glow ring on the pad (lit for reachable/current) + a "you are here" pointer
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.12, 8, 28), basic(B.accent, 0)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; view.add(ring);
      const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xffe08a })); ptr.rotation.x = Math.PI; ptr.position.y = isBoss ? 5.4 : 4.0; ptr.visible = false; view.add(ptr);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 5.0, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 2.0; hit.userData.id = n.id; view.add(hit);
      g.add(view);
      this._hitMeshes.push(hit);
      this._nodes.push({ id: n.id, node: n, view, ring, ptr, med, isBoss });
    }

    // ---- THICK undergrowth: trees, bushes, rocks & biome props packed around the trail ----
    this._sway = [];
    const onPad = (x, z) => L.ordered.some(n => { const p = L.pos[n.id]; return (x - p.x) ** 2 + (z - p.z) ** 2 < 5.5; });
    const TREES = 26, PROPS = 16; // thinned out — a clean, readable map, not a cluttered thicket
    for (let i = 0; i < TREES; i++) {
      const a = Math.random() * 6.28, r = 0.28 + Math.random() * 0.72;
      const x = Math.cos(a) * RW * 0.98 * r, z = midZ + Math.sin(a) * RD * 0.98 * r;
      if (onPad(x, z)) continue;
      const tr = this._tree(B, M, basic); tr.position.set(x, 0.6, z); tr.rotation.y = Math.random() * 6.28;
      const s = 0.8 + Math.random() * 0.7; tr.scale.setScalar(s);
      g.add(tr); this._sway.push({ o: tr, ph: Math.random() * 6.28, amp: 0.02 + Math.random() * 0.03 });
    }
    for (let i = 0; i < PROPS; i++) {
      const a = Math.random() * 6.28, r = 0.22 + Math.random() * 0.76;
      const x = Math.cos(a) * RW * 0.96 * r, z = midZ + Math.sin(a) * RD * 0.96 * r;
      if (onPad(x, z)) continue;
      const kind = B.under[Math.floor(Math.random() * B.under.length)];
      const pr = this._prop(kind, B, M, basic); if (!pr) continue; pr.position.set(x, 0.62, z); pr.rotation.y = Math.random() * 6.28; g.add(pr);
    }

    // ---- prowling creatures: dark bodies, glowing eyes, hopping between the trees ----
    this._eyeMat = basic(0xff3a20, 0.9);
    const mobMat = M(B.mob, 0.9);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 9), mobMat); body.scale.set(1, 0.72, 1.12); body.position.y = 0.44; body.castShadow = true; m.add(body);
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 6), mobMat); ear.position.set(0, 0.82, -0.04); m.add(ear);
      for (const dx of [-0.14, 0.14]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this._eyeMat); e.position.set(dx, 0.52, 0.36); m.add(e); }
      const a = Math.random() * 6.28, r = 0.3 + Math.random() * 0.6;
      m.position.set(Math.cos(a) * RW * r, 0.62, midZ + Math.sin(a) * RD * r);
      m.userData = { vx: (Math.random() - 0.5) * 1.2, vz: (Math.random() - 0.5) * 1.2, ph: Math.random() * 6.28, RW, RD, midZ };
      g.add(m); this._mobs.push(m);
    }

    // ---- atmosphere: drifting fireflies/spores + a low moon with a soft halo ----
    const moteMat = basic(B.accent, 0.85);
    for (let i = 0; i < 14; i++) {
      const mo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), moteMat);
      const a = Math.random() * 6.28, r = Math.random();
      mo.position.set(Math.cos(a) * RW * r, 0.8 + Math.random() * 4, midZ + Math.sin(a) * RD * r);
      mo.userData = { base: mo.position.y, sp: 0.3 + Math.random() * 0.6, ph: Math.random() * 6.28 };
      g.add(mo); this._motes.push(mo);
    }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 9), new THREE.MeshBasicMaterial({ color: 0xf3ecd6 }));
    moon.position.set(-22, 15, midZ - RD - 6); g.add(moon);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(3.8, 12, 9), basic(0xd8e0f0, 0.16)); halo.position.copy(moon.position); g.add(halo);

    // pixel-art grain on the solid earth/rock/wood pieces (skip glow/sprites/transparent)
    g.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.isMeshStandardMaterial) return;
      // skip already-mapped, transparent, or genuinely GLOWING (non-black emissive) mats;
      // everything else (earth/rock/wood/leaf) gets the pixel grain
      const m = o.material; if (m.map || m.transparent || (m.emissive && m.emissive.getHex() !== 0)) return;
      const c = m.color;
      const tk = m.metalness > 0.35 ? 'metal'
        : (c.g > c.r && c.g > c.b) ? (c.g > 0.5 ? 'grass' : 'leaf')
        : (c.r > 0.32 && c.b < c.r * 0.85) ? (c.r > 0.45 ? 'dirt' : 'wood')
        : 'stone';
      pxMap(m, tk, 2);
    });
  }

  // a little landmark prop that sits atop each node's dais, keyed by encounter type
  _nodeProp(view, kind, col, isBoss, M, basic) {
    const add = (m, x, y, z) => { m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; view.add(m); return m; };
    if (kind === 'lair' || isBoss) {
      // a menacing dark keep with a glowing maw
      const keep = add(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.35, 2.2, 6), M(0x2a2432, 0.9)), 0, 1.7, 0);
      for (const sx of [-1, 1]) { const tw = add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 2.9, 6), M(0x35303f, 0.9)), sx * 1.15, 1.9, -0.2); const tip = add(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 6), M(0x5a1030, 0.7, { emis: 0x5a1030, emisI: 0.5 })), sx * 1.15, 3.5, -0.2); }
      const maw = add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.2), basic(0xff4a3a, 0.85)), 0, 1.4, 1.02);
      for (const dx of [-0.34, 0.34]) add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), basic(0xff3a20, 0.95)), dx, 2.5, 0.9);
      return;
    }
    if (kind === 'chest') {
      const body = add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), M(0x6a3f1f, 0.9)), 0, 0.9, 0);
      const lid = add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10, 1, false, 0, Math.PI), M(0x6a3f1f, 0.9)), 0, 1.2, 0); lid.rotation.z = Math.PI / 2;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.64), M(0xe8b23a, 0.4, { metal: 0.7 })), 0, 1.18, 0);
    } else if (kind === 'fire') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.25, 10), M(0x4a4038, 1)), 0, 0.72, 0);
      for (let k = 0; k < 4; k++) { const log = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 5), M(0x5a3a22, 0.9)), 0, 0.8, 0); log.rotation.set(0.5, k * 1.57, 0); }
      const flame = add(new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 7), basic(0xff9a3a, 0.9)), 0, 1.2, 0); view.userData.flame = flame;
    } else if (kind === 'skull') {
      const sk = add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), M(0xe8e2d2, 0.85)), 0, 1.05, 0); sk.scale.set(1, 0.95, 1.05);
      for (const dx of [-0.2, 0.2]) add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), basic(col, 0.95)), dx, 1.1, 0.4);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.3), M(0xe8e2d2, 0.85)), 0, 0.78, 0.32);
    } else if (kind === 'obelisk') {
      const ob = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 1.7, 4), M(0x4a4a60, 0.7)), 0, 1.45, 0);
      add(new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), basic(col, 0.9)), 0, 2.5, 0);
    } else if (kind === 'rune' || kind === 'totem') {
      const st = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.5, 6), M(0x5a5a6a, 0.85)), 0, 1.35, 0);
      const glow = add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.07, 6, 16), basic(col, 0.9)), 0, 1.6, 0.42); glow.rotation.x = 0;
    } else { // 'banner' (combat) — a planted war banner
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 6), M(0x5a3a22, 0.9)), 0.1, 1.6, 0);
      const bm = M(col, 0.85, { emis: col, emisI: 0.12 }); bm.side = THREE.DoubleSide;
      const flag = add(new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.55), bm), 0.5, 2.2, 0); view.userData.flag = flag;
    }
  }

  // one tree, styled by biome archetype
  _tree(B, M, basic) {
    const t = new THREE.Group();
    if (B.tree === 'pine' || B.tree === 'snow') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 1.0, 6), M(0x4a3326)); trunk.position.y = 0.5; trunk.castShadow = true; t.add(trunk);
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.85 - k * 0.2, 1.1, 7), M(k % 2 ? B.leaf2 : B.leaf)); c.position.y = 1.15 + k * 0.6; c.castShadow = true; t.add(c); if (B.tree === 'snow') { const cap = new THREE.Mesh(new THREE.ConeGeometry(0.85 - k * 0.2 + 0.02, 0.28, 7), M(0xf2f8ff, 0.7)); cap.position.y = 1.55 + k * 0.6; t.add(cap); } }
    } else if (B.tree === 'willow') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 6), M(0x3a3322)); trunk.position.y = 0.7; trunk.castShadow = true; t.add(trunk);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.0, 9, 7), M(B.leaf)); crown.scale.y = 0.7; crown.position.y = 1.7; crown.castShadow = true; t.add(crown);
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; const v = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), M(B.leaf2)); v.position.set(Math.cos(a) * 0.8, 1.3, Math.sin(a) * 0.8); t.add(v); }
    } else if (B.tree === 'dead' || B.tree === 'charred') {
      const col = B.tree === 'charred' ? 0x2a1810 : 0x3a3026;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.8, 6), M(col)); trunk.position.y = 0.9; trunk.castShadow = true; t.add(trunk);
      for (let k = 0; k < 4; k++) { const a = k * 1.6; const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 0.9, 5), M(col)); br.position.set(Math.cos(a) * 0.35, 1.4 + k * 0.18, Math.sin(a) * 0.35); br.rotation.set(0.7, a, 0.4); t.add(br); }
      if (B.tree === 'charred') { const ember = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), basic(0xff6a2a, 0.8)); ember.position.y = 0.4; t.add(ember); }
    } else if (B.tree === 'rock') {
      for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.ConeGeometry(0.4 - k * 0.08, 1.4 - k * 0.3, 6), M(B.rock, 1)); r.position.set((k - 1) * 0.35, 0.7 - k * 0.1, (k - 1) * 0.2); r.castShadow = true; t.add(r); }
      const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), M(B.leaf, 0.3, { emis: B.leaf, emisI: 0.7 })); cr.position.y = 1.0; t.add(cr);
    } else if (B.tree === 'pylon') {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.8, 6), M(0x46525e, 0.4, { metal: 0.6 })); p.position.y = 0.9; p.castShadow = true; t.add(p);
      const gear = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.12, 6, 8), M(0x8a95a2, 0.4, { metal: 0.6 })); gear.position.y = 1.9; t.add(gear); t.userData.gear = gear;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), basic(B.leaf, 1)); tip.position.y = 1.9; t.add(tip);
    } else { // 'shard' (void)
      for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 - k * 0.06, 0), M(0x2a2444, 0.4, { emis: B.leaf, emisI: 0.4 })); s.position.set((k - 1) * 0.3, 0.7 + k * 0.5, 0); s.rotation.y = k; s.castShadow = true; t.add(s); }
    }
    return t;
  }

  // small undergrowth prop
  _prop(kind, B, M, basic) {
    const t = new THREE.Group();
    if (kind === 'fern' || kind === 'bush') {
      const col = kind === 'bush' ? B.leaf : B.leaf2;
      const n = kind === 'bush' ? 4 : 6;
      for (let k = 0; k < n; k++) { const a = k / n * 6.28; const blade = new THREE.Mesh(kind === 'bush' ? new THREE.IcosahedronGeometry(0.3, 0) : new THREE.ConeGeometry(0.09, 0.6, 4), M(col)); blade.position.set(Math.cos(a) * 0.2, kind === 'bush' ? 0.25 : 0.3, Math.sin(a) * 0.2); if (kind !== 'bush') blade.rotation.set(0.5, a, 0); t.add(blade); }
    } else if (kind === 'mushroom') {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.3, 6), M(0xe8e0cc)); st.position.y = 0.15; t.add(st);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, 0, 6.28, 0, Math.PI / 2), M(0xc0556a, 0.8, { emis: 0x3a0a14, emisI: 0.4 })); cap.position.y = 0.3; t.add(cap);
    } else if (kind === 'rock' || kind === 'emberrock') {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.3, 0), M(B.rock, 1)); r.position.y = 0.2; r.castShadow = true; t.add(r);
      if (kind === 'emberrock') { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), basic(0xff6a2a, 0.8)); e.position.y = 0.2; t.add(e); }
    } else if (kind === 'crystal' || kind === 'shard') {
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5 + Math.random() * 0.4, 5), M(B.leaf, 0.3, { emis: B.leaf, emisI: 0.6 })); c.position.set((k - 1) * 0.14, 0.3, 0); c.rotation.z = (k - 1) * 0.3; t.add(c); }
    } else if (kind === 'reed') {
      for (let k = 0; k < 4; k++) { const rd = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.8 + Math.random() * 0.4, 4), M(0x6a8a4a, 0.9)); rd.position.set((Math.random() - 0.5) * 0.3, 0.45, (Math.random() - 0.5) * 0.3); rd.rotation.z = (Math.random() - 0.5) * 0.3; t.add(rd); }
    } else if (kind === 'grave') {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.12), M(0x767a86, 1)); s.position.y = 0.3; s.rotation.z = (Math.random() - 0.5) * 0.2; s.castShadow = true; t.add(s);
    } else if (kind === 'ice' || kind === 'snowmound') {
      if (kind === 'ice') { const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 6), M(0xcfeaff, 0.25, { emis: 0x2a5a7a, emisI: 0.25 })); c.position.y = 0.35; t.add(c); }
      else { const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), M(0xeef6ff, 0.9)); m.scale.y = 0.45; m.position.y = 0.1; t.add(m); }
    } else if (kind === 'gear') {
      const gr = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 6, 8), M(0x8a95a2, 0.4, { metal: 0.6 })); gr.position.y = 0.3; gr.rotation.x = Math.PI / 2; t.add(gr); t.userData.gear = gr;
    } else return null;
    return t;
  }

  // paint node states from the live game (current / reachable / visited / stars)
  refresh(game) {
    const map = game._runMap; if (!map) return;
    const cur = game._mapNodeId, visited = game._mapVisited || new Set();
    const reach = new Set();
    if (cur == null) reach.add(map.startId);
    else { const c = map.byId[cur]; if (c) c.next.forEach(id => reach.add(id)); }
    const starsOf = game._mapStarsOf ? (id) => game._mapStarsOf(id) : () => 0;
    for (const nd of this._nodes) {
      const isCur = nd.id === cur, isReach = reach.has(nd.id), isVis = visited.has(nd.id) && !isCur;
      nd._cur = isCur; nd._active = isCur || isReach;
      nd.ptr.visible = isCur;
      nd.ring.material.color.setHex(isCur ? 0xffe08a : this.biome.accent);
      nd._ringTarget = isCur ? 0.9 : (isReach ? 0.55 : 0);
      const got = starsOf(nd.id);
      // candy-crush states: done (visited) / current / reachable (open) / locked
      const state = isCur ? 'current' : isVis ? 'done' : isReach ? 'reachable' : 'locked';
      nd.med.draw(state, got);
      nd.view.scale.setScalar(state === 'locked' ? 0.92 : 1);
    }
    this._frontierZ = (() => { let z = 0; for (const nd of this._nodes) if (nd._active) z = Math.min(z, nd.view.position.z); return z; })();
  }

  show(v) { this.group.visible = v; }
  pick(clientX, clientY, camera) {
    const ndc = { x: (clientX / window.innerWidth) * 2 - 1, y: -(clientY / window.innerHeight) * 2 + 1 };
    this._ray.setFromCamera(ndc, camera);
    const hits = this._ray.intersectObjects(this._hitMeshes, false);
    return hits.length ? hits[0].object.userData.id : null;
  }
  nodePos(id) { const nd = this._nodes.find(n => n.id === id); return nd ? nd.view.position.clone() : this.center.clone(); }

  update(dt) {
    if (!this.group.visible) return;
    this._t += dt; const t = this._t;
    // trail wisps pulse toward the frontier
    if (this._trailDots) for (const d of this._trailDots) { const k = Math.max(0, Math.sin(t * 2.4 - d.seg * 0.5 - d.k * 0.4)); d.wisp.material.opacity = k * 0.75; d.wisp.position.y = 1.0 + k * 0.4; d.wisp.scale.setScalar(0.7 + k * 0.9); }
    // node idle life — the medallion bobs gently; the current one bobs bigger
    for (const nd of this._nodes) {
      const base = nd.isBoss ? 3.6 : 2.6, amp = nd._cur ? 0.28 : 0.14;
      nd.med.spr.position.y = base + Math.sin(t * 2.2 + nd.view.position.x) * amp;
      const rt = nd._ringTarget || 0;
      nd.ring.material.opacity += (rt - nd.ring.material.opacity) * Math.min(1, dt * 6);
      if (nd._active) { nd.ring.rotation.z += dt * 1.1; nd.ring.scale.setScalar(1 + Math.sin(t * 4 + nd.view.position.z) * 0.05); }
      if (nd.ptr.visible) { nd.ptr.position.y = (nd.isBoss ? 5.4 : 4.0) + Math.abs(Math.sin(t * 3.2)) * 0.5; nd.ptr.rotation.y += dt * 2.4; }
      const uf = nd.view.userData;
      if (uf.flame) { uf.flame.scale.y = 1 + Math.sin(t * 9 + nd.view.position.x) * 0.18; uf.flame.material.opacity = 0.7 + Math.abs(Math.sin(t * 7)) * 0.25; }
      if (uf.flag) uf.flag.rotation.y = Math.sin(t * 2.6 + nd.view.position.x) * 0.35;
    }
    // foliage sway
    if (this._sway) for (const s of this._sway) s.o.rotation.z = Math.sin(t * 1.3 + s.ph) * s.amp;
    // fireflies drift
    if (this._motes) for (const m of this._motes) { m.position.y = m.userData.base + Math.sin(t * m.userData.sp + m.userData.ph) * 0.5; m.position.x += Math.sin(t * 0.3 + m.userData.ph) * dt * 0.4; }
    // creatures prowl the ground, hopping, turning back at the rim
    if (this._mobs) for (const m of this._mobs) {
      const u = m.userData;
      m.position.x += u.vx * dt; m.position.z += u.vz * dt;
      const r = Math.hypot(m.position.x / (u.RW * 0.9), (m.position.z - u.midZ) / (u.RD * 0.9));
      if (r > 1) { u.vx = -u.vx; u.vz = -u.vz; m.position.x += u.vx * dt * 2; m.position.z += u.vz * dt * 2; }
      m.rotation.y = Math.atan2(u.vx, u.vz);
      m.position.y = 0.6 + Math.abs(Math.sin(t * 5 + u.ph)) * 0.16;
    }
    if (this._eyeMat) this._eyeMat.opacity = 0.55 + Math.abs(Math.sin(t * 2.6)) * 0.4;
    // spinning gears on clockwork trees/props
    this.group.traverse(o => { if (o.userData && o.userData.gear) o.userData.gear.rotation.z += dt * 0.8; });
  }

  dispose() {
    const g = this.group;
    const seenG = new Set(), seenM = new Set();
    g.traverse(o => {
      // Sprites share THREE's internal singleton geometry — never dispose it
      if (o.geometry && !o.isSprite && !seenG.has(o.geometry)) { seenG.add(o.geometry); o.geometry.dispose(); }
      const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm && !seenM.has(mm)) { seenM.add(mm); if (mm.map && !(mm.map.userData && mm.map.userData.keep)) mm.map.dispose(); mm.dispose && mm.dispose(); } });
    });
    for (let i = g.children.length - 1; i >= 0; i--) g.remove(g.children[i]);
    this._nodes = []; this._hitMeshes = []; this._mobs = []; this._motes = []; this._trailDots = []; this._sway = [];
  }
}
