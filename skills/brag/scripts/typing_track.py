#!/usr/bin/env python3
"""The launch style's typing sound: one deep "key" hit per typed chunk, as one audio track.

Runs inside the brag-tools image. The hit is original: a small synth (a body whose pitch
falls fast from about 1.5 kHz to 75 Hz, a sub, a knock near 420 Hz, a slightly delayed
right channel for width) tuned until its measurements matched the typing hits of the
reference film (band energy over time, envelope, stereo width). No audio from the film is
used. The same events and seed always give the same file.

  # events from the finished composition (launch_events.cjs), then the track:
  python3 typing_track.py tools/launch-events.json --out composition/assets/sfx/typing.wav \
      [--music composition/assets/music/score.wav --music-volume 0.45 --above 8] \
      [--duck-music composition/assets/music/score-ducked.wav --duck-db 4] \
      [--placed tools/typing-placed.json] [--kinds word,piece,letter,slot,char] \
      [--under-voice] [--transitions] [--seed 5]
  # one hit, to listen to or to use elsewhere:
  python3 typing_track.py --one composition/assets/sfx/key.wav [--pitch 1.0]

Kinds: word (a whole word lands), piece (a token piece of a statement's first word),
letter (a letter of the lit word), slot (a slot candidate), char (caret typing).
Pieces, letters and caret characters are thinned to at least 90 ms apart (the film's hits land
about 0.1 s apart), so fast typing never buzzes. No single hit peaks above -2 dBFS.

Level: without --music, a word hit peaks at --level dBFS (default -3); play the track at
volume 0.5-0.7 next to a composed score at 0.4-0.5. With --music (the file and the volume
it plays at), each hit's first 20 ms sit --above dB (default 8) over the music's level in
the half second around it, never below -30 dBFS RMS, so it reads in quiet and busy parts
alike; play the track at volume 1.0. Each hit's peak is also capped by the gain that
finalize.py will add to reach --target (-14 LUFS), so that step keeps the hits intact.
--duck-music writes the music with a short dip (--duck-db, default 4 dB) under every hit;
play that file instead of the music, at the same volume. --placed lists the hits for
audio_report.py --hits.
--under-voice keeps only word and piece hits, 6 dB lower. --transitions adds a soft low whoosh
when a scene opens (open, fill, reveal, warp) and a small pop when the product's mark lands;
with --cues (the music's cue file) it skips the whoosh where the music has its own hit.
"""
import argparse
import json
import os
import subprocess

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000

# fitted to the reference film's first typing hit (see references/launch-style.md, "Sound")
KEY = {"attack": 0.0017, "f0": 1521.0, "f1": 75.4, "tp": 0.0039, "tb": 0.0056, "fs": 58.5, "ts": 0.006,
       "gs": 0.20, "fk": 421.0, "tk": 0.0074, "gk": 1.08, "tt": 0.0174, "gt": 0.0033, "width": 0.45, "drive": 0.5}

# how each kind of event sounds: pitch ratios to rotate through, gain in dB, body length factor
VOICES = {
    "word": ([1.0, 0.9, 1.06, 0.95], 0.0, 1.0),
    "piece": ([1.0, 1.08, 1.0], -1.0, 1.0),
    "slot": ([0.92], 0.0, 1.3),
    "letter": ([1.3, 1.4, 1.5], -4.0, 0.9),
    "char": ([1.6, 1.7], -8.0, 0.8),
}
MIN_GAP = 0.09    # seconds between a piece, letter or caret hit and the hit before it
PEAK_CAP = -2.0   # dBFS: no single hit peaks above this


def bandnoise(rng, n, lo, hi):
    sos = signal.butter(2, [max(20, lo), min(SR / 2 - 100, hi)], "band", fs=SR, output="sos")
    return signal.sosfilt(sos, rng.standard_normal(n))


def key(ratio=1.0, body=1.0, seed=0, p=KEY):
    """One deep key hit, stereo, peak 1.0."""
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    att = np.minimum(1, t / p["attack"])
    shorten = ratio ** -0.5
    f = p["f1"] * ratio + (p["f0"] - p["f1"]) * ratio * np.exp(-t / p["tp"])
    bodyw = np.sin(2 * np.pi * np.cumsum(f) / SR) * att * np.exp(-t / (p["tb"] * body * shorten))
    sub = np.sin(2 * np.pi * p["fs"] * ratio * t) * att * np.exp(-t / (p["ts"] * body * shorten)) * p["gs"]
    out = []
    for ch in range(2):
        rng = np.random.default_rng(seed * 7 + ch)
        knock = bandnoise(rng, n, p["fk"] * ratio / 1.8, p["fk"] * ratio * 1.8) * np.exp(-t / (p["tk"] * shorten)) * p["gk"]
        tail = bandnoise(rng, n, 250, 2500) * np.exp(-t / p["tt"]) * p["gt"] * att
        d = int(round(p["width"] * 0.001 * SR)) if ch == 1 else 0
        b = np.concatenate([np.zeros(d), bodyw])[:n]
        s = b + sub + knock + tail
        out.append(np.tanh(p["drive"] * s) / np.tanh(p["drive"]))
    st = np.stack(out, 1)
    fade = np.ones(n)
    fade[-int(0.01 * SR):] = np.linspace(1, 0, int(0.01 * SR))
    st *= fade[:, None]
    return st / np.abs(st).max()


