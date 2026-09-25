// Inline all JS and GLSL into a single self-contained index.html.
import fs from 'fs';
const R = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const lib = ['src/glsl/common.glsl', 'src/glsl/bowl.glsl', 'src/glsl/bowlmat.glsl'];
const SCENES = {
  life: [...lib, 'src/glsl/room.glsl', 'src/glsl/scenes/life.glsl'],
  break: [...lib, 'src/glsl/room.glsl', 'src/glsl/shards.glsl', 'src/glsl/scenes/break.glsl'],
};
const scenes = {};
for (const k in SCENES) scenes[k] = '#version 300 es\n' + SCENES[k].map(R).join('\n');
const SRC = { post: R('src/glsl/post.glsl'), scenes };
const JS = ['src/js/gl.js', 'src/js/timeline.js', 'src/js/bowl.js', 'src/js/shatter.js', 'src/js/engine.js', 'src/js/audio.js', 'src/js/film.js', 'src/js/main.js']
  .filter(f => fs.existsSync(new URL('../' + f, import.meta.url))).map(R).join('\n');
let html = R('src/index.template.html');
html = html.replace('/*@SRC*/', () => 'const SRC = ' + JSON.stringify(SRC) + ';');
html = html.replace('/*@JS*/', () => JS);
fs.writeFileSync(new URL('../index.html', import.meta.url), html);
console.log('index.html', (html.length / 1024).toFixed(1) + ' KB');
