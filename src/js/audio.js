// The score. Every sound is synthesised here, sample by sample.
// KintsugiSynth is self-contained so it can run inside a Worker (built from its
// own source text); it returns dry and reverb-send stereo stems.
function KintsugiSynth(SR, C, report, W0 = 0, W1 = 1e9) {
  const BAR = C.bar, BEAT = BAR / 4;
  const DUR = C.duration + 8;
  // this worker renders only events starting in [W0, W1); stems cover [W0, W1 + TAIL)
  const TAIL = 36;
  W1 = Math.min(W1, DUR);
  const OFF = Math.floor(W0 * SR);
  const N = Math.ceil((Math.min(W1 + TAIL, DUR) - W0) * SR);
  const inW = t => t >= W0 && t < W1;
  const dL = new Float32Array(N), dR = new Float32Array(N);
  const wL = new Float32Array(N), wR = new Float32Array(N);
  const TAU = Math.PI * 2;
  const B = b => b * BAR;                      // bar -> seconds
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // two generators: composition (identical in every worker) and audio-rate noise
  let seed = 0x2545F491, seedN = 0x1234567;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296); };
  const rndN = () => { seedN ^= seedN << 13; seedN ^= seedN >>> 17; seedN ^= seedN << 5; return ((seedN >>> 0) / 4294967296); };
  const rr = (a, b) => a + (b - a) * rnd();
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(name) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    let v = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return v + (+m[3] + 1) * 12;
  }
  // "A4:2 C5:1 r:1" -> [{beat, midi, dur}]
  function parse(str) {
    const out = []; let b = 0;
    for (const tok of str.trim().split(/\s+/)) {
      if (tok === '|') continue;
      const [n, d] = tok.split(':'); const dur = +d;
      if (n !== 'r') out.push({ beat: b, midi: midi(n), dur });
      b += dur;
    }
    return out;
  }

  // ---------------------------------------------------------------- mixing
  function mix(buf, t, gain, pan, send) {
    const i0 = Math.round(t * SR) - OFF;
    const a = (pan + 1) * Math.PI / 4;
    const gl = Math.cos(a) * gain, gr = Math.sin(a) * gain;
    const n = Math.min(buf.length, N - i0);
    for (let k = Math.max(0, -i0); k < n; k++) {
      const s = buf[k], i = i0 + k;
      dL[i] += s * gl; dR[i] += s * gr;
      wL[i] += s * gl * send; wR[i] += s * gr * send;
    }
  }
  // stereo variant
  function mix2(bl, br, t, gain, send) {
    const i0 = Math.round(t * SR) - OFF;
    const n = Math.min(bl.length, N - i0);
    for (let k = Math.max(0, -i0); k < n; k++) {
      const i = i0 + k;
      dL[i] += bl[k] * gain; dR[i] += br[k] * gain;
      wL[i] += bl[k] * gain * send; wR[i] += br[k] * gain * send;
    }
  }

  // ---------------------------------------------------------------- filters
  function biquad(type, f, q) {
    const w = TAU * Math.min(f, SR * 0.45) / SR, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; } // bp
    const f_ = { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
    f_.run = x => { const y = f_.b0 * x + f_.b1 * f_.x1 + f_.b2 * f_.x2 - f_.a1 * f_.y1 - f_.a2 * f_.y2; f_.x2 = f_.x1; f_.x1 = x; f_.y2 = f_.y1; f_.y1 = y; return y; };
    f_.set = (f2, q2) => { const g = biquad(type, f2, q2); f_.b0 = g.b0; f_.b1 = g.b1; f_.b2 = g.b2; f_.a1 = g.a1; f_.a2 = g.a2; };
    return f_;
  }
  const white = () => rndN() * 2 - 1;

  // ---------------------------------------------------------------- wavetables (band-limited saw)
  const TBL = 2048, tables = [];
  for (let o = 0; o < 9; o++) {
    const fTop = mtof(24 + o * 12 + 12);
    const H = Math.max(1, Math.floor(17000 / fTop));
    const t = new Float32Array(TBL + 1);
    for (let h = 1; h <= H; h++) {
      const g = 1 / h * (h > H * 0.7 ? (H - h) / (H * 0.3) : 1);
      for (let i = 0; i <= TBL; i++) t[i] += g * Math.sin(TAU * h * i / TBL);
    }
    for (let i = 0; i <= TBL; i++) t[i] *= 0.55;
    tables.push(t);
  }
  const tableFor = m => tables[Math.max(0, Math.min(8, Math.floor((m - 24) / 12)))];

  // ================================================================ INSTRUMENTS
  // shakuhachi: sine core + breath through a resonant band, meri-kari bend, vibrato
  // (pitch and envelope are computed at control rate, every 32 samples)
  function shaku(t, dur, m, vel, pan = 0.1, opts = {}) {
    if (!inW(t)) return;
    const len = dur + 0.7, n = Math.floor(len * SR);
    const buf = new Float32Array(n);
    const f0 = mtof(m);
    const bp = biquad('bp', f0, 6), bp2 = biquad('bp', f0 * 2, 9), hp = biquad('hp', 2500, 0.7);
    const att = opts.attack || 0.1;
    const breath = opts.breath == null ? 1 : opts.breath;
    let ph = 0, inc = 0, env = 0, chiffE = 1;
    const chiffD = Math.exp(-1 / (0.05 * SR));
    for (let i = 0; i < n; i++) {
      if ((i & 31) === 0) {
        const x = i / SR;
        const bend = -0.6 * Math.exp(-x / 0.09) + (opts.fall && x > dur - 0.25 ? -1.5 * ((x - dur + 0.25) / 0.25) ** 2 : 0);
        const vib = Math.min(1, Math.max(0, (x - dur * 0.35) / 0.6)) * 0.22 * Math.sin(TAU * 5.1 * x + 0.3 * Math.sin(TAU * 0.7 * x));
        inc = TAU * f0 * Math.pow(2, (bend + vib) / 12) / SR;
        env = Math.min(1, x / att) * (x < dur ? 1 : Math.exp(-(x - dur) / 0.12));
        env *= 0.85 + 0.15 * Math.sin(Math.PI * Math.min(1, x / Math.max(dur, 0.01)));
      }
      ph += inc;
      const s1 = Math.sin(ph), c1 = Math.cos(ph);
      const core = s1 + 0.22 * (2 * s1 * c1) + 0.06 * s1 * (3 - 4 * s1 * s1);
      const nz = white();
      const air = bp.run(nz) * 0.9 + bp2.run(nz) * 0.25;
      const chiff = hp.run(nz) * chiffE * 0.9 * breath; chiffE *= chiffD;
      buf[i] = env * (core * 0.55 + air * 0.9 * breath) + chiff * Math.min(1, i / (0.005 * SR));
    }
    mix(buf, t, vel * 0.15, pan, 0.55);
  }

  // koto: Karplus-Strong with fractional delay, pluck-position comb, optional bend
  function koto(t, m, vel, pan = -0.2, opts = {}) {
    if (!inW(t)) return;
    const len = opts.len || 3.2, n = Math.floor(len * SR);
    const buf = new Float32Array(n);
    const f0 = mtof(m);
    const maxL = Math.ceil(SR / f0 * 1.3) + 4;
    const line = new Float32Array(maxL);
    let D = SR / f0;
    const exc = new Float32Array(maxL);
    const lp = biquad('lp', 2000 + 6000 * vel, 0.7);
    for (let i = 0; i < maxL; i++) exc[i] = lp.run(white());
    const pp = Math.floor(D * 0.14);
    for (let i = 0; i < Math.floor(D); i++) line[i] = exc[i] - (i >= pp ? exc[i - pp] : 0) * 0.9;
    let w = Math.floor(D) % maxL, prev = 0;
    const g = Math.pow(0.001, 1 / (f0 * (opts.decay || (2.2 + 180 / f0))));
    // body resonance, inlined biquad
    const bq = biquad('bp', 260, 1.2);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const { b0, b2, a1, a2 } = bq;
    for (let i = 0; i < n; i++) {
      if ((i & 31) === 0) {
        const x = i / SR;
        let semis = 0.12 * Math.exp(-x / 0.03);
        if (opts.bend && x > opts.bend[0]) semis += opts.bend[1] * Math.min(1, (x - opts.bend[0]) / 0.14);
        D = SR / (f0 * Math.pow(2, semis / 12)) - 0.5;   // the averaging filter adds half a sample
      }
      let rp = w - D; if (rp < 0) rp += maxL;
      const i0 = rp | 0, fr = rp - i0;
      const j1 = i0 + 1 === maxL ? 0 : i0 + 1;
      const y = line[i0] * (1 - fr) + line[j1] * fr;
      line[w] = g * (0.5 * y + 0.5 * prev);
      prev = y;
      w++; if (w === maxL) w = 0;
      const by = b0 * y + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = y; y2 = y1; y1 = by;
      buf[i] = y + by * 0.35;
    }
    for (let i = n - 2000; i < n; i++) if (i >= 0) buf[i] *= (n - i) / 2000;
    mix(buf, t, vel * 0.3, pan, 0.4);
  }

  // felt piano: inharmonic additive partials (recursive oscillators), unison beating, hammer
  function piano(t, dur, m, vel, pan = 0, send = 0.45) {
    if (!inW(t)) return;
    const f0 = mtof(m);
    const len = Math.min(dur + 1.2, 9), n = Math.floor(len * SR);
    const buf = new Float32Array(n);
    const Bc = 0.0004 * Math.pow(2, (m - 60) / 24);
    const K = Math.max(3, Math.min(14, Math.floor(7000 / f0)));
    const soft = 1 - vel;
    for (let k = 1; k <= K; k++) {
      const fk = k * f0 * Math.sqrt(1 + Bc * k * k);
      if (fk > SR * 0.45) break;
      const amp = Math.pow(k, -1.15) * Math.exp(-(k - 1) * (0.25 + soft * 0.5)) * (k === 1 ? 1 : 0.9);
      const tauS = (1.2 + 7.0 * Math.exp(-(m - 36) / 30)) / (1 + 0.25 * k);
      const tauF = tauS * 0.18;
      const strings = k <= 2 ? [-0.9, 0.8] : [0];
      for (const c of strings) {
        const w = TAU * fk * Math.pow(2, c / 1200) / SR;
        const cw = 2 * Math.cos(w);
        let y1 = Math.sin(-w), y2 = Math.sin(-2 * w);
        const dS = Math.exp(-1 / (tauS * SR)), dF = Math.exp(-1 / (tauF * SR));
        let eS = 0.45 * amp / strings.length, eF = 0.55 * amp / strings.length;
        const rel = Math.exp(-1 / (0.18 * SR));
        const ndur = Math.floor(dur * SR);
        const nk = Math.min(n, ndur + Math.floor(0.18 * 9 * SR), Math.floor(tauS * 9 * SR));
        for (let i = 0; i < nk; i++) {
          const y = cw * y1 - y2; y2 = y1; y1 = y;
          buf[i] += y * (eS + eF);
          eS *= dS; eF *= dF;
          if (i > ndur) { eS *= rel; eF *= rel; }
        }
      }
    }
    // hammer thump
    const hl = biquad('lp', 900 + 2500 * vel, 0.8);
    for (let i = 0; i < 0.03 * SR; i++) buf[i] += hl.run(white()) * 0.25 * vel * Math.exp(-i / (0.006 * SR));
    for (let i = 0; i < 64; i++) buf[i] *= i / 64;
    mix(buf, t, vel * 0.32, pan, send);
  }

  // strings / pad: 3 detuned wavetable saws per note, shared lowpass, slow envelopes
  function pad(t, dur, ms, vel, opts = {}) {
    if (!inW(t)) return;
    const att = opts.attack || 1.2, rel = opts.release || 1.8;
    const len = dur + rel, n = Math.floor(len * SR);
    const bl = new Float32Array(n), br = new Float32Array(n);
    const cutoff = opts.cutoff || 1800;
    for (let j = 0; j < ms.length; j++) {
      const m = ms[j], tb = tableFor(m), f0 = mtof(m);
      const det = [-7, 0, 7];
      for (let v = 0; v < 3; v++) {
        let ph = rndN() * TBL;
        const inc0 = f0 * Math.pow(2, det[v] / 1200) * TBL / SR;
        const pan = ((j / Math.max(1, ms.length - 1)) - 0.5) * 0.8 + (v - 1) * 0.25;
        const a = (pan + 1) * Math.PI / 4, gl = Math.cos(a), gr = Math.sin(a);
        const vr = 4.3 + v * 0.37;
        let inc = inc0;
        for (let i = 0; i < n; i++) {
          if ((i & 63) === 0) inc = inc0 * (1 + 0.0028 * Math.sin(TAU * vr * i / SR + v));
          ph += inc; if (ph >= TBL) ph -= TBL;
          const i0 = ph | 0, s = tb[i0] + (tb[i0 + 1] - tb[i0]) * (ph - i0);
          bl[i] += s * gl; br[i] += s * gr;
        }
      }
    }
    const q = biquad('lp', cutoff, 0.6), q2 = biquad('lp', cutoff * 1.4, 0.6);
    const A0 = q.b0, A1 = q.b1, A2 = q.b2, A3 = q.a1, A4 = q.a2;
    const C0 = q2.b0, C1 = q2.b1, C2 = q2.b2, C3 = q2.a1, C4 = q2.a2;
    let l1 = 0, l2 = 0, m1 = 0, m2 = 0, r1 = 0, r2 = 0, s1 = 0, s2 = 0;      // stage-1 state
    let L1 = 0, L2 = 0, M1 = 0, M2 = 0, R1 = 0, R2 = 0, S1 = 0, S2 = 0;      // stage-2 state
    const swell = opts.swell || 0;
    let env = 0;
    for (let i = 0; i < n; i++) {
      if ((i & 31) === 0) {
        const x = i / SR;
        env = Math.min(1, x / att);
        env = env * env * (3 - 2 * env);
        if (x > dur) env *= Math.max(0, 1 - (x - dur) / rel);
        if (swell) env *= 0.3 + 0.7 * Math.min(1, x / dur) ** swell;
        if (opts.trem) env *= 0.75 + 0.25 * Math.sin(TAU * opts.trem * x);
      }
      let x = bl[i];
      let y = A0 * x + A1 * l1 + A2 * l2 - A3 * m1 - A4 * m2; l2 = l1; l1 = x; m2 = m1; m1 = y;
      let z = C0 * y + C1 * L1 + C2 * L2 - C3 * M1 - C4 * M2; L2 = L1; L1 = y; M2 = M1; M1 = z;
      bl[i] = z * env;
      x = br[i];
      y = A0 * x + A1 * r1 + A2 * r2 - A3 * s1 - A4 * s2; r2 = r1; r1 = x; s2 = s1; s1 = y;
      z = C0 * y + C1 * R1 + C2 * R2 - C3 * S1 - C4 * S2; R2 = R1; R1 = y; S2 = S1; S1 = z;
      br[i] = z * env;
    }
    mix2(bl, br, t, vel * 0.065 / Math.sqrt(ms.length), opts.send == null ? 0.6 : opts.send);
  }

  // taiko: pitched membrane drop + skin noise + rim click
  function taiko(t, vel, size = 1, pan = 0) {
    if (!inW(t)) return;
    const len = 1.4, n = Math.floor(len * SR);
    const buf = new Float32Array(n);
    const f0 = 150 / size, f1 = 58 / size;
    const lp = biquad('lp', 500, 0.7), hp = biquad('hp', 3000, 0.7);
    let ph = 0, eB = 1, eP = 1, eS = 1, eC = 1;
    const dB = Math.exp(-1 / (0.38 * size * SR)), dP = Math.exp(-1 / (0.045 * SR)), dS = Math.exp(-1 / (0.07 * SR)), dC = Math.exp(-1 / (0.004 * SR));
    for (let i = 0; i < n; i++) {
      const f = f1 + (f0 - f1) * eP; eP *= dP;
      ph += TAU * f / SR;
      const nz = white();
      const v = Math.sin(ph) * eB * 1.3 + lp.run(nz) * eS * 1.4 + (eC > 1e-4 ? hp.run(nz) * eC * 0.5 : 0);
      eB *= dB; eS *= dS; eC *= dC;
      buf[i] = v / (1 + Math.abs(v) * 0.6);
    }
    mix(buf, t, vel * 0.32, pan, 0.35);
  }

  // rin (temple bowl): inharmonic partial pairs with slow beating, long decay
  function rin(t, m, vel, pan = 0) {
    if (!inW(t)) return;
    const f0 = mtof(m);
    const len = 11, n = Math.floor(len * SR);
    const buf = new Float32Array(n);
    const ratios = [1, 2.71, 5.12, 8.21, 11.9], amps = [1, 0.55, 0.3, 0.16, 0.08], taus = [7.5, 5, 2.8, 1.6, 0.9];
    for (let k = 0; k < ratios.length; k++) {
      for (const d of [-0.35, 0.35]) {
        const w = TAU * (f0 * ratios[k] + d * (k + 1)) / SR;
        const cw = 2 * Math.cos(w); let y1 = Math.sin(-w), y2 = Math.sin(-2 * w);
        let e = amps[k] * 0.5; const dd = Math.exp(-1 / (taus[k] * SR));
        for (let i = 0; i < n; i++) { const y = cw * y1 - y2; y2 = y1; y1 = y; buf[i] += y * e; e *= dd; }
      }
    }
    const hp = biquad('hp', 4000, 0.7);
    for (let i = 0; i < 0.01 * SR; i++) buf[i] += hp.run(white()) * 0.3 * Math.exp(-i / (0.002 * SR));
    for (let i = 0; i < 32; i++) buf[i] *= i / 32;
    mix(buf, t, vel * 0.28, pan, 0.6);
  }

  // music-box / memory bell
  function bell(t, m, vel, pan = 0, send = 0.75) {
    if (!inW(t)) return;
    const f0 = mtof(m), len = 4, n = Math.floor(len * SR);
    const buf = new Float32Array(n);
    const ratios = [1, 2.0, 3.01, 4.17, 5.43], amps = [1, 0.32, 0.12, 0.1, 0.05], taus = [2.6, 1.3, 0.7, 0.45, 0.25];
    for (let k = 0; k < ratios.length; k++) {
      const w = TAU * f0 * ratios[k] / SR; if (f0 * ratios[k] > SR * 0.45) continue;
      const cw = 2 * Math.cos(w); let y1 = Math.sin(-w), y2 = Math.sin(-2 * w);
      let e = amps[k]; const dd = Math.exp(-1 / (taus[k] * SR));
      for (let i = 0; i < n; i++) { const y = cw * y1 - y2; y2 = y1; y1 = y; buf[i] += y * e; e *= dd; }
    }
    for (let i = 0; i < 48; i++) buf[i] *= i / 48;
    mix(buf, t, vel * 0.2, pan, send);
  }

  // glaze crazing ping: tiny glassy tink
  function ping(t, f, vel, pan) {
    if (!inW(t)) return;
    const n = Math.floor(0.6 * SR), buf = new Float32Array(n);
    const ratios = [1, 2.37, 3.93], taus = [0.22, 0.09, 0.05];
    for (let k = 0; k < 3; k++) {
      const w = TAU * f * ratios[k] / SR; if (f * ratios[k] > SR * 0.45) continue;
      const cw = 2 * Math.cos(w); let y1 = Math.sin(-w), y2 = Math.sin(-2 * w);
      let e = 1 / (k + 1); const dd = Math.exp(-1 / (taus[k] * SR));
      for (let i = 0; i < n; i++) { const y = cw * y1 - y2; y2 = y1; y1 = y; buf[i] += y * e; e *= dd; }
    }
    for (let i = 0; i < 16; i++) buf[i] *= i / 16;
    mix(buf, t, vel * 0.12, pan, 0.7);
  }

  // generic noise event: shaped, filtered
  function noise(t, len, env, filt, gain, pan = 0, send = 0.3, stereo = 0) {
    if (!inW(t)) return;
    const n = Math.floor(len * SR), bl = new Float32Array(n), br = new Float32Array(n);
    const q = filt();
    const b0 = q.b0, b1 = q.b1, b2 = q.b2, a1 = q.a1, a2 = q.a2;
    let lx1 = 0, lx2 = 0, ly1 = 0, ly2 = 0, rx1 = 0, rx2 = 0, ry1 = 0, ry2 = 0, e = 0;
    const pa = (pan + 1) * Math.PI / 4, gl = Math.cos(pa) * 1.41, gr = Math.sin(pa) * 1.41;
    const ms = stereo * 0.5;
    for (let i = 0; i < n; i++) {
      if ((i & 15) === 0) e = env(i / SR, len);
      const a = white(), b = white();
      const xl = a * (1 - ms) + b * ms, xr = b * (1 - ms) + a * ms;
      const yl = b0 * xl + b1 * lx1 + b2 * lx2 - a1 * ly1 - a2 * ly2; lx2 = lx1; lx1 = xl; ly2 = ly1; ly1 = yl;
      const yr = b0 * xr + b1 * rx1 + b2 * rx2 - a1 * ry1 - a2 * ry2; rx2 = rx1; rx1 = xr; ry2 = ry1; ry1 = yr;
      bl[i] = yl * e * gl; br[i] = yr * e * gr;
    }
    mix2(bl, br, t, gain, send);
  }

  // ================================================================ MATERIAL
  const THEME_A_D = parse('A4:2 C5:1 D5:1 E5:3 D5:1 C5:1 A4:1 G4:1.5 F4:0.5 G4:2 A4:2');
  const THEME_B_D = parse('A4:2 C5:1 D5:1 F5:2 E5:1 D5:1 C5:1 D5:1 A4:2 D5:4');
  const THEME_A_F = parse('C5:2 E5:1 F5:1 G5:3 F5:1 E5:1 C5:1 B4:1.5 A4:0.5 B4:2 C5:2');
  const THEME_B_F = parse('C5:2 E5:1 F5:1 A5:2 G5:1 F5:1 E5:1 F5:1 C5:2 F5:4');
  const COUNTER = parse('F4:3 E4:1 D4:2 F4:2 E4:2 C4:2 E4:4 F4:3 G4:1 F4:2 D4:2 C4:2 F4:2 F4:4');
  const CH = {
    Dm: [50, 57, 62, 64, 65, 69], Bbmaj7: [46, 53, 57, 62, 65], C: [48, 55, 62, 64, 67], Am: [45, 52, 57, 60, 64],
    F: [41, 48, 57, 60, 65], Gm: [43, 50, 58, 62, 65], CE: [40, 48, 55, 62, 64], Dm7: [38, 50, 57, 60, 65],
    G: [43, 50, 59, 62, 67], A: [45, 52, 57, 61, 64], Asus: [45, 52, 57, 62, 64], D: [38, 50, 57, 62, 66, 69],
    Bb: [46, 53, 58, 62, 65], Gm7: [43, 50, 58, 62, 65],
  };
  const PROG_D = ['Dm', 'Bbmaj7', 'C', 'Am'];
  const PROG_D2 = ['Dm', 'Bbmaj7', 'F', 'Dm'];

  function melody(bar0, notes, inst, vel, opts = {}) {
    for (const nt of notes) {
      const t = B(bar0) + nt.beat * BEAT;
      const d = nt.dur * BEAT;
      const m = nt.midi + (opts.oct || 0) * 12;
      const v = vel * (opts.dyn ? opts.dyn(nt.beat) : 1) * (0.92 + 0.16 * rnd());
      if (inst === 'shaku') shaku(t + rr(0, 0.02), d * 0.97, m, v, opts.pan ?? 0.12, { breath: opts.breath ?? 1, fall: nt.dur >= 4 });
      else if (inst === 'koto') koto(t, m, v, opts.pan ?? -0.25, { bend: nt.dur >= 3 ? [d * 0.45, 2] : null, len: Math.max(2.5, d + 1.5) });
      else if (inst === 'piano') piano(t, d, m, v, opts.pan ?? 0, opts.send ?? 0.45);
      else if (inst === 'bell') bell(t, m, v, opts.pan ?? 0);
    }
  }
  function kotoArp(bar0, bars, prog, vel, opts = {}) {
    const pat = opts.pat || [0, 2, 3, 4, 5, 4, 3, 2];
    const step = opts.step || 0.5;
    for (let b = 0; b < bars; b++) {
      const ch = CH[prog[b % prog.length]];
      for (let k = 0; k < 4 / step; k++) {
        const idx = pat[k % pat.length];
        if (idx < 0) continue;
        const m = ch[Math.min(ch.length - 1, idx)] + (opts.oct || 0) * 12;
        const t = B(bar0 + b) + k * step * BEAT + rr(0, 0.012);
        koto(t, m, vel * (k === 0 ? 1.1 : 0.8 + 0.2 * rnd()), (k % 2 ? 0.35 : -0.35) * (opts.width ?? 1), { len: 2.2 });
      }
    }
  }
  function padProg(bar0, bars, prog, vel, opts = {}) {
    for (let b = 0; b < bars; b++) {
      const ch = CH[prog[b % prog.length]].map(m => m + (opts.oct || 0) * 12);
      pad(B(bar0 + b), BAR * 1.02, ch, vel, Object.assign({ attack: 0.9, release: 1.6 }, opts));
    }
  }
  function pianoChords(bar0, bars, prog, vel, opts = {}) {
    for (let b = 0; b < bars; b++) {
      const ch = CH[prog[b % prog.length]];
      const t = B(bar0 + b);
      piano(t, BAR * 0.9, ch[0], vel * 0.9, -0.2);
      const upper = ch.slice(2);
      upper.forEach((m, i) => piano(t + BEAT * (opts.roll ? 0.12 * (i + 1) : 0) + (opts.half ? 0 : BEAT), BAR * 0.8, m, vel * 0.55, 0.1 + i * 0.1));
      if (opts.half) upper.forEach((m, i) => piano(t + BEAT * 2 + 0.05 * i, BAR * 0.4, m, vel * 0.45, 0.1 + i * 0.1));
    }
  }

  let progressDone = 0;
  const step = (x) => { progressDone = x; report && report(x); };

  // ================================================================ 0. ENSO (bars 0-6)
  rin(B(0) + 0.3, 62 + 12, 0.55, 0);
  pad(B(0.8), B(5.4), [38, 45], 0.25, { attack: 4, release: 3, cutoff: 380, send: 0.5 });
  melody(1, THEME_A_D, 'shaku', 0.95, { pan: 0.08 });
  // brush on paper follows the stroke
  noise(C.brush0, C.brush1 - C.brush0 + 0.4, (x, L) => Math.sin(Math.PI * Math.min(1, x / L)) ** 1.5 * (0.7 + 0.3 * Math.sin(x * 23)) * (1 - 0.6 * (x / L > 0.8 ? (x / L - 0.8) * 5 : 0)),
    () => biquad('bp', 3200, 0.9), 0.05, -0.1, 0.2, 0.3);
  // breath swell into the clay
  noise(B(5.2), BAR * 0.85, (x, L) => (x / L) ** 2, () => biquad('bp', 900, 1.5), 0.05, 0.1, 0.5);
  step(0.08);

  // ================================================================ 1. CLAY (bars 6-17)
  kotoArp(6, 2, PROG_D, 0.5, { pat: [0, -1, 3, -1, 4, -1, 3, -1] });
  kotoArp(8, 8, PROG_D, 0.55);
  padProg(6, 11, PROG_D, 0.55, { cutoff: 1400 });
  melody(9, THEME_A_D, 'koto', 0.95, { pan: 0.15 });
  melody(13, THEME_B_D, 'koto', 0.95, { pan: 0.15 });
  melody(13, THEME_B_D, 'shaku', 0.35, { oct: -1, breath: 0.6, pan: -0.3 });
  // wheel hum (motor + rotation) following the wheel's speed
  if (inW(C.clay0)) {
    const t0 = C.clay0, t1 = C.clay0 + 23, n = Math.floor((t1 - t0) * SR);
    const buf = new Float32Array(n); let ph = 0, ph2 = 0;
    const lp = biquad('lp', 300, 0.8), bp = biquad('bp', 900, 2.0);
    for (let i = 0; i < n; i++) {
      const x = i / SR;
      const sp = x < 18 ? 1 : x < 21.5 ? 1 - ((x - 18) / 3.5) ** 0.8 : 0;
      ph += TAU * 46 * (0.5 + 0.5 * sp) / SR; ph2 += TAU * 1.6 * sp / SR;
      const hum = (Math.sin(ph) * 0.6 + Math.sin(2 * ph) * 0.2) * sp;
      const rumble = lp.run(white()) * 0.8 * sp;
      // wet clay under hands: squish swells that follow the rotation while shaping
      const shaping = (x > 3.5 && x < 18) ? 0.5 + 0.5 * Math.sin(ph2) : 0;
      const squish = bp.run(white()) * shaping * (0.5 + 0.5 * Math.sin(x * 1.7)) * 1.2;
      const fade = Math.min(1, x / 1.5) * Math.min(1, (n / SR - x) / 1.0);
      buf[i] = (hum * 0.25 + rumble * 0.5 + squish * 0.6) * fade;
    }
    mix(buf, t0, 0.22, 0.0, 0.15);
  }
  // wheel stops: a soft wooden knock and the room breathes
  noise(C.clay0 + 21.6, 1.2, x => Math.exp(-x / 0.05), () => biquad('bp', 220, 3), 0.2, 0.0, 0.3);
  // drone swells into the fire
  pad(B(15), BAR * 2.2, [38, 45, 50], 0.8, { attack: 5, release: 1.5, cutoff: 700, swell: 2 });
  step(0.25);

  // ================================================================ 2. FIRE (bars 17-29)
  taiko(B(17), 1.0, 1.25);
  for (let b = 17; b < 21; b++) { taiko(B(b), 0.85, 1.2, -0.1); if (b >= 19) taiko(B(b) + 2 * BEAT, 0.6, 1.0, 0.2); }
  for (let b = 21; b < 23; b++) for (const k of [0, 1.5, 2, 3, 3.5]) taiko(B(b) + k * BEAT, k === 0 ? 0.95 : 0.6, k === 0 ? 1.2 : 0.9, (k % 2 ? 0.3 : -0.3));
  for (let b = 23; b < 25; b++) for (let k = 0; k < 16; k++) taiko(B(b) + k * BEAT / 4, 0.35 + 0.5 * ((b - 23) * 16 + k) / 32, 0.85, (k % 2 ? 0.35 : -0.35));
  taiko(C.firePeak, 1.3, 1.5, 0); taiko(C.firePeak + 0.02, 1.0, 0.8, 0.3);
  // low strings ostinato
  {
    const ost = [50, 50, 53, 52, 50, 50, 48, 50];
    for (let b = 17; b < 25; b++) for (let k = 0; k < 8; k++) {
      pad(B(b) + k * BEAT / 2, BEAT * 0.42, [ost[k] - 12, ost[k]], 0.5 + 0.35 * (b - 17) / 8, { attack: 0.02, release: 0.15, cutoff: 900 + 250 * (b - 17), send: 0.3 });
    }
  }
  // brass-like swells, growing dissonance
  pad(B(19), BAR * 2, [50, 57, 62, 65], 1.0, { attack: 2.5, cutoff: 1500, swell: 1.5 });
  pad(B(21), BAR * 2, [46, 53, 58, 62, 65], 1.2, { attack: 2.0, cutoff: 2000, swell: 1.5 });
  pad(B(23), C.firePeak - B(23), [45, 51, 57, 58, 63, 64], 1.6, { attack: 3.0, cutoff: 2600, swell: 2.5 });
  // the fire itself
  if (inW(C.fire0)) {
    const t0 = C.fire0, t1 = C.fire0 + 32, n = Math.floor((t1 - t0) * SR);
    const bl = new Float32Array(n), br = new Float32Array(n);
    const lpl = biquad('lp', 400, 0.7), lpr = biquad('lp', 400, 0.7);
    let bn1 = 0, bn2 = 0;
    for (let i = 0; i < n; i++) {
      const x = i / SR;
      const k = x < 5 ? 0.35 + 0.65 * x / 5 : x < 26 ? 1 : Math.max(0, 1 - (x - 26) / 4) ** 2;
      if (i % 256 === 0) { lpl.set(250 + 900 * k, 0.7); lpr.set(260 + 900 * k, 0.7); }
      bn1 = bn1 * 0.985 + white() * 0.15; bn2 = bn2 * 0.985 + white() * 0.15;
      const flick = 0.75 + 0.25 * Math.sin(x * 3.1 + Math.sin(x * 1.3) * 2);
      bl[i] = lpl.run(bn1) * k * flick * 2.2; br[i] = lpr.run(bn2) * k * flick * 2.2;
    }
    mix2(bl, br, t0, 0.11, 0.25);
    // crackles: resinous wood pops
    for (let i = 0; i < 200; i++) {
      const x = rr(0, 29), k = x < 5 ? 0.4 : x < 26 ? 1 : 0.2;
      if (rnd() > k) continue;
      noise(t0 + x, 0.03, y => Math.exp(-y / 0.004), () => biquad('bp', rr(1500, 5000), 2), rr(0.05, 0.25), rr(-0.8, 0.8), 0.2);
    }
  }
  // peak: a great exhale of flame
  noise(C.firePeak - 1.5, 4.5, (x) => (x < 1.5 ? (x / 1.5) ** 2 : Math.exp(-(x - 1.5) / 0.9)), () => biquad('lp', 1800, 0.6), 0.2, 0, 0.5, 0.6);
  // silence, then glaze crazing pings as it cools (pentatonic, high)
  {
    const pent = [86, 88, 91, 93, 96, 98, 100, 103];
    for (let i = 0; i < 46; i++) {
      const x = C.crack0 + (C.crack1 - C.crack0) * Math.pow(rnd(), 0.8);
      ping(x, mtof(pent[Math.floor(rnd() * pent.length)]) * rr(0.995, 1.005), rr(0.35, 1.0), rr(-0.9, 0.9));
    }
  }
  // kiln door: wooden scrape and cool air
  noise(C.door0, 2.5, (x) => (0.5 + 0.5 * Math.sin(x * 19)) * Math.exp(-x / 0.9) * Math.min(1, x / 0.1), () => biquad('bp', 320, 2.5), 0.25, -0.3, 0.3);
  noise(C.door0 + 0.5, 7, (x) => Math.min(1, x / 2) * Math.exp(-x / 5), () => biquad('lp', 1200, 0.5), 0.12, 0.2, 0.5, 0.7);
  // piano steps in
  piano(B(27.5), BEAT * 3, 69, 0.45, 0.1);
  piano(B(28.25), BEAT * 3, 65, 0.4, -0.1);
  step(0.45);

  // ================================================================ 3. LIFE (bars 29-47)
  pianoChords(29, 2, ['Dm', 'Bbmaj7'], 0.5, { roll: true });
  pianoChords(31, 8, [...PROG_D, ...PROG_D2], 0.42, { half: true });
  padProg(31, 11, [...PROG_D, ...PROG_D2, 'Dm', 'Bbmaj7', 'C'], 0.35, { cutoff: 1100 });
  // the duet: two voices, two bowls
  melody(31, THEME_A_D, 'shaku', 0.8, { pan: 0.25, breath: 0.7 });
  melody(31, COUNTER, 'koto', 0.7, { pan: -0.35 });
  melody(35, THEME_B_D, 'shaku', 0.8, { pan: 0.25, breath: 0.7 });
  melody(39, THEME_A_D, 'koto', 0.85, { pan: -0.3 });
  melody(39, COUNTER.filter(n => n.beat < 12), 'shaku', 0.55, { pan: 0.3, breath: 0.5, oct: 0 });
  pianoChords(39, 3, ['Dm', 'Bbmaj7', 'C'], 0.4, { half: true });
  // seasons
  for (let i = 0; i < 18; i++) { // spring birds
    const t = C.life0 + rr(0.5, 14), f = rr(2800, 5200), syl = 2 + Math.floor(rnd() * 4), pan = rr(-0.7, 0.7);
    for (let s = 0; s < syl; s++) {
      const n = Math.floor(0.07 * SR), buf = new Float32Array(n); let ph = 0;
      const f1 = f * rr(0.9, 1.1), sweep = rr(-0.5, 0.6);
      if (!inW(t)) continue;
      for (let j = 0; j < n; j++) { const x = j / n; ph += TAU * f1 * (1 + sweep * x) / SR; buf[j] = Math.sin(ph + 2 * Math.sin(ph * 0.5)) * Math.sin(Math.PI * x) ** 2; }
      mix(buf, t + s * rr(0.08, 0.13), 0.03, pan, 0.4);
    }
  }
  noise(C.life0 + 14, 14, (x, L) => Math.sin(Math.PI * x / L) * (0.6 + 0.4 * Math.sin(TAU * 70 * x) ** 2) * (0.7 + 0.3 * Math.sin(x * 0.9)), () => biquad('bp', 5200, 3), 0.035, 0.4, 0.2); // cicadas
  noise(C.life0 + 26, 22, (x, L) => Math.sin(Math.PI * x / L) * (0.5 + 0.5 * Math.sin(x * 0.7 + Math.sin(x * 0.23) * 3)), () => biquad('lp', 700, 0.5), 0.1, -0.2, 0.3, 0.8); // autumn/winter wind
  // tea: a pour at the first morning, steam hiss
  if (inW(C.pour)) {
    const t0 = C.pour, n = Math.floor(2.4 * SR), buf = new Float32Array(n);
    const bp = biquad('bp', 500, 4);
    for (let i = 0; i < n; i++) {
      const x = i / SR;
      if (i % 128 === 0) bp.set(420 + 520 * (x / 2.4) + 80 * Math.sin(x * 37), 5);
      buf[i] = bp.run(white()) * Math.min(1, x / 0.1) * Math.min(1, (2.4 - x) / 0.4) * (0.6 + 0.4 * Math.sin(x * 61) ** 2);
    }
    mix(buf, t0, 0.18, -0.15, 0.35);
  }
  // alone: the second voice stops. Piano, sparse.
  piano(B(42), BAR * 1.5, 50, 0.4, -0.2); piano(B(42) + BEAT, BAR, 69, 0.35, 0.1);
  piano(B(43), BEAT * 2, 72, 0.33, 0.1); piano(B(43) + BEAT * 2, BEAT * 2, 74, 0.3, 0.15);
  piano(B(44), BAR * 1.2, 76, 0.32, 0.1); piano(B(44), BAR, 46, 0.35, -0.2);
  piano(B(45), BAR * 1.5, 74, 0.28, 0.1); piano(B(45), BAR * 1.5, 57, 0.25, -0.1);
  pad(B(42), BAR * 3, [38, 45], 0.45, { attack: 3, cutoff: 500 });
  // the lift and the tremble: a thin high cluster, a held breath
  pad(C.lift, C.fall - C.lift + 0.3, [81, 82], 0.5, { attack: 1.5, release: 0.05, cutoff: 5000, trem: 11, swell: 2, send: 0.5 });
  pad(C.lift, C.fall - C.lift + 0.2, [26], 0.9, { attack: 2, release: 0.05, cutoff: 150 });
  noise(C.fall, C.shatter - C.fall, x => (x / Math.max(0.01, C.shatter - C.fall)) ** 2, () => biquad('bp', 1400, 0.8), 0.12, 0, 0.2);
  step(0.62);

  // ================================================================ 4. BREAK (bars 47-56)
  {
    const t0 = C.shatter;
    // impact
    taiko(t0, 0.9, 1.4, 0);
    noise(t0, 1.4, x => Math.exp(-x / 0.25), () => biquad('hp', 1800, 0.7), 0.55, 0, 0.5, 0.8);
    noise(t0, 0.3, x => Math.exp(-x / 0.03), () => biquad('bp', 600, 1.2), 0.6, 0, 0.3);
    // ceramic fragments: many tuned tinks spreading out in time and space
    for (let i = 0; i < 90; i++) {
      const x = Math.pow(rnd(), 2.2) * 1.8;
      ping(t0 + x, rr(1300, 6500), rr(0.3, 1.1) * Math.exp(-x * 0.8), rr(-1, 1));
    }
    // reverse swell into frozen time
    noise(t0 + 0.9, 3.6, (x, L) => (x / L) ** 3, () => biquad('bp', 2400, 0.7), 0.12, 0, 0.9, 0.9);
    rin(t0 + 4.4, 62, 0.45, 0);
  }
  pad(C.shatter + 4.0, B(56) - C.shatter - 3.5, [38, 45, 52, 57], 0.22, { attack: 5, release: 2, cutoff: 900, send: 0.8 });
  // memory fragments: the theme, broken, in bell and koto harmonics
  (C.memories || []).forEach((tm, i) => {
    const frag = THEME_A_D.slice(i % 3, (i % 3) + 3 + (i >> 1));
    frag.forEach((nt, k) => bell(tm + k * BEAT * 0.75 + rr(0, 0.03), nt.midi + 12, 0.4, i % 2 ? 0.4 : -0.4));
  });
  // gathering
  pad(B(54.5), BAR * 1.6, [50, 57, 62, 69], 0.9, { attack: 3.5, release: 0.5, cutoff: 2200, swell: 2 });
  noise(B(54.5), BAR * 1.5, (x, L) => (x / L) ** 2.5, () => biquad('bp', 3000, 1.0), 0.12, 0, 0.9);
  step(0.75);

  // ================================================================ 5. SEAM (bars 56-67)
  padProg(56, 4, PROG_D, 0.5, { cutoff: 900, oct: -1 });
  melody(56, THEME_A_D, 'piano', 0.5, { oct: -1, pan: -0.1 });
  // gold arrives: shimmer grains (pentatonic, high)
  {
    const pent = [74, 76, 77, 81, 84, 86, 88, 89, 93];
    for (let i = 0; i < 140; i++) {
      const x = C.goldArrive + Math.pow(rnd(), 0.7) * (B(66) - C.goldArrive);
      bell(x, pent[Math.floor(rnd() * pent.length)] + (rnd() < 0.3 ? 12 : 0), rr(0.1, 0.3), rr(-1, 1), 0.9);
    }
  }
  kotoArp(60, 2, ['Dm', 'C'], 0.5);
  for (let b = 60; b < 62; b++) for (let k = 0; k < 8; k++) taiko(B(b) + k * BEAT / 2, 0.2 + 0.3 * ((b - 60) * 8 + k) / 16, 0.9, k % 2 ? 0.3 : -0.3);
  pad(B(60), BAR * 2, [50, 57, 60, 64, 67], 1.1, { attack: 3, cutoff: 2500, swell: 2 });
  // THE RETURN: theme in F lydian, everything
  rin(B(62), 65 + 12, 0.9, 0);
  taiko(B(62), 1.2, 1.4, 0);
  padProg(62, 4, ['F', 'CE', 'Dm7', 'G'], 1.4, { cutoff: 3200, attack: 0.6 });
  padProg(66, 1, ['F'], 1.1, { cutoff: 2600, attack: 0.6, release: 3 });
  melody(62, THEME_A_F, 'shaku', 1.1, { pan: 0.1 });
  melody(62, THEME_A_F, 'koto', 0.8, { oct: -1, pan: -0.3 });
  kotoArp(62, 4, ['F', 'CE', 'Dm7', 'G'], 0.45, { oct: 1, width: 1 });
  pianoChords(62, 4, ['F', 'CE', 'Dm7', 'G'], 0.6, { half: true });
  for (let b = 62; b < 66; b++) { taiko(B(b), 0.9, 1.3, 0); taiko(B(b) + 2.5 * BEAT, 0.5, 1.0, 0.3); }
  melody(66, THEME_B_F.filter(n => n.beat < 4), 'shaku', 0.9, { pan: 0.1 });
  step(0.88);

  // ================================================================ 6. MENDED (bars 67-76)
  kotoArp(67, 4, ['F', 'Dm7', 'Bb', 'C'], 0.4, { pat: [0, 2, 3, 4, 3, 2, -1, -1] });
  padProg(67, 4, ['F', 'Dm7', 'Bb', 'C'], 0.45, { cutoff: 1500 });
  melody(67, THEME_B_F, 'shaku', 0.75, { pan: 0.15, breath: 0.8 });
  // the cadence home, changed: Bbmaj7 - Gm7 - Asus - A - D major
  pianoChords(71, 1, ['Bbmaj7'], 0.45, { roll: true });
  pianoChords(72, 1, ['Gm7'], 0.42, { roll: true });
  pad(B(71), BAR * 2, [46, 53, 57, 62], 0.5, { cutoff: 1200 });
  pad(B(73), BAR * 0.5, CH.Asus, 0.55, { cutoff: 1400 });
  pad(B(73.5), BAR * 0.5, CH.A, 0.55, { cutoff: 1400 });
  piano(B(73), BAR, 45, 0.4, -0.2); piano(B(73) + BEAT, BAR * 0.8, 69, 0.35, 0.1); piano(B(73) + BEAT * 2, BAR * 0.6, 73, 0.35, 0.15);
  pad(B(74), BAR * 2, CH.D, 0.7, { cutoff: 1800, attack: 1.2, release: 4 });
  piano(B(74), BAR * 2.5, 38, 0.45, -0.2); piano(B(74) + 0.1, BAR * 2.5, 62, 0.35, 0); piano(B(74) + 0.2, BAR * 2.5, 66, 0.35, 0.1); piano(B(74) + 0.3, BAR * 2.5, 69, 0.35, 0.2);
  koto(B(74) + BEAT, 74, 0.5, 0.3, { len: 4 });
  rin(C.ensoGold, 62 + 12, 0.85, 0);
  for (let i = 0; i < 6; i++) { // a last bird
    const t = B(71) + rr(0, 5), f = rr(3000, 4500);
    for (let s = 0; s < 3; s++) {
      const n = Math.floor(0.07 * SR), buf = new Float32Array(n); let ph = 0;
      if (!inW(t)) continue;
      for (let j = 0; j < n; j++) { const x = j / n; ph += TAU * f * (1 + 0.4 * x) / SR; buf[j] = Math.sin(ph + 2 * Math.sin(ph * 0.5)) * Math.sin(Math.PI * x) ** 2; }
      mix(buf, t + s * 0.11, 0.02, 0.5, 0.5);
    }
  }
  step(1.0);
  return { dL, dR, wL, wR, SR, N, OFF };
}

