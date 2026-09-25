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

  try {
    await R.compileAll(p => { status.textContent = 'preparing ' + Math.round(p * 100) + '%'; });
  } catch (e) {
    console.error(e); status.textContent = 'shader error — see console'; window.__error = e.message; return;
  }

  // ---------------------------------------------------------------- render one frame
  let scaleMax = 1.0;
  let dyn = 0.85;
  function renderAt(t, scale) {
    const f = Film.frameAt(t);
    const s = Math.min(scale, (f.post.scaleMax || 1.0));
    R.resize(canvas.width, canvas.height, s);
    if (f.overlay) R.setOverlay(f.overlay);
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
      renderAt(+ts, +(params.get('scale') || 1)); R.gl.finish(); return 't=' + ts;
    };
    window.__duration = Film.DURATION;
    window.__ready = true;
    status.textContent = '';
    return;
  }

  // ---------------------------------------------------------------- start screen
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
    if (window.Score) {
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
      if (avg > 18.0) dyn = Math.max(0.35, dyn * 0.93);
      else if (avg < 15.2) dyn = Math.min(1.0, dyn * 1.03);
    }
    const t = now();
    renderAt(t, dyn);
    if (dbg) {
      dbg.querySelector('input').value = t;
      dbg.querySelector('span').textContent = t.toFixed(2) + 's  bar ' + (t / TL.BAR).toFixed(2) + '  ' + (1000 / avg).toFixed(0) + 'fps  scale ' + dyn.toFixed(2);
    }
    if (t < Film.DURATION + 1.0 || debug) requestAnimationFrame(loop);
    else { ui.classList.remove('gone'); ui.classList.add('end'); }
  }
})();
