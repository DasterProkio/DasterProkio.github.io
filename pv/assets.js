/* Content slots + Cycles plates.
   - PV.art(key)      → canvas/image for an art slot (configured image, else an original placeholder figure)
   - PV.logo(...)     → draws a configured logo, else a labelled placeholder
   - PV.plate(g, ...) → draws the pre-rendered 3D plate for a shot at local time lt, if loaded */
'use strict';
(function () {
  const { W, H, C, TAU, clamp, hash } = PV;
  const CFG = PV.CONFIG;
  const q = new URLSearchParams(location.search);
  if (q.get('bust')) CFG.operator.bust = q.get('bust');
  if (q.get('full')) CFG.outfit.art = q.get('full');
  if (q.get('logo')) CFG.game.logo = q.get('logo');

  PV.F.cjk = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", "WenQuanYi Zen Hei", sans-serif';
  for (const k of ['mono', 'sans', 'black']) PV.F[k] += ', ' + PV.F.cjk;

  /* ---------- images ---------- */
  const imgs = {};
  PV.img = url => {
    if (!url) return null;
    if (!imgs[url]) { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = url; imgs[url] = im; }
    const im = imgs[url];
    return im.complete && im.naturalWidth ? im : null;
  };
  /** draw image to cover (or contain) a box, with focal point fx/fy */
  PV.drawFit = (g, im, x, y, w, h, contain = false, fx = 0.5, fy = 0.3) => {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const s = contain ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    g.drawImage(im, x + (w - dw) * fx, y + (h - dh) * (contain ? 0.5 : fy), dw, dh);
  };

  /* ---------- placeholder figures (original, deliberately generic) ---------- */
  const A2 = CFG.accent2;
  function figureStyle(x, h) {
    const gr = x.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#d9dbe3'); gr.addColorStop(1, '#a4a9b8');
    return gr;
  }
  function vine(x, pts, leaf) {
    x.strokeStyle = C.cyanD; x.lineWidth = 3; x.beginPath();
    x.moveTo(...pts[0]);
    for (let i = 1; i < pts.length - 2; i += 3) x.bezierCurveTo(...pts[i], ...pts[i + 1], ...pts[i + 2]);
    x.stroke();
    leaf.forEach(([lx, ly, a, s]) => {
      x.save(); x.translate(lx, ly); x.rotate(a);
      x.fillStyle = C.cyan; x.beginPath(); x.ellipse(s * 0.9, 0, s, s * 0.42, 0, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(s * 1.7, 0); x.stroke();
      x.restore();
    });
  }
  function slotLabel(x, w, h, title, sub) {
    x.setLineDash([10, 8]); x.strokeStyle = 'rgba(40,44,52,.45)'; x.lineWidth = 2;
    x.strokeRect(8, 8, w - 16, h - 16); x.setLineDash([]);
    [[8, 8, 1, 1], [w - 8, 8, -1, 1], [8, h - 8, 1, -1], [w - 8, h - 8, -1, -1]].forEach(([a, b, sx, sy]) => {
      x.strokeStyle = 'rgba(40,44,52,.8)'; x.lineWidth = 4; x.beginPath(); x.moveTo(a, b + 30 * sy); x.lineTo(a, b); x.lineTo(a + 30 * sx, b); x.stroke();
    });
    x.fillStyle = 'rgba(26,27,30,.82)'; x.fillRect(24, 28, 330, 64);
    x.fillStyle = '#fff'; x.font = `700 22px ${PV.F.sans}`; x.textBaseline = 'middle'; x.textAlign = 'left';
    x.fillText(title, 40, 48);
    x.font = `14px ${PV.F.mono}`; x.fillStyle = C.cyanL; x.fillText(sub, 40, 76);
  }
  // half-body: head, bob hair, collar, halo, vines
  function bust() {
    const w = 900, h = 900, c = PV.mk(w, h), x = c.getContext('2d');
    x.strokeStyle = A2; x.lineWidth = 7; x.beginPath(); x.ellipse(450, 215, 190, 44, -0.12, 0, TAU); x.stroke();
    x.fillStyle = figureStyle(x, h);
    x.beginPath(); // shoulders + torso
    x.moveTo(90, h); x.bezierCurveTo(110, 720, 220, 640, 360, 610); x.lineTo(400, 540); x.lineTo(500, 540); x.lineTo(540, 610);
    x.bezierCurveTo(680, 640, 790, 720, 810, h); x.closePath(); x.fill();
    x.beginPath(); x.ellipse(450, 390, 118, 142, 0, 0, TAU); x.fill(); // head
    x.fillStyle = '#8d93a4'; x.beginPath(); // hair: bob with pointed ends
    x.moveTo(305, 520); x.bezierCurveTo(280, 330, 330, 220, 450, 215); x.bezierCurveTo(570, 220, 620, 330, 595, 520);
    x.lineTo(560, 470); x.lineTo(548, 520); x.bezierCurveTo(560, 400, 520, 320, 450, 300); x.bezierCurveTo(380, 320, 340, 400, 352, 520);
    x.lineTo(340, 470); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3; // collar + seams
    x.beginPath(); x.moveTo(360, 612); x.lineTo(450, 700); x.lineTo(540, 612); x.stroke();
    x.beginPath(); x.moveTo(450, 700); x.lineTo(450, h); x.stroke();
    x.beginPath(); x.moveTo(230, 680); x.bezierCurveTo(260, 760, 250, 840, 240, h); x.stroke();
    x.fillStyle = A2; x.beginPath(); x.moveTo(430, 700); x.lineTo(450, 740); x.lineTo(470, 700); x.lineTo(450, 690); x.fill();
    vine(x, [[140, h], [170, 760], [300, 720], [330, 640], [360, 560], [300, 500], [320, 430]],
      [[180, 820, -1.9, 26], [260, 700, -2.5, 22], [335, 600, -1.2, 20], [310, 470, -2.2, 18]]);
    x.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < h; i += 6) x.fillRect(0, i, w, 2);
    slotLabel(x, w, h, 'ART SLOT · 立绘占位', 'CONFIG.operator.bust  ~1:1');
    return c;
  }
  // full-body: standing figure in a long flared coat, halo, flower in hand
  function full() {
    const w = 700, h = 1400, c = PV.mk(w, h), x = c.getContext('2d');
    x.strokeStyle = A2; x.lineWidth = 6; x.beginPath(); x.arc(350, 250, 150, 0, TAU); x.stroke();
    x.lineWidth = 2; x.beginPath(); x.arc(350, 250, 172, 0, TAU); x.stroke();
    x.fillStyle = figureStyle(x, h);
    x.beginPath(); x.ellipse(350, 250, 62, 76, 0, 0, TAU); x.fill(); // head
    x.beginPath(); // coat: shoulders → flared hem
    x.moveTo(300, 330); x.lineTo(400, 330); x.bezierCurveTo(470, 350, 490, 390, 500, 450);
    x.lineTo(520, 700); x.bezierCurveTo(600, 900, 640, 1000, 610, 1060); x.lineTo(90, 1060);
    x.bezierCurveTo(60, 1000, 100, 900, 180, 700); x.lineTo(200, 450); x.bezierCurveTo(210, 390, 230, 350, 300, 330); x.fill();
    x.fillRect(262, 1050, 50, 290); x.fillRect(388, 1050, 50, 290); // legs
    x.fillStyle = '#8d93a4';
    x.fillRect(254, 1300, 66, 50); x.fillRect(380, 1300, 66, 50); // boots
    x.beginPath(); // hair
    x.moveTo(275, 330); x.bezierCurveTo(260, 200, 300, 168, 350, 168); x.bezierCurveTo(400, 168, 440, 200, 425, 330);
    x.lineTo(402, 300); x.bezierCurveTo(410, 240, 390, 215, 350, 212); x.bezierCurveTo(310, 215, 290, 240, 298, 300); x.closePath(); x.fill();
    x.fillStyle = figureStyle(x, h); // raised arm holding a flower
    x.save(); x.translate(470, 420); x.rotate(-0.55); x.fillRect(0, -22, 210, 44); x.restore();
    x.fillStyle = A2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; x.beginPath(); x.ellipse(655 + Math.cos(a) * 20, 290 + Math.sin(a) * 20, 18, 9, a, 0, TAU); x.fill(); }
    x.fillStyle = '#fff'; x.beginPath(); x.arc(655, 290, 9, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(350, 340); x.lineTo(350, 1060); x.stroke();
    x.beginPath(); x.moveTo(200, 700); x.bezierCurveTo(280, 730, 420, 730, 520, 700); x.stroke();
    x.fillStyle = C.cyan; x.fillRect(190, 690, 340, 14);
    vine(x, [[120, 1060], [140, 900], [230, 860], [220, 760], [210, 640], [150, 600], [190, 480]],
      [[140, 960, -2.1, 24], [220, 800, -1.3, 20], [175, 600, -2.4, 20], [190, 500, -1.1, 16]]);
    x.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < h; i += 6) x.fillRect(0, i, w, 2);
    slotLabel(x, w, h, 'ART SLOT · 立绘占位', 'CONFIG.outfit.art  ~1:2');
    return c;
  }
  const ph = {};
  /** art slot: 'bust' | 'full' → drawable */
  PV.art = key => {
    const url = key === 'bust' ? CFG.operator.bust : CFG.outfit.art;
    const im = PV.img(url);
    if (im) return im;
    return ph[key] || (ph[key] = key === 'bust' ? bust() : full());
  };
  PV.hasArt = key => !!PV.img(key === 'bust' ? CFG.operator.bust : CFG.outfit.art);

  /* ---------- logos ---------- */
  /** game wordmark: configured logo, else original mark + wordmark */
  PV.gameLogo = (g, x, y, s, color, align = 'center') => {
    const im = PV.img(CFG.game.logo);
    if (im) { const w = (im.naturalWidth / im.naturalHeight) * s * 2; PV.drawFit(g, im, align === 'left' ? x : x - w / 2, y - s, w, s * 2, true); return; }
    g.save();
    g.font = `${s}px ${PV.F.black}`;
    const tw = g.measureText(CFG.game.name).width, total = s * 1.3 + tw;
    const x0 = align === 'left' ? x : x - total / 2;
    PV.mark(g, x0 + s * 0.45, y + s * 0.02, s * 0.45, color);
    PV.text(g, CFG.game.name, x0 + s * 1.3, y, s, color, 'left', PV.F.black);
    PV.text(g, `${CFG.game.cn}  ${CFG.game.en}`, x0 + s * 1.32, y + s * 0.78, s * 0.3, color, 'left', PV.F.mono);
    g.restore();
  };
  /** generic logo slot: image if configured, else a dashed box with its label */
  PV.logoSlot = (g, url, x, y, w, h, label, sub, color = 'rgba(255,255,255,.8)') => {
    const im = PV.img(url);
    if (im) { PV.drawFit(g, im, x - w / 2, y - h / 2, w, h, true); return; }
    g.save(); g.setLineDash([5, 4]); g.strokeStyle = color; g.lineWidth = 1; g.strokeRect(x - w / 2, y - h / 2, w, h); g.restore();
    PV.text(g, label, x, y - (sub ? 7 : 0), Math.min(16, h * 0.28), color, 'center', PV.F.sans, '700');
    if (sub) PV.text(g, sub, x, y + 12, 9, color, 'center');
  };
  /** event emblem: configured image, else a hex badge with the mark and number */
  PV.emblem = (g, x, y, s, fg, bg) => {
    const im = PV.img(CFG.event.emblem);
    if (im) { PV.drawFit(g, im, x - s, y - s, s * 2, s * 2, true); return; }
    PV.poly(g, PV.hex(g, x, y, s, Math.PI / 6), bg, fg, s * 0.06);
    PV.poly(g, PV.hex(g, x, y, s * 0.82, Math.PI / 6), null, fg, 1);
    PV.mark(g, x, y + s * 0.1, s * 0.34, fg);
    PV.text(g, CFG.event.no, x, y + s * 0.62, s * 0.16, fg, 'center', PV.F.sans, '700');
  };

  /* ---------- Cycles plates ----------
     Two back-ends with the same timing: <video> (web playback) or JPEG frames (deterministic export). */
  PV.PLATES = { glass: 1, tower: 1, cubefield: 1, tunnel: 1, wall: 1, lens: 1, kv: 1 };
  const FPS = 30, BASE = 'plates/';
  PV.plateMode = q.get('plates') || 'video'; // 'video' | 'frames' | 'off'
  const vids = {}, frames = {}, used = new Set();
  PV.plateManifest = null;
  PV.platesReady = fetch(BASE + 'manifest.json').then(r => (r.ok ? r.json() : null)).then(m => { PV.plateManifest = m; }).catch(() => {});

  function video(name) {
    if (vids[name]) return vids[name];
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.src = BASE + name + '.webm';
    return (vids[name] = v);
  }
  const frameUrl = (name, i) => `${BASE}frames/${name}/${String(i).padStart(4, '0')}.jpg`;
  function frameImg(name, i) {
    const k = name + i;
    if (!frames[k]) { const im = new Image(); im.src = frameUrl(name, i); frames[k] = im; }
    return frames[k];
  }
  const nFrames = name => (PV.plateManifest && PV.plateManifest[name] ? PV.plateManifest[name].frames : 0);
  /** preload every plate frame needed at time t (export mode); resolves when decoded */
  PV.preloadPlates = function (list) {
    return Promise.all(list.map(([name, lt]) => {
      const n = nFrames(name); if (!n) return null;
      const i = clamp(Math.round(lt * FPS), 0, n - 1), im = frameImg(name, i);
      return im.decode().catch(() => {});
    }));
  };
  /** draw plate `name` at local time lt; returns false when unavailable so the scene can fall back */
  PV.plate = function (g, name, lt, alpha = 1) {
    if (PV.plateMode === 'off' || !PV.PLATES[name]) return false;
    const n = nFrames(name);
    if (!n) return false;
    used.add(name);
    g.globalAlpha = alpha;
    if (PV.plateMode === 'frames') {
      const im = frameImg(name, clamp(Math.round(lt * FPS), 0, n - 1));
      if (!(im.complete && im.naturalWidth)) { g.globalAlpha = 1; return false; }
      g.drawImage(im, 0, 0, W, H);
    } else {
      const v = video(name), tt = clamp(lt, 0, (n - 1) / FPS);
      if (v.readyState < 2) { g.globalAlpha = 1; return false; }
      const playing = PV.player && PV.player.isPlaying();
      if (playing) {
        if (v.paused) { v.currentTime = tt; v.play().catch(() => {}); }
        else if (Math.abs(v.currentTime - tt) > 0.12) v.currentTime = tt;
      } else {
        if (!v.paused) v.pause();
        if (Math.abs(v.currentTime - tt) > 0.03 && !v.seeking) v.currentTime = tt;
      }
      g.drawImage(v, 0, 0, W, H);
    }
    g.globalAlpha = 1;
    return true;
  };
  /** called by the compositor once per frame: pause videos that were not drawn */
  PV.platesEndFrame = () => {
    for (const k in vids) if (!used.has(k) && !vids[k].paused) vids[k].pause();
    used.clear();
  };
  /** warm up the next shots' videos a little before they are needed */
  PV.platesPrefetch = bar => {
    if (PV.plateMode !== 'video' || !PV.plateManifest) return;
    for (const S of PV.SCENES) if (S.plate && S.a - bar < 3 && S.b > bar) video(S.plate);
  };

  /* every CJK character used anywhere, so the webfont subset can be fetched before first paint */
  PV.cjkText = () => JSON.stringify(CFG).replace(/[\x00-\x7f]/g, '') + '相位跃迁限时活动即将开启新干员时装稀有度职业所属阵营画师署名占位立绘发行平台开发商适龄提示';
})();
