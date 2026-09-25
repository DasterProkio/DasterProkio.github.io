// The director: maps film time to scenes, cameras, uniforms and grading.
const Film = (() => {
  const { bar, track, path, lin, smooth, mix, clamp, ease } = TL;
  const V = GLX.v;

  const TEN_PROFILE = (() => {
    const P = [[0.0, 0.07, 0.03], [0.12, 0.075, 0.03], [0.3, 0.2, 0.026], [0.46, 0.42, 0.022], [0.54, 0.6, 0.02], [0.555, 0.64, 0.018]];
    const a = new Float32Array(24);
    P.forEach((p, i) => { a[i * 4] = p[0] * 0.95; a[i * 4 + 1] = p[1] * 0.95; a[i * 4 + 2] = p[2]; });
    return a;
  })();

  const BOWL_BASE = {
    uProf: Bowl.packProfile(Bowl.FINAL), uFoot: Bowl.FOOT.stroke, uFootTh: Bowl.FOOT.th, uProf2: TEN_PROFILE,
    uWobble: 0.012, uOval: 0.015, uRidge: 0.0, uSpin: 0,
    uWet: 0, uDry: 1, uGlazeRaw: 0, uMelt: 1, uHeat: 0, uAsh: 0.3, uCrackle: 1, uStain: 0, uGold: 0,
    uSeeds: Bowl.packSeeds(),
  };

  function cam(eye, target, fov, roll = 0) {
    return { uCamPos: eye, uCamRot: GLX.lookAt(eye, target, roll), uFov: fov };
  }

  // ------------------------------------------------------------------ LIFE
  // Bars 29..47. A lifetime at the table, told in time-lapse.
  const LIFE0 = bar(29), LIFE1 = bar(47);
  const life = (() => {
    const L = x => LIFE0 + x;               // local seconds
    const day = track([[L(0), 0.27], [L(60), 0.27 + 22.0, 'lin']]); // continuous day counter (fractional part used)
    return (t) => {
      const lt = t - LIFE0;
      const m = {
        uMemDay: 0.34, uMemSeason: 0.1, uMemTwo: 1, uMemGap: 1.45, uMemCandle: 0, uMemSteam: 1, uMemTea: 0.6, uMemTea2: 0.6,
        uMemOpen: 0.5, uMemRing: 0, uBowlOn: 1, uBowlOff: [0, 0, 0], uBowlTilt: 0, uBeams: 0.6,
      };
      const e = [1.7, 2.1, -3.9], tg = [-0.45, 0.3, 0.5];
      return {
        scene: 'life',
        bag: Object.assign({}, BOWL_BASE, m, cam(e, tg, 0.3), { uTime: t, uLocal: lt, uStain: 0.3 }),
        post: { exposure: 1.0, focus: V.len(V.sub(tg, e)), aperture: 0.9, maxCoc: 9, bloom: 0.08, grain: 0.03 },
      };
    };
  })();

  // ------------------------------------------------------------------ BREAK (spike)
  const BRK0 = bar(47);
  const brk = (t) => {
    const lt = t - BRK0;
    const eye = [3.2, 1.9, -4.6], tg = [0, 0.7, 0];
    const pose = Shatter.pose({ origin: [0, 0, 0], explode: 0.05, spread: 1, face: 0.7, eye, drift: lt });
    const m = {
      uMemDay: 0.9, uMemSeason: 3, uMemTwo: 0, uMemGap: 1.45, uMemCandle: 0, uMemSteam: 0, uMemTea: 0, uMemTea2: 0,
      uMemOpen: 0.1, uMemRing: 1,
    };
    return {
      scene: 'break',
      bag: Object.assign({}, BOWL_BASE, m, pose, Shatter.MEM, cam(eye, tg, 0.34), {
        uTime: t, uLocal: lt, uStain: 0.4, uShardScale: 1, uShardN: Shatter.packN(), uVoid: 1, uPortal: 1,
        uGoldEdge: 0, uGoldGlow: 0, uImpact: [0, 0, 0], uKeyDir: GLX.v.norm([-0.6, 0.8, -0.3]), uSpecks: 1,
      }),
      post: { exposure: 1.0, focus: V.len(V.sub(tg, eye)), aperture: 0.5, maxCoc: 8, bloom: 0.1, grain: 0.03 },
    };
  };

  const SHOTS = [
    { name: 'life', t0: 0, t1: BRK0, fn: life },
    { name: 'break', t0: BRK0, t1: 1e9, fn: brk },
  ];
  const DURATION = bar(76);

  function frameAt(t) {
    let cur = SHOTS[SHOTS.length - 1];
    for (const s of SHOTS) if (t >= s.t0 && t < s.t1) { cur = s; break; }
    const a = cur.fn(t);
    const f = { a: { scene: a.scene, bag: a.bag }, post: Object.assign({}, Engine.DEFAULT_POST, a.post) };
    const ov = Film.override;
    if (ov) for (const k in ov) {
      if (k === 'eye' || k === 'tgt') continue;
      if (k in f.post) f.post[k] = ov[k]; else f.a.bag[k] = ov[k];
    }
    if (ov && (ov.eye || ov.tgt)) {
      const e = ov.eye || f.a.bag.uCamPos, g = ov.tgt || [0, 0.35, 0];
      Object.assign(f.a.bag, cam(e, g, ov.fov || f.a.bag.uFov));
      f.post.focus = V.len(V.sub(g, e));
    }
    return f;
  }

  const Film = { frameAt, DURATION, SHOTS, BOWL_BASE, override: null };
  return Film;
})();
