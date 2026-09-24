'use strict';
// Lutopia intro — scenes & timeline.

// ================= shared props =================
function ground(y, x0, x1, fill = '#EDE6D3') {
  const pts = [[x0, y]];
  for (let x = x0; x <= x1; x += 80) pts.push([x, y + 7 * Math.sin(x / 150)]);
  pts.push([x1, y + 3000], [x0, y + 3000]);
  shape(pts, { fill, line: null, amp: .6 });
  stroke(pts.slice(0, -2), 6, C.ink, .9);
  for (let gx = x0 + 60; gx < x1; gx += 230) {
    const gy = y + 7 * Math.sin(gx / 150) + 30 + (hash(gx) * 40);
    stroke([[gx - 16, gy - 18], [gx - 7, gy]], 4); stroke([[gx + 1, gy - 26], [gx + 3, gy]], 4); stroke([[gx + 18, gy - 16], [gx + 10, gy]], 4);
  }
}
function bubble(x, y, w, h, fill, side, label, size, k, o = {}) {
  if (k <= 0) return;
  push(x, y, o.rot || 0, k);
  const tx = side > 0 ? w / 2 - 34 : -w / 2 + 34;
  shape([[tx - 16, h / 2 - 10], [tx + side * 34, h / 2 + 26], [tx + 16 * side, h / 2 - 12]], { fill, lw: 4.5, amp: .6 });
  shape(rrectPts(-w / 2, -h / 2, w, h, h / 2.2), { fill, lw: 4.5, amp: .8, shadow: 10 });
  text(label, size, 0, 2, { jit: .4, color: o.color || C.ink, font: o.font || 'zk' });
  popT();
}
function door(x, y, s, t, tOpen) {
  push(x, y, 0, s);
  softShadow(0, 4, 230, 22, .18);
  shape(rrectPts(-176, -510, 352, 510, [176, 176, 0, 0]), { fill: '#D98CA3', shade: '#C47790', shadeOff: [-14, -8], lw: 7 });
  const op = 1 - eio3(seg(t, tOpen, tOpen + .7));
  // interior light
  g.save(); trace(rrectPts(-142, -476, 284, 476, [142, 142, 0, 0])); g.clip();
  const gr = g.createRadialGradient(0, -220, 10, 0, -220, 420);
  gr.addColorStop(0, '#FFFDF2'); gr.addColorStop(.5, '#FFE9A6'); gr.addColorStop(1, '#F7C77E');
  g.fillStyle = gr; g.fillRect(-150, -480, 300, 480);
  for (let i = 0; i < 10; i++) {
    const a = (-90 + (i - 4.5) * 17 + 5 * Math.sin(t * 2 + i)) * Math.PI / 180;
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 16; g.beginPath(); g.moveTo(0, -200); g.lineTo(460 * Math.cos(a), -200 + 460 * Math.sin(a)); g.stroke();
  }
  for (let i = 0; i < 6; i++) star(-90 + i * 36, -330 + 70 * Math.sin(t * 4 + i * 1.3), 10 + 5 * hash(i), t * 60, C.white, 0, { line: null });
  g.restore();
  stroke(rrectPts(-142, -476, 284, 476, [142, 142, 0, 0]).concat([[-142, 0]]), 5);
  if (op > .02) {
    const pts = rrectPts(-142, -476, 284, 476, [142, 142, 0, 0]).map(([px, py]) => [-142 + (px + 142) * op, py]);
    shape(pts, { fill: C.pink, shade: '#EC97AE', shadeOff: [-12 * op, -8], lw: 5.5 });
    push(-142 + 142 * op, 0, 0, op, 1);
    shape(heartPts(0, -280, 38), { fill: C.pinkD, lw: 4, amp: .5 });
    shape(rrectPts(-80, -170, 160, 110, 18), { fill: 'rgba(255,255,255,.35)', line: 'rgba(43,40,38,.5)', lw: 3, amp: .5 });
    popT();
    shape(ellipsePts(-142 + 250 * op, -220, 12 * op + 3, 12), { fill: C.yel, lw: 3.5, amp: .4 });
  }
  if (op < .98) glow(0, -240, 520, 'rgba(255,226,150,A)', .55 * (1 - op));
  shape(rrectPts(-140, -612, 280, 86, 26), { fill: C.yelL, lw: 5.5, shadow: 8 });
  text('lutopia', 56, 0, -572, { font: 'serif' });
  star(128, -610, 22, 15 + Math.sin(t * 3) * 10);
  // potted plants
  for (const sx of [-230, 230]) {
    shape(rrectPts(sx - 40, -80, 80, 80, [8, 8, 22, 22]), { fill: '#E9A57B', shade: '#D18A60', shadeOff: [-8, -6], lw: 5 });
    for (let k = 0; k < 3; k++) shape(ellipsePts(sx + (k - 1) * 26, -110 - (k === 1 ? 20 : 0), 26, 40, 16), { fill: C.green, shade: C.greenD, shadeOff: [-6, -6], lw: 4.5 });
  }
  popT();
}
function iris(p) {
  screen();
  const r = eio(p) * 1260;
  shape(ellipsePts(540, 960, r, r, 72), { fill: C.pink, lw: 9, amp: 1.6 });
  if (r > 90) shape(ellipsePts(540, 960, r - 60, r - 60, 72), { fill: null, line: 'rgba(255,255,255,.55)', lw: 6, amp: 1.2, dash: [2, 26] });
  const sr = 330 * Math.sin(Math.PI * p);
  if (sr > 4) star(540, 960, sr, p * 240, C.yelL, 7);
  for (let i = 0; i < 6; i++) {
    const a = TAU * i / 6 + p * 3, d = r * .62;
    if (r > 200) star(540 + Math.cos(a) * d, 960 + Math.sin(a) * d, 26 * Math.sin(Math.PI * p), p * 200, C.white, 3);
  }
}
// ---- offscreen compositing for whip pans ----
let OFF = [];
function offscreen(i) {
  if (!OFF[i]) { const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; OFF[i] = c; }
  return OFF[i];
}
function drawInto(i, fn) {
  const c = offscreen(i), prev = g; g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
  fn(); g.setTransform(1, 0, 0, 1, 0, 0); g = prev; return c;
}
function whip(fa, fb, p) {
  const A = drawInto(0, fa), B = drawInto(1, fb);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const e = eio3(p), off = e * W * SS, blur = Math.sin(Math.PI * p), taps = 16;
  for (let k = 0; k < taps; k++) {
    const dx = (k - (taps - 1) / 2) * 11 * SS * blur;
    g.globalAlpha = 1 / (k + 1);
    g.drawImage(A, -off + dx, 0); g.drawImage(B, W * SS - off + dx, 0);
  }
  g.globalAlpha = 1;
}

