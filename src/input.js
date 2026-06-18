// input.js — keyboard, pointer aim, and "draw a glyph" gesture capture.
// Produces a small queue of discrete events the game drains each frame, and
// exposes polled state (held keys, pointer position) for movement/aim.

export class Input {
  constructor(domElement) {
    this.el = domElement;
    this.keys = new Set();
    this.pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.ndc = { x: 0, y: 0 }; // normalized device coords for raycasting

    this.drawing = false;
    this.points = [];          // current gesture stroke (screen px)
    this.events = [];          // drained by the game loop
    this.enabled = true;

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      // quick-cast hotkeys
      if (k >= '1' && k <= '5') this.events.push({ type: 'quickcast', index: parseInt(k, 10) - 1 });
      if (k === 'escape' || k === 'p') this.events.push({ type: 'pause' });
      if (k === ' ' || k === 'enter') this.events.push({ type: 'confirm' });
      if (k === 'm') this.events.push({ type: 'mute' });
      if ([' ', 'w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.key.toLowerCase()); });

    const setPointer = (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    this.el.addEventListener('contextmenu', (e) => e.preventDefault());

    this.el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      setPointer(e);
      if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
        // Right mouse (or shift+left) begins drawing a glyph.
        this.drawing = true;
        this.points = [{ x: e.clientX, y: e.clientY }];
        this.events.push({ type: 'drawstart' });
        try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
      } else if (e.button === 0) {
        this.events.push({ type: 'primary' });
      }
    });

    this.el.addEventListener('pointermove', (e) => {
      setPointer(e);
      if (this.drawing) {
        const last = this.points[this.points.length - 1];
        if (!last || Math.hypot(e.clientX - last.x, e.clientY - last.y) > 3) {
          this.points.push({ x: e.clientX, y: e.clientY });
        }
      }
    });

    const endDraw = (e) => {
      if (!this.drawing) return;
      this.drawing = false;
      const pts = this.points.slice();
      this.points = [];
      this.events.push({ type: 'gesture', points: pts });
    };
    this.el.addEventListener('pointerup', endDraw);
    this.el.addEventListener('pointercancel', endDraw);

    window.addEventListener('blur', () => { this.keys.clear(); this.drawing = false; this.points = []; });
  }

  // Movement vector from WASD / arrows, in world XZ where +x=east, +z=south(screen-down).
  moveVector() {
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
