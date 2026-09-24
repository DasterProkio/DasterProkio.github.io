'use strict';
// Lutopia intro — drawing engine: hand-drawn shapes with line boil, characters, props.
// Everything is drawn in a 1080x1920 coordinate space onto a 2x canvas.

const W = 1080, H = 1920, SS = 2, FPS = 24, TAU = Math.PI * 2;

const C = {
  cream: '#F6F5F0', ink: '#2B2826', body: '#EDEAE1', bodyS: '#D3CEC0', bezel: '#2F2E2B',
  lcd: '#A9BC97', lcdD: '#869A71', lcdInk: '#1E2616', pink: '#F4AEC0', pinkL: '#FAD6DF',
  pinkD: '#E0688A', yel: '#C6B357', yelL: '#F9F7E8', butter: '#FFE7A0', muted: '#7E7D7A',
  skin: '#FFE7D8', skinS: '#F6CDB8', hair: '#4E3934', hairL: '#8A6A5E', sweater: '#F7C4D0',
  sweaterS: '#EAA2B5', pants: '#6F6B88', shoe: '#8C6F66', white: '#FFFFFF', red: '#C8503A',
  blue: '#46669A', green: '#9CC08A', greenD: '#6C9A5F', wood: '#DDAE7C', woodD: '#B4834F',
  paper: '#FFFDF7', lav: '#E9E4F2',
};

// ---------- math ----------
const cl = x => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => cl((t - a) / (b - a));
const lerp = (a, b, x) => a + (b - a) * x;
const eio = x => { x = cl(x); return x * x * (3 - 2 * x); };
const eio3 = x => { x = cl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const eout = x => { x = cl(x); return 1 - Math.pow(1 - x, 3); };
const ein = x => { x = cl(x); return x * x * x; };
const eob = (x, s = 2.0) => { x = cl(x) - 1; return 1 + x * x * ((s + 1) * x + s); };
const pop = (t, t0, d = .36) => t < t0 ? 0 : eob(seg(t, t0, t0 + d));
const outp = (t, t1, d = .22) => 1 - ein(seg(t, t1, t1 + d));
const elastic = x => { x = cl(x); return x === 0 || x === 1 ? x : Math.pow(2, -9 * x) * Math.sin((x * 9 - .75) * TAU / 3) + 1; };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let R = mulberry32(1);
const rr = (a, b) => a + (b - a) * R();
let BOIL = 0;
function boil(frame) { BOIL = Math.floor(frame / 2); R = mulberry32(1000 + BOIL * 7919); }

// ---------- geometry ----------
function ellipsePts(cx, cy, rx, ry, n = 40) {
  const p = []; for (let i = 0; i < n; i++) { const a = TAU * i / n; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return p;
}
function arcPts(cx, cy, r, a0, a1, n = 16, ry = null) {
  ry = ry == null ? r : ry; const p = [];
  for (let i = 0; i < n; i++) { const a = (a0 + (a1 - a0) * i / (n - 1)) * Math.PI / 180; p.push([cx + r * Math.cos(a), cy + ry * Math.sin(a)]); }
  return p;
}
function rrectPts(x, y, w, h, r, n = 7) {
  if (!Array.isArray(r)) r = [r, r, r, r];
  const m = Math.min(w, h) / 2; const [tl, tr, br, bl] = r.map(v => Math.min(v, m));
  const p = [];
  const corner = (cx, cy, rad, a0) => { if (rad <= 0) p.push([cx, cy]); else p.push(...arcPts(cx, cy, rad, a0, a0 + 90, n)); };
  corner(x + tl, y + tl, tl, 180); corner(x + w - tr, y + tr, tr, 270);
  corner(x + w - br, y + h - br, br, 0); corner(x + bl, y + h - bl, bl, 90);
  // add midpoints on long edges so the wobble bends them gently
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length]; out.push(a);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.floor(d / 60);
    for (let j = 1; j <= k; j++) out.push([lerp(a[0], b[0], j / (k + 1)), lerp(a[1], b[1], j / (k + 1))]);
  }
  return out;
}
function cubic(p0, p1, p2, p3, n = 8) {
  const o = [];
  for (let i = 0; i < n; i++) {
    const u = i / n, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
    o.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return o;
}
// the four-point star from lutopia.app
const STAR = [].concat(
  cubic([50, 0], [50, 40], [60, 50], [100, 50]), cubic([100, 50], [60, 50], [50, 60], [50, 100]),
  cubic([50, 100], [50, 60], [40, 50], [0, 50]), cubic([0, 50], [40, 50], [50, 40], [50, 0]));
function starPts(cx, cy, r, rot = 0) {
  const ca = Math.cos(rot * Math.PI / 180), sa = Math.sin(rot * Math.PI / 180);
  return STAR.map(([x, y]) => { x = (x - 50) / 50 * r; y = (y - 50) / 50 * r; return [cx + x * ca - y * sa, cy + x * sa + y * ca]; });
}
function heartPts(cx, cy, s, n = 40) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = TAU * i / n, x = 16 * Math.sin(a) ** 3,
      y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    p.push([cx + x * s / 16, cy + y * s / 16]);
  }
  return p;
}
function quadPts(p0, p1, p2, n = 12) {
  const o = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    o.push([(1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]]);
  }
  return o;
}

