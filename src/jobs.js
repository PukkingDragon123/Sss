// jobs.js — side "chores" in the forest. A job drops a prop; cast the right
// kind of spell near it to make progress (water/frost to douse, wind to clear).
import * as THREE from 'three';

const JOBS = {
  campfire: {
    name: 'Douse the Campfire',
    desc: 'Splash it out before it spreads. (◯ Frost Splash, north-west)',
    tag: 'water',
    at: new THREE.Vector3(-16, 0, -11),
    build() {
      const g = new THREE.Group();
      const logMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });
      for (let i = 0; i < 4; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 8), logMat);
        const a = (i / 4) * Math.PI;
        log.position.set(Math.cos(a) * 0.4, 0.2, Math.sin(a) * 0.4);
        log.rotation.z = Math.PI / 2; log.rotation.y = a;
        g.add(log);
      }
      const items = [];
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let i = 0; i < 6; i++) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.0, 7), flameMat.clone());
        const a = (i / 6) * Math.PI * 2;
        flame.position.set(Math.cos(a) * 0.35, 0.7, Math.sin(a) * 0.35);
        g.add(flame); items.push(flame);
      }
      return { group: g, items };
    },
  },
  spores: {
    name: 'Clear the Spores',
    desc: 'Blow the cursed spore-puffs away. (— Gust, north-east)',
    tag: 'wind',
    at: new THREE.Vector3(15, 0, -13),
    build() {
      const g = new THREE.Group();
      const items = [];
      const sporeMat = new THREE.MeshStandardMaterial({ color: 0x9be0a0, emissive: 0x2f6e3a, roughness: 0.8, transparent: true, opacity: 0.85 });
      const stalkMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b0, roughness: 0.9 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6), stalkMat);
        stalk.position.set(Math.cos(a) * 1.6, 0.25, Math.sin(a) * 1.6);
        g.add(stalk);
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), sporeMat);
        puff.position.set(Math.cos(a) * 1.6, 0.7, Math.sin(a) * 1.6);
        g.add(puff); items.push(puff);
      }
      return { group: g, items };
    },
  },
  cauldron: {
    name: 'Quench the Hex-Fire',
    desc: 'A cursed cauldron blazes! (◯ Frost Splash, far north)',
    tag: 'water',
    at: new THREE.Vector3(0, 0, -20),
    build() {
      const g = new THREE.Group();
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x33323a, roughness: 0.7, metalness: 0.3 });
      const pot = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), ironMat);
      pot.rotation.x = Math.PI; pot.position.y = 1.0; g.add(pot);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.12, 8, 20), ironMat); rim.rotation.x = Math.PI / 2; rim.position.y = 1.0; g.add(rim);
      const items = [];
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xb84cff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      for (let i = 0; i < 6; i++) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 7), flameMat.clone());
        flame.position.set(-0.6 + (i % 3) * 0.6, 1.5, -0.2 + (i % 2) * 0.4);
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

    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.12, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9, depthWrite: false })
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.copy(spec.at).setY(3.4);
    this.group.add(marker);
    const ml = new THREE.PointLight(0xffd98a, 2, 8);
    ml.position.copy(spec.at).setY(2.6);
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
    if (dist > 5.5) return;
    if (this.done >= this.need) return;
    const item = this.items[this.done];
    this.done++;
    if (item) {
      const wp = new THREE.Vector3(); item.getWorldPosition(wp);
      const col = this.job.tag === 'wind' ? 0x9be0a0 : 0x9fe8ff;
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
    game.particles.ring({ pos: at.clone().setY(0.2), color: 0xffd98a, r0: 0.5, r1: 8, life: 0.8 });
    game.particles.burst({ pos: at, color: 0xffd98a, count: 30, speed: 9, size: 0.35, life: 1.2, up: 4 });
    const name = this.job.name;
    this._cleanup();
    game.onJobComplete(name);
  }

  update(dt, game) {
    if (!this.active) return;
    this.phase += dt;
    if (this.marker) {
      this.marker.position.y = 3.4 + Math.sin(this.phase * 3) * 0.25;
      this.marker.rotation.z += dt * 2;
    }
    for (const it of this.items) {
      if (!it.visible) continue;
      it.scale.y = (it.geometry.type === 'ConeGeometry' ? 1 : 0.9) * (1 + Math.sin(this.phase * 6 + it.position.x) * 0.12);
    }
  }
}

export { JOBS };