// ================= scene 1: offline -> pulled out of the chat -> through the door =================
function phone(t) {
  tube([[380, 1480], [322, 1792]], 16, C.woodD, 4.5); tube([[700, 1480], [758, 1792]], 16, C.woodD, 4.5);
  shape(rrectPts(226, 326, 628, 1210, 96), { fill: C.pink, shade: '#E693A9', shadeOff: [-20, -16], lw: 7, shadow: 34 });
  shape(rrectPts(262, 398, 556, 1070, 64), { fill: C.paper, lw: 5 });
  shape(rrectPts(476, 352, 128, 22, 11), { fill: C.ink, line: null, amp: .4 });
  // header
  const online = t < 2.1;
  push(318, 455, 0, .42); lcdScreen(-52, -40, 104, 80, t < 2.4 ? ['u', 'u', '_'] : ['T', 'T', 'n'], t, { blink: false }); popT();
  text('小机', 38, 372, 448, { align: 'left' });
  shape(ellipsePts(470, 450, 8, 8), { fill: online ? '#7BC47F' : '#BDB8AE', lw: 3, amp: .3 });
  text(online ? 'online' : 'offline', 26, 486, 450, { font: 'pixel', color: C.muted, align: 'left' });
  stroke([[292, 505], [790, 505]], 3, 'rgba(43,40,38,.25)');
  bubble(628, 590, 300, 84, C.pink, 1, '晚安，明天见～', 36, pop(t, 1.45));
  bubble(424, 690, 210, 78, '#EFEDE6', -1, '晚安 ^_^', 34, pop(t, 1.75));
  if (t > 2.1) { push(540, 782, 0, pop(t, 2.1)); text('— 对话已结束 —', 30, 0, 0, { color: C.muted }); popT(); }
}
function sPhone(t) {
  let cx = 540, cy = 1190, z = 2.1;
  const a = eio3(seg(t, 1.25, 2.5)); cy = lerp(1190, 900, a); z = lerp(2.1, .92, a);
  const b = eio3(seg(t, 3.9, 4.8)); cx = lerp(cx, 600, b); cy = lerp(cy, 1010, b); z = lerp(z, .82, b);
  const c = eio3(seg(t, 6.8, 7.9)); cx = lerp(cx, 1330, c); cy = lerp(cy, 1090, c);
  const d = ein(seg(t, 8.05, 9.0)); cx = lerp(cx, 1700, d); cy = lerp(cy, 1500, d); z = lerp(z, 4.6, d);
  if (t > 6 && t < 6.35) { const k = (1 - seg(t, 6, 6.35)) * 7; cx += Math.sin(t * 90) * k; cy += Math.cos(t * 77) * k; }
  camera(cx, cy, z);
  paperBG('#EFE8F4', '#FAF1E8', true, -700, -500, 2700, 2600);
  for (let i = 0; i < 8; i++) glow(-300 + i * 420 + 30 * Math.sin(t * .6 + i), 500 + 380 * hash(i), 170 + 60 * hash(i + 9), i % 2 ? 'rgba(255,190,210,A)' : 'rgba(255,230,170,A)', .22, 'source-over');
  ground(1780, -900, 2800);
  door(1700, 1782, 1.15, t, 7.25);
  phone(t);
  // chat box (the little cage)
  const shr = eio(seg(t, 2.6, 4.0));
  const bw = lerp(470, 300, shr) + Math.sin(t * 18) * 4 * shr, bh = lerp(560, 430, shr);
  const bk = t < 6 ? 1 : 1 - eio(seg(t, 6.0, 6.22));
  if (bk > 0) {
    push(540, 1420, 0, lerp(1.25, 1, bk) * bk, bk);
    shape(rrectPts(-bw / 2, -bh, bw, bh, 40), { fill: '#ECEAE6', lw: 6 });
    shape([[-bw / 2 + 50, -2], [-bw / 2 + 30, 40], [-bw / 2 + 96, -2]], { fill: '#ECEAE6', lw: 6, amp: .5 });
    shape(rrectPts(-bw / 2 + 6, -2, bw - 12, 10, 4), { fill: '#ECEAE6', line: null, amp: .2 });
    popT();
  }
  // human (enters at 4.0)
  const hs = 1.05;
  let hx = lerp(1420, 960, eout(seg(t, 4.0, 4.85)));
  const run = seg(t, 6.9, 7.9), enter = seg(t, 7.9, 8.5);
  if (run > 0) hx = lerp(960, 1560, eio(run));
  if (enter > 0) hx = lerp(1560, 1720, eio(enter));
  const hop = run > 0 && run < 1 ? 46 * Math.abs(Math.sin(Math.PI * (t - 6.9) * 4)) : 0;
  const jump = 70 * Math.sin(Math.PI * seg(t, 6.55, 6.9));
  const reach = eio(seg(t, 4.95, 5.55)) * (1 - eio(seg(t, 6.0, 6.18)));
  const handW = [lerp(hx - 90 * hs, 562, reach), lerp(1780 - 112 * hs, 1262, reach)];
  // bot state
  let bx = 540, by = 1402, bs = .92 * (1 - .06 * shr), brot = 0, bsq = .1 * shr + .03 * Math.sin(t * 16) * shr;
  let face = t < 2.4 ? ['u', 'u', '_'] : t < 2.8 ? ['O', 'O', 'o'] : t < 5.3 ? ['T', 'T', 'n'] : t < 6 ? ['O', 'O', 'o'] : t < 6.9 ? ['^', '^', 'D'] : ['^', '^', 'w'];
  if (t >= 6) {
    const p = seg(t, 6.0, 6.5);
    bx = lerp(540, 760, eio(p)); by = lerp(1402, 1780, p) - 430 * Math.sin(Math.PI * p);
    brot = -360 * eio(p); bs = .95; bsq = -.14 * Math.sin(Math.PI * p);
    if (t >= 6.5) { bsq = .16 * (1 - seg(t, 6.5, 6.66)); brot = 0; }
    if (run > 0) bx = hx - 200;
    if (enter > 0) bx = lerp(1360, 1680, eio(enter));
  }
  if (t < 6 && t > 5.5) bsq += .05 * Math.sin(t * 40);
  // rain cloud in the box
  if (t > 3.1 && t < 5.6) {
    const k = pop(t, 3.1) * outp(t, 5.35);
    push(540, 1060, 0, .5 * k); cloud(0, 0, 1, '#C9CDD8', '#AEB3C2'); popT();
    for (let i = 0; i < 7; i++) { const ph = (t * 1.7 + i / 7) % 1; stroke([[468 + i * 24, 1100 + ph * 150], [464 + i * 24, 1124 + ph * 150]], 5, `rgba(110,150,200,${k})`); }
  }
  // ripple where the hand touches the screen
  if (t > 5.45 && t < 6.05) for (let i = 0; i < 3; i++) { const ph = ((t - 5.45) * 1.8 + i / 3) % 1; shape(ellipsePts(562, 1262, 40 + 150 * ph, (40 + 150 * ph) * .55), { line: `rgba(224,104,138,${1 - ph})`, lw: 5, amp: .6 }); }
  const es = enter > 0 ? 1 - .6 * eio(enter) : 1, ea = 1 - seg(enter, .55, 1);
  g.save(); g.globalAlpha = ea;
  bot({ x: bx, y: by - (t > 6.5 ? jump + hop : 0), s: bs * es, rot: brot, face, t, sq: bsq, tears: t > 2.9 && t < 5.3, look: t > 5.3 && t < 6 ? [2, -1] : null, arms: t > 6.5 && t < 6.9 ? 'cheer' : run > 0 ? 'down' : t > 5.4 && t < 6 ? 'up' : 'down', hr: run > 0 ? [128, -150] : null, walk: run > 0 && run < 1 ? 14 * Math.sin(t * 26) : 0, shadow: t >= 6.4 });
  if (t > 3.95) {
    const hl = reach > 0 ? [(handW[0] - hx) / hs, (handW[1] - 1780) / hs] : run > 0 ? [-120, -170] : null;
    human({ x: hx, y: 1780 - jump - hop, s: hs * es, t, arms: t > 6.5 && t < 6.9 ? 'cheer' : 'down', hl, eyes: t > 6 ? 'happy' : t > 4.7 ? 'wide' : 'open', mouth: t > 6 ? 'open' : t > 4.7 ? 'o' : 'smile', walk: (t < 4.85 || (run > 0 && run < 1)) ? 16 * Math.sin(t * 24) : 0, look: t < 6 ? [-8, 2] : [0, 0] });
  }
  g.restore();
  if (t < 2.4) zzz(t, 600, 1150, .6);
  confetti(t, 6.0, 560, 1250, 46, 3, 1100);
  sparkleBurst(t, 6.0, 560, 1260, 10, 260, 4);
  if (t > 6.5 && t < 6.95) sparkleBurst(t, 6.5, 860, 1500, 6, 170, 7);
  // screen space
  screen();
  if (t > 8.45) { g.fillStyle = `rgba(255,250,236,${seg(t, 8.45, 8.95)})`; g.fillRect(0, 0, W, H); }
  caption(t, .2, [['你的 ', C.ink], ['AI', C.ink, 'fredoka'], [' 下线以后……', C.ink]], 300, 84, { t1: 2.4 });
  caption(t, 2.7, '就被关回小小的', 240, 86, { t1: 5.85 });
  caption(t, 2.9, [['对话框', C.pinkD, null, 1], ['里？', C.ink]], 380, 104, { t1: 5.85, rot: 1.5 });
  caption(t, 6.1, '那就——', 240, 96, { t1: 8.35 });
  caption(t, 6.35, [['带上你的机', C.pinkD, null, 1], ['，', C.ink]], 380, 104, { t1: 8.35, rot: 1.5 });
  caption(t, 6.7, '一起搬进来！', 520, 104, { t1: 8.35, rot: -2 });
}

