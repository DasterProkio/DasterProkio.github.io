/* Original procedural score, 170 BPM, 51 bars.
   Arrangement: intro 0-8 | build 8-16 (drop-stop at 15.875) | drop 16-36 | filter-down 36-38 |
   operator/outfit groove 38-42 (stop at 41.875) | lens ambience 42-45 | key-visual hit 45-47 | slates 47-51 (near silence).
   The same event list feeds PV.hits, so visual punches land exactly on kicks/snares. */
'use strict';
(function () {
  const { BAR, BEAT } = PV;
  const S8 = BEAT / 2, S16 = BEAT / 4;
  PV.LENGTH = 51 * BAR;

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // D minor-ish loop, one chord per 2 bars
  const CH = [
    [62, 65, 69, 72, 76], // Dm9
    [58, 62, 65, 69, 72], // Bbmaj7(9)
    [55, 58, 62, 65, 69], // Gm9
    [57, 62, 64, 67, 69], // A7sus4
  ];
  const ROOT = [38, 34, 31, 33];
  const chordIx = bar => Math.floor(bar / 2) % 4;

  /* ---------------- score ---------------- */
  const ev = [];
  const at = (bar, type, p = {}) => ev.push({ t: bar * BAR, type, ...p });
  const atT = (t, type, p = {}) => ev.push({ t, type, ...p });

  // intro
  at(0, 'swell', { dur: BAR * 1, v: 0.18 });
  at(1, 'impact', { v: 0.9 });
  for (let b = 1; b < 38; b += 2) {
    const cut = b < 8 ? 2600 : b < 16 ? 3400 : b < 36 ? 5200 : 1400;
    at(b, 'pad', { dur: BAR * 2, notes: CH[chordIx(b - 1)], cut, v: b < 8 ? 0.016 : b < 16 ? 0.02 : 0.022 });
  }
  for (let b = 1; b < 8; b += 2) at(b, 'sub', { dur: BAR * 2, m: ROOT[chordIx(b - 1)] });
  // intro plucks: sparse 8ths, delay makes them bloom
  const ARP = [0, 2, 1, 3, 4, 3, 2, 1];
  for (let b = 3; b < 16; b++) {
    const ch = CH[chordIx(b)];
    const step = b < 8 ? 2 : 1;
    for (let i = 0; i < 16; i += step) {
      if (b < 8 && (i % 4 === 2)) continue;
      const m = ch[ARP[i % 8]] + 12;
      at(b + i / 16, 'pluck', { m, v: b < 8 ? 0.07 : 0.09, cut: 1200 + (b - 3) * 250 });
    }
  }
  for (let b = 5; b < 8; b++) for (let i = 0; i < 8; i++) at(b + i / 8, 'hat', { v: 0.05 + (i % 2) * 0.03 });
  at(7, 'swell', { dur: BAR, v: 0.25 });
  at(1, 'air', { dur: BAR * 7, v: 0.03 });
  at(36, 'air', { dur: BAR * 2, v: 0.025 });

  // build 8-16: half-time drums, gliding sub, riser, snare roll, stop
  at(8, 'impact', { v: 0.8 });
  for (let b = 8; b < 12; b += 2) at(b, 'glide', { dur: BAR * 2, m: ROOT[chordIx(b)] });
  for (let b = 12; b < 16; b += 2) at(b, 'sub', { dur: BAR * 2, m: ROOT[chordIx(b)] });
  for (let b = 8; b < 15; b++) {
    at(b, 'kick', { v: 0.9 });
    if (b >= 10) at(b + 0.5, 'snare', { v: 0.55 });
    const hs = b < 12 ? 8 : 16;
    for (let i = 0; i < hs; i++) at(b + i / hs, 'hat', { v: 0.05 + (i % 2 ? 0.02 : 0.05) });
  }
  // UI blips while the schematic slabs build (bars 8-10, every 8th)
  for (let i = 0; i < 16; i++) at(8 + i / 8, 'blip', { f: 1760 + (i % 4) * 220, v: 0.035 });
  at(12, 'impact', { v: 0.6 });
  at(12, 'riser', { dur: BAR * 3.875 });
  for (let i = 0; i < 14; i++) at(15 + i / 16, 'snare', { v: 0.25 + i * 0.03 });
  at(15.5, 'swell', { dur: BAR * 0.375, v: 0.3 });

  // drop 16-36: two-step at 170
  const KICK = [0, 5], SNARE = [2, 6];
  for (let b = 16; b < 36; b++) {
    const fill = b % 4 === 3;
    for (const k of KICK) at(b + k / 8, 'kick', { v: 1 });
    if (b % 2) at(b + 11 / 16, 'kick', { v: 0.7 });
    for (const s of SNARE) at(b + s / 8, 'snare', { v: 0.8 });
    at(b + 7 / 16, 'snare', { v: 0.18 });
    at(b + 14 / 16, 'snare', { v: 0.15 });
    if (fill) for (let i = 12; i < 16; i++) at(b + i / 16, 'snare', { v: 0.3 + (i - 12) * 0.1 });
    for (let i = 0; i < 16; i++) at(b + i / 16, 'hat', { v: i % 2 ? 0.035 : 0.07, open: i % 8 === 4 });
    at(b + 3 / 16, 'stab', { notes: CH[chordIx(b)], v: 0.05 });
    if (b % 2 === 0) at(b, 'reese', { dur: BAR * 2, m: ROOT[chordIx(b)] + (b >= 32 ? 12 : 0) });
  }
  [16, 24, 32].forEach(b => { at(b, 'crash', { v: 0.35 }); at(b, 'impact', { v: 0.9 }); });
  at(31.75, 'whoosh', { dur: BAR * 0.5 });
  at(33.75, 'whoosh', { dur: BAR * 0.5 });
  for (let i = 0; i < 8; i++) at(35.5 + i / 32, 'snare', { v: 0.4 + i * 0.05 });
  at(35.75, 'whoosh', { dur: BAR * 0.25 });

  // 36-38: filter-down, half-time (cube wall)
  at(36, 'crash', { v: 0.3 });
  for (let b = 36; b < 38; b++) {
    at(b, 'kick', { v: 0.9 });
    at(b + 0.5, 'snare', { v: 0.5 });
    for (let i = 0; i < 8; i++) at(b + i / 8, 'hat', { v: 0.04 });
  }
  at(36, 'sub', { dur: BAR * 2, m: ROOT[chordIx(36)] });
  for (let i = 0; i < 8; i++) at(37 + i / 8, 'pluck', { m: CH[chordIx(37)][ARP[i]] + 24, v: 0.05, cut: 2500 });
  at(37, 'riser', { dur: BAR });
  for (let i = 0; i < 8; i++) at(37.5 + i / 16, 'snare', { v: 0.25 + i * 0.05 });

  // 38-42: operator / outfit groove — two-step again, brighter plucks instead of reese
  at(38, 'crash', { v: 0.35 }); at(38, 'impact', { v: 0.85 });
  for (let b = 38; b < 42; b++) {
    const last = b === 41;
    for (const k of KICK) at(b + k / 8, 'kick', { v: 0.95 });
    if (b % 2) at(b + 11 / 16, 'kick', { v: 0.6 });
    for (const s of SNARE) if (!(last && s === 6)) at(b + s / 8, 'snare', { v: 0.75 });
    at(b + 7 / 16, 'snare', { v: 0.16 });
    for (let i = 0; i < (last ? 12 : 16); i++) at(b + i / 16, 'hat', { v: i % 2 ? 0.03 : 0.06, open: i % 8 === 4 });
    at(b + 3 / 16, 'stab', { notes: CH[chordIx(b)], v: 0.045 });
    for (let i = 0; i < (last ? 12 : 16); i++) at(b + i / 16, 'pluck', { m: CH[chordIx(b)][ARP[i % 8]] + 12 + (i % 4 === 3 ? 12 : 0), v: 0.05, cut: 2800 });
  }
  at(38, 'pad', { dur: BAR * 2, notes: CH[chordIx(38)], cut: 4200, v: 0.02 });
  at(40, 'pad', { dur: BAR * 1.875, notes: CH[chordIx(40)], cut: 4200, v: 0.02 });
  at(38, 'sub', { dur: BAR * 2, m: ROOT[chordIx(38)] });
  at(40, 'sub', { dur: BAR * 1.875, m: ROOT[chordIx(40)] });
  at(39.3, 'whoosh', { dur: BAR * 0.4 });
  at(39.5, 'crash', { v: 0.25 });
  at(41, 'riser', { dur: BAR * 0.875 });
  for (let i = 0; i < 8; i++) at(41.5 + i / 32, 'snare', { v: 0.35 + i * 0.05 });

  // 42-45: lens ambience — impact, wide pads, sparse delayed plucks, air
  at(42, 'impact', { v: 0.8 }); at(42, 'crash', { v: 0.22 });
  at(42, 'swell', { dur: BAR * 0.35, v: 0.2 });
  at(42, 'pad', { dur: BAR * 2, notes: [50, 57, 62, 65, 69, 76], cut: 2600, v: 0.026 });
  at(44, 'pad', { dur: BAR, notes: [46, 53, 58, 62, 69], cut: 2200, v: 0.026 });
  at(42, 'sub', { dur: BAR * 3, m: 38 });
  at(42, 'air', { dur: BAR * 3, v: 0.03 });
  for (let b = 42; b < 45; b++) for (let i = 0; i < 8; i += 2) at(b + i / 8 + (b === 44 ? 1 / 16 : 0), 'pluck', { m: CH[chordIx(b)][ARP[(i + b) % 8]] + 24, v: 0.045, cut: 2000 });
  [42.25, 42.5, 42.75].forEach((b, i) => at(b, 'blip', { f: 1320 + i * 440, v: 0.03 }));
  at(44, 'swell', { dur: BAR, v: 0.22 });

  // 45-47: key visual hit, then let it ring
  at(45, 'impact', { v: 1 }); at(45, 'crash', { v: 0.35 });
  at(45, 'pad', { dur: BAR * 2, notes: [50, 57, 62, 64, 69, 74], cut: 3600, v: 0.024 });
  at(45, 'sub', { dur: BAR * 1.8, m: 38 });
  for (let i = 0; i < 8; i++) at(45 + i / 8, 'pluck', { m: [74, 76, 81, 86, 81, 76, 74, 69][i], v: 0.05 - i * 0.004, cut: 3000 });
  at(45, 'kick', { v: 0.8 });

  // 47-51: slates — one soft chime per slate, otherwise silence
  for (let k = 0; k < 3; k++) {
    const b = 47 + (k * 4) / 3 + 0.08;
    at(b, 'pluck', { m: 81, v: 0.03, cut: 2400 });
    at(b + 1 / 16, 'pluck', { m: 88, v: 0.02, cut: 2400 });
  }

  ev.sort((a, b) => a.t - b.t);
  PV.score = ev;
  PV.hits = { kick: [], snare: [], hat: [], impact: [], blip: [], crash: [] };
  for (const e of ev) if (PV.hits[e.type]) PV.hits[e.type].push(e.t);

  /** master low-pass automation curve (Hz) */
  PV.lpAt = t => {
    const b = t / BAR;
    if (b < 15.875) return lerp(2200, 18000, PV.E.inQ(PV.seg(b, 8, 15.8)));
    if (b < 36) return 18000;
    if (b < 38) return lerp(18000, 1400, PV.E.outQ(PV.seg(b, 36, 38)));
    if (b < 42) return 14000;
    if (b < 45) return lerp(4200, 2600, PV.seg(b, 42, 45));
    if (b < 47) return lerp(12000, 2400, PV.E.inQ(PV.seg(b, 45, 47)));
    return 2400;
  };
  const lerp = PV.lerp;

  /* ---------------- synthesis ---------------- */
  function Graph(ctx) {
    const g = {};
    g.ctx = ctx;
    g.out = ctx.createGain(); g.out.gain.value = 0.7;
    g.comp = ctx.createDynamicsCompressor();
    g.comp.threshold.value = -10; g.comp.ratio.value = 3; g.comp.attack.value = 0.003; g.comp.release.value = 0.15;
    g.lp = ctx.createBiquadFilter(); g.lp.type = 'lowpass'; g.lp.Q.value = 0.9; g.lp.frequency.value = 18000;
    g.lim = ctx.createDynamicsCompressor();
    g.lim.threshold.value = -4; g.lim.knee.value = 0; g.lim.ratio.value = 20; g.lim.attack.value = 0.001; g.lim.release.value = 0.08;
    g.lp.connect(g.comp); g.comp.connect(g.out); g.out.connect(g.lim); g.lim.connect(ctx.destination);
    g.drums = ctx.createGain(); g.drums.gain.value = 1.25; g.drums.connect(g.lp);
    g.music = ctx.createGain(); g.music.connect(g.lp);
    g.fxb = ctx.createGain(); g.fxb.gain.value = 0.9; g.fxb.connect(g.lp);
    // reverb
    const len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c), r = PV.rng(7 + c);
      for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    g.verb = ctx.createConvolver(); g.verb.buffer = ir;
    g.verbIn = ctx.createGain(); g.verbIn.gain.value = 0.5;
    g.verbIn.connect(g.verb); g.verb.connect(g.lp);
    // 3/16 ping delay
    g.dly = ctx.createDelay(1); g.dly.delayTime.value = S16 * 3;
    g.dfb = ctx.createGain(); g.dfb.gain.value = 0.38;
    g.dIn = ctx.createGain();
    const dlp = ctx.createBiquadFilter(); dlp.frequency.value = 3200;
    g.dIn.connect(g.dly); g.dly.connect(dlp); dlp.connect(g.dfb); g.dfb.connect(g.dly);
    dlp.connect(g.music); dlp.connect(g.verbIn);
    // noise
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0), r = PV.rng(3);
    for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1;
    g.noiseBuf = nb;
    g.shaper = n => {
      const s = ctx.createWaveShaper(), k = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = (i / 511.5) - 1; k[i] = Math.tanh(x * n); }
      s.curve = k; return s;
    };
    return g;
  }

  const I = {};
  function env(ctx, when, a, peak, d, off = 0) {
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, when);
    if (off > a) gn.gain.setValueAtTime(peak, when);
    else gn.gain.exponentialRampToValueAtTime(peak, when + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(a, 0.01) + d);
    return gn;
  }
  function noise(g, when, dur) {
    const s = g.ctx.createBufferSource();
    s.buffer = g.noiseBuf; s.loop = true;
    s.start(when, Math.random() * 1.5); s.stop(when + dur + 0.05);
    return s;
  }
  function osc(ctx, type, f, when, dur) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, when);
    o.start(when); o.stop(when + dur + 0.05);
    return o;
  }

  I.kick = (g, w, e) => {
    const c = g.ctx, o = osc(c, 'sine', 170, w, 0.5);
    o.frequency.exponentialRampToValueAtTime(44, w + 0.13);
    const a = env(c, w, 0.002, e.v, 0.42);
    o.connect(a); a.connect(g.drums);
    const n = noise(g, w, 0.02), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    const na = env(c, w, 0.001, e.v * 0.25, 0.015);
    n.connect(hp); hp.connect(na); na.connect(g.drums);
    // sidechain duck on the music bus
    g.music.gain.setTargetAtTime(0.35, w, 0.004);
    g.music.gain.setTargetAtTime(1, w + 0.04, 0.09);
  };
  I.snare = (g, w, e) => {
    const c = g.ctx, n = noise(g, w, 0.3);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
    const a = env(c, w, 0.001, e.v * 0.9, 0.2);
    n.connect(bp); bp.connect(a); a.connect(g.drums);
    const s = c.createGain(); s.gain.value = 0.25; a.connect(s); s.connect(g.verbIn);
    const n2 = noise(g, w, 0.2), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    const a2 = env(c, w, 0.001, e.v * 0.5, 0.12); n2.connect(hp); hp.connect(a2); a2.connect(g.drums);
    const o = osc(c, 'triangle', 210, w, 0.15); o.frequency.exponentialRampToValueAtTime(160, w + 0.08);
    const oa = env(c, w, 0.001, e.v * 0.5, 0.09);
    o.connect(oa); oa.connect(g.drums);
  };
  I.hat = (g, w, e) => {
    const c = g.ctx, n = noise(g, w, e.open ? 0.3 : 0.06);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7800;
    const a = env(c, w, 0.001, e.v, e.open ? 0.17 : 0.035);
    n.connect(hp); hp.connect(a); a.connect(g.drums);
  };
  I.crash = (g, w, e) => {
    const c = g.ctx, n = noise(g, w, 2);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4200;
    const a = env(c, w, 0.002, e.v, 1.7);
    n.connect(hp); hp.connect(a); a.connect(g.drums); a.connect(g.verbIn);
  };
  I.impact = (g, w, e) => {
    const c = g.ctx, o = osc(c, 'sine', 78, w, 1.5);
    o.frequency.exponentialRampToValueAtTime(27, w + 0.9);
    const a = env(c, w, 0.004, e.v * 0.8, 1.3);
    o.connect(a); a.connect(g.fxb);
    const n = noise(g, w, 0.8), lp = c.createBiquadFilter(); lp.frequency.value = 500;
    const na = env(c, w, 0.002, e.v * 0.4, 0.6);
    n.connect(lp); lp.connect(na); na.connect(g.fxb); na.connect(g.verbIn);
  };
  I.swell = (g, w, e) => {
    const c = g.ctx, n = noise(g, w, e.dur);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, w); bp.frequency.exponentialRampToValueAtTime(7000, w + e.dur);
    const a = c.createGain(); a.gain.setValueAtTime(0.0001, w);
    a.gain.exponentialRampToValueAtTime(e.v, w + e.dur * 0.97); a.gain.linearRampToValueAtTime(0, w + e.dur);
    n.connect(bp); bp.connect(a); a.connect(g.fxb); a.connect(g.verbIn);
  };
  I.air = (g, w, e, off) => {
    const c = g.ctx, dur = e.dur - off, n = noise(g, w, dur);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    const a = c.createGain(); a.gain.setValueAtTime(0.0001, w);
    a.gain.exponentialRampToValueAtTime(e.v, w + 0.8); a.gain.setValueAtTime(e.v, w + dur - 0.8);
    a.gain.exponentialRampToValueAtTime(0.0001, w + dur);
    n.connect(hp); hp.connect(a); a.connect(g.fxb); a.connect(g.verbIn);
  };
  I.riser = (g, w, e) => {
    const c = g.ctx, n = noise(g, w, e.dur);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(400, w); bp.frequency.exponentialRampToValueAtTime(9000, w + e.dur);
    const a = c.createGain(); a.gain.setValueAtTime(0.0001, w);
    a.gain.exponentialRampToValueAtTime(0.22, w + e.dur); a.gain.setValueAtTime(0, w + e.dur);
    n.connect(bp); bp.connect(a); a.connect(g.fxb);
    const o = osc(c, 'sawtooth', 110, w, e.dur);
    o.frequency.exponentialRampToValueAtTime(880, w + e.dur);
    const oa = c.createGain(); oa.gain.setValueAtTime(0.0001, w);
    oa.gain.exponentialRampToValueAtTime(0.03, w + e.dur); oa.gain.setValueAtTime(0, w + e.dur);
    o.connect(oa); oa.connect(g.fxb); oa.connect(g.verbIn);
  };
  I.whoosh = (g, w, e) => {
    const c = g.ctx, n = noise(g, w, e.dur);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(600, w);
    bp.frequency.exponentialRampToValueAtTime(4200, w + e.dur * 0.5);
    bp.frequency.exponentialRampToValueAtTime(400, w + e.dur);
    const a = c.createGain(); a.gain.setValueAtTime(0.0001, w);
    a.gain.exponentialRampToValueAtTime(0.3, w + e.dur * 0.5);
    a.gain.exponentialRampToValueAtTime(0.0001, w + e.dur);
    n.connect(bp); bp.connect(a); a.connect(g.fxb); a.connect(g.verbIn);
  };
  I.pad = (g, w, e, off) => {
    const c = g.ctx, dur = e.dur - off;
    const lp = c.createBiquadFilter(); lp.frequency.value = e.cut; lp.Q.value = 0.6;
    const a = c.createGain();
    a.gain.setValueAtTime(0.0001, w);
    a.gain.exponentialRampToValueAtTime(e.v, w + Math.max(0.02, 0.5 - off));
    a.gain.setValueAtTime(e.v, w + dur - 0.3);
    a.gain.exponentialRampToValueAtTime(0.0001, w + dur + 0.4);
    for (const m of e.notes) for (const d of [-9, 9]) {
      const o = osc(c, 'sawtooth', mtof(m), w, dur + 0.5); o.detune.value = d; o.connect(lp);
    }
    lp.connect(a); a.connect(g.music);
    const s = c.createGain(); s.gain.value = 0.6; a.connect(s); s.connect(g.verbIn);
  };
  I.sub = (g, w, e, off) => {
    const c = g.ctx, dur = e.dur - off, o = osc(c, 'sine', mtof(e.m), w, dur);
    const a = c.createGain();
    a.gain.setValueAtTime(0.0001, w);
    a.gain.exponentialRampToValueAtTime(0.16, w + 0.05);
    a.gain.setValueAtTime(0.16, w + dur - 0.1);
    a.gain.exponentialRampToValueAtTime(0.0001, w + dur);
    o.connect(a); a.connect(g.music);
  };
  I.glide = (g, w, e, off) => {
    const c = g.ctx, dur = e.dur - off, o = osc(c, 'sine', mtof(e.m), w, dur);
    const curve = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      const x = off / e.dur + (i / 63) * (dur / e.dur);
      curve[i] = mtof(e.m + 12 * Math.pow(Math.sin(Math.PI * PV.clamp(x * 1.25 - 0.1)), 2));
    }
    o.frequency.setValueCurveAtTime(curve, w, dur);
    const sh = g.shaper(2.2), a = c.createGain();
    a.gain.setValueAtTime(0.0001, w);
    a.gain.exponentialRampToValueAtTime(0.17, w + 0.05);
    a.gain.setValueAtTime(0.17, w + dur - 0.1);
    a.gain.exponentialRampToValueAtTime(0.0001, w + dur);
    o.connect(sh); sh.connect(a); a.connect(g.music);
  };
  I.reese = (g, w, e, off) => {
    const c = g.ctx, dur = e.dur - off, f = mtof(e.m);
    const lp = c.createBiquadFilter(); lp.frequency.value = 900; lp.Q.value = 4;
    const lfo = osc(c, 'sine', PV.BPM / 60, w, dur), ld = c.createGain(); ld.gain.value = 700;
    lfo.connect(ld); ld.connect(lp.frequency);
    const sh = g.shaper(3), a = c.createGain();
    a.gain.setValueAtTime(0.0001, w);
    a.gain.exponentialRampToValueAtTime(0.12, w + 0.02);
    a.gain.setValueAtTime(0.12, w + dur - 0.05);
    a.gain.exponentialRampToValueAtTime(0.0001, w + dur);
    for (const d of [-14, 14]) { const o = osc(c, 'sawtooth', f, w, dur); o.detune.value = d; o.connect(sh); }
    sh.connect(lp); lp.connect(a); a.connect(g.music);
    const so = osc(c, 'sine', f / 2, w, dur), sa = c.createGain();
    sa.gain.setValueAtTime(0.0001, w);
    sa.gain.exponentialRampToValueAtTime(0.15, w + 0.02);
    sa.gain.setValueAtTime(0.15, w + dur - 0.05);
    sa.gain.exponentialRampToValueAtTime(0.0001, w + dur);
    so.connect(sa); sa.connect(g.music);
  };
  I.stab = (g, w, e) => {
    const c = g.ctx, lp = c.createBiquadFilter(); lp.frequency.value = 3400;
    const a = env(c, w, 0.003, e.v, 0.16);
    for (const m of e.notes.slice(0, 4)) { const o = osc(c, 'square', mtof(m + 12), w, 0.25); o.connect(lp); }
    lp.connect(a); a.connect(g.music); a.connect(g.dIn);
  };
  I.pluck = (g, w, e) => {
    const c = g.ctx, lp = c.createBiquadFilter(); lp.frequency.setValueAtTime(e.cut * 2, w);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, e.cut * 0.4), w + 0.2);
    const a = env(c, w, 0.002, e.v, 0.28);
    const o1 = osc(c, 'triangle', mtof(e.m), w, 0.35), o2 = osc(c, 'square', mtof(e.m + 12), w, 0.35);
    const m2 = c.createGain(); m2.gain.value = 0.25;
    o1.connect(lp); o2.connect(m2); m2.connect(lp);
    lp.connect(a); a.connect(g.music); a.connect(g.dIn);
  };
  I.blip = (g, w, e) => {
    const c = g.ctx, o = osc(c, 'sine', e.f, w, 0.08), a = env(c, w, 0.001, e.v, 0.05);
    o.connect(a); a.connect(g.fxb); a.connect(g.dIn);
  };

  const LONG = new Set(['pad', 'sub', 'glide', 'reese', 'air']);
  /** schedule every event in [from, to) of score time; t0 = context time of score time 0 */
  function scheduleRange(g, from, to, t0) {
    for (const e of ev) {
      const end = e.t + (e.dur || 0);
      if (e.t >= to) break;
      if (e.t >= from) I[e.type](g, t0 + e.t, e, 0);
      else if (LONG.has(e.type) && end > from + 0.05) I[e.type](g, t0 + from, e, from - e.t);
    }
  }

  /* realtime player with lookahead scheduling (seek = rebuild context) */
  PV.Audio = class {
    constructor() { this.ctx = null; this.pos = 0; this.playing = false; this.muted = false; }
    now() { return this.playing ? this.ctx.currentTime - this.t0 : this.pos; }
    play(from = this.pos) {
      this.stop(true);
      const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const g = (this.g = Graph(ctx));
      g.out.gain.value = this.muted ? 0 : 0.7;
      this.t0 = ctx.currentTime + 0.08 - from;
      this.cursor = from;
      this.playing = true;
      const tick = () => {
        const target = ctx.currentTime - this.t0 + 0.5;
        if (target > this.cursor) {
          scheduleRange(g, this.cursor, target, this.t0);
          for (let t = this.cursor; t < target; t += 0.05)
            g.lp.frequency.linearRampToValueAtTime(PV.lpAt(t), Math.max(ctx.currentTime, this.t0 + t));
          if (this.cursor === from) g.lp.frequency.setValueAtTime(PV.lpAt(from), ctx.currentTime);
          this.cursor = target;
        }
      };
      tick();
      this.timer = setInterval(tick, 60);
    }
    stop(keepPos) {
      if (this.ctx) {
        if (!keepPos) this.pos = this.now();
        clearInterval(this.timer);
        this.ctx.close();
        this.ctx = null;
      }
      this.playing = false;
    }
    pause() { this.pos = this.now(); this.stop(true); }
    seek(t) { this.pos = PV.clamp(t, 0, PV.LENGTH); if (this.playing) this.play(this.pos); }
    setMuted(m) { this.muted = m; if (this.g) this.g.out.gain.value = m ? 0 : 0.7; }
  };

  /** offline render (used for verification / export) → AudioBuffer */
  PV.renderOffline = async function (sr = 44100) {
    const ctx = new OfflineAudioContext(2, Math.ceil((PV.LENGTH + 1) * sr), sr);
    const g = Graph(ctx);
    scheduleRange(g, 0, PV.LENGTH + 1, 0);
    for (let t = 0; t < PV.LENGTH; t += 0.05) g.lp.frequency.linearRampToValueAtTime(PV.lpAt(t), t);
    return ctx.startRendering();
  };
})();