def whoosh(seed, dur=0.32):
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)
    x = rng.standard_normal((n, 2))
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    out = np.zeros((n, 2))
    for k in range(0, n, 480):  # a band that sweeps down: 1.6 kHz -> 250 Hz
        fc = 1600 * (250 / 1600) ** (k / n)
        sos = signal.butter(2, [fc * 0.6, fc * 1.5], "band", fs=SR, output="sos")
        seg = signal.sosfilt(sos, x[max(0, k - 2000): k + 480], axis=0)[-min(480, n - k):]
        out[k: k + len(seg)] = seg
    out *= env[:, None]
    return out / np.abs(out).max()


def load_music(path, volume, channels=1):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", str(channels), "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64) * volume
    return x.reshape(-1, channels) if channels > 1 else x


def duck(music_st, hits, depth_db):
    """The music with a short dip under every hit: 2 ms down, 25 ms held, back over 80 ms."""
    env = np.ones(len(music_st))
    low = 10 ** (-depth_db / 20)
    a, h, r = int(0.002 * SR), int(0.025 * SR), int(0.08 * SR)
    shape = np.concatenate([np.linspace(1, low, a), np.full(h, low), low + (1 - low) * (1 - np.exp(-np.arange(r) / (r / 4)))])
    for t in hits:
        c = int(round(t * SR)) - a
        if c < 0 or c >= len(env):
            continue
        m = min(len(shape), len(env) - c)
        env[c: c + m] = np.minimum(env[c: c + m], shape[:m])
    return music_st * env[:, None]


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)