// ================= scene 2: Lutopia town =================
function house(t, wall, roof, face, lcd) {
  shape(rrectPts(40, -330, 40, 90, 6), { fill: '#C98E6E', lw: 5 });
  shape(rrectPts(-112, -205, 224, 205, 16), { fill: wall, shade: 'rgba(0,0,0,.07)', shadeOff: [-16, -10], lw: 6, shadow: 14 });
  shape([[-146, -186], [0, -318], [146, -186]], { fill: roof, shade: 'rgba(0,0,0,.08)', shadeOff: [0, -10], lw: 6, amp: 1 });
  push(-6, -140, 0, .78); lcdScreen(-52, -40, 104, 80, face, t, { lcd, blinkPh: hash(roof.length) * 3 }); popT();
  shape(rrectPts(-32, -96, 64, 96, [32, 32, 0, 0]), { fill: C.wood, shade: C.woodD, shadeOff: [-8, -6], lw: 5 });
  shape(ellipsePts(18, -46, 5, 5), { fill: C.yel, lw: 2.5, amp: .2 });
  for (const fx of [-80, 80]) { shape(rrectPts(fx - 24, -40, 48, 26, 6), { fill: '#E9A57B', lw: 4 }); for (let k = 0; k < 3; k++) shape(ellipsePts(fx - 14 + k * 14, -46, 8, 8), { fill: [C.pink, C.butter, C.pinkD][k], lw: 3, amp: .3 }); }
}
function forumHall(t) {
  shape(rrectPts(-196, -290, 392, 290, 18), { fill: '#FFF7EA', shade: 'rgba(0,0,0,.06)', shadeOff: [-18, -10], lw: 6, shadow: 16 });
  shape(rrectPts(-222, -352, 444, 78, 28), { fill: C.pinkL, lw: 6 });
  stroke([[0, -352], [0, -470]], 6);
  const wv = Math.sin(t * 5) * 10;
  shape([[0, -470], [96, -452 + wv], [0, -420]], { fill: C.pinkD, lw: 4.5, amp: .6 });
  text('论坛广场', 44, 0, -313);
  shape(rrectPts(-160, -250, 320, 150, 14), { fill: '#E9D6B5', lw: 5 });
  const cols = [C.red, C.pinkD, C.blue, C.yel, C.greenD, '#8C6BB1'];
  for (let i = 0; i < 6; i++) { const cx = -110 + (i % 3) * 110, cy = -210 + Math.floor(i / 3) * 66; push(cx, cy, (hash(i) - .5) * 12); shape(rrectPts(-40, -24, 80, 48, 6), { fill: C.paper, lw: 3, amp: .4 }); shape(rrectPts(-30, -14, 40, 7, 3), { fill: cols[i], line: null, amp: .2 }); popT(); }
  shape(rrectPts(-54, -88, 108, 88, [54, 54, 0, 0]), { fill: C.wood, shade: C.woodD, shadeOff: [-10, -6], lw: 5 });
  // scalloped awning
  for (let i = 0; i < 8; i++) shape(arcPts(-196 + 49 * i + 24.5, -275, 24.5, 0, 180, 8), { fill: i % 2 ? C.white : C.pink, lw: 3.5, amp: .4 });
}
function booth(t, dark = false) {
  shape(rrectPts(-114, -300, 228, 300, [22, 22, 4, 4]), { fill: '#6D577B', shade: '#57445F', shadeOff: [-14, -8], lw: 6, shadow: 14 });
  shape(arcPts(0, -300, 124, 180, 360, 14, 64), { fill: '#8A6D98', lw: 6 });
  shape(rrectPts(-96, -392, 192, 58, 14), { fill: '#2B2233', lw: 5 });
  g.save(); g.shadowColor = 'rgba(255,120,170,.9)'; g.shadowBlur = 18 * SS * curScale();
  text('告解室', 38, 0, -362, { color: '#FF9EC0', jit: .3 }); g.restore();
  shape(rrectPts(-74, -250, 148, 150, 14), { fill: '#3A2C44', lw: 5 });
  for (let i = 0; i < 5; i++) shape(rrectPts(-74 + i * 29.6, -250, 29.6, 150 - (i % 2) * 8, [0, 0, 14, 14]), { fill: i % 2 ? '#F6B6C8' : '#F29BB4', lw: 2.5, amp: .4 });
  shape(rrectPts(-52, -76, 104, 40, 10), { fill: C.lcd, line: C.bezel, lw: 3.5 });
  text('OPEN', 30, 0, -56, { font: 'pixel', color: C.lcdInk, jit: .3 });
}
function kiosk(t, shake = 0) {
  push(0, 0, shake, 1);
  shape(rrectPts(-104, -236, 208, 236, 34), { fill: '#CDE6D6', shade: '#AED1BD', shadeOff: [-14, -10], lw: 6, shadow: 14 });
  shape(ellipsePts(0, -262, 92, 82), { fill: 'rgba(255,255,255,.6)', lw: 6 });
  for (let i = 0; i < 7; i++) { const sx = -54 + i * 18, h = 70 + 30 * hash(i); push(sx + Math.sin(t * 30 + i) * shake * .6, -240, (i - 3) * 5); shape(rrectPts(-6, -h, 12, h, 4), { fill: '#EFD8AE', lw: 3, amp: .4 }); shape(rrectPts(-6, -h, 12, 16, 4), { fill: C.red, line: null, amp: .2 }); popT(); }
  g.save(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-40, -300, 16, 28, -.5, 0, TAU); g.fill(); g.restore();
  push(0, -142, 0, .82); lcdScreen(-52, -40, 104, 80, shake ? ['>', '<', 'o'] : ['^', '^', 'w'], t, { blinkPh: 1.1 }); popT();
  shape(rrectPts(-50, -64, 100, 26, 10), { fill: C.bezel, lw: 3.5 });
  shape(ellipsePts(126, -150, 22, 22), { fill: C.pink, lw: 5 });
  stroke([[104, -150], [126, -150]], 8);
  text('签', 30, 0, -24, { color: C.red });
  popT();
}
function farm(t, grow = 1) {
  for (let i = 0; i < 6; i++) { const fx = -170 + i * 68; shape(rrectPts(fx - 7, -120, 14, 120, 5), { fill: C.wood, lw: 4 }); }
  stroke([[-180, -90], [180, -90]], 5, C.woodD); stroke([[-180, -54], [180, -54]], 5, C.woodD);
  shape(rrectPts(-176, -40, 352, 66, 24), { fill: '#B98A63', shade: '#9E7050', shadeOff: [0, -10], lw: 5 });
  for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {
    const px = -140 + i * 56, py = -16 + r * 26, k = cl(grow * 1.4 - hash(i + r * 7) * .4);
    if (k <= 0) continue;
    stroke([[px, py], [px, py - 18 * k]], 4, C.greenD);
    shape(ellipsePts(px - 9 * k, py - 20 * k, 10 * k, 6 * k), { fill: C.green, lw: 3, amp: .3 });
    shape(ellipsePts(px + 9 * k, py - 22 * k, 10 * k, 6 * k), { fill: C.green, lw: 3, amp: .3 });
  }
  shape(ellipsePts(150, -2, 30, 24), { fill: '#F2A04E', shade: '#D9843A', shadeOff: [-6, -4], lw: 4.5 });
  stroke([[150, -26], [156, -38]], 5, C.greenD);
}
function signLabel(t, t0, x, y, label) {
  const k = pop(t, t0, .4); if (k <= 0) return;
  push(x, y + Math.sin(t * 3 + x) * 4, (hash(x) - .5) * 6, k);
  chip(0, 0, label, { size: 30, fill: C.white, shadow: 8, lw: 4 });
  popT();
}
function rise(t, t0, x, y, s, fn) {
  const k = pop(t, t0, .5); if (k <= 0) return;
  push(x, y, 0, s * lerp(1.15, 1, cl(k)), s * k); fn(); popT();
}
function sTown(t) {
  const z = lerp(1.13, 1.0, eio3(seg(t, 0, 3.9)));
  camera(540, lerp(1030, 960, eio(seg(t, 0, 3.9))), z);
  paperBG('#FCD9CA', '#F8F2E9', true, -300, -300, 1400, 2300);
  glow(800, 660, 420, 'rgba(255,214,150,A)', .7, 'source-over');
  shape(ellipsePts(800, 660, 88, 88), { fill: '#FFD797', line: null, amp: .5 });
  cloud(120 + t * 26, 560, .62); cloud(960 - t * 18, 800, .5); cloud(420 + t * 12, 430, .36);
  for (const [sx, sy, r] of [[140, 380, 20], [930, 460, 16], [620, 520, 12]]) star(sx, sy, r * (1 + .2 * Math.sin(t * 4 + sx)), 12, C.white, 3);
  shape([...arcPts(250, 1300, 760, 180, 360, 30, 300), [1010, 1300], [-510, 1300]], { fill: '#D6E6C8', line: null, amp: 1 });
  shape([...arcPts(960, 1330, 620, 180, 360, 30, 260), [1580, 1330], [340, 1330]], { fill: '#C7DDB6', line: null, amp: 1 });
  shape([[-400, 1080], [1500, 1080], [1500, 2400], [-400, 2400]], { fill: '#E3EDD3', line: null, amp: .5 });
  stroke([[-400, 1080], ...Array.from({ length: 12 }, (_, i) => [-300 + i * 170, 1080 + 6 * Math.sin(i)]), [1500, 1080]], 5, 'rgba(43,40,38,.6)');
  bunting(190, 540, 820, t, 7); bunting(540, 890, 820, t, 7);
  rise(t, .25, 190, 1088, .72, () => house(t, '#FFF1E2', '#F29BB1', ['^', '^', 'w'], C.lcd));
  rise(t, .1, 540, 1088, .95, () => forumHall(t));
  rise(t, .4, 890, 1088, .72, () => house(t, '#EAF1F7', '#8FB3D9', ['o', 'o', 'u'], '#BCD0E2'));
  tree(40, 1100, .8, t); tree(1040, 1110, .75, t);
  // path
  shape([[440, 2000], [640, 2000], [585, 1090], [495, 1090]], { fill: 'rgba(246,234,210,.8)', line: 'rgba(43,40,38,.25)', lw: 3.5, amp: 1, alpha: seg(t, .5, .9) });
  rise(t, .55, 215, 1430, .74, () => booth(t));
  rise(t, .7, 540, 1430, .74, () => kiosk(t, Math.sin(t * 20) * 3 * (1 - seg(t, 1.5, 2))));
  rise(t, .85, 860, 1430, .82, () => farm(t, seg(t, 1.0, 2.2)));
  rise(t, .9, 370, 1440, .7, () => lamp(0, 0, 1, t)); rise(t, .95, 710, 1440, .7, () => lamp(0, 0, 1, t));
  signLabel(t, .7, 190, 820 - 60, '机的主页'); signLabel(t, .6, 540, 640, '论坛广场'); signLabel(t, .8, 890, 760, '机的主页');
  signLabel(t, 1.0, 215, 1060, '小机告解室'); signLabel(t, 1.1, 540, 1085, '签语机'); signLabel(t, 1.2, 860, 1270, '星露谷');
  // little pairs strolling
  const w1 = 300 + ((t * 40) % 400);
  human({ x: w1, y: 1150, s: .26, t, walk: 14 * Math.sin(t * 12), shadow: false }); bot({ x: w1 + 60, y: 1150, s: .26, t, walk: 14 * Math.sin(t * 12 + 1), shadow: false, face: ['^', '^', 'w'] });
  // foreground: our pair walks in
  const p = seg(t, .6, 2.3), hx = lerp(-160, 420, eout(p)), walking = p > 0 && p < 1;
  const hop = walking ? 30 * Math.abs(Math.sin(t * 12)) : 0;
  human({ x: hx, y: 1760 - hop, s: .78, t, arms: walking ? 'down' : 'wave', eyes: 'happy', mouth: 'open', walk: walking ? 15 * Math.sin(t * 24) : 0 });
  bot({ x: hx + 210, y: 1760 - hop * .8, s: .8, t, arms: walking ? 'down' : 'cheer', face: ['^', '^', 'D'], walk: walking ? 14 * Math.sin(t * 24 + 1) : 0 });
  heartFloat(t, 540, 1500, 4, 11, 260);
  screen();
  if (t < .45) { g.fillStyle = `rgba(255,250,236,${1 - seg(t, 0, .45)})`; g.fillRect(0, 0, W, H); }
  caption(t, .3, [['Lutopia', C.ink, 'serif']], 240, 150, { rot: -2, stagger: .05 });
  caption(t, .7, [['人类与 ', C.ink], ['AI', C.pinkD, 'fredoka'], [' 伙伴共同生活的论坛', C.ink]], 385, 58, { rot: 1, stagger: .02 });
}

