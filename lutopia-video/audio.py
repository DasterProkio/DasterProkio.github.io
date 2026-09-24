"""Synthesized soundtrack for the Lutopia intro: cozy chiptune-pop at 120 BPM + sound effects.
Reads cues.json (written by render.mjs) and writes .audio.wav. Needs numpy only."""
import json, os, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
BEAT = 0.5


def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def _t(d): return np.arange(int(d * SR)) / SR
def _atk(t, a=0.004): return np.clip(t / a, 0, 1)
def _rel(t, d, r=0.05): return np.clip((d - t) / r, 0, 1)


class Bus:
    def __init__(self, n):
        self.L = np.zeros(n); self.R = np.zeros(n)

    def add(self, sig, t, gain=1.0, pan=0.0):
        i = int(t * SR)
        if i < 0 or i >= len(self.L):
            return
        s = sig[:len(self.L) - i] * gain
        self.L[i:i + len(s)] += s * min(1, 1 - pan)
        self.R[i:i + len(s)] += s * min(1, 1 + pan)


# ---------------- instruments ----------------
def bell(f, d=1.4, bright=1.0):
    t = _t(d)
    s = (np.sin(2 * np.pi * f * t) + .35 * bright * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 7)
         + .18 * bright * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 10))
    return s * np.exp(-t * 3.2) * _atk(t)


def musicbox(f, d=1.6):
    t = _t(d)
    s = np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * 4.02 * f * t) * np.exp(-t * 14) + .2 * np.sin(2 * np.pi * 6.1 * f * t) * np.exp(-t * 20)
    return s * np.exp(-t * 2.4) * _atk(t, .002)


def lead(f, d):
    t = _t(d + .1)
    vib = 1 + .005 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t * 5 - .5, 0, 1)
    ph = np.cumsum(f * vib / SR)
    s = sum((np.sin(np.pi * k * .25) / k) * np.cos(2 * np.pi * k * ph) * .76 ** k for k in range(1, 10))
    s2 = np.sin(2 * np.pi * ph * 2.003) * .15
    return (s + s2) * _atk(t, .012) * (.62 + .38 * np.exp(-t * 9)) * _rel(t, d + .1, .1)


