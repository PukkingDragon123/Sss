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
    this.pointMode = false; // when true, taps/clicks emit 'select' (used by the journey map)

    this.isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dz: 0 };

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

    this.el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      setPointer(e);
      const touch = e.pointerType === 'touch';
      if (touch) this.isTouch = true;

      // map / point-select mode: a tap anywhere picks a node (no joystick, no draw)
      if (this.pointMode && (touch || e.button === 0)) {
        this.events.push({ type: 'select', x: e.clientX, y: e.clientY });
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
      } else if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
        this._startDraw(e);
      } else if (e.button === 0) {
        this.events.push({ type: 'primary' });
      }
    });

    this.el.addEventListener('pointermove', (e) => {
      setPointer(e);
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

    window.addEventListener('blur', () => { this.keys.clear(); this.drawing = false; this.joy.active = false; this.points = []; });
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

  drain() { const e = this.events; this.events = []; return e; }
}