// ---------- canvas state ----------
let g = null;           // current 2d context (swappable for offscreen passes)
function curScale() { const m = g.getTransform(); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) / SS; }
function push(x = 0, y = 0, rot = 0, sx = 1, sy = null) {
  g.save(); g.translate(x, y); if (rot) g.rotate(rot * Math.PI / 180); g.scale(sx, sy == null ? sx : sy);
}
function popT() { g.restore(); }

function wob(p, amp = 1.4, closed = true) {
  if (amp <= 0) return p;
  const s = amp / Math.max(.05, curScale());
  const a = R() * TAU, b = R() * TAU, c = R() * TAU, d = R() * TAU;
  const k1 = 1 + Math.floor(R() * 3), k2 = 3 + Math.floor(R() * 3);
  const n = closed ? p.length : Math.max(1, p.length - 1);
  return p.map(([x, y], i) => {
    const u = i / n;
    return [x + s * (.7 * Math.sin(TAU * k1 * u + a) + .3 * Math.sin(TAU * k2 * u + b)),
      y + s * (.7 * Math.sin(TAU * k1 * u + c) + .3 * Math.sin(TAU * k2 * u + d))];
  });
}
function trace(p, closed = true, sharp = false) {
  g.beginPath(); const n = p.length; if (n < 2) return;
  g.moveTo(p[0][0], p[0][1]);
  if (sharp) { for (let i = 1; i < n; i++) g.lineTo(p[i][0], p[i][1]); if (closed) g.closePath(); return; }
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p0 = closed ? p[(i - 1 + n) % n] : p[Math.max(0, i - 1)], p1 = p[i], p2 = p[(i + 1) % n],
      p3 = closed ? p[(i + 2) % n] : p[Math.min(n - 1, i + 2)];
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) g.closePath();
}

