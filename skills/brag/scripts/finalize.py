#!/usr/bin/env python3
"""Bake the poster into the video (and optionally normalise loudness), then prove
nothing else changed.

Runs inside the brag-tools image, from the output directory.

  python3 finalize.py --video brag.mp4 --poster-at 8.3 [--poster brag.jpg] [--loudnorm -14]

1. Pulls the poster frame at --poster-at into brag.jpg (or .png), colour-correct:
   the video's colour matrix (BT.709 for Hyperframes renders) is named explicitly
   in every conversion, so a saturated brand colour doesn't shift.
2. Replaces only frame 0 of the video with it, so every platform's idle
   thumbnail is the poster; the rest is re-encoded at CRF 16 with the same
   colour tags.
3. With --loudnorm L, also normalises the audio to L LUFS with the true peak at or
   below -1 dBTP, measured after AAC encoding (it retries with a lower peak target if
   the encoder overshoots). When one plain gain fits under the peak target it uses
   two-pass EBU R128 loudnorm, linear (dynamics untouched). When it doesn't, it applies
   the same plain gain and a fast, oversampled peak limiter that shaves only the brief
   overs, so short hits (the launch typing, clicks, impacts) keep their punch; it
   reports which. Without --loudnorm the audio stream is copied untouched.
4. Verifies the result before replacing the original: same frame count and
   duration, audio present (byte-identical when copied), frame 0 matches the
   poster, a middle frame matches the original. If a check fails, the original
   is kept and the candidate is left next to it.
"""
import argparse
import io
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def probe(path):
    out = run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
               "stream=nb_read_frames,r_frame_rate,width,height,color_space,color_range,color_transfer,color_primaries"
               ":format=duration", "-of", "json", path]).stdout
    j = json.loads(out)
    st = j["streams"][0]
    num, den = st["r_frame_rate"].split("/")
    audio = run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name",
                 "-of", "csv=p=0", path]).stdout.strip()
    cs = st.get("color_space", "")
    if cs == "bt709":
        matrix = "bt709"
    elif cs in ("smpte170m", "bt470bg", "bt601"):
        matrix = "bt601"
    else:  # untagged: the usual convention by size
        matrix = "bt709" if st["height"] >= 720 else "bt601"
    rng = "pc" if st.get("color_range") == "pc" else "tv"
    tags = []
    for flag, key in (("-colorspace", "color_space"), ("-color_primaries", "color_primaries"),
                      ("-color_trc", "color_transfer"), ("-color_range", "color_range")):
        v = st.get(key)
        if v and v != "unknown":
            tags += [flag, v]
    return {"frames": int(st["nb_read_frames"]), "fps": float(num) / float(den), "w": st["width"], "h": st["height"],
            "duration": float(j["format"]["duration"]), "audio": audio, "matrix": matrix, "range": rng, "tags": tags}


def to_rgb_filter(meta):
    return f"scale=in_color_matrix={meta['matrix']}:in_range={meta['range']},format=rgb24"


def frame(path, n, meta):
    png = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"select=eq(n\\,{n}),{to_rgb_filter(meta)}",
                          "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    return np.asarray(Image.open(io.BytesIO(png)).convert("RGB"), dtype=np.float64)


def frame_at(path, t, meta):
    png = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", path, "-vf", to_rgb_filter(meta),
                          "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(png)).convert("RGB")


def psnr(a, b):
    mse = ((a - b) ** 2).mean()
    return 99.0 if mse == 0 else 10 * np.log10(255.0 ** 2 / mse)


def loudnorm_json(path, af):
    out = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", af, "-f", "null", "-"]).stderr
    return json.loads(out[out.rindex("{"): out.rindex("}") + 1])


