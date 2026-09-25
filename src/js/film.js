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

  function cam(eye, target, fov, roll = 0, up = null) {
    return { uCamPos: eye, uCamRot: GLX.lookAt(eye, target, roll, up), uFov: fov };
  }

  // ------------------------------------------------------------------ CLAY
  const CLAY0 = bar(6), CLAY1 = bar(17);
  const clay = (() => {
    const S = Bowl.STAGES;
    // throwing choreography (local seconds): centre (cone up/down), open, pull, shape
    const keys = [
      [0, S.LUMP], [3.5, S.LUMP], [6.0, S.CONE], [8.0, S.LUMP], [10.5, S.OPENED],
      [14.0, S.CYLINDER], [18.0, S.THROWN], [26.0, S.THROWN], [29.5, S.FINAL],
    ];
    function profileAt(lt) {
      if (lt <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) if (lt <= keys[i][0]) {
        const x = ease.io((lt - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
        return Bowl.lerpProfile(keys[i - 1][1], keys[i][1], x);
      }
      return keys[keys.length - 1][1];
    }
    // wheel speed (rev/s): spins up, steady, slows to a stop at ~21s
    const rps = track([[0, 1.6], [18, 1.6], [21.5, 0.0, 'out']]);
    function spinAt(lt) { // integrate
      let a = 0; const dt = 0.05;
      for (let x = 0; x < lt; x += dt) a += rps(x) * dt * Math.PI * 2;
      return a;
    }
    const dry = track([[22, 0], [30, 1, 'io']]);
    const foot = track([[26, 0], [29.5, 1, 'io']]);
    const glaze = track([[30, 0], [34, 1, 'io']]);
    const sunA = track([[0, 0.0], [21, 0.1], [34, 1.0, 'io']]);
    const camPath = path([[0.0, 3.4, -0.4], [0.8, 2.4, -2.2], [1.8, 1.4, -2.6], [2.3, 1.2, -1.8], [2.4, 1.3, -0.9]]);
    const camU = track([[0, 0], [8, 0.3], [30, 0.85, 'io'], [37, 1.0]]);
    return (t) => {
      const lt = t - CLAY0;
      const prof = profileAt(lt);
      const a = sunA(lt);
      const sun = V.norm([-1.0, mix(0.55, 0.28, a), mix(-0.25, 0.35, a)]);
      const e = camPath(camU(lt)), tg = [0, mix(0.3, 0.35, 0.5), 0];
      const wet = 1 - dry(lt);
      return {
        scene: 'studio',
        bag: Object.assign({}, BOWL_BASE, cam(e, tg, 0.34), {
          uTime: t, uLocal: lt, uProf: Bowl.packProfile(prof), uFootTh: Bowl.FOOT.th * foot(lt),
          uSpin: spinAt(lt), uWheelSpin: spinAt(lt), uRidge: 0.0022 * wet, uWet: wet, uDry: dry(lt),
          uGlazeRaw: glaze(lt), uMelt: 0, uHeat: 0, uAsh: 0, uCrackle: 0, uStain: 0, uGold: 0,
          uWobble: 0.012 * TL.smooth(14, 18, lt), uOval: 0.015 * TL.smooth(20, 26, lt),
          uSun: sun, uSunCol: V.mul(mix([1.0, 0.95, 0.88], [1.0, 0.72, 0.45], a), 5.0), uWater: wet, uDust: 1, uWarm: 0.15 + 0.6 * a,
        }),
        post: { exposure: 1.1, focus: V.len(V.sub(tg, e)), aperture: 0.8, maxCoc: 9, bloom: 0.08, grain: 0.035 },
      };
    };
  })();

  // ------------------------------------------------------------------ FIRE
  const FIRE0 = bar(17), FIRE1 = bar(29);
  const fire = (() => {
    const fireK = track([[0, 0.35], [5, 1.0, 'io'], [26, 1.0], [30, 0.0, 'in']]);
    const wallK = track([[0, 0.35], [10, 0.9, 'io'], [26, 1.0], [33, 0.0, 'out']]);
    const heat = track([[2, 0.0], [20, 0.95, 'io'], [26, 1.0], [34, 0.0, 'out']]);
    const melt = track([[10, 0.0], [21, 1.0, 'io']]);
    const ash = track([[4, 0.0], [24, 0.55, 'io']]);
    const ember = track([[26, 0], [30, 1.0], [37, 0.0]]);
    const door = track([[31, 0], [38, 1.0, 'io']]);
    const crackle = track([[32, 0], [39, 1.0, 'lin']]);
    const camPath = path([[2.4, 1.3, -0.9], [2.0, 1.0, -1.8], [1.2, 0.8, -2.4], [0.7, 0.8, -2.0], [0.4, 0.85, -1.6]]);
    const camU = track([[0, 0], [26, 0.6, 'io'], [40, 1.0, 'io']]);
    return (t) => {
      const lt = t - FIRE0;
      const e = camPath(camU(lt)), tg = V.mix([0, 0.35, 0], [0.05, 0.45, 0.2], TL.smooth(30, 40, lt));
      return {
        scene: 'kiln',
        bag: Object.assign({}, BOWL_BASE, cam(e, tg, 0.34), {
          uTime: t, uLocal: lt, uWet: 0, uDry: 1, uGlazeRaw: 1, uMelt: melt(lt), uHeat: heat(lt), uAsh: ash(lt),
          uCrackle: crackle(lt), uStain: 0, uGold: 0,
          uFire: fireK(lt), uWallT: wallK(lt), uDoor: door(lt), uEmber: ember(lt),
        }),
        post: { exposure: mix(0.55, 1.0, TL.smooth(27, 33, lt)), focus: V.len(V.sub(tg, e)), aperture: 0.7, maxCoc: 9, bloom: 0.12, bloomThresh: 1.0, grain: 0.04,
          shimmer: fireK(lt) },
      };
    };
  })();

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

  // ------------------------------------------------------------------ SEAM
  const SEAM0 = bar(56), SEAM1 = bar(67);
  const seam = (() => {
    const src = Shatter.IMPACT_LOCAL;
    // walk along the 2/4 seam: (arc s, angle) samples from the exterior search
    const SEAMP = Bowl.traceSeam(0.40, -1.03, 44, 0.008).slice(4);
    const seamPos = path(SEAMP.map(q => q.p));
    const seamNrm = path(SEAMP.map(q => q.n));
    const alt = track([[0, 0.010], [11, 0.014, 'sine'], [27, 2.9, 'io3']]);
    const tgtBlend = track([[12, 0], [25, 1, 'io']]);
    return (t) => {
      const lt = t - SEAM0;
      const u = 0.04 + clamp(lt / 27, 0, 1) * 0.16;
      const P = seamPos(u), N = V.norm(seamNrm(u));
      const A = alt(lt);
      const ahead = Math.min(1, u + 0.05 + A * 0.4);
      const Pa = seamPos(ahead);
      const fwd = V.norm(V.sub(Pa, P));
      // near: hover above the seam looking along it toward the curved horizon
      const eyeNear = V.add(P, V.mul(N, A));
      const lookNear = V.add(eyeNear, V.add(V.mul(fwd, 1.0), V.mul(N, -0.1 - A * 1.5)));
      // far: pull back to frame the whole bowl
      const far = [2.0, 2.2, -2.2];
      const w = TL.smooth(0.02, 1.8, A);
      const back = V.add(V.add(P, V.mul(N, A)), V.mul(fwd, -A * 0.8));
      const eye = V.mix(back, V.add([0, 0.36, 0], V.mul(V.norm(V.sub(far, [0, 0.36, 0])), A)), w * w);
      const tg = V.mix(lookNear, [0, 0.36, 0], tgtBlend(lt));
      const upv = V.norm(V.mix(N, [0, 1, 0], TL.smooth(12, 24, lt)));
      const keyNear = V.norm(V.add(fwd, V.mul(N, 0.22)));
      const key = V.norm(V.mix(keyNear, [-0.45, 0.5, 0.75], TL.smooth(12, 22, lt)));
      const flow = 0.02 + 0.042 * lt + Math.max(0, lt - 12) * 0.05;
      const focus = mix(A * 7.0, V.len(V.sub(tg, eye)), TL.smooth(9, 18, lt));
      return {
        scene: 'seam',
        bag: Object.assign({}, BOWL_BASE, cam(eye, tg, 0.36, 0, upv), {
          uTime: t, uLocal: lt, uStain: 0.5, uGold: 0, uGap: 0.0016, uFlow: flow, uSource: src, uCool: 0.45,
          uKeyDir: key, uRoomLight: 0, uAlt: A,
        }),
        post: { exposure: 1.0, focus, aperture: 0.6, maxCoc: 9, bloom: 0.14, bloomThresh: 1.0, grain: 0.03 },
      };
    };
  })();

  // ------------------------------------------------------------------ sync cues for the score
  Object.assign(TL.CUE, {
    brush0: bar(1) + 0.3, brush1: bar(3.6),
    clay0: CLAY0, fire0: FIRE0, firePeak: FIRE0 + 26, door0: FIRE0 + 31, crack0: FIRE0 + 32, crack1: FIRE0 + 39.5,
    life0: LIFE0, pour: LIFE0 + 2.0,
    lift: bar(45.5), fall: bar(46.6), shatter: bar(47),
    memories: [bar(49.5), bar(51), bar(52.5), bar(54)],
    goldArrive: SEAM0 + 7.0, ensoGold: bar(74.5),
  });

  const SHOTS = [
    { name: 'clay', t0: 0, t1: CLAY1, fn: clay },
    { name: 'fire', t0: CLAY1, t1: FIRE1, fn: fire },
    { name: 'life', t0: FIRE1, t1: BRK0, fn: life },
    { name: 'break', t0: BRK0, t1: SEAM0, fn: brk },
    { name: 'seam', t0: SEAM0, t1: 1e9, fn: seam },
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
