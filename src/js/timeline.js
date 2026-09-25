// Timeline utilities: easing, keyframe tracks, and the tempo grid.
const TL = (() => {
  const BPM = 72;
  const BAR = 240 / BPM;          // seconds per 4/4 bar
  const BEAT = 60 / BPM;
  const bar = b => b * BAR;

  const ease = {
    lin: x => x,
    in: x => x * x,
    out: x => 1 - (1 - x) * (1 - x),
    io: x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
    io3: x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    sine: x => 0.5 - 0.5 * Math.cos(Math.PI * x),
    expo: x => x === 1 ? 1 : 1 - Math.pow(2, -10 * x),
    step: x => x < 1 ? 0 : 1,
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lin = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
  const smooth = (a, b, x) => { const t = lin(a, b, x); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t;

  // keys: [[t, value, easeName?], ...] sorted; ease applies to the segment ending at that key
  function track(keys) {
    return t => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) {
          const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
          const x = (t - t0) / (t1 - t0);
          return mix(v0, v1, (ease[e || 'sine'])(x));
        }
      }
      return keys[keys.length - 1][1];
    };
  }

  // smooth Catmull-Rom path through points (for cameras), param 0..1 with
  // approximately uniform speed via arc-length table
  function path(points) {
    const P = i => points[clamp(i, 0, points.length - 1)];
    const raw = u => {
      const n = points.length - 1;
      const x = clamp(u, 0, 1) * n;
      const i = Math.min(n - 1, Math.floor(x)), t = x - i;
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const t2 = t * t, t3 = t2 * t;
      return p1.map((_, c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3));
    };
    const N = 200, lens = [0];
    let prev = raw(0);
    for (let i = 1; i <= N; i++) {
      const q = raw(i / N);
      lens.push(lens[i - 1] + Math.hypot(...q.map((v, c) => v - prev[c])));
      prev = q;
    }
    const total = lens[N];
    return s => {
      const target = clamp(s, 0, 1) * total;
      let lo = 0, hi = N;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lens[m] < target) lo = m; else hi = m; }
      const f = (target - lens[lo]) / Math.max(1e-9, lens[hi] - lens[lo]);
      return raw((lo + f) / N);
    };
  }

  // Sync points shared by picture and sound (seconds). Filled in by the director.
  const CUE = {};

  return { CUE, BPM, BAR, BEAT, bar, ease, clamp, lin, smooth, mix, track, path };
})();
