// resto.js — THE TIPSY TOAD dining hall: a side-scrolling 2.5D restaurant scene.
// MANAGE mode (free cam): drag to pan, click things to act — empty plots sell
// tables, owned tables upgrade chairs & accessories, the kitchen practices menus,
// the great spellbook opens MENU/MAGIC, the counter bell opens for the night.
// SERVICE mode (Dave-the-Diver): the WISP cooks at the kitchen pass; YOU run the
// floor — grab finished plates and serve them before patience runs dry.
import * as THREE from 'three';
import { pxMap } from './pixeltex.js';
import { makeFace } from './facesprite.js';
import { outlineGroup } from './outline.js';
import { buildCharModel } from './charmodels.js';
import * as meta from './meta.js';
import { RECIPES, RECIPE_BY_ID, INGREDIENTS, canCook, platePrice } from './cooking.js';
import { spriteCanvas } from './pixelicons.js';

// six table plots along the dining floor + fixed landmarks
const PLOTS = [{ id: 'p0', x: 1.5 }, { id: 'p1', x: 7.5 }, { id: 'p2', x: 13.5 }, { id: 'p3', x: 19.5 }, { id: 'p4', x: 25.5 }, { id: 'p5', x: 31.5 }];
const TABLE_Z = -1.1, LANE_Z = 2.0;         // tables sit back; the chef runs the front lane
const PASS_X = -5.2;                        // where finished plates wait
const KITCHEN_X = -10.5, BOOK_X = -1.8, DOOR_X = 36.5, BELL_X = -4.2;
const CAM_MIN = -13, CAM_MAX = 35;          // how far the diner-cam pans
// table has 4 tiers (buy + 3 upgrades); chairs 4 tiers; accessories 3 tiers
const COSTS = { table: [140, 260, 460, 720], chairs: [90, 170, 280], deco: [70, 130, 210] };

const M = (c, r = 0.85, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, flatShading: true });
const glowM = (c, o = 0.9) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });

