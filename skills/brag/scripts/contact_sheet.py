#!/usr/bin/env python3
"""Put many frames on one labelled image, for a cheap visual review.

Runs inside the brag-tools image. `hyperframes check` audits structure, not
looks: overlapping captions, a card that jumps in size, a tilted logo or a
wrong font all pass it. One contact sheet of small frames taken at every
storyboard event (and in the middle of each transition) catches those, and
costs far less context than many full-size frames.

  # from the rendered video, at chosen times (seconds)
  python3 contact_sheet.py --video brag.mp4 --at 1.2,3.5,8.3,8.55 --out review/sheet.png
  # from the rendered video, every N seconds
  python3 contact_sheet.py --video brag.mp4 --every 2 --out review/overview.png
  # from `hyperframes snapshot` output (before rendering)
  python3 contact_sheet.py --frames composition/snapshots --out review/snapshots.png

Options: --cols 4 (tiles per row), --width 480 (tile width in pixels).
Look at the sheet; if something is suspicious, look at that one frame full size.
"""
import argparse
import glob
import io
import os
import re
import subprocess

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def rgb_filter(video):
    """Name the video's colour matrix, so saturated brand colours don't shift (renders are BT.709)."""
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=color_space,color_range,height", "-of", "json", video],
                         capture_output=True, text=True, check=True).stdout
    import json
    st = json.loads(out)["streams"][0]
    cs = st.get("color_space", "")
    matrix = "bt709" if cs == "bt709" else ("bt601" if cs in ("smpte170m", "bt470bg") else
                                             ("bt709" if st.get("height", 0) >= 720 else "bt601"))
    rng = "pc" if st.get("color_range") == "pc" else "tv"
    return f"scale=in_color_matrix={matrix}:in_range={rng},format=rgb24"


def frame_at(video, t, vf):
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", video, "-vf", vf, "-frames:v", "1",
                          "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    if not png:
        raise SystemExit(f"no frame at {t:.3f}s (past the end?)")
    return Image.open(io.BytesIO(png)).convert("RGB")


def duration(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--video")
    src.add_argument("--frames", help="a folder of PNG/JPG frames, e.g. composition/snapshots")
    ap.add_argument("--at", help="comma-separated times in seconds (with --video)")
    ap.add_argument("--every", type=float, help="sample every N seconds (with --video)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--width", type=int, default=480)
    a = ap.parse_args()

    tiles = []
    if a.video:
        if a.at:
            times = [float(v) for v in a.at.split(",") if v.strip()]
        elif a.every:
            d = duration(a.video)
            times = [round(i * a.every, 3) for i in range(int(d / a.every) + 1) if i * a.every < d - 0.05]
        else:
            raise SystemExit("with --video, give --at or --every")
        vf = rgb_filter(a.video)
        for t in times:
            tiles.append((frame_at(a.video, t, vf), f"{t:.2f}s"))
    else:
        # skip Hyperframes' own contact-sheet.jpg that `snapshot` writes next to the frames
        files = sorted((p for p in glob.glob(os.path.join(a.frames, "*.png")) + glob.glob(os.path.join(a.frames, "*.jpg"))
                        if not os.path.basename(p).startswith("contact-sheet")),
                       key=lambda p: [float(n) if n.replace(".", "", 1).isdigit() else n
                                      for n in re.split(r"(\d+(?:\.\d+)?)", os.path.basename(p))])
        if not files:
            raise SystemExit(f"no frames in {a.frames}")
        for p in files:
            tiles.append((Image.open(p).convert("RGB"), os.path.splitext(os.path.basename(p))[0]))

    w = a.width
    h = round(w * tiles[0][0].height / tiles[0][0].width)
    cols = max(1, min(a.cols, len(tiles)))
    rows = (len(tiles) + cols - 1) // cols
    gap = 8
    sheet = Image.new("RGB", (cols * w + (cols + 1) * gap, rows * h + (rows + 1) * gap), (24, 24, 28))
    try:
        font = ImageFont.truetype(FONT, max(14, w // 26))
    except OSError:
        font = ImageFont.load_default()
    draw = ImageDraw.Draw(sheet)
    for i, (img, label) in enumerate(tiles):
        x = gap + (i % cols) * (w + gap)
        y = gap + (i // cols) * (h + gap)
        sheet.paste(img.resize((w, h), Image.LANCZOS), (x, y))
        box = draw.textbbox((x + 6, y + 4), label, font=font)
        draw.rectangle((box[0] - 4, box[1] - 2, box[2] + 4, box[3] + 2), fill=(0, 0, 0))
        draw.text((x + 6, y + 4), label, fill=(255, 220, 90), font=font)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    sheet.save(a.out)
    print(f"{a.out}: {len(tiles)} frames, {cols}x{rows} grid, {sheet.width}x{sheet.height}px")


if __name__ == "__main__":
    main()