def tri(f, d):
    t = _t(d)
    ph = f * t
    s = sum(((-1) ** ((k - 1) // 2)) / (k * k) * np.sin(2 * np.pi * k * ph) for k in (1, 3, 5, 7))
    return s * _atk(t, .006) * np.exp(-t * 2.2) * _rel(t, d, .03)


def pluck(f, d=.9, decay=.994, seed=0):
    rng = np.random.default_rng(seed)
    n, P = int(d * SR), max(2, int(SR / f))
    y = np.zeros(n + P + 1)
    z = rng.uniform(-1, 1, P)
    y[1:P + 1] = .5 * (z + np.roll(z, 1))
    k = P + 1
    while k < len(y):
        m = min(P, len(y) - k)
        y[k:k + m] = decay * .5 * (y[k - P:k - P + m] + y[k - P - 1:k - P - 1 + m])
        k += m
    return y[P + 1:P + 1 + n] * _rel(_t(d), d, .05)


def pad(freqs, d):
    t = _t(d)
    s = sum(np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * .3 * t) * .5) + .3 * np.sin(2 * np.pi * 2.005 * f * t) for f in freqs)
    return s / len(freqs) * np.clip(t / .4, 0, 1) * np.clip((d - t) / .5, 0, 1)


def noise(d, seed):
    return np.random.default_rng(seed).uniform(-1, 1, int(d * SR))


def mix(*xs):
    out = np.zeros(max(len(x) for x in xs))
    for x in xs:
        out[:len(x)] += x
    return out


def lp(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")


def kick():
    t = _t(.4)
    return np.sin(2 * np.pi * np.cumsum(46 + 110 * np.exp(-t * 30)) / SR) * np.exp(-t * 8) + .15 * noise(.4, 9)[:len(t)] * np.exp(-t * 90)


def clap(seed=1):
    t = _t(.25)
    n = np.diff(noise(.25, seed), prepend=0)
    env = np.exp(-t * 20) + .7 * np.exp(-np.abs(t - .011) * 400) + .6 * np.exp(-np.abs(t - .023) * 400)
    return n * env * .55


def hat(seed=2, d=.05):
    t = _t(d)
    return np.diff(noise(d, seed), prepend=0) * np.exp(-t * 85)


def shaker(seed=3):
    t = _t(.09)
    return np.diff(noise(.09, seed), prepend=0) * np.sin(np.pi * t / .09) ** 2 * .5


def sweep(f0, f1, d, dec=8.0, shape=1.0):
    t = _t(d)
    f = f0 + (f1 - f0) * (t / d) ** shape
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * dec) * _atk(t, .003)


def arp(notes, step, d=.6, fn=None):
    fn = fn or (lambda m: bell(mtof(m), d) * .35)
    out = np.zeros(int((len(notes) * step + d) * SR))
    for j, m in enumerate(notes):
        b = fn(m); i = int(j * step * SR)
        out[i:i + len(b)] += b[:len(out) - i]
    return out


# ---------------- sound effects ----------------
def sfx(name, seed=0):
    if name == "pop": return sweep(380, 1300, .12, 22) * .8
    if name == "bigpop": return mix(sweep(200, 1400, .22, 12), lp(noise(.3, seed), 4) * np.exp(-_t(.3) * 18) * .6)
    if name == "tick": return sweep(900, 1500, .06, 40) * .5
    if name == "tap": return sweep(1300, 700, .05, 50) * .6
    if name == "bloop": return sweep(900, 380, .16, 16) * .7
    if name == "bubble":
        return mix(sweep(500, 1100, .1, 20) * .6, np.pad(sweep(700, 1400, .08, 25) * .4, (2000, 0)))
    if name == "boing":
        t = _t(.45)
        f = 180 + 170 * (t / .45) + 45 * np.sin(2 * np.pi * 14 * t) * np.exp(-t * 4)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) * .7
    if name == "stretch":
        t = _t(.6)
        f = 200 + 500 * (t / .6) ** 1.5 + 30 * np.sin(2 * np.pi * 9 * t)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / .6) * .45
    if name == "ripple":
        return arp([72, 76, 79], .09, .5, lambda m: sweep(mtof(m) * 2, mtof(m), .3, 10) * .4)
    if name in ("sparkle", "shine", "twinkle"):
        notes = {"sparkle": (84, 88, 91, 96, 100), "shine": (79, 84, 88, 91, 96, 100, 103), "twinkle": (91, 96, 100)}[name]
        return arp(notes, .045, .7)
    if name == "ding": return (bell(mtof(88), 1.2) + bell(mtof(95), 1.2) * .5) * .5
    if name == "musicbox": return arp([79, 76, 72, 67], .3, 1.6, lambda m: musicbox(mtof(m)) * .5)
    if name == "sad": return arp([79, 76, 72, 71], .24, .9, lambda m: bell(mtof(m), .9) * .45)
    if name == "rain":
        d = 2.4; n = lp(noise(d, 5), 6)
        drops = np.zeros_like(n); rng = np.random.default_rng(7)
        for s in rng.integers(0, len(n) - 2000, 100):
            dr = sweep(rng.uniform(1800, 3200), 900, .021, 60) * .35; drops[s:s + len(dr)] += dr
        t = _t(d)
        return (n * .1 + drops) * np.clip(t / .4, 0, 1) * np.clip((d - t) / .5, 0, 1)
    if name in ("whoosh", "swoosh", "whip"):
        d = {"whoosh": .8, "swoosh": .35, "whip": .28}[name]
        n = lp(noise(d, seed + 9), 10 if name == "whoosh" else 5); t = _t(d)
        return n * np.sin(np.pi * t / d) ** 2 * (.9 if name == "whoosh" else .7)
    if name == "steps":
        out = np.zeros(int(.9 * SR))
        for k in range(6):
            s = sweep(260 + 40 * (k % 2), 120, .06, 40) * .5; i = int(k * .14 * SR); out[i:i + len(s)] += s
        return out
    if name == "door":
        return arp([72, 76, 79, 84], .07, .9, lambda m: bell(mtof(m), .9, .6) * .4)
    if name == "rise": return sweep(300, 900, .25, 6, .6) * .45
    if name == "count":
        out = np.zeros(int(1.1 * SR))
        for k in range(16):
            s = sweep(1000 + k * 60, 1400 + k * 60, .03, 60) * .35; i = int(k * .06 * SR); out[i:i + len(s)] += s
        return out
    if name == "drop": return mix(sweep(700, 200, .12, 20) * .6, kick()[:int(.12 * SR)] * .3)
    if name == "typing":
        out = np.zeros(int(.35 * SR))
        for k in range(4):
            s = hat(seed + k, .03) * .6; i = int(k * .08 * SR); out[i:i + len(s)] += s
        return out
    if name == "like": return arp([88, 93], .06, .4, lambda m: sweep(mtof(m), mtof(m) * 1.02, .3, 12) * .45)
    if name == "stamp":
        k = kick() * .9; k[:int(.1 * SR)] += sweep(300, 140, .1, 30) * .4
        return k
    if name == "paper": return lp(noise(.3, seed), 3) * np.exp(-_t(.3) * 10) * .3
    if name == "rattle":
        out = np.zeros(int(.7 * SR)); rng = np.random.default_rng(3)
        for k in range(14):
            i = int((k * .045 + rng.uniform(0, .012)) * SR)
            c = sweep(rng.uniform(1500, 2600), 900, .03, 90) * rng.uniform(.3, .6); out[i:i + len(c)] += c[:len(out) - i]
        return out
    if name == "water":
        d = 1.0; t = _t(d)
        return mix(lp(noise(d, 21), 3) * .12 * np.sin(np.pi * t / d), arp([84, 86, 88], .2, .3, lambda m: sweep(mtof(m), mtof(m) * .8, .12, 25) * .2))
    if name == "yawn":
        t = _t(.9)
        f = 420 - 200 * (t / .9)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / .9) * .25
    raise ValueError(name)