/* shape(points, {fill, line, lw, amp, shade, shadeOff, hl, sharp, dash, sketch, alpha, shadow}) */
function shape(pts, o = {}) {
  const fill = o.fill === undefined ? null : o.fill, line = o.line === undefined ? C.ink : o.line;
  const lw = o.lw == null ? 5 : o.lw, amp = o.amp == null ? 1.3 : o.amp, sharp = !!o.sharp;
  const p = wob(pts, amp);
  g.save();
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  if (fill) {
    if (o.shadow) {
      const s = curScale() * SS;
      g.shadowColor = o.shadowColor || 'rgba(70,40,40,.18)'; g.shadowBlur = o.shadow * s; g.shadowOffsetY = o.shadow * .45 * s;
    }
    trace(p, true, sharp); g.fillStyle = fill; g.fill();
    g.shadowColor = 'transparent';
    if (o.shade) {
      g.save(); trace(p, true, sharp); g.clip();
      g.fillStyle = o.shade; g.fill();
      const [dx, dy] = o.shadeOff || [-10, -9];
      g.translate(dx, dy); trace(p, true, sharp); g.fillStyle = fill; g.fill();
      g.restore();
    }
    if (o.hl) { g.save(); trace(p, true, sharp); g.clip(); o.hl(); g.restore(); }
  }
  if (line && lw > 0) {
    if (o.dash) g.setLineDash(o.dash);
    g.lineJoin = 'round'; g.lineCap = 'round';
    trace(p, true, sharp); g.lineWidth = lw; g.strokeStyle = line; g.stroke();
    if (o.sketch !== false && !o.dash) {
      const p2 = wob(pts, amp * 1.6);
      trace(p2, true, sharp); g.globalAlpha *= .3; g.lineWidth = lw * .42; g.stroke();
    }
  }
  g.restore();
  return p;
}
function stroke(pts, lw = 5, color = C.ink, amp = 1.1, o = {}) {
  const p = wob(pts, amp, false);
  g.save(); if (o.alpha != null) g.globalAlpha *= o.alpha;
  g.lineJoin = 'round'; g.lineCap = 'round'; if (o.dash) g.setLineDash(o.dash);
  trace(p, false); g.lineWidth = lw; g.strokeStyle = color; g.stroke(); g.restore();
}
// a limb / hose: ink outline + colored core
function tube(pts, w, color, lw = 4.5, amp = 1.1) {
  const p = wob(pts, amp, false);
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  trace(p, false); g.lineWidth = w + lw * 2; g.strokeStyle = C.ink; g.stroke();
  trace(p, false); g.lineWidth = w; g.strokeStyle = color; g.stroke(); g.restore();
}
function softShadow(x, y, rx, ry, a = .16) {
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, `rgba(80,50,40,${a})`); gr.addColorStop(.6, `rgba(80,50,40,${a * .6})`); gr.addColorStop(1, 'rgba(80,50,40,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore();
}
function glow(x, y, r, color, a = .6, mode = 'lighter') {
  g.save(); g.globalCompositeOperation = mode;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color.replace('A', a)); gr.addColorStop(1, color.replace('A', 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}
function star(x, y, r, rot = 0, fill = C.pink, lw = 3.5, o = {}) {
  shape(starPts(x, y, r, rot), Object.assign({ fill, lw, amp: .7 }, o));
}

// ---------- text ----------
const FF = { zk: 'ZK', fredoka: 'Fredoka', pixel: 'VT323', caveat: 'Caveat', serif: 'Playfair' };
function font(f, s) { g.font = `${s}px ${FF[f] || f}, "Noto Color Emoji", "DejaVu Sans", sans-serif`; }
function items(runs, color, fnt) {
  if (typeof runs === 'string') runs = [[runs, color]];
  return runs.map(r => ({ t: r[0], c: r[1] || color, f: r[2] || fnt, mk: r[3] }));
}
/* text(runs, size, x, y, {font, color, outline:[[col,w]...], jit, shadow, alpha, rot, align}) */
function text(runs, size, x, y, o = {}) {
  const its = items(runs, o.color || C.ink, o.font || 'zk');
  let tw = 0; for (const it of its) { font(it.f, size); it.w = g.measureText(it.t).width; tw += it.w; }
  const jit = o.jit == null ? .8 : o.jit, s = curScale();
  g.save();
  g.translate(x + rr(-1, 1) * jit / s, y + rr(-1, 1) * jit / s);
  g.rotate(((o.rot || 0) + rr(-1, 1) * jit * .6) * Math.PI / 180);
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round';
  const x0 = o.align === 'left' ? 0 : o.align === 'right' ? -tw : -tw / 2;
  (o.outline || []).forEach(([oc, ow], pi) => {
    if (pi === 0 && o.shadow) { g.shadowColor = 'rgba(70,30,40,.22)'; g.shadowBlur = o.shadow * s * SS; g.shadowOffsetY = o.shadow * .4 * s * SS; }
    let cx = x0; for (const it of its) { font(it.f, size); g.strokeStyle = oc; g.lineWidth = ow * 2; g.strokeText(it.t, cx, 0); cx += it.w; }
    g.shadowColor = 'transparent';
  });
  let cx = x0; for (const it of its) { font(it.f, size); g.fillStyle = it.c; g.fillText(it.t, cx, 0); cx += it.w; }
  g.restore();
  return tw;
}
function textW(str, size, f = 'zk') { font(f, size); return g.measureText(str).width; }

/* Big sticker caption, screen space, per-character pop-in. runs: [[text,color,font,marker]] */
function caption(t, t0, runs, y, size, o = {}) {
  if (t < t0) return;
  const out = o.t1 != null ? outp(t, o.t1) : 1; if (out <= 0) return;
  const its = items(runs, C.ink, o.font || 'zk');
  const chars = [];
  for (const it of its) for (const ch of Array.from(it.t)) { font(it.f, size); chars.push({ ch, c: it.c, f: it.f, mk: it.mk, w: g.measureText(ch).width }); }
  const tw = chars.reduce((a, c) => a + c.w, 0);
  const inkW = size * .13, whW = size * .075;
  g.save(); g.translate(o.x || 540, y); g.rotate((o.rot == null ? -1.5 : o.rot) * Math.PI / 180);
  g.textBaseline = 'middle'; g.textAlign = 'center'; g.lineJoin = 'round';
  let x = -tw / 2;
  chars.forEach((c, i) => { c.x = x + c.w / 2; x += c.w; c.k = pop(t, t0 + i * (o.stagger || .03), .34) * out; c.r = (hash(i + y) - .5) * 7 + rr(-1, 1) * .8; c.dy = Math.sin(t * 5 + i * .6) * (o.bob || 0); });
  const each = (fn) => chars.forEach(c => { if (c.k <= 0 || c.ch === ' ') return; g.save(); g.translate(c.x, c.dy); g.rotate(c.r * Math.PI / 180); g.scale(c.k, c.k); font(c.f, size); fn(c); g.restore(); });
  const s = curScale() * SS;
  each(c => { g.shadowColor = 'rgba(70,30,40,.25)'; g.shadowBlur = 14 * s; g.shadowOffsetY = 7 * s; g.strokeStyle = C.ink; g.lineWidth = inkW * 2; g.strokeText(c.ch, 0, 0); });
  each(c => { g.strokeStyle = C.white; g.lineWidth = whW * 2; g.strokeText(c.ch, 0, 0); });
  each(c => { if (!c.mk) return; g.fillStyle = 'rgba(255,221,120,.95)'; g.beginPath(); g.roundRect(-c.w / 2 - 2, size * .02, c.w + 4, size * .36, 6); g.fill(); });
  each(c => { g.fillStyle = c.c; g.fillText(c.ch, 0, 0); });
  g.restore();
}
function zzz(t, x, y, s = 1) {
  for (let k = 0; k < 3; k++) {
    const ph = (t * .6 + k / 3) % 1;
    text('z', (34 + 30 * ph) * s, x + ph * 90 * s + 10 * Math.sin(ph * 9), y - ph * 200 * s,
      { font: 'fredoka', color: C.ink, alpha: Math.sin(Math.PI * ph), rot: -12, outline: [[C.white, 5]] });
  }
}

// ---------- pixel faces on the LCD ----------
const EYES = {
  o: ['.###.', '#.###', '#####', '#####', '.###.'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  '^': ['.....', '..#..', '.#.#.', '#...#', '.....'],
  u: ['.....', '.....', '#...#', '.###.', '.....'],
  '-': ['.....', '.....', '#####', '.....', '.....'],
  '>': ['#....', '.##..', '...##', '.##..', '#....'],
  '<': ['....#', '..##.', '##...', '..##.', '....#'],
  T: ['#####', '..#..', '..#..', '..#..', '.....'],
  h: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  '*': ['..#..', '.###.', '#####', '.###.', '.#.#.'],
  x: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '.': ['.....', '..#..', '.###.', '..#..', '.....'],
};
const MOUTHS = {
  w: ['#.#.#', '.#.#.'], _: ['#####'], o: ['.#.', '#.#', '.#.'], D: ['#######', '#.....#', '.#####.'],
  v: ['#...#', '.#.#.', '..#..'], u: ['#...#', '.###.'], n: ['.###.', '#...#'], '.': ['#'],
};
const GRID_C = 21, GRID_R = 16;
function faceCells(face, t, blinkPh) {
  let [el, er, m] = face;
  if (blinkPh != null && 'oO.'.includes(el) && ((t + blinkPh) % 3.3) < .11) { el = '-'; er = '-'; }
  const on = [];
  const put = (spr, c0, r0) => spr.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '#') on.push([c0 + c, r0 + r]); });
  put(EYES[el] || EYES.o, 3, 4); put(EYES[er] || EYES.o, 13, 4);
  const ms = MOUTHS[m] || MOUTHS._; put(ms, 10 - Math.floor(ms[0].length / 2), 10 + (ms.length === 1 ? 1 : 0));
  return on;
}
function lcdScreen(x, y, w, h, face, t, o = {}) {
  const lcd = o.lcd || C.lcd, lcdD = o.lcdD || C.lcdD;
  // bezel
  shape(rrectPts(x - 8, y - 8, w + 16, h + 16, 20), { fill: C.bezel, lw: 4, amp: .8, sketch: false });
  g.save(); g.beginPath(); g.roundRect(x, y, w, h, 13); g.clip();
  const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, lcd); gr.addColorStop(1, lcdD);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  const cw = w / GRID_C, ch = h / GRID_R;
  g.fillStyle = 'rgba(30,38,22,.07)'; g.beginPath();
  for (let r = 0; r < GRID_R; r++) for (let c = 0; c < GRID_C; c++) g.rect(x + c * cw + .5, y + r * ch + .5, cw - 1, ch - 1);
  g.fill();
  const cells = faceCells(face, t, o.blink === false ? null : (o.blinkPh || 0));
  if (o.tears) { const k = Math.floor(t * 10) % 5; for (const cc of [5, 15]) for (let j = 0; j < 2; j++) cells.push([cc, 9 + ((k + j * 3) % 6)]); }
  if (o.extra) cells.push(...o.extra);
  g.fillStyle = C.lcdInk; g.beginPath();
  const dx = o.look ? o.look[0] : 0, dy = o.look ? o.look[1] : 0;
  for (const [c, r] of cells) g.rect(x + (c + dx) * cw + .4, y + (r + dy) * ch + .4, cw - .8, ch - .8);
  g.fill();
  // inner shadow + glass shine
  const sh = g.createLinearGradient(x, y, x, y + h * .35); sh.addColorStop(0, 'rgba(0,0,0,.16)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath();
  g.moveTo(x + w * .55, y); g.lineTo(x + w * .78, y); g.lineTo(x + w * .38, y + h); g.lineTo(x + w * .15, y + h); g.fill();
  g.restore();
}

