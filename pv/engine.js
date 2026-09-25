/* PV engine: beat clock, easing, math, drawing primitives, tiny 3D box renderer.
   Everything is procedural — no bitmap assets. */
'use strict';
const PV = (window.PV = {});

PV.BPM = 170;
PV.BEAT = 60 / PV.BPM;
PV.BAR = PV.BEAT * 4;
PV.W = 1280;
PV.H = 720;

PV.C = {
  cyan: '#2fd6c6',
  cyanL: '#8ce9df',
  cyanD: '#139e93',
  paper: '#ecedeb',
  paper2: '#f7f7f5',
  gray: '#9d9fa2',
  grayL: '#c9cacc',
  ink: '#1a1b1e',
  steel: '#5f7385',
  fog: '#d3dce3',
  salmon: '#f2a48f',
  lilac: '#b8a8ee',
};
PV.RGB = {
  cyan: [47, 214, 198],
  ink: [26, 27, 30],
  steel: [70, 84, 98],
  white: [240, 241, 240],
  gray: [157, 159, 162],
};

/* ---------- math ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const TAU = Math.PI * 2;
const E = {
  lin: t => t,
  inQ: t => t * t,
  outQ: t => 1 - (1 - t) * (1 - t),
  ioQ: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inC: t => t * t * t,
  outC: t => 1 - Math.pow(1 - t, 3),
  ioC: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inE: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outE: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  ioE: t =>
    t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: t => {
    const s = 1.70158;
    return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
  outElastic: t =>
    t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,
};
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
Object.assign(PV, { clamp, lerp, seg, TAU, E, hash, noise1, rng });

/* ---------- hit envelopes (filled by audio.js score so picture and sound share one grid) ---------- */
PV.hits = {};
PV.lastHit = function (name, t) {
  const a = PV.hits[name];
  if (!a || !a.length || a[0] > t) return -1e9;
  let lo = 0, hi = a.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (a[m] <= t) lo = m; else hi = m - 1;
  }
  return a[lo];
};
/** exponential decay since last hit: 1 at the hit, ~0 after `decay` seconds */
PV.env = (name, t, decay = 0.25) => Math.exp((-(t - PV.lastHit(name, t)) / decay) * 3);

