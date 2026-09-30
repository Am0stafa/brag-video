#!/usr/bin/env python3
"""Summarise `hyperframes check --json`: the findings grouped by type, severity and time.

Runs inside the brag-tools image. The raw report is long (every layout finding carries its
rectangle, selectors and fix hint, and one transition can produce dozens), so read this instead:

  hyperframes check --json > ../tools/check.json            (runtime-docker.md has the docker form)
  python3 check_summary.py tools/check.json [--events tools/launch-events.json]
      [--code content_overlap] [--at 18-19] [--all]

For each part of the check (lint, runtime, layout, contrast, motion) it prints the counts, then
each kind of finding (code and severity) with how many there are. Findings with a time are
grouped into moments (findings less than 0.5 s apart) with their time span, the elements involved
(the first #id of each selector, usually the scene or stage) and some of their text. With
--events (launch_events.cjs's output), a moment inside a scene transition is labelled with it, so
the side effects of a transition are told apart from real layout bugs. It says when the check cut
its layout list short (it lists at most 80 findings). Exits 1 when the check has errors.

  --code   only this code (repeatable)       --at   only findings from A to B seconds ("18-19")
  --all    every finding, not only the first few of each moment
"""
import argparse
import json
import re
import sys

PARTS = ("lint", "runtime", "layout", "contrast", "motion")
RANK = {"error": 0, "warning": 1, "info": 2}
# how long each transition the launch engine logs lasts (launch-motion.js, launch-text.js)
TRANSITIONS = {"open": 0.45, "reveal": 0.3, "warp": 0.35, "focus": 0.4, "fill": 0.45}


def owner(sel):
    """The first #id of a selector: usually the scene or stage the element lives in."""
    m = re.search(r"#([\w-]+)", sel or "")
    return "#" + m.group(1) if m else (sel or "?").split(" ")[0][:40]


def moments(findings, gap=0.5):
    out = []
    for f in sorted(findings, key=lambda f: f.get("time", 0.0)):
        t = float(f.get("time", 0.0))
        end = float(f.get("lastSeen", t))
        if out and t - out[-1]["t1"] <= gap:
            out[-1]["items"].append(f)
            out[-1]["t1"] = max(out[-1]["t1"], end)
        else:
            out.append({"t0": t, "t1": end, "items": [f]})
    return out


def windows(events_path):
    if not events_path:
        return []
    events = json.load(open(events_path)).get("events", [])
    return [(e["t"], e["t"] + TRANSITIONS[e["kind"]], e["kind"]) for e in events if e.get("kind") in TRANSITIONS]


def span(m):
    return f"{m['t0']:.2f} s" if m["t1"] - m["t0"] < 0.005 else f"{m['t0']:.2f}–{m['t1']:.2f} s"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("report", help="the output of hyperframes check --json")
    ap.add_argument("--events", help="tools/launch-events.json, to label moments inside transitions")
    ap.add_argument("--code", action="append", help="only this finding code (repeatable)")
    ap.add_argument("--at", help="only findings from A to B seconds, e.g. 18-19")
    ap.add_argument("--all", action="store_true", help="list every finding of every moment")
    a = ap.parse_args()
    raw = open(a.report, encoding="utf-8").read()
    d = json.loads(raw[raw.index("{"):])  # tolerate a log line before the JSON
    wins = windows(a.events)
    t_lo, t_hi = (float(x) for x in a.at.split("-", 1)) if a.at else (None, None)

    errors = sum(d.get(p, {}).get("errorCount", 0) for p in PARTS)
    warnings = sum(d.get(p, {}).get("warningCount", 0) for p in PARTS)
    infos = sum(d.get(p, {}).get("infoCount", 0) for p in PARTS)
    version = d.get("_meta", {}).get("version", "?")
    print(f"check: {'ok' if d.get('ok') else 'FAILED'} · hyperframes {version} · {errors} errors, "
          f"{warnings} warnings, {infos} info")

    for part in PARTS:
        sec = d.get(part)
        if not sec:
            continue
        if part in ("contrast", "motion") and sec.get("enabled") is False:
            print(f"\n{part}: off")
            continue
        found = sec.get("findings", [])
        if a.code:
            found = [f for f in found if f.get("code") in a.code]
        if t_lo is not None:
            found = [f for f in found if "time" in f and t_lo <= float(f["time"]) <= t_hi]
        head = f"\n{part}: {sec.get('errorCount', 0)} errors, {sec.get('warningCount', 0)} warnings, {sec.get('infoCount', 0)} info"
        if part == "contrast" and "checked" in sec:
            head += f" · {sec.get('passed', 0)}/{sec['checked']} text checks passed"
        if sec.get("truncated"):
            head += (f" · the check found {sec.get('totalIssueCount')} and listed {len(sec.get('findings', []))}: "
                     "fix these, then run it again to see the rest")
        print(head)
        if not found:
            continue
        kinds = {}
        for f in found:
            kinds.setdefault(f.get("code", "?"), []).append(f)
        for code, fs in sorted(kinds.items(), key=lambda kv: (min(RANK.get(f.get("severity"), 3) for f in kv[1]), kv[0])):
            sev = {}
            for f in fs:
                sev[f.get("severity", "?")] = sev.get(f.get("severity", "?"), 0) + 1
            counts = ", ".join(f"{s} ×{n}" for s, n in sorted(sev.items(), key=lambda kv: RANK.get(kv[0], 3)))
            print(f"  {code}: {counts}. {fs[0].get('message', '')}")
            timed = [f for f in fs if "time" in f and part != "lint"]
            if not timed:
                messages = []
                for f in fs:
                    if f.get("message") not in messages:
                        messages.append(f.get("message"))
                for msg in messages[1:] if not a.all else messages:
                    print(f"      {msg}")
                continue
            for m in moments(timed):
                pairs = []
                for f in m["items"]:
                    p = owner(f.get("selector")) + (" ↔ " + owner(f.get("containerSelector")) if f.get("containerSelector") else "")
                    if p not in pairs:
                        pairs.append(p)
                texts = []
                for f in m["items"]:
                    if f.get("text") and f["text"] not in texts:
                        texts.append(f["text"])
                label = ""
                for w0, w1, kind in wins:
                    if m["t0"] <= w1 + 0.05 and m["t1"] >= w0 - 0.05:
                        label = f"   during the {kind} at {w0:.2f} s"
                        break
                quoted = ", ".join('"' + t[:28] + '"' for t in texts[:3])
                print(f"    {span(m):>15}  ×{len(m['items']):<3} {', '.join(pairs[:3])}"
                      + (f" (+{len(pairs) - 3})" if len(pairs) > 3 else "")
                      + (f"   {quoted}" if texts else "") + label)
                if a.all:
                    for f in m["items"]:
                        print(f"        {f.get('time', 0):.3f} s {f.get('severity')}: {f.get('selector')}"
                              + (f"  ↔  {f.get('containerSelector')}" if f.get("containerSelector") else ""))
            hint = fs[0].get("fixHint")
            if hint:
                print(f"      fix: {hint}")
    sys.exit(1 if errors or d.get("ok") is False else 0)


if __name__ == "__main__":
    main()