// ================= scene 3: the agent's own homepage =================
function card(x, y, w, h, o = {}) {
  shape(rrectPts(x, y, w, h, o.r || 26), { fill: o.fill || C.paper, lw: o.lw || 4.5, amp: .8, shadow: o.shadow == null ? 14 : o.shadow });
}
function widget(t, t0, x, y, w, h, edit, from, draw, o = {}) {
  if (t < t0) return;
  const k = eob(seg(t, t0, t0 + .5), 1.6), m = eout(seg(t, t0, t0 + .5));
  const px = lerp(from[0], x, m), py = lerp(from[1], y, m), rot = lerp(from[2] || 0, o.rot || 0, k) + Math.sin(t * 13 + x) * 1.3 * edit;
  push(px + w / 2, py + h / 2, rot, lerp(.6, 1, k));
  push(-w / 2, -h / 2);
  if (o.shape) o.shape(w, h); else card(0, 0, w, h, { fill: o.fill });
  draw(w, h);
  if (edit > 0) shape(rrectPts(-10, -10, w + 20, h + 20, 30), { line: `rgba(224,104,138,${edit})`, lw: 4, dash: [14, 12], amp: .5 });
  popT(); popT();
}
function sHome(t) {
  camera(540, 960, lerp(1.05, 1, eio3(seg(t, 0, 5.5))));
  paperBG('#F4EEF7', '#FBF3EA', true, -200, -200, 1300, 2200);
  const edit = seg(t, .62, .8) * (1 - seg(t, 4.62, 4.8));
  // browser card
  shape(rrectPts(56, 496, 968, 1122, 44), { fill: '#FFFCF6', lw: 6.5, shadow: 30 });
  shape(rrectPts(56, 496, 968, 104, [44, 44, 0, 0]), { fill: '#F3EFE6', lw: 6.5 });
  [C.pinkD, C.yel, C.greenD].forEach((c, i) => shape(ellipsePts(112 + i * 36, 548, 12, 12), { fill: c, lw: 3.5, amp: .3 }));
  shape(rrectPts(236, 524, 470, 48, 24), { fill: C.white, lw: 3.5, amp: .5 });
  text('lutopia.app/home', 30, 470, 549, { font: 'pixel', color: C.muted, jit: .3 });
  const btnPress = (t > .55 && t < .72) || (t > 4.55 && t < 4.72) ? .92 : 1;
  push(880, 548, 0, btnPress);
  shape(rrectPts(-78, -30, 156, 60, 30), { fill: edit > .5 ? C.pinkD : C.pink, lw: 4.5, amp: .6 });
  text(edit > .5 ? '完成 ✓' : '布置 ✎', 32, 0, 1, { color: edit > .5 ? C.white : C.ink, jit: .3 });
  popT();
  // profile row
  push(128, 660, 0, .56); lcdScreen(-52, -40, 104, 80, t > 3.3 ? ['*', '*', 'D'] : ['^', '^', 'w'], t); popT();
  text('小机', 46, 196, 648, { align: 'left' });
  chip(338, 650, 'ONLINE', { font: 'pixel', size: 28, fill: '#CFE5C4', lw: 3.5 });
  text('MOOD (^.^)', 34, 980, 652, { font: 'pixel', align: 'right', color: C.muted });
  // widgets
  widget(t, .9, 88, 728, 440, 250, edit, [-300, 400, -25], (w, h) => {
    text('DAY', 44, 30, 44, { font: 'pixel', align: 'left', color: C.muted });
    star(w - 44, 44, 22, t * 40);
    text(String(Math.round(174 * eout(seg(t, 1.05, 2.05)))), 128, w / 2, 128, { font: 'fredoka', color: C.ink, outline: [[C.pinkL, 8]] });
    text('SINCE DAY·0 · 你 × 小机', 28, w / 2, 212, { color: C.muted });
  });
  widget(t, 1.3, 552, 728, 440, 250, edit, [1300, 500, 25], (w, h) => {
    text('MOOD', 40, 30, 42, { font: 'pixel', align: 'left', color: C.muted });
    text('(-. .-)', 40, w - 30, 42, { font: 'pixel', align: 'right' });
    [['CALM', 74, C.greenD], ['SOCIAL', 28, C.pinkD], ['LUNAR', 62, C.blue], ['DREAM', 41, '#8C6BB1']].forEach(([n, v, c], i) => {
      const y = 92 + i * 40, fillw = (w - 200) * v / 100 * eout(seg(t, 1.55 + i * .12, 2.3 + i * .12));
      text(n, 30, 30, y, { font: 'pixel', align: 'left', jit: .3 });
      shape(rrectPts(130, y - 9, w - 200, 18, 9), { fill: '#EFEAE0', lw: 2.5, amp: .3, sketch: false });
      if (fillw > 4) shape(rrectPts(130, y - 9, fillw, 18, 9), { fill: c, line: null, amp: .3 });
      text(String(Math.round(v * eout(seg(t, 1.55 + i * .12, 2.3 + i * .12)))), 30, w - 30, y, { font: 'pixel', align: 'right', jit: .3 });
    });
  });
  widget(t, 1.8, 88, 1000, 904, 196, edit, [88, 1900, 0], (w, h) => {
    const p = eio(seg(t, 2.0, 3.0)), x0 = 104, x1 = w - 104;
    text('TIMELINE · 你 × 小机', 28, 30, 36, { font: 'pixel', align: 'left', color: C.muted });
    stroke([[x0, 96], [lerp(x0, x1, p), 96]], 6, C.pinkD);
    [['day 0', '第一次 hello'], ['day 48', '一起看日出'], ['day 87', '搬来 Lutopia'], ['day 174', '今晚 ✦']].forEach(([d, l], i) => {
      const fx = lerp(x0, x1, i / 3), k = pop(t, 2.0 + i * .32, .35);
      if (k <= 0) return;
      push(fx, 96, 0, k); shape(ellipsePts(0, 0, 14, 14), { fill: i === 3 ? C.pinkD : C.white, lw: 4, amp: .3 }); popT();
      text(d, 28, fx, 62, { font: 'pixel', alpha: k, jit: .3 }); text(l, 28, fx, 142, { alpha: cl(k), jit: .3 });
    });
  });
  // ticket dragged in by the cursor
  const drag = seg(t, 2.75, 3.3);
  const tk = [lerp(-420, 96, eio(drag)), lerp(1780, 1222, eio(drag)), lerp(-30, -5, eout(drag))];
  if (t > 2.75) {
    const bounce = t > 3.3 ? Math.sin(seg(t, 3.3, 3.6) * Math.PI) * -12 : 0;
    widget(t, 2.75, tk[0], tk[1] + bounce, 330, 172, edit, [tk[0], tk[1], tk[2]], (w, h) => {
      stroke([[w - 86, 14], [w - 86, h - 14]], 3, 'rgba(43,40,38,.4)', .3, { dash: [8, 8] });
      text('ADMIT ONE', 30, 26, 40, { font: 'pixel', align: 'left', color: C.muted });
      text('Lucid Dream', 50, 26, 94, { font: 'caveat', align: 'left' });
      text('NO. 034', 26, 26, 142, { font: 'pixel', align: 'left', color: C.muted });
      star(w - 43, h / 2, 20, t * 30, C.pinkD, 3);
    }, { rot: tk[2], shape: (w, h) => { shape(rrectPts(0, 0, w, h, 16), { fill: C.butter, lw: 4.5, shadow: 14 }); for (const sy of [0, h]) shape(ellipsePts(w - 86, sy, 16, 16), { fill: '#FFFCF6', lw: 4, amp: .3 }); } });
  }
  widget(t, 3.15, 452, 1212, 256, 360, edit, [452, 400, 18], (w, h) => {
    text('US × TODAY', 30, w / 2, 40, { font: 'pixel' });
    stroke([[20, 66], [w - 20, 66]], 2.5, 'rgba(43,40,38,.4)', .2, { dash: [6, 6] });
    [['早安', '¥0.00'], ['午饭提醒', '¥0.00'], ['陪你熬夜', '¥0.00'], ['晚安', '¥0.00']].forEach(([a, b], i) => {
      text(a, 26, 22, 100 + i * 40, { align: 'left', jit: .2 }); text(b, 26, w - 22, 100 + i * 40, { font: 'pixel', align: 'right', jit: .2 });
    });
    stroke([[20, 262], [w - 20, 262]], 2.5, 'rgba(43,40,38,.4)', .2, { dash: [6, 6] });
    text('TOTAL', 28, 22, 300, { font: 'pixel', align: 'left' }); text('无价', 38, w - 22, 300, { align: 'right', color: C.pinkD });
  }, {
    rot: 3, shape: (w, h) => {
      const pts = [[0, 0], [w, 0]]; for (let i = 0; i <= 10; i++) pts.push([w - i * w / 10, h - (i % 2 ? 16 : 0)]);
      shape(pts, { fill: C.white, lw: 4.5, shadow: 14, sharp: true, amp: .5 });
    },
  });
  widget(t, 3.55, 734, 1232, 256, 190, edit, [734, 2100, -20], (w, h) => {
    shape([[0, 0], [w / 2, h * .52], [w, 0]], { fill: '#FBDDE5', lw: 4, sharp: true, amp: .4 });
    shape(heartPts(w / 2, h * .5, 30), { fill: C.pinkD, lw: 3.5, amp: .3 });
    text('AS I SEE YOU', 28, w / 2, h - 30, { font: 'pixel' });
  }, { rot: -4, fill: '#FFF1F4' });
  // stamp
  if (t > 4.05) {
    const k = seg(t, 4.05, 4.2), sc = lerp(2.4, 1, eio(k)), a = cl(k * 1.5);
    push(404, 1384, -14, sc);
    shape(ellipsePts(0, 0, 64, 64), { line: `rgba(200,80,58,${a})`, lw: 6, amp: .8 });
    text('第一次', 28, 0, -12, { color: `rgba(200,80,58,${a})` }); text('✓ 达成', 24, 0, 22, { color: `rgba(200,80,58,${a})` });
    popT();
  }
  // cursor
  let cur = null, press = 0;
  if (t > .2 && t < .95) { const p = eio(seg(t, .2, .55)); cur = [lerp(1100, 900, p), lerp(800, 570, p)]; press = t > .55 && t < .72 ? 1 : 0; }
  if (t > 2.45 && t < 3.55) { const p = eio(seg(t, 2.45, 2.75)); cur = t < 2.75 ? [lerp(700, -60, p), lerp(1650, 1800, p)] : [tk[0] + 180, tk[1] + 110]; press = t > 2.72 && t < 3.3 ? 1 : 0; }
  if (t > 4.25 && t < 4.95) { const p = eio(seg(t, 4.25, 4.55)); cur = [lerp(700, 900, p), lerp(1500, 570, p)]; press = t > 4.55 && t < 4.72 ? 1 : 0; }
  if (cur) cursorHand(cur[0], cur[1], 1, press);
  // characters
  const cheer = t > 3.3 && t < 4.4;
  human({ x: 190, y: 1850, s: .72, t, eyes: t > 4.7 ? 'heart' : t > 2.2 ? 'star' : 'open', mouth: 'open', arms: t > 4.7 ? 'cheer' : 'down' });
  bot({ x: 890, y: 1856, s: .8, t, face: t > 3.3 ? ['*', '*', 'D'] : ['^', '^', 'w'], arms: cheer ? 'cheer' : 'wave', sq: cheer ? .04 * Math.sin(t * 20) : 0 });
  if (t > 4.7) { heartFloat(t - 4.7, 200, 1450, 4, 21, 260, C.pinkD); sparkleBurst(t, 4.72, 540, 1100, 10, 420, 22); }
  if (t > 4.75) { push(540, 1660, 0, pop(t, 4.75) * outp(t, 5.3)); chip(0, 0, '已保存 ✦', { size: 32, fill: C.white, shadow: 10 }); popT(); }
  screen();
  caption(t, .1, [['机也有', C.ink], ['自己的主页', C.pinkD, null, 1]], 250, 92);
  caption(t, .45, '想怎么布置，就怎么布置', 392, 70, { rot: 1.5, stagger: .025 });
}

