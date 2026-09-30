#!/usr/bin/env python3
"""Measure a video's or a track's sound, so the mix can be judged without ears.

Runs inside the brag-tools image.

  python3 audio_report.py brag.mp4 [--sections 0-4,4-10,10-26,26-30] [--target -14] [--json report.json]
                          [--hits tools/typing-placed.json]

Prints integrated loudness (LUFS), true peak (dBTP) and loudness range for the
whole file, then level, peak and bass/mid/treble balance for each section, and
flags what usually needs fixing:

  - integrated loudness more than 2 LU away from the target (-14 LUFS by default,
    what most platforms normalise to)
  - true peak above -1 dBTP (can distort after platform encoding)
  - a section that is nearly silent, or much louder than the rest
  - a section that is almost all bass (thin or near-silent on laptop and phone
    speakers). Electronic music normally keeps about -2 dB of its energy share in
    the low band; only more than that is flagged.

Section levels are K-weighted (LUFS), the same weighting platforms use.

With --hits (a JSON list of {t, kind}, such as typing_track.py --placed writes), it also
checks that each short sound is heard in the finished mix. Ears hear a short hit by its
onset, so it ranks the onset strength (60 Hz - 3 kHz) at each hit against every moment of
the file: a typical hit should sit at or above the 85th percentile (90+ is clear). It also
prints how far the mix rises at a hit (over 15 dB is too loud) and whether hits land on
time. Run it on the finalized video: the loudness step is where short hits get lost.

It cannot say whether the music *fits*; say so when you report the video.
"""
import argparse
import json
import os
import subprocess

import numpy as np