def lufs(x):
    """K-weighted loudness of a mono signal at 48 kHz (ungated: close enough for music)."""
    k1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
    k2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])
    z = signal.lfilter(*k2, signal.lfilter(*k1, x))
    return -0.691 + 10 * np.log10(np.mean(z ** 2) * 2 + 1e-12)  # x2: both channels carry the mono signal


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("events", nargs="?")
    ap.add_argument("--out")
    ap.add_argument("--one", help="write a single hit to this file and stop")
    ap.add_argument("--pitch", type=float, default=1.0)
    ap.add_argument("--kinds", default="word,piece,letter,slot,char")
    ap.add_argument("--level", type=float, default=-3.0, help="peak dBFS of a word hit when there is no --music")
    ap.add_argument("--music")
    ap.add_argument("--music-volume", type=float, default=0.45)
    ap.add_argument("--above", type=float, default=8.0)
    ap.add_argument("--target", type=float, default=-14.0, help="the loudness finalize.py will normalise to (LUFS)")
    ap.add_argument("--duck-music", help="also write the music with a short dip under every hit to this file; "
                                         "play it in place of the music, at the same volume")
    ap.add_argument("--duck-db", type=float, default=4.0, help="how deep the music dips under a hit (dB)")
    ap.add_argument("--cues", help="the music's cue file (compose_score.py --cues): with --transitions, no whoosh "
                                   "within 0.3 s of the music's own hits (impact, boom, crash, riser)")
    ap.add_argument("--under-voice", action="store_true")
    ap.add_argument("--transitions", action="store_true")
    ap.add_argument("--offset", type=float, default=0.0, help="seconds added to every event (default 0)")
    ap.add_argument("--seed", type=int, default=5)
    ap.add_argument("--placed", help="also write the hits it placed (time, kind, peak dBFS) to this JSON file")
    a = ap.parse_args()

    if a.one:
        hit = key(a.pitch, seed=a.seed) * 10 ** (-1 / 20)
        os.makedirs(os.path.dirname(os.path.abspath(a.one)), exist_ok=True)
        wavfile.write(a.one, SR, (hit * 32767).astype(np.int16))
        print(f"one hit -> {a.one} ({len(hit) / SR * 1000:.0f} ms)")
        return
    if not a.events or not a.out:
        ap.error("give the events file and --out (or --one)")

    data = json.load(open(a.events))
    events = sorted(data["events"], key=lambda e: e["t"])
    duration = float(data.get("duration") or (events[-1]["t"] + 1 if events else 1))
    kinds = set(a.kinds.split(","))
    if a.under_voice:
        kinds &= {"word", "piece", "slot"}
    n = int((duration + 0.5) * SR)
    track = np.zeros((n, 2))
    music = load_music(a.music, a.music_volume) if a.music else None
    peak_cap = PEAK_CAP
    if music is not None:
        # finalize.py later raises the whole mix to the target loudness. It can do that
        # linearly (keeping every hit's punch) only if no peak would pass -1 dBTP, so cap
        # each hit at -1.5 dBTP minus the gain the music will need to reach the target.
        final_gain = a.target - lufs(music)
        peak_cap = min(PEAK_CAP, -1.5 - max(0.0, final_gain))
        print(f"music plays at {lufs(music):.1f} LUFS here; finalize will add about {final_gain:+.1f} dB, "
              f"so each hit peaks at or below {peak_cap:.1f} dBFS")

    placed, dropped, last_hit = {}, 0, -1.0
    turn = {}
    log = []
    music_hits = []
    if a.cues:
        cues = json.load(open(a.cues))
        music_hits = [c["time"] for c in cues.get("strongCues", []) if c.get("kind") in ("impact", "boom", "crash", "riser")]
    for i, e in enumerate(events):
        k, t = e["kind"], e["t"] + a.offset
        if k in VOICES and k in kinds:
            # pieces, letters and caret characters come faster than the film's hits (about
            # 0.1 s apart); keep them at least MIN_GAP apart so the typing never buzzes
            if k in ("piece", "letter", "char") and t - last_hit < MIN_GAP:
                dropped += 1
                continue
            steps, gain_db, body = VOICES[k]
            j = turn.get(k, 0)
            turn[k] = j + 1
            hit = key(steps[j % len(steps)] * a.pitch, body, seed=a.seed + i)
            gain_db += (((i * 7919) % 13) / 13 - 0.5) * 1.4  # a little life: +-0.7 dB
            if a.under_voice:
                gain_db -= 6
            if music is not None:
                # the music's short-term level (half a second), so a kick next to the hit
                # doesn't make that one hit jump out
                c = int(t * SR)
                around = music[max(0, c - int(0.25 * SR)): c + int(0.25 * SR)]
                target_rms = max(-30.0, rms_db(around) + a.above) + gain_db
                cur_rms = rms_db(hit[: int(0.02 * SR)].mean(1))
                g = 10 ** ((target_rms - cur_rms) / 20)
            else:
                g = 10 ** ((a.level + gain_db) / 20)
            g = min(g, 10 ** (peak_cap / 20))  # the hit is peak-normalised, so this caps its peak
            last_hit = t
        elif a.transitions and k in ("open", "fill", "reveal", "warp", "wipe"):
            if any(abs(t - h) < 0.3 for h in music_hits):
                continue  # the music already hits here
            hit, g = whoosh(a.seed + i), 10 ** ((a.level - 10) / 20)
        elif a.transitions and k in ("mark", "dot"):  # "dot": events from older compositions
            hit, g = key(1.8, 0.8, seed=a.seed + i), 10 ** ((a.level - 8) / 20)
        else:
            continue
        c = int(round(t * SR))
        if c >= n:
            continue
        m = min(len(hit), n - c)
        track[c: c + m] += hit[:m] * g
        placed[k] = placed.get(k, 0) + 1
        log.append({"t": round(t, 3), "kind": k, "peak_dbfs": round(20 * np.log10(g + 1e-12), 1)})

    peak = np.abs(track).max()
    if peak > 0.97:
        track *= 0.97 / peak
        print(f"note: the track peaked at {20 * np.log10(peak):+.1f} dBFS and was scaled to -0.3 dBFS")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    wavfile.write(a.out, SR, (track * 32767).astype(np.int16))
    if a.placed:
        json.dump(log, open(a.placed, "w"), indent=1)
    if a.duck_music:
        if not a.music:
            ap.error("--duck-music needs --music")
        typed = [h["t"] for h in log if h["kind"] in VOICES]
        ducked = duck(load_music(a.music, 1.0, channels=2), typed, a.duck_db)
        peak = np.abs(ducked).max()
        os.makedirs(os.path.dirname(os.path.abspath(a.duck_music)), exist_ok=True)
        wavfile.write(a.duck_music, SR, (ducked / max(1.0, peak / 0.999) * 32767).astype(np.int16))
        print(f"ducked music -> {a.duck_music}: dips of {a.duck_db:g} dB under {len(typed)} hits "
              f"(play it at the same volume as the original)")
    print(f"typing track -> {a.out}: {sum(placed.values())} sounds ({', '.join(f'{k} {v}' for k, v in placed.items())}); "
          f"thinned {dropped} hits closer than {MIN_GAP * 1000:.0f} ms; {duration:.1f} s; "
          f"peak {20 * np.log10(np.abs(track).max() + 1e-9):.1f} dBFS")


if __name__ == "__main__":
    main()
