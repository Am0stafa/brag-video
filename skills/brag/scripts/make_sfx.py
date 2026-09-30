#!/usr/bin/env python3
"""Synthesise sound effects the bundled library does not have.

Runs inside the brag-tools image. Each call writes one 48 kHz stereo WAV,
peak-normalised to about -1 dBFS. Everything is generated, so it is original
and needs no licence; the same seed gives the same file.

  python3 make_sfx.py whoosh    --out whoosh.wav [--dur 0.75 --from 350 --to 3200 --pan-from -0.7 --pan-to 0.5]
  python3 make_sfx.py riser     --out riser.wav  [--dur 2.0 --from 300 --to 9000 --no-tone]
  python3 make_sfx.py boom      --out boom.wav   [--dur 2.4 --from 95 --to 30]
  python3 make_sfx.py impact    --out hit.wav    [--dur 1.2]
  python3 make_sfx.py blip      --out blip.wav   [--note 84 --dur 0.05]
  python3 make_sfx.py tick      --out tick.wav   [--freq 3000]
  python3 make_sfx.py shimmer   --out shine.wav  [--notes 76,79,84 --dur 2.0]
  python3 make_sfx.py wingbeats --out wings.wav  [--count 4 --gap 0.3]
  python3 make_sfx.py glitch    --out glitch.wav [--dur 0.3]

Common options: --seed N (default 11), --peak 0.89.
Use: whoosh for moves and wipes, riser into a reveal, boom/impact for a logo or
a big number, blip/tick for data and UI accents, shimmer for a success moment,
wingbeats for anything that flaps, glitch for an error or a "before" state.
"""
import argparse
import os

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def stereo(mono, pan=0.0):
    a = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def whoosh(rng, dur, f0, f1, pan0, pan1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    y = np.zeros(n)
    zi = None
    for i in range(0, n, 512):
        fc = f0 * (f1 / f0) ** (i / n)
        sos = signal.butter(2, [fc * 0.6, min(fc * 1.6, SR / 2 - 200)], "bandpass", fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y[i:i + 512], zi = signal.sosfilt(sos, x[i:i + 512], zi=zi)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    env *= np.minimum(1, t / 0.03)
    p = pan0 + (pan1 - pan0) * t / dur
    a = (p + 1) * np.pi / 4
    return np.stack([y * env * np.cos(a), y * env * np.sin(a)], axis=1)


def riser(rng, dur, f0, f1, tone):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    y = np.zeros(n)
    zi = None
    for i in range(0, n, 1024):
        fc = f0 * (f1 / f0) ** (i / n)
        sos = signal.butter(2, [fc * 0.7, min(fc * 1.4, SR / 2 - 100)], "bandpass", fs=SR, output="sos")
        if zi is None:
            zi = signal.sosfilt_zi(sos) * 0
        y[i:i + 1024], zi = signal.sosfilt(sos, x[i:i + 1024], zi=zi)
    e = (t / dur) ** 2.2
    out = y * e
    if tone:
        out += 0.25 * np.sin(2 * np.pi * np.cumsum(220 * 8.0 ** (t / dur)) / SR) * e
    return np.stack([out, np.roll(out, 90)], axis=1)


def boom(rng, dur, f0, f1):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.35)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    y += signal.sosfilt(signal.butter(2, 900, "low", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t / 0.18) * 0.5
    return stereo(y)


def impact(rng, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 40 + 70 * np.exp(-t / 0.06)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.28)
    crack = signal.sosfilt(signal.butter(2, [900, 6000], "bandpass", fs=SR, output="sos"), rng.standard_normal(n))
    crack *= np.exp(-t / 0.035) * 0.6
    air = signal.sosfilt(signal.butter(2, 4200, "high", fs=SR, output="sos"), rng.standard_normal((n, 2)), axis=0)
    air *= (np.minimum(1, t / 0.004) * np.exp(-t / 0.45))[:, None] * 0.18
    return stereo(body + crack) + air


def blip(rng, note, dur):
    n = int(dur * 4 * SR)
    t = np.arange(n) / SR
    f = mtof(note)
    y = np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t / dur)
    return stereo(y, float(rng.uniform(-0.3, 0.3)))


def tick(rng, freq):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    x = signal.sosfilt(signal.butter(2, [freq * 0.7, min(freq * 1.4, SR / 2 - 100)], "bandpass", fs=SR, output="sos"),
                       rng.standard_normal(n))
    y = x * np.exp(-t / 0.004) + 0.3 * np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006)
    return stereo(y)