export class Resto {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.visible = false;
    game.scene.add(this.group);
    this.mode = 'manage';
    this.camX = 4;
    this._hit = [];           // clickable proxy meshes (userData.id)
    this._plotGroups = {};
    this._forSale = [];
    this._built = false;
    this._ray = new THREE.Raycaster();
    this.svc = null;
    this._panel = null;
    this.t = 0;
  }

  // ---------- the room (built once) ----------
  build() {
    if (this._built) return; this._built = true;
    const G = this.group;
    const wood = pxMap(M(0x6a4a2c, 0.9), 'wood', 6);
    const woodD = pxMap(M(0x4a3018, 0.95), 'wood', 4);
    const plaster = pxMap(M(0x8a6a4a, 0.95), 'wood', 8);
    // floor + front lip (the 2.5D stage)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(70, 0.6, 11), wood); floor.position.set(9, -0.3, 0); floor.receiveShadow = true; G.add(floor);
    for (let i = -12; i <= 30; i += 3) { const seam = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 10.6), woodD); seam.position.set(i, 0.01, 0); G.add(seam); }
    const rug = new THREE.Mesh(new THREE.BoxGeometry(30, 0.04, 5), pxMap(M(0x7a2a28, 0.98), 'cloth', 5)); rug.position.set(13.5, 0.03, -0.6); G.add(rug);
    // back wall with wainscot + windows
    const wall = new THREE.Mesh(new THREE.BoxGeometry(70, 8, 0.5), plaster); wall.position.set(9, 4, -5.2); G.add(wall);
    const wains = new THREE.Mesh(new THREE.BoxGeometry(70, 1.6, 0.56), woodD); wains.position.set(9, 0.8, -5.18); G.add(wains);
    for (const wx of [3, 11, 19, 27]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 0.2), woodD); frame.position.set(wx, 4.4, -4.95); G.add(frame);
      const night = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.3), new THREE.MeshBasicMaterial({ color: 0x101a36 })); night.position.set(wx, 4.4, -4.83); G.add(night);
      for (let s = 0; s < 4; s++) { const st = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), glowM(0xdfeaff, 0.9)); st.position.set(wx + (Math.random() - 0.5) * 1.7, 4.4 + (Math.random() - 0.5) * 1.9, -4.8); G.add(st); }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.1), woodD); cross.position.set(wx, 4.4, -4.8); G.add(cross);
    }
    // hanging lanterns
    this._lamps = [];
    for (const lx of [-8, 2, 12, 22]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), woodD); rod.position.set(lx, 6.4, -1.5); G.add(rod);
      const shadeM = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.5, 8), pxMap(M(0xc9a24a, 0.8), 'metal', 2)); shadeM.position.set(lx, 5.6, -1.5); G.add(shadeM);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), glowM(0xffd9a0)); bulb.position.set(lx, 5.35, -1.5); G.add(bulb);
      const li = new THREE.PointLight(0xffca88, 1.5, 14); li.position.set(lx, 5.2, -0.5); G.add(li);
      this._lamps.push({ bulb, li, seed: lx });
    }
    // ===== THE KITCHEN (far left) — the wisp's realm =====
    const tile = pxMap(M(0x9aa3ad, 0.6), 'stone', 6);
    const kWall = new THREE.Mesh(new THREE.BoxGeometry(11, 4.2, 0.4), tile); kWall.position.set(KITCHEN_X - 0.5, 2.1, -5); G.add(kWall);
    const stove = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 2), pxMap(M(0x3a3346, 0.7, 0.4), 'metal', 3)); stove.position.set(KITCHEN_X - 2, 0.8, -3.4); stove.castShadow = true; G.add(stove);
    for (const hx of [-0.8, 0.8]) { const hob = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.08, 10), M(0x1a1622, 0.6)); hob.position.set(KITCHEN_X - 2 + hx, 1.64, -3.4); G.add(hob); }
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.16, 10), M(0x2a2632, 0.5, 0.5)); pan.position.set(KITCHEN_X - 2.8, 1.72, -3.4); G.add(pan);
    this._stoveFire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 8), glowM(0xff9a3a, 0.9)); this._stoveFire.position.set(KITCHEN_X - 1.2, 1.9, -3.4); G.add(this._stoveFire);
    const prep = new THREE.Mesh(new THREE.BoxGeometry(3, 1.3, 1.6), woodD); prep.position.set(KITCHEN_X + 1.6, 0.65, -3.6); G.add(prep);
    const prepTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.8), pxMap(M(0xd8cdb4, 0.5), 'stone', 3)); prepTop.position.set(KITCHEN_X + 1.6, 1.36, -3.6); G.add(prepTop);
    // the PASS — a counter facing the floor where plates land, with the service bell
    const pass = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.15, 1.4), wood); pass.position.set(PASS_X, 0.58, -0.6); pass.castShadow = true; G.add(pass);
    const passTop = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.16, 1.7), pxMap(M(0x8a5a34, 0.4, 0.15), 'wood', 3)); passTop.position.set(PASS_X, 1.22, -0.6); G.add(passTop);
    const bellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.08, 10), M(0x8a5a2e, 0.6)); bellBase.position.set(BELL_X, 1.34, -0.3); G.add(bellBase);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), pxMap(M(0xf4c04a, 0.35, 0.6), 'metal', 2)); bell.position.set(BELL_X, 1.36, -0.3); G.add(bell); this._bell = bell;
    // ===== the GREAT BOOK on a lectern — menu & magic live inside =====
    const lect = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.8), woodD); lect.position.set(BOOK_X, 0.65, -3.4); G.add(lect);
    const bookG = new THREE.Group(); bookG.position.set(BOOK_X, 1.5, -3.3); bookG.rotation.x = -0.5;
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.1), pxMap(M(0x7a3a5a, 0.7), 'cloth', 2)); bookG.add(cover);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.26, 0.96), M(0xf3e7c9, 0.9)); pages.position.y = 0.02; bookG.add(pages);
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.24), pxMap(M(0xf4c04a, 0.4, 0.6), 'metal', 2)); clasp.position.set(0.7, 0, 0); bookG.add(clasp);
    this._bookGlow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), glowM(0xb97bff, 0.16)); this._bookGlow.position.y = 0.3; bookG.add(this._bookGlow);
    G.add(bookG); this._book = bookG;
    // ===== the front DOOR (right end) =====
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.4, 0.6), woodD); doorFrame.position.set(DOOR_X, 2.2, -5); G.add(doorFrame);
    const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 3.7, 0.3), wood); doorSlab.position.set(DOOR_X, 1.85, -4.85); G.add(doorSlab);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), M(0xf4c04a, 0.4, 0.6)); knob.position.set(DOOR_X - 0.6, 1.8, -4.65); G.add(knob);
    // ===== the WISP — resident chef, hovering over the kitchen =====
    const wisp = this.wisp = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), glowM(0xdff4ff, 0.95));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 14), glowM(0x7fd0ff, 0.22));
    const wl = new THREE.PointLight(0x9fe8ff, 1.2, 9);
    wisp.add(core, halo, wl); wisp.userData = { core, halo };
    wisp.position.set(KITCHEN_X - 1.4, 2.4, -3.2);
    G.add(wisp);
    // a little chef's hat for the wisp — the crew demanded it
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.26, 10), M(0xf6efe2, 0.9)); hat.position.y = 0.34; wisp.add(hat);
    const hatPuff = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), M(0xf6efe2, 0.9)); hatPuff.position.y = 0.48; hatPuff.scale.y = 0.7; wisp.add(hatPuff);
    // clickable proxies (invisible-but-raycastable slabs)
    this._addHit('kitchen', KITCHEN_X - 0.5, 1.6, -3.4, 8, 3.4, 3);
    this._addHit('book', BOOK_X, 1.4, -3.3, 2.2, 2.4, 1.6);
    this._addHit('bell', BELL_X, 1.4, -0.3, 1.4, 1.2, 1.2);
    this._addHit('door', DOOR_X, 2, -4.8, 3, 4.4, 1.6);

    // ===== the DÉCOR pass — what makes the hall feel warm & lived-in =====
    this._plants = []; this._candles = [];
    const leafM = pxMap(M(0x3f7a3a, 0.85), 'leaf', 3), leafM2 = pxMap(M(0x5aa04a, 0.85), 'leaf', 3);
    const potM = pxMap(M(0xb0623a, 0.8), 'stone', 3);
    // ceiling beams running the length of the hall
    for (const bx of [-6, 4, 14, 24]) { const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 11), woodD); beam.position.set(bx, 7.4, -0.4); G.add(beam); }
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(70, 0.6, 0.6), woodD); ridge.position.set(9, 7.6, -2.5); G.add(ridge);
    // a grand stone HEARTH between two windows, with a live fire
    const hx = 7.0;
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 0.8), pxMap(M(0x6a6660, 0.96), 'stone', 4)); hearth.position.set(hx, 1.6, -4.7); G.add(hearth);
    const hMouth = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.7, 0.4), M(0x140a06, 1)); hMouth.position.set(hx, 1.15, -4.4); G.add(hMouth);
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.34, 1.1), woodD); mantel.position.set(hx, 3.4, -4.55); G.add(mantel);
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 7), pxMap(M(0x3a2414, 0.9), 'wood', 2)); logs.rotation.z = Math.PI / 2; logs.position.set(hx, 0.6, -4.35); G.add(logs);
    this._hearthFire = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 10), glowM(0xff9a3a, 0.9)); this._hearthFire.position.set(hx, 1.15, -4.3); G.add(this._hearthFire);
    const hCore = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), glowM(0xffe27a, 0.95)); hCore.position.set(hx, 1.1, -4.25); G.add(hCore);
    const hLight = new THREE.PointLight(0xff8a3a, 2.2, 16); hLight.position.set(hx, 1.4, -3.6); G.add(hLight);
    const pot2 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.4, 8), M(0x8a5a34, 0.6)); pot2.position.set(hx, 3.75, -4.5); G.add(pot2); // a mantel jar
    // framed paintings on the plaster
    for (const [px, col] of [[-2, 0x2a5a7a], [16.5, 0x6a4a2a], [22.5, 0x5a2a4a]]) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 0.12), pxMap(M(0x6a4a28, 0.7), 'wood', 2)); fr.position.set(px, 5.2, -4.94); G.add(fr);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), pxMap(M(col, 0.9), 'cloth', 3)); pic.position.set(px, 5.2, -4.86); G.add(pic);
    }
    // wall candle sconces (warm, flickering)
    for (const cx of [-3.5, 13, 20]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.28, 8), pxMap(M(0x3a2a1a, 0.8), 'metal', 2)); cup.position.set(cx, 3.6, -4.85); G.add(cup);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), glowM(0xffd9a0, 0.95)); fl.position.set(cx, 3.82, -4.8); G.add(fl); this._candles.push(fl);
      const sl = new THREE.PointLight(0xffca88, 0.7, 8); sl.position.set(cx, 3.9, -4.2); G.add(sl);
    }
    // potted plants standing along the floor (gently sway)
    for (const px of [-6.5, -0.5, 5.5, 11.5, 17.5, 23.5, 29]) {
      const plant = new THREE.Group(); plant.position.set(px, 0, -4.2);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.55, 9), potM); pot.position.y = 0.28; plant.add(pot);
      for (let k = 0; k < 5; k++) { const blade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.0 + Math.random() * 0.5, 5), k % 2 ? leafM : leafM2); blade.position.set((Math.random() - 0.5) * 0.35, 0.9 + Math.random() * 0.2, (Math.random() - 0.5) * 0.35); blade.rotation.z = (Math.random() - 0.5) * 0.5; plant.add(blade); }
      G.add(plant); this._plants.push(plant);
    }
    // hanging herb bundles + copper pots over the kitchen
    for (const hxk of [KITCHEN_X - 2.6, KITCHEN_X - 1.4, KITCHEN_X - 0.2]) {
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), woodD); str.position.set(hxk, 3.7, -4.6); G.add(str);
      const bundle = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 6), leafM); bundle.position.set(hxk, 3.3, -4.6); bundle.rotation.x = Math.PI; G.add(bundle);
    }
    // a bar shelf of colourful bottles beside the pass
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.14, 0.5), woodD); shelf.position.set(PASS_X, 2.5, -4.6); G.add(shelf);
    const bottleCols = [0x6fb08a, 0xb04a4a, 0x4a7ab0, 0xc9a24a, 0x8a5ad0, 0x6fb08a, 0xb04a4a];
    for (let i = 0; i < 7; i++) { const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.42, 8), M(bottleCols[i], 0.4)); bot.position.set(PASS_X - 1.9 + i * 0.62, 2.78, -4.6); G.add(bot); }
    // a welcome runner from the door
    const runner = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 4.5), pxMap(M(0x8a4a3a, 0.98), 'cloth', 4)); runner.position.set(DOOR_X - 0.5, 0.04, -2.4); G.add(runner);

    pxDress(G);
    outlineGroup(G, { thick: 0.035 });
    this.refreshPlots();
  }
  _addHit(id, x, y, z, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(x, y, z); m.userData.id = id; m.userData.isHit = true; m.userData.noOutline = true;
    this.group.add(m); this._hit.push(m);
    return m;
  }

  // ---------- table plots (rebuilt whenever something is bought) ----------
  refreshPlots() {
    for (const id in this._plotGroups) { const g = this._plotGroups[id]; g.traverse(o => { if (o.isMesh && !o.userData.isOutline) o.geometry.dispose(); }); this.group.remove(g); }
    this._plotGroups = {}; this._forSale = [];
    this._hit = this._hit.filter(h => !String(h.userData.id).startsWith('plot:') || (this.group.remove(h), false));
    const plots = meta.restoPlots();
    for (const plot of PLOTS) {
      const own = plots[plot.id];
      const g = new THREE.Group(); g.position.set(plot.x, 0, TABLE_Z);
      if (!own) {
        // FOR SALE: a pulsing dashed square + a little sign
        const frame = new THREE.Group();
        for (const [fx, fz, fw, fd] of [[0, -1.4, 2.8, 0.12], [0, 1.4, 2.8, 0.12], [-1.4, 0, 0.12, 2.8], [1.4, 0, 0.12, 2.8]]) {
          const seg = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.06, fd), glowM(0xb9ff7a, 0.5));
          seg.position.set(fx, 0.06, fz); frame.add(seg);
        }
        g.add(frame); this._forSale.push(frame);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 6), M(0x4a3018, 0.9)); post.position.set(0, 0.45, 0); g.add(post);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.1), M(0xe2cfa4, 0.9)); sign.position.set(0, 1.05, 0); g.add(sign);
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10), M(0xf4c04a, 0.4, 0.5)); coin.rotation.x = Math.PI / 2; coin.position.set(0, 1.05, 0.08); g.add(coin);
      } else {
        // the TABLE, by tier
        const tier = own.tier || 1;
        const topCol = tier >= 4 ? 0xd8cdb4 : tier >= 3 ? 0x8a5a34 : 0x6a4a2c;
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 12), pxMap(M(topCol, tier >= 4 ? 0.5 : 0.8), tier >= 4 ? 'stone' : 'wood', 3));
        top.position.y = 0.95; top.castShadow = true; g.add(top);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.95, 8), M(0x4a3018, 0.9)); leg.position.y = 0.47; g.add(leg);
        if (tier >= 2) { const cloth = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.05, 0.1, 12), pxMap(M(tier >= 4 ? 0x7a2a28 : 0xf3e7c9, 0.95), 'cloth', 3)); cloth.position.y = 1.03; g.add(cloth); }
        if (tier >= 3) { const trim = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.05, 6, 18), M(0xf4c04a, 0.5, 0.5)); trim.rotation.x = Math.PI / 2; trim.position.y = 1.0; g.add(trim); }
        if (tier >= 4) { // a gilded centrepiece candelabra for the finest tables
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.5, 8), M(0xf4c04a, 0.4, 0.6)); stem.position.y = 1.28; g.add(stem);
          for (const ax of [-0.3, 0, 0.3]) { const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 6), M(0xf6efe2, 0.9)); cw.position.set(ax, 1.6, 0); g.add(cw); const cf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), glowM(0xffd07a, 0.95)); cf.position.set(ax, 1.78, 0); g.add(cf); g.userData.flame = cf; }
        }
        // CHAIRS, by tier (two, flanking)
        const ct = own.chairs || 1;
        for (const sx of [-1, 1]) {
          const ch = new THREE.Group(); ch.position.set(sx * 1.7, 0, 0.1); ch.rotation.y = -sx * Math.PI / 2;
          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.72), pxMap(M(0x6a4a2c, 0.9), 'wood', 2)); seat.position.y = 0.62; ch.add(seat);
          for (const [lx2, lz2] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) { const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), M(0x4a3018, 0.9)); l2.position.set(lx2, 0.31, lz2); ch.add(l2); }
          if (ct >= 2) { const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.12), pxMap(M(ct >= 4 ? 0x8a5a34 : 0x6a4a2c, 0.9), 'wood', 2)); back.position.set(0, 1.1, -0.3); ch.add(back); }
          if (ct >= 3) { const cush = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.66), pxMap(M(ct >= 4 ? 0x7a2a5a : 0x7a2a28, 0.95), 'cloth', 2)); cush.position.y = 0.72; ch.add(cush); }
          if (ct >= 4) { // padded armrests + a carved crown — a throne to dine in
            for (const ax of [-0.42, 0.42]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.6), pxMap(M(0x8a5a34, 0.9), 'wood', 2)); arm.position.set(ax, 0.86, -0.02); ch.add(arm); }
            const crown = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.14), M(0xf4c04a, 0.4, 0.5)); crown.position.set(0, 1.56, -0.3); ch.add(crown);
          }
          ch.userData.seatX = plot.x + sx * 1.7; ch.userData.side = sx;
          g.add(ch);
        }
        // ACCESSORY, by tier
        const deco = own.deco || 0;
        if (deco >= 1 && tier < 4) { const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 6), M(0xf6efe2, 0.9)); candle.position.y = 1.2; g.add(candle); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), glowM(0xffd07a, 0.95)); fl.position.y = 1.42; g.add(fl); g.userData.flame = fl; }
        if (deco >= 2) { const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.26, 8), M(0x56b8ff, 0.6)); vase.position.set(0.4, 1.15, 0.2); g.add(vase); const flower = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), M(0xff9ad0, 0.8)); flower.position.set(0.4, 1.36, 0.2); g.add(flower); const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 5), M(0x3f7a3a, 0.85)); stem.position.set(0.4, 1.26, 0.2); g.add(stem); }
        if (deco >= 3) { // a little brass lantern strung on a hook — cosy glow
          const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 5, 10), M(0x8a5a2e, 0.5)); hook.position.set(-0.45, 1.5, 0.2); g.add(hook);
          const lant = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), pxMap(M(0xc9a24a, 0.6), 'metal', 2)); lant.position.set(-0.45, 1.22, 0.2); g.add(lant);
          const glow = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), glowM(0xffcf7a, 0.95)); glow.position.set(-0.45, 1.22, 0.2); g.add(glow); g.userData.flame2 = glow;
        }
      }
      pxDress(g);
      outlineGroup(g, { thick: 0.03 });
      this.group.add(g);
      this._plotGroups[plot.id] = g;
      this._addHit('plot:' + plot.id, plot.x, 0.9, TABLE_Z, 3.4, 2.2, 3.4);
    }
  }
  ownedPlots() { const p = meta.restoPlots(); return PLOTS.filter(pl => p[pl.id]); }

  // ---------- mode & scene flow ----------
  show(v) { this.group.visible = v; if (!v) this.closePanel(); }

  // ---------- clicks ----------
  onSelect(x, y) {
    if (this._panel) return;
    if (this.game.ui.overlayActive && this.game.ui.overlayActive()) return; // a cook overlay owns the tap
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    if (this.mode === 'service') { this._serviceSelect(ndc); return; }
    this._ray.setFromCamera(ndc, this.game.camera);
    const hits = this._ray.intersectObjects(this._hit, false);
    if (!hits.length) return;
    const id = hits[0].object.userData.id;
    this.game.audio.play('click');
    if (id === 'kitchen') this._panelKitchen();
    else if (id === 'book') this._panelBook();
    else if (id === 'bell') this._panelBell();
    else if (id === 'door') this.game.openWorldMap(); // the door heads out to hunt ingredients
    else if (id.startsWith('plot:')) this._panelPlot(id.slice(5));
  }

  // ---------- the parchment pop-up panels (in-world management UI) ----------
  _openPanel(html) {
    this.closePanel();
    const ov = document.createElement('div'); ov.id = 'restopanel';
    ov.innerHTML = `<div class="rp-card">${html}</div>`;
    document.body.appendChild(ov); this._panel = ov;
    ov.addEventListener('pointerdown', (e) => { if (e.target === ov) this.closePanel(); });
    void ov.offsetWidth; ov.classList.add('show');
    return ov;
  }
  closePanel() { if (this._panel) { this._panel.remove(); this._panel = null; } }
  _goldChip() { return `<span class="rp-gold">${meta.gold()} g</span>`; }
  _panelPlot(pid) {
    const plots = meta.restoPlots(), own = plots[pid];
    const g = meta.gold();
    let html;
    if (!own) {
      html = `<div class="rp-head"><span>AN EMPTY CORNER</span><button class="btn rp-x">✕</button></div>
        <div class="rp-body">A table would fit right here. More tables, more hungry mouths a night.</div>
        <div class="rp-row"><button class="btn rp-buy" data-a="buy" ${g >= COSTS.table[0] ? '' : 'disabled'}>BUY TABLE · ${COSTS.table[0]} g</button>${this._goldChip()}</div>`;
    } else {
      const rows = [];
      if ((own.tier || 1) < 4) { const c = COSTS.table[own.tier || 1]; rows.push(`<button class="btn rp-buy" data-a="table" ${g >= c ? '' : 'disabled'}>FANCIER TABLE · ${c} g</button>`); }
      if ((own.chairs || 1) < 4) { const c = COSTS.chairs[(own.chairs || 1) - 1]; rows.push(`<button class="btn rp-buy" data-a="chairs" ${g >= c ? '' : 'disabled'}>BETTER CHAIRS · ${c} g</button>`); }
      if ((own.deco || 0) < 3) { const c = COSTS.deco[own.deco || 0]; rows.push(`<button class="btn rp-buy" data-a="deco" ${g >= c ? '' : 'disabled'}>ADD ACCESSORY · ${c} g</button>`); }
      html = `<div class="rp-head"><span>TABLE ${pid.slice(1) * 1 + 1}</span><button class="btn rp-x">✕</button></div>
        <div class="rp-body">table ★${own.tier || 1} · chairs ★${own.chairs || 1} · accessories ${own.deco || 0}/3<br>
        <span class="rp-dim">finer furniture = happier, more patient diners</span></div>
        <div class="rp-row">${rows.join('') || '<span class="rp-dim">fully appointed — a lovely corner</span>'}${this._goldChip()}</div>`;
    }
    const ov = this._openPanel(html);
    ov.querySelector('.rp-x').onclick = () => this.closePanel();
    for (const b of ov.querySelectorAll('.rp-buy')) b.onclick = () => {
      const a = b.dataset.a;
      const cur = meta.restoPlots()[pid];
      let cost, next;
      if (a === 'buy') { cost = COSTS.table[0]; next = { tier: 1, chairs: 1, deco: 0 }; }
      else if (a === 'table') { cost = COSTS.table[cur.tier || 1]; next = { ...cur, tier: (cur.tier || 1) + 1 }; }
      else if (a === 'chairs') { cost = COSTS.chairs[(cur.chairs || 1) - 1]; next = { ...cur, chairs: (cur.chairs || 1) + 1 }; }
      else { cost = COSTS.deco[cur.deco || 0]; next = { ...cur, deco: (cur.deco || 0) + 1 }; }
      if (!meta.spendGold(cost)) { this.game.ui.toast('Not enough gold.'); return; }
      meta.restoSetPlot(pid, next);
      this.game.audio.play('levelup');
      this.game.ui.setGold(meta.gold());
      this.refreshPlots();
      this._panelPlot(pid); // re-open with fresh numbers
    };
  }
  _panelKitchen() {
    const ov = this._openPanel(`<div class="rp-head"><span>THE KITCHEN</span><button class="btn rp-x">✕</button></div>
      <div class="rp-body">The wisp runs the stove on service nights. Practice dishes yourself to raise their mastery — masters charge more per plate.</div>
      <div class="rp-row"><button class="btn rp-menu">OPEN THE MENU · PRACTICE</button></div>`);
    ov.querySelector('.rp-x').onclick = () => this.closePanel();
    ov.querySelector('.rp-menu').onclick = () => { this.closePanel(); this.game.ui.showMenuBook(this.game); };
  }
  _panelBook() {
    const ov = this._openPanel(`<div class="rp-head"><span>THE GREAT BOOK</span><button class="btn rp-x">✕</button></div>
      <div class="rp-body">Two halves, one spine: the menu you serve, and the stars you once knew.</div>
      <div class="rp-row"><button class="btn rp-menu">THE MENU</button><button class="btn rp-magic">✦ MAGIC — THE ASTRAL REALM</button></div>`);
    ov.querySelector('.rp-x').onclick = () => this.closePanel();
    ov.querySelector('.rp-menu').onclick = () => { this.closePanel(); this.game.ui.showMenuBook(this.game); };
    ov.querySelector('.rp-magic').onclick = () => { this.closePanel(); this.game.ui.showZodiac(this.game); };
  }
  _panelBell() {
    if (!this.ownedPlots().length) { this.game.ui.toast('🔔 Buy at least one table before opening for the night.'); return; }
    const covers = 3 + this.ownedPlots().length * 2;
    const ov = this._openPanel(`<div class="rp-head"><span>OPEN FOR THE NIGHT?</span><button class="btn rp-x">✕</button></div>
      <div class="rp-body">${covers} covers expected. The wisp cooks — YOU run plates from the pass before patience runs out.</div>
      <div class="rp-row"><button class="btn rp-open">RING THE BELL</button></div>`);
    ov.querySelector('.rp-x').onclick = () => this.closePanel();
    ov.querySelector('.rp-open').onclick = () => { this.closePanel(); this.startService(); };
  }

  // ---------- SERVICE (click-driven): guests arrive & wait; TAP a guest with a
  // ❓ to take their order; a quick cook mini-game plays; then tap the WISP (or the
  // SERVE button) and it flies the plate over to them. ----------
  startService() {
    const g = this.game;
    this.mode = 'service';
    g.state = 'resto';
    g.input.pointMode = true;          // taps pick guests / the wisp
    g.wizard.setVisible(false);        // you manage; the wisp does the running
    const covers = 3 + this.ownedPlots().length * 2;
    this.svc = { covers, seated: [], plates: [], served: 0, walked: 0, earned: 0, spawnT: 0.7, endT: 0, done: false, busy: false, wispJob: null };
    g.audio.play('levelup');
    g.ui.wispSay('🔔 Open! Tap a guest showing ❓ to take their order, cook it, then tap ME to serve it.', { ms: 6000 });
    g.ui.showJob('🍽 Service Night', 'tap a ❓ guest → cook → tap the wisp to serve');
    g.ui.updateJob(0, covers);
    if (g.ui.el.btnRestoServe) { g.ui.el.btnRestoServe.classList.remove('hidden'); if (g.ui.el.btnRestoServe.lastChild) g.ui.el.btnRestoServe.lastChild.textContent = ' Send Wisp'; }
    const arrows = document.getElementById('resto-arrows'); if (arrows) arrows.classList.remove('hidden');
  }
  endService(early) {
    const g = this.game, sv = this.svc;
    for (const d of (sv ? [...sv.seated] : [])) this._removeDiner(d, true);
    if (sv) for (const p of sv.plates) if (p.mesh) this.group.remove(p.mesh);
    this.svc = null;
    this.mode = 'manage';
    g.state = 'resto';
    g.input.pointMode = true;
    g._restoNudge = 0;
    g.wizard.setVisible(false);
    g.ui.hideJob();
    if (g.ui.el.btnRestoServe) g.ui.el.btnRestoServe.classList.add('hidden');
    if (sv) g.ui.toast(early ? `🔔 Closed early — ${sv.earned} g earned.` : `🌙 A fine night! ${sv.served}/${sv.covers} served · ${sv.earned} g earned.`);
    if (!early && sv && sv.served >= sv.covers && g.audio) g.audio.play('win');
  }
  _freeSeat() {
    const taken = new Set(this.svc.seated.map(d => d.seatKey));
    for (const pl of this.ownedPlots()) for (const side of [-1, 1]) {
      const key = pl.id + ':' + side;
      if (!taken.has(key)) return { key, x: pl.x + side * 1.7, plot: pl };
    }
    return null;
  }
  _pickOrder() {
    const inv = meta.pantry();
    const options = RECIPES.filter(r => r.id === 'alebread' || canCook(r, inv));
    const fancy = options.filter(r => r.id !== 'alebread');
    return (fancy.length && Math.random() < 0.75) ? fancy[(Math.random() * fancy.length) | 0] : options[(Math.random() * options.length) | 0];
  }
  _dishSprite(recipeId, scale = 1.1) {
    const cv = spriteCanvas('dish_' + recipeId, { scale: 6 });
    const mat = cv ? new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })
      : new THREE.SpriteMaterial({ color: 0xf3e7c9 });
    if (mat.map) { mat.map.magFilter = THREE.NearestFilter; mat.map.minFilter = THREE.NearestFilter; }
    const s = new THREE.Sprite(mat);
    s.material.color && s.material.color.setScalar(0.85);
    s.scale.set(scale, scale, scale);
    return s;
  }
  // a round "?" thought bubble sprite for a guest ready to order
  _askBubble() {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(250,244,226,0.98)'; x.beginPath(); x.arc(48, 42, 34, 0, 6.28); x.fill();
    x.lineWidth = 5; x.strokeStyle = '#2a1a10'; x.stroke();
    x.beginPath(); x.moveTo(36, 70); x.lineTo(48, 90); x.lineTo(58, 68); x.closePath(); x.fillStyle = 'rgba(250,244,226,0.98)'; x.fill(); x.stroke();
    x.fillStyle = '#c85a3a'; x.font = 'bold 48px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 48, 40);
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.material.color.setScalar(0.85); s.scale.set(1.1, 1.1, 1.1);
    return s;
  }
  _spawnDiner() {
    const seat = this._freeSeat(); if (!seat) return;
    const kinds = ['patron', 'dwarf', 'barmaid', 'noble', 'rogue'];
    const mesh = buildCharModel(kinds[(Math.random() * kinds.length) | 0]);
    mesh.scale.multiplyScalar(0.9);
    mesh.position.set(DOOR_X - 1, 0, LANE_Z - 0.6);
    this.group.add(mesh);
    const plot = meta.restoPlots()[seat.plot.id];
    const patience = 46 + (plot.chairs || 1) * 7 + (plot.deco || 0) * 6;
    const bub = this._askBubble(); bub.visible = false; bub.position.set(seat.x, 3.15, TABLE_Z); this.group.add(bub);
    const d = { mesh, seat, seatKey: seat.key, state: 'walk', t: 0, order: null, bubble: null, ask: bub, quality: 1, patience, patMax: patience };
    this.svc.seated.push(d);
    this.svc.walked++;
  }
  _removeDiner(d) {
    if (d.bubble) { if (d.bubble.material.map) d.bubble.material.map.dispose(); d.bubble.material.dispose(); this.group.remove(d.bubble); d.bubble = null; }
    if (d.ask) { if (d.ask.material.map) d.ask.material.map.dispose(); d.ask.material.dispose(); this.group.remove(d.ask); d.ask = null; }
    this.group.remove(d.mesh);
    const i = this.svc ? this.svc.seated.indexOf(d) : -1;
    if (i >= 0) this.svc.seated.splice(i, 1);
  }
  // a click landed while serving: on a ❓ guest → take order + cook; on the wisp → serve
  _serviceSelect(ndc) {
    const sv = this.svc; if (!sv || sv.busy) return;
    this._ray.setFromCamera(ndc, this.game.camera);
    const wh = this._ray.intersectObject(this.wisp, true);
    let bestD = null, bestDist = wh.length ? wh[0].distance : Infinity;
    for (const d of sv.seated) {
      if (d.state !== 'ready') continue;
      const h = this._ray.intersectObject(d.mesh, true);
      if (h.length && h[0].distance < bestDist) { bestDist = h[0].distance; bestD = d; }
    }
    if (bestD) { this._takeOrder(bestD); return; }
    if (wh.length || sv.plates.length) this.sendWisp();
  }
  // take a guest's order, then play the quick cook mini-game
  _takeOrder(d) {
    const sv = this.svc; const g = this.game;
    const r = this._pickOrder();
    if (r.id !== 'alebread' && !meta.pantrySpend(r.needs)) d.order = RECIPE_BY_ID.alebread; else d.order = r;
    if (d.ask) d.ask.visible = false;
    d.bubble = this._dishSprite(d.order.id, 1.3); d.bubble.position.set(d.seat.x, 3.2, TABLE_Z); this.group.add(d.bubble);
    d.state = 'ordered';
    if (this.game.ui.updatePantryChip) this.game.ui.updatePantryChip();
    g.audio.play('click');
    // the fast cook mini-game (flame timing) — quality feeds the plate & the tip
    sv.busy = true;
    g.ui.showCookTiming(d.order, (quality) => {
      sv.busy = false;
      if (!this.svc || this.svc !== sv) return; // service ended under the overlay
      this._plateUp(d, quality);
    });
  }
  // a finished plate lands on the pass, tagged to its guest
  _plateUp(d, quality) {
    const sv = this.svc, g = this.game;
    d.quality = quality; d.state = 'cooked';
    const slot = sv.plates.length;
    const plate = new THREE.Group();
    const dishS = this._dishSprite(d.order.id, 0.95); dishS.position.y = 0.34; plate.add(dishS);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.06, 12), M(0xf0ead8, 0.5)); plate.add(dish);
    const steam = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), glowM(0xffffff, 0.5)); steam.position.y = 0.55; plate.add(steam);
    plate.position.set(PASS_X - 1.6 + Math.min(slot, 3) * 1.2, 1.42, -0.5);
    this.group.add(plate);
    sv.plates.push({ diner: d, recipe: d.order.id, quality, mesh: plate });
    g.audio.play(quality >= 1.3 ? 'win' : 'xp');
    if (quality >= 1.3) g.ui.castWord && g.ui.castWord('PERFECT!', { color: '#ffd76a', big: true });
    g.ui.wispSay('🍽 Plated! Tap me to run it over.', { ms: 1800 });
  }
  // send the wisp to deliver the oldest ready plate
  sendWisp() {
    const sv = this.svc; if (!sv || sv.wispJob || !sv.plates.length) {
      if (sv && !sv.plates.length && !sv.wispJob) this.game.ui.wispSay('Nothing plated yet — take an order first!', { tone: 'warn' });
      return;
    }
    const p = sv.plates.shift();
    if (!p.diner || p.diner.state !== 'cooked') { this.group.remove(p.mesh); this.sendWisp(); return; } // guest already gone; try next
    this.group.remove(p.mesh);
    // a floating plate rides under the wisp
    const carried = this._dishSprite(p.recipe, 0.8); carried.position.set(0, -0.5, 0); this.wisp.add(carried);
    sv.wispJob = { plate: p, carried, phase: 'go', from: this.wisp.position.clone() };
    this.game.audio.play('gust');
  }
  interact() { this.sendWisp(); } // the SERVE button / E routes here during service
  _serve(d) {
    const g = this.game, sv = this.svc;
    const mastery = meta.recipeMastery(d.order.id);
    const tip = d.patience / d.patMax > 0.5 ? 1.25 : 1;
    const zg = meta.zodiacHas('capricorn') ? 1.2 : 1;
    const pay = Math.max(1, Math.round(platePrice(d.order, mastery, Math.min(1.5, d.quality)) * tip * zg));
    meta.addGold(pay); sv.earned += pay; sv.served++;
    if (d.quality >= 1.3 || Math.random() < 0.28) meta.bumpMastery && meta.bumpMastery(d.order.id);
    meta.notePlateServed && meta.notePlateServed();
    d.state = 'eating'; d.t = 0;
    if (d.bubble) { if (d.bubble.material.map) d.bubble.material.map.dispose(); d.bubble.material.dispose(); this.group.remove(d.bubble); d.bubble = null; }
    g.audio.play('win');
    g.particles.burst({ pos: new THREE.Vector3(d.seat.x, 2, TABLE_Z), color: 0xffd98a, count: 12, speed: 3.5, size: 0.2, life: 0.6, blend: 'add' });
    g.ui.castWord && g.ui.castWord('+' + pay + ' g' + (tip > 1 ? ' ★TIP' : ''), { color: '#ffd76a' });
    g.ui.setGold(meta.gold());
    g.ui.updateJob(sv.served, sv.covers);
  }

  // ---------- per-frame ----------
  update(dt) {
    if (!this._built) return;
    this.t += dt;
    const g = this.game;
    // ambience: lamps flicker, stove fire dances, book breathes, plants sway, bell glints
    for (const l of this._lamps) { l.bulb.material.opacity = 0.75 + Math.sin(this.t * 8 + l.seed) * 0.14; l.li.intensity = 1.35 + Math.sin(this.t * 10 + l.seed) * 0.22; }
    if (this._stoveFire) { this._stoveFire.scale.y = 0.9 + Math.sin(this.t * 11) * 0.2; this._stoveFire.material.opacity = 0.8 + Math.sin(this.t * 13) * 0.12; }
    if (this._hearthFire) { this._hearthFire.scale.y = 0.85 + Math.sin(this.t * 9) * 0.18; this._hearthFire.material.opacity = 0.8 + Math.sin(this.t * 12) * 0.14; }
    this._bookGlow.material.opacity = 0.1 + Math.abs(Math.sin(this.t * 1.4)) * 0.12;
    for (const f of this._forSale) f.children.forEach(c => { c.material.opacity = 0.3 + Math.abs(Math.sin(this.t * 2.2)) * 0.3; });
    for (const id in this._plotGroups) { const ud = this._plotGroups[id].userData; if (ud.flame) ud.flame.material.opacity = 0.7 + Math.abs(Math.sin(this.t * 6 + ud.flame.position.x)) * 0.28; if (ud.flame2) ud.flame2.material.opacity = 0.72 + Math.abs(Math.sin(this.t * 5.3 + id.length)) * 0.24; }
    if (this._plants) for (const p of this._plants) p.rotation.z = Math.sin(this.t * 1.3 + p.position.x) * 0.05;
    if (this._candles) for (const fl of this._candles) fl.material.opacity = 0.7 + Math.abs(Math.sin(this.t * 7 + fl.position.x)) * 0.25;
    // camera pans in BOTH modes (drag / arrows)
    const orb = g.input.consumeOrbit ? g.input.consumeOrbit() : { dx: 0, dy: 0 };
    this.camX = Math.max(CAM_MIN, Math.min(CAM_MAX, this.camX - orb.dx * 0.035));
    const mv = g.moveVector ? g.moveVector() : { x: 0 };
    this.camX = Math.max(CAM_MIN, Math.min(CAM_MAX, this.camX + mv.x * dt * 14));
    // the wisp: idle bob when free, an eager wiggle when a plate's up to run
    const w = this.wisp, sv = this.svc;
    if (!sv || !sv.wispJob) {
      const eager = sv && sv.plates.length;
      const tx = KITCHEN_X - 1.4 + Math.sin(this.t * 1.2) * 0.5;
      w.position.x += (tx - w.position.x) * Math.min(1, dt * 5);
      w.position.y = 2.3 + Math.sin(this.t * (eager ? 5 : 2)) * (eager ? 0.2 : 0.1);
    }
    w.userData.core.material.opacity = 0.75 + Math.sin(this.t * 6) * 0.2;
    if (this.mode !== 'service' || !sv) return;
    this._updateService(dt);
  }
  _updateService(dt) {
    const g = this.game, sv = this.svc;
    // seat & spawn flow
    sv.spawnT -= dt;
    if (sv.spawnT <= 0 && sv.walked < sv.covers) { this._spawnDiner(); sv.spawnT = 3.2 + Math.random() * 2.4; }
    for (const d of [...sv.seated]) {
      d.t += dt;
      if (d.state === 'walk') {
        const dx = d.seat.x - d.mesh.position.x;
        d.mesh.position.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 3.8);
        d.mesh.position.z += (TABLE_Z + 0.2 - d.mesh.position.z) * Math.min(1, dt * 2);
        d.mesh.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
        d.mesh.position.y = Math.abs(Math.sin(d.t * 9)) * 0.08;
        if (Math.abs(dx) < 0.15) { d.state = 'think'; d.t = 0; d.mesh.rotation.y = Math.PI; d.mesh.position.y = 0.45; d.mesh.position.x = d.seat.x; }
      } else if (d.state === 'think') {
        if (d.t > 0.9) { d.state = 'ready'; d.t = 0; if (d.ask) d.ask.visible = true; }
      } else if (d.state === 'ready' || d.state === 'ordered' || d.state === 'cooked') {
        d.patience -= dt;
        const bob = d.state === 'ready' ? d.ask : d.bubble;
        if (bob) {
          bob.position.y = 3.1 + Math.sin(this.t * 2.4) * 0.08;
          const frac = Math.max(0, d.patience / d.patMax);
          bob.material.color.setScalar(frac < 0.3 ? (Math.sin(this.t * 8) > 0 ? 1 : 0.4) : 0.85); // angry blink low on patience
        }
        if (d.patience <= 0 && d.state !== 'cooked') { // walked out (a cooked plate is safe — the wisp is coming)
          this._removeDiner(d);
          g.ui.wispSay('💢 A guest gave up and left — quicker next time!', { tone: 'warn' });
          g.audio.play('hurt');
        }
      } else if (d.state === 'eating') {
        if (d.t > 1.5) { this._removeDiner(d); g.particles.burst({ pos: new THREE.Vector3(d.seat.x, 1.4, TABLE_Z), color: 0xb9ff7a, count: 6, speed: 2.5, size: 0.16, life: 0.5, blend: 'add' }); }
      }
    }
    // the wisp delivers
    if (sv.wispJob) this._flyWisp(dt);
    // night over?
    const active = sv.seated.length > 0 || sv.plates.length > 0 || !!sv.wispJob;
    if (!sv.done && sv.walked >= sv.covers && !active) { sv.done = true; sv.endT = 0.9; }
    if (sv.done) { sv.endT -= dt; if (sv.endT <= 0) this.endService(false); }
  }
  _flyWisp(dt) {
    const sv = this.svc, w = this.wisp, job = sv.wispJob, d = job.plate.diner;
    if (job.phase === 'go') {
      const tx = d.seat.x, tz = TABLE_Z + 0.9;
      w.position.x += (tx - w.position.x) * Math.min(1, dt * 3.2);
      w.position.z += (tz - w.position.z) * Math.min(1, dt * 3.2);
      w.position.y = 2.4 + Math.sin(this.t * 8) * 0.12;
      if (Math.abs(w.position.x - tx) < 0.3 && Math.abs(w.position.z - tz) < 0.3) {
        // drop the plate: serve
        if (job.carried) w.remove(job.carried);
        if (d.state === 'cooked') this._serve(d); // (guest may have been removed by an edge case)
        job.phase = 'back';
      }
    } else {
      const tx = KITCHEN_X - 1.4, tz = -3.2;
      w.position.x += (tx - w.position.x) * Math.min(1, dt * 3);
      w.position.z += (tz - w.position.z) * Math.min(1, dt * 3);
      if (Math.abs(w.position.x - tx) < 0.4) { sv.wispJob = null; w.position.z = -3.2; }
    }
  }
}

// pixel grain for any plain flat-shaded material in the set
function pxDress(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || o.userData.isHit || !o.material || !o.material.isMeshStandardMaterial) return;
    const m = o.material; if (m.map || m.transparent) return;
    const c = m.color;
    const kind = m.metalness > 0.35 ? 'metal' : (c.g > c.r && c.g > c.b) ? 'leaf' : (c.r > 0.32 && c.b < c.r * 0.85) ? 'wood' : 'stone';
    pxMap(m, kind, 2);
  });
}