/* ---------- sprites ---------- */
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
PV.mk = mk;
const spriteCache = {};
/** soft round sprite; hardness 0 = gaussian-ish, 1 = crisp disc */
PV.soft = function (color, hardness = 0) {
  const key = color + hardness;
  if (spriteCache[key]) return spriteCache[key];
  const c = mk(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, color);
  gr.addColorStop(clamp(hardness * 0.97), color);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return (spriteCache[key] = c);
};
PV.dot = (g, x, y, r, color, hardness = 0, alpha = 1) => {
  g.globalAlpha = alpha;
  g.drawImage(PV.soft(color, hardness), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
};
const patCache = {};
PV.hatch = function (g, color, spacing = 6, width = 1.5) {
  const key = color + spacing + width;
  if (!patCache[key]) {
    const s = spacing * 2, c = mk(s, s), x = c.getContext('2d');
    x.strokeStyle = color; x.lineWidth = width;
    for (let i = -1; i <= 1; i++) {
      x.beginPath(); x.moveTo(i * s, s); x.lineTo(i * s + s, 0); x.stroke();
    }
    x.beginPath(); x.moveTo(-s / 2, s / 2); x.lineTo(s / 2, -s / 2); x.stroke();
    x.beginPath(); x.moveTo(s / 2, s * 1.5); x.lineTo(s * 1.5, s / 2); x.stroke();
    patCache[key] = c;
  }
  return g.createPattern(patCache[key], 'repeat');
};

/* ---------- 2D primitives ---------- */
PV.F = {
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
  sans: '"Archivo", "Helvetica Neue", Arial, sans-serif',
  narrow: '"Archivo Narrow", "Arial Narrow", sans-serif',
  black: '"Archivo Black", "Arial Black", sans-serif',
};
PV.text = (g, s, x, y, size, color, align = 'left', font = PV.F.mono, weight = '') => {
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(s, x, y);
};
PV.line = (g, x1, y1, x2, y2, color, w = 1) => {
  g.strokeStyle = color; g.lineWidth = w;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
};
PV.ring = (g, x, y, r, color, w = 1, a0 = 0, a1 = TAU) => {
  g.strokeStyle = color; g.lineWidth = w;
  g.beginPath(); g.arc(x, y, Math.max(0, r), a0, a1); g.stroke();
};
PV.disc = (g, x, y, r, color) => {
  g.fillStyle = color;
  g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); g.fill();
};
PV.cross = (g, x, y, s, color, w = 1) => {
  PV.line(g, x - s, y, x + s, y, color, w);
  PV.line(g, x, y - s, x, y + s, color, w);
};
PV.arrow = (g, x1, y1, x2, y2, w, head, color) => {
  const a = Math.atan2(y2 - y1, x2 - x1), c = Math.cos(a), s = Math.sin(a);
  g.fillStyle = color;
  g.strokeStyle = color; g.lineWidth = w;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - c * head, y2 - s * head); g.stroke();
  g.beginPath();
  g.moveTo(x2, y2);
  g.lineTo(x2 - c * head * 1.6 - s * head * 0.8, y2 - s * head * 1.6 + c * head * 0.8);
  g.lineTo(x2 - c * head * 1.6 + s * head * 0.8, y2 - s * head * 1.6 - c * head * 0.8);
  g.closePath(); g.fill();
};
PV.poly = (g, pts, fill, stroke, w = 1) => {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.stroke(); }
};
PV.hex = (g, x, y, r, rot = 0) => {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU - Math.PI / 2;
    p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return p;
};
PV.rrect = (g, x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};
/** sine "oscilloscope" line spanning the frame */
PV.sine = (g, y, amp, periods, phase, color, w = 1, x0 = 0, x1 = PV.W) => {
  g.strokeStyle = color; g.lineWidth = w;
  g.beginPath();
  for (let x = x0; x <= x1; x += 4) {
    const v = y + Math.sin((x / PV.W) * periods * TAU + phase) * amp;
    x === x0 ? g.moveTo(x, v) : g.lineTo(x, v);
  }
  g.stroke();
};
/** concave star — the "organism" spike shape */
PV.spike = (g, x, y, R, n, rot, inner, color) => {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU, b = rot + ((i + 0.5) / n) * TAU, c = rot + ((i + 1) / n) * TAU;
    const tip = [x + Math.cos(a) * R, y + Math.sin(a) * R];
    if (i === 0) g.moveTo(tip[0], tip[1]);
    g.quadraticCurveTo(x + Math.cos(b) * R * inner, y + Math.sin(b) * R * inner, x + Math.cos(c) * R, y + Math.sin(c) * R);
  }
  g.closePath(); g.fill();
};
/** glass sphere with tinted rim, dark core reflection and highlight */
PV.ball = (g, x, y, r, tint = PV.C.cyan) => {
  if (r <= 0.5) return;
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.35, '#e8fbf8');
  gr.addColorStop(0.72, tint);
  gr.addColorStop(0.9, '#0d3d3a');
  gr.addColorStop(1, '#bff5ef');
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = 'rgba(10,30,30,0.55)';
  g.beginPath(); g.ellipse(x + r * 0.2, y + r * 0.25, r * 0.45, r * 0.18, -0.5, 0, TAU); g.fill();
  PV.dot(g, x - r * 0.35, y - r * 0.42, r * 0.3, '#ffffff', 0.4, 0.9);
};
/** the original emblem: hexagon + chevron "D" glyph */
PV.mark = (g, x, y, s, color, stroke = 0.09) => {
  g.save();
  g.lineJoin = 'miter';
  PV.poly(g, PV.hex(g, x, y, s), null, color, s * stroke);
  g.strokeStyle = color; g.lineWidth = s * 0.16;
  g.beginPath();
  g.moveTo(x - s * 0.32, y - s * 0.42); g.lineTo(x - s * 0.32, y + s * 0.42);
  g.stroke();
  g.beginPath();
  g.moveTo(x - s * 0.08, y - s * 0.42); g.lineTo(x + s * 0.38, y); g.lineTo(x - s * 0.08, y + s * 0.42);
  g.stroke();
  PV.disc(g, x, y - s * 1.35, s * 0.09, color);
  g.restore();
};
/** tiny HUD label block: [box] text */
PV.tag = (g, x, y, s, color, size = 9) => {
  g.strokeStyle = color; g.lineWidth = 1;
  g.strokeRect(x, y - 4, 8, 8);
  PV.text(g, s, x + 14, y, size, color);
};

