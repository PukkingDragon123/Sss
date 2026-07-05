// input.js — desktop (WASD + mouse aim + right-drag glyphs) and touch
// (left virtual joystick + right-side glyph drawing). Discrete actions are
// queued as events the game drains; movement/aim are polled.

const JOY_R = 64; // joystick radius in px

export class Input {
  constructor(domElement) {
    this.el = domElement;
    this.keys = new Set();
    this.pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.ndc = { x: 0, y: 0 };

    this.drawing = false;
    this.drawId = null;
    this.points = [];
    this.events = [];
    this.enabled = true;
    this.pointMode = false; // when true, taps/clicks emit 'select' (used by the world map)

    this.isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dz: 0 };

    // camera orbit: middle-mouse (or map-scene) drag accumulates yaw/pitch deltas the game polls
    this.orbit = { dx: 0, dy: 0 };
    this._orbiting = false; this._orbitId = null; this._orbitLast = { x: 0, y: 0 };
    // camera zoom: mouse wheel + two-finger pinch accumulate into a delta the game polls
    this.zoom = 0;
    this._touches = new Map();   // pointerId -> {x,y}  (for pinch)
    this._pinchLast = 0;
    // map-scene tap-vs-drag: a small drag orbits, a clean tap selects a node
    this._mapDown = false; this._mapId = null; this._mapMoved = 0;

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (k >= '1' && k <= '5') this.events.push({ type: 'quickcast', index: parseInt(k, 10) - 1 });
      if (k === 'escape' || k === 'p') this.events.push({ type: 'pause' });
      if (k === ' ' || k === 'enter') this.events.push({ type: 'confirm' });
      if (k === 'm') this.events.push({ type: 'mute' });
      if (k === 'h' || k === '?') this.events.push({ type: 'guide' });
      if (k === 'q' || k === 'r') this.events.push({ type: 'drink' });
      if (k === 'e' || k === 'f') this.events.push({ type: 'interact' });
      if ([' ', 'w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.key.toLowerCase()); });

    const setPointer = (e) => {
      this.pointer.x = e.clientX; this.pointer.y = e.clientY;
      this.ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    // mouse wheel zooms the camera (map scenes + the fight)
    this.el.addEventListener('wheel', (e) => { if (!this.enabled) return; this.zoom += e.deltaY; e.preventDefault(); }, { passive: false });

    this.el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      setPointer(e);
      const touch = e.pointerType === 'touch';
      if (touch) this.isTouch = true;

      // map / point-select mode: DRAG orbits the camera, a clean TAP picks a node.
      // (two fingers pinch-zoom — tracked in this._touches)
      if (this.pointMode && (touch || e.button === 0)) {
        if (touch) this._touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!this._mapDown) { this._mapDown = true; this._mapId = e.pointerId; this._mapMoved = 0; this._orbitLast = { x: e.clientX, y: e.clientY }; }
        try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
        return;
      }

      if (touch) {
        // left half drives the joystick, right half draws glyphs
        if (e.clientX < window.innerWidth * 0.5 && !this.joy.active) {
          this.joy.active = true; this.joy.id = e.pointerId;
          this.joy.ox = e.clientX; this.joy.oy = e.clientY;
          this.joy.x = e.clientX; this.joy.y = e.clientY;
          this.joy.dx = 0; this.joy.dz = 0;
        } else {
          this._startDraw(e);
        }
        e.preventDefault();
      } else if (e.button === 1) {
        // middle-drag orbits the camera around the wizard
        this._orbiting = true; this._orbitId = e.pointerId; this._orbitLast = { x: e.clientX, y: e.clientY };
        try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
      } else if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
        this._startDraw(e);
      } else if (e.button === 0) {
        this.events.push({ type: 'primary' });
      }
    });

    this.el.addEventListener('pointermove', (e) => {
      setPointer(e);
      // map scene: one-finger/left-drag orbits, two-finger pinch zooms
      if (this._mapDown) {
        if (this._touches.has(e.pointerId)) this._touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this._touches.size >= 2) {
          const pts = [...this._touches.values()];
          const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (this._pinchLast) this.zoom += (this._pinchLast - d) * 2.4; // spread fingers → zoom in
          this._pinchLast = d; this._mapMoved += 20;
          e.preventDefault(); return;
        }
        if (e.pointerId === this._mapId) {
          const dx = e.clientX - this._orbitLast.x, dy = e.clientY - this._orbitLast.y;
          this.orbit.dx += dx; this.orbit.dy += dy; this._mapMoved += Math.abs(dx) + Math.abs(dy);
          this._orbitLast = { x: e.clientX, y: e.clientY };
          e.preventDefault();
        }
        return;
      }
      if (this._orbiting && e.pointerId === this._orbitId) {
        this.orbit.dx += e.clientX - this._orbitLast.x; this.orbit.dy += e.clientY - this._orbitLast.y;
        this._orbitLast = { x: e.clientX, y: e.clientY };
        e.preventDefault(); return;
      }
      if (this.joy.active && e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const len = Math.hypot(dx, dy);
        if (len > JOY_R) { dx *= JOY_R / len; dy *= JOY_R / len; }
        this.joy.x = this.joy.ox + dx; this.joy.y = this.joy.oy + dy;
        this.joy.dx = dx / JOY_R; this.joy.dz = dy / JOY_R;
        e.preventDefault();
      } else if (this.drawing && e.pointerId === this.drawId) {
        const last = this.points[this.points.length - 1];
        if (!last || Math.hypot(e.clientX - last.x, e.clientY - last.y) > 2) this.points.push({ x: e.clientX, y: e.clientY });
      }
    });

    const up = (e) => {
      if (this._mapDown && (e.pointerId === this._mapId || this._touches.has(e.pointerId))) {
        this._touches.delete(e.pointerId); this._pinchLast = 0;
        if (this._touches.size === 0) {
          const wasTap = this._mapMoved < 9;
          this._mapDown = false; this._mapId = null;
          if (wasTap) this.events.push({ type: 'select', x: e.clientX, y: e.clientY }); // a clean tap picks a node
        } else { // a finger lifted mid-pinch — keep orbiting with the one that remains
          const rem = [...this._touches.keys()][0]; this._mapId = rem; const p = this._touches.get(rem); this._orbitLast = { x: p.x, y: p.y };
        }
        return;
      }
      if (this._orbiting && e.pointerId === this._orbitId) { this._orbiting = false; this._orbitId = null; return; }
      if (this.joy.active && e.pointerId === this.joy.id) {
        this.joy.active = false; this.joy.id = null; this.joy.dx = 0; this.joy.dz = 0;
        return;
      }
      if (this.drawing && e.pointerId === this.drawId) {
        this.drawing = false; this.drawId = null;
        const pts = this.points.slice(); this.points = [];
        this.events.push({ type: 'gesture', points: pts });
      }
    };
    this.el.addEventListener('pointerup', up);
    this.el.addEventListener('pointercancel', up);

    window.addEventListener('blur', () => { this.keys.clear(); this.drawing = false; this.joy.active = false; this.points = []; this._orbiting = false; this._orbitId = null; this._mapDown = false; this._mapId = null; this._touches.clear(); this._pinchLast = 0; });
  }

  _startDraw(e) {
    this.drawing = true; this.drawId = e.pointerId;
    this.points = [{ x: e.clientX, y: e.clientY }];
    this.events.push({ type: 'drawstart' });
    try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
  }

  moveVector() {
    if (this.joy.active) {
      let x = this.joy.dx, z = this.joy.dz;
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      return { x, z };
    }
    let x = 0, z = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    const len = Math.hypot(x, z);
    if (len > 0) { x /= len; z /= len; }
    return { x, z };
  }

  // camera orbit delta since last poll (pixels), then reset
  consumeOrbit() { const o = this.orbit; this.orbit = { dx: 0, dy: 0 }; return o; }
  // camera zoom delta since last poll (wheel + pinch), then reset
  consumeZoom() { const z = this.zoom; this.zoom = 0; return z; }
  // keyboard camera turn: [ turns left, ] turns right  (-1 / 0 / +1)
  turnInput() { return (this.keys.has(']') ? 1 : 0) - (this.keys.has('[') ? 1 : 0); }

  drain() { const e = this.events; this.events = []; return e; }
}
