// Film renderer: scene passes -> transition composite -> DOF -> bloom -> final grade.
const Engine = (() => {
  const ASPECT = 2.39;

  function splitChunks(src) {
    const out = {};
    const parts = src.split(/^\/\/@@ /m);
    for (const p of parts) {
      const nl = p.indexOf('\n');
      if (nl < 0) continue;
      out[p.slice(0, nl).trim()] = '#version 300 es\n' + p.slice(nl + 1);
    }
    return out;
  }

  class Renderer {
    constructor(canvas, sources) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: !!sources.preserve, powerPreference: 'high-performance' });
      if (!gl) throw new Error('WebGL2 is not available in this browser.');
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float is required.');
      gl.getExtension('OES_texture_float_linear');
      this.gl = gl;
      this.pext = gl.getExtension('KHR_parallel_shader_compile');
      this.sources = sources;
      this.scenes = {};
      this.post = {};
      this.pending = [];
      this.scale = 1.0;          // dynamic render scale
      this.targets = null;
      this.overlayTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.overlayTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // queue all programs; returns a promise that resolves when compiled
    compileAll(onProgress) {
      const gl = this.gl;
      const chunks = splitChunks(this.sources.post);
      const jobs = [];
      for (const k in chunks) jobs.push({ kind: 'post', name: k, src: chunks[k] });
      for (const name in this.sources.scenes) jobs.push({ kind: 'scene', name, src: this.sources.scenes[name] });
      const progs = jobs.map(j => ({ j, p: GLX.beginProgram(gl, j.src, j.name) }));
      return new Promise((resolve, reject) => {
        const poll = () => {
          try {
            let done = 0;
            for (const it of progs) {
              if (it.p.ready) { done++; continue; }
              if (GLX.isDone(it.p, this.pext)) {
                GLX.finishProgram(it.p);
                (it.j.kind === 'post' ? this.post : this.scenes)[it.j.name] = it.p;
                done++;
              }
            }
            onProgress && onProgress(done / progs.length);
            if (done === progs.length) resolve(); else setTimeout(poll, 30);
          } catch (e) { reject(e); }
        };
        poll();
      });
    }

    resize(w, h, scale) {
      const gl = this.gl;
      const rw = Math.max(64, Math.round(w * scale)), rh = Math.max(32, Math.round(h * scale));
      const t = this.targets;
      if (t && t.w === w && t.h === h && t.rw === rw && t.rh === rh) return;
      const del = x => { if (x) { gl.deleteTexture(x.tex); gl.deleteFramebuffer(x.fb); } };
      if (t) { [t.A, t.B, t.comp, t.coc, t.dof, t.dofmix].forEach(del); t.down.forEach(del); t.up.forEach(del); }
      const T = { w, h, rw, rh };
      T.A = GLX.target(gl, rw, rh);
      T.B = GLX.target(gl, rw, rh);
      T.comp = GLX.target(gl, rw, rh);
      T.coc = GLX.target(gl, rw, rh);
      T.dof = GLX.target(gl, rw >> 1, rh >> 1);
      T.dofmix = GLX.target(gl, rw, rh);
      T.down = []; T.up = [];
      let bw = rw >> 1, bh = rh >> 1;
      for (let i = 0; i < 6 && bw > 4 && bh > 4; i++) {
        T.down.push(GLX.target(gl, bw, bh));
        T.up.push(GLX.target(gl, bw, bh));
        bw >>= 1; bh >>= 1;
      }
      this.targets = T;
    }

    setOverlay(canvas2d) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.overlayTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas2d);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    renderScene(name, bag, tgt) {
      const p = this.scenes[name];
      if (!p) throw new Error('no scene ' + name);
      GLX.use(p);
      GLX.setAll(p, bag);
      GLX.draw(this.gl, tgt);
    }

    // frame: { a:{scene, bag}, b?:{scene,bag}, mix, mode, center, post:{...}, cam }
    frame(f) {
      const gl = this.gl, T = this.targets;
      const res = [T.rw, T.rh];
      const common = { uRes: res };
      this.renderScene(f.a.scene, Object.assign({}, f.a.bag, common), T.A);
      let src = T.A;
      if (f.b && f.mix > 0) {
        this.renderScene(f.b.scene, Object.assign({}, f.b.bag, common), T.B);
        const p = this.post.POST_COMPOSITE;
        GLX.use(p);
        GLX.setAll(p, {
          uA: T.A.tex, uB: T.B.tex, uMix: f.mix, uMode: f.mode || 0, uRes: res,
          uCamPos: f.a.bag.uCamPos, uCamRot: f.a.bag.uCamRot, uFov: f.a.bag.uFov,
          uCenter: f.center || [0, 0.3, 0], uTime: f.a.bag.uTime || 0,
        });
        GLX.draw(gl, T.comp);
        src = T.comp;
      }
      const P = f.post;
      // depth of field
      if (P.aperture > 0) {
        const maxCoc = P.maxCoc * T.rh / 540;
        let p = this.post.POST_COC; GLX.use(p);
        GLX.setAll(p, { uSrc: src.tex, uFocus: P.focus, uAperture: P.aperture, uMaxCoc: maxCoc });
        GLX.draw(gl, T.coc);
        p = this.post.POST_DOF; GLX.use(p);
        GLX.setAll(p, { uSrc: T.coc.tex, uTexel: [1 / T.rw, 1 / T.rh], uMaxCoc: maxCoc });
        GLX.draw(gl, T.dof);
        p = this.post.POST_DOFMIX; GLX.use(p);
        GLX.setAll(p, { uSharp: T.coc.tex, uBlur: T.dof.tex });
        GLX.draw(gl, T.dofmix);
        src = T.dofmix;
      }
      // bloom pyramid
      let p = this.post.POST_DOWN; GLX.use(p);
      let prev = src;
      for (let i = 0; i < T.down.length; i++) {
        GLX.setAll(p, { uSrc: prev.tex, uTexel: [1 / prev.w, 1 / prev.h], uThresh: P.bloomThresh, uFirst: i === 0 ? 1 : 0 });
        GLX.draw(gl, T.down[i]);
        prev = T.down[i];
      }
      p = this.post.POST_UP; GLX.use(p);
      const n = T.down.length;
      // start from the smallest level
      let acc = T.down[n - 1];
      for (let i = n - 2; i >= 0; i--) {
        GLX.setAll(p, { uSrc: acc.tex, uPrev: T.down[i].tex, uTexel: [1 / acc.w, 1 / acc.h], uRadius: 1.0 });
        GLX.draw(gl, T.up[i]);
        acc = T.up[i];
      }
      p = this.post.POST_FINAL; GLX.use(p);
      GLX.setAll(p, {
        uSrc: src.tex, uBloom: acc.tex, uOverlay: this.overlayTex, uRes: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        uExposure: P.exposure, uBloomAmt: P.bloom, uGrain: P.grain, uVignette: P.vignette, uCA: P.ca,
        uTime: f.a.bag.uTime || 0, uLetterbox: 0, uFade: P.fade, uOverlayAmt: P.overlay, uShimmer: P.shimmer,
        uLift: P.lift, uGamma: P.gamma, uGain: P.gain, uSat: P.sat, uTintShadow: P.tintShadow, uTintHigh: P.tintHigh,
        uContrast: P.contrast,
      });
      GLX.draw(gl, null);
    }
  }

  const DEFAULT_POST = {
    exposure: 1.0, bloom: 0.06, bloomThresh: 1.2, grain: 0.035, vignette: 0.55, ca: 0.012,
    fade: 1.0, overlay: 0.0, shimmer: 0.0,
    lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 1.0, contrast: 1.0,
    tintShadow: [1, 1, 1], tintHigh: [1, 1, 1],
    focus: 3.0, aperture: 0.0, maxCoc: 10.0,
  };

  return { Renderer, ASPECT, DEFAULT_POST };
})();
