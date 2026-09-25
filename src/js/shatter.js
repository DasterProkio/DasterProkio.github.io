// Shard kinematics and the memories each shard holds.
const Shatter = (() => {
  const INFO = Bowl.shardInfo();
  const N = Bowl.NSEED;
  const rnd = Bowl.rng(31);

  // quaternion helpers
  const qmul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  const qaxis = (ax, ang) => { const l = Math.hypot(...ax) || 1, s = Math.sin(ang / 2); return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(ang / 2)]; };
  function qslerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    if (d < 0) { b = b.map(x => -x); d = -d; }
    if (d > 0.9995) { const r = a.map((x, i) => x + (b[i] - x) * t); const l = Math.hypot(...r); return r.map(x => x / l); }
    const th = Math.acos(d), s = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return a.map((x, i) => x * wa + b[i] * wb);
  }
  const qrot = (q, v) => {
    const [x, y, z, w] = q;
    const c1 = [y * v[2] - z * v[1] + w * v[0], z * v[0] - x * v[2] + w * v[1], x * v[1] - y * v[0] + w * v[2]];
    return [v[0] + 2 * (y * c1[2] - z * c1[1]), v[1] + 2 * (z * c1[0] - x * c1[2]), v[2] + 2 * (x * c1[1] - y * c1[0])];
  };
  // rotation taking unit vector a to unit vector b
  function qfromto(a, b) {
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    if (d < -0.9999) return qaxis(Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1], Math.PI);
    const q = [c[0], c[1], c[2], 1 + d];
    const l = Math.hypot(...q);
    return q.map(x => x / l);
  }

  // Per-shard random spin axis / velocity (explosion from the impact point)
  const IMPACT_LOCAL = (() => {
    const c = Bowl.centerAt(Bowl.FINAL, 0.97);
    return [c[0] * Math.cos(Bowl.IMPACT), c[1], c[0] * Math.sin(Bowl.IMPACT)];
  })();
  const DYN = INFO.map((s, i) => {
    const away = GLX.v.norm(GLX.v.sub(s.c, [IMPACT_LOCAL[0] * 0.3, -0.4, IMPACT_LOCAL[2] * 0.3]));
    const speed = i === 0 ? 0.3 : 1.2 + rnd() * 1.4;
    return {
      vel: GLX.v.mul(away, speed),
      axis: GLX.v.norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]),
      spin: (i === 0 ? 0.6 : 2 + rnd() * 5) * (rnd() < 0.5 ? -1 : 1),
      phase: rnd() * 6.28,
    };
  });

  // The remembered moments. Each shard shows one.
  // day, season, two, candle | gap, open, tea, ring | cam az, el, dist, fov
  const M = {
    first:   [[0.30, 0.05, 0, 0], [1.45, 0.6, 0.6, 0], [0.35, 0.10, 3.3, 1.15]],   // the first morning, alone, new
    spring:  [[0.36, 0.20, 1, 0], [1.45, 1.0, 0.6, 0], [0.2, 0.09, 3.5, 1.22]],   // two bowls, blossom
    summer:  [[0.52, 1.00, 1, 0], [1.10, 1.0, 0.5, 0], [-0.25, 0.1, 3.1, 1.22]],   // noon, green
    rain:    [[0.45, 1.40, 1, 0], [1.00, 0.6, 0.6, 0], [0.5, 0.05, 2.7, 1.15]],    // grey afternoon
    autumn:  [[0.70, 2.10, 1, 0], [0.95, 1.0, 0.6, 0], [0.1, 0.08, 3.1, 1.15]],    // low gold sun, maple
    candle:  [[0.93, 2.90, 1, 1], [0.86, 0.00, 0.6, 0], [0.6, 0.14, 3.7, 1.30]],    // winter night by candle
    touch:   [[0.40, 0.30, 1, 0], [0.84, 0.8, 0.6, 0], [0.0, 0.11, 2.5, 1.09]],    // spring again: touching
    late:    [[0.62, 2.40, 1, 0], [0.84, 0.7, 0.3, 0], [-0.4, 0.10, 3.1, 1.15]],   // late autumn afternoon
  };
  const ORDER = ['first', 'spring', 'summer', 'autumn', 'candle', 'touch', 'rain', 'late', 'spring', 'summer', 'autumn', 'candle', 'touch', 'first'];

  function packMem() {
    const A = new Float32Array(N * 4), B = new Float32Array(N * 4), C = new Float32Array(N * 4);
    ORDER.forEach((k, i) => {
      const [a, b, c] = M[k];
      A.set(a, i * 4); B.set(b, i * 4); C.set(c, i * 4);
    });
    return { uMemA: A, uMemB: B, uMemCam: C };
  }
  const MEM = packMem();

  const REST_C = (() => {
    const a = new Float32Array(N * 4);
    INFO.forEach((s, i) => a.set([s.c[0], s.c[1], s.c[2], s.r], i * 4));
    return a;
  })();

  function packN(strengths) {
    const a = new Float32Array(N * 4);
    INFO.forEach((s, i) => a.set([s.n[0], s.n[1], s.n[2], strengths ? strengths[i] : 1], i * 4));
    return a;
  }

  // Pose shards. opts:
  //  origin: world pos of bowl origin (rest), explode: physical seconds since impact,
  //  spread: 0..1 art-directed constellation, face: 0..1 turn glaze toward `eye`,
  //  gather: 0..1 back to rest, drift: seconds (slow float), hide: set of hidden indices
  function pose(o) {
    const Q = new Float32Array(N * 4), P = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const s = INFO[i], d = DYN[i];
      const rest = GLX.v.add(o.origin, s.c);
      const te = o.explode || 0;
      // ballistic, floor-less (time is nearly frozen)
      let p = GLX.v.add(rest, GLX.v.mul(d.vel, te));
      p[1] -= 4.9 * te * te;
      let q = qaxis(d.axis, d.spin * te);
      // constellation: push outward and upward around the bowl's origin
      if (o.spread > 0) {
        const dir = GLX.v.norm([s.c[0], 0.25 + s.c[1] * 0.6, s.c[2]]);
        const r = (i === 0 ? 0.0 : 1.4 + 0.9 * ((i * 0.618) % 1)) * o.spread;
        const lift = (i === 0 ? -0.2 : 0.5 + 0.8 * ((i * 0.382) % 1)) * o.spread;
        p = GLX.v.add(p, [dir[0] * r, lift, dir[2] * r]);
        const dr = o.drift || 0;
        p = GLX.v.add(p, [0.12 * Math.sin(dr * 0.4 + d.phase), 0.1 * Math.sin(dr * 0.33 + d.phase * 1.7), 0.12 * Math.cos(dr * 0.37 + d.phase)]);
        q = qmul(qaxis(d.axis, 0.25 * Math.sin(dr * 0.2 + d.phase) * o.spread), q);
      }
      // turn the glaze toward the eye
      if (o.face > 0 && o.eye) {
        const nWorld = qrot(q, s.n);
        const toEye = GLX.v.norm(GLX.v.sub(o.eye, p));
        // show the side of the shard that already faces the eye most
        const sgn = GLX.v.dot(nWorld, toEye) >= 0 ? 1 : -1;
        const target = qmul(qfromto(GLX.v.mul(nWorld, sgn), toEye), q);
        q = qslerp(q, target, o.face * 0.85);
      }
      if (o.gather > 0) {
        const g = o.gather;
        p = GLX.v.mix(p, rest, g);
        q = qslerp(q, [0, 0, 0, 1], g);
      }
      Q.set(q, i * 4);
      P.set([p[0], p[1], p[2], o.hide && o.hide.has(i) ? 0 : 1], i * 4);
    }
    return { uShardQ: Q, uShardP: P, uShardC: REST_C };
  }

  return { INFO, N, pose, MEM, packN, REST_C, IMPACT_LOCAL, qrot };
})();