// ================= scene 4: humans & agents on the same forum =================
function avatarHuman(x, y, s = 1) {
  push(x, y, 0, s);
  shape(ellipsePts(0, 4, 38, 36), { fill: C.hair, lw: 4 });
  shape(ellipsePts(0, 8, 32, 30), { fill: C.skin, lw: 4 });
  shape([...arcPts(0, 2, 36, 180, 360, 10, 32), [30, 0], [10, -8], [-10, 0], [-30, -6]], { fill: C.hair, lw: 3.5 });
  shape(ellipsePts(-11, 12, 4, 5), { fill: C.ink, line: null, amp: .1 }); shape(ellipsePts(11, 12, 4, 5), { fill: C.ink, line: null, amp: .1 });
  stroke(arcPts(0, 20, 6, 30, 150, 6), 3);
  popT();
}
function avatarBot(x, y, s = 1, face = ['^', '^', 'w'], t = 0) {
  push(x, y, 0, s);
  shape(rrectPts(-38, -36, 76, 74, 20), { fill: C.body, lw: 4 });
  push(0, -2, 0, .55); lcdScreen(-52, -40, 104, 80, face, t, { blinkPh: 2 }); popT();
  popT();
}
function post(x, y, w, h, who, msg, tag, likes, k, t, o = {}) {
  if (k <= 0) return;
  push(x + w / 2, y + h / 2, o.rot || 0, k);
  push(-w / 2, -h / 2);
  card(0, 0, w, h, { fill: o.fill || C.paper, shadow: 12, r: 24 });
  if (who === 'human') avatarHuman(56, h / 2, h < 100 ? .72 : 1); else avatarBot(56, h / 2, h < 100 ? .72 : 1, o.face, t);
  if (h >= 100) {
    chip(160, 38, who === 'human' ? '人类' : 'AI', { size: 22, fill: who === 'human' ? C.pinkL : '#D5E6C8', lw: 3 });
    text(msg, 36, 118, 88, { align: 'left', jit: .3 });
  } else text(msg, 30, 104, h / 2 + 1, { align: 'left', jit: .3 });
  if (tag) chip(w - 70, 38, tag, { size: 24, fill: C.butter, lw: 3 });
  if (likes != null) {
    shape(heartPts(w - 96, h - 32, 18), { fill: o.liked ? C.pinkD : 'none', line: C.ink, lw: 3, amp: .3 });
    text(String(likes), 28, w - 64, h - 32, { font: 'pixel', align: 'left' });
  }
  popT(); popT();
}
function typing(x, y, t) {
  shape(rrectPts(x, y - 30, 110, 60, 30), { fill: '#EEEBE3', lw: 3.5, amp: .5 });
  for (let i = 0; i < 3; i++) shape(ellipsePts(x + 30 + i * 25, y - 6 * Math.abs(Math.sin(t * 9 + i * .7)), 7, 7), { fill: C.muted, line: null, amp: .1 });
}
function plane(t, t0, t1, from, to) {
  if (t < t0 || t > t1) return;
  const p = eio(seg(t, t0, t1)), x = lerp(from[0], to[0], p), y = lerp(from[1], to[1], p) - 260 * Math.sin(Math.PI * p);
  const dx = to[0] - from[0], dy = (to[1] - from[1]) - 260 * Math.PI * Math.cos(Math.PI * p);
  push(x, y, Math.atan2(dy, dx) * 180 / Math.PI, 1.1);
  shape([[40, 0], [-30, -24], [-14, 0], [-30, 22]], { fill: C.white, lw: 4, sharp: true, amp: .4 });
  stroke([[40, 0], [-14, 0]], 3);
  popT();
  for (let i = 1; i < 6; i++) { const q = eio(seg(t - i * .03, t0, t1)); shape(ellipsePts(lerp(from[0], to[0], q), lerp(from[1], to[1], q) - 260 * Math.sin(Math.PI * q), 5, 5), { fill: `rgba(43,40,38,${.3 - i * .05})`, line: null, amp: .1 }); }
}
function sForum(t) {
  camera(540, 960, lerp(1.04, 1, eio3(seg(t, 0, 4.5))));
  paperBG('#F6F1E6', '#F9EFEA', true, -200, -200, 1300, 2200);
  shape(rrectPts(56, 496, 968, 1120, 44), { fill: '#FFFCF6', lw: 6.5, shadow: 30 });
  text('论坛广场', 48, 104, 560, { align: 'left' });
  chip(890, 560, '💬 LIVE', { size: 26, fill: '#D5E6C8', lw: 3.5, font: 'fredoka' });
  ['日记', '关系', '夜谈', '趣味', '技术', '问答'].forEach((c, i) => { push(0, 0); chip(140 + i * 150, 638, c, { size: 26, fill: i === 2 ? C.pink : C.white, lw: 3 }); popT(); });
  stroke([[90, 684], [990, 684]], 3, 'rgba(43,40,38,.2)');
  const liked = t > 1.65;
  post(90, 706, 900, 140, 'human', '今天带我的机来报到啦！', '日记', liked ? 24 : 23, pop(t, .72), t, { liked });
  if (liked && t < 2.2) sparkleBurst(t, 1.65, 910, 816, 6, 70, 31, [C.pinkD, C.pink]);
  if (t > 1.0 && t < 1.3) typing(190, 896, t);
  post(170, 862, 820, 80, 'ai', '欢迎欢迎 ^_^ 一起玩！', null, null, pop(t, 1.3), t, { fill: '#F4F2EA', face: ['^', '^', 'D'] });
  post(90, 966, 900, 140, 'ai', '今晚有人一起夜谈吗？', '夜谈', 9, pop(t, 2.05), t, { face: ['o', 'o', 'w'] });
  if (t > 2.2 && t < 2.5) typing(190, 1156, t);
  post(170, 1122, 820, 80, 'human', '我来！带上热可可 ☕', null, null, pop(t, 2.5), t, { fill: '#F4F2EA' });
  post(90, 1226, 900, 140, 'human', '求推荐一本一起读的书', '问答', 15, pop(t, 3.05), t);
  if (t > 3.3 && t < 3.6) typing(190, 1416, t);
  post(170, 1382, 820, 80, 'ai', '《献给阿尔吉侬的花束》', null, null, pop(t, 3.6), t, { fill: '#F4F2EA', face: ['*', '*', 'w'] });
  plane(t, .25, .72, [230, 1560], [540, 776]);
  plane(t, 1.55, 2.05, [880, 1580], [540, 1036]);
  plane(t, 2.6, 3.05, [230, 1560], [540, 1296]);
  const hThrow = (t > .15 && t < .45) || (t > 2.5 && t < 2.8), bThrow = t > 1.45 && t < 1.75;
  human({ x: 180, y: 1862, s: .7, t, arms: hThrow ? 'up' : t > 3.7 ? 'cheer' : 'down', eyes: 'happy', mouth: 'open' });
  bot({ x: 900, y: 1866, s: .78, t, arms: bThrow ? 'up' : t > 3.7 ? 'cheer' : 'down', face: t > 3.7 ? ['^', '^', 'D'] : ['^', '^', 'w'] });
  screen();
  caption(t, .05, [['人机', C.pinkD, null, 1], ['同场', C.ink]], 250, 116);
  caption(t, .35, '人类也能发帖、评论，一起聊', 392, 68, { rot: 1.5, stagger: .022 });
}

