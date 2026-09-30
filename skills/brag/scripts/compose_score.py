#!/usr/bin/env python3
"""Compose an original music bed that fits a video's storyboard.

Runs inside the brag-tools image (see references/runtime-docker.md), never on
the host. The input is a small JSON plan: tempo, key, a style, and the video's
sections with an energy level (0-3) and an optional role. The output is:

  <out>.wav          48 kHz stereo, mastered to a loudness target (-14 LUFS default)
  <cues>.json        exact beats and strong cues in the /brag cue schema, so
                     scene cuts and reveals can lock to the music
  a printed report   loudness and bass/mid/treble balance per section, integrated
                     LUFS and true peak — how to judge the mix without listening; a
                     note when a rise in energy is not louder than what came before
                     it (a drop is compared with the section before its build)

Everything is synthesised (band-limited saws, FM bells, noise drums, a generated
reverb), so the track is original and needs no licence. Same plan + same seed
gives the same file, byte for byte.

  python3 compose_score.py plan.json --out music.wav --cues music.cues.json \
      [--spectrogram music.png]

Plan (all fields except duration and sections are optional):
  {
    "duration": 30.0,
    "bpm": 120,              # 120 keeps every beat on a half second
    "key": "A", "mode": "minor",          # or "major"
    "style": "pulse",        # pulse | cinematic | warm | minimal (voiceover bed)
    "seed": 1,
    "target_lufs": -14.0,
    "sections": [            # contiguous, from 0 to duration, on the beat grid
      {"start": 0,  "end": 4,  "energy": 0, "role": "hook"},
      {"start": 4,  "end": 8,  "energy": 1},
      {"start": 8,  "end": 24, "energy": 2},
      {"start": 24, "end": 26, "energy": 3, "role": "build"},
      {"start": 26, "end": 30, "energy": 1, "role": "resolve"}
    ],
    "hits": [{"t": 4.0, "kind": "boom"}, {"t": 8.0, "kind": "crash"}],
    "duck": [{"start": 10.0, "end": 14.0, "db": -8}]
  }

Energy: 0 pad only · 1 + arpeggio · 2 + drums and bass · 3 + bells, lead, brighter.
Roles (optional): hook (tension and data blips), break (drums out), build (riser,
snare roll, dominant chord into the next section), resolve (final chord rings out).
Hit kinds: boom, crash, impact, riser (a riser that ends at t).
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
NOTE = {"C": 0, "C#": 1, "DB": 1, "D": 2, "D#": 3, "EB": 3, "E": 4, "F": 5, "F#": 6, "GB": 6,
        "G": 7, "G#": 8, "AB": 8, "A": 9, "A#": 10, "BB": 10, "B": 11}

# Harmony, written in A minor / C major and transposed to the plan's key.
# Each chord: (pad voicing, sub root, arpeggio tones).
MINOR = {
    "loop": [([57, 60, 64, 71], 33, [69, 72, 76, 83]), ([53, 57, 60, 64], 29, [65, 69, 72, 76]),
             ([55, 60, 62, 64], 36, [67, 72, 74, 76]), ([55, 59, 62, 64], 31, [67, 71, 74, 76])],
    "bells": [76, 77, 79, 74],
    "dominant": ([52, 56, 59, 62], 28, [64, 68, 71, 74]),
    "final": ([45, 52, 57, 59, 60, 64], 33, [69, 72, 76, 81]),
    "ref": 9,
}
MAJOR = {
    "loop": [([55, 60, 62, 64], 36, [67, 72, 74, 76]), ([55, 59, 62, 64], 31, [67, 71, 74, 79]),
             ([57, 60, 64, 67], 33, [69, 72, 76, 79]), ([53, 57, 60, 64], 29, [65, 69, 72, 76])],
    "bells": [76, 74, 72, 77],
    "dominant": ([55, 59, 62, 65], 31, [67, 71, 74, 77]),
    "final": ([48, 55, 60, 62, 64, 67], 36, [72, 76, 79, 84]),
    "ref": 0,
}

STYLES = {
    # agentic / tech: always-on arpeggio, data blips, four-on-the-floor
    "pulse": dict(pad=0.24, pad_cut=(900, 2800), arp_div=4, arp=0.21, arp_bright=(3600, 5600),
                  blips=(0.06, 0.12, 0.2, 0.26), kick=0.85, toms=0.0, clap=0.34, hats="16",
                  bells=0.14, lead=0.28, boom=0.72, shelf=2.5, pocket=0.0, verb=0.9, blip_notes=[81, 84, 86, 88, 91]),
    # trailer: big pads, low toms and booms, slow arpeggio, no hats
    "cinematic": dict(pad=0.30, pad_cut=(700, 2400), arp_div=2, arp=0.15, arp_bright=(2400, 3800),
                      blips=(0, 0, 0, 0), kick=0.0, toms=0.9, clap=0.0, hats="none",
                      bells=0.16, lead=0.26, boom=1.0, shelf=1.5, pocket=0.0, verb=1.3, blip_notes=[]),
    # friendly product: bright plucks, soft kick, claps and shakers
    "warm": dict(pad=0.20, pad_cut=(1400, 3200), arp_div=2, arp=0.2, arp_bright=(4200, 6200),
                 blips=(0, 0, 0.03, 0.05), kick=0.6, toms=0.0, clap=0.24, hats="8",
                 bells=0.13, lead=0.0, boom=0.45, shelf=2.0, pocket=0.0, verb=0.8, blip_notes=[84, 88, 91]),
    # under a voiceover: pads and a soft pluck, a dip where speech lives, almost no drums
    "minimal": dict(pad=0.22, pad_cut=(1000, 2200), arp_div=2, arp=0.1, arp_bright=(2600, 3600),
                    blips=(0, 0, 0, 0), kick=0.35, toms=0.0, clap=0.0, hats="none",
                    bells=0.08, lead=0.0, boom=0.35, shelf=0.0, pocket=-4.0, verb=1.0, blip_notes=[]),
}
ARP_PATTERN = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 3, 2, 1, 2]


def s(t):
    return int(round(t * SR))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


class Score:
    def __init__(self, plan):
        self.plan = plan
        self.dur = float(plan["duration"])
        self.n = s(self.dur)
        self.bpm = float(plan.get("bpm", 120))
        self.beat = 60.0 / self.bpm
        self.bar = 4 * self.beat
        self.style_name = plan.get("style", "pulse")
        if self.style_name not in STYLES:
            sys.exit(f"unknown style {self.style_name!r}; use one of {', '.join(STYLES)}")
        self.st = STYLES[self.style_name]
        mode = plan.get("mode", "minor").lower()
        self.h = MAJOR if mode == "major" else MINOR
        key = str(plan.get("key", "C" if mode == "major" else "A")).upper()
        if key not in NOTE:
            sys.exit(f"unknown key {key!r}")
        off = (NOTE[key] - self.h["ref"]) % 12
        self.off = off - 12 if off > 6 else off
        self.rng = np.random.default_rng(int(plan.get("seed", 1)))
        self.bus = {k: np.zeros((self.n, 2)) for k in ("pad", "bass", "sub", "arp", "bell", "lead", "kick", "perc", "fx", "blip")}
        self.kicks = []
        self._tables = {}

    # ------------------------------------------------------------ helpers
    def tr(self, m):
        return m + self.off

    def add(self, bus, start, mono=None, stereo=None, pan=0.0):
        i = s(start)
        if i >= self.n:
            return
        if stereo is None:
            a = (pan + 1) * np.pi / 4
            stereo = np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)
        if i < 0:
            stereo, i = stereo[-i:], 0
        j = min(self.n, i + len(stereo))
        self.bus[bus][i:j] += stereo[: j - i]

    def env(self, n_on, a, d, sl, r):
        a_n, d_n, r_n = max(1, s(a)), max(1, s(d)), max(1, s(r))
        e = np.concatenate([np.linspace(0, 1, a_n, endpoint=False), np.linspace(1, sl, d_n, endpoint=False),
                            np.full(max(0, n_on - a_n - d_n), sl)])[:n_on]
        last = e[-1] if len(e) else 0.0
        return np.concatenate([e, last * np.linspace(1, 0, r_n) ** 1.6])

    def saw(self, freq, n, cutoff, phase=0.0, fm=None):
        key = (round(freq, 2), int(cutoff))
        if key not in self._tables:
            x = np.arange(4096) / 4096
            tab = np.zeros(4096)
            kmax = int(min(18000.0, cutoff * 3.5) / freq)
            for k in range(1, max(2, min(kmax, 2047) + 1)):
                w = (1.0 / k) / np.sqrt(1.0 + (k * freq / cutoff) ** 4)
                if w < 1e-4:
                    break
                tab += w * np.sin(2 * np.pi * k * x)
            self._tables[key] = tab
        tab = self._tables[key]
        ph = freq * np.arange(n) / SR + phase / (2 * np.pi)
        if fm is not None:
            ph = ph + fm / (2 * np.pi)
        idx = (ph % 1.0) * 4096
        i0 = idx.astype(np.int64) % 4096
        frac = idx - np.floor(idx)
        return tab[i0] * (1 - frac) + tab[(i0 + 1) % 4096] * frac

    def noise(self, n, lo=None, hi=None):
        x = self.rng.standard_normal(n)
        if lo and hi:
            x = signal.sosfilt(signal.butter(2, [lo, hi], "bandpass", fs=SR, output="sos"), x)
        elif lo:
            x = signal.sosfilt(signal.butter(2, lo, "high", fs=SR, output="sos"), x)
        elif hi:
            x = signal.sosfilt(signal.butter(2, hi, "low", fs=SR, output="sos"), x)
        return x

    # ------------------------------------------------------------ instruments
    def pad(self, notes, start, dur, amp, cutoff, attack=0.3, release=0.8):
        e = self.env(s(dur), attack, 0.4, 0.85, release)
        n = len(e)
        for j, m in enumerate(notes):
            f = mtof(self.tr(m))
            left = sum(self.saw(f * 2 ** (c / 1200), n, cutoff, phase=0.7 * v + j) for v, c in enumerate((-9, 0, 7)))
            right = sum(self.saw(f * 2 ** (c / 1200), n, cutoff, phase=1.9 * v + j) for v, c in enumerate((-7, 2, 9)))
            self.add("pad", start, stereo=np.stack([left, right], axis=1) * (e[:, None] * amp / 3.0))

    def pluck(self, m, start, amp, bright, dark, decay, pan, bus="arp"):
        n = s(decay * 5)
        f = mtof(self.tr(m))
        t = np.arange(n) / SR
        fenv = np.exp(-t / (decay * 0.55))
        tone = fenv * self.saw(f, n, bright) + (1 - fenv) * self.saw(f, n, dark)
        self.add(bus, start, tone * np.minimum(1, t / 0.003) * np.exp(-t / decay) * amp, pan=pan)

    def bell(self, m, start, amp, pan=0.0, tau=1.1):
        n = s(tau * 5)
        f = mtof(self.tr(m))
        t = np.arange(n) / SR
        y = np.sin(2 * np.pi * f * t + 2.2 * np.exp(-t / 0.35) * np.sin(2 * np.pi * 3.5 * f * t))
        y += 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.4)
        self.add("bell", start, y * np.minimum(1, t / 0.004) * np.exp(-t / tau) * amp, pan=pan)

    def lead(self, m, start, dur, amp, cutoff=3200):
        e = self.env(s(dur), 0.025, 0.18, 0.8, 0.28)
        n = len(e)
        t = np.arange(n) / SR
        f = mtof(self.tr(m))
        vib = 2 * np.pi * np.cumsum(f * (2 ** (0.10 / 12 * np.sin(2 * np.pi * 5.4 * t) * np.minimum(1, t / 0.35)) - 1)) / SR
        y = self.saw(f * 2 ** (-6 / 1200), n, cutoff, fm=vib) + self.saw(f * 2 ** (6 / 1200), n, cutoff, phase=1.3, fm=vib)
        self.add("lead", start, y * e * amp * 0.5)

    def sub(self, m, start, dur, amp):
        e = self.env(s(dur), 0.008, 0.05, 0.9, 0.06)
        t = np.arange(len(e)) / SR
        self.add("sub", start, np.tanh(1.6 * np.sin(2 * np.pi * mtof(self.tr(m)) * t)) / np.tanh(1.6) * e * amp)

    def bass(self, m, start, dur, amp, cutoff=700):
        e = self.env(s(dur), 0.005, 0.12, 0.55, 0.06)
        self.add("bass", start, self.saw(mtof(self.tr(m)), len(e), cutoff) * e * amp)

    def kick(self, start, amp, duck=True):
        n = s(0.55)
        t = np.arange(n) / SR
        f = 47 + 78 * np.exp(-t / 0.042)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.30)
        click = signal.sosfilt(signal.butter(2, 2500, "high", fs=SR, output="sos"),
                               self.rng.standard_normal(n) * np.exp(-t / 0.0025) * 0.35)
        self.add("kick", start, (y + click) * amp)
        if duck:
            self.kicks.append(start)

    def tom(self, start, amp, f0=110):
        n = s(0.9)
        t = np.arange(n) / SR
        f = f0 * 0.55 + f0 * 0.45 * np.exp(-t / 0.08)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35)
        y += self.noise(n, 200, 1200) * np.exp(-t / 0.05) * 0.35
        self.add("perc", start, y * amp)
        self.kicks.append(start)

    def hat(self, start, amp, open_=False, pan=0.0):
        n = s(0.5 if open_ else 0.12)
        t = np.arange(n) / SR
        self.add("perc", start, self.noise(n, lo=7200) * np.exp(-t / (0.2 if open_ else 0.03)) * amp * 0.7, pan=pan)

    def tick(self, start, amp, freq=3000.0, pan=0.0):
        n = s(0.06)
        t = np.arange(n) / SR
        y = self.noise(n, freq * 0.7, min(freq * 1.4, SR / 2 - 100)) * np.exp(-t / 0.004)
        y += 0.3 * np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006)
        self.add("perc", start, y * amp, pan=pan)

    def clap(self, start, amp):
        n = s(0.35)
        t = np.arange(n) / SR
        x = self.noise(n, 900, 3200)
        e = np.zeros(n)
        for k, d in enumerate((0.0, 0.009, 0.019)):
            i = s(d)
            e[i:] += np.exp(-(t[: n - i]) / (0.006 if k < 2 else 0.11))
        self.add("perc", start, x * e * amp * 0.6)

    def snare(self, start, amp, pan=0.0):
        n = s(0.25)
        t = np.arange(n) / SR
        y = self.noise(n, 1400, 7000) * np.exp(-t / 0.09) + 0.6 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
        self.add("perc", start, y * amp, pan=pan)

    def crash(self, start, amp):
        n = s(2.2)
        t = np.arange(n) / SR
        e = np.minimum(1, t / 0.004) * np.exp(-t / 0.75)
        self.add("perc", start, stereo=np.stack([self.noise(n, lo=4200), self.noise(n, lo=4200)], axis=1) * e[:, None] * amp)

    def riser(self, start, dur, amp, f0=300, f1=9000, tone=True):
        n = s(dur)
        if n <= 0:
            return
        t = np.arange(n) / SR
        x = self.rng.standard_normal(n)
        y = np.zeros(n)
        zi = None
        for i in range(0, n, 1024):
            fc = f0 * (f1 / f0) ** (i / n)
            sos = signal.butter(2, [fc * 0.7, min(fc * 1.4, SR / 2 - 100)], "bandpass", fs=SR, output="sos")
            if zi is None:
                zi = signal.sosfilt_zi(sos) * 0
            y[i:i + 1024], zi = signal.sosfilt(sos, x[i:i + 1024], zi=zi)
        e = (t / dur) ** 2.2
        out = y * e * amp
        if tone:
            out += 0.25 * amp * np.sin(2 * np.pi * np.cumsum(220 * 8.0 ** (t / dur)) / SR) * e
        self.add("fx", start, stereo=np.stack([out, np.roll(out, 90)], axis=1))

    def boom(self, start, amp, f0=95, f1=30, dur=2.4):
        n = s(dur)
        t = np.arange(n) / SR
        f = f1 + (f0 - f1) * np.exp(-t / 0.35)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
        y += self.noise(n, hi=900) * np.exp(-t / 0.18) * 0.5
        self.add("fx", start, y * amp)

    def blip(self, start, m, amp, pan, dur=0.04):
        n = s(dur * 4)
        t = np.arange(n) / SR
        f = mtof(self.tr(m))
        self.add("blip", start, np.sin(2 * np.pi * f * t + 0.8 * np.sin(2 * np.pi * f * 2.01 * t)) * np.exp(-t / dur) * amp, pan=pan)

    # ------------------------------------------------------------ arrangement
    def chord(self, t):
        return self.h["loop"][int(round(t / self.bar)) % 4], int(round(t / self.bar)) % 4

    def section_bars(self, a, b):
        t = a
        while t < b - 1e-6:
            yield t, min(self.bar, b - t)
            t += self.bar

    def play_bar(self, t0, d, energy, role, prog):
        st = self.st
        (pad, root, arp), ci = self.chord(t0)
        lo, hi = st["pad_cut"]
        # quantised, so the wavetable cache stays small (a new cutoff means a new table)
        cut = lo if role == "break" else round((lo + (hi - lo) * min(1.0, energy / 3 + 0.15 * prog)) / 100) * 100
        self.pad(pad, t0, d, st["pad"] * (0.8 if energy == 0 else 1.0), cut, attack=0.08 if energy >= 2 else 0.35, release=0.5)
        peak = energy >= 3
        if peak:  # an octave layer on top: the peak should sound bigger, not only busier
            self.pad([p + 12 for p in pad[1:]], t0, d, 0.08, 4000, attack=0.1, release=0.5)
        drums = energy >= 2 and role != "break" and not (self.style_name == "minimal" and energy < 3)
        beats = int(round(d / self.beat))
        for b in range(beats):
            tb = t0 + b * self.beat
            if energy >= 1:
                self.sub(root, tb, self.beat * 0.84, (0.29 if peak else 0.27) if drums else 0.2)
            if drums:
                if st["kick"] and (self.style_name != "minimal" or b % 2 == 0):
                    self.kick(tb, st["kick"] * (1.06 if peak else 1.0))
                if st["toms"] and b in (0, 2):
                    self.tom(tb, st["toms"] * (0.8 if b == 2 else 1.0))
                self.bass(root + 12, tb + self.beat / 2, self.beat * 0.4, 0.26 if peak else 0.22,
                          cutoff=1100 if peak else 700)
                if st["clap"] and b in (1, 3):
                    self.clap(tb, st["clap"] * (1.1 if peak else 0.6))
                if st["hats"] == "16" and peak:
                    for q in range(4):
                        self.hat(tb + q * self.beat / 4, 0.12 if q == 2 else 0.06, pan=0.3 if q % 2 else -0.3)
                    self.hat(tb + self.beat / 2, 0.06, open_=True, pan=0.1)
                elif st["hats"] in ("16", "8"):
                    self.hat(tb + self.beat / 2, 0.1, pan=0.25)
        if energy >= 1 or role == "break":
            div = st["arp_div"]
            step_len = self.beat / div
            lo_b, hi_b = st["arp_bright"]
            bright = lo_b + (hi_b - lo_b) * min(1.0, energy / 3)
            amp = st["arp"] * (0.55 if energy == 1 or role == "break" else 1.0)
            for step in range(int(round(d / step_len))):
                m = arp[ARP_PATTERN[step % 16]]
                self.pluck(m, t0 + step * step_len, amp, bright, 900, 0.15, pan=-0.35 if step % 2 else 0.35)
                if energy >= 3 and step % 2 == 0 and self.style_name == "pulse":
                    self.pluck(m + 12, t0 + step * step_len + step_len / 2, 0.07, bright, 1200, 0.1, pan=0.6 if step % 4 else -0.6)
        if energy >= 3 and st["bells"]:
            self.bell(self.h["bells"][ci], t0, st["bells"], pan=-0.15)
        if energy >= 3 and st["lead"]:
            tones = [a if a >= 69 else a + 12 for a in arp[1:]]
            for k, (m, length) in enumerate(zip(tones, (1, 1, 2))):
                start = t0 + sum((1, 1, 2)[:k]) * self.beat
                if start < t0 + d:
                    self.lead(m, start, min(length * self.beat, t0 + d - start) * 0.95, st["lead"])
        if role == "break" and self.style_name == "pulse":
            for b in range(beats):
                self.blip(t0 + b * self.beat, 93, 0.05, 0.5 if b % 2 else -0.5, dur=0.02)
        dens = st["blips"][min(3, energy)]
        for q in range(int(round(d / (self.beat / 4)))):
            if dens and self.rng.random() < dens:
                self.blip(t0 + q * self.beat / 4, int(self.rng.choice(st["blip_notes"])), 0.05,
                          float(self.rng.uniform(-0.9, 0.9)), dur=0.035)

    def play_hook(self, a, b):
        d = b - a
        pad, root, _ = self.h["loop"][0]
        for m, amp in ((root, 0.2), (root + 12, 0.12), (root + 19, 0.07)):
            e = self.env(s(d + 0.3), min(1.2, d / 3), 0.5, 1.0, 0.4)
            self.add("pad", a, self.saw(mtof(self.tr(m)), len(e), 320) * e * amp)
        # a quiet chord in the middle of the spectrum, so the hook still reads on laptop and phone speakers
        self.pad(pad, a, d, 0.12, 900, attack=min(1.5, d / 2), release=0.4)
        if self.st["hats"] != "none":
            ticks = int(round(d / (self.beat / 4)))
            for i in range(ticks):  # a clock that speeds up the tension
                self.hat(a + i * self.beat / 4, 0.02 + 0.06 * (i / ticks), pan=0.3 if i % 2 else -0.3)
        else:  # styles without hats still need something above the bass in the hook: a quiet clock
            ticks = int(round(d / self.beat))
            for i in range(ticks):
                self.tick(a + i * self.beat, 0.05 + 0.1 * (i / max(1, ticks)), 2600 if i % 2 else 3200,
                          pan=0.3 if i % 2 else -0.3)
        beats = int(round(d / (self.beat / 2)))
        for k in range(beats):  # a heartbeat that grows; it must not pump the drone
            self.kick(a + k * self.beat / 2, (0.18 if k % 2 == 0 else 0.1) + 0.3 * k / max(1, beats), duck=False)
        if self.st["blip_notes"]:
            slots = int(round(d / (self.beat / 8)))
            for i in range(slots):
                if self.rng.random() < 0.35 + 0.6 * (i / slots):
                    self.blip(a + i * self.beat / 8 + float(self.rng.uniform(0, 0.02)),
                              int(self.rng.choice(self.st["blip_notes"])), 0.05 + 0.08 * (i / slots),
                              float(self.rng.uniform(-0.8, 0.8)))
        self.riser(a + d / 2, d / 2, 0.2)

    def play_build(self, a, b):
        d = b - a
        pad, root, arp = self.h["dominant"]
        self.pad(pad, a, d - 0.25, 0.3, 1600, attack=0.1, release=0.05)
        self.sub(root, a, d - 0.25, 0.26)
        self.riser(a, d - 0.2, 0.3)
        rolls = 16
        for i in range(rolls):
            self.snare(a + i * (d - 0.25) / rolls, 0.05 + 0.13 * (i / rolls) ** 1.5, pan=-0.15 if i % 2 else 0.15)
        steps = max(1, int(round((d - 0.25) / (self.beat / 4))))
        for step in range(steps):
            u = step / steps
            self.pluck(arp[step % 4] + 12, a + step * self.beat / 4, 0.1 + 0.12 * u,
                       round((2000 + 4000 * u) / 250) * 250, 800, 0.12, pan=-0.3 if step % 2 else 0.3)

    def play_resolve(self, a, b):
        d = b - a
        pad, root, arp = self.h["final"]
        if self.style_name == "minimal":  # under a voiceover the ending must not compete with the last line
            self.pad(pad, a, d, 0.16, 1800, attack=0.4, release=0.8)
            self.sub(root, a, d, 0.14)
            self.bell(arp[1], a, 0.06, pan=-0.2, tau=1.6)
            return
        self.boom(a, self.st["boom"] * 0.9, f0=85, f1=33, dur=min(3.2, d + 0.5))
        self.crash(a, 0.12)
        self.pad(pad, a, d, 0.32, 2600, attack=0.03, release=0.8)
        self.sub(root, a, d, 0.3)
        if self.st["bells"]:
            self.bell(arp[1], a, 0.2, pan=-0.2, tau=1.6)
            self.bell(arp[3], a + 0.02, 0.12, pan=0.25, tau=1.8)

    def compose(self):
        secs = sorted(self.plan["sections"], key=lambda x: x["start"])
        prev_e, prev_role = None, None
        for sec in secs:
            a, b = float(sec["start"]), float(sec["end"])
            energy = int(max(0, min(3, sec.get("energy", 1))))
            role = sec.get("role", "")
            if role == "hook":
                self.play_hook(a, b)
            elif role == "build":
                self.play_build(a, b)
            elif role == "resolve":
                self.play_resolve(a, b)
            else:
                bars = list(self.section_bars(a, b))
                for j, (t0, d) in enumerate(bars):
                    self.play_bar(t0, d, energy, role, j / max(1, len(bars)))
            # the drop: a crash where the energy rises, and a boom right after a build
            rising = prev_e is not None and energy > prev_e
            after_build = prev_role == "build"
            if role not in ("hook", "build", "resolve") and energy >= 2 and (rising or after_build):
                self.crash(a, 0.16)
                if after_build:
                    self.boom(a, self.st["boom"] * 0.8)
                elif prev_e >= 2:
                    for i in range(4):
                        self.snare(a - self.beat + i * self.beat / 4, 0.1 + 0.05 * i)
            prev_e, prev_role = energy, role
        for hit in self.plan.get("hits", []):
            t, kind = float(hit["t"]), hit.get("kind", "boom")
            if kind == "boom":
                self.boom(t, self.st["boom"])
            elif kind == "crash":
                self.crash(t, 0.18)
            elif kind == "impact":
                self.boom(t, self.st["boom"] * 0.8, f0=110, f1=40, dur=1.2)
                self.crash(t, 0.14)
            elif kind == "riser":
                self.riser(max(0.0, t - 1.5), min(1.5, t), 0.22)

    # ------------------------------------------------------------ mix
    def mix(self):
        sc = np.ones(self.n)
        for tk in self.kicks:
            i = s(tk)
            m = min(self.n - i, s(0.35))
            if m > 0:
                sc[i:i + m] = np.minimum(sc[i:i + m], 1 - 0.55 * np.exp(-np.arange(m) / SR / 0.11))
        for k, depth in (("pad", 1.0), ("bass", 1.0), ("sub", 0.9), ("arp", 0.45), ("bell", 0.3)):
            self.bus[k] *= (1 - depth * (1 - sc))[:, None]
        send = {"pad": 0.30, "bass": 0.02, "sub": 0.0, "arp": 0.35, "bell": 0.55, "lead": 0.35, "kick": 0.03,
                "perc": 0.12, "fx": 0.45, "blip": 0.5}
        level = {"pad": 1.0, "bass": 0.9, "sub": 1.0, "arp": 0.9, "bell": 0.9, "lead": 0.9, "kick": 0.85,
                 "perc": 0.8, "fx": 0.9, "blip": 0.8}
        dry = np.zeros((self.n, 2))
        wet_in = np.zeros((self.n, 2))
        for k, b in self.bus.items():
            dry += b * level[k]
            wet_in += b * level[k] * send[k]
        dry += self.pingpong(self.bus["arp"] * 0.55 + self.bus["lead"] * 0.35, 0.75 * self.beat, 0.42)
        ir = self.make_ir()
        wet = np.stack([signal.fftconvolve(wet_in[:, c], ir[:, c])[: self.n] for c in range(2)], axis=1)
        mix = dry + wet * 0.9 * self.st["verb"]
        mix = signal.sosfilt(signal.butter(2, 26, "high", fs=SR, output="sos"), mix, axis=0)
        if self.st["pocket"]:
            mix = peaking(mix, 2500, self.st["pocket"], 0.8)
        if self.st["shelf"]:
            mix = high_shelf(mix, 5000, self.st["shelf"])
        for dk in self.plan.get("duck", []):
            g = np.ones(self.n)
            a, b = s(float(dk["start"])), s(float(dk["end"]))
            ramp = s(0.08)
            lvl = 10 ** (float(dk.get("db", -8)) / 20)
            g[a:b] = lvl
            g[max(0, a - ramp):a] = np.linspace(1, lvl, a - max(0, a - ramp))
            g[b:min(self.n, b + ramp)] = np.linspace(lvl, 1, min(self.n, b + ramp) - b)
            mix *= g[:, None]
        mix = mix / (np.abs(mix).max() + 1e-12) * 0.92
        mix = np.tanh(1.25 * mix) / np.tanh(1.25)
        fo = s(min(2.2, self.dur / 6))
        mix[-fo:] *= (np.linspace(1, 0, fo) ** 2)[:, None]
        fi = s(0.02)
        mix[:fi] *= np.linspace(0, 1, fi)[:, None]
        return mix / (np.abs(mix).max() + 1e-12) * 0.95

    def pingpong(self, x, delay, fb, taps=6):
        out = np.zeros_like(x)
        d = s(delay)
        cur = x.copy()
        lp = signal.butter(2, 3500, "low", fs=SR, output="sos")
        for k in range(1, taps + 1):
            cur = signal.sosfilt(lp, cur, axis=0)
            if k * d >= self.n:
                break
            sh = np.zeros_like(cur)
            sh[k * d:] = cur[: self.n - k * d]
            if k % 2:
                out[:, 1] += sh[:, 0] * fb ** k
            else:
                out[:, 0] += sh[:, 1] * fb ** k
        return out

    def make_ir(self, seconds=2.6, tau=0.42):
        r = np.random.default_rng(7)
        n = s(seconds)
        t = np.arange(n) / SR
        ir = r.standard_normal((n, 2)) * np.exp(-t / tau)[:, None]
        ir = signal.sosfilt(signal.butter(2, 5200, "low", fs=SR, output="sos"), ir, axis=0)
        ir = np.concatenate([np.zeros((s(0.022), 2)), ir])
        return ir / np.sqrt((ir ** 2).sum(axis=0, keepdims=True))


def high_shelf(x, f0, gain_db, q=0.707):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2 * q)
    c = np.cos(w0)
    b = [A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * alpha), -2 * A * ((A - 1) + (A + 1) * c),
         A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * alpha)]
    a = [(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * alpha, 2 * ((A - 1) - (A + 1) * c),
         (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * alpha]
    return signal.lfilter(b, a, x, axis=0)


def peaking(x, f0, gain_db, q):
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2 * q)
    c = np.cos(w0)
    b = [1 + alpha * A, -2 * c, 1 - alpha * A]
    a = [1 + alpha / A, -2 * c, 1 - alpha / A]
    return signal.lfilter(b, a, x, axis=0)


def loudness(stereo):
    """Integrated loudness and true peak via FFmpeg's EBU R128 meter."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        path = f.name
    try:
        wavfile.write(path, SR, stereo.astype(np.float32))
        out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af",
                              "loudnorm=print_format=json", "-f", "null", "-"],
                             capture_output=True, text=True).stderr
        j = json.loads(out[out.rindex("{"): out.rindex("}") + 1])
        return float(j["input_i"]), float(j["input_tp"]), float(j["input_lra"])
    finally:
        os.unlink(path)


