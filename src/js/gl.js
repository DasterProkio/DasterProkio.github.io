// Minimal WebGL2 helpers shared by the film and the dev spikes.
const GLX = (() => {
  function compile(gl, type, src, label) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  function checkShader(gl, s, src, label) {
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return;
    const log = gl.getShaderInfoLog(s) || '';
    const lines = src.split('\n');
    const ctx = [];
    const re = /ERROR: \d+:(\d+)/g;
    let m;
    while ((m = re.exec(log))) {
      const ln = +m[1];
      for (let i = Math.max(1, ln - 2); i <= Math.min(lines.length, ln + 2); i++)
        ctx.push((i === ln ? '>>' : '  ') + i + ': ' + lines[i - 1]);
      ctx.push('--');
    }
    throw new Error('[' + label + '] shader compile failed\n' + log + '\n' + ctx.join('\n'));
  }

  const VS = `#version 300 es
  out vec2 vUv;
  void main(){
    vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2);
    vUv = p;
    gl_Position = vec4(p*2.0-1.0, 0.0, 1.0);
  }`;

  // Programs are created in two steps so compiles can run in parallel
  // (KHR_parallel_shader_compile) while a loading screen animates.
  function beginProgram(gl, fsSrc, label) {
    const vs = compile(gl, gl.VERTEX_SHADER, VS, label + ':vs');
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc, label);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return { gl, p, vs, fs, fsSrc, label, ready: false, uniforms: {} };
  }

  function isDone(prog, ext) {
    if (!ext) return true;
    return prog.gl.getProgramParameter(prog.p, ext.COMPLETION_STATUS_KHR);
  }

  function finishProgram(prog) {
    const gl = prog.gl;
    if (!gl.getProgramParameter(prog.p, gl.LINK_STATUS)) {
      checkShader(gl, prog.vs, VS, prog.label + ':vs');
      checkShader(gl, prog.fs, prog.fsSrc, prog.label);
      throw new Error('[' + prog.label + '] link failed: ' + gl.getProgramInfoLog(prog.p));
    }
    const n = gl.getProgramParameter(prog.p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog.p, i);
      const name = info.name.replace(/\[0\]$/, '');
      prog.uniforms[name] = { loc: gl.getUniformLocation(prog.p, info.name), type: info.type, size: info.size };
    }
    prog.ready = true;
    return prog;
  }

  function program(gl, fsSrc, label) {
    return finishProgram(beginProgram(gl, fsSrc, label));
  }

  // Set uniforms by name; unknown names are ignored so scenes can share one
  // big uniform bag.
  let texUnit = 0;
  function use(prog) {
    prog.gl.useProgram(prog.p);
    texUnit = 0;
  }

  function set(prog, name, v) {
    const u = prog.uniforms[name];
    if (!u) return;
    const gl = prog.gl;
    const L = u.loc;
    switch (u.type) {
      case gl.FLOAT:
        if (u.size > 1) gl.uniform1fv(L, v); else gl.uniform1f(L, v);
        break;
      case gl.FLOAT_VEC2: gl.uniform2fv(L, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(L, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(L, v); break;
      case gl.INT: case gl.BOOL: gl.uniform1i(L, v); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(L, false, v); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(L, false, v); break;
      case gl.SAMPLER_2D: {
        gl.activeTexture(gl.TEXTURE0 + texUnit);
        gl.bindTexture(gl.TEXTURE_2D, v);
        gl.uniform1i(L, texUnit++);
        break;
      }
    }
  }

  function setAll(prog, bag) {
    for (const k in bag) set(prog, k, bag[k]);
  }

  function target(gl, w, h, opts = {}) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const internal = opts.internal || gl.RGBA16F;
    const format = opts.format || gl.RGBA;
    const type = opts.type || gl.HALF_FLOAT;
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    const filt = opts.nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  }

  function draw(gl, tgt) {
    if (tgt) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, tgt.fb);
      gl.viewport(0, 0, tgt.w, tgt.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Camera: returns a 3x3 basis (column-major) for look-at.
  function lookAt(eye, target, roll = 0, upv = null) {
    const f = norm(sub(target, eye));
    let up = upv || [Math.sin(roll), Math.cos(roll), 0];
    let r = norm(cross(f, up));
    const u = cross(r, f);
    return [r[0], r[1], r[2], u[0], u[1], u[2], f[0], f[1], f[2]];
  }

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const mix = (a, b, t) => Array.isArray(a) ? a.map((x, i) => x + (b[i] - x) * t) : a + (b - a) * t;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  return { program, beginProgram, finishProgram, isDone, use, set, setAll, target, draw, lookAt,
    v: { sub, add, mul, dot, len, norm, cross, mix, clamp, smooth } };
})();
if (typeof module !== 'undefined') module.exports = GLX;
