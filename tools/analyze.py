# Loudness per window + spectrogram image for a WAV.
import sys, wave, numpy as np
from PIL import Image
path, out = sys.argv[1], sys.argv[2]
w = wave.open(path); sr = w.getframerate(); n = w.getnframes()
x = np.frombuffer(w.readframes(n), dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768
mono = x.mean(1)
bar = 240/72
print('duration %.1fs  peak %.3f  clipped samples %d' % (n/sr, np.abs(x).max(), int((np.abs(x) > 0.999).sum())))
win = int(sr*bar)
rows = []
for i in range(0, len(mono)//win):
    seg = x[i*win:(i+1)*win]
    rms = np.sqrt((seg**2).mean()+1e-12); pk = np.abs(seg).max()
    rows.append((i, 20*np.log10(rms), 20*np.log10(pk+1e-9)))
print('bar  rmsdB  peakdB')
for i, r, p in rows: print('%3d %6.1f %6.1f %s' % (i, r, p, '#'*max(0,int((r+60)/1.5))))
# spectrogram (log freq), 8 px per second
hop = sr//8; nfft = 4096
cols = []
win_ = np.hanning(nfft)
for s in range(0, len(mono)-nfft, hop):
    sp = np.abs(np.fft.rfft(mono[s:s+nfft]*win_))
    cols.append(sp)
S = np.array(cols).T
freqs = np.fft.rfftfreq(nfft, 1/sr)
H = 300
logf = np.geomspace(40, 16000, H)
idx = np.searchsorted(freqs, logf)
img = 20*np.log10(S[idx]+1e-6)
img = np.clip((img+30)/70, 0, 1)[::-1]
rgb = (np.stack([img**0.8, img**1.5, img**3], -1)*255).astype(np.uint8)
im = Image.fromarray(rgb)
# bar markers
arr = np.array(im)
for b in range(0, 77):
    xpix = int(b*bar*8)
    if xpix < arr.shape[1]: arr[:, xpix, :] = [60,60,120] if b % 4 else [120,120,255]
Image.fromarray(arr).save(out)
print(out, arr.shape)