// ---------------------------------------------------------------- player
const Score = (() => {
  let rendered = null, preparing = null;

  function impulse(ctx, secs) {
    const SR = ctx.sampleRate, n = Math.floor(secs * SR);
    const ir = ctx.createBuffer(2, n, SR);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const x = i / SR;
        const k = Math.min(0.97, 0.15 + x * 0.35);           // darker as it decays
        lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
        d[i] = lp * Math.exp(-x / 0.95) * (x < 0.012 ? 0 : 1) * 2.2;
      }
      // a few early reflections
      for (const [tt, g] of [[0.013, 0.5], [0.021, 0.35], [0.034, 0.28], [0.047, 0.2]]) d[Math.floor((tt + c * 0.003) * SR)] += g;
      // unit energy so the wet level is predictable
      let e = 0; for (let i = 0; i < n; i++) e += d[i] * d[i];
      const k = 1 / Math.sqrt(e); for (let i = 0; i < n; i++) d[i] *= k;
    }
    return ir;
  }

  function cues() {
    return Object.assign({ bar: TL.BAR, duration: Film.DURATION }, TL.CUE);
  }

  // Render all stems in a worker, then reverb + master in an OfflineAudioContext.
  function prepare(onProgress) {
    if (preparing) return preparing;
    preparing = (async () => {
      const SR = 44100;
      const C = cues();
      const TOTAL = Math.ceil((C.duration + 8) * SR);
      const stems = { dL: new Float32Array(TOTAL), dR: new Float32Array(TOTAL), wL: new Float32Array(TOTAL), wR: new Float32Array(TOTAL), N: TOTAL };
      const add = r => {
        for (const k of ['dL', 'dR', 'wL', 'wR']) {
          const dst = stems[k], srcA = r[k], o = r.OFF, n = Math.min(srcA.length, TOTAL - o);
          for (let i = 0; i < n; i++) dst[o + i] += srcA[i];
        }
      };
      // four time windows rendered in parallel (fixed split, so the result never depends on the machine)
      const WIN = [[0, 57], [57, 118], [118, 186], [186, 1e9]];
      const prog = WIN.map(() => 0);
      const tick = () => onProgress && onProgress(prog.reduce((a, b) => a + b, 0) / WIN.length);
      const src = KintsugiSynth.toString() + `
        onmessage = e => { const d = e.data; const r = KintsugiSynth(d.SR, d.C, p => postMessage({p}), d.W0, d.W1);
          postMessage({done:true, r}, [r.dL.buffer, r.dR.buffer, r.wL.buffer, r.wR.buffer]); };`;
      let url = null;
      try { url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); } catch (e) {}
      await Promise.all(WIN.map(([W0, W1], k) => new Promise((resolve, reject) => {
        let worker = null;
        try { if (url) worker = new Worker(url); } catch (e) { worker = null; }
        if (!worker) { add(KintsugiSynth(SR, C, null, W0, W1)); prog[k] = 1; tick(); resolve(); return; }
        worker.onmessage = e => {
          if (e.data.done) { add(e.data.r); prog[k] = 1; tick(); worker.terminate(); resolve(); }
          else { prog[k] = e.data.p * 0.95; tick(); }
        };
        worker.onerror = e => reject(e);
        worker.postMessage({ SR, C, W0, W1 });
      })));
      const off = new OfflineAudioContext(2, stems.N, SR);
      const mk = (L, R) => { const b = off.createBuffer(2, stems.N, SR); b.copyToChannel(L, 0); b.copyToChannel(R, 1); return b; };
      const dry = off.createBufferSource(); dry.buffer = mk(stems.dL, stems.dR);
      const wet = off.createBufferSource(); wet.buffer = mk(stems.wL, stems.wR);
      const conv = off.createConvolver(); conv.normalize = false; conv.buffer = impulse(off, 4.2);
      const wetG = off.createGain(); wetG.gain.value = 0.9;
      const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;
      const comp = off.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 2; comp.attack.value = 0.02; comp.release.value = 0.3; comp.knee.value = 10;
      const out = off.createGain(); out.gain.value = 1.1;
      const clip = off.createWaveShaper();
      const curve = new Float32Array(2048);
      for (let i = 0; i < 2048; i++) { const x = i / 1023.5 - 1; curve[i] = Math.tanh(x * 1.1) / Math.tanh(1.1); }
      clip.curve = curve;
      dry.connect(hp); wet.connect(conv); conv.connect(wetG); wetG.connect(hp);
      hp.connect(comp); comp.connect(out); out.connect(clip); clip.connect(off.destination);
      dry.start(0); wet.start(0);
      rendered = await off.startRendering();
      return rendered;
    })();
    return preparing;
  }

  async function start(at) {
    const buffer = await prepare();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let src = null, t0 = 0, off = at;
    function play(offset) {
      if (src) { try { src.stop(); } catch (e) {} src.disconnect(); }
      src = ctx.createBufferSource(); src.buffer = buffer; src.connect(ctx.destination);
      t0 = ctx.currentTime + 0.05; off = offset;
      src.start(t0, Math.max(0, offset));
    }
    await ctx.resume();
    play(at);
    return {
      time: () => Math.max(off, off + ctx.currentTime - t0),
      pause: () => ctx.suspend(),
      seek: t => { ctx.resume(); play(t); },
      ctx,
    };
  }

  return { prepare, start, get buffer() { return rendered; } };
})();
