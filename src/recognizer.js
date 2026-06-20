// recognizer.js — a compact implementation of the $1 Unistroke Recognizer
// (Wobbrock, Wilson & Li, 2007). Used to turn a mouse-drawn "hand sign" into a spell.

const NUM_POINTS = 64;
const SQUARE_SIZE = 250;
const ANGLE_RANGE = deg2rad(45);
const ANGLE_PRECISION = deg2rad(2);
const PHI = 0.5 * (-1 + Math.sqrt(5));
const HALF_DIAGONAL = 0.5 * Math.sqrt(SQUARE_SIZE * SQUARE_SIZE + SQUARE_SIZE * SQUARE_SIZE);

function deg2rad(d) { return d * Math.PI / 180; }

function pathLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

function resample(points, n) {
  const I = pathLength(points) / (n - 1);
  let D = 0;
  const newPoints = [points[0]];
  const pts = points.slice();
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if ((D + d) >= I) {
      const qx = pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x);
      const qy = pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y);
      const q = { x: qx, y: qy };
      newPoints.push(q);
      pts.splice(i, 0, q);
      D = 0;
    } else {
      D += d;
    }
  }
  while (newPoints.length < n) newPoints.push({ ...pts[pts.length - 1] });
  return newPoints;
}

function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function indicativeAngle(pts) {
  const c = centroid(pts);
  return Math.atan2(c.y - pts[0].y, c.x - pts[0].x);
}

function rotateBy(pts, rad) {
  const c = centroid(pts);
  const cos = Math.cos(rad), sin = Math.sin(rad);
  return pts.map(p => ({
    x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
    y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
  }));
}

function boundingBox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

function scaleToSquare(pts, size) {
  const b = boundingBox(pts);
  // For ~1D gestures (e.g. a straight line) scale uniformly, otherwise the
  // tiny dimension gets blown up to full size and the shape becomes noise.
  const ratio = Math.min(b.w, b.h) / (Math.max(b.w, b.h) || 1);
  if (ratio <= 0.3) {
    const m = Math.max(b.w, b.h) || 1;
    return pts.map(p => ({ x: p.x * (size / m), y: p.y * (size / m) }));
  }
  return pts.map(p => ({
    x: p.x * (size / (b.w || 1)),
    y: p.y * (size / (b.h || 1)),
  }));
}

function translateToOrigin(pts) {
  const c = centroid(pts);
  return pts.map(p => ({ x: p.x - c.x, y: p.y - c.y }));
}

function pathDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}

function distanceAtAngle(pts, template, rad) {
  return pathDistance(rotateBy(pts, rad), template.points);
}

function distanceAtBestAngle(pts, template) {
  let a = -ANGLE_RANGE, b = ANGLE_RANGE;
  let x1 = PHI * a + (1 - PHI) * b;
  let f1 = distanceAtAngle(pts, template, x1);
  let x2 = (1 - PHI) * a + PHI * b;
  let f2 = distanceAtAngle(pts, template, x2);
  while (Math.abs(b - a) > ANGLE_PRECISION) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = PHI * a + (1 - PHI) * b; f1 = distanceAtAngle(pts, template, x1); }
    else { a = x1; x1 = x2; f1 = f2; x2 = (1 - PHI) * a + PHI * b; f2 = distanceAtAngle(pts, template, x2); }
  }
  return Math.min(f1, f2);
}

function normalize(rawPoints) {
  let pts = resample(rawPoints, NUM_POINTS);
  pts = rotateBy(pts, -indicativeAngle(pts));
  pts = scaleToSquare(pts, SQUARE_SIZE);
  pts = translateToOrigin(pts);
  return pts;
}

export class Recognizer {
  constructor() { this.templates = []; }

  add(name, points) {
    this.templates.push({ name, points: normalize(points) });
  }

  // Returns { name, score } where score in [0,1]; null if not enough points.
  recognize(rawPoints) {
    if (!rawPoints || rawPoints.length < 6) return null;
    const candidate = normalize(rawPoints);
    let best = Infinity, bestName = null;
    for (const t of this.templates) {
      const d = distanceAtBestAngle(candidate, t);
      if (d < best) { best = d; bestName = t.name; }
    }
    if (bestName == null) return null;
    const score = 1 - best / HALF_DIAGONAL;
    return { name: bestName, score };
  }
}

// Reference unistrokes (drawn in screen-ish coordinates). The recognizer is
// rotation/scale invariant, so these only need to capture the *shape*.
export const TEMPLATES = {
  // Triangle -> Fireball
  triangle: [
    { x: 0, y: 0 }, { x: -50, y: 100 }, { x: 100, y: 100 }, { x: 0, y: 0 },
  ],
  // Z zig-zag -> Lightning
  zigzag: [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 80 }, { x: 100, y: 80 },
  ],
  // Circle -> Frost Splash (sampled clockwise)
  circle: (() => {
    const p = [];
    for (let a = 0; a <= 360; a += 18) { const r = a * Math.PI / 180; p.push({ x: Math.cos(r) * 60, y: Math.sin(r) * 60 }); }
    return p;
  })(),
  // V (check) -> Heal
  vee: [
    { x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 },
  ],
  // Horizontal line -> Gust
  line: [
    { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 80, y: 0 }, { x: 120, y: 0 },
  ],
  // Caret ^ -> Arcane Spike
  caret: [
    { x: 0, y: 100 }, { x: 50, y: 0 }, { x: 100, y: 100 },
  ],
  // Five-point star (single stroke) -> Fire Nova
  star: (() => {
    const p = [];
    const order = [0, 2, 4, 1, 3, 0];
    for (const k of order) { const a = (-90 + k * 72) * Math.PI / 180; p.push({ x: Math.cos(a) * 50, y: Math.sin(a) * 50 }); }
    return p;
  })(),
};