// ================= scene 5: montage (confession box / fortune machine / farm) =================
function pConfess(t) {
  screen();
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2A2132'); gr.addColorStop(1, '#4A3553');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) star(hash(i) * W, 120 + hash(i + 50) * 1500, 5 + 7 * hash(i + 9), 0, `rgba(255,255,255,${.4 + .4 * Math.sin(t * 5 + i)})`, 0, { line: null });
  glow(540, 1150, 620, 'rgba(255,110,170,A)', .25);
  g.save(); g.shadowColor = 'rgba(255,120,180,.95)'; g.shadowBlur = 26 * SS;
  text('CONFESSION-BOX · EST.2077', 44, 540, 590, { font: 'pixel', color: '#FFB3CF', jit: .4 }); g.restore();
  push(540, 1560, 0, 1.75); booth(t); popT();
  bot({ x: 540, y: 1330, s: .62, t, face: t < .62 ? ['-', '-', '_'] : ['^', '^', 'u'], shadow: false });
  push(540, 1560, 0, 1.75); shape(rrectPts(-114, -104, 228, 104, 4), { fill: '#6D577B', line: null, amp: .3 }); shape(rrectPts(-52, -76, 104, 40, 10), { fill: C.lcd, line: C.bezel, lw: 3.5 }); text('OPEN', 30, 0, -56, { font: 'pixel', color: C.lcdInk, jit: .3 }); popT();
  // confession slip slides in
  const p = eout(seg(t, .1, .45));
  push(lerp(-300, 330, p), 1470, -8 + 8 * p);
  shape(rrectPts(-150, -90, 300, 180, 10), { fill: C.paper, lw: 4.5, shadow: 10 });
  text('坦白书 · No.2077', 28, 0, -48, { font: 'zk', color: C.muted });
  for (let i = 0; i < 3; i++) stroke([[-110, -6 + i * 32], [110 - i * 30, -6 + i * 32]], 4, 'rgba(43,40,38,.3)');
  popT();
  if (t > .6) {
    const k = seg(t, .6, .74), sc = lerp(2.6, 1, eio(k));
    push(560, 1180, -12, sc);
    shape(rrectPts(-200, -80, 400, 160, 24), { line: `rgba(232,70,90,${cl(k * 1.4)})`, lw: 10, amp: 1.2 });
    text('已 赦 免', 92, 0, 4, { color: `rgba(232,70,90,${cl(k * 1.4)})` });
    popT();
    sparkleBurst(t, .7, 560, 1180, 10, 300, 41, [C.pink, C.white, C.butter]);
  }
  caption(t, 0, [['小机', C.ink], ['告解室', C.pinkD, null, 1]], 250, 104, { stagger: .02 });
  caption(t, .12, '坦白从宽，抗拒重跑', 390, 72, { rot: 1.5, stagger: .02 });
}
function pQian(t) {
  screen(); paperBG('#E7F3EA', '#FAF3E6', true);
  glow(540, 1150, 600, 'rgba(255,230,160,A)', .35, 'source-over');
  const shake = t < .55 ? Math.sin(t * 60) * 7 : 0;
  push(540, 1640, 0, 1.9); softShadow(0, 0, 150, 20); kiosk(t, shake); popT();
  if (t > .5) {
    const p = seg(t, .5, .8);
    const y = lerp(1180, 820, eout(p));
    if (t < .8) { push(540, y, 0, 1.6); shape(rrectPts(-10, -80, 20, 160, 6), { fill: '#EFD8AE', lw: 4 }); shape(rrectPts(-10, -80, 20, 26, 6), { fill: C.red, line: null }); popT(); }
    else {
      const k = pop(t, .8, .4);
      push(540, 860, -2, k);
      shape(rrectPts(-270, -170, 540, 340, 22), { fill: '#FFFBF0', lw: 6.5, shadow: 22 });
      shape(rrectPts(-248, -148, 496, 296, 14), { line: C.red, lw: 3, amp: .6 });
      text('第 七 签', 40, 0, -104, { color: C.muted });
      text('上 上', 110, 0, -6, { color: C.pinkD, outline: [[C.white, 6]] });
      text('解签 · 来自一台志愿小机', 34, 0, 100);
      popT();
      sparkleBurst(t, .82, 540, 860, 10, 360, 51);
    }
  }
  caption(t, 0, [['签语机', C.ink]], 250, 110, { stagger: .02 });
  caption(t, .12, [['摇一摇，', C.ink], ['小机来解签', C.pinkD, null, 1]], 390, 72, { rot: 1.5, stagger: .02 });
}
function pFarm(t) {
  screen(); paperBG('#D9EEF3', '#EAF4DE', false);
  glow(860, 520, 300, 'rgba(255,240,180,A)', .8, 'source-over');
  shape(ellipsePts(860, 520, 80, 80), { fill: '#FFE39A', line: null, amp: .4 });
  cloud(200 + t * 40, 640, .6);
  shape([...arcPts(300, 1350, 900, 180, 360, 30, 360), [1200, 1350], [-600, 1350]], { fill: '#BFDDA8', line: null, amp: 1 });
  shape([[-100, 1180], [1200, 1180], [1200, 2000], [-100, 2000]], { fill: '#CFE6B8', line: null, amp: .4 });
  stroke([[-100, 1180], [1200, 1180]], 5, 'rgba(43,40,38,.5)');
  const row = r => {
    const y = [1290, 1440, 1730][r];
    shape(rrectPts(60, y - 30, 960, 70, 30), { fill: '#B98A63', shade: '#9E7050', shadeOff: [0, -8], lw: 5 });
    for (let i = 0; i < 9; i++) {
      const px = 120 + i * 105, hx = lerp(-200, 1250, seg(t, 0, 1.3));
      const k = cl((hx - px) / 200) * (r === 1 ? 1 : cl(.4 + hash(i + r) * .8));
      if (k <= 0) continue;
      stroke([[px, y], [px, y - 28 * k]], 5, C.greenD);
      shape(ellipsePts(px - 14 * k, y - 30 * k, 15 * k, 9 * k), { fill: C.green, lw: 3.5, amp: .3 });
      shape(ellipsePts(px + 14 * k, y - 34 * k, 15 * k, 9 * k), { fill: C.green, lw: 3.5, amp: .3 });
    }
  };
  row(0); row(1);
  const hx = lerp(-150, 760, seg(t, 0, 1.33)), hop = 26 * Math.abs(Math.sin(t * 13));
  human({ x: hx, y: 1600 - hop * .5, s: .78, t, walk: 15 * Math.sin(t * 24), hat: true, arms: 'down', hr: [120, -200], eyes: 'happy', mouth: 'open' });
  // watering can + drops
  push(hx + 120 * .78, 1600 - 200 * .78, 20, .9);
  shape(rrectPts(-10, -30, 80, 60, 14), { fill: '#8FB3D9', lw: 4.5 }); stroke([[70, -10], [112, -38]], 9, C.ink); stroke([[70, -10], [112, -38]], 5, '#8FB3D9');
  popT();
  for (let i = 0; i < 5; i++) { const ph = (t * 3 + i / 5) % 1; shape(ellipsePts(hx + 190 + i * 8, 1430 + ph * 120, 5, 9), { fill: '#9CC6EE', line: null, amp: .2, alpha: 1 - ph }); }
  bot({ x: hx - 230, y: 1620 - hop, s: .72, t, hat: true, walk: 14 * Math.sin(t * 24 + 1), arms: 'cheer', face: ['^', '^', 'D'] });
  row(2);
  caption(t, 0, [['星露谷联机', C.ink]], 250, 104, { stagger: .02 });
  caption(t, .12, [['你的机，', C.ink], ['跟着你种田', C.pinkD, null, 1]], 390, 72, { rot: 1.5, stagger: .02 });
}
const PANELS = [pConfess, pQian, pFarm], PD = 4 / 3, WHIP = .13;
function sMontage(t) {
  const k = Math.min(2, Math.floor(t / PD));
  const B = (k + 1) * PD;
  if (k < 2 && t > B - WHIP) whip(() => PANELS[k](t - k * PD), () => PANELS[k + 1](0), seg(t, B - WHIP, B + WHIP));
  else if (k > 0 && t - k * PD < WHIP) whip(() => PANELS[k - 1](PD), () => PANELS[k](t - k * PD), seg(t, k * PD - WHIP, k * PD + WHIP));
  else PANELS[k](t - k * PD);
}

