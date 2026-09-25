// Bowl geometry data: profiles for every stage of its life, fracture seeds.
const Bowl = (() => {
  // centerline (r, y) + half thickness. Units: 1.0 = 10 cm.
  const FINAL = [
    [0.00, 0.100, 0.042],
    [0.16, 0.100, 0.041],
    [0.30, 0.128, 0.036],
    [0.425, 0.205, 0.031],
    [0.515, 0.320, 0.028],
    [0.572, 0.460, 0.026],
    [0.598, 0.600, 0.024],
    [0.604, 0.715, 0.021],
  ];
  const FOOT = { stroke: [0.235, 0.085, 0.245, 0.030], th: 0.026 };

  // Throwing keyframes (same point count). The clay is centred, opened, pulled, shaped.
  const LUMP = [
    [0.00, 0.30, 0.26],
    [0.10, 0.30, 0.25],
    [0.20, 0.29, 0.22],
    [0.28, 0.26, 0.18],
    [0.33, 0.21, 0.14],
    [0.36, 0.16, 0.10],
    [0.38, 0.11, 0.07],
    [0.39, 0.07, 0.05],
  ];
  const CONE = [
    [0.00, 0.14, 0.12],
    [0.08, 0.20, 0.13],
    [0.14, 0.30, 0.13],
    [0.18, 0.42, 0.12],
    [0.21, 0.54, 0.11],
    [0.22, 0.66, 0.10],
    [0.22, 0.76, 0.09],
    [0.21, 0.84, 0.08],
  ];
  const OPENED = [
    [0.00, 0.12, 0.06],
    [0.18, 0.12, 0.06],
    [0.30, 0.13, 0.07],
    [0.36, 0.17, 0.08],
    [0.38, 0.26, 0.08],
    [0.38, 0.36, 0.075],
    [0.38, 0.45, 0.07],
    [0.38, 0.53, 0.06],
  ];
  const CYLINDER = [
    [0.00, 0.11, 0.05],
    [0.20, 0.11, 0.05],
    [0.33, 0.12, 0.045],
    [0.40, 0.17, 0.04],
    [0.43, 0.30, 0.034],
    [0.445, 0.45, 0.03],
    [0.45, 0.60, 0.028],
    [0.45, 0.74, 0.025],
  ];
  // thrown bowl before trimming (a little heavier at the base, no foot)
  const THROWN = FINAL.map(([r, y, t], i) => [r * 1.0, y + (i < 3 ? 0.0 : 0.0), t * 1.15]);
  THROWN[0] = [0.00, 0.075, 0.07];
  THROWN[1] = [0.16, 0.075, 0.07];
  THROWN[2] = [0.30, 0.100, 0.055];

  const STAGES = { LUMP, CONE, OPENED, CYLINDER, THROWN, FINAL };

  function lerpProfile(a, b, t) {
    return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t, p[2] + (b[i][2] - p[2]) * t]);
  }

  // Catmull-Rom resample to NPROF points so the lathe has no visible facets.
  const NPROF = 16;
  function resample(prof, n = NPROF) {
    const P = i => prof[Math.max(0, Math.min(prof.length - 1, i))];
    const out = [];
    for (let k = 0; k < n; k++) {
      const u = k / (n - 1) * (prof.length - 1);
      const i = Math.min(prof.length - 2, Math.floor(u)), t = u - i;
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map(c => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
    return out;
  }
  function packProfile(prof) {
    const r = resample(prof);
    const out = new Float32Array(NPROF * 4);
    r.forEach((p, i) => { out[i * 4] = p[0]; out[i * 4 + 1] = p[1]; out[i * 4 + 2] = p[2]; });
    return out;
  }

  // Deterministic PRNG
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // point on the centerline at arc parameter s (0..1)
  function centerAt(prof, s) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < prof.length - 1; i++) {
      const L = Math.hypot(prof[i + 1][0] - prof[i][0], prof[i + 1][1] - prof[i][1]);
      segs.push(L); total += L;
    }
    let acc = s * total;
    for (let i = 0; i < segs.length; i++) {
      if (acc <= segs[i] || i === segs.length - 1) {
        const t = Math.min(1, acc / segs[i]);
        return [prof[i][0] + (prof[i + 1][0] - prof[i][0]) * t, prof[i][1] + (prof[i + 1][1] - prof[i][1]) * t];
      }
      acc -= segs[i];
    }
  }

  // Fracture seeds: impact on the rim-side of the bowl at angle IMPACT.
  const IMPACT = -0.6;
  const NSEED = 14;
  function makeSeeds() {
    const r = rng(7);
    const seeds = [];
    seeds.push([0, 0.07, 0]);                 // the base stays one piece
    const spec = [
      // [arc s, angle offset from impact] — denser near the impact
      [0.93, 0.05], [0.80, -0.35], [0.88, 0.45], [0.66, 0.15],
      [0.55, -0.9], [0.62, 1.05], [0.82, -1.55], [0.86, 1.75],
      [0.60, 2.45], [0.78, 3.0], [0.58, -2.4], [0.84, -3.3],
      [0.40, 3.6],
    ];
    for (const [s, da] of spec) {
      const c = centerAt(FINAL, s + (r() - 0.5) * 0.04);
      const a = IMPACT + da + (r() - 0.5) * 0.15;
      seeds.push([c[0] * Math.cos(a), c[1], c[0] * Math.sin(a)]);
    }
    return seeds;
  }
  const SEEDS = makeSeeds();
  function packSeeds() {
    const out = new Float32Array(NSEED * 4);
    SEEDS.forEach((s, i) => { out[i * 4] = s[0]; out[i * 4 + 1] = s[1]; out[i * 4 + 2] = s[2]; });
    return out;
  }

  // inner radius of the cavity at height y (for the liquid surface)
  function innerRadius(y) {
    const prof = FINAL;
    for (let i = 0; i < prof.length - 1; i++) {
      const [r0, y0, t0] = prof[i], [r1, y1, t1] = prof[i + 1];
      if (y >= y0 && y <= y1) {
        const t = (y - y0) / (y1 - y0);
        return r0 + (r1 - r0) * t - (t0 + (t1 - t0) * t) * 1.05;
      }
    }
    return 0.0;
  }

  return { NPROF, resample, STAGES, FINAL, FOOT, lerpProfile, packProfile, SEEDS, NSEED, packSeeds, IMPACT, innerRadius, rng, centerAt };
})();
if (typeof module !== 'undefined') module.exports = Bowl;