// ---------- characters ----------
function armTarget(kind, pose, t, side) {
  const sway = Math.sin(t * 5 + side) * 4;
  if (kind === 'bot') {
    const down = [side * 112, -86 + sway], up = [side * 126, -270 + Math.sin(t * 14 + side) * 10];
    switch (pose) {
      case 'up': return [up, 0];
      case 'wave': return [side < 0 ? down : [120 + 18 * Math.sin(t * 15), -262], 0];
      case 'front': return [[side * 46, -112], 1];
      case 'cheer': return [[side * 130, -230 + Math.sin(t * 16 + side * 2) * 26], 0];
      case 'hip': return [[side * 100, -130], 0];
      default: return [down, 0];
    }
  }
  const down = [side * 86, -112 + sway], up = [side * 104, -405 + Math.sin(t * 14 + side) * 10];
  switch (pose) {
    case 'up': return [up, 0];
    case 'wave': return [side < 0 ? down : [118 + 18 * Math.sin(t * 15), -390], 0];
    case 'front': return [[side * 46, -168], 1];
    case 'cheer': return [[side * 128, -330 + Math.sin(t * 16 + side * 2) * 26], 0];
    case 'mouth': return [side > 0 ? [52, -262] : down, side > 0 ? 1 : 0];
    default: return [down, 0];
  }
}