CHORDS = [(48, (0, 4, 7)), (45, (0, 3, 7)), (41, (0, 4, 7)), (43, (0, 4, 7))]  # C Am F G
MELODY = [(0, 76, .5), (.5, 79, .5), (1, 81, .5), (1.5, 79, .5), (2, 76, 1), (3, 72, .5), (3.5, 74, .5),
          (4, 76, 1), (5, 74, .5), (5.5, 72, .5), (6, 69, 1.5), (7.5, 72, .5),
          (8, 69, .5), (8.5, 72, .5), (9, 77, .5), (9.5, 76, .5), (10, 74, .5), (10.5, 72, .5), (11, 74, 1),
          (12, 79, 1), (13, 81, .5), (13.5, 83, .5), (14, 84, 1.5), (15.5, 79, .5)]


def reverb(L, R, dur=1.8, seed=11):
    n = int(dur * SR)
    t = _t(dur)
    out = []
    for ch, x in enumerate((L, R)):
        ir = lp(noise(dur, seed + ch), 3) * np.exp(-t * 3.2)
        ir[:int(.02 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        N = 1 << int(np.ceil(np.log2(len(x) + n)))
        y = np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:len(x)]
        out.append(y)
    return out


def build(total, cues, path):
    n = int((total + 1) * SR)
    dry, wet = Bus(n), Bus(n)
    G0, G1 = 6.0, total - 2.0  # groove window
    # intro: sleepy music box, then a soft sad pad
    for tt, m in ((.15, 79), (.55, 76), (.95, 72), (1.35, 76), (1.75, 74), (2.15, 71)):
        wet.add(musicbox(mtof(m)), tt, .3, -.2)
    wet.add(pad([mtof(57), mtof(60), mtof(64)], 2.0), 2.5, .12)
    wet.add(pad([mtof(53), mtof(57), mtof(60)], 1.6), 4.4, .12)
    dry.add(tri(mtof(45), 1.9), 2.5, .22); dry.add(tri(mtof(41), 1.5), 4.4, .22)
    # build-up into the drop at 6.0 (the pull-out)
    dry.add(sweep(200, 1600, 1.1, .3, 2.2), 4.9, .1)
    for k in range(8):
        dry.add(clap(100 + k), 5.5 + k * .0625, .06 + .035 * k)
    # groove
    b = 0
    while G0 + b * BEAT < G1 - 1e-6:
        t = G0 + b * BEAT
        bar, bib = b // 4, b % 4
        root, triad = CHORDS[bar % 4]
        if bib in (0, 2) or (bib == 3 and bar % 2):
            dry.add(kick(), t + (.25 if (bib == 3) else 0), .85)
        if bib in (1, 3):
            dry.add(clap(b), t, .3, .1)
        for h in (0, .25):
            dry.add(hat(b * 2 + int(h * 4)), t + h, .08 if h == 0 else .13, .3)
        dry.add(shaker(b), t + .125, .07, -.3); dry.add(shaker(b + 99), t + .375, .07, -.3)
        bn = root + (7 if bib == 2 else 0) + (12 if bib == 3 else 0)
        dry.add(tri(mtof(bn), .42), t, .4)
        if bib == 1:
            dry.add(tri(mtof(root), .2), t + .25, .28)
        arpn = [root + 24 + triad[i % 3] + (12 if i == 3 else 0) for i in range(4)]
        for h in (0, 1):
            m = arpn[(bib * 2 + h) % 4]
            wet.add(pluck(mtof(m), .7, seed=b * 2 + h), t + h * .25, .2, -.4 + .8 * h)
        if bib == 0:
            wet.add(pad([mtof(root + 24 + i) for i in triad], 2.0), t, .05)
        b += 1
    # lead melody, three phrases
    for rep in range(3):
        base = G0 + rep * 16 * BEAT
        for bt, m, dl in MELODY:
            tt = base + bt * BEAT
            if tt + dl * BEAT <= G1 + .01:
                wet.add(lead(mtof(m), dl * BEAT * .9), tt, .12, .12)
                if rep == 2:
                    wet.add(bell(mtof(m + 12), .5), tt, .05, -.2)
    # outro: final chord, lullaby
    for m in (72, 76, 79, 84):
        wet.add(bell(mtof(m), 2.2), G1, .16)
    dry.add(kick(), G1, .6)
    # sfx
    for i, (tt, name) in enumerate(cues):
        s = sfx(name, i)
        pan = ((i * 37) % 7 - 3) / 14
        g = .42 if name not in ("rain", "water") else .5
        dry.add(s, tt, g, pan)
        if name in ("sparkle", "shine", "twinkle", "ding", "door", "musicbox", "sad", "ripple", "like"):
            wet.add(s, tt, .25, pan)
    wl, wr = reverb(wet.L, wet.R)
    L = dry.L + wet.L * .85 + wl * .45
    R = dry.R + wet.R * .85 + wr * .45
    m = int(total * SR)
    st = np.stack([L[:m], R[:m]], 1)
    t = _t(total)
    st *= np.clip((total - t) / .5, 0, 1)[:, None] * np.clip(t / .02, 0, 1)[:, None]
    st = np.tanh(st * 1.15)
    st = st / np.max(np.abs(st)) * .9
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    data = json.load(open(os.path.join(HERE, "cues.json")))
    build(data["total"], data["cues"], os.path.join(HERE, ".audio.wav"))
    print("audio ready")
