// Dev harness for spikes: loads GLSL chunks, renders one full-screen pass with a
// simple tonemap, and exposes window.__renderAt(t) for the capture tool.
async function loadGLSL(files) {
  const parts = await Promise.all(files.map(f => fetch(f).then(r => { if (!r.ok) throw new Error(f); return r.text(); })));
  return '#version 300 es\n' + parts.join('\n');
}

const POST_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc; uniform float uExposure;
vec3 agx(vec3 c){
  // compact AgX-like: log encode, sigmoid, slight desat of highlights
  const mat3 M = mat3(0.842479,0.0423282,0.0423756, 0.0784336,0.878468,0.0784336, 0.0792237,0.0791661,0.879142);
  const mat3 Mi = mat3(1.19687,-0.0528968,-0.0529716, -0.0980208,1.15190,-0.0980434, -0.0990297,-0.0989612,1.15107);
  c = M*max(c,1e-6);
  c = clamp((log2(c)+12.47393)/16.5, 0.0, 1.0);
  vec3 x2=c*c, x4=x2*x2;
  c = 15.5*x4*x2 - 40.14*x4*c + 31.96*x4 - 6.868*x2*c + 0.4298*x2 + 0.1191*c - 0.00232;
  c = Mi*c;
  return pow(max(c,0.0), vec3(2.2));
}
void main(){
  vec3 c = texture(uSrc, vUv).rgb*uExposure;
  c = agx(c);
  o = vec4(pow(c, vec3(1.0/2.2)), 1.0);
}`;

async function makeSpike({ canvas, files, setup }) {
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  const src = await loadGLSL(files);
  const prog = GLX.program(gl, src, 'scene');
  const post = GLX.program(gl, POST_FS, 'post');
  let tgt = null;
  function render(bag, exposure = 1.0) {
    const w = canvas.width, h = canvas.height;
    if (!tgt || tgt.w !== w || tgt.h !== h) tgt = GLX.target(gl, w, h);
    GLX.use(prog);
    GLX.setAll(prog, Object.assign({ uRes: [w, h], uJitter: [0, 0] }, bag));
    GLX.draw(gl, tgt);
    GLX.use(post);
    GLX.set(post, 'uSrc', tgt.tex);
    GLX.set(post, 'uExposure', exposure);
    GLX.draw(gl, null);
    gl.finish();
  }
  return { gl, render };
}