def shimmer(rng, notes, dur):
    n = int(dur * SR)
    out = np.zeros((n, 2))
    for k, m in enumerate(notes):
        start = int(k * 0.06 * SR)
        t = np.arange(n - start) / SR
        f = mtof(m)
        y = np.sin(2 * np.pi * f * t + 2.2 * np.exp(-t / 0.35) * np.sin(2 * np.pi * 3.5 * f * t))
        y *= np.minimum(1, t / 0.004) * np.exp(-t / (dur / 3))
        out[start:] += stereo(y, -0.4 + 0.8 * k / max(1, len(notes) - 1))
    return out


def wingbeats(rng, count, gap):
    n = int((count * gap + 0.5) * SR)
    out = np.zeros(n)
    for k in range(count):
        i = int(k * gap * SR)
        m = int(0.32 * SR)
        t = np.arange(m) / SR
        burst = signal.sosfilt(signal.butter(2, [140, 900], "bandpass", fs=SR, output="sos"), rng.standard_normal(m))
        env = np.minimum(1, t / 0.05) * np.exp(-np.maximum(0, t - 0.05) / 0.09)
        out[i:i + m] += burst * env * (0.8 + 0.2 * (k % 2))
    return np.stack([out, np.roll(out, 60)], axis=1)


def glitch(rng, dur):
    n = int(dur * SR)
    y = np.zeros(n)
    i = 0
    while i < n:
        seg = int(rng.uniform(0.008, 0.04) * SR)
        if rng.random() < 0.7:
            hold = max(1, int(rng.uniform(4, 40)))
            burst = np.repeat(rng.standard_normal(seg // hold + 1), hold)[:seg]
            y[i:i + seg] = burst[: n - i] * rng.uniform(0.3, 1.0)
        i += seg
    y = np.round(y * 8) / 8
    return np.stack([y, np.roll(y, 37)], axis=1)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="kind", required=True)

    def add(name, **opts):
        p = sub.add_parser(name)
        p.add_argument("--out", required=True)
        p.add_argument("--seed", type=int, default=11)
        p.add_argument("--peak", type=float, default=0.89)
        for flag, (typ, default) in opts.items():
            if typ is bool:
                p.add_argument(flag, action="store_true")
            else:
                p.add_argument(flag, type=typ, default=default)
        return p

    add("whoosh", **{"--dur": (float, 0.75), "--from": (float, 350), "--to": (float, 3200),
                     "--pan-from": (float, -0.7), "--pan-to": (float, 0.5)})
    add("riser", **{"--dur": (float, 2.0), "--from": (float, 300), "--to": (float, 9000), "--no-tone": (bool, False)})
    add("boom", **{"--dur": (float, 2.4), "--from": (float, 95), "--to": (float, 30)})
    add("impact", **{"--dur": (float, 1.2)})
    add("blip", **{"--note": (int, 84), "--dur": (float, 0.05)})
    add("tick", **{"--freq": (float, 3000)})
    add("shimmer", **{"--notes": (str, "76,79,84"), "--dur": (float, 2.0)})
    add("wingbeats", **{"--count": (int, 4), "--gap": (float, 0.3)})
    add("glitch", **{"--dur": (float, 0.3)})
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)
    v = vars(a)
    if a.kind == "whoosh":
        st = whoosh(rng, a.dur, v["from"], a.to, a.pan_from, a.pan_to)
    elif a.kind == "riser":
        st = riser(rng, a.dur, v["from"], a.to, not a.no_tone)
    elif a.kind == "boom":
        st = boom(rng, a.dur, v["from"], a.to)
    elif a.kind == "impact":
        st = impact(rng, a.dur)
    elif a.kind == "blip":
        st = blip(rng, a.note, a.dur)
    elif a.kind == "tick":
        st = tick(rng, a.freq)
    elif a.kind == "shimmer":
        st = shimmer(rng, [int(x) for x in a.notes.split(",")], a.dur)
    elif a.kind == "wingbeats":
        st = wingbeats(rng, a.count, a.gap)
    else:
        st = glitch(rng, a.dur)
    peak = np.abs(st).max()
    if peak > 0:
        st = st / peak * a.peak
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    wavfile.write(a.out, SR, (st * 32767).astype(np.int16))
    print(f"{a.out}: {a.kind}, {len(st) / SR:.2f}s")


if __name__ == "__main__":
    main()