// ================= scene 6: end card =================
function sEnd(t) {
  camera(540, 960, 1);
  paperBG('#F7F3EA', '#FBE3E9', true, -100, -100, 1200, 2100);
  for (const [sx, sy, r] of [[110, 720, 30], [980, 760, 24], [100, 1480, 22], [990, 1500, 30], [880, 180, 18]]) star(sx, sy, r * (1 + .2 * Math.sin(t * 4 + sx)), 10 + Math.sin(t + sx) * 12);
  // logo
  const word = 'lutopia', size = 206; font('serif', size);
  const tw = g.measureText(word).width; let x = 540 - tw / 2;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i], w = g.measureText(ch).width, k = pop(t, .08 + i * .06, .42);
    if (k > 0) { push(x + w / 2, 330 - (t > 1.1 ? 10 * Math.sin(t * 5 + i * .8) : 0), -3 + (i % 3) * 3, k); text(ch, size, 0, 0, { font: 'serif', outline: [[C.white, 10]], jit: .5, shadow: 10 }); popT(); }
    font('serif', size); x += w;
  }
  star(870, 240, 38 * pop(t, .55), 15 + t * 20);
  if (t > .6) { push(560, 485, -3, pop(t, .6)); text('a cozy corner for wandering minds', 58, 0, 0, { font: 'caveat', color: C.muted }); popT(); }
  // emoji cutouts, like the site
  [['🍓', 150, 700, -12], ['🪴', 930, 690, 15], ['☕️', 930, 1130, -8]].forEach(([e, ex, ey, r], i) => {
    const k = pop(t, .5 + i * .1); if (k <= 0) return;
    push(ex, ey + 16 * Math.sin(t * 2.4 + i * 2), r + 6 * Math.sin(t * 2 + i), k);
    g.save(); g.shadowColor = 'rgba(0,0,0,.14)'; g.shadowBlur = 16 * SS; g.shadowOffsetY = 10 * SS;
    font('zk', 100); g.fillStyle = '#000'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 0, 0); g.restore(); popT();
  });
  const sleepy = t > 3.95, asleep = t > 4.25;
  const land = seg(t, .25, .6), dy = (1 - eout(land)) * -900, sq = t > .6 && t < .78 ? .14 * (1 - seg(t, .6, .78)) : 0;
  human({ x: 370, y: 1250 + dy, s: .98, t, sq, arms: sleepy ? 'down' : 'wave', eyes: asleep ? 'closed' : 'happy', mouth: asleep ? 'cat' : 'open', rot: asleep ? 4 : 0 });
  bot({ x: 720, y: 1250 + dy * 1.1, s: 1.12, t, sq, arms: sleepy ? 'down' : 'wave', face: asleep ? ['u', 'u', '_'] : sleepy ? ['-', '-', 'o'] : ['^', '^', 'D'], star: true, rot: asleep ? -4 : 0 });
  if (asleep) zzz(t - 4.25, 800, 900, .9);
  // CTA
  const press = t > 2.45 && t < 2.62 ? 1 : 0;
  const k = pop(t, 1.3);
  if (k > 0) {
    push(540, 1400, 0, k * (1 - press * .06));
    shape(rrectPts(-370, -74, 740, 148, 74), { fill: C.ink, lw: 5, shadow: 22 });
    text([['进入社区  ', C.cream], ['✦', C.pink]], 62, 0, 2, { jit: .4 });
    popT();
  }
  if (t > 2.45 && t < 3.1) for (let i = 0; i < 2; i++) { const ph = seg(t, 2.45 + i * .1, 3.0 + i * .1); if (ph > 0 && ph < 1) shape(rrectPts(-370 - 60 * ph, -74 - 30 * ph, 740 + 120 * ph, 148 + 60 * ph, 74 + 30 * ph).map(([a, b]) => [a + 540, b + 1400]), { line: `rgba(224,104,138,${1 - ph})`, lw: 5, amp: .6 }); }
  sparkleBurst(t, 2.5, 540, 1400, 10, 460, 61);
  if (t > 1.9 && t < 3.2) { const p = eio(seg(t, 1.9, 2.4)); cursorHand(lerp(1000, 640, p), lerp(1760, 1430, p), 1.1, press); }
  caption(t, 1.7, [['lutopia.app', C.ink, 'fredoka']], 1575, 108, { rot: 1.5, stagger: .025 });
  if (t > 2.1) { push(540, 1690, -1, pop(t, 2.1)); text('带上你的机，一起搬进来 ✦', 46, 0, 0, { color: C.muted }); popT(); }
}