/* bot({x,y,s,rot,face:[l,r,m],arms,t,sq,walk,lcd,lcdD,star,shadow,tears,look,hl,hr,hat,blinkPh}) */
function bot(o) {
  const t = o.t || 0, s = o.s || 1, sq = o.sq || 0;
  if (o.shadow !== false) softShadow(o.x, o.y + 2, 95 * s * (1 + sq), 18 * s, .2);
  push(o.x, o.y, o.rot || 0, s * (1 + sq), s * (1 - sq));
  for (const side of [-1, 1]) {
    const lx = side * 38, st = (o.walk || 0) * side;
    tube([[lx, -52], [lx + st * .5, -28], [lx + st, -12]], 11, C.body, 4.5);
    shape(ellipsePts(lx + st + side * 5, -9, 22, 12), { fill: C.body, shade: C.bodyS, shadeOff: [-4, -4], lw: 4.5, amp: .6 });
  }
  const fronts = [];
  for (const side of [-1, 1]) {
    let [h, front] = armTarget('bot', o.arms || 'down', t, side);
    if (side < 0 && o.hl) { h = o.hl; front = o.hlFront ? 1 : 0; }
    if (side > 0 && o.hr) { h = o.hr; front = o.hrFront ? 1 : 0; }
    if (front) { fronts.push([side, h]); continue; }
    const s0 = [side * 76, -152];
    tube(quadPts(s0, [(s0[0] + h[0]) / 2 + side * 14, (s0[1] + h[1]) / 2 - 14], h), 13, C.body, 4.5);
    shape(ellipsePts(h[0], h[1], 16, 16), { fill: C.body, shade: C.bodyS, shadeOff: [-4, -4], lw: 4.5, amp: .6 });
  }
  shape(rrectPts(-86, -240, 172, 194, [54, 54, 36, 36]), {
    fill: C.body, shade: C.bodyS, shadeOff: [-16, -12], lw: 6,
    hl: () => { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 7; g.lineCap = 'round'; trace(arcPts(-38, -192, 30, 196, 258, 8), false); g.stroke(); },
  });
  lcdScreen(-52, -204, 104, 80, o.face || ['^', '^', 'w'], t, { lcd: o.lcd, lcdD: o.lcdD, tears: o.tears, look: o.look, blinkPh: o.blinkPh || 0, blink: o.blink });
  for (const bx of [-23, 23]) shape(rrectPts(bx - 13, -97, 26, 11, 5.5), { fill: '#D6D1C4', line: '#A8A396', lw: 2, amp: .4, sketch: false });
  for (const bx of [-66, 66]) {
    g.save(); const gr = g.createRadialGradient(bx, -104, 0, bx, -104, 18);
    gr.addColorStop(0, 'rgba(244,140,165,.65)'); gr.addColorStop(1, 'rgba(244,140,165,0)');
    g.fillStyle = gr; g.fillRect(bx - 20, -124, 40, 40); g.restore();
  }
  for (const [side, h] of fronts) {
    tube(quadPts([side * 66, -150], [side * 84, -118], h), 13, C.body, 4.5);
    shape(ellipsePts(h[0], h[1], 16, 16), { fill: C.body, shade: C.bodyS, shadeOff: [-4, -4], lw: 4.5, amp: .6 });
  }
  if (o.hat) strawHat(0, -236, 1);
  if (o.star) star(80, -240, 26, 12 + Math.sin(t * 3) * 8);
  popT();
}
function strawHat(x, y, s) {
  push(x, y, -6, s);
  shape(ellipsePts(0, 0, 120, 26), { fill: '#EBCB7A', shade: '#D2AE5C', shadeOff: [0, -6], lw: 5 });
  shape([...arcPts(0, 2, 66, 180, 360, 14, 62)], { fill: '#F1D588', shade: '#D8B865', lw: 5 });
  shape(rrectPts(-64, -18, 128, 16, 6), { fill: C.pinkD, lw: 3.5, amp: .5 });
  popT();
}

