// Usage: node tools/capture.mjs <url> <outPrefix> <arg1> [arg2 ...]
// Loads the page with ?capture, waits for window.__ready, then for each arg calls
// window.__renderAt(arg) and saves a PNG of the canvas.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [url, out, ...args] = process.argv.slice(2);
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.setDefaultTimeout(900000);
p.on('console', m => { if (m.type() === 'error' || process.env.V) console.log('[page]', m.text()); });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(url + (url.includes('?') ? '&' : '?') + 'capture', { waitUntil: 'load' });
await p.waitForFunction(() => window.__ready || window.__error, null, { timeout: 600000 });
const err = await p.evaluate(() => window.__error);
if (err) { console.log('ERROR:', err); await b.close(); process.exit(1); }
for (const a of args) {
  const t0 = Date.now();
  const v = isNaN(+a) ? a : +a;
  const label = await p.evaluate(v => window.__renderAt(v), v);
  const file = `${out}_${String(a).replace(/[^\w.-]/g, '_')}.png`;
  const data = await p.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
  (await import('fs')).writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
  console.log(file, label ?? '', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await b.close();
