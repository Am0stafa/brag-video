#!/usr/bin/env python3
"""Prove that a logo cut into moving parts still is the logo when it rests.

Runs inside the brag-tools image. To animate a flat logo (wings that beat, a
mark that assembles), it gets cut into pieces, each saved as its own PNG with
its position in the original. This puts the pieces back together and compares
them with the original, pixel by pixel. A brand logo at rest must be exactly
the brand file: 0 uncovered pixels, 0 overlapping pixels, 0 difference.

  python3 verify_rig.py --original logo.png --pieces pieces.json --dir parts/

pieces.json:
  {"image": [W, H], "pieces": {"wing-1": {"x": 58, "y": 51, "w": 530, "h": 237}, ...}}
Each piece is <dir>/<name>.png, cropped to (w, h), placed at (x, y).
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--original", required=True)
    ap.add_argument("--pieces", required=True)
    ap.add_argument("--dir", required=True)
    ap.add_argument("--alpha", type=int, default=24, help="alpha above which a pixel counts as visible")
    a = ap.parse_args()

    meta = json.load(open(a.pieces))
    orig = np.array(Image.open(a.original).convert("RGBA")).astype(int)
    H, W = orig.shape[:2]
    acc = np.zeros((H, W, 4), int)
    cover = np.zeros((H, W), int)
    for name, p in meta["pieces"].items():
        im = np.array(Image.open(os.path.join(a.dir, f"{name}.png")).convert("RGBA")).astype(int)
        if im.shape[:2] != (p["h"], p["w"]):
            sys.exit(f"{name}.png is {im.shape[1]}x{im.shape[0]}, pieces.json says {p['w']}x{p['h']}")
        sl = (slice(p["y"], p["y"] + p["h"]), slice(p["x"], p["x"] + p["w"]))
        m = im[..., 3] > 0
        acc[sl][m] = im[m]
        cover[sl] += m
    visible = orig[..., 3] > a.alpha
    uncovered = int((visible & (cover == 0)).sum())
    overlap = int((cover > 1).sum())
    diff = int(np.abs(acc - orig)[cover > 0].max()) if (cover > 0).any() else 255
    print(f"visible pixels {int(visible.sum())}  uncovered {uncovered}  overlapping {overlap}  max RGBA difference {diff}")
    ok = uncovered == 0 and overlap == 0 and diff == 0
    print("rest pose is pixel-identical to the original" if ok else "NOT identical: fix the cut before animating")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
