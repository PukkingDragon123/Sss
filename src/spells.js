// spells.js — the hand-signs and everything they conjure, plus combos.
import * as THREE from 'three';
import { spellDmgMult, COMBO_META } from './meta.js';

// Spell metadata. You equip 3; quick-cast keys 1..3 map to your loadout.
export const SPELLS = {
  fireball:  { name: 'Fireball',     gesture: 'triangle', mana: 18, cd: 0.55, tags: ['fire'],            glyph: '△', color: 0xff7a2a },
  gust:      { name: 'Gust',         gesture: 'line',     mana: 10, cd: 0.45, tags: ['wind'],            glyph: '—', color: 0xdfffe0 },
  lightning: { name: 'Lightning',    gesture: 'zigzag',   mana: 14, cd: 0.45, tags: ['lightning'],       glyph: 'ϟ', color: 0x9fe8ff },
  frost:     { name: 'Frost Splash', gesture: 'circle',   mana: 22, cd: 1.10, tags: ['water', 'frost'],  glyph: '◯', color: 0x7fe0ff },
  heal:      { name: 'Heal',         gesture: 'vee',      mana: 28, cd: 2.80, tags: ['holy'],            glyph: '∨', color: 0x8dffa0 },
  spike:     { name: 'Arcane Spike', gesture: 'caret',    mana: 12, cd: 0.40, tags: ['arcane'],          glyph: '∧', color: 0xb98cff },
  nova:      { name: 'Fire Nova',    gesture: 'star',     mana: 30, cd: 1.60, tags: ['fire'],            glyph: '★', color: 0xff9a3a },
};

export const SPELL_ORDER = ['fireball', 'gust', 'lightning', 'frost', 'heal', 'spike', 'nova'];
export const GESTURE_TO_SPELL = { triangle: 'fireball', zigzag: 'lightning', circle: 'frost', vee: 'heal', line: 'gust', caret: 'spike', star: 'nova' };