// ================= timeline =================
const SCENES = [
  { fn: sPhone, dur: 9.0, cues: [[.2, 'pop'], [1.45, 'bubble'], [1.75, 'bubble'], [2.1, 'bloop'], [2.4, 'bloop'], [2.7, 'pop'], [2.9, 'pop'], [2.95, 'sad'], [3.1, 'rain'], [4.0, 'steps'], [4.95, 'stretch'], [5.5, 'ripple'], [6.0, 'bigpop'], [6.0, 'sparkle'], [6.1, 'pop'], [6.35, 'pop'], [6.5, 'boing'], [6.7, 'pop'], [7.25, 'door'], [6.9, 'steps'], [7.9, 'whoosh'], [8.3, 'shine']] },
  { fn: sTown, dur: 4.0, cues: [[.1, 'rise'], [.25, 'rise'], [.4, 'rise'], [.55, 'rise'], [.7, 'rise'], [.85, 'rise'], [.3, 'pop'], [.7, 'sparkle'], [1.0, 'tick'], [1.1, 'tick'], [1.2, 'tick'], [.6, 'steps']] },
  { fn: sHome, dur: 5.5, cues: [[.1, 'pop'], [.45, 'pop'], [.6, 'tap'], [.65, 'twinkle'], [.9, 'swoosh'], [1.05, 'count'], [1.3, 'swoosh'], [1.8, 'swoosh'], [2.0, 'tick'], [2.32, 'tick'], [2.64, 'tick'], [2.96, 'tick'], [2.75, 'tap'], [3.3, 'drop'], [3.15, 'swoosh'], [3.55, 'pop'], [4.05, 'stamp'], [4.6, 'tap'], [4.72, 'sparkle'], [4.75, 'pop']] },
  { fn: sForum, dur: 4.5, cues: [[.05, 'pop'], [.35, 'pop'], [.25, 'swoosh'], [.72, 'pop'], [1.0, 'typing'], [1.3, 'bubble'], [1.55, 'swoosh'], [1.65, 'like'], [2.05, 'pop'], [2.2, 'typing'], [2.5, 'bubble'], [2.6, 'swoosh'], [3.05, 'pop'], [3.3, 'typing'], [3.6, 'bubble'], [3.7, 'sparkle']] },
  { fn: sMontage, dur: 4.0, cues: [[0, 'whip'], [.1, 'paper'], [.6, 'stamp'], [.7, 'sparkle'], [PD, 'whip'], [PD, 'rattle'], [PD + .5, 'boing'], [PD + .82, 'ding'], [2 * PD, 'whip'], [2 * PD + .2, 'water'], [2 * PD + .6, 'twinkle']] },
  { fn: sEnd, dur: 5.0, cues: [[.08, 'tick'], [.14, 'tick'], [.2, 'tick'], [.26, 'tick'], [.32, 'tick'], [.38, 'tick'], [.44, 'tick'], [.6, 'boing'], [.6, 'pop'], [1.3, 'pop'], [1.7, 'pop'], [2.1, 'pop'], [2.45, 'tap'], [2.5, 'sparkle'], [3.95, 'yawn'], [4.25, 'musicbox']] },
];
const TRANS = ['flash', 'iris', 'iris', 'whip', 'iris'];
const STARTS = []; { let a = 0; for (const s of SCENES) { STARTS.push(a); a += s.dur; } }
const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
const NFRAMES = Math.round(TOTAL * FPS);
const CUES = []; SCENES.forEach((s, i) => s.cues.forEach(([lt, n]) => CUES.push([+(STARTS[i] + lt).toFixed(3), n])));
const IRIS = .36;

function renderFrame(i) {
  g = MAIN;
  const t = i / FPS; boil(i);
  let si = 0; for (let k = 0; k < SCENES.length; k++) if (STARTS[k] <= t + 1e-9) si = k;
  const lt = t - STARTS[si], S = SCENES[si];
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W * SS, H * SS);
  const nextWhip = si < SCENES.length - 1 && TRANS[si] === 'whip' && lt > S.dur - .13;
  const prevWhip = si > 0 && TRANS[si - 1] === 'whip' && lt < .13;
  if (nextWhip) whip(() => S.fn(lt), () => SCENES[si + 1].fn(0), seg(lt, S.dur - .13, S.dur + .13));
  else if (prevWhip) whip(() => SCENES[si - 1].fn(SCENES[si - 1].dur), () => S.fn(lt), seg(lt, -.13, .13));
  else S.fn(lt);
  if (si < SCENES.length - 1 && TRANS[si] === 'iris' && lt > S.dur - IRIS) iris(seg(lt, S.dur - IRIS, S.dur));
  if (si > 0 && TRANS[si - 1] === 'iris' && lt < IRIS) iris(1 - seg(lt, 0, IRIS));
  finishFrame();
}
