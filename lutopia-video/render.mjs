// Render anim.html frame by frame in headless Chromium and encode with ffmpeg.
//   npm i playwright-core   (Chromium must be available to Playwright)
//   node render.mjs                      -> lutopia_intro.mp4 (+ cues.json, then run audio.py)
//   node render.mjs --stills 1.0 6.2 ... -> stills/<t>.png for quick checks
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.env.FFMPEG || (() => {
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg as i;print(i.get_ffmpeg_exe())']).toString().trim(); } catch { return 'ffmpeg'; }
})();
const args = process.argv.slice(2);
const url = pathToFileURL(path.join(HERE, 'anim.html')).href + '?render';

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(url);
  const info = await page.evaluate(() => window.READY);
  return { page, info };
}
const shot = async (page, i) => { await page.evaluate(i => window.renderFrame(i), i); return page.screenshot({ type: 'png' }); };

const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
if (args[0] === '--stills') {
  const { page, info } = await openPage(browser);
  fs.mkdirSync(path.join(HERE, 'stills'), { recursive: true });
  for (const a of args.slice(1)) {
    const i = Math.min(info.frames - 1, Math.round(parseFloat(a) * info.fps));
    fs.writeFileSync(path.join(HERE, 'stills', `${a}.png`), await shot(page, i));
  }
  console.log('stills written');
} else {
  const workers = Math.max(1, Math.min(4, os.cpus().length));
  const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser)));
  const { frames, fps, cues, total } = pages[0].info;
  fs.writeFileSync(path.join(HERE, 'cues.json'), JSON.stringify({ total, cues }, null, 1));
  execFileSync('python3', [path.join(HERE, 'audio.py')], { stdio: 'inherit' });
  const out = path.join(HERE, 'lutopia_intro.mp4');
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-i', path.join(HERE, '.audio.wav'), '-vf', 'scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-tune', 'animation', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => ff.on('close', r));
  let next = 0; const buf = new Map(); let written = 0;
  const write = b => new Promise(r => ff.stdin.write(b) ? r() : ff.stdin.once('drain', r));
  await Promise.all(pages.map(async ({ page }, w) => {
    for (let i = w; i < frames; i += workers) {
      buf.set(i, await shot(page, i));
      while (buf.has(next)) { const b = buf.get(next); buf.delete(next); next++; await write(b); written++; }
      if (w === 0) process.stdout.write(`\rframe ${written}/${frames}`);
    }
  }));
  while (buf.has(next)) { await write(buf.get(next)); buf.delete(next); next++; }
  ff.stdin.end(); await done;
  fs.rmSync(path.join(HERE, '.audio.wav'), { force: true });
  const { page } = pages[0];
  fs.writeFileSync(path.join(HERE, 'cover.png'), await shot(page, Math.round((total - 2.6) * fps)));
  console.log('\nwrote', out);
}
await browser.close();