def soft_limit(y, ceiling=0.85, knee=0.6):
    """Linear below the knee, then bends smoothly toward the ceiling."""
    a = np.abs(y)
    over = a > knee
    out = y.copy()
    out[over] = np.sign(y[over]) * (knee + (ceiling - knee) * np.tanh((a[over] - knee) / (ceiling - knee)))
    return out


def master(mix, target):
    """Hit the loudness target, keep the true peak under -1 dBTP."""
    i, _, _ = loudness(mix)
    y = soft_limit(mix * 10 ** ((target - i) / 20))
    _, tp, _ = loudness(y)
    if tp > -1.2:
        y = y * 10 ** ((-1.2 - tp) / 20)
    return y


# EBU R128 / ITU-R BS.1770 K-weighting at 48 kHz: loudness as ears hear it,
# so a bright peak section is not judged "quiet" just because bass dominates RMS.
K1 = ([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585])
K2 = ([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621])


def lufs(seg):
    z = signal.lfilter(*K2, signal.lfilter(*K1, seg, axis=0), axis=0)
    return -0.691 + 10 * np.log10((z ** 2).mean(axis=0).sum() + 1e-12)


def band_report(seg):
    mono = seg.mean(axis=1)
    spec = np.abs(np.fft.rfft(mono)) ** 2
    fr = np.fft.rfftfreq(len(mono), 1 / SR)
    tot = spec.sum() + 1e-20
    return {nm: 10 * np.log10(spec[(fr >= lo) & (fr < hi)].sum() / tot + 1e-12)
            for lo, hi, nm in ((20, 150, "low"), (150, 2000, "mid"), (2000, 8000, "high"), (8000, 20000, "air"))}