/* human({x,y,s,rot,eyes,mouth,arms,t,sq,walk,look,hl,hr,shadow,blinkPh}) */
function human(o) {
  const t = o.t || 0, s = o.s || 1, sq = o.sq || 0;
  if (o.shadow !== false) softShadow(o.x, o.y + 2, 80 * s * (1 + sq), 16 * s, .2);
  push(o.x, o.y, o.rot || 0, s * (1 + sq), s * (1 - sq));
  for (const side of [-1, 1]) {
    const lx = side * 25, st = (o.walk || 0) * side;
    tube([[lx, -100], [lx + st * .5, -56], [lx + st, -18]], 26, C.pants, 4.5);
    shape(ellipsePts(lx + st + side * 8, -13, 29, 15), { fill: C.shoe, shade: '#6E5650', shadeOff: [-4, -5], lw: 4.5, amp: .6 });
  }
  // back hair
  shape(ellipsePts(0, -336, 106, 102), { fill: C.hair, lw: 5.5 });
  shape(rrectPts(-104, -350, 40, 120, 20), { fill: C.hair, lw: 5, amp: .8 });
  shape(rrectPts(64, -350, 40, 120, 20), { fill: C.hair, lw: 5, amp: .8 });
  const fronts = [];
  for (const side of [-1, 1]) {
    let [h, front] = armTarget('human', o.arms || 'down', t, side);
    if (side < 0 && o.hl) { h = o.hl; front = o.hlFront ? 1 : 0; }
    if (side > 0 && o.hr) { h = o.hr; front = o.hrFront ? 1 : 0; }
    if (front) { fronts.push([side, h]); continue; }
    const s0 = [side * 56, -205];
    tube(quadPts(s0, [(s0[0] + h[0]) / 2 + side * 12, (s0[1] + h[1]) / 2 - 10], h), 26, C.sweater, 4.5);
    shape(ellipsePts(h[0], h[1], 15, 15), { fill: C.skin, shade: C.skinS, shadeOff: [-4, -4], lw: 4.5, amp: .6 });
  }
  shape(rrectPts(-68, -238, 136, 150, [62, 62, 28, 28]), { fill: C.sweater, shade: C.sweaterS, shadeOff: [-16, -10], lw: 6 });
  stroke([[-50, -120], [50, -120]], 4, 'rgba(224,104,138,.5)', .8);
  star(0, -168, 20, 8, C.pinkD, 3);
  shape([...arcPts(0, -236, 34, 0, 180, 10, 16)], { fill: C.white, lw: 4, amp: .5 });
  // head
  shape(ellipsePts(0, -322, 94, 88), { fill: C.skin, shade: C.skinS, shadeOff: [-14, -10], lw: 6 });
  // bangs
  const bangs = [...arcPts(0, -336, 101, 186, 354, 18, 97), [96, -316], [70, -350], [44, -322], [16, -356], [-12, -326], [-42, -356], [-68, -322], [-97, -314]];
  shape(bangs, {
    fill: C.hair, lw: 5.5,
    hl: () => { g.strokeStyle = 'rgba(255,230,220,.35)'; g.lineWidth = 10; g.lineCap = 'round'; trace(arcPts(0, -340, 80, 215, 300, 10, 74), false); g.stroke(); },
  });
  stroke(quadPts([6, -434], [16, -478], [44, -462]), 7, C.hair);
  const [ex, ey] = o.look || [0, 0];
  let eyes = o.eyes || 'open';
  if ((eyes === 'open') && ((t + (o.blinkPh || 1.3)) % 3.6) < .1) eyes = 'closed';
  for (const side of [-1, 1]) {
    const cx = side * 36 + ex, cy = -298 + ey;
    if (eyes === 'open' || eyes === 'wide') {
      const k = eyes === 'wide' ? 1.3 : 1;
      shape(ellipsePts(cx, cy, 12 * k, 16 * k, 20), { fill: '#3A2E35', line: null, amp: .3 });
      shape(ellipsePts(cx + 4 * k, cy - 6 * k, 5 * k, 5 * k, 12), { fill: C.white, line: null, amp: .2 });
      shape(ellipsePts(cx - 4 * k, cy + 6 * k, 2.5 * k, 2.5 * k, 10), { fill: C.white, line: null, amp: .1 });
      stroke([[cx - 12, cy - 30], [cx + 10, cy - 33]], 4, C.hair, .5);
    } else if (eyes === 'happy') {
      stroke(arcPts(cx, cy + 6, 13, 200, 340, 8), 5.5);
    } else if (eyes === 'star') {
      star(cx, cy, 17, 0, C.pinkD, 3);
    } else if (eyes === 'heart') {
      shape(heartPts(cx, cy, 16), { fill: C.pinkD, lw: 3, amp: .4 });
    } else {
      stroke(arcPts(cx, cy - 6, 13, 20, 160, 8), 5.5);
    }
  }
  for (const side of [-1, 1]) {
    g.save(); const bx = side * 58, by = -268; const gr = g.createRadialGradient(bx, by, 0, bx, by, 24);
    gr.addColorStop(0, 'rgba(244,130,160,.6)'); gr.addColorStop(1, 'rgba(244,130,160,0)'); g.fillStyle = gr; g.fillRect(bx - 26, by - 26, 52, 52); g.restore();
  }
  const m = o.mouth || 'smile';
  if (m === 'smile') stroke(arcPts(0, -276, 12, 25, 155, 8), 5);
  else if (m === 'open') shape([...arcPts(0, -270, 15, 0, 180, 10)], { fill: '#B8455A', lw: 4.5, amp: .4 });
  else if (m === 'o') shape(ellipsePts(0, -262, 8, 10), { fill: '#B8455A', lw: 4, amp: .4 });
  else if (m === 'cat') stroke([[-14, -268], [-7, -261], [0, -268], [7, -261], [14, -268]], 4.5);
  else stroke([[-9, -262], [9, -262]], 5);
  for (const [side, h] of fronts) {
    tube(quadPts([side * 50, -205], [side * 40 + 40, -196], h), 26, C.sweater, 4.5);
    shape(ellipsePts(h[0], h[1], 15, 15), { fill: C.skin, shade: C.skinS, shadeOff: [-4, -4], lw: 4.5, amp: .6 });
  }
  if (o.hat) strawHat(0, -420, 1.1);
  popT();
}