/* ---------- tiny 3D ---------- */
PV.cam = (x = 0, y = 0, z = -800, rx = 0, ry = 0, rz = 0, f = 900) => ({ x, y, z, rx, ry, rz, f });
function rot3(p, rx, ry, rz) {
  let [x, y, z] = p, c, s;
  c = Math.cos(rx); s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry); s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rz); s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}
PV.rot3 = rot3;
PV.project = (p, cam) => {
  let v = [p[0] - cam.x, p[1] - cam.y, p[2] - cam.z];
  v = rot3(v, cam.rx, cam.ry, 0);
  const cr = Math.cos(cam.rz), sr = Math.sin(cam.rz);
  const X = v[0] * cr - v[1] * sr, Y = v[0] * sr + v[1] * cr;
  const z = v[2];
  const s = cam.f / Math.max(z, 1);
  return [PV.W / 2 + X * s, PV.H / 2 + Y * s, z, s];
};
const BV = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const BF = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 5, 1, 0], [3, 2, 6, 7], [1, 5, 6, 2], [4, 0, 3, 7]];
const LIGHT = (() => { const l = [-0.45, -0.75, -0.5], m = Math.hypot(...l); return l.map(v => v / m); })();
/**
 * boxes: [{p:[x,y,z], s:[w,h,d], r:[rx,ry,rz], c:[r,g,b], a?:alpha, edge?:css}]
 * Painter-sorted, back-face culled, lambert + ambient shading.
 */
PV.boxes = (g, boxes, cam, opt = {}) => {
  const amb = opt.ambient ?? 0.45, list = [];
  for (const b of boxes) {
    const wv = BV.map(v => {
      const r = rot3([v[0] * b.s[0] / 2, v[1] * b.s[1] / 2, v[2] * b.s[2] / 2], b.r[0], b.r[1], b.r[2]);
      return [r[0] + b.p[0], r[1] + b.p[1], r[2] + b.p[2]];
    });
    const pv = wv.map(v => PV.project(v, cam));
    if (pv.some(p => p[2] < 20)) continue;
    for (const f of BF) {
      const c = [0, 0, 0];
      f.forEach(i => { c[0] += wv[i][0] / 4; c[1] += wv[i][1] / 4; c[2] += wv[i][2] / 4; });
      let n = [c[0] - b.p[0], c[1] - b.p[1], c[2] - b.p[2]];
      const nm = Math.hypot(...n) || 1; n = n.map(v => v / nm);
      const toCam = [cam.x - c[0], cam.y - c[1], cam.z - c[2]];
      if (n[0] * toCam[0] + n[1] * toCam[1] + n[2] * toCam[2] <= 0) continue;
      const lam = Math.max(0, -(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));
      const k = amb + (1 - amb) * lam;
      const depth = f.reduce((a, i) => a + pv[i][2], 0) / 4;
      list.push({ depth, pts: f.map(i => pv[i]), k, b });
    }
  }
  list.sort((a, b) => b.depth - a.depth);
  for (const it of list) {
    const { b, k } = it;
    const fog = opt.fog ? clamp((it.depth - opt.fog[0]) / (opt.fog[1] - opt.fog[0])) : 0;
    let col = b.c.map(v => v * k);
    if (opt.fog) col = col.map((v, i) => lerp(v, opt.fogColor[i], fog));
    g.globalAlpha = b.a ?? 1;
    PV.poly(g, it.pts, `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`, b.edge || null, 1);
  }
  g.globalAlpha = 1;
};
