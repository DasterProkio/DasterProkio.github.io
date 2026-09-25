/* Compositor + player UI. Time source = audio clock while playing, so picture follows sound. */
'use strict';
(function () {
  const { W, H, BAR, BEAT, clamp, seg } = PV;
  const view = document.getElementById('view');
  view.width = W; view.height = H;
  const src = PV.mk(W, H), g = src.getContext('2d');
  const buf = PV.mk(W, H), gb2 = buf.getContext('2d');
  let post = null;
  try { post = PV.createFX(view); } catch (e) { console.warn('WebGL post disabled:', e); }
  const view2d = post ? null : view.getContext('2d');

  function state(S, t) {
    const lt = t - S.a * BAR, dur = (S.b - S.a) * BAR, gbeat = t / BEAT;
    return { t, lt, dur, u: clamp(lt / dur), bar: t / BAR, gb: gbeat, lb: lt / BEAT, bf: gbeat % 1 };
  }
  function sceneAt(bar) {
    const L = PV.SCENES;
    for (let i = 0; i < L.length; i++) if (bar >= L[i].a && bar < L[i].b) return i;
    return L.length - 1;
  }
  function merge(fx, o) {
    if (!o) return fx;
    for (const k in o) {
      if (k === 'flash') { if (o.flash[3] >= fx.flash[3]) fx.flash = o.flash; }
      else if (k === 'zoom') fx.zoom *= o.zoom;
      else if (k === 'swirl' || k === 'smearAngle' || k === 'shakeX' || k === 'shakeY') fx[k] = o[k] || fx[k];
      else fx[k] = Math.max(fx[k], o[k]);
    }
    return fx;
  }

  /** plate frames a render at time t will touch: [[plate, localTime], ...] (export pre-loading) */
  PV.platesAt = function (t) {
    const bar = t / BAR, i = sceneAt(bar), S = PV.SCENES[i], out = [];
    if (S.plate) out.push([S.plate, t - S.a * BAR]);
    const P = PV.SCENES[i - 1];
    if (S.xin && P && P.plate && bar < S.a + S.xin) out.push([P.plate, t - P.a * BAR]);
    return out;
  };

  PV.renderAt = function (t) {
    t = clamp(t, 0, PV.LENGTH - 1e-3);
    const bar = t / BAR, i = sceneAt(bar), S = PV.SCENES[i];
    const fx = { ...PV.FX_DEFAULT, flash: [1, 1, 1, 0] };
    PV.LB = Math.round((H * 60) / 720 * PV.lboxAt(bar)); // 2.13:1 letterbox; scenes keep HUD inside it
    fx.lbox = PV.LB / H;
    g.save();
    const sfx = S.draw(g, state(S, t));
    g.restore();
    merge(fx, sfx);
    if (S.xin && i > 0 && bar < S.a + S.xin) {
      // cross-dissolve: previous scene underneath, current scene on top with rising alpha
      gb2.drawImage(src, 0, 0);
      const P = PV.SCENES[i - 1];
      g.save(); P.draw(g, state(P, t)); g.restore();
      g.globalAlpha = PV.E.ioQ(seg(bar, S.a, S.a + S.xin));
      g.drawImage(buf, 0, 0);
      g.globalAlpha = 1;
    }
    for (const T of PV.TRANS) {
      if (bar < T.a || bar >= T.b) continue;
      const k = seg(bar, T.a, T.b);
      if (T.draw) { g.save(); T.draw(g, k); g.restore(); }
      if (T.fx) merge(fx, T.fx(k));
    }
    if (post) post(src, fx, t);
    else {
      view2d.drawImage(src, 0, 0);
      view2d.fillStyle = '#000'; view2d.fillRect(0, 0, W, PV.LB); view2d.fillRect(0, H - PV.LB, W, PV.LB);
    }
    PV.platesEndFrame();
    PV.platesPrefetch(bar);
    return S.name;
  };

  /* ---------- player ---------- */
  const audio = new PV.Audio();
  const ui = {
    gate: document.getElementById('gate'),
    play: document.getElementById('play'),
    mute: document.getElementById('mute'),
    bar: document.getElementById('scrub'),
    fillEl: document.getElementById('fill'),
    tc: document.getElementById('tc'),
    info: document.getElementById('info'),
  };
  const params = new URLSearchParams(location.search);
  let clockStart = null, clockPos = +params.get('t') || 0, playing = false, debug = params.has('debug');
  audio.pos = clockPos;
  const now = () => (audio.playing ? audio.now() : playing ? clockPos + (performance.now() - clockStart) / 1000 : clockPos);

  function setPlaying(p) {
    playing = p;
    ui.play.textContent = p ? 'Ⅱ' : '▶';
    if (p) { clockStart = performance.now(); try { audio.play(clockPos); } catch (e) { console.warn(e); } }
    else { clockPos = now(); audio.pause(); }
  }
  function seek(t) {
    clockPos = clamp(t, 0, PV.LENGTH);
    clockStart = performance.now();
    if (playing) audio.play(clockPos); else audio.pos = clockPos;
  }
  PV.player = { setPlaying, seek, now, isPlaying: () => playing };

  function loop() {
    let t = now();
    if (t >= PV.LENGTH) { setPlaying(false); clockPos = t = PV.LENGTH - 0.001; }
    const name = PV.renderAt(t);
    ui.fillEl.style.width = (t / PV.LENGTH) * 100 + '%';
    const b = t / BAR;
    ui.tc.textContent = `${t.toFixed(2).padStart(5, '0')}s · bar ${String(Math.floor(b) + 1).padStart(2, '0')}.${Math.floor((t / BEAT) % 4) + 1}`;
    ui.info.textContent = debug ? name : '';
    requestAnimationFrame(loop);
  }

  ui.gate.addEventListener('click', () => { ui.gate.classList.add('gone'); setPlaying(true); });
  ui.play.addEventListener('click', () => setPlaying(!playing));
  ui.mute.addEventListener('click', () => { audio.setMuted(!audio.muted); ui.mute.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON'; });
  const scrubTo = e => { const r = ui.bar.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * PV.LENGTH); };
  ui.bar.addEventListener('pointerdown', e => { scrubTo(e); ui.bar.setPointerCapture(e.pointerId); });
  ui.bar.addEventListener('pointermove', e => { if (e.buttons) scrubTo(e); });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); ui.gate.classList.add('gone'); setPlaying(!playing); }
    if (e.code === 'ArrowRight') seek(now() + BAR);
    if (e.code === 'ArrowLeft') seek(now() - BAR);
    if (e.key === 'd') debug = !debug;
  });

  const fontsReady = document.fonts ? Promise.race([
    Promise.all([
      ...['208px "Archivo Black"', '13px "Archivo"', '10px "JetBrains Mono"'].map(f => document.fonts.load(f)),
      ...['500', '700', '900'].map(w => document.fonts.load(`${w} 20px "Noto Sans SC"`, PV.cjkText())),
    ]),
    new Promise(r => setTimeout(r, 2500)),
  ]) : Promise.resolve();
  fontsReady.then(() => {
    PV.ready = true;
    if (params.has('still')) { PV.renderAt(clockPos); ui.gate.classList.add('gone'); return; }
    requestAnimationFrame(loop);
  });
})();