// ---------- props ----------
function cloud(x, y, s, fill = '#FFFFFF', shade = '#E8E3EE', alpha = 1) {
  push(x, y, 0, s);
  const blobs = [[-70, 10, 52], [-20, -20, 66], [48, -4, 56], [90, 18, 40], [10, 22, 60]];
  g.save(); g.globalAlpha *= alpha;
  for (const [bx, by, r] of blobs) shape(ellipsePts(bx, by, r, r * .86, 24), { fill, lw: 5, amp: .8, sketch: false });
  for (const [bx, by, r] of blobs) shape(ellipsePts(bx, by, r - 5, r * .86 - 5, 24), { fill, line: null, amp: .5 });
  shape(ellipsePts(10, 34, 120, 22), { fill: shade, line: null, amp: .4, alpha: .6 });
  g.restore(); popT();
}
function tree(x, y, s, t) {
  push(x, y, Math.sin(t * 1.5 + x) * 1.5, s);
  shape(rrectPts(-14, -120, 28, 124, 10), { fill: C.woodD, lw: 5 });
  for (const [bx, by, r] of [[-40, -150, 60], [40, -160, 58], [0, -210, 72]]) shape(ellipsePts(bx, by, r, r * .9, 24), { fill: C.green, shade: C.greenD, shadeOff: [-10, -10], lw: 5 });
  popT();
}
function lamp(x, y, s, t, on = 1) {
  push(x, y, 0, s);
  shape(rrectPts(-7, -300, 14, 300, 7), { fill: '#5B5561', lw: 4 });
  shape(rrectPts(-30, -350, 60, 60, 16), { fill: C.butter, lw: 5 });
  if (on) glow(0, -320, 110, 'rgba(255,220,140,A)', .45);
  popT();
}
function bunting(x1, x2, y, t, n = 9) {
  const sag = 40;
  const pt = u => [lerp(x1, x2, u), y + sag * 4 * u * (1 - u)];
  stroke(Array.from({ length: 16 }, (_, i) => pt(i / 15)), 3.5);
  const cols = [C.pink, C.butter, C.lcd, '#B8CDE0'];
  for (let i = 0; i < n; i++) {
    const u = (i + .5) / n, [px, py] = pt(u), sw = Math.sin(t * 3 + i) * 6;
    shape([[px - 22, py], [px + 22, py], [px + sw * .5, py + 44]], { fill: cols[i % 4], lw: 3.5, amp: .6, sharp: true });
  }
}
function chip(x, y, label, o = {}) {
  const size = o.size || 38, f = o.font || 'zk';
  const w = textW(label, size, f) + size * 1.2, h = size * 1.7;
  shape(rrectPts(x - w / 2, y - h / 2, w, h, h / 2), { fill: o.fill || C.pink, lw: o.lw || 4.5, amp: .7, shadow: o.shadow || 0 });
  text(label, size, x, y + 1, { font: f, color: o.color || C.ink, jit: .4 });
  return w;
}
function sparkleBurst(t, t0, x, y, n = 8, r = 160, seed = 1, cols = [C.pink, C.butter, '#BFD7EA', C.lcd]) {
  const p = seg(t, t0, t0 + .7); if (p <= 0 || p >= 1) return;
  for (let i = 0; i < n; i++) {
    const a = TAU * i / n + hash(seed + i) * .6, d = r * eout(p) * (.7 + .5 * hash(seed * 3 + i));
    const sz = (16 + 14 * hash(seed + i * 7)) * (1 - ein(p));
    star(x + Math.cos(a) * d, y + Math.sin(a) * d, sz, p * 180, cols[i % cols.length], 3);
  }
}
function confetti(t, t0, x, y, n = 40, seed = 3, spread = 900) {
  const dt = t - t0; if (dt <= 0 || dt > 2.6) return;
  const cols = [C.pink, C.butter, C.lcd, '#BFD7EA', C.pinkD, '#FFFFFF'];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (hash(seed + i) - .5) * 2.4, v = spread * (.5 + .7 * hash(seed + i * 3));
    const px = x + Math.cos(a) * v * dt * .9 + Math.sin(dt * 5 + i) * 12, py = y + Math.sin(a) * v * dt + 900 * dt * dt;
    const rot = dt * 500 * (hash(i) - .5) + i * 40, w = 14 + 10 * hash(i * 5);
    push(px, py, rot, 1, Math.cos(dt * 9 + i));
    shape(rrectPts(-w / 2, -w * .35, w, w * .7, 3), { fill: cols[i % cols.length], lw: 2.5, amp: .3, sketch: false });
    popT();
  }
}
function heartFloat(t, x, y, n = 5, seed = 5, h = 300, col = C.pink) {
  for (let i = 0; i < n; i++) {
    const ph = (t * .45 + hash(seed + i)) % 1;
    const px = x + (hash(seed * 2 + i) - .5) * 260 + Math.sin(ph * 8 + i) * 18, py = y - ph * h;
    shape(heartPts(px, py, 18 + 10 * hash(i)), { fill: col, lw: 3, amp: .4, alpha: Math.sin(Math.PI * ph) });
  }
}
// pixel cursor (hand) in lutopia ink
const HAND = [
  '...##.......', '..#..#......', '..#..#......', '..#..###....', '..#..#..##..', '###..#..#.#.',
  '#.#.....#..#', '#.#........#', '#..........#', '.#.........#', '..#.......#.', '...#......#.', '....######..'];