def cues(score):
    secs = sorted(score.plan["sections"], key=lambda x: x["start"])

    def energy_at(t):
        for sec in secs:
            if sec["start"] <= t < sec["end"]:
                return int(sec.get("energy", 1))
        return 0

    beats = []
    t, k = 0.0, 0
    while t < score.dur - 1e-6:
        inten = 0.25 + 0.2 * energy_at(t) + (0.15 if k % 4 == 0 else 0.0)
        beats.append({"time": round(t, 4), "intensity": round(min(1.0, inten), 3)})
        k += 1
        t = k * score.beat
    # strong cues: the start, every rise in energy (a build's cue is its drop, not its start),
    # the section right after a build, the resolve, and every planned hit
    strong = []
    prev_e, prev_role = None, None
    for sec in secs:
        e, role = int(sec.get("energy", 1)), sec.get("role", "")
        rising = prev_e is None or e > prev_e
        if (rising and role != "build") or prev_role == "build" or role == "resolve":
            kind = "drop" if prev_role == "build" else ("resolve" if role == "resolve" else "section")
            strong.append({"time": float(sec["start"]), "intensity": round(min(1.0, 0.5 + 0.17 * e), 3), "kind": kind})
        prev_e, prev_role = e, role
    for hit in score.plan.get("hits", []):
        strong.append({"time": float(hit["t"]), "intensity": 1.0, "kind": hit.get("kind", "boom")})
    strong = sorted({c["time"]: c for c in strong}.values(), key=lambda c: c["time"])
    return {"duration": score.dur, "tempo": score.bpm, "beats": beats, "strongCues": strong,
            "sections": secs, "source": "compose_score.py", "style": score.style_name}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("plan")
    ap.add_argument("--out", required=True)
    ap.add_argument("--cues")
    ap.add_argument("--spectrogram")
    args = ap.parse_args()
    for path in (args.out, args.cues, args.spectrogram):
        if path:
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    plan = json.load(open(args.plan))
    secs = sorted(plan["sections"], key=lambda x: x["start"])
    if not secs or abs(secs[0]["start"]) > 1e-6 or abs(secs[-1]["end"] - float(plan["duration"])) > 1e-3:
        sys.exit("sections must start at 0 and end at duration")
    for a, b in zip(secs, secs[1:]):
        if abs(a["end"] - b["start"]) > 1e-3:
            sys.exit(f"sections must be contiguous: {a['end']} != {b['start']}")
    score = Score(plan)
    score.compose()
    mix = master(score.mix(), float(plan.get("target_lufs", -14.0)))
    wavfile.write(args.out, SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
    if args.cues:
        json.dump(cues(score), open(args.cues, "w"), indent=1)
    integrated, tp, lra = loudness(mix)
    print(f"{args.out}: {score.dur:.2f}s  {score.bpm:g} BPM  style={score.style_name}  "
          f"integrated {integrated:.1f} LUFS  true peak {tp:.1f} dBTP  LRA {lra:.1f} LU")
    print(f"{'section':<22}{'energy':>7}{'LUFS':>7}{'peak':>7}   low / mid / high / air (dB share)")
    levels = []
    for sec in secs:
        seg = mix[s(sec["start"]):s(sec["end"])]
        loud = lufs(seg)
        levels.append((sec, loud))
        br = band_report(seg)
        label = f"{sec['start']:g}-{sec['end']:g}s {sec.get('role', '')}".strip()
        print(f"{label:<22}{int(sec.get('energy', 1)):>7}{loud:>7.1f}{20 * np.log10(np.abs(seg).max() + 1e-9):>7.1f}   "
              f"{br['low']:.1f} / {br['mid']:.1f} / {br['high']:.1f} / {br['air']:.1f}")
        if br["low"] > -1.0:
            print("   note: almost all bass; this part may sound thin on laptop and phone speakers")
    # A rise in energy should be heard: at least 0.5 LU louder than the section before it. A drop
    # (the section after a build) is compared with the section before the build instead: the
    # build's riser, snare roll and held chord are loud at any energy level, so next to the build
    # itself almost every drop would read as "not louder".
    for i, (b, lb) in enumerate(levels):
        if i == 0 or b.get("role") in ("build", "resolve"):
            continue
        j = i - 1
        if levels[j][0].get("role") == "build":
            j -= 1
            if j < 0:
                continue
        a, la = levels[j]
        if int(b.get("energy", 1)) > int(a.get("energy", 1)) and lb < la + 0.5:
            than = "the section before the build" if j < i - 1 else "the one before"
            print(f"   note: the section at {b['start']:g}s has more energy but is not louder than {than} "
                  f"({lb:.1f} vs {la:.1f} LUFS at {a['start']:g}s)")
    if args.spectrogram:
        from PIL import Image
        f, t, Z = signal.stft(mix.mean(axis=1)[::4], fs=SR / 4, nperseg=1024, noverlap=512)
        sg = 20 * np.log10(np.abs(Z) + 1e-7)
        sg = np.clip((sg - (sg.max() - 80)) / 80, 0, 1)
        img = (np.flipud(sg) * 255).astype(np.uint8)
        rgb = np.stack([np.clip(img * 2.0, 0, 255), np.clip((img.astype(int) - 128) * 2, 0, 255),
                        np.clip(120 - img * 0.5, 0, 255)], -1).astype(np.uint8)
        Image.fromarray(rgb).resize((1600, 320)).save(args.spectrogram)


if __name__ == "__main__":
    main()
