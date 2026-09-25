// Boot, clock, dynamic resolution, debug and capture hooks.
(async function main() {
  const canvas = document.getElementById('film');
  const ui = document.getElementById('ui');
  const status = document.getElementById('status');
  const params = new URLSearchParams(location.search);
  const capture = params.has('capture');
  const debug = /debug/.test(location.hash) || params.has('debug');

  let R;
  try {
    R = new Engine.Renderer(canvas, Object.assign({ preserve: capture }, SRC));
  } catch (e) { status.textContent = e.message; return; }

  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    let w = vw, h = vw / Engine.ASPECT;
    if (h > vh) { h = vh; w = vh * Engine.ASPECT; }
    const dpr = capture ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  layout();
  window.addEventListener('resize', layout);

  // the score renders in a worker while the shaders compile
  let pShader = 0, pAudio = 0;
  const showProgress = () => { status.textContent = 'preparing ' + Math.round((pShader * 0.5 + pAudio * 0.5) * 100) + '%'; };
  const audioReady = (window.Score && !capture) ? Score.prepare(p => { pAudio = p; showProgress(); }).catch(e => { console.warn(e); return null; }) : Promise.resolve(null);
  try {
    await R.compileAll(p => { pShader = p; showProgress(); });
  } catch (e) {
    console.error(e); status.textContent = 'shader error — see console'; window.__error = e.message; return;
  }

  // ---------------------------------------------------------------- render one frame
  // Per-scene performance budget. Relative per-pixel cost of each scene (measured with
  // SwiftShader, life = 1); a transition pays for both scenes. The render scale is
  // k / sqrt(cost), so a cut into an expensive scene drops resolution on the same frame,
  // and the controller only has to learn one number, k, for the machine.
  const COST = { enso: 0.35, studio: 1.0, kiln: 2.0, life: 1.0, break: 2.6, seam: 1.7 };
  const frameCost = f => (COST[f.a.scene] || 1) + (f.b && f.mix > 0 ? (COST[f.b.scene] || 1) : 0);
  let lastOverlay = null, lastScale = 0;
  let dyn = 0.9;                       // the budget k
  function renderAt(t, k, fixed) {
    const f = Film.frameAt(t);
    let s = fixed ? k : Math.min(1.0, Math.max(0.35, k / Math.sqrt(frameCost(f))));
    s = Math.min(Math.round(s * 20) / 20, f.post.scaleMax || 1.0);   // quantised: targets are not reallocated every frame
    lastScale = s;
    R.resize(canvas.width, canvas.height, s);
    if (f.overlay && f.overlay !== lastOverlay) { R.setOverlay(f.overlay); lastOverlay = f.overlay; }
    R.frame(f);
    return f;
  }

  if (capture) {
    ui.style.display = 'none';
    // arg: "t" or "t:key=v,key=v1;v2;v3" (overrides merged into the scene uniforms/post)
    window.__renderAt = arg => {
      const [ts, ov] = String(arg).split(':');
      Film.override = {};
      if (ov) for (const kv of ov.split(',')) {
        const [k, v] = kv.split('=');
        const vals = v.split(';').map(Number);
        Film.override[k] = vals.length > 1 ? vals : vals[0];
      }
      // ?k=… renders with the live per-scene budget (as playback would); default is full resolution
      if (params.has('k')) renderAt(+ts, +params.get('k'), false); else renderAt(+ts, +(params.get('scale') || 1), true);
      R.gl.finish(); return 't=' + ts;
    };
    window.__duration = Film.DURATION;
    window.__ready = true;
    status.textContent = '';
    return;
  }

  // ---------------------------------------------------------------- start screen
  await audioReady;
  status.textContent = '';
  ui.classList.add('ready');
  let t0 = 0, startAt = 0, paused = false, pauseT = 0;
  const hashT = /t=([\d.]+)/.exec(location.hash);
  if (hashT) startAt = +hashT[1];

  let audio = null;
  function now() {
    if (paused) return pauseT;
    if (audio) return audio.time();
    return (performance.now() - t0) / 1000 + startAt;
  }

  async function begin() {
    ui.classList.add('gone');
    if (window.Score && Score.buffer) {
      try { audio = await Score.start(startAt); } catch (e) { console.warn('audio failed', e); audio = null; }
    }
    t0 = performance.now();
    requestAnimationFrame(loop);
  }
  ui.addEventListener('click', begin, { once: true });

  // ---------------------------------------------------------------- debug
  let dbg = null;
  if (debug) {
    dbg = document.createElement('div');
    dbg.id = 'dbg';
    dbg.innerHTML = '<input type=range min=0 max=' + Film.DURATION + ' step=0.01 value=0 style="width:100%"><span></span>';
    document.body.appendChild(dbg);
    const range = dbg.querySelector('input');
    range.addEventListener('input', () => seek(+range.value));
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { paused ? resume() : pause(); e.preventDefault(); }
      if (e.code === 'ArrowRight') seek(now() + 5);
      if (e.code === 'ArrowLeft') seek(now() - 5);
    });
  }
  function pause() { pauseT = now(); paused = true; audio && audio.pause(); }
  function resume() { paused = false; seek(pauseT); }
  function seek(t) {
    t = Math.max(0, Math.min(Film.DURATION, t));
    if (paused) { pauseT = t; return; }
    startAt = t; t0 = performance.now();
    if (audio) audio.seek(t);
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now(), avg = 16.7, frames = 0;
  function loop() {
    const nowMs = performance.now();
    const dt = nowMs - last; last = nowMs;
    avg = avg * 0.92 + Math.min(dt, 100) * 0.08;
    frames++;
    // dynamic resolution: keep frame time under ~16.7 ms
    if (frames > 30 && frames % 10 === 0) {
      if (avg > 18.0) dyn = Math.max(0.3, dyn * 0.93);
      else if (avg < 15.2) dyn = Math.min(1.7, dyn * 1.03);
    }
    const t = now();
    renderAt(t, dyn);
    if (dbg) {
      dbg.querySelector('input').value = t;
      dbg.querySelector('span').textContent = t.toFixed(2) + 's  bar ' + (t / TL.BAR).toFixed(2) + '  ' + (1000 / avg).toFixed(0) + 'fps  scale ' + lastScale.toFixed(2) + '  k ' + dyn.toFixed(2);
    }
    if (t < Film.DURATION + 1.0 || debug) requestAnimationFrame(loop);
    else { ui.classList.remove('gone'); ui.classList.add('end'); }
  }
})();