const ARROW = ['#.......', '##......', '#.#.....', '#..#....', '#...#...', '#....#..', '#.....#.', '#..####', '#.#.#...', '##..#...', '#....#..', '.....#..'];
function pixelSprite(spr, x, y, px, ink = C.ink, fillc = C.white) {
  // fill interior per row between first and last ink pixel
  g.save(); g.fillStyle = fillc;
  spr.forEach((row, r) => { const a = row.indexOf('#'), b = row.lastIndexOf('#'); if (a >= 0 && b > a) g.fillRect(x + a * px, y + r * px, (b - a + 1) * px, px); });
  g.fillStyle = ink;
  spr.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '#') g.fillRect(x + c * px, y + r * px, px, px); });
  g.restore();
}
function cursorHand(x, y, s = 1, press = 0) {
  g.save(); g.shadowColor = 'rgba(0,0,0,.2)'; g.shadowBlur = 10 * SS * curScale(); g.shadowOffsetY = 6 * SS * curScale();
  push(x, y + press * 8, -8, s * (1 - press * .08)); pixelSprite(HAND, -24, -4, 7); popT(); g.restore();
}

// ---------- backgrounds ----------
let NOISE = [];
function makeNoise() {
  for (let k = 0; k < 3; k++) {
    const c = document.createElement('canvas'); c.width = 540; c.height = 960;
    const x = c.getContext('2d'), im = x.createImageData(540, 960), r = mulberry32(99 + k);
    for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (r() - .5) * 70; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0); NOISE.push(c);
  }
}
function paperBG(top = C.cream, bottom = C.cream, dots = true, x0 = 0, y0 = 0, x1 = W, y1 = H) {
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(x0 - 3000, y0 - 3000, x1 - x0 + 6000, y1 - y0 + 6000);
  if (dots) {
    g.fillStyle = 'rgba(120,100,70,.10)'; g.beginPath();
    for (let y = 23 + Math.floor(y0 / 46) * 46; y < y1; y += 46) for (let x = 23 + Math.floor(x0 / 46) * 46; x < x1; x += 46) { g.moveTo(x + 2.4, y); g.arc(x, y, 2.4, 0, TAU); }
    g.fill();
  }
}
function camera(cx, cy, z, rot = 0) {
  g.setTransform(SS, 0, 0, SS, 0, 0); g.translate(W / 2, H / 2); g.scale(z, z);
  if (rot) g.rotate(rot * Math.PI / 180); g.translate(-cx, -cy);
}
function screen() { g.setTransform(SS, 0, 0, SS, 0, 0); }
function finishFrame() {
  // grain + vignette in screen space
  g.setTransform(SS, 0, 0, SS, 0, 0);
  g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .22; g.drawImage(NOISE[BOIL % 3], 0, 0, W, H); g.restore();
  const vg = g.createRadialGradient(W / 2, H * .46, H * .32, W / 2, H * .5, H * .78);
  vg.addColorStop(0, 'rgba(60,35,30,0)'); vg.addColorStop(1, 'rgba(60,35,30,.16)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}
