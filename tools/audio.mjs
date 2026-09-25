// Render the score offline in headless Chromium and save a 16-bit WAV.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const out = process.argv[2] || 'score.wav';
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
p.setDefaultTimeout(900000);
p.on('console', m => console.log('[page]', m.text()));
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('http://localhost:8123/index.html?capture', { waitUntil: 'load' });
await p.waitForFunction(() => window.__ready || window.__error);
const t0 = Date.now();
const b64 = await p.evaluate(async () => {
  const buf = await Score.prepare();
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
  const bytes = new Uint8Array(44 + n * 4), dv = new DataView(bytes.buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 4, true);
  dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
});
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
await b.close();
