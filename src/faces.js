// faces.js — deterministic retro pixel-art portrait from a string seed (name/id).
// Browser-only (canvas); cached per id. Returns a dataURL, or '' on failure so the
// caller can keep an emoji fallback. Used for dialogue portraits (no more emoji faces).
function makeRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIN = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a86b3c', '#9fb06a'];
const HAIR = ['#2b1b0e', '#4a2f1a', '#6b4423', '#101010', '#8a8a8a', '#b5651d', '#d9c089'];
const HATS = ['#b0252a', '#244d8f', '#2e6b3a', '#3a3a3a', '#7a4ea0', '#caa84a'];
const BG = ['#2a2230', '#1b2533', '#2d2418', '#241b2e'];
const EYE = '#141414';

const _cache = new Map();

export function faceDataURL(id, { grid = 16, scale = 6, bg = true } = {}) {
  const key = id + '|' + grid + '|' + scale + '|' + (bg ? 1 : 0);
  if (_cache.has(key)) return _cache.get(key);
  let url = '';
  try {
    const rng = makeRng(String(id || 'anon'));
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const c = document.createElement('canvas');
    c.width = c.height = grid * scale;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.scale(scale, scale);
    const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); };

    const skin = pick(SKIN), hair = pick(HAIR);
    const hasHat = rng() < 0.35, hasBeard = rng() < 0.4;
    const browThick = rng() < 0.5 ? 1 : 2;
    const eyeY = 6 + (rng() < 0.5 ? 0 : 1);
    const mouthType = Math.floor(rng() * 3);

    if (bg) px(0, 0, grid, grid, pick(BG));
    px(3, 2, grid - 6, grid - 4, skin);                       // head
    px(grid - 4, 7, 1, 3, hair === skin ? '#00000022' : skin); // (cheek shade noop-safe)
    if (hasHat) { const hat = pick(HATS); px(2, 1, grid - 4, 2, hat); px(4, -1, grid - 8, 3, hat); }
    else { px(3, 2, grid - 6, 2, hair); px(3, 2, 1, 4, hair); px(grid - 4, 2, 1, 4, hair); }
    const ex1 = 5, ex2 = grid - 7;
    px(ex1, eyeY, 2, 2, EYE); px(ex2, eyeY, 2, 2, EYE);                       // eyes
    px(ex1, eyeY - browThick, 2, browThick, hair); px(ex2, eyeY - browThick, 2, browThick, hair); // brows
    const my = eyeY + 4;
    if (mouthType === 0) px(6, my, grid - 12, 1, '#7a3b3b');
    else if (mouthType === 1) { px(6, my, grid - 12, 1, '#7a3b3b'); px(5, my - 1, 1, 1, '#7a3b3b'); px(grid - 6, my - 1, 1, 1, '#7a3b3b'); }
    else px(7, my, grid - 14, 2, '#3a1414');
    if (hasBeard) { px(4, my + 1, grid - 8, 2, hair); px(4, my, 1, 3, hair); px(grid - 5, my, 1, 3, hair); }

    url = c.toDataURL('image/png');
  } catch (e) { url = ''; }
  _cache.set(key, url);
  return url;
}

// DOM convenience: <img> markup (pixelated), or emoji fallback if generation failed.
export function faceImg(id, emoji, cls = '', opts) {
  const url = faceDataURL(id, opts);
  if (!url) return `<span class="pixface-emoji">${emoji || '🧑'}</span>`;
  return `<img class="pixface ${cls}" src="${url}" alt="">`;
}
