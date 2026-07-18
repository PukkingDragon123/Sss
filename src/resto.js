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

// five table plots along the dining floor + fixed landmarks
const PLOTS = [{ id: 'p0', x: 1.5 }, { id: 'p1', x: 7.5 }, { id: 'p2', x: 13.5 }, { id: 'p3', x: 19.5 }, { id: 'p4', x: 25.5 }];
const TABLE_Z = -1.1, LANE_Z = 2.0;         // tables sit back; the chef runs the front lane
const PASS_X = -5.2;                        // where finished plates wait
const KITCHEN_X = -10.5, BOOK_X = -1.8, DOOR_X = 30.5, BELL_X = -4.2;
const COSTS = { table: [140, 260, 460], chairs: [90, 170], deco: [70, 130] };

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
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 12), pxMap(M(tier >= 3 ? 0x8a5a34 : 0x6a4a2c, 0.8), 'wood', 3));
        top.position.y = 0.95; top.castShadow = true; g.add(top);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.95, 8), M(0x4a3018, 0.9)); leg.position.y = 0.47; g.add(leg);
        if (tier >= 2) { const cloth = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.05, 0.1, 12), pxMap(M(0xf3e7c9, 0.95), 'cloth', 3)); cloth.position.y = 1.03; g.add(cloth); }
        if (tier >= 3) { const trim = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.05, 6, 18), M(0xf4c04a, 0.5, 0.5)); trim.rotation.x = Math.PI / 2; trim.position.y = 1.0; g.add(trim); }
        // CHAIRS, by tier (two, flanking)
        const ct = own.chairs || 1;
        for (const sx of [-1, 1]) {
          const ch = new THREE.Group(); ch.position.set(sx * 1.7, 0, 0.1); ch.rotation.y = -sx * Math.PI / 2;
          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.72), pxMap(M(0x6a4a2c, 0.9), 'wood', 2)); seat.position.y = 0.62; ch.add(seat);
          for (const [lx2, lz2] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) { const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), M(0x4a3018, 0.9)); l2.position.set(lx2, 0.31, lz2); ch.add(l2); }
          if (ct >= 2) { const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.12), pxMap(M(0x6a4a2c, 0.9), 'wood', 2)); back.position.set(0, 1.1, -0.3); ch.add(back); }
          if (ct >= 3) { const cush = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.66), pxMap(M(0x7a2a28, 0.95), 'cloth', 2)); cush.position.y = 0.72; ch.add(cush); }
          ch.userData.seatX = plot.x + sx * 1.7; ch.userData.side = sx;
          g.add(ch);
        }
        // ACCESSORY, by tier
        const deco = own.deco || 0;
        if (deco >= 1) { const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 6), M(0xf6efe2, 0.9)); candle.position.y = 1.2; g.add(candle); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), glowM(0xffd07a, 0.95)); fl.position.y = 1.42; g.add(fl); g.userData.flame = fl; }
        if (deco >= 2) { const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.26, 8), M(0x56b8ff, 0.6)); vase.position.set(0.4, 1.15, 0.2); g.add(vase); const flower = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), M(0xff9ad0, 0.8)); flower.position.set(0.4, 1.36, 0.2); g.add(flower); }
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

  // ---------- clicks (manage mode) ----------
  onSelect(x, y) {
    if (this.mode !== 'manage' || this._panel) return;
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this._ray.setFromCamera(ndc, this.game.camera);
    const hits = this._ray.intersectObjects(this._hit, false);
    if (!hits.length) return;
    const id = hits[0].object.userData.id;
    this.game.audio.play('click');
    if (id === 'kitchen') this._panelKitchen();
    else if (id === 'book') this._panelBook();
    else if (id === 'bell') this._panelBell();
    else if (id === 'door') this.game.exitResto();
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
      if ((own.tier || 1) < 3) { const c = COSTS.table[own.tier || 1]; rows.push(`<button class="btn rp-buy" data-a="table" ${g >= c ? '' : 'disabled'}>FANCIER TABLE · ${c} g</button>`); }
      if ((own.chairs || 1) < 3) { const c = COSTS.chairs[(own.chairs || 1) - 1]; rows.push(`<button class="btn rp-buy" data-a="chairs" ${g >= c ? '' : 'disabled'}>BETTER CHAIRS · ${c} g</button>`); }
      if ((own.deco || 0) < 2) { const c = COSTS.deco[own.deco || 0]; rows.push(`<button class="btn rp-buy" data-a="deco" ${g >= c ? '' : 'disabled'}>ADD ACCESSORY · ${c} g</button>`); }
      html = `<div class="rp-head"><span>TABLE ${pid.slice(1) * 1 + 1}</span><button class="btn rp-x">✕</button></div>
        <div class="rp-body">table ★${own.tier || 1} · chairs ★${own.chairs || 1} · accessories ${own.deco || 0}/2<br>
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

  // ---------- SERVICE: the wisp cooks, you serve ----------
  startService() {
    const g = this.game;
    this.mode = 'service';
    g.state = 'play';
    g.input.pointMode = false;
    g.wizard.setVisible(true);
    g.wizard.pos.set(-2.5, 0, LANE_Z); g.wizard.vel.set(0, 0, 0);
    const covers = 3 + this.ownedPlots().length * 2;
    this.svc = { covers, seated: [], queue: [], cooking: null, cookT: 0, cookMax: 1, ready: [], carrying: [], served: 0, walked: 0, earned: 0, spawnT: 1.0, endT: 0, done: false };
    g.audio.play('levelup');
    g.ui.wispSay('🔔 We are OPEN! I cook, you carry — grab plates at the pass (E) and match the orders!', { ms: 5200 });
    g.ui.showJob('🍽 Service Night', 'the wisp cooks · YOU serve · E = pick up / serve');
    g.ui.updateJob(0, covers);
  }
  endService(early) {
    const g = this.game, sv = this.svc;
    for (const d of (sv ? sv.seated : [])) this._removeDiner(d, true);
    if (sv) { for (const pl of sv.ready) this.group.remove(pl.mesh); for (const c of sv.carrying) g.wizard.facer.remove(c.mesh); }
    this.svc = null;
    this.mode = 'manage';
    g.state = 'resto';
    g.input.pointMode = true;
    g.wizard.setVisible(false);
    g.ui.hideJob();
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
  _spawnDiner() {
    const seat = this._freeSeat(); if (!seat) return;
    const kinds = ['patron', 'dwarf', 'barmaid', 'noble', 'rogue'];
    const mesh = buildCharModel(kinds[(Math.random() * kinds.length) | 0]);
    mesh.scale.multiplyScalar(0.9);
    mesh.position.set(DOOR_X - 1, 0, LANE_Z - 0.6);
    this.group.add(mesh);
    const patience = 42 + (meta.restoPlots()[seat.plot.id].chairs || 1) * 6 + (meta.restoPlots()[seat.plot.id].deco || 0) * 5;
    const d = { mesh, seat, seatKey: seat.key, state: 'walk', t: 0, order: null, bubble: null, patience, patMax: patience, served: false };
    this.svc.seated.push(d);
    this.svc.walked++;
  }
  _removeDiner(d, silent) {
    if (d.bubble) { if (d.bubble.material.map) d.bubble.material.map.dispose(); d.bubble.material.dispose(); this.group.remove(d.bubble); }
    this.group.remove(d.mesh);
    const i = this.svc ? this.svc.seated.indexOf(d) : -1;
    if (i >= 0) this.svc.seated.splice(i, 1);
  }
  _orderUp(d) {
    const r = this._pickOrder();
    // spend the pantry when the ORDER is taken (the wisp grabs ingredients)
    if (r.id !== 'alebread' && !meta.pantrySpend(r.needs)) { d.order = RECIPE_BY_ID.alebread; }
    else d.order = r;
    d.bubble = this._dishSprite(d.order.id, 1.25);
    d.bubble.position.set(d.seat.x, 3.2, TABLE_Z);
    this.group.add(d.bubble);
    this.svc.queue.push(d);
    if (this.game.ui.updatePantryChip) this.game.ui.updatePantryChip();
  }
  // E pressed on the floor: pick up at the pass, or serve the nearest waiting table
  interact() {
    const g = this.game, sv = this.svc;
    if (!sv) return;
    const wx = g.wizard.pos.x;
    // serve first if lined up with a hungry table and carrying their dish
    for (const d of sv.seated) {
      if (d.state !== 'waitfood' || Math.abs(d.seat.x - wx) > 1.9) continue;
      const ci = sv.carrying.findIndex(c => c.recipe === d.order.id);
      if (ci >= 0) { this._serve(d, sv.carrying[ci]); return; }
    }
    // otherwise pick up at the pass
    if (Math.abs(wx - PASS_X) < 2.2 && sv.ready.length && sv.carrying.length < 2) {
      const pl = sv.ready.shift();
      this.group.remove(pl.mesh);
      const carry = this._dishSprite(pl.recipe, 0.95);
      carry.position.set(sv.carrying.length ? -0.55 : 0.55, 1.6, 0.3);
      g.wizard.facer.add(carry);
      sv.carrying.push({ recipe: pl.recipe, mesh: carry });
      g.audio.play('xp');
      return;
    }
    // helpful nudges
    if (sv.ready.length && sv.carrying.length >= 2) g.ui.wispSay('Hands full, chef — serve those first!', { tone: 'warn' });
    else if (!sv.ready.length && Math.abs(wx - PASS_X) < 2.2) g.ui.wispSay('Nothing plated yet — give me a moment!', { tone: 'warn' });
  }
  _serve(d, carry) {
    const g = this.game, sv = this.svc;
    g.wizard.facer.remove(carry.mesh);
    sv.carrying.splice(sv.carrying.indexOf(carry), 1);
    const mastery = meta.recipeMastery(d.order.id);
    const quality = 0.85 + Math.random() * 0.15 + mastery * 0.05;
    const tip = d.patience / d.patMax > 0.55 ? 1.2 : 1;
    const zg = meta.zodiacHas('capricorn') ? 1.2 : 1;
    const pay = Math.max(1, Math.round(platePrice(d.order, mastery, Math.min(1.5, quality)) * tip * zg));
    meta.addGold(pay); sv.earned += pay; sv.served++;
    meta.notePlateServed && meta.notePlateServed();
    d.state = 'eating'; d.t = 0; d.served = true;
    if (d.bubble) { if (d.bubble.material.map) d.bubble.material.map.dispose(); d.bubble.material.dispose(); this.group.remove(d.bubble); d.bubble = null; }
    g.audio.play('win');
    g.particles.burst({ pos: new THREE.Vector3(d.seat.x, 2, TABLE_Z), color: 0xffd98a, count: 10, speed: 3.5, size: 0.2, life: 0.6, blend: 'add' });
    g.ui.castWord && g.ui.castWord('+' + pay + ' g' + (tip > 1 ? ' ★TIP' : ''), { color: '#ffd76a' });
    g.ui.setGold(meta.gold());
    g.ui.updateJob(sv.served, sv.covers);
  }

  // ---------- per-frame ----------
  update(dt) {
    if (!this._built) return;
    this.t += dt;
    const g = this.game;
    // ambience: lamps flicker, stove fire dances, book breathes, bell glints
    for (const l of this._lamps) { l.bulb.material.opacity = 0.75 + Math.sin(this.t * 8 + l.seed) * 0.14; l.li.intensity = 1.35 + Math.sin(this.t * 10 + l.seed) * 0.22; }
    this._stoveFire.scale.y = 0.9 + Math.sin(this.t * 11) * 0.2; this._stoveFire.material.opacity = 0.8 + Math.sin(this.t * 13) * 0.12;
    this._bookGlow.material.opacity = 0.1 + Math.abs(Math.sin(this.t * 1.4)) * 0.12;
    for (const f of this._forSale) f.children.forEach(c => { c.material.opacity = 0.3 + Math.abs(Math.sin(this.t * 2.2)) * 0.3; });
    for (const id in this._plotGroups) { const fl = this._plotGroups[id].userData && this._plotGroups[id].userData.flame; }
    // the wisp: idle bob in manage, busy stove-dance while cooking
    const w = this.wisp, sv = this.svc;
    const busy = sv && sv.cooking;
    const tx = busy ? KITCHEN_X - 2 + Math.sin(this.t * 6) * 0.9 : KITCHEN_X - 1.4 + Math.sin(this.t * 1.2) * 0.5;
    w.position.x += (tx - w.position.x) * Math.min(1, dt * 5);
    w.position.y = 2.3 + Math.sin(this.t * (busy ? 7 : 2)) * (busy ? 0.16 : 0.1);
    w.userData.core.material.opacity = 0.75 + Math.sin(this.t * 6) * 0.2;
    if (this.mode === 'manage') {
      // free cam: drag pans the floor
      const orb = g.input.consumeOrbit ? g.input.consumeOrbit() : { dx: 0, dy: 0 };
      this.camX = Math.max(-13, Math.min(29, this.camX - orb.dx * 0.035));
      const mv = g.moveVector ? g.moveVector() : { x: 0 };
      this.camX = Math.max(-13, Math.min(29, this.camX + mv.x * dt * 14));
      return;
    }
    // ===== SERVICE =====
    if (!sv) return;
    g.wizard.update(dt, g);
    // keep the chef on the service lane
    g.wizard.pos.z += (LANE_Z - g.wizard.pos.z) * Math.min(1, dt * 8);
    g.wizard.pos.x = Math.max(-12, Math.min(29, g.wizard.pos.x));
    // seat & spawn flow
    sv.spawnT -= dt;
    if (sv.spawnT <= 0 && sv.walked < sv.covers) { this._spawnDiner(); sv.spawnT = 3.5 + Math.random() * 2.5; }
    for (const d of [...sv.seated]) {
      d.t += dt;
      if (d.state === 'walk') {
        const dx = d.seat.x - d.mesh.position.x;
        d.mesh.position.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 2.6);
        d.mesh.position.z += (TABLE_Z + 0.2 - d.mesh.position.z) * Math.min(1, dt * 2);
        d.mesh.rotation.y = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
        d.mesh.position.y = Math.abs(Math.sin(d.t * 9)) * 0.08; // walk bob
        if (Math.abs(dx) < 0.15) { d.state = 'think'; d.t = 0; d.mesh.rotation.y = Math.PI; d.mesh.position.y = 0.45; d.mesh.position.x = d.seat.x; }
      } else if (d.state === 'think') {
        if (d.t > 1.1) { d.state = 'waitfood'; d.t = 0; this._orderUp(d); }
      } else if (d.state === 'waitfood') {
        d.patience -= dt;
        if (d.bubble) {
          d.bubble.position.y = 3.15 + Math.sin(this.t * 2.4) * 0.08;
          const frac = Math.max(0, d.patience / d.patMax);
          d.bubble.material.color.setScalar(frac < 0.3 ? (Math.sin(this.t * 8) > 0 ? 1 : 0.45) : 0.85); // angry blink
        }
        if (d.patience <= 0) { // stormed out
          const qi = sv.queue.indexOf(d); if (qi >= 0) sv.queue.splice(qi, 1);
          if (sv.cooking === d) { sv.cooking = null; }
          this._removeDiner(d);
          g.ui.wispSay('💢 One walked out — faster on the pass, chef!', { tone: 'warn' });
          g.audio.play('hurt');
        }
      } else if (d.state === 'eating') {
        if (d.t > 1.4) {
          this._removeDiner(d);
          g.particles.burst({ pos: new THREE.Vector3(d.seat.x, 1.4, TABLE_Z), color: 0xb9ff7a, count: 6, speed: 2.5, size: 0.16, life: 0.5, blend: 'add' });
        }
      }
    }
    // the WISP cooks the queue, one order at a time
    if (!sv.cooking && sv.queue.length && sv.ready.length < 3) {
      sv.cooking = sv.queue.shift();
      const needsN = Object.keys(sv.cooking.order.needs).length;
      sv.cookMax = 3.4 + needsN * 1.2 - meta.recipeMastery(sv.cooking.order.id) * 0.35;
      sv.cookT = 0;
    }
    if (sv.cooking) {
      sv.cookT += dt;
      if (Math.random() < dt * 6) g.particles.burst({ pos: this.wisp.position.clone().add(new THREE.Vector3(0, -0.6, 0.4)), color: 0xffb35a, count: 2, speed: 1.6, size: 0.12, life: 0.4, blend: 'add' });
      if (sv.cookT >= sv.cookMax) {
        const recipe = sv.cooking.order.id;
        const slot = sv.ready.length;
        const plate = new THREE.Group();
        const dishS = this._dishSprite(recipe, 0.9); dishS.position.y = 0.35; plate.add(dishS);
        const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.28, 0.06, 10), M(0xf0ead8, 0.5));
        plate.add(dish);
        plate.position.set(PASS_X - 1.4 + slot * 1.4, 1.4, -0.6);
        this.group.add(plate);
        sv.ready.push({ recipe, mesh: plate });
        sv.cooking = null;
        g.audio.play('click');
        g.ui.wispSay('🍽 Order up!', { ms: 1400 });
      }
    }
    // night over?
    const active = sv.seated.length > 0 || sv.queue.length > 0 || !!sv.cooking;
    if (!sv.done && sv.walked >= sv.covers && !active) {
      sv.done = true; sv.endT = 1.0;
    }
    if (sv.done) { sv.endT -= dt; if (sv.endT <= 0) this.endService(false); }
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
