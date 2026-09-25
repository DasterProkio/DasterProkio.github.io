/* WebGL post-processing pass: the 2D scene canvas is uploaded as a texture every frame
   and run through one shader that does zoom punch, shake, swirl, pixelate, slit-scan,
   directional smear, RGB split, invert, flash, grain, vignette and the letterbox mask. */
'use strict';
PV.FX_DEFAULT = {
  zoom: 1, shakeX: 0, shakeY: 0, swirl: 0, pixel: 0, slit: 0, smear: 0, smearAngle: 0,
  rgb: 0, invert: 0, flash: [1, 1, 1, 0], grain: 0.035, vig: 0.25, scan: 0, lbox: 0,
};

PV.createFX = function (canvas) {
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
  if (!gl) return null;
  const vs = `attribute vec2 p; varying vec2 v; void main(){ v=p*.5+.5; v.y=1.-v.y; gl_Position=vec4(p,0.,1.); }`;
  const fs = `
precision highp float;
uniform sampler2D T; uniform vec2 R; uniform float time;
uniform float zoom, swirl, pixel, slit, smear, rgb, invert, grain, vig, scan, lbox;
uniform vec2 shake, smearDir; uniform vec4 flash;
varying vec2 v;
float h(float n){ return fract(sin(n*91.3458)*47453.5453); }
float h2(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
vec3 tap(vec2 uv){ return texture2D(T, clamp(uv, vec2(0.001), vec2(0.999))).rgb; }
void main(){
  vec2 uv = (v-.5)/zoom + .5 + shake;
  float asp = R.x/R.y;
  if (swirl != 0.) {
    vec2 p = (uv-.5)*vec2(asp,1.);
    float r = length(p);
    float a = swirl * pow(max(0., 1. - r/1.1), 2.);
    float c = cos(a), s = sin(a);
    p = mat2(c,-s,s,c)*p;
    uv = p/vec2(asp,1.)+.5;
  }
  if (pixel > 1.) { vec2 px = R/pixel; uv = (floor(uv*px)+.5)/px; }
  if (slit > 0.) {
    float col = floor(uv.x*R.x/4.);
    float n = h(col + floor(time*14.));
    float on = step(.45 - slit*.3, n);
    uv.y = mix(uv.y, .5 + (uv.y-.5)*.08 + (n-.5)*.9, slit*on);
    uv.x += (h(col*1.7)-.5)*.015*slit;
  }
  vec3 c;
  if (smear > 0.) {
    vec3 acc = vec3(0.);
    for (int i=0;i<16;i++){ float k = float(i)/15. - .5; acc += tap(uv + smearDir*k*smear); }
    c = acc/16.;
  } else c = tap(uv);
  if (rgb > 0.) {
    vec2 o = vec2(rgb/R.x, 0.);
    c.r = mix(c.r, tap(uv+o).r, .9);
    c.b = mix(c.b, tap(uv-o).b, .9);
  }
  if (scan > 0.) c *= 1. - scan*.5*step(.5, fract(v.y*R.y/3.));
  c = mix(c, 1.-c, invert);
  c = mix(c, flash.rgb, flash.a);
  c += (h2(v*R + fract(time*7.)*100.)-.5)*grain;
  vec2 q = v-.5; c *= 1. - vig*dot(q,q)*1.8;
  if (v.y < lbox || v.y > 1. - lbox) c = vec3(0.); // letterbox: untouched by every effect above
  gl_FragColor = vec4(c,1.);
}`;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr);
  gl.useProgram(pr);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const U = {};
  ['T', 'R', 'time', 'zoom', 'swirl', 'pixel', 'slit', 'smear', 'rgb', 'invert', 'grain', 'vig', 'scan', 'lbox', 'shake', 'smearDir', 'flash']
    .forEach(n => (U[n] = gl.getUniformLocation(pr, n)));

  return function render(src, fx, time) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.uniform1i(U.T, 0);
    gl.uniform2f(U.R, canvas.width, canvas.height);
    gl.uniform1f(U.time, time);
    gl.uniform1f(U.zoom, fx.zoom);
    gl.uniform2f(U.shake, fx.shakeX, fx.shakeY);
    gl.uniform1f(U.swirl, fx.swirl);
    gl.uniform1f(U.pixel, fx.pixel);
    gl.uniform1f(U.slit, fx.slit);
    gl.uniform1f(U.smear, fx.smear);
    gl.uniform2f(U.smearDir, Math.cos(fx.smearAngle), Math.sin(fx.smearAngle) * (canvas.width / canvas.height));
    gl.uniform1f(U.rgb, fx.rgb);
    gl.uniform1f(U.invert, fx.invert);
    gl.uniform1f(U.grain, fx.grain);
    gl.uniform1f(U.vig, fx.vig);
    gl.uniform1f(U.scan, fx.scan);
    gl.uniform1f(U.lbox, fx.lbox);
    gl.uniform4f(U.flash, ...fx.flash);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
};
