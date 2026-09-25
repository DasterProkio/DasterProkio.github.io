// The director: maps film time to scenes, cameras, uniforms and grading.
// Each shot returns { scene, bag, cam:{eye,tgt,fov,up}, post }. Transitions render
// two shots with a shared (blended) camera and a world-space composite.
const Film = (() => {
  const { bar, track, path, lin, smooth, mix, clamp, ease } = TL;
  const V = GLX.v;
  const sm = (a, b, x) => smooth(a, b, x);

  // ---------------------------------------------------------------- the acts (seconds)
  const ENSO0 = 0, CLAY0 = bar(6), FIRE0 = bar(17), LIFE0 = bar(29), BRK0 = bar(47), SEAM0 = bar(56), MEND0 = bar(67), END0 = bar(72.5);
  const DURATION = bar(78);

  const TEN_PROFILE = (() => {
    const P = [[0.0, 0.07, 0.03], [0.12, 0.075, 0.03], [0.3, 0.2, 0.026], [0.46, 0.42, 0.022], [0.54, 0.6, 0.02], [0.555, 0.64, 0.018]];
    const a = new Float32Array(24);
    P.forEach((p, i) => { a[i * 4] = p[0] * 0.95; a[i * 4 + 1] = p[1] * 0.95; a[i * 4 + 2] = p[2]; });
    return a;
  })();

  const BOWL_BASE = {
    uProf: Bowl.packProfile(Bowl.FINAL), uFoot: Bowl.FOOT.stroke, uFootTh: Bowl.FOOT.th, uProf2: TEN_PROFILE,
    uWobble: 0.012, uOval: 0.015, uRidge: 0.0, uSpin: 0,
    uWet: 0, uDry: 1, uGlazeRaw: 1, uMelt: 1, uHeat: 0, uAsh: 0.55, uCrackle: 1, uStain: 0, uGold: 0,
    uSeeds: Bowl.packSeeds(),
  };

  // Title card: drawn once into a 2D canvas (system serif fonts; no font files)
  let titleCanvas = null;
  function titleCard() {
    if (titleCanvas || typeof document === 'undefined') return titleCanvas;
    const c = document.createElement('canvas');
    c.width = 2048; c.height = Math.round(2048 / Engine.ASPECT);
    const g = c.getContext('2d');
    const serif = '"Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP","Noto Serif JP","Source Han Serif","MS Mincho","Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';
    // the ensō spans x 694..1354 (canvas px); the title stands in the right margin, written downward
    const x = 1585, y0 = 262, step = 104;
    g.fillStyle = 'rgba(22,17,13,0.94)';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '400 92px ' + serif;
    ['金', '継', 'ぎ'].forEach((ch, i) => g.fillText(ch, x, y0 + i * step));
    // the seal: vermilion, with 継 cut out of it so the paper shows through
    const sy = y0 + 3 * step + 18, S = 62;
    g.fillStyle = 'rgba(168,34,22,0.9)';
    g.beginPath();
    const r = 7;
    g.moveTo(x - S / 2 + r, sy); g.arcTo(x + S / 2, sy, x + S / 2, sy + S, r); g.arcTo(x + S / 2, sy + S, x - S / 2, sy + S, r);
    g.arcTo(x - S / 2, sy + S, x - S / 2, sy, r); g.arcTo(x - S / 2, sy, x + S / 2, sy, r); g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.font = '700 44px ' + serif;
    g.fillText('継', x, sy + S / 2 + 2);
    // worn stamp: a few specks where the seal did not take
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(x - S / 2 + rnd() * S, sy + rnd() * S, 0.8 + rnd() * 1.8, 0, 6.3); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(40,32,24,0.8)';
    g.font = '400 22px "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';
    if ('letterSpacing' in g) g.letterSpacing = '9px';
    g.fillText('KINTSUGI', x + 5, sy + S + 46);
    titleCanvas = c;
    return c;
  }

  // ---------------------------------------------------------------- grades
  const GRADE = {
    enso: { exposure: 2.3, aperture: 0, bloom: 0.02, grain: 0.03, vignette: 0.3, ca: 0.0, sat: 1.0, tintShadow: [1, 1, 1], tintHigh: [1.0, 0.99, 0.96] },
    clay: { exposure: 1.15, aperture: 0.8, maxCoc: 9, bloom: 0.07, grain: 0.035, vignette: 0.6, ca: 0.01, sat: 0.95, tintShadow: [0.93, 0.98, 1.05], tintHigh: [1.04, 1.0, 0.94] },
    fire: { exposure: 0.6, aperture: 0.7, maxCoc: 9, bloom: 0.12, bloomThresh: 1.0, grain: 0.04, vignette: 0.65, ca: 0.012, sat: 1.0, tintShadow: [1.0, 0.95, 0.92], tintHigh: [1, 1, 1] },
    life: { exposure: 1.05, aperture: 0.9, maxCoc: 9, bloom: 0.08, grain: 0.03, vignette: 0.55, ca: 0.01, sat: 1.0, tintShadow: [0.95, 0.98, 1.04], tintHigh: [1.03, 1.0, 0.95] },
    brk: { exposure: 1.1, aperture: 0.6, maxCoc: 8, bloom: 0.12, grain: 0.035, vignette: 0.65, ca: 0.012, sat: 1.0, tintShadow: [0.95, 0.97, 1.05], tintHigh: [1.03, 1.0, 0.94] },
    seam: { exposure: 1.0, aperture: 0.6, maxCoc: 9, bloom: 0.14, bloomThresh: 1.0, grain: 0.03, vignette: 0.6, ca: 0.01, sat: 1.0, tintShadow: [0.96, 0.98, 1.04], tintHigh: [1.04, 1.0, 0.93] },
  };
  const grade = (k, o) => Object.assign({}, GRADE[k], o || {});

  // ---------------------------------------------------------------- sync cues for the score
  Object.assign(TL.CUE, {
    brush0: bar(1) + 0.3, brush1: bar(3.6),
    clay0: CLAY0, fire0: FIRE0, firePeak: FIRE0 + 26, door0: FIRE0 + 31, crack0: FIRE0 + 32, crack1: FIRE0 + 39.5,
    life0: LIFE0, pour: LIFE0 + 1.8,
    lift: LIFE0 + 50, fall: bar(46.2), shatter: BRK0,
    memories: [bar(49.5), bar(51), bar(52.5), bar(54)],
    goldArrive: SEAM0 + 7.0, ensoGold: bar(74.3),
  });

  // ================================================================ ENSŌ (paper)
  // The circle is painted in one breath. In the transition it grows to match the
  // rim of the wheel head seen from above.
  const ensoZoom = track([[0, 1.6], [bar(5), 1.32, 'sine'], [bar(6), 1.0, 'io']]);
  const enso = (t) => ({
    scene: 'enso',
    bag: {
      uTime: t, uStroke: track([[bar(1) + 0.3, 0], [bar(3.6), 1.0, 'io']])(t),
      uWet: 1 - sm(bar(3.4), bar(5.5), t), uGoldInk: 0, uZoom: ensoZoom(t), uCenter: [0, 0], uPaperL: 1.0, uFadeInk: 0,
    },
    cam: null,
    post: grade('enso', { fade: sm(0, 2.0, t) }),
  });

  // ================================================================ CLAY
  const clay = (() => {
    const S = Bowl.STAGES;
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
    const rps = track([[-4, 1.6], [18, 1.6], [21.5, 0.0, 'out']]);
    const spinTable = [];
    { let a = 0; for (let x = -4; x <= 40; x += 0.05) { spinTable.push(a); a += rps(x) * 0.05 * Math.PI * 2; } }
    const spinAt = lt => { const i = clamp((lt + 4) / 0.05, 0, spinTable.length - 1); const i0 = Math.floor(i); return spinTable[i0] + (spinTable[Math.min(i0 + 1, spinTable.length - 1)] - spinTable[i0]) * (i - i0); };
    const dry = track([[22, 0], [30, 1, 'io']]);
    const foot = track([[26, 0], [29.5, 1, 'io']]);
    const glaze = track([[30, 0], [34, 1, 'io']]);
    const sunA = track([[0, 0.0], [21, 0.1], [34, 1.0, 'io']]);
    const camPath = path([[0.0, 4.7, -0.01], [0.3, 3.3, -1.1], [1.1, 1.95, -2.35], [1.9, 1.35, -2.35], [2.4, 1.2, -1.5], [2.4, 1.3, -0.9]]);
    const camU = track([[0, 0], [9, 0.36, 'io'], [30, 0.86, 'io'], [36.7, 1.0, 'io']]);
    return (t) => {
      const lt = t - CLAY0;
      const prof = profileAt(lt);
      const a = sunA(lt);
      const sun = V.norm([-1.0, mix(0.55, 0.28, a), mix(-0.25, 0.35, a)]);
      // before the shot starts (during the ink transition) the camera descends with the ensō zoom
      const eye = lt < 0 ? [0, 4.7 * ensoZoom(t), -0.01] : camPath(camU(lt));
      const tgt = [0, 0.3, 0];
      const up = V.norm(V.mix([0, 0, 1], [0, 1, 0], sm(0.5, 7, lt)));
      const wet = 1 - dry(lt);
      return {
        scene: 'studio',
        bag: Object.assign({}, BOWL_BASE, {
          uTime: t, uLocal: lt, uProf: Bowl.packProfile(prof), uFootTh: Bowl.FOOT.th * foot(lt),
          uSpin: spinAt(lt), uWheelSpin: spinAt(lt), uRidge: 0.0022 * wet, uWet: wet, uDry: dry(lt),
          uGlazeRaw: glaze(lt), uMelt: 0, uHeat: 0, uAsh: 0, uCrackle: 0, uStain: 0, uGold: 0,
          uWobble: 0.012 * sm(14, 18, lt), uOval: 0.015 * sm(20, 26, lt),
          uSun: sun, uSunCol: V.mul(mix([1.0, 0.95, 0.88], [1.0, 0.72, 0.45], a), 5.0), uWater: wet, uDust: 1, uWarm: 0.15 + 0.6 * a,
        }),
        cam: { eye, tgt, fov: 0.34, up },
        post: grade('clay'),
      };
    };
  })();

  // ================================================================ FIRE
  const fire = (() => {
    // arc: darkness and a few licks -> the build -> white heat -> the fire dies -> dawn at the door
    const fireK = track([[0, 0.12], [5, 0.3, 'io'], [15, 0.72, 'io'], [21, 1.0, 'io'], [26, 1.0], [29.5, 0.0, 'in']]);
    const wallK = track([[0, 0.0], [6, 0.18, 'in'], [16, 0.65, 'io'], [22, 1.0, 'io'], [26, 1.0], [33, 0.0, 'out']]);
    const white = track([[18, 0], [21.5, 1.0, 'io'], [24.5, 1.0], [27.5, 0.0, 'io']]);
    const heat = track([[4, 0.0], [20, 0.95, 'io'], [26, 1.0], [34, 0.0, 'out']]);
    const melt = track([[10, 0.0], [21, 1.0, 'io']]);
    const ash = track([[4, 0.0], [24, 0.55, 'io']]);
    const ember = track([[25, 0], [30, 1.0, 'io'], [40, 0.35, 'io']]);
    const door = track([[31, 0], [38, 1.0, 'io']]);
    const crackle = track([[32, 0], [39, 1.0, 'lin']]);
    const expo = track([[0, 1.3], [12, 0.95, 'io'], [22, 0.58, 'io'], [26, 0.58], [31, 0.85, 'io'], [36, 1.0, 'io']]);
    // camera: from the studio's last view, down to the floor among the first flames, a slow
    // push toward the rim as the glaze melts, then back as the door opens
    const camPath = path([[2.4, 1.3, -0.9], [2.0, 0.4, -2.5], [1.25, 0.42, -2.55], [0.8, 0.62, -2.0], [0.55, 0.78, -1.7], [0.4, 0.85, -1.6]]);
    const camU = track([[0, 0], [7, 0.25, 'io'], [22, 0.55, 'io'], [30, 0.72, 'io'], [38, 1.0, 'io']]);
    const tgtT = track([[0, [0, 0.35, 0]], [7, [-0.1, 0.5, 0.7], 'io'], [22, [-0.1, 0.45, 0.3], 'io'], [30, [0, 0.42, 0.15], 'io'], [38, [0.05, 0.45, 0.2], 'io']]);
    return (t) => {
      const lt = t - FIRE0;
      const eye = camPath(camU(lt)), tgt = tgtT(lt);
      return {
        scene: 'kiln',
        bag: Object.assign({}, BOWL_BASE, {
          uTime: t, uLocal: lt, uWet: 0, uDry: 1, uGlazeRaw: 1, uMelt: melt(lt), uHeat: heat(lt), uAsh: ash(lt),
          uCrackle: crackle(lt), uStain: 0, uGold: 0,
          uFire: fireK(lt), uWallT: wallK(lt), uDoor: door(lt), uEmber: ember(lt), uWhite: white(lt),
        }),
        cam: { eye, tgt, fov: 0.34 },
        post: grade('fire', { exposure: expo(lt), shimmer: fireK(lt) * (0.4 + 0.6 * white(lt)) }),
      };
    };
  })();

  // ================================================================ LIFE
  // A lifetime at the table, in time-lapse. Continuous "day counter" D: fractional
  // part is the time of day.
  const P_IMP = [0.3, -3.3, -5.2];              // where the bowl will land
  const life = (() => {
    const D = track([[-4, 0.235], [0, 0.245], [4, 0.36, 'sine'], [43.3, 11.3, 'lin'], [50, 12.36, 'out'], [60, 12.42, 'lin']]);
    const season = track([[0, 0.05], [15, 1.0, 'lin'], [28, 2.0, 'lin'], [40, 2.9, 'lin'], [44, 3.0]]);
    const stain = track([[5, 0.0], [40, 0.7, 'lin']]);
    const gapT = track([[5, 1.45], [38, 0.84, 'io']]);
    const open = track([[0, 0.45], [20, 0.55], [30, 0.3], [40, 0.12], [58, 0.1]]);
    const hash = x => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    // lift and fall
    const HOLD = [0.3, 1.8, -5.15];
    const liftP = track([[50, [0, 0, 0]], [53.0, HOLD, 'io']]);
    const cam = path([
      [0.4, 0.85, -1.6], [0.95, 0.78, -2.45], [1.8, 0.82, -2.65], [2.45, 0.88, -2.0], [2.7, 0.92, -1.15],
    ]);
    const camU = track([[-3.4, 0], [5, 0.28, 'io'], [43.3, 1.0, 'sine']]);
    return (t) => {
      const lt = t - LIFE0;
      // time-lapse warp: nights pass quickly, days linger (no strobing at 3.5 s/day)
      const d0 = D(lt), dayN = Math.floor(d0), fr = d0 - dayN;
      const wk = sm(4, 6, lt) * (1 - sm(41, 43.3, lt));
      const nightFast = fr < 0.1 ? fr / 0.1 * 0.21 : fr > 0.9 ? 0.79 + (fr - 0.9) / 0.1 * 0.21 : 0.21 + (fr - 0.1) / 0.8 * 0.58;
      const day = mix(fr, nightFast, wk);
      const d = dayN + day;
      const s = season(lt);
      const two = (dayN >= 1 && dayN < 11) ? 1 : 0;          // the tenmoku arrives on day 1, is gone after day 10
      // tea each morning, drunk through the day
      const teaMorning = sm(0.26, 0.3, day) * (1 - sm(0.42, 0.62, day));
      const pour = lt < 4 ? sm(1.8, 4.2, lt) : 1;               // the very first pour
      const alone = dayN >= 11;
      const tea = alone ? 0 : 0.62 * (dayN === 0 ? pour : teaMorning);
      const tea2 = two ? 0.6 * sm(0.27, 0.31, day) * (1 - sm(0.45, 0.65, day)) : 0;
      const gap = gapT(lt) + (hash(dayN) - 0.5) * 0.12 * (1 - sm(34, 38, lt));
      const candle = (s > 1.7 && two && (day > 0.8 || day < 0.2)) ? 1 : 0;
      // the lift, the tremble, the slip, the fall (slow motion)
      let off = [0, 0, 0], tilt = 0;
      if (lt > 50) {
        off = liftP(Math.min(lt, 53.0));
        const tr = sm(53, 57, lt);
        off = V.add(off, [0.02 * tr * Math.sin(lt * 23.0), 0.015 * tr * Math.sin(lt * 31.0 + 1), 0.02 * tr * Math.sin(lt * 17.0 + 2)]);
        tilt = 0.06 * tr * Math.sin(lt * 13.0);
        const tf = lt - (TL.CUE.fall - LIFE0);
        if (tf > 0) {
          const k = (TL.CUE.shatter - TL.CUE.fall);                // film seconds of falling
          const u = Math.min(1, tf / k);
          // it tumbles as it falls and lands on its foot, exactly where the shatter begins
          off = [HOLD[0] + (P_IMP[0] - HOLD[0]) * u, HOLD[1] + (P_IMP[1] - HOLD[1]) * u * u, HOLD[2] + (P_IMP[2] - HOLD[2]) * u];
          tilt = (0.05 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * (1 - u * u);
        }
      }
      const bowlOn = 1;
      // camera
      let eye = cam(camU(lt)), tgt = V.mix([-0.1, 0.35, 0.2], [-0.55, 0.32, 0.4], sm(0, 6, lt));
      if (lt > 43.3) { // alone: closer, lower, slower
        const k = sm(43.3, 49, lt);
        eye = V.mix(eye, [1.1, 0.95, -2.7], k);
        tgt = V.mix(tgt, [-0.35, 0.3, 0.25], k);
      }
      if (lt > 49.5) { // follow the lift: the bowl held up against the shoji
        const k = sm(49.5, 53.5, lt);
        eye = V.mix(eye, [1.9, 1.1, -8.6], k);
        tgt = V.mix(tgt, V.add(off, [0, 0.45, 0]), sm(49.5, 52.5, lt));
      }
      if (lt > 56.0) { // crane down to the floor to meet the fall
        const k = sm(56.0, 60.0, lt);
        eye = V.mix(eye, [1.5, -2.72, -8.1], k);
        tgt = V.add(off, [0, 0.45 - 0.1 * sm(57, 60, lt), 0]);     // keep the falling bowl in frame
      }
      const m = {
        uMemDay: day, uMemSeason: s, uMemTwo: two, uMemGap: gap, uMemCandle: candle, uMemSteam: 1, uMemTea: tea, uMemTea2: tea2,
        uMemOpen: open(lt), uMemRing: alone ? 1 : 0, uBowlOn: bowlOn, uBowlOff: off, uBowlTilt: tilt, uBeams: 0.6,
      };
      return {
        scene: 'life',
        bag: Object.assign({}, BOWL_BASE, m, { uTime: t, uLocal: lt, uStain: stain(lt) }),
        cam: { eye, tgt, fov: 0.3 },
        post: grade('life'),
      };
    };
  })();

  // ================================================================ BREAK
  const brk = (() => {
    const MEM_SHARDS = [1, 4, 5, 13];                    // spring pair, candle night, touching, first morning
    const origin = track([[0, P_IMP], [3, P_IMP], [26, [0, 0, 0], 'io']]);
    const lowEye = [1.5, -2.72, -8.1];
    function poseAt(lt, eye) {
      const gather = sm(24.5, 29.4, lt);
      return Shatter.pose({
        origin: origin(lt), explode: 0.09 * (1 - Math.exp(-lt / 0.6)), spread: sm(1.2, 9, lt) * (1 - gather),
        face: sm(5, 11, lt) * (1 - sm(22, 25, lt)), eye, drift: lt, gather,
      });
    }
    const shardPos = (P, i) => [P.uShardP[i * 4], P.uShardP[i * 4 + 1], P.uShardP[i * 4 + 2]];
    // camera visits: eye positions computed from the shard positions at visit times
    const visits = TL.CUE.memories || [];
    const plan = [];
    for (let k = 0; k < MEM_SHARDS.length; k++) {
      const lt = (visits[k] ?? (BRK0 + 8 + k * 5)) - BRK0;
      const P0 = poseAt(lt, [0, 0, 0]);
      const p = shardPos(P0, MEM_SHARDS[k]);
      const o = origin(lt);
      const out = V.norm(V.add(V.sub(p, o), [0, 0.35, 0]));
      plan.push({ lt, p, eye: V.add(p, V.mul(out, 0.85)) });
    }
    // final approach into the crack (matches the seam scene's first frame)
    const SEAMP = Bowl.traceSeam(0.40, -1.03, 44, 0.008).slice(4);
    const s0 = SEAMP[2];
    const seamEye = V.add(s0.p, V.mul(s0.n, 0.010));
    const seamFwd = V.norm(V.sub(SEAMP[8].p, s0.p));
    const seamTgt = V.add(seamEye, V.add(seamFwd, V.mul(s0.n, -0.1)));
    return (t) => {
      const lt = t - BRK0;
      // camera: rise from the floor with the shards, then shard to shard
      let eye, tgt;
      const o = origin(lt);
      if (lt < plan[0].lt) {
        const k = sm(0.6, plan[0].lt, lt);
        eye = V.mix(V.add(lowEye, V.sub(o, P_IMP)), plan[0].eye, k * k);
        tgt = V.mix(V.add(o, [0, 0.35 + 0.55 * sm(1, 6, lt), 0]), plan[0].p, sm(2, plan[0].lt, lt));
      } else {
        let k = 0;
        while (k < plan.length - 1 && lt > plan[k + 1].lt) k++;
        if (k < plan.length - 1) {
          const a = plan[k], b = plan[k + 1];
          const u = ease.io(clamp((lt - a.lt - 1.2) / (b.lt - a.lt - 2.0), 0, 1));
          // arc outward between visits
          const mid = V.add(V.mix(a.eye, b.eye, u), V.mul(V.norm(V.sub(V.mix(a.eye, b.eye, 0.5), o)), 0.9 * Math.sin(Math.PI * u)));
          eye = mid; tgt = V.mix(a.p, b.p, u);
        } else {
          const a = plan[plan.length - 1];
          // after the last memory: pull back to see the shards gather, then dive into the crack
          const k2 = sm(a.lt + 1.5, 25.5, lt);
          const wide = V.add(o, [2.2, 1.5, -2.6]);
          eye = V.mix(a.eye, wide, k2);
          tgt = V.mix(a.p, V.add(o, [0, 0.35, 0]), k2);
          const dive = sm(26.2, 30.0, lt);
          const dv = 1 - Math.pow(1 - dive, 2.2);
          eye = V.mix(eye, seamEye, dv);
          tgt = V.mix(tgt, seamTgt, sm(26.2, 29.2, lt));
        }
      }
      const pose = poseAt(lt, eye);
      const m = {
        uMemDay: 0.4, uMemSeason: 3.0, uMemTwo: 0, uMemGap: 1.45, uMemCandle: 0, uMemSteam: 0, uMemTea: 0, uMemTea2: 0,
        uMemOpen: 0.1, uMemRing: 1,
      };
      const nearCrack = sm(27.0, 30.0, lt);
      const up = V.norm(V.mix([0, 1, 0], s0.n, sm(27.5, 30, lt)));
      return {
        scene: 'break',
        bag: Object.assign({}, BOWL_BASE, m, pose, Shatter.MEM, {
          uTime: t, uLocal: lt, uStain: 0.7, uShardScale: 1, uShardN: Shatter.packN(),
          uVoid: sm(1.0, 7.0, lt), uPortal: sm(4.5, 8.5, lt) * (1 - sm(23.5, 26.5, lt)),
          uGoldEdge: sm(25, 29, lt), uGoldGlow: sm(25, 27.5, lt), uImpact: P_IMP,
          uKeyDir: V.norm([-0.6, 0.8, -0.3]), uSpecks: sm(1, 5, lt) * (1 - nearCrack),
        }),
        cam: { eye, tgt, fov: mix(0.3, 0.36, nearCrack), up },
        post: grade('brk', { focus: nearCrack > 0 ? mix(V.len(V.sub(tgt, eye)), 0.07, nearCrack) : undefined }),
      };
    };
  })();

  // ================================================================ SEAM
  const SEAM_FAR = V.norm([2.0, 1.84, -2.2]);
  const seam = (() => {
    const src = Shatter.IMPACT_LOCAL;
    const SEAMP = Bowl.traceSeam(0.40, -1.03, 44, 0.008).slice(4);
    const seamPos = path(SEAMP.map(q => q.p));
    const seamNrm = path(SEAMP.map(q => q.n));
    const alt = track([[0, 0.010], [11, 0.014, 'sine'], [27, 2.3, 'io3']]);
    const glory = track([[13, 0], [20, 1.0, 'io'], [34, 1.0]]);
    const tgtBlend = track([[12, 0], [25, 1, 'io']]);
    const orbit = track([[27, 0], [36.7, 0.5, 'io']]);
    return (t) => {
      const lt = t - SEAM0;
      const u = 0.047 + clamp(lt / 27, 0, 1) * 0.16;
      const P = seamPos(u), N = V.norm(seamNrm(u));
      const A = alt(lt);
      const ahead = Math.min(1, u + 0.05 + A * 0.4);
      const fwd = V.norm(V.sub(seamPos(ahead), P));
      const eyeNear = V.add(P, V.mul(N, A));
      const lookNear = V.add(eyeNear, V.add(fwd, V.mul(N, -0.1 - A * 1.5)));
      const w = sm(0.02, 1.8, A);
      const back = V.add(V.add(P, V.mul(N, A)), V.mul(fwd, -A * 0.8));
      // far: the whole bowl, orbiting slowly toward the room's first view
      const az = orbit(lt);
      const farDir = V.norm([SEAM_FAR[0] * Math.cos(az) - SEAM_FAR[2] * Math.sin(az), SEAM_FAR[1] * (1 - 0.25 * az), SEAM_FAR[0] * Math.sin(az) + SEAM_FAR[2] * Math.cos(az)]);
      const eye = V.mix(back, V.add([0, 0.36, 0], V.mul(farDir, A)), w * w);
      const tgt = V.mix(lookNear, [0, 0.36, 0], tgtBlend(lt));
      const up = V.norm(V.mix(N, [0, 1, 0], sm(12, 24, lt)));
      const keyNear = V.norm(V.add(fwd, V.mul(N, 0.22)));
      const key = V.norm(V.mix(keyNear, [-0.45, 0.5, 0.75], sm(12, 22, lt)));
      const flow = 0.02 + 0.042 * Math.max(lt, 0) + Math.max(0, lt - 12) * 0.05;
      const focus = mix(A * 7.0, V.len(V.sub(tgt, eye)), sm(9, 18, lt));
      return {
        scene: 'seam',
        bag: Object.assign({}, BOWL_BASE, {
          uTime: t, uLocal: lt, uStain: 0.7, uGold: 0, uGap: 0.0016, uFlow: flow, uSource: src, uCool: 0.45,
          uKeyDir: key, uRoomLight: sm(29, 36.7, lt), uAlt: A,
          uGlory: glory(lt), uGloryDir: V.norm([-farDir[0], 0.35, -farDir[2]]),
        }),
        cam: { eye, tgt, fov: 0.36, up },
        post: grade('seam', { focus }),
      };
    };
  })();

  // ================================================================ MENDED
  const mended = (() => {
    const seamEnd = seam(MEND0 + 0.0);
    const E0 = seamEnd.cam.eye;
    const cam = path([E0, [1.6, 1.35, -2.6], [0.9, 1.25, -3.0], [0.2, 1.9, -2.2], [0.05, 3.0, -0.6], [0.0, 3.33, -0.001]]);
    const camU = track([[-1, 0], [10, 0.45, 'io'], [18.5, 1.0, 'io']]);
    return (t) => {
      const lt = t - MEND0;
      const eye = cam(camU(lt));
      const tgt = V.mix([-0.15, 0.33, 0.1], [0, 0.35, 0], sm(8, 16, lt));
      const up = V.norm(V.mix([0, 1, 0], [0, 0, 1], sm(12, 18.5, lt)));
      const m = {
        uMemDay: mix(0.44, 0.5, sm(-1, 22, lt)), uMemSeason: 0.1, uMemTwo: 0, uMemGap: 1.45, uMemCandle: 0, uMemSteam: 1 - sm(8, 13, lt),
        uMemTea: 0.6, uMemTea2: 0, uMemOpen: 0.5, uMemRing: 1, uBowlOn: 1, uBowlOff: [0, 0, 0], uBowlTilt: 0, uBeams: 0.8,
      };
      return {
        scene: 'life',
        bag: Object.assign({}, BOWL_BASE, m, { uTime: t, uLocal: lt, uStain: 0.7, uGold: 1 }),
        cam: { eye, tgt, fov: 0.3, up },
        post: grade('life', { exposure: 1.1 }),
      };
    };
  })();

  // ================================================================ END: the gold ensō and the title
  const ensoEnd = (t) => {
    const stroke = track([[bar(72.9), 0], [bar(74.3), 1.0, 'io']])(t);
    return {
      scene: 'enso',
      bag: { uTime: t, uStroke: stroke, uWet: 0, uGoldInk: 1, uZoom: 1.3, uCenter: [0, 0], uPaperL: 1.0, uFadeInk: 0 },
      cam: null,
      post: grade('enso', { overlay: sm(bar(74.7), bar(75.4), t), fade: 1 - sm(DURATION - 3.5, DURATION - 0.2, t) }),
      overlay: true,
    };
  };

  // ---------------------------------------------------------------- the edit
  const SHOTS = [
    { fn: enso, t0: 0, t1: bar(5) },
    { fn: clay, t0: bar(6), t1: bar(16) },
    { fn: fire, t0: bar(17), t1: bar(28.2) },
    { fn: life, t0: bar(29.2), t1: BRK0 },
    { fn: brk, t0: BRK0, t1: bar(55.8) },
    { fn: seam, t0: bar(56.2), t1: bar(65.6) },
    { fn: mended, t0: bar(67), t1: bar(72.4) },
    { fn: ensoEnd, t0: bar(73.4), t1: 1e9 },
  ];
  // transitions between consecutive shots: [t0, t1, mode, centre]
  const TRANS = [
    [bar(5), bar(6), 2, [0, 0.3, 0]],          // ink bleed: the ensō becomes the wheel
    [bar(16), bar(17), 1, [0, 0.35, 0]],       // ember burn: the studio burns into the kiln
    [bar(28.2), bar(29.2), 5, [0, 0.35, 0]],   // mist: the cooled kiln becomes the first morning
    [BRK0, BRK0, 0, [0, 0, 0]],                // (cut on the impact: same frame, same world)
    [bar(55.8), bar(56.2), 0, [0, 0, 0]],      // the gathered shards become the seam
    [bar(65.6), bar(67), 5, [0, 0.35, 0]],     // the room returns around the mended bowl
    [bar(72.4), bar(73.4), 2, [0, 0.35, 0]],   // top-down bowl dissolves into paper
  ];

  function camBag(c, fallback) {
    const k = c || fallback;
    return { uCamPos: k.eye, uCamRot: GLX.lookAt(k.eye, k.tgt, 0, k.up || null), uFov: k.fov };
  }
  function lerpCam(a, b, x) {
    if (!a) return b; if (!b) return a;
    const up = V.norm(V.mix(a.up || [0, 1, 0], b.up || [0, 1, 0], x));
    return { eye: V.mix(a.eye, b.eye, x), tgt: V.mix(a.tgt, b.tgt, x), fov: mix(a.fov, b.fov, x), up };
  }
  function lerpPost(a, b, x) {
    const o = {};
    for (const k in a) {
      const va = a[k], vb = b[k] === undefined ? va : b[k];
      o[k] = (typeof va === 'number' || Array.isArray(va)) ? mix(va, vb, x) : va;
    }
    for (const k in b) if (!(k in o)) o[k] = b[k];
    return o;
  }
  const FIXED_CAM = { eye: [0, 3, 0], tgt: [0, 0, 0.001], fov: 0.4 };
  function focusOf(cam) { return cam ? V.len(V.sub(cam.tgt, cam.eye)) : 3; }

  function frameAt(t) {
    t = clamp(t, 0, DURATION);
    let A = null, B = null, x = 0, tr = null;
    for (let i = 0; i < TRANS.length; i++) {
      const [a, b] = TRANS[i];
      if (t >= a && t < b) { tr = TRANS[i]; A = SHOTS[i].fn(t); B = SHOTS[i + 1].fn(t); x = (t - a) / (b - a); break; }
    }
    if (!A) {
      let s = SHOTS[SHOTS.length - 1];
      for (let i = 0; i < SHOTS.length; i++) if (t < (i + 1 < SHOTS.length ? (TRANS[i][0] + TRANS[i][1]) / 2 : 1e9)) { s = SHOTS[i]; break; }
      A = s.fn(t);
    }
    const mixv = tr ? ease.sine(x) : 0;
    const cam = B ? lerpCam(A.cam, B.cam, ease.io(x)) : A.cam;
    const cb = camBag(cam, FIXED_CAM);
    const pa = Object.assign({}, Engine.DEFAULT_POST, A.post);
    if (pa.focus === undefined || pa.focus === null || A.post.focus === undefined) pa.focus = focusOf(cam);
    let post = pa;
    if (B) {
      const pb = Object.assign({}, Engine.DEFAULT_POST, B.post);
      if (B.post.focus === undefined) pb.focus = focusOf(cam);
      post = lerpPost(pa, pb, mixv);
    }
    const f = {
      a: { scene: A.scene, bag: Object.assign(A.bag, cb) },
      post,
    };
    if (B) { f.b = { scene: B.scene, bag: Object.assign(B.bag, cb) }; f.mix = mixv; f.mode = tr[2]; f.center = tr[3]; }
    if ((A.overlay || (B && B.overlay)) && post.overlay > 0) f.overlay = titleCard();
    // look-dev overrides from the capture tool
    const ov = Film.override;
    if (ov) {
      for (const k in ov) {
        if (k === 'eye' || k === 'tgt' || k === 'fov') continue;
        if (k in f.post) f.post[k] = ov[k]; else f.a.bag[k] = ov[k];
      }
      if (ov.eye || ov.tgt) {
        const c = { eye: ov.eye || cam.eye, tgt: ov.tgt || cam.tgt, fov: ov.fov || cam.fov };
        Object.assign(f.a.bag, camBag(c));
        f.post.focus = focusOf(c);
      }
    }
    return f;
  }

  const Film = { frameAt, DURATION, SHOTS, BOWL_BASE, override: null };
  return Film;
})();
