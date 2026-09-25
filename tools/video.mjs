// Offline video render: node tools/video.mjs <out.mp4> <t0> <t1> [fps=24]  (env W, H)
// Renders every frame with the capture hook (clock = frame index / fps, so the result is
// frame-exact regardless of how slow the renderer is) and pipes JPEGs into ffmpeg.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const [out, t0s, t1s, fpsS] = process.argv.slice(2);
const W = +(process.env.W || 1280), H = +(process.env.H || 536), fps = +(fpsS || 24);
const FF = process.env.FFMPEG || 'ffmpeg';
const t0 = +t0s, t1 = +t1s;
const n0 = Math.round(t0 * fps), n1 = Math.round(t1 * fps);
const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.setDefaultTimeout(900000);
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('http://localhost:8123/index.html?capture' + (process.env.K ? '&k=' + process.env.K : ''), { waitUntil: 'load' });
await p.waitForFunction(() => window.__ready || window.__error, null, { timeout: 600000 });
const tStart = Date.now();
for (let n = n0; n < n1; n++) {
  const b64 = await p.evaluate(t => { window.__renderAt(t); return document.querySelector('canvas').toDataURL('image/jpeg', 0.95).split(',')[1]; }, n / fps);
  const buf = Buffer.from(b64, 'base64');
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  const done = n - n0 + 1;
  if (done % 24 === 0) {
    const el = (Date.now() - tStart) / 1000;
    console.log(`${out} frame ${done}/${n1 - n0}  t=${(n / fps).toFixed(1)}s  ${(el / done).toFixed(2)}s/frame  eta ${((n1 - n - 1) * el / done / 60).toFixed(0)} min`);
  }
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await b.close();
console.log('done', out);