export class SpellSystem {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.projectiles = [];
    this.bolts = [];   // transient lightning tubes
    this.areas = [];   // persistent area effects (fire tornado)
    this.cd = {};      // cooldown timers per spell id
    this.cdMult = {};  // per-spell cooldown multiplier (from upgrades)
    this.power = 1; this.crit = false;
    for (const id of SPELL_ORDER) { this.cd[id] = 0; this.cdMult[id] = 1; }
  }

  adjustCd(id, factor) { if (this.cdMult[id] != null) this.cdMult[id] *= factor; }

  reset() {
    for (const p of this.projectiles) {
      this.group.remove(p.mesh);
      p.mesh.traverse((c) => { if (c.isMesh) c.geometry.dispose(); });
    }
    this.projectiles.length = 0;
    for (const b of this.bolts) { this.group.remove(b.mesh); b.mesh.geometry.dispose(); }
    this.bolts.length = 0;
    for (const a of this.areas) { this.group.remove(a.mesh); a.mesh.geometry.dispose(); }
    this.areas.length = 0;
    for (const id of SPELL_ORDER) { this.cd[id] = 0; this.cdMult[id] = 1; }
  }

  cooldownFrac(id) {
    const def = SPELLS[id];
    if (!def) return 0;
    return Math.max(0, this.cd[id]) / ((def.cd * this.cdMult[id]) || 1);
  }

  tryCast(game, id, opts = {}) {
    const def = SPELLS[id];
    if (!def) return false;
    if (this.cd[id] > 0) return false;
    if (!game.wizard.alive) return false;
    if (!game.wizard.spendMana(def.mana)) { game.ui.toast('Too sober… need mana'); return false; }

    // accuracy -> power: sloppy draws hit softer, a perfect glyph crits;
    // skill-tree level scales it further
    const accuracy = opts.accuracy == null ? 1 : opts.accuracy;
    this.crit = !!opts.crit;
    this.power = accuracy * (this.crit ? 2 : 1) * spellDmgMult(id);

    this.cd[id] = def.cd * this.cdMult[id] * game.stats.cooldownMult;
    const origin = game.wizard.handPosition();
    const aim = game.aimPoint ? game.aimPoint.clone() : origin.clone().add(new THREE.Vector3(0, 0, 1));
    const dir = new THREE.Vector3(aim.x - game.wizard.pos.x, 0, aim.z - game.wizard.pos.z);
    if (dir.lengthSq() < 0.001) dir.set(Math.sin(game.wizard.yaw), 0, Math.cos(game.wizard.yaw));
    dir.normalize();

    game.wizard.triggerCast(dir);
    game.audio.play('cast');
    game.ui.flashSpell(id);
    if (this.crit) {
      game.audio.play('xp');
      game.shake(0.6);
      game.particles.burst({ pos: origin.clone(), color: 0xffe08a, count: 14, speed: 7, size: 0.32, life: 0.6 });
      game.ui.critToast();
    }

    switch (id) {
      case 'fireball':  this._fireball(game, origin, dir); break;
      case 'lightning': this._lightning(game, origin, aim); break;
      case 'frost':     this._frost(game); break;
      case 'heal':      this._heal(game); break;
      case 'gust':      this._gust(game, dir); break;
      case 'spike':     this._spike(game, origin, dir); break;
      case 'nova':      this._nova(game); break;
    }
    return true;
  }

  _spike(game, origin, dir) {
    game.audio.play('zap');
    const geo = new THREE.ConeGeometry(0.18, 1.1, 8); geo.rotateX(Math.PI / 2); // point along +z
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xc9a8ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    mesh.position.copy(origin);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    this.group.add(mesh);
    this.projectiles.push({
      kind: 'spike', mesh, vel: dir.clone().multiplyScalar(50), life: 0.75,
      dmg: game.stats.spikeDmg * game.stats.damageMult * this.power, r: 0.5, hit: new Set(),
    });
  }

  _nova(game) {
    game.audio.play('explosion');
    game.shake(1.0);
    const center = game.wizard.pos.clone();
    const r = game.stats.novaRadius;
    game.particles.ring({ pos: center.clone().setY(0.1), color: 0xff9a3a, r0: 0.6, r1: r * 1.5, life: 0.5 });
    game.particles.burst({ pos: center.clone().setY(0.8), color: 0xff8a2a, count: 30, speed: 11, size: 0.5, life: 0.8, up: 3 });
    const dmg = game.stats.novaDmg * game.stats.damageMult * this.power;
    for (const e of game.enemies.inRadius(center, r)) {
      game.enemies.damage(e, dmg, game, new THREE.Vector3().subVectors(e.mesh.position, center), 6);
    }
    game.notifySpell(['fire'], center);
  }

  // ---- combos (two glyphs in a row) ----
  castCombo(game, id) {
    const m = COMBO_META[id];
    if (!m) return;
    game.ui.comboToast(m.name);
    game.audio.play('levelup');
    game.shake(1.0);
    const aim = game.aimPoint ? game.aimPoint.clone() : game.wizard.pos.clone();
    const mult = game.stats.damageMult;
    if (id === 'firetornado') {
      const pos = aim.clone(); pos.y = 0;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 4.5, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
      );
      cone.position.copy(pos).setY(2.2);
      this.group.add(cone);
      this.areas.push({ kind: 'tornado', mesh: cone, pos, life: 2.0, tick: 0, radius: 2.6, dmg: 26 * mult, spin: 0 });
    } else if (id === 'icestorm') {
      const pos = aim.clone();
      game.particles.ring({ pos: pos.clone().setY(0.1), color: 0x9fe8ff, r0: 0.6, r1: 9, life: 0.7 });
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * 7;
        game.particles.spawn({ pos: new THREE.Vector3(pos.x + Math.cos(a) * rr, 5, pos.z + Math.sin(a) * rr), color: 0xbfeeff, vel: new THREE.Vector3(0, -8, 0), size: 0.3, life: 0.8, grav: -4 });
      }
      for (const e of game.enemies.inRadius(pos, 7)) {
        game.enemies.damage(e, 30 * mult, game, new THREE.Vector3().subVectors(e.mesh.position, pos), 4);
        game.enemies.applySlow(e, 0.7, 3.5);
      }
      this._spawnBolt([game.wizard.handPosition(), pos.clone().setY(1)]);
    } else if (id === 'holynova') {
      const c = game.wizard.pos.clone();
      game.wizard.heal(60);
      game.particles.ring({ pos: c.clone().setY(0.1), color: 0x8dffa0, r0: 0.5, r1: 8, life: 0.7 });
      game.particles.burst({ pos: c.clone().setY(1), color: 0xfff0b0, count: 30, speed: 9, size: 0.34, life: 0.9, up: 3 });
      for (const e of game.enemies.inRadius(c, 7)) game.enemies.damage(e, 34 * mult, game, new THREE.Vector3().subVectors(e.mesh.position, c), 5);
    }
  }

  _fireball(game, origin, dir) {
    game.audio.play('fireball');
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffae57, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
    );
    mesh.position.copy(origin);
    // a bright additive halo (no real light — keeps the renderer's light count
    // stable so we never trigger shader recompiles mid-swarm)
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mesh.add(halo);
    this.group.add(mesh);
    this.projectiles.push({
      kind: 'fireball', mesh,
      vel: dir.clone().multiplyScalar(34),
      life: 1.4,
      dmg: game.stats.fireballDmg * game.stats.damageMult * this.power,
      radius: game.stats.fireballRadius * (this.crit ? 1.45 : 1),
      crit: this.crit,
    });
  }

  _explodeFireball(game, p) {
    const pos = p.mesh.position.clone();
    game.audio.play('explosion');
    game.shake(1.2 + p.radius * 0.15);
    game.particles.ring({ pos: pos.clone().setY(0.1), color: p.crit ? 0xffe08a : 0xff8a3a, r0: 0.5, r1: p.radius * 1.6, life: 0.45 });
    game.particles.burst({ pos, color: p.crit ? 0xffd86a : 0xff8a2a, count: p.crit ? 38 : 26, speed: 11, size: 0.5, life: 0.7, up: 3, blend: 'add' });
    game.particles.burst({ pos, color: 0x3a2a22, count: 10, speed: 5, size: 0.6, life: 1.0, up: 2, blend: 'normal' });
    const hits = game.enemies.inRadius(pos, p.radius);
    for (const e of hits) {
      const dir = new THREE.Vector3().subVectors(e.mesh.position, pos);
      game.enemies.damage(e, p.dmg, game, dir, 7);
    }
    game.notifySpell(['fire'], pos);
  }

  _lightning(game, origin, aim) {
    game.audio.play('zap');
    game.shake(0.7);
    const maxChain = game.stats.lightningChains;
    const dmg = game.stats.lightningDmg * game.stats.damageMult * this.power;
    const hit = new Set();
    const path = [origin.clone()];
    // first target: nearest enemy to the aim point, else just shoot at the aim
    let from = origin.clone();
    let target = game.enemies.nearest(aim, 9, hit);
    if (!target) {
      const end = origin.clone().add(new THREE.Vector3(aim.x - origin.x, 0, aim.z - origin.z).normalize().multiplyScalar(12));
      path.push(end);
    } else {
      for (let c = 0; c < maxChain && target; c++) {
        path.push(target.mesh.position.clone().setY(1.0));
        game.enemies.damage(target, dmg, game, new THREE.Vector3().subVectors(target.mesh.position, from), 3);
        game.particles.burst({ pos: target.mesh.position.clone().setY(1), color: 0x9fe8ff, count: 8, speed: 6, size: 0.3, life: 0.4 });
        hit.add(target);
        from = target.mesh.position.clone();
        target = game.enemies.nearest(from, 7, hit);
      }
    }
    this._spawnBolt(path);
    game.notifySpell(['lightning'], path[path.length - 1]);
  }

  _spawnBolt(points) {
    // jagged the path, build a glowing tube
    const jag = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const segs = 5;
      for (let s = 0; s < segs; s++) {
        const t = s / segs;
        const p = a.clone().lerp(b, t);
        if (s !== 0) {
          p.x += (Math.random() - 0.5) * 0.8;
          p.y += (Math.random() - 0.5) * 0.8;
          p.z += (Math.random() - 0.5) * 0.8;
        }
        jag.push(p);
      }
    }
    jag.push(points[points.length - 1].clone());
    if (jag.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(jag);
    const geo = new THREE.TubeGeometry(curve, jag.length * 2, 0.09, 5, false);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcdf3ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    this.group.add(mesh);
    this.bolts.push({ mesh, life: 0.16, max: 0.16 });
  }

  _frost(game) {
    game.audio.play('frost');
    game.shake(0.5);
    const center = game.wizard.pos.clone();
    const r = game.stats.frostRadius;
    game.particles.ring({ pos: center.clone(), color: 0x9fe8ff, r0: 0.6, r1: r * 1.4, life: 0.55 });
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.random() * r;
      game.particles.spawn({
        pos: new THREE.Vector3(center.x + Math.cos(a) * rr, 0.4, center.z + Math.sin(a) * rr),
        color: 0xbfeeff, vel: new THREE.Vector3(Math.cos(a) * 2, 3 + Math.random() * 3, Math.sin(a) * 2),
        size: 0.32, life: 0.7, grav: -6,
      });
    }
    const hits = game.enemies.inRadius(center, r);
    const dmg = game.stats.frostDmg * game.stats.damageMult * this.power;
    for (const e of hits) {
      const dir = new THREE.Vector3().subVectors(e.mesh.position, center);
      game.enemies.damage(e, dmg, game, dir, 2);
      game.enemies.applySlow(e, game.stats.frostSlow, game.stats.frostSlowTime);
    }
    game.notifySpell(['water', 'frost'], center);
  }

  _heal(game) {
    game.audio.play('heal');
    const amt = game.stats.healAmount * this.power;
    game.wizard.heal(amt);
    game.ui.toast(`+${Math.round(amt)} HP`);
    const c = game.wizard.pos.clone();
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      game.particles.spawn({
        pos: new THREE.Vector3(c.x + Math.cos(a) * 0.6, 0.3 + Math.random() * 0.5, c.z + Math.sin(a) * 0.6),
        color: 0x8dffa0, vel: new THREE.Vector3(0, 3 + Math.random() * 3, 0), size: 0.28, life: 1.0, grav: 2,
      });
    }
    game.particles.ring({ pos: c.clone(), color: 0x8dffa0, r0: 0.4, r1: 3, life: 0.6 });
    game.notifySpell(['holy'], c);
  }

  _gust(game, dir) {
    game.audio.play('gust');
    const range = game.stats.gustRange;
    const force = game.stats.gustForce;
    const origin = game.wizard.pos.clone();
    for (let i = 0; i < 16; i++) {
      const spread = (Math.random() - 0.5) * 0.7;
      const d = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spread);
      game.particles.spawn({
        pos: origin.clone().setY(1 + Math.random()).addScaledVector(d, 0.5),
        color: 0xdfffe0, vel: d.multiplyScalar(14 + Math.random() * 6).setY(Math.random()),
        size: 0.3, life: 0.4, grav: 0,
      });
    }
    // affect enemies within a forward cone
    for (const e of game.enemies.list) {
      if (!e.alive) continue;
      const to = new THREE.Vector3().subVectors(e.mesh.position, origin).setY(0);
      const dist = to.length();
      if (dist > range || dist < 0.001) continue;
      to.normalize();
      if (to.dot(dir) > 0.5) {
        game.enemies.damage(e, game.stats.gustDmg * game.stats.damageMult * this.power, game, to, force);
      }
    }
    game.notifySpell(['wind'], origin.clone().addScaledVector(dir, range * 0.5));
  }

  update(dt, game) {
    // cooldowns
    for (const id of SPELL_ORDER) if (this.cd[id] > 0) this.cd[id] -= dt;

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      if (p.kind === 'spike') {
        // pierces through foes, damaging each once
        if (Math.random() < 0.7) game.particles.spawn({ pos: p.mesh.position.clone(), color: 0xc9a8ff, vel: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random(), (Math.random() - 0.5) * 2), size: 0.22, life: 0.3 });
        for (const e of game.enemies.list) {
          if (!e.alive || p.hit.has(e)) continue;
          const dx = e.mesh.position.x - p.mesh.position.x, dz = e.mesh.position.z - p.mesh.position.z;
          if (dx * dx + dz * dz < (e.r + p.r) * (e.r + p.r)) { game.enemies.damage(e, p.dmg, game, p.vel, 2); p.hit.add(e); }
        }
        if (p.life <= 0 || Math.abs(p.mesh.position.x) > 48 || Math.abs(p.mesh.position.z) > 48) {
          this.group.remove(p.mesh); p.mesh.geometry.dispose(); this.projectiles.splice(i, 1);
        }
        continue;
      }

      // fireball
      p.mesh.rotation.x += dt * 10; p.mesh.rotation.y += dt * 8;
      if (Math.random() < 0.8) {
        game.particles.spawn({
          pos: p.mesh.position.clone(), color: Math.random() < 0.5 ? 0xffae57 : 0xff5a2a,
          vel: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2),
          size: 0.35, life: 0.4, grav: 1,
        });
      }
      let exploded = false;
      for (const e of game.enemies.list) {
        if (!e.alive) continue;
        const dx = e.mesh.position.x - p.mesh.position.x;
        const dz = e.mesh.position.z - p.mesh.position.z;
        if (dx * dx + dz * dz < (e.r + 0.45) * (e.r + 0.45)) { exploded = true; break; }
      }
      if (exploded || p.life <= 0 || p.mesh.position.y < 0.2) {
        this._explodeFireball(game, p);
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.traverse((c) => { if (c.isMesh && c !== p.mesh) c.geometry.dispose(); });
        this.projectiles.splice(i, 1);
      }
    }

    // area effects (fire tornado)
    for (let i = this.areas.length - 1; i >= 0; i--) {
      const a = this.areas[i];
      a.life -= dt; a.tick -= dt; a.spin += dt * 8;
      a.mesh.rotation.y = a.spin;
      if (a.kind === 'tornado') {
        a.pos.x += (Math.random() - 0.5) * 6 * dt; a.pos.z += (Math.random() - 0.5) * 6 * dt;
        a.mesh.position.set(a.pos.x, 2.2, a.pos.z);
        if (Math.random() < 0.9) game.particles.spawn({ pos: new THREE.Vector3(a.pos.x + (Math.random() - 0.5) * 2, Math.random() * 4, a.pos.z + (Math.random() - 0.5) * 2), color: Math.random() < 0.5 ? 0xff8a2a : 0xffd86a, vel: new THREE.Vector3(0, 4, 0), size: 0.4, life: 0.5 });
        if (a.tick <= 0) {
          a.tick = 0.2;
          for (const e of game.enemies.inRadius(a.pos, a.radius)) game.enemies.damage(e, a.dmg * 0.2, game, new THREE.Vector3().subVectors(e.mesh.position, a.pos), 2);
        }
      }
      a.mesh.material.opacity = 0.5 * Math.min(1, a.life);
      if (a.life <= 0) { this.group.remove(a.mesh); a.mesh.geometry.dispose(); this.areas.splice(i, 1); }
    }

    // lightning bolts fade then die
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.mesh.material.opacity = Math.max(0, b.life / b.max);
      if (b.life <= 0) {
        this.group.remove(b.mesh);
        b.mesh.geometry.dispose();
        this.bolts.splice(i, 1);
      }
    }
  }
}