def audio_md5(path):
    return subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-map", "0:a", "-c", "copy", "-f", "md5", "-"],
                          capture_output=True, text=True).stdout.strip()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video", default="brag.mp4")
    ap.add_argument("--poster-at", type=float, required=True)
    ap.add_argument("--poster", default="brag.jpg")
    ap.add_argument("--loudnorm", type=float, help="target integrated loudness in LUFS, e.g. -14")
    a = ap.parse_args()

    before = probe(a.video)
    if a.poster_at >= before["duration"]:
        sys.exit(f"--poster-at {a.poster_at} is past the end ({before['duration']:.2f}s)")
    os.makedirs(os.path.dirname(os.path.abspath(a.poster)), exist_ok=True)
    poster_img = frame_at(a.video, a.poster_at, before)
    if a.poster.lower().endswith(".png"):
        poster_img.save(a.poster)
    else:
        poster_img.save(a.poster, quality=95, subsampling=0)

    cand = os.path.splitext(a.video)[0] + ".finalize.mp4"
    normalise = a.loudnorm is not None and bool(before["audio"])
    # the poster (RGB) goes into the video's own YUV matrix, so frame 0 keeps the brand colours
    fc = (f"[1:v]format=rgb24,scale=out_color_matrix={before['matrix']}:out_range={before['range']},format=yuv420p[p];"
          f"[0:v][p]overlay=0:0:format=yuv420:enable='eq(n,0)'[v]")
    norm_type = None

    def bake(tp_target):
        nonlocal norm_type
        cmd = ["ffmpeg", "-y", "-hide_banner", "-nostats", "-i", a.video, "-i", a.poster, "-filter_complex", fc,
               "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-crf", "16", "-preset", "slow",
               "-pix_fmt", "yuv420p"] + before["tags"]
        use_loudnorm = False
        if normalise:
            m = loudnorm_json(a.video, f"loudnorm=I={a.loudnorm}:TP={tp_target}:LRA=11:print_format=json")
            gain = a.loudnorm - float(m["input_i"])
            if float(m["input_tp"]) + gain <= tp_target:
                # the gain fits under the peak target: plain linear loudnorm
                use_loudnorm = True
                af = (f"loudnorm=I={a.loudnorm}:TP={tp_target}:LRA=11:measured_I={m['input_i']}:"
                      f"measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:"
                      f"offset={m['target_offset']}:linear=true:print_format=json")
            else:
                # a plain gain would push peaks past the target. loudnorm would then switch to its
                # dynamic mode, which compresses the whole mix and flattens short hits (the launch
                # typing lost two thirds of its rise that way). Instead: the same plain gain, then a
                # fast limiter, 4x oversampled for true peaks, that only shaves the brief overs.
                limit = 10 ** ((tp_target - 0.5) / 20)
                af = (f"volume={gain:.2f}dB,aresample=192000,"
                      f"alimiter=limit={limit:.4f}:attack=1:release=60:level=0,aresample=48000")
                norm_type = "linear gain + peak limiter"
            cmd += ["-af", af, "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
        else:
            cmd += ["-c:a", "copy"]
        r = run(cmd + ["-movflags", "+faststart", cand])
        if r.returncode:
            sys.exit(r.stderr[-2000:])
        if use_loudnorm and "{" in r.stderr:
            try:
                norm_type = json.loads(r.stderr[r.stderr.rindex("{"): r.stderr.rindex("}") + 1]).get("normalization_type")
            except ValueError:
                norm_type = None

    # Try -1 dBTP first: loudnorm stays linear (dynamics untouched) only when the gain fits under
    # the peak target. AAC encoding can overshoot, so if the encoded file peaks above -1 dBTP,
    # aim lower (which may switch loudnorm to its gently compressing dynamic mode).
    tp_after = None
    for tp_target in ((-1.0, -2.0, -3.0) if normalise else (None,)):
        bake(tp_target)
        if not normalise:
            break
        tp_after = float(loudnorm_json(cand, "loudnorm=print_format=json")["input_tp"])
        if tp_after <= -1.0:
            break

    after = probe(cand)
    checks = []
    if normalise:
        got = float(loudnorm_json(cand, "loudnorm=print_format=json")["input_i"])
        checks.append(("loudness on target", abs(got - a.loudnorm) <= 1.0, f"{got:.1f} LUFS (target {a.loudnorm:g})"))
        checks.append(("true peak at or below -1 dBTP", tp_after <= -1.0, f"{tp_after:.1f} dBTP"))
    checks.append(("same frame count", after["frames"] == before["frames"], f"{before['frames']} -> {after['frames']}"))
    tol = 0.12 if normalise else 1.5 / before["fps"]
    checks.append(("same duration", abs(after["duration"] - before["duration"]) <= tol,
                   f"{before['duration']:.3f}s -> {after['duration']:.3f}s"))
    if before["audio"]:
        checks.append(("audio present", bool(after["audio"]), after["audio"] or "missing"))
        if not normalise:
            checks.append(("audio byte-identical", audio_md5(a.video) == audio_md5(cand), "stream copy"))
    poster = np.asarray(Image.open(a.poster).convert("RGB"), dtype=np.float64)
    p0 = psnr(frame(cand, 0, after), poster)
    checks.append(("frame 0 is the poster", p0 >= 30, f"PSNR {p0:.1f} dB"))
    mid = before["frames"] // 2
    pm = psnr(frame(cand, mid, after), frame(a.video, mid, before))
    checks.append((f"frame {mid} unchanged", pm >= 35, f"PSNR {pm:.1f} dB"))

    ok = all(c[1] for c in checks)
    for name, passed, detail in checks:
        print(f"{'ok  ' if passed else 'FAIL'} {name}: {detail}")
    if norm_type:
        notes = {
            "dynamic": " (dynamics slightly compressed; raise the composition's volumes so the render starts nearer the target)",
            "linear gain + peak limiter": " (dynamics kept; only the brief peaks above the target were shaved)",
        }
        print(f"loudness normalisation: {norm_type}" + notes.get(norm_type, " (dynamics untouched)"))
    if not ok:
        print(f"kept the original {a.video}; the candidate is {cand}")
        sys.exit(1)
    size_before = os.path.getsize(a.video)
    os.replace(cand, a.video)
    print(f"{a.video}: poster at {a.poster_at}s baked as frame 0 ({before['matrix']}, {before['range']} range); "
          f"{size_before / 1e6:.1f} MB -> {os.path.getsize(a.video) / 1e6:.1f} MB; poster {a.poster}")


if __name__ == "__main__":
    main()
