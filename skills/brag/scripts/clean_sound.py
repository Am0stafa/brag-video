#!/usr/bin/env python3
"""Turn a real-world recording into a clean sound effect.

Runs inside the brag-tools image. For sounds that cannot be synthesised — an
animal call, a door, a crowd — take a public-domain or CC0 recording (see
references/audio.md for sources and credits) and cut, clean and place it:

  cut          --start/--dur seconds from the source (any format FFmpeg reads)
  band-limit   --band LO HI  (Hz; removes rumble and hiss)
  denoise      --gate N      (spectral gate; 0 turns it off; 1.5-1.8 for field recordings)
  pitch        --semitones S (negative = lower and bigger; resampling, no artefacts)
  space        --space none | room | mountain   (dry, a short reverb, or stereo echoes)
  loudness     --peak-db -1

  python3 clean_sound.py --in call.mp3 --start 9.15 --dur 1.10 --out cry.wav \
      --gate 1.5 --semitones -2 --space mountain [--spectrogram cry.png]

Writes a 48 kHz stereo 16-bit WAV. The same inputs give the same file.
"""
import argparse
import os
import subprocess

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR_IN = 44100
SR = 48000


def load(path, start, dur):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", path,
         "-ac", "1", "-ar", str(SR_IN), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def band(x, lo, hi, sr):
    sos = signal.butter(4, [lo, hi], btype="bandpass", fs=sr, output="sos")
    return signal.sosfiltfilt(sos, x)


def spectral_gate(x, sr, strength=1.6, floor=0.06):
    f, t, Z = signal.stft(x, fs=sr, nperseg=1024, noverlap=768)
    mag = np.abs(Z)
    frame_energy = mag.sum(axis=0)
    quiet = frame_energy <= np.percentile(frame_energy, 25)
    noise = np.median(mag[:, quiet], axis=1, keepdims=True) if quiet.any() else np.percentile(mag, 20, axis=1, keepdims=True)
    gain = np.clip(1.0 - (strength * noise / (mag + 1e-12)) ** 2, 0, 1) ** 0.5
    gain = np.maximum(gain, floor)
    gain = signal.convolve2d(gain, np.ones((3, 3)) / 9.0, mode="same", boundary="symm")
    _, y = signal.istft(Z * gain, fs=sr, nperseg=1024, noverlap=768)
    return y[: len(x)]


def pitch_shift(x, semitones):
    factor = 2 ** (semitones / 12.0)
    return signal.resample(x, int(len(x) / factor))


def fades(x, sr, fin=0.01, fout=0.12):
    a, b = int(fin * sr), int(fout * sr)
    env = np.ones_like(x)
    env[:a] = np.linspace(0, 1, a)
    env[-b:] = np.linspace(1, 0, b) ** 2
    return x * env


def comb(x, delay_s, g, sr, damp=0.25):
    d = int(delay_s * sr)
    a = np.zeros(d + 2)
    a[0] = 1.0
    a[d] = -g * (1 - damp)
    a[d + 1] = -g * damp
    return signal.lfilter([1.0], a, x)


def allpass(x, delay_s, g, sr):
    d = int(delay_s * sr)
    b = np.zeros(d + 1)
    b[0] = -g
    b[d] = 1.0
    a = np.zeros(d + 1)
    a[0] = 1.0
    a[d] = -g
    return signal.lfilter(b, a, x)


def reverb(x, sr, seed_shift=0.0):
    y = sum(comb(x, c + seed_shift, 0.78, sr) for c in (0.0297, 0.0371, 0.0411, 0.0437)) / 4
    for ap in (0.005, 0.0017):
        y = allpass(y, ap + seed_shift / 7, 0.7, sr)
    return y


def place(dry, sr, space, tail_s):
    if space == "none":
        pad = np.concatenate([dry, np.zeros(int(0.3 * sr))])
        return np.stack([pad, pad], axis=1)
    pad = np.concatenate([dry, np.zeros(int(tail_s * sr))])
    left, right = pad.copy(), pad.copy()
    if space == "mountain":
        lp = signal.butter(2, 3500, btype="low", fs=sr, output="sos")
        for delay, gain, ch in ((0.19, 0.42, "L"), (0.23, 0.40, "R"), (0.41, 0.26, "L"), (0.47, 0.24, "R")):
            d = int(delay * sr)
            e = np.zeros_like(pad)
            e[d:] = signal.sosfilt(lp, pad)[: len(pad) - d] * gain
            if ch == "L":
                left += e
            else:
                right += e
    left += 0.22 * reverb(pad, sr, 0.0)
    right += 0.22 * reverb(pad, sr, 0.0023)
    return np.stack([left, right], axis=1)


def finish(st, peak_db):
    st = st / np.abs(st).max() * (10 ** (peak_db / 20))
    n = int(0.25 * SR)
    st[-n:] *= np.linspace(1, 0, n)[:, None] ** 2
    return st


def spectrogram(x, path):
    from PIL import Image
    f, t, Z = signal.stft(x, fs=SR, nperseg=1024, noverlap=768)
    sg = 20 * np.log10(np.abs(Z[: int(12000 / (SR / 1024))]) + 1e-7)
    sg = np.clip((sg - (sg.max() - 80)) / 80, 0, 1)
    img = (np.flipud(sg) * 255).astype(np.uint8)
    rgb = np.stack([np.clip(img * 2.0, 0, 255), np.clip((img.astype(int) - 128) * 2, 0, 255),
                    np.clip(120 - img * 0.5, 0, 255)], -1).astype(np.uint8)
    Image.fromarray(rgb).resize((1200, 300)).save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--dur", type=float, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--band", type=float, nargs=2, default=(850.0, 11000.0), metavar=("LO", "HI"))
    ap.add_argument("--gate", type=float, default=1.6)
    ap.add_argument("--semitones", type=float, default=0.0)
    ap.add_argument("--space", choices=("none", "room", "mountain"), default="none")
    ap.add_argument("--tail", type=float, default=1.6)
    ap.add_argument("--fade-in", type=float, default=0.01)
    ap.add_argument("--fade-out", type=float, default=0.12)
    ap.add_argument("--peak-db", type=float, default=-1.0)
    ap.add_argument("--spectrogram")
    a = ap.parse_args()

    x = load(a.src, a.start, a.dur)
    if len(x) == 0:
        raise SystemExit("nothing decoded: check --in, --start and --dur")
    x = band(x, a.band[0], a.band[1], SR_IN)
    if a.gate > 0:
        x = spectral_gate(x, SR_IN, strength=a.gate)
    if a.semitones:
        x = pitch_shift(x, a.semitones)
    x = signal.resample_poly(x, SR, SR_IN)
    x = fades(x, SR, a.fade_in, a.fade_out)
    st = finish(place(x, SR, a.space, a.tail), a.peak_db)
    for path in (a.out, a.spectrogram):
        if path:
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    wavfile.write(a.out, SR, (st * 32767).astype(np.int16))
    if a.spectrogram:
        spectrogram(st.mean(axis=1), a.spectrogram)
    print(f"{a.out}: {len(st) / SR:.2f}s, peak {20 * np.log10(np.abs(st).max()):.1f} dBFS")


if __name__ == "__main__":
    main()
