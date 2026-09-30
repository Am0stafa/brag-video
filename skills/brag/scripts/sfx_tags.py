#!/usr/bin/env python3
"""Build a composition's sound-effect <audio> tags from a JSON list: real durations, and tracks
that never overlap.

Runs inside the brag-tools image (it measures each file with ffprobe). Writing these tags by
hand, or with a shell loop, goes wrong quietly: in one run a zsh loop over files and times shifted
every sound, because zsh counts array positions from 1. A list is easy to read and to change.

  python3 sfx_tags.py tools/sfx.json [--events tools/launch-events.json]
      [--into composition/index.html] [--root composition] [--first-track 12] [--last-track 19]

The list has one entry per sound; times are in seconds, paths relative to composition/:

  [
    {"src": "assets/sfx/ui/click2.ogg", "events": "click", "volume": 0.55},
    {"src": ["assets/sfx/keyboard/keypress-004.wav", "assets/sfx/keyboard/keypress-007.wav",
             "assets/sfx/keyboard/keypress-010.wav"], "events": "key", "volume": 0.35, "min_gap": 0.09},
    {"src": "assets/sfx/interface/bong_001.ogg", "t": [15.4, 22.95], "volume": 0.45, "id": "done"}
  ]

  src      one file, or several to take in turn (keyboard sounds vary across the set)
  t        one time or a list; or instead
  events   a kind from the event log given with --events: "click" and "tap" (launch-ui.js's
           cursor and tap), "key" (launch-ui.js keys, already every second character, at least
           90 ms apart), or an engine kind ("mark", "open", "warp"...)
  volume   0 to 1 (default 0.5)       offset   seconds added to each time (default 0)
  min_gap  drop a hit that comes sooner than this after the one before (keys: 0.09)
  id       the id prefix (default: the events kind, else the first file's name)

Each tag gets data-start, data-duration (the file's real length, cut at the video's end) and a
data-track-index: the lowest track from --first-track (default 12: music is on 10, the launch
typing on 11) that is free for the whole sound, also leaving alone the tracks that the
composition's other <audio> tags use at that time (voice lines on 20 and up). Hyperframes only
objects to two sounds that overlap on one track; a track can hold many sounds in a row.

With --into, the tags replace everything between the lines <!-- sfx:begin --> and
<!-- sfx:end --> in the composition (put those two lines inside the root, after the music and
typing tags, once); run it again after any change. Without it, the tags are printed.
"""
import argparse
import json
import os
import re
import subprocess
import sys

BEGIN, END = "<!-- sfx:begin -->", "<!-- sfx:end -->"


def as_list(x):
    return x if isinstance(x, list) else [x]


def probe(path, cache={}):
    if path not in cache:
        if not os.path.isfile(path):
            sys.exit(f"sfx_tags: no such file: {path}")
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                             capture_output=True, text=True).stdout.strip()
        try:
            cache[path] = float(out)
        except ValueError:
            sys.exit(f"sfx_tags: ffprobe could not read the length of {path}")
    return cache[path]


