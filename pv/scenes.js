/* Scene list + transitions. All times are in bars (1 bar = 4 beats @170 BPM ≈ 1.412 s).
   Each scene: draw(g, s) → optional fx overrides. s = {t, lt, u, dur, bar, gb, lb, bf}
   t: global sec · lt: local sec · u: local 0..1 · gb: global beats · lb: local beats · bf: beat fraction */
'use strict';
(function () {
  const { W, H, C, RGB, BAR, BEAT, E, TAU, clamp, lerp, seg, hash, noise1, rng } = PV;
  const fill = (g, c) => { g.fillStyle = c; g.fillRect(0, 0, W, H); };
  const tri = k => 1 - Math.abs(k * 2 - 1);
  const kick = t => PV.env('kick', t, 0.22);
  const snare = t => PV.env('snare', t, 0.18);

  /* ---------- shared backgrounds / props ---------- */
  function paper(g, t, wedges = true) {
    fill(g, C.paper);
    if (!wedges) return;
    g.fillStyle = 'rgba(255,255,255,0.6)';
    PV.poly(g, [[-50, H * 0.1], [W * 0.45 + Math.sin(t * 0.3) * 30, H * 0.55], [-50, H * 0.9]], 'rgba(255,255,255,0.55)');
    PV.poly(g, [[W * 0.55, -20], [W + 40, -20], [W + 40, H * 0.5], [W * 0.8 + Math.cos(t * 0.25) * 40, H * 0.2]], 'rgba(255,255,255,0.45)');
    PV.poly(g, [[W * 0.1, H + 20], [W * 0.5, H * 0.72], [W * 0.95, H + 20]], 'rgba(0,0,0,0.025)');
  }
  function hudCorners(g, color, a = 1) {
    g.globalAlpha = a;
    const m = 24, l = 14;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
      PV.line(g, x, y, x + l * sx, y, color, 1);
      PV.line(g, x, y, x, y + l * sy, color, 1);
    });
    g.globalAlpha = 1;
  }
  function hudBlock(g, t, color) {
    PV.text(g, 'DASTER', 26, 30, 13, color, 'left', PV.F.sans, '600');
    PV.text(g, 'PHASE SHIFT', 26, 46, 13, color, 'left', PV.F.sans, '600');
    PV.text(g, '#01', 112, 62, 10, color);
    g.fillStyle = color; PV.rrect(g, 108, 24, 36, 10, 5); g.fill();
    PV.text(g, 'MOTION STUDY', 26, 62, 9, color);
    PV.line(g, 26, H - 40, 26 + 140 + Math.sin(t * 3) * 20, H - 40, color, 1);
    PV.text(g, `T+${t.toFixed(2)}`, 26, H - 28, 9, color);
  }
  const glassQuads = (seed, n) =>
    Array.from({ length: n }, (_, i) => {
      const r = rng(seed + i * 17);
      return { x: r() * W, y: r() * H * 0.95, w: 200 + r() * 240, h: 140 + r() * 180, a: r() * TAU, va: (r() - 0.5) * 0.45, vx: (r() - 0.5) * 36, vy: (r() - 0.5) * 20 };
    });
  function drawGlass(g, quads, lt, alpha = 1) {
    for (const q of quads) {
      g.save();
      g.translate(q.x + q.vx * lt, q.y + q.vy * lt);
      g.rotate(q.a + q.va * lt);
      g.globalAlpha = alpha;
      g.fillStyle = 'rgba(255,255,255,0.075)';
      g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
      g.strokeStyle = 'rgba(255,255,255,0.65)'; g.lineWidth = 1.3;
      g.strokeRect(-q.w / 2, -q.h / 2, q.w, q.h);
      g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 6;
      g.strokeRect(-q.w / 2 + 5, -q.h / 2 + 5, q.w - 10, q.h - 10);
      g.restore();
    }
    g.globalAlpha = 1;
  }
  /** 2.5D slab: front face + lighter top face */
  function slab(g, x, y, w, h, depth, color, top) {
    g.fillStyle = top;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + depth, y - depth * 0.6); g.lineTo(x + w + depth, y - depth * 0.6); g.lineTo(x + w, y); g.closePath(); g.fill();
    g.fillStyle = color; g.fillRect(x, y, w, h);
  }

  /* hexagon icon set — all original line glyphs */
  const ICONS = [
    (g, s) => PV.sine(g, 0, s * 0.25, 1, 0, C.cyan, 2, -s * 0.5, s * 0.5),
    (g, s) => { PV.poly(g, [[0, -s * 0.45], [s * 0.42, s * 0.3], [-s * 0.42, s * 0.3]], null, C.cyan, 2); PV.ring(g, 0, s * 0.02, s * 0.15, C.cyan, 2); },
    (g, s) => { [-1, 0, 1].forEach(i => PV.disc(g, i * s * 0.28, 0, s * 0.09, C.cyan)); },
    (g, s) => { g.strokeStyle = C.cyan; g.lineWidth = 2; g.beginPath(); for (let a = 0; a < 12; a += 0.2) { const r = a * s * 0.035; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); },
    (g, s) => { PV.ring(g, -s * 0.12, 0, s * 0.3, C.cyan, 2, -1, 1); PV.ring(g, s * 0.12, 0, s * 0.3, C.cyan, 2, Math.PI - 1, Math.PI + 1); },
    (g, s) => { const p = [[-0.3, -0.25], [0.3, -0.3], [0, 0.3], [-0.35, 0.3]]; p.forEach((a, i) => p.slice(i + 1).forEach(b => PV.line(g, a[0] * s, a[1] * s, b[0] * s, b[1] * s, C.cyan, 1.5))); p.forEach(a => PV.disc(g, a[0] * s, a[1] * s, 3, C.cyan)); },
    (g, s) => PV.cross(g, 0, 0, s * 0.3, C.cyan, 3),
    (g, s) => { for (let i = 0; i < 2; i++) { g.strokeStyle = C.cyan; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-s * 0.3 + i * s * 0.25, -s * 0.3); g.lineTo(-s * 0.05 + i * s * 0.25, 0); g.lineTo(-s * 0.3 + i * s * 0.25, s * 0.3); g.stroke(); } },
  ];

  const S = [];
  const scene = (name, a, b, draw, extra = {}) => S.push({ name, a, b, draw, ...extra });

  /* 0 ─ SIGNAL: black, oscilloscope line draws on, emblem flickers in */
  scene('signal', 0, 1, (g, s) => {
    fill(g, '#060607');
    const k = E.outC(seg(s.u, 0.05, 0.85));
    PV.sine(g, H / 2, 42, 3, s.t * 2, 'rgba(255,255,255,0.32)', 1, 0, W * k);
    const on = s.u < 0.55 ? (hash(Math.floor(s.t * 24)) > 0.45 ? 1 : 0.15) : 1;
    g.globalAlpha = on * seg(s.u, 0.2, 0.6);
    PV.mark(g, W / 2, H / 2 - 6, 15, '#e9e9e9');
    g.globalAlpha = 1;
    PV.text(g, 'DASTER.ME — MOTION STUDY 01', W / 2, H / 2 + 42, 9, `rgba(255,255,255,${0.45 * seg(s.u, 0.4, 0.8)})`, 'center');
    return { grain: 0.07, vig: 0.7 };
  });

  /* 1 ─ LEAK: pastel light leak, sine continuity, pedestal rises */
  scene('leak', 1, 3, (g, s) => {
    const { t, lt, u } = s;
    fill(g, '#f3f4f2');
    [[0.8, 0.28, 540, C.cyan, 0.55], [0.6, 0.02, 420, C.salmon, 0.42], [0.18, 0.18, 380, C.lilac, 0.24], [0.97, 0.85, 470, C.cyan, 0.5], [0.06, 0.95, 300, C.salmon, 0.2]]
      .forEach(([x, y, r, c, a], i) => PV.dot(g, W * x + noise1(t * 0.3 + i * 9) * 70, H * y + noise1(t * 0.25 + i * 3) * 40, r * (1 + 0.06 * Math.sin(t + i)), c, 0, a));
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.05 + hash(i + 9) * 0.1})`; g.fillRect(hash(i) * W, 0, 1 + hash(i + 3) * 3, H); }
    for (let i = 0; i < 12; i++) PV.line(g, 40 + i * 110, H / 2, 54 + i * 110, H / 2, 'rgba(40,40,40,.55)', 1);
    PV.sine(g, H / 2, H * 0.42 * E.outC(seg(lt, 0, BAR * 0.6)) + 42 * (1 - E.outC(seg(lt, 0, BAR * 0.6))), 2, t * 0.9, 'rgba(30,30,30,.75)', 1);
    for (let i = 0; i < 7; i++) PV.dot(g, W * (0.7 + 0.25 * hash(i + 40)) + Math.sin(t * 0.7 + i) * 10, H * (0.15 + 0.5 * hash(i + 50)), 16 + 28 * hash(i + 60), '#ffffff', 0.8, 0.75);
    const rise = E.outC(seg(lt, BAR * 0.25, BAR * 1.3));
    const bx = W / 2 - 55, by = H + 20 - rise * 150;
    for (let j = 0; j < 3; j++) slab(g, bx, by + j * 26, 110, 22, 12, '#6d7072', '#b8babc');
    PV.line(g, bx + 62, by - 8, bx + 62, by - 38 * rise, '#555', 1.2);
    PV.cross(g, bx + 62, by - 38 * rise, 4, '#555');
    return { grain: 0.05, vig: 0.22, zoom: 1 + u * 0.04 };
  });

  /* 2 ─ GLASS FOG: tumbling glass panes around a monolith */
  const Q2 = glassQuads(100, 15);
  scene('glass', 3, 5, (g, s) => {
    const { t, lt, u } = s;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#50667a'); gr.addColorStop(0.55, '#b9c6d1'); gr.addColorStop(0.75, '#e9eef2'); gr.addColorStop(1, '#c3ced7');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    PV.dot(g, W * 0.78, H * 0.12, 420, '#ffffff', 0, 0.55);
    for (let i = 0; i < 16; i++) PV.dot(g, (hash(i) * W * 1.2 + lt * 25 * (0.5 + hash(i + 1))) % (W * 1.2) - 60, H * (0.62 + hash(i + 2) * 0.3), 120 + hash(i + 4) * 160, '#ffffff', 0, 0.35);
    const cam = PV.cam(0, -40 + u * 30, -1100, 0.08, 0, 0, 1000);
    const bx = [];
    for (let i = 0; i < 9; i++) bx.push({ p: [0, 140 - i * 32, 0], s: [86, 24, 86], r: [0, lt * 0.35 * (i % 2 ? 1 : -1) + i * 0.4, 0], c: [58, 70, 84], edge: 'rgba(210,225,235,0.35)' });
    PV.boxes(g, bx, cam, { ambient: 0.5 });
    drawGlass(g, Q2, lt);
    ['NODE.01', 'ECO/SIM', 'VEC 0.34', 'SEED 100', 'FIELD'].forEach((l, i) => PV.tag(g, 80 + i * 240 + Math.sin(t + i) * 6 - lt * 8, 60, l, 'rgba(255,255,255,.7)'));
    PV.text(g, 'phase.01 — seeding', W / 2, H * 0.84, 10, 'rgba(60,70,80,.7)', 'center');
    return { vig: 0.45, grain: 0.05, rgb: 0.8, zoom: 1.02 + u * 0.03 };
  }, { xin: 0.3 });

  /* 3 ─ TOWER: rotating dark slab tower, god rays, light bar → slit-scan out */
  scene('tower', 5, 8, (g, s) => {
    const { t, lt, u, bar } = s;
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#26323d'); gr.addColorStop(1, '#6e8090');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.42;
    g.save(); g.translate(cx, cy); g.rotate(t * 0.05);
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * TAU, w = 0.012 + hash(i) * 0.03;
      g.fillStyle = `rgba(255,255,255,${0.025 + hash(i + 5) * 0.07})`;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - w) * 1400, Math.sin(a - w) * 1400); g.lineTo(Math.cos(a + w) * 1400, Math.sin(a + w) * 1400); g.fill();
    }
    g.restore();
    PV.dot(g, W * 0.12, H * 0.3, 380, C.salmon, 0, 0.28);
    PV.dot(g, W * 0.9, H * 0.6, 420, C.cyan, 0, 0.18);
    PV.dot(g, cx, cy, 260, '#ffffff', 0, 0.45);
    const cam = PV.cam(0, 30 - u * 60, -1150, 0.04, 0, 0, 1000);
    const bx = [];
    for (let i = 0; i < 11; i++) bx.push({ p: [0, 250 - i * 50, 0], s: [230, 40, 230], r: [0, i * 0.17 + lt * (0.25 + (i % 3) * 0.06), 0], c: [44, 54, 66], edge: 'rgba(190,210,225,0.25)' });
    PV.boxes(g, bx, cam, { ambient: 0.42 });
    const ly = cy + Math.sin(lt * 1.3) * 70;
    g.globalCompositeOperation = 'lighter';
    g.drawImage(PV.soft('#ffffff'), cx - 280, ly - 7, 560, 14);
    g.drawImage(PV.soft('#bfefff'), -100, ly - 3, W + 200, 6);
    g.globalCompositeOperation = 'source-over';
    PV.line(g, cx - 150, ly, cx + 150, ly, 'rgba(255,255,255,.95)', 1.5);
    const sl = E.inQ(seg(bar, 7, 8));
    return { vig: 0.5, grain: 0.06, rgb: 1 + sl * 9, slit: sl, zoom: 1 + u * 0.05 };
  }, { xin: 0.25 });

  /* 4 ─ BLUEPRINT: cyan slabs stack on 8ths over a schematic field */
  scene('blueprint', 8, 10, (g, s) => {
    const { t, lt, lb } = s;
    paper(g, t);
    g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(0, H * (0.15 + i * 0.12)); g.lineTo(W, H * (0.1 + i * 0.13) + Math.sin(i) * 30); g.stroke(); }
    const rc = [W * 0.6, H * 0.52];
    g.setLineDash([2, 6]); PV.ring(g, rc[0], rc[1], 250, 'rgba(47,214,198,.5)', 1.2, -1.6 + lt * 0.2, 1.4 + lt * 0.2); g.setLineDash([]);
    PV.ring(g, rc[0], rc[1], 210, 'rgba(0,0,0,.12)', 1, -1.6 - lt * 0.1, 1.2 - lt * 0.1);
    for (let i = 0; i < 12; i++) {
      const k = E.outE(seg(lb, i * 0.5, i * 0.5 + 0.6));
      if (k <= 0) continue;
      const dir = i % 2 ? 1 : -1;
      const x = W * 0.36 + Math.sin(i * 0.9 + lt * 0.8) * 26 + dir * (1 - k) * 360;
      const y = H * 0.86 - i * 40;
      g.globalAlpha = k;
      slab(g, x, y, 250, 30, 16, i % 3 === 2 ? '#7fe4da' : C.cyan, '#c7f6f1');
      PV.line(g, x, y + 30, x + 250, y + 30, 'rgba(255,255,255,.8)', 1);
    }
    g.globalAlpha = 1;
    const bl = PV.hits.blip.filter(x => x <= s.t).length;
    for (let i = 0; i < Math.min(bl, 16); i++) {
      const x = W * 0.72 + (i % 4) * 34, y = H * 0.3 + Math.floor(i / 4) * 34, fresh = PV.env('blip', s.t, 0.2) * (i === bl - 1);
      g.fillStyle = C.cyan; g.fillRect(x - 8 - fresh * 4, y - 8 - fresh * 4, 16 + fresh * 8, 16 + fresh * 8);
    }
    PV.arrow(g, W * 0.12, H * 0.44, W * 0.25, H * 0.44, 1.5, 5, C.cyan);
    PV.text(g, 'phase.01 / build', W * 0.12, H * 0.41, 10, C.cyanD);
    hudCorners(g, 'rgba(0,0,0,.35)');
    return { grain: 0.03, vig: 0.15 };
  });

  /* 5 ─ CUBE FIELD: dark voxel city, bokeh, diagonal glass plane */
  const CF = [];
  { const r = rng(5); for (let i = 0; i < 15; i++) for (let j = 0; j < 15; j++) { const h = 20 + Math.pow(r(), 2) * 220; CF.push({ p: [(i - 7) * 95, -h / 2, j * 95], s: [70, h, 70], r: [0, 0, 0], c: r() < 0.08 ? [205, 210, 215] : [50, 57, 66], edge: 'rgba(150,185,205,0.16)' }); } }
  scene('cubefield', 10, 12, (g, s) => {
    const { t, lt, u } = s;
    fill(g, '#0d1115');
    const cam = PV.cam(Math.sin(lt * 0.4) * 60, -560, -560 + lt * 200, 0.62, -0.12 + lt * 0.04, 0, 900);
    PV.boxes(g, CF, cam, { ambient: 0.4, fog: [500, 2100], fogColor: [13, 17, 21] });
    PV.poly(g, [[0, H * 0.66 - u * 40], [W, H * 0.46 - u * 40], [W, H], [0, H]], 'rgba(205,220,232,0.16)');
    PV.line(g, 0, H * 0.66 - u * 40, W, H * 0.46 - u * 40, 'rgba(255,255,255,.5)', 1.2);
    for (let i = 0; i < 9; i++) PV.dot(g, (hash(i) * W + lt * 30 * (i % 3 + 1)) % W, H * hash(i + 7), 30 + hash(i + 2) * 80, i % 3 ? '#9fe9ff' : '#ffffff', 0.7, 0.12 + 0.16 * hash(i + 4));
    const sa = 1 - seg(lt, 0, BAR * 0.6);
    if (sa > 0) PV.sine(g, H / 2, H * 0.42, 2, t * 0.9, `rgba(255,255,255,${0.5 * sa})`, 1);
    return { vig: 0.55, grain: 0.06, rgb: 1.5 };
  });

  /* 6 ─ HUD BUBBLES: rising bubble column, arrows, hatch bands, tumbling tiles */
  scene('hud', 12, 14, (g, s) => {
    const { t, lt, lb } = s;
    paper(g, t);
    const pop = i => E.outBack(seg(lb, i, i + 0.5));
    for (let i = 0; i < 7; i++) {
      const x = W * (0.18 + i * 0.11);
      for (let y = (lt * 40) % 14; y < H; y += 14) PV.disc(g, x, y, 1.1, 'rgba(47,214,198,.55)');
    }
    const dl = E.outE(seg(lb, 0, 1));
    PV.line(g, W * 0.32, 0, lerp(W * 0.32, W * 0.62, dl), lerp(0, H * 0.56, dl), C.cyan, 3);
    g.save(); g.beginPath(); g.rect(W * 0.42, H * 0.34, 340 * E.outE(seg(lb, 1, 1.6)), 72); g.clip();
    g.fillStyle = PV.hatch(g, C.cyan, 5, 1.5); g.fillRect(W * 0.42, H * 0.34, 340, 72); g.restore();
    [0, 1, 2].forEach(i => {
      const k = E.outE(seg(lb, 0.5 + i * 0.25, 1.3 + i * 0.25)), y = H * 0.5 + i * 14, x1 = W * 0.18, x2 = W * (0.62 + i * 0.07);
      if (k > 0) PV.arrow(g, x1, y, lerp(x1, x2, k), y, 5, 6, C.cyan);
    });
    g.fillStyle = C.cyan; g.fillRect(W * 0.42, H * 0.63, 380 * E.outE(seg(lb, 3, 3.6)), 24);
    g.save(); g.translate(W * 0.28, H * 0.5); g.scale(pop(2), pop(2)); g.rotate(lt * 2);
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); PV.line(g, 9, 0, 14, 0, '#555', 2); }
    PV.ring(g, 0, 0, 7, '#555', 1.5); g.restore();
    for (let i = 0; i < 80; i++) {
      const y = H + 40 - ((lt * (90 + hash(i) * 80) + hash(i + 3) * H * 1.5) % (H * 1.5));
      const x = W * 0.52 + noise1(i * 3.1 + lt * 0.8) * 70 + Math.sin(y * 0.02 + i) * 8;
      PV.dot(g, x, y, 5 + hash(i + 8) * 13, C.cyan, 0.75, 0.45 + hash(i + 1) * 0.4);
    }
    const cam = PV.cam(0, 0, -900, 0, 0, 0, 900), tiles = [];
    for (let i = 0; i < 9; i++) {
      const p = ((lt * 0.28 + i / 9) % 1) * 2 - 1;
      tiles.push({ p: [p * 800, -p * 200 + (hash(i) - 0.5) * 160 - 80, (hash(i + 2) - 0.5) * 300], s: [110, 22, 80], r: [lt * 1.1 + i, lt * 0.7 + i * 2, 0.3], c: RGB.cyan, a: 0.85 });
    }
    PV.boxes(g, tiles, cam, { ambient: 0.62 });
    PV.text(g, 'eco.sim / growth', W * 0.18, H * 0.47, 10, C.cyanD);
    hudCorners(g, 'rgba(0,0,0,.3)');
    return { vig: 0.15, grain: 0.03, zoom: 1 + 0.015 * kick(s.t) };
  });

  /* 7 ─ SPHERES + DISC: glass spheres pop on 16ths, black disc iris opens */
  scene('spheres', 14, 15, (g, s) => {
    const { t, lt, lb } = s;
    paper(g, t);
    g.setLineDash([3, 5]); PV.line(g, 0, H * 0.5, W, H * 0.5, 'rgba(47,214,198,.7)', 1); g.setLineDash([]);
    for (let i = 0; i < 6; i++) { const x = W * (0.12 + i * 0.16); PV.line(g, x, H * 0.47, x, H * 0.5, C.cyan, 2); PV.line(g, x, H * 0.5, x + 10, H * 0.5, C.cyan, 2); }
    const cam = PV.cam(0, 0, -900, 0, 0, 0, 900), col = [];
    for (let i = 0; i < 12; i++) col.push({ p: [-250, 290 - i * 48, 0], s: [130, 40, 110], r: [0, i * 0.3 + lt * 0.5, 0.04], c: [34, 36, 40] });
    PV.boxes(g, col, cam, { ambient: 0.4 });
    g.save(); g.beginPath(); g.rect(W * 0.36, H * 0.34, 100, 110); g.clip();
    g.fillStyle = PV.hatch(g, C.cyan, 5, 1.5); g.fillRect(W * 0.36, H * 0.34, 100, 110); g.restore();
    const drift = E.inQ(seg(lb, 1.5, 4));
    const r = rng(14);
    for (let i = 0; i < 16; i++) {
      const k = E.outBack(seg(lb, i * 0.12, i * 0.12 + 0.4));
      const x = W * 0.3 + (r() - 0.5) * 260 - drift * 160, y = H * 0.45 + (r() - 0.5) * 300 - drift * 60, rr = 16 + r() * 44;
      PV.ball(g, x, y, rr * k);
    }
    const dk = E.outE(seg(lb, 1.5, 2.4)), dx = W * 0.68, dy = H * 0.5, R = 200 * dk;
    if (R > 1) {
      PV.disc(g, dx, dy, R, '#1d1e21');
      PV.ring(g, dx, dy, R * 0.62, 'rgba(255,255,255,.12)', 1);
      g.save(); g.beginPath(); g.arc(dx, dy, R * 0.6, 0, TAU); g.clip();
      PV.sine(g, dy, R * 0.18, 5.5, -t * 5, 'rgba(255,255,255,.85)', 1.5, dx - R * 0.6, dx + R * 0.6); g.restore();
      PV.ring(g, dx, dy, R * 0.72, C.cyan, R * 0.06, Math.PI * 0.55, Math.PI * (0.55 + 0.6 * E.outC(seg(lb, 2, 4))));
      PV.dot(g, dx + R * 0.82, dy, R * 0.28, C.cyan, 0.2, 0.9);
      PV.cross(g, dx, dy, 5, '#fff');
    }
    return { vig: 0.15, grain: 0.03 };
  });

  /* 8 ─ CUBE BAND: cyan band wipes open, metal cubes stream; then the drop-stop blackout */
  scene('band', 15, 16, (g, s) => {
    const { t, lt, lb } = s;
    if (lb >= 3.5) {
      fill(g, '#040405');
      PV.text(g, '▸ 16', W / 2, H / 2, 10, 'rgba(255,255,255,.7)', 'center');
      return { vig: 0.6, grain: 0.08 };
    }
    paper(g, t);
    for (let i = 0; i < 22; i++) PV.ring(g, W * (0.1 + hash(i) * 0.8), H * (0.12 + hash(i + 5) * 0.18), 3 + hash(i + 9) * 6, C.cyan, 1);
    PV.disc(g, W * 0.4, H * 0.2, 12, C.cyan);
    PV.line(g, W * 0.4, H * 0.2, W * 0.46, H * 0.2, C.cyan, 3); PV.disc(g, W * 0.465, H * 0.2, 5, C.cyan);
    const k = E.outE(seg(lb, 0, 0.7)), y0 = H * 0.42, bh = H * 0.24;
    g.save(); g.beginPath(); g.rect(W * 0.03, y0, W * 0.94 * k, bh); g.clip();
    g.fillStyle = C.cyan; g.fillRect(0, y0, W, bh);
    const cam = PV.cam(0, 0, -900, 0, 0, 0, 900), cubes = [];
    for (let i = 0; i < 26; i++) {
      const x = ((i * 137 + lt * 520) % 2000) - 1000;
      cubes.push({ p: [x, 90 + (hash(i) - 0.5) * 150, (hash(i + 3) - 0.5) * 300], s: [60, 60, 60], r: [lt * 2 + i, lt * 1.3 + i * 2, i], c: [52, 54, 58], edge: 'rgba(255,255,255,.08)' });
    }
    PV.boxes(g, cubes, cam, { ambient: 0.35 });
    g.restore();
    PV.text(g, 'SEQ/15 — pressure', W * 0.03, y0 - 14, 10, C.cyanD);
    return { vig: 0.15, grain: 0.03, rgb: 2 * snare(s.t) };
  });

  /* 9 ─ TYPE DROP: stepped kinetic type rows, racetrack rings */
  scene('typedrop', 16, 18, (g, s) => {
    const { t, lt, gb } = s;
    fill(g, C.cyan);
    for (let i = 0; i < 9; i++) {
      const k = ((lt * 0.45 + i / 9) % 1), w = 120 + k * 1500, h = w * 0.34;
      g.globalAlpha = (1 - k) * 0.5;
      g.strokeStyle = '#fff'; g.lineWidth = 1;
      PV.rrect(g, W / 2 - w / 2, H / 2 - h / 2, w, h, h / 2); g.stroke();
    }
    g.globalAlpha = 1;
    const rows = ['PHASE', 'SHIFT', 'DASTER', 'PHASE'];
    const step = Math.floor(gb), f = E.outE(clamp((gb - step) * 2.2));
    rows.forEach((w, i) => {
      const dir = i % 2 ? 1 : -1, off = dir * ((step + f) * 90 % 1100);
      g.font = `208px ${PV.F.black}`; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillStyle = '#ffffff';
      const tw = g.measureText(w + ' ').width;
      for (let x = -tw * 2 + off % tw; x < W + tw; x += tw) g.fillText(w, x, 96 + i * 176);
    });
    PV.text(g, '16 — 170 BPM', W - 30, H - 26, 10, 'rgba(255,255,255,.9)', 'right');
    return { zoom: 1 + 0.05 * kick(s.t), vig: 0.12, rgb: 3 * snare(s.t) };
  });

  /* 10 ─ POLAR FANS: rotating cyan wedges around a white core + organism */
  scene('polar', 18, 20, (g, s) => {
    const { t, lt, lb } = s;
    paper(g, t, false);
    g.font = `330px ${PV.F.black}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 2; g.strokeText('DASTER', W / 2 - lt * 40 + 60, H / 2);
    const cx = W / 2, cy = H / 2;
    for (let r = 60; r < 800; r += 60) PV.ring(g, cx, cy, r, 'rgba(0,0,0,.07)', 1);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; PV.line(g, cx, cy, cx + Math.cos(a) * 900, cy + Math.sin(a) * 900, 'rgba(0,0,0,.05)', 1); }
    const spin = lt * 0.9 + (PV.hits.kick.filter(x => x <= t && x >= 18 * BAR).length) * 0.12;
    for (let i = 0; i < 3; i++) {
      const a = spin + i * 2.1, w = 0.28;
      g.fillStyle = C.cyan; g.beginPath(); g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * 1000, cy + Math.sin(a) * 1000);
      g.quadraticCurveTo(cx + Math.cos(a + w * 1.8) * 420, cy + Math.sin(a + w * 1.8) * 420, cx + Math.cos(a + w) * 150, cy + Math.sin(a + w) * 150);
      g.closePath(); g.fill();
    }
    const cr = 150 + 8 * kick(t);
    const gr = g.createRadialGradient(cx - 30, cy - 40, 10, cx, cy, cr);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e2e4e4');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU - lt * 0.3; PV.line(g, cx + Math.cos(a) * 40, cy + Math.sin(a) * 40, cx + Math.cos(a) * cr, cy + Math.sin(a) * cr, 'rgba(0,0,0,.07)', 1); }
    PV.spike(g, cx, cy, 34 + 6 * snare(t), 5, lt * 1.5, 0.28, C.ink);
    const n = Math.floor(clamp(lb / 6) * 34);
    for (let i = 0; i < n; i++) {
      const q = i % 6, rr = Math.floor(i / 6);
      const x = W * 0.12 + q * 22 + (rr % 2) * 11 + Math.sin(lt * 2 + i) * 2, y = H * 0.72 + rr * 19;
      PV.poly(g, PV.hex(g, x, y, 10), i % 5 ? C.cyan : null, C.cyan, 1);
    }
    return { zoom: 1 + 0.035 * kick(t), rgb: 4 * snare(t), vig: 0.15 };
  });

  /* 11 ─ STREAM: cyan field, particles migrate along a diagonal */
  const CELL = [];
  { const r = rng(11), pts = Array.from({ length: 40 }, () => [r() * W, r() * H]);
    pts.forEach(p => { const d = pts.map(q => [Math.hypot(q[0] - p[0], q[1] - p[1]), q]).sort((a, b) => a[0] - b[0]); CELL.push([p, d[1][1]], [p, d[2][1]]); }); }
  scene('stream', 20, 22, (g, s) => {
    const { t, lt } = s;
    fill(g, C.cyan);
    CELL.forEach(([a, b]) => PV.line(g, a[0], a[1], b[0], b[1], 'rgba(255,255,255,.16)', 1));
    const A = [W * 0.08, H * 0.98], B = [W * 0.92, H * 0.02];
    PV.line(g, A[0], A[1], B[0], B[1], 'rgba(255,255,255,.55)', 1);
    const nx = -(B[1] - A[1]), ny = B[0] - A[0], nl = Math.hypot(nx, ny);
    const sn = snare(t);
    for (let i = 0; i < 110; i++) {
      const p = (hash(i) + lt * (0.08 + hash(i + 1) * 0.1)) % 1;
      const off = noise1(i * 7.3 + lt * 0.7) * 90 * (0.3 + hash(i + 2));
      const x = lerp(A[0], B[0], p) + (nx / nl) * off, y = lerp(A[1], B[1], p) + (ny / nl) * off;
      const r = 2.5 + hash(i + 3) * 5 + sn * 3 * (i % 4 === 0);
      if (i % 5 === 0) PV.ring(g, x, y, r + 2, '#fff', 1.2); else PV.disc(g, x, y, r, '#fff');
    }
    const p = 0.42 + Math.sin(lt * 0.6) * 0.05, x = lerp(A[0], B[0], p), y = lerp(A[1], B[1], p);
    PV.ring(g, x, y, 26 + 4 * kick(t), '#fff', 2); PV.ring(g, x, y, 18, 'rgba(255,255,255,.6)', 1);
    PV.mark(g, x, y + 2, 8, '#fff', 0.14);
    PV.text(g, 'migration / 20', 30, H - 30, 10, '#fff');
    return { zoom: 1 + 0.02 * kick(t), vig: 0.12 };
  });

  /* 12 ─ SMEAR ORGANISMS: motion-blurred shapes, hexagon lock, mini end card */
  const ORG = Array.from({ length: 20 }, (_, i) => ({ type: i % 3, x: hash(i) * W, y: hash(i + 1) * H, s: 40 + hash(i + 2) * 90, rot: hash(i + 3) * TAU, v: 0.6 + hash(i + 4) }));
  scene('organisms', 22, 24, (g, s) => {
    const { t, lt, lb } = s;
    paper(g, t, false);
    const ang = -0.62, dx = Math.cos(ang), dy = Math.sin(ang);
    const lock = E.outE(seg(lb, 4, 5));
    for (const o of ORG) {
      const d = lt * 520 * o.v;
      const x = ((o.x + dx * d) % (W + 300) + W + 300) % (W + 300) - 150, y = ((o.y + dy * d) % (H + 300) + H + 300) % (H + 300) - 150;
      g.globalAlpha = 0.85 * (1 - lock * 0.6);
      if (o.type === 0) PV.spike(g, x, y, o.s * 0.6, 4 + (o.s | 0) % 3, o.rot + lt, 0.25, C.cyan);
      else if (o.type === 1) { g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = C.cyan; PV.rrect(g, -o.s, -o.s * 0.16, o.s * 2, o.s * 0.32, o.s * 0.16); g.fill(); g.restore(); }
      else PV.dot(g, x, y, o.s * 0.35, C.cyan, 0.6, 0.8);
    }
    g.globalAlpha = 1;
    if (lb >= 4) {
      g.fillStyle = `rgba(47,214,198,${0.25 * lock})`; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) PV.dot(g, W * hash(i + 30), H * hash(i + 31), 120 + hash(i) * 100, C.cyan, 0.3, 0.3 * lock);
      const hs = lerp(1500, 250, lock);
      PV.poly(g, PV.hex(g, W / 2, H / 2, hs, 0), null, C.cyan, 16);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + lt * 0.4, L = (70 + 25 * Math.sin(lt * 3 + i)) * lock + 10 * kick(t);
        PV.line(g, W / 2, H / 2, W / 2 + Math.cos(a) * L, H / 2 + Math.sin(a) * L, C.cyan, 5);
        PV.disc(g, W / 2 + Math.cos(a) * L, H / 2 + Math.sin(a) * L, 9, C.cyan);
      }
      PV.spike(g, W / 2, H / 2, 46, 6, -lt, 0.3, C.cyan);
    }
    if (lb >= 7) {
      const k = E.outC(seg(lb, 7, 7.4));
      g.fillStyle = `rgba(236,237,235,${k})`; g.fillRect(0, 0, W, H);
      PV.sine(g, H / 2, 30, 14, t * 6, `rgba(47,214,198,${k})`, 1.2);
      g.globalAlpha = k;
      PV.poly(g, PV.hex(g, W / 2, H / 2, 150), null, C.cyan, 1.5);
      PV.mark(g, W / 2, H / 2 + 8, 24, C.cyan);
      PV.text(g, 'PHASE 01 — COMPLETE', W / 2, H / 2 + 62, 9, C.cyanD, 'center');
      g.globalAlpha = 1;
    }
    const sm = lb < 7 ? 0.03 + 0.06 * snare(t) + 0.03 * (1 - lock) : 0;
    return { smear: sm, smearAngle: ang, vig: 0.12 };
  });

  /* 13 ─ COLLAGE: arc, perspective fan, bar chart, glitch-sliced type */
  scene('collage', 24, 26, (g, s) => {
    const { t, lt, lb, gb } = s;
    paper(g, t, false);
    PV.ring(g, W * 0.76, H * 0.2, 330, 'rgba(0,0,0,.08)', 60, 0.2 + lt * 0.2, 3.4 + lt * 0.2);
    const fp = [W * 0.97, H * 0.06];
    for (let i = 0; i < 34; i++) { const a = 2.3 + i * 0.018; PV.line(g, fp[0], fp[1], fp[0] + Math.cos(a) * 1400, fp[1] + Math.sin(a) * 1400, `rgba(0,0,0,${i % 7 ? 0.08 : 0.2})`, 1); }
    PV.line(g, fp[0], fp[1], fp[0] + Math.cos(2.55) * 1400, fp[1] + Math.sin(2.55) * 1400, C.cyan, 3);
    for (let i = 0; i < 14; i++) {
      const h = (60 + (noise1(i * 1.7 + gb * 0.5) + 1) * 90) * E.outE(seg(lb, i * 0.25, i * 0.25 + 1)) + 30 * kick(t) * (i % 3 === 0);
      const x = W * 0.3 + i * 34;
      g.fillStyle = i % 4 === 1 ? C.cyanL : i % 5 === 2 ? '#c9cbce' : C.cyan;
      g.fillRect(x, H * 0.62 - h, 26, h);
      PV.line(g, x, H * 0.62 - h - 5, x + 26, H * 0.62 - h - 5, 'rgba(0,0,0,.4)', 1);
    }
    for (let i = 0; i < 60; i++) if (hash(i + 99) > 0.3) { g.fillStyle = 'rgba(47,214,198,.7)'; g.fillRect(W * 0.08 + (i % 10) * 9, H * 0.7 + Math.floor(i / 10) * 9, 5, 5); }
    const step = Math.floor(gb * 2), rev = E.outE(seg(lb, 0.5, 1.5));
    g.font = `150px ${PV.F.black}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    for (let k = 0; k < 6; k++) {
      const y0 = H * 0.18 + k * 22, off = (hash(k * 13 + step) - 0.5) * 70 * (hash(step) > 0.55 ? 1 : 0.1);
      g.save(); g.beginPath(); g.rect(0, y0, W * 0.06 + 820 * rev, 22); g.clip();
      g.fillStyle = C.cyan; g.fillText('DASTER', W * 0.06 + off, H * 0.18 + 128); g.restore();
    }
    PV.arrow(g, W * 0.1, H * 0.86, W * 0.3, H * 0.86, 2, 6, C.cyan);
    [[0.2, 0.52], [0.78, 0.6], [0.9, 0.84]].forEach(([x, y], i) => { PV.ring(g, W * x, H * y, 14 + i * 6, C.cyan, 2); PV.cross(g, W * x, H * y, 5, C.cyan); });
    PV.text(g, 'SIGNAL / 24', W * 0.1, H * 0.83, 10, C.cyanD);
    return { rgb: 1 + 4 * snare(t), zoom: 1 + 0.02 * kick(t), vig: 0.12 };
  });

  /* 14 ─ RINGS: racetrack pulses on cyan */
  scene('rings', 26, 27, (g, s) => {
    const { t, lt } = s;
    fill(g, C.cyan);
    PV.dot(g, W / 2, H / 2, 260, '#ffffff', 0, 0.55);
    for (let i = 0; i < 16; i++) {
      const k = (lt * 0.9 + i / 16) % 1, w = 60 + k * 1500, h = w * 0.28;
      g.globalAlpha = (1 - k) * 0.85; g.strokeStyle = '#fff'; g.lineWidth = 1.2;
      PV.rrect(g, W / 2 - w / 2, H / 2 - h / 2, w, h, h / 2); g.stroke();
    }
    g.globalAlpha = 1;
    PV.text(g, 'RESONANCE', W / 2, H / 2 + 120, 10, '#fff', 'center');
    hudCorners(g, '#fff');
    return { zoom: 1 + 0.04 * kick(t), vig: 0.1 };
  });

  /* 15 ─ ASSEMBLY: explode from centre, then snap into a vertical composition */
  const AS = Array.from({ length: 56 }, (_, i) => { const a = hash(i) * TAU, R = 300 + hash(i + 1) * 500; return { ex: W / 2 + Math.cos(a) * R, ey: H / 2 + Math.sin(a) * R * 0.7, tx: W / 2 + (hash(i + 2) - 0.5) * 150, ty: H * 0.12 + (i / 56) * H * 0.78, type: i % 4, s: 6 + hash(i + 3) * 26 }; });
  scene('assembly', 27, 28, (g, s) => {
    const { lt, lb } = s;
    fill(g, '#9c9ea1');
    PV.poly(g, [[0, H * 0.7], [W, H * 0.45], [W, H], [0, H]], 'rgba(0,0,0,.06)');
    const p1 = E.outE(seg(lb, 0, 1.4)), p2 = E.ioC(seg(lb, 1.6, 3.6));
    [[0.28, 0.35, 56], [0.33, 0.52, 46], [0.26, 0.66, 38]].forEach(([x, y, r]) => PV.disc(g, W * x, H * y, r * p1, '#eeeeee'));
    for (const a of AS) {
      const x = lerp(lerp(W / 2, a.ex, p1), a.tx, p2), y = lerp(lerp(H / 2, a.ey, p1), a.ty, p2);
      if (a.type === 0) PV.disc(g, x, y, a.s, '#f2f2f2');
      else if (a.type === 1) { g.fillStyle = C.cyan; g.fillRect(x - a.s / 2, y - a.s / 2, a.s, a.s); }
      else if (a.type === 2) PV.ring(g, x, y, a.s, C.cyan, 3);
      else PV.poly(g, PV.hex(g, x, y, a.s * 0.7, lt), C.cyanL);
    }
    if (p2 > 0) PV.arrow(g, W / 2, H * 0.95, W / 2, lerp(H * 0.95, H * 0.1, p2), 14, 20, C.cyan);
    return { zoom: 1 + 0.03 * kick(s.t), rgb: 3 * snare(s.t), vig: 0.2 };
  });

  /* 16 ─ HORIZON: falling arrow onto a foam horizon, donut rolls in */
  scene('horizon', 28, 30, (g, s) => {
    const { t, lt, lb } = s;
    paper(g, t, false);
    PV.disc(g, W / 2, -H * 0.62, H * 1.02, '#a9abae');
    const hy = x => H * 0.6 + Math.pow(x - W / 2, 2) * 0.00011;
    for (let i = 0; i < 240; i++) {
      const x = ((hash(i) * W * 1.3 + lt * 70 * (0.5 + hash(i + 1))) % (W * 1.3)) - W * 0.15;
      const y = hy(x) - hash(i + 2) * 34 + Math.sin(lt * 3 + i) * 2, r = 3 + hash(i + 3) * 9;
      PV.disc(g, x, y, r, '#fafafa'); PV.ring(g, x, y, r, 'rgba(0,0,0,.18)', 1);
    }
    PV.line(g, W * 0.05, H * 0.52, W * 0.95, H * 0.52, C.cyan, 1.5);
    PV.text(g, '12', W * 0.62, H * 0.49, 12, C.cyanD);
    PV.line(g, W * 0.6, H * 0.5, W * 0.6, H * 0.54, C.cyan, 1.5);
    PV.line(g, W * 0.1, 0, W * 0.34, H * 0.5, C.cyan, 3);
    const fall = E.outBack(seg(lb, 0, 1.4)), ty = lerp(-60, H * 0.56, fall) - 26 * kick(t) * (lb > 1.4);
    PV.arrow(g, W / 2, ty - 240, W / 2, ty, 12, 20, C.cyan);
    const dx = lerp(W + 200, W * 0.8, E.outC(seg(lb, 2, 3.5))), dy = H * 0.5;
    g.save(); g.translate(dx, dy); g.rotate(-lt * 2);
    PV.ring(g, 0, 0, 70, '#1d1e21', 48); PV.ring(g, 0, 0, 58, C.cyan, 6, 0, 2.2); g.restore();
    return { zoom: 1 + E.inQ(seg(lb, 4, 8)) * 0.12 + 0.02 * kick(t), vig: 0.12 };
  });

  /* 17 ─ DEPTH: circles fly through a perspective polar grid with focus falloff; word slam */
  scene('depth', 30, 32, (g, s) => {
    const { t, lt, lb } = s;
    paper(g, t, false);
    const cx = W / 2, cy = H * 0.56;
    for (let r = 40; r < 1000; r += 55) { g.strokeStyle = 'rgba(0,0,0,.09)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, cy, r, r * 0.55, 0, 0, TAU); g.stroke(); }
    for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; PV.line(g, cx, cy, cx + Math.cos(a) * 1100, cy + Math.sin(a) * 600, 'rgba(0,0,0,.06)', 1); }
    const items = [];
    for (let i = 0; i < 90; i++) {
      const z = (hash(i) + lt * 0.22) % 1, sc = 1 / (1.15 - z);
      const a = hash(i + 1) * TAU, sp = 60 + hash(i + 2) * 260;
      items.push({ z, x: cx + Math.cos(a) * sp * sc, y: cy + Math.sin(a) * sp * sc * 0.6, r: (4 + hash(i + 3) * 10) * sc, hex: i % 6 === 0 });
    }
    items.sort((a, b) => a.z - b.z);
    for (const it of items) {
      const focus = clamp(1 - Math.abs(it.z - 0.45) * 2.6);
      if (it.hex && focus > 0.5) PV.poly(g, PV.hex(g, it.x, it.y, it.r), C.cyan);
      else PV.dot(g, it.x, it.y, it.r * (1 + (1 - focus) * 0.8), C.cyan, focus * 0.95, 0.35 + focus * 0.45);
    }
    PV.text(g, '#01', 34, H - 34, 12, C.cyanD, 'left', PV.F.sans, '700');
    let sm = 0;
    if (lb >= 6) {
      const k = E.outE(seg(lb, 6, 6.5)), sc = lerp(1.5, 1, k);
      g.save(); g.translate(W / 2, H / 2); g.transform(sc, 0, -0.32 * sc, sc, 0, 0);
      g.font = `230px ${PV.F.black}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = C.cyan; g.strokeText('SHIFT', 0, 0);
      g.fillStyle = '#fff'; g.fillText('SHIFT', 0, 0); g.restore();
      sm = 0.06 * (1 - k);
    }
    return { smear: sm, smearAngle: 0, vig: 0.12, zoom: 1 + 0.02 * kick(t) };
  });

  /* 18 ─ TUNNEL: fly-through of block rings */
  scene('tunnel', 32, 34, (g, s) => {
    const { t, lt } = s;
    fill(g, '#d8d9db');
    const cz = lt * 950, cam = PV.cam(0, 0, cz, 0, 0, lt * 0.35, 700), bx = [];
    const j0 = Math.floor(cz / 170);
    for (let j = j0; j < j0 + 22; j++) for (let i = 0; i < 14; i++) {
      const h = hash(j * 31 + i); if (h < 0.22) continue;
      const a = (i / 14) * TAU + j * 0.27, R = 330 + hash(j + i * 7) * 60;
      bx.push({ p: [Math.cos(a) * R, Math.sin(a) * R, j * 170], s: [70 + h * 90, 50 + hash(i + j) * 70, 120], r: [0, 0, a], c: h > 0.9 ? RGB.cyan : h > 0.72 ? [48, 50, 55] : [236, 237, 239] });
    }
    PV.boxes(g, bx, cam, { ambient: 0.5, fog: [200, 3600], fogColor: [216, 217, 219] });
    for (let i = 0; i < 36; i++) { const a = hash(i) * TAU, r0 = 200 + hash(i + 1) * 300; g.globalAlpha = 0.25; PV.line(g, W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0, W / 2 + Math.cos(a) * (r0 + 200), H / 2 + Math.sin(a) * (r0 + 200), '#fff', 2); }
    g.globalAlpha = 1;
    PV.poly(g, [[W * 0.3, H], [W * 0.46, H * 0.62 + Math.sin(lt * 9) * 3], [W * 0.52, H * 0.7], [W * 0.62, H * 0.6], [W * 0.78, H]], '#2a2c30');
    PV.poly(g, [[W * 0.46, H * 0.62], [W * 0.5, H * 0.52], [W * 0.52, H * 0.7]], '#43464b');
    hudBlock(g, t, C.cyanD);
    return { zoom: 1 + 0.03 * kick(t), rgb: 1.5 + 3 * snare(t), vig: 0.5 };
  });

  /* 19 ─ STRIPES: corrugated diagonal field with cyan pixel glitches */
  scene('stripes', 34, 36, (g, s) => {
    const { t, lt, gb } = s;
    fill(g, '#e2e3e4');
    g.save(); g.translate(W / 2, H / 2); g.rotate(-0.42);
    for (let i = -48; i < 48; i++) {
      const y0 = i * 17 + (lt * 50) % 17;
      g.strokeStyle = i % 2 ? '#b6b8bb' : '#f4f4f4'; g.lineWidth = 7;
      g.beginPath();
      for (let x = -900; x <= 900; x += 60) g.lineTo(x, y0 + Math.sin(x * 0.004 + i * 0.15 + lt) * 7);
      g.stroke();
    }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(W * 0.78, H); g.bezierCurveTo(W * 0.7, H * 0.6, W * 1.05, H * 0.4, W * 0.9, -10); g.lineTo(W + 10, -10); g.lineTo(W + 10, H); g.closePath(); g.fill(); g.stroke();
    const n = Math.floor(gb * 4);
    for (let k = n - 24; k <= n; k++) {
      const age = (gb * 4 - k) / 24;
      for (let j = 0; j < 3; j++) {
        const h = hash(k * 3 + j), x = W * (0.35 + hash(k + j * 50) * 0.65) - age * 160, y = H * hash(k * 7 + j) * 0.7 + age * 70;
        g.globalAlpha = 1 - age;
        g.fillStyle = C.cyan;
        if (h < 0.35) { for (let q = 0; q < 3; q++) g.fillRect(x + q * 5, y, 2, 12); }
        else g.fillRect(x, y, 6 + h * 18, 4 + hash(k + j) * 8);
      }
    }
    g.globalAlpha = 1;
    hudBlock(g, t, C.cyanD);
    return { rgb: 1 + 3 * snare(t), vig: 0.2, zoom: 1 + 0.02 * kick(t) };
  });

  /* 20 ─ CUBE WALL: displaced block wall, honeycomb emblems pop on 8ths, pixel dissolve out */
  const HEXES = (() => {
    const out = [[0, 0, 74]], R = 128;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; out.push([Math.cos(a) * R, Math.sin(a) * R, 54]); }
    [-1.5, -0.5, 0.5, 1.5].forEach(i => out.push([i * 72, 205, 32]));
    return out;
  })();
  scene('wall', 36, 38, (g, s) => {
    const { t, lt, lb } = s;
    fill(g, '#d1d3d5');
    const cs = 62, zs = 1 + lt * 0.04;
    g.save(); g.translate(W / 2, H / 2); g.scale(zs, zs); g.translate(-W / 2, -H / 2);
    for (let j = -1; j < 13; j++) for (let i = -1; i < 22; i++) {
      const d = (noise1(i * 0.35 + lt * 0.8 + j * 3.1) + 1) * 0.5, x = i * cs, y = j * cs, e = d * 12;
      g.fillStyle = `rgb(${150 + d * 40 | 0},${152 + d * 40 | 0},${156 + d * 40 | 0})`; g.fillRect(x + e, y + e, cs, cs);
      const v = 205 + d * 45 | 0; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(x, y, cs - 2, cs - 2);
    }
    g.restore();
    HEXES.forEach(([hx, hy, r], i) => {
      const k = E.outBack(seg(lb, i * 0.5, i * 0.5 + 0.5));
      if (k <= 0) return;
      const x = W / 2 + hx, y = H / 2 - 40 + hy, rr = r * k;
      PV.poly(g, PV.hex(g, x, y, rr + 5), '#3a3d42');
      PV.poly(g, PV.hex(g, x, y, rr), '#1c1e22', C.cyan, 2.5);
      g.save(); g.translate(x, y); g.scale(k, k);
      if (i === 0) PV.mark(g, 0, 8, 26, C.cyan); else ICONS[i % ICONS.length](g, r);
      g.restore();
    });
    for (let i = 0; i < 20; i++) { g.fillStyle = C.cyan; g.fillRect(W * hash(i + Math.floor(lb * 2) * 20), H * (0.7 + hash(i + 3) * 0.3), 4 + hash(i) * 10, 4); }
    return { pixel: lerp(1, 36, E.inQ(seg(lb, 6.5, 8))), rgb: 1 + 3 * snare(t), shakeX: (hash(Math.floor(t * 20)) - 0.5) * 0.006 * kick(t), vig: 0.25 };
  });

  /* 21 ─ TRI-LENS: cyan triple-circle mask retracts to reveal a glass world */
  const Q21 = glassQuads(900, 12);
  scene('lens', 38, 40, (g, s) => {
    const { t, lt, lb } = s;
    fill(g, '#050506');
    const L = [[W / 2 - 270, H / 2], [W / 2, H / 2], [W / 2 + 270, H / 2]], R = 250;
    g.save(); g.beginPath(); L.forEach(([x, y]) => { g.moveTo(x + R, y); g.arc(x, y, R, 0, TAU); }); g.clip();
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#7f95a8'); gr.addColorStop(1, '#dfe7ec');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    drawGlass(g, Q21, lt + 3);
    for (let i = 0; i < 34; i++) {
      const a = hash(i) * TAU + lt * (0.2 + hash(i + 1) * 0.3), r = 80 + hash(i + 2) * 380;
      g.save(); g.translate(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.5); g.rotate(a * 2 + lt);
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-16, -3, 32, 6); g.restore();
    }
    PV.ball(g, W / 2 + 60, H / 2 - 20, 40, '#bcd0dc'); PV.ball(g, W / 2 + 130, H / 2 + 30, 22, '#bcd0dc');
    for (let x = 0; x < W; x += 4) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x, 0, 1, H); }
    PV.line(g, L[0][0] - R, H * 0.8, L[2][0] + R, H * 0.2, 'rgba(255,255,255,.6)', 1);
    const c = 1 - E.inC(seg(lb, 0.2, 1.4));
    if (c > 0) L.forEach(([x, y]) => PV.disc(g, x, y, R * c, C.cyan));
    g.restore();
    const dim = seg(lb, 6.5, 8);
    return { vig: 0.3, grain: 0.05, flash: [0, 0, 0, dim * 0.4] };
  });

  /* 22 ─ END CARD */
  scene('end', 40, 42, (g, s) => {
    const { t, lb } = s;
    paper(g, t, false);
    PV.sine(g, H * 0.42, 60 * (1 - E.outC(seg(lb, 0, 6))), 7, t * 2, 'rgba(0,0,0,.25)', 1);
    const k = E.outBack(seg(lb, 0, 0.8));
    g.save(); g.translate(W / 2, H * 0.4); g.scale(k, k); PV.disc(g, 0, 0, 70, C.paper); PV.mark(g, 0, 8, 44, C.cyan); g.restore();
    const word = 'DASTER.ME', n = Math.floor(seg(lb, 0.5, 2.5) * word.length * 1.0001);
    g.font = `52px ${PV.F.black}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.ink;
    g.fillText(word.slice(0, n) + (n < word.length && Math.floor(t * 12) % 2 ? '_' : ''), W / 2, H * 0.62);
    PV.text(g, 'PHASE SHIFT · 相位跃迁 · MOTION STUDY 01', W / 2, H * 0.7, 11, `rgba(60,60,60,${seg(lb, 2, 3)})`, 'center');
    PV.text(g, 'procedural visuals + synthesized score · zero bitmap assets', W / 2, H * 0.9, 9, `rgba(90,90,90,${seg(lb, 3, 4)})`, 'center');
    return { vig: 0.2, flash: [0, 0, 0, E.inQ(seg(lb, 6, 8))] };
  });

  /* ---------- transitions (bars) ---------- */
  const T = [];
  const tr = (name, a, b, fx, draw) => T.push({ name, a, b, fx, draw });
  tr('fade-in', 1, 1.3, k => ({ flash: [0, 0, 0, 1 - E.outQ(k)] }));
  tr('leak', 2.8, 3.3, k => ({ flash: [1, 0.97, 0.95, tri(k) * 0.75], rgb: tri(k) * 6 }));
  tr('leak2', 4.85, 5.25, k => ({ flash: [1, 1, 1, tri(k) * 0.6], rgb: tri(k) * 4 }));
  tr('blob', 7.8, 8.25, null, (g, k) => {
    const pts = k < 0.5
      ? [[0.1, 0.9, 1.1], [0.05, 0.1, 0.7], [0.45, 0.6, 0.9], [0.8, 0.95, 0.8], [0.9, 0.2, 0.7]]
      : [[0.9, 0.1, 1.1], [0.95, 0.9, 0.7], [0.55, 0.4, 0.9], [0.2, 0.05, 0.8], [0.1, 0.8, 0.7]];
    const r = k < 0.5 ? E.inC(k * 2) : E.outC(1 - (k - 0.5) * 2);
    pts.forEach(([x, y, s], i) => PV.disc(g, W * x, H * y, r * s * 900 * (1 + 0.04 * Math.sin(i + k * 20)), C.cyan));
    if (r > 0.25) PV.text(g, '#01', W * 0.45, H * 0.6, 12, `rgba(255,255,255,${r})`, 'center', PV.F.sans, '700');
  });
  tr('rgb-cut', 10, 10.15, k => ({ rgb: 12 * (1 - k), invert: k < 0.3 ? 1 : 0 }));
  tr('flash12', 12, 12.3, k => ({ flash: [1, 1, 1, 1 - E.outQ(k)] }));
  tr('iris', 14.75, 15.1, null, (g, k) => {
    const cx = W * 0.68, cy = H * 0.5;
    g.fillStyle = '#1d1e21';
    if (k < 0.55) PV.disc(g, cx, cy, lerp(200, 1600, E.inC(k / 0.55)), '#1d1e21');
    else { g.beginPath(); g.rect(0, 0, W, H); g.arc(cx, cy, 1600 * E.outC((k - 0.55) / 0.45), 0, TAU, true); g.fill('evenodd'); }
  });
  tr('drop', 16, 16.25, k => ({ flash: [1, 1, 1, 1 - E.outQ(k)], zoom: 1 + 0.12 * (1 - E.outE(k)) }));
  tr('inv18', 18, 18.06, () => ({ invert: 1 }));
  tr('rgb20', 20, 20.12, k => ({ rgb: 14 * (1 - k) }));
  tr('smear22', 22, 22.2, k => ({ smear: 0.2 * (1 - k), smearAngle: -0.62 }));
  tr('cyan24', 24, 24.12, k => ({ flash: [0.18, 0.84, 0.78, 1 - k] }));
  tr('inv27', 27, 27.06, () => ({ invert: 1 }));
  tr('flash28', 28, 28.15, k => ({ flash: [1, 1, 1, 1 - k] }));
  tr('pix30', 29.85, 30.1, k => ({ pixel: lerp(28, 1, E.outQ(k)) }));
  const swirl = (g, k) => {
    const a = k < 0.5 ? E.inQ(k * 2) : E.inQ((1 - k) * 2);
    g.fillStyle = `rgba(47,214,198,${a})`; g.fillRect(0, 0, W, H);
    g.strokeStyle = `rgba(255,255,255,${tri(k) * 0.9})`; g.lineWidth = 40; g.lineCap = 'round';
    for (let arm = 0; arm < 4; arm++) {
      g.beginPath();
      for (let q = 0; q < 1; q += 0.02) { const ang = arm * (TAU / 4) + q * 7 + k * 6, r = q * 900; g.lineTo(W / 2 + Math.cos(ang) * r, H / 2 + Math.sin(ang) * r); }
      g.stroke();
    }
    g.lineCap = 'butt';
  };
  const swirlFx = k => ({ swirl: k < 0.5 ? E.inC(k * 2) * 9 : -E.inC((1 - k) * 2) * 9 });
  tr('swirl32', 31.75, 32.25, swirlFx, swirl);
  tr('swirl34', 33.75, 34.25, swirlFx, swirl);
  tr('cyan36', 35.85, 36.2, k => ({ flash: [0.18, 0.84, 0.78, k < 0.3 ? E.outQ(k / 0.3) : 1 - E.inQ((k - 0.3) / 0.7)] }));
  tr('white40', 39.8, 40.2, k => ({ flash: [0.93, 0.93, 0.92, tri(k)] }));

  PV.SCENES = S;
  PV.TRANS = T;
})();
