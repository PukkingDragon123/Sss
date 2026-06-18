// jobs.js — the "do your chores" side of being a (possessed) wizard.
// A job places a prop in the arena; cast the right kind of spell near it to
// make progress. The spirit promised the wizard's landlady, after all.
import * as THREE from 'three';

const JOBS = {
  dishes: {
    name: 'Wash the Dishes',
    desc: 'Splash the greasy dishes clean. (Cast ◯ Frost Splash by the sink)',
    tag: 'water',
    at: new THREE.Vector3(-16, 0, -11),
    build() {
      const g = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
      const metal = new THREE.MeshStandardMaterial({ color: 0x9fb0bc, roughness: 0.4, metalness: 0.5 });
      const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 1.6), wood); counter.position.y = 0.5; g.add(counter);
      const basin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.1), metal); basin.position.y = 1.05; g.add(basin);
      const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), metal); tap.position.set(0, 1.4, -0.4); g.add(tap);
      const items = [];
      const plateMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.7 });
      for (let i = 0; i < 6; i++) {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.07, 14), plateMat);
        plate.position.set(-0.7 + (i % 3) * 0.55, 1.25 + Math.floor(i / 3) * 0.12, -0.1 + (i % 2) * 0.2);
        plate.rotation.z = (Math.random() - 0.5) * 0.3;
        g.add(plate); items.push(plate);
      }
      return { group: g, items };
    },
  },
  sweep: {
    name: 'Sweep the Floor',
    desc: 'Blow the dust bunnies away. (Cast — Gust at the dust piles)',
    tag: 'wind',
    at: new THREE.Vector3(15, 0, -13),
    build() {
      const g = new THREE.Group();
      const items = [];
      const dustMat = new THREE.MeshStandardMaterial({ color: 0x8c8478, roughness: 1 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const dust = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), dustMat);
        dust.scale.set(1, 0.5, 1);
        dust.position.set(Math.cos(a) * 1.6, 0.2, Math.sin(a) * 1.6);
        g.add(dust); items.push(dust);
      }
      return { group: g, items };
    },
  },
  douse: {
    name: 'Douse the Hearth',
    desc: 'The hearth is roaring out of control! (Cast ◯ Frost Splash on it)',
    tag: 'water',
    at: new THREE.Vector3(0, 0, -20),
    build() {
      const g = new THREE.Group();
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b6b72, roughness: 0.95 });
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.2, 1.4), stoneMat); base.position.y = 0.6; g.add(base);
      const items = [];
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let i = 0; i < 6; i++) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 7), flameMat.clone());
        flame.position.set(-1 + (i % 3) * 1, 1.4, -0.2 + (i % 2) * 0.4);
        g.add(flame); items.push(flame);
      }
      return { group: g, items };
    },
  },
};

export class Jobs {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.active = false;
    this.job = null;
    this.id = null;
    this.items = [];
    this.need = 0;
    this.done = 0;
    this.marker = null;
    this.phase = 0;
  }

  start(id) {
    if (this.active) this._cleanup();
    const spec = JOBS[id];
    if (!spec) return;
    const built = spec.build();
    built.group.position.copy(spec.at);
    built.group.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.group.add(built.group);

    // bobbing gold marker so the player can find the chore
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.12, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xffcf5c, transparent: true, opacity: 0.9, depthWrite: false })
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.copy(spec.at).setY(3.2);
    this.group.add(marker);
    const ml = new THREE.PointLight(0xffcf5c, 2, 8);
    ml.position.copy(spec.at).setY(2.5);
    this.group.add(ml);

    this.active = true;
    this.id = id;
    this.job = spec;
    this.builtGroup = built.group;
    this.items = built.items;
    this.need = built.items.length;
    this.done = 0;
    this.marker = marker;
    this.markerLight = ml;
  }

  _cleanup() {
    if (this.builtGroup) this.group.remove(this.builtGroup);
    if (this.marker) this.group.remove(this.marker);
    if (this.markerLight) this.group.remove(this.markerLight);
    this.builtGroup = null; this.marker = null; this.markerLight = null;
    this.items = []; this.active = false; this.job = null; this.id = null;
  }

  onSpell(tags, pos, game) {
    if (!this.active || !this.job) return;
    if (!tags.includes(this.job.tag)) return;
    const at = this.job.at;
    const dist = Math.hypot(pos.x - at.x, pos.z - at.z);
    if (dist > 5.5) return; // must be cast near the chore
    if (this.done >= this.need) return;
    // clean one item with a satisfying pop
    const item = this.items[this.done];
    this.done++;
    if (item) {
      const wp = new THREE.Vector3(); item.getWorldPosition(wp);
      const col = this.job.tag === 'wind' ? 0xb0a890 : (this.job.tag === 'water' && this.id === 'douse' ? 0x9fe8ff : 0xbfeeff);
      game.particles.burst({ pos: wp, color: col, count: 12, speed: 5, size: 0.3, life: 0.6, up: 2 });
      item.visible = false;
    }
    game.audio.play('xp');
    game.ui.updateJob(this.done, this.need);
    if (this.done >= this.need) this._complete(game);
  }

  _complete(game) {
    const at = this.job.at.clone().setY(1.5);
    game.audio.play('jobDone');
    game.particles.ring({ pos: at.clone().setY(0.2), color: 0xffcf5c, r0: 0.5, r1: 8, life: 0.8 });
    game.particles.burst({ pos: at, color: 0xffcf5c, count: 30, speed: 9, size: 0.35, life: 1.2, up: 4 });
    const name = this.job.name;
    this._cleanup();
    game.onJobComplete(name);
  }

  update(dt, game) {
    if (!this.active) return;
    this.phase += dt;
    if (this.marker) {
      this.marker.position.y = 3.2 + Math.sin(this.phase * 3) * 0.25;
      this.marker.rotation.z += dt * 2;
    }
    // flames/dust idle wobble
    for (const it of this.items) {
      if (!it.visible) continue;
      it.scale.y = (it.geometry.type === 'ConeGeometry' ? 1 : 0.5) * (1 + Math.sin(this.phase * 6 + it.position.x) * 0.12);
    }
  }
}

export { JOBS };