def attr(tag, name):
    m = re.search(r'\b' + name + r'="([^"]*)"', tag)
    return m.group(1) if m else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("list", help="the JSON list of sounds")
    ap.add_argument("--events", help="launch_events.cjs's output, for entries with \"events\"")
    ap.add_argument("--into", help="write the tags into this composition, between the sfx markers")
    ap.add_argument("--root", default="composition", help="the folder the src paths are relative to")
    ap.add_argument("--first-track", type=int, default=12)
    ap.add_argument("--last-track", type=int, default=19, help="warn above this track (voice lines use 20 and up)")
    ap.add_argument("--duration", type=float, help="the video's length (default: the composition's, or the events')")
    a = ap.parse_args()

    entries = json.load(open(a.list))
    events = json.load(open(a.events)) if a.events else {}
    html = open(a.into, encoding="utf-8").read() if a.into else ""
    duration = a.duration
    if duration is None and html:
        m = re.search(r'data-composition-id[^>]*?data-duration="([\d.]+)"|data-duration="([\d.]+)"[^>]*?data-composition-id', html)
        duration = float(m.group(1) or m.group(2)) if m else None
    if duration is None and events.get("duration"):
        duration = float(events["duration"])

    # the tracks other <audio> tags hold (music, typing, voice lines), outside our own block
    outside = html
    if BEGIN in html and END in html:
        outside = html[:html.index(BEGIN)] + html[html.index(END):]
    busy, ids = {}, set(re.findall(r'\bid="([^"]+)"', outside))
    for tag in re.findall(r"<audio\b[^>]*>", outside):
        tr, st, du = attr(tag, "data-track-index"), attr(tag, "data-start"), attr(tag, "data-duration")
        if tr is None:
            continue
        s = float(st or 0)
        busy.setdefault(int(tr), []).append((s, s + float(du) if du else float("inf")))

    clips = []
    for n, e in enumerate(entries):
        srcs = as_list(e["src"])
        if "events" in e:
            if not events:
                sys.exit(f"sfx_tags: entry {n + 1} uses events \"{e['events']}\": give --events tools/launch-events.json")
            times = [ev["t"] for ev in events.get("events", []) if ev.get("kind") == e["events"]]
            if not times:
                print(f"note: no \"{e['events']}\" events in {a.events}; entry {n + 1} places no sound", file=sys.stderr)
        else:
            times = as_list(e["t"])
        times = sorted(float(t) + float(e.get("offset", 0)) for t in times)
        gap, last, kept = float(e.get("min_gap", 0)), None, []
        for t in times:
            if last is not None and t - last < gap - 1e-6:
                continue
            kept.append(t)
            last = t
        name = e.get("id") or e.get("events") or os.path.splitext(os.path.basename(srcs[0]))[0]
        prefix = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        for i, t in enumerate(kept):
            src = srcs[i % len(srcs)]
            d = probe(os.path.join(a.root, src))
            if duration is not None:
                if t >= duration:
                    print(f"note: {src} at {t:g} s starts after the video's end ({duration:g} s); skipped", file=sys.stderr)
                    continue
                d = min(d, duration - t)
            clips.append({"src": src, "t": round(t, 3), "d": round(d, 3), "vol": float(e.get("volume", 0.5)), "prefix": prefix})

    clips.sort(key=lambda c: (c["t"], c["prefix"]))
    used = {}
    for c in clips:
        s, f = c["t"], c["t"] + c["d"]
        tr = a.first_track
        while any(s < b and a0 < f for a0, b in busy.get(tr, []) + used.get(tr, [])):
            tr += 1
        used.setdefault(tr, []).append((s, f))
        c["track"] = tr
    top = max((c["track"] for c in clips), default=a.first_track)
    if top > a.last_track:
        print(f"warning: the sounds needed tracks up to {top}, past {a.last_track} (voice lines use 20 and up); "
              "thin them (min_gap) or raise --last-track", file=sys.stderr)

    counts, lines = {}, []
    for c in clips:
        counts[c["prefix"]] = counts.get(c["prefix"], 0) + 1
        cid = f"sfx-{c['prefix']}-{counts[c['prefix']]:02d}"
        while cid in ids:
            cid += "b"
        ids.add(cid)
        lines.append(f'<audio id="{cid}" src="{c["src"]}" data-start="{c["t"]:g}" data-duration="{c["d"]:g}" '
                     f'data-track-index="{c["track"]}" data-volume="{c["vol"]:g}"></audio>')

    summary = f"{len(lines)} sounds on tracks {a.first_track}–{top}" if lines else "no sounds"
    if not a.into:
        print("\n".join(lines))
        print(summary, file=sys.stderr)
        return
    if BEGIN not in html or END not in html:
        sys.exit(f"sfx_tags: {a.into} has no {BEGIN} … {END} block; add those two lines inside the root, "
                 "after the music and typing tags, then run this again")
    start = html.index(BEGIN)
    indent = html[html.rfind("\n", 0, start) + 1:start]
    block = BEGIN + "".join("\n" + indent + ln for ln in lines) + "\n" + indent + END
    html = html[:start] + block + html[html.index(END) + len(END):]
    with open(a.into, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"{a.into}: {summary}")


if __name__ == "__main__":
    main()