SR = 48000


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def loudness(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "loudnorm=print_format=json",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(out[out.rindex("{"): out.rindex("}") + 1])
    return float(j["input_i"]), float(j["input_tp"]), float(j["input_lra"])


# ITU-R BS.1770 K-weighting at 48 kHz, so section levels follow what ears hear
# (plain RMS is dominated by bass and misjudges bright, busy sections)
K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def lufs(seg):
    from scipy import signal
    z = signal.lfilter(*K2, signal.lfilter(*K1, seg, axis=0), axis=0)
    return -0.691 + 10 * np.log10((z ** 2).mean(axis=0).sum() + 1e-12)


def bands(seg):
    mono = seg.mean(axis=1)
    spec = np.abs(np.fft.rfft(mono)) ** 2
    fr = np.fft.rfftfreq(len(mono), 1 / SR)
    tot = spec.sum() + 1e-20
    return {nm: round(10 * np.log10(spec[(fr >= lo) & (fr < hi)].sum() / tot + 1e-12), 1)
            for lo, hi, nm in ((20, 150, "low"), (150, 2000, "mid"), (2000, 8000, "high"), (8000, 20000, "air"))}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--sections", help="comma-separated start-end pairs in seconds, e.g. 0-4,4-10")
    ap.add_argument("--target", type=float, default=-14.0)
    ap.add_argument("--json")
    ap.add_argument("--hits", help="JSON list of {t, kind}: short sounds to find in the mix")
    a = ap.parse_args()

    x = decode(a.file)
    dur = len(x) / SR
    if dur == 0:
        raise SystemExit("no audio stream")
    integrated, tp, lra = loudness(a.file)
    flags = []
    if abs(integrated - a.target) > 2.0:
        flags.append(f"integrated loudness {integrated:.1f} LUFS is {integrated - a.target:+.1f} LU from the "
                     f"{a.target:g} LUFS target: raise or lower the music/voice volumes, or normalise in finalize.py")
    if tp > -1.0:
        flags.append(f"true peak {tp:.1f} dBTP is above -1 dBTP: lower the loudest element or normalise")

    secs = []
    if a.sections:
        for part in a.sections.split(","):
            s0, s1 = (float(v) for v in part.split("-"))
            secs.append((s0, min(s1, dur)))
    else:
        step = max(2.0, dur / 8)
        t = 0.0
        while t < dur - 0.05:
            secs.append((t, min(dur, t + step)))
            t += step

    rows = []
    for s0, s1 in secs:
        seg = x[int(s0 * SR):int(s1 * SR)]
        if len(seg) < 64:
            continue
        peak = 20 * np.log10(np.abs(seg).max() + 1e-9)
        rows.append({"start": s0, "end": s1, "lufs": round(lufs(seg), 1), "peak_dbfs": round(peak, 1), "bands_db": bands(seg)})
    if rows:
        med = float(np.median([r["lufs"] for r in rows]))
        for r in rows:
            if r["lufs"] < -45:
                flags.append(f"{r['start']:g}-{r['end']:g}s is nearly silent ({r['lufs']} LUFS): intended?")
            elif r["lufs"] > med + 6:
                flags.append(f"{r['start']:g}-{r['end']:g}s is {r['lufs'] - med:.1f} LU louder than the typical section")
            if r["bands_db"]["low"] > -1.0:
                flags.append(f"{r['start']:g}-{r['end']:g}s is almost all bass (low band {r['bands_db']['low']} dB share): "
                             f"may sound thin on laptop and phone speakers")

    hits_out = None
    if a.hits:
        from scipy import signal
        hits = json.load(open(a.hits))
        if isinstance(hits, dict):
            hits = hits.get("events", [])
        mono = signal.sosfiltfilt(signal.butter(4, [60, 3000], "band", fs=SR, output="sos"), x.mean(axis=1))
        env = np.convolve(mono ** 2, np.ones(96) / 96, "same")  # 2 ms power envelope
        # onset strength: how sharply the 60 Hz - 3 kHz spectrum rises, in 5 ms steps. Ears hear
        # a short hit by its onset, so a hit is "heard" when its onset stands out from the file.
        f, tt, Z = signal.stft(x.mean(axis=1), SR, nperseg=1024, noverlap=1024 - 240, boundary=None, padded=False)
        band = (f >= 60) & (f <= 3000)
        flux = np.maximum(0, np.diff(np.log1p(1000 * np.abs(Z[band])), axis=1)).sum(0)
        ft = tt[1:]
        rises, offsets, pct = [], [], []
        for h in hits:
            c = int(h["t"] * SR)
            if c - int(0.06 * SR) < 0 or c + int(0.03 * SR) > len(mono):
                continue
            after = np.sqrt(np.mean(mono[c: c + int(0.025 * SR)] ** 2)) + 1e-9
            before = np.sqrt(np.mean(mono[c - int(0.06 * SR): c - int(0.01 * SR)] ** 2)) + 1e-9
            rises.append(20 * np.log10(after / before))
            w = env[c - int(0.03 * SR): c + int(0.03 * SR)]
            offsets.append(1000 * (int(np.argmax(np.diff(w))) - int(0.03 * SR)) / SR)
            near = (ft >= h["t"] - 0.01) & (ft <= h["t"] + 0.02)
            if near.any():
                pct.append(100 * (flux < flux[near].max()).mean())
        if rises:
            r = np.array(rises)
            o = np.array(offsets)
            p = np.array(pct) if pct else np.array([0.0])
            hits_out = {"count": len(r), "median_onset_percentile": round(float(np.median(p)), 1),
                        "share_standing_out": round(float((p >= 90).mean()), 2),
                        "median_rise_db": round(float(np.median(r)), 1), "median_offset_ms": round(float(np.median(o)), 1)}
            if hits_out["median_onset_percentile"] < 85:
                flags.append(f"the hits are buried: a typical hit's onset is only at the {hits_out['median_onset_percentile']}th "
                             f"percentile of the file (raise typing_track.py --duck-db or --above, or lower the music "
                             f"under the typing)")
            if hits_out["median_rise_db"] > 15:
                flags.append(f"the hits are too loud: the mix jumps {hits_out['median_rise_db']} dB at a typical hit")
            if abs(hits_out["median_offset_ms"]) > 20:
                flags.append(f"the hits land {hits_out['median_offset_ms']} ms off their events: check the events file")

    print(f"{a.file}: {dur:.2f}s  integrated {integrated:.1f} LUFS  true peak {tp:.1f} dBTP  LRA {lra:.1f} LU")
    if hits_out:
        print(f"hits: {hits_out['count']} checked; a typical hit's onset is at the {hits_out['median_onset_percentile']}th "
              f"percentile of the file ({int(100 * hits_out['share_standing_out'])}% of hits in the top 10%); "
              f"the mix rises {hits_out['median_rise_db']} dB at a typical hit; median timing {hits_out['median_offset_ms']:+} ms")
    print(f"{'section':<14}{'LUFS':>7}{'peak':>7}   low / mid / high / air (dB share)")
    for r in rows:
        b = r["bands_db"]
        print(f"{r['start']:>5.1f}-{r['end']:<7.1f}{r['lufs']:>7.1f}{r['peak_dbfs']:>7.1f}   "
              f"{b['low']} / {b['mid']} / {b['high']} / {b['air']}")
    print("flags:" if flags else "flags: none")
    for f in flags:
        print(f"  - {f}")
    if a.json:
        os.makedirs(os.path.dirname(os.path.abspath(a.json)), exist_ok=True)
        json.dump({"file": a.file, "duration": dur, "integrated_lufs": integrated, "true_peak_dbtp": tp,
                   "lra": lra, "target_lufs": a.target, "sections": rows, "hits": hits_out, "flags": flags},
                  open(a.json, "w"), indent=1)


if __name__ == "__main__":
    main()
