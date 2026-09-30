#!/usr/bin/env python3
"""Shrink Hyperframes' per-frame audio data to what a subtle audio-reactive
background needs: [rms, bass] per frame.

Runs inside the brag-tools image, after the hyperframes-creative extraction
helper (exported with the other Hyperframes skills; see runtime-docker.md):

  python3 <hf-skills>/hyperframes-creative/scripts/extract-audio-data.py music.wav --fps 30 --bands 16 -o audio-data.json
  python3 compact_audio_data.py audio-data.json composition/assets/audio-data.js --fps 30 --duration 30

Writes `window.<VAR> = {fps, frames: [[rms, bass], ...]}` (bass = mean of the two
lowest bands). A 600 KB JSON becomes a ~30 KB script the page can load locally.
"""
import argparse
import json
import os


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--duration", type=float, required=True)
    ap.add_argument("--var", default="BRAG_AUDIO")
    a = ap.parse_args()
    d = json.load(open(a.src))
    frames = d["frames"][: int(a.duration * a.fps) + 2]
    out = [[round(x["rms"], 3), round((x["bands"][0] + x["bands"][1]) / 2, 3)] for x in frames]
    os.makedirs(os.path.dirname(os.path.abspath(a.dst)), exist_ok=True)
    open(a.dst, "w").write(f"window.{a.var}={{fps:{a.fps},frames:" + json.dumps(out, separators=(",", ":")) + "};\n")
    print(f"{a.dst}: {len(out)} frames")


if __name__ == "__main__":
    main()
