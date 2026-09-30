#!/usr/bin/env python3
"""Download web fonts into the composition, so renders never depend on the network.

Runs inside the brag-tools image (it needs network access, which Docker has).
First choice is always the project's own font files (e.g. node_modules/@fontsource*,
public/fonts): copy those. When the project loads a font from Google Fonts or names
a Google font, fetch it with this script:

  python3 fetch_fonts.py --font "Inter:400,600" --font "IBM Plex Mono:400,500" \
      --out composition/assets/fonts [--subset latin,latin-ext]

For a variable font you can give a range: --font "Inter:400..700".
Writes the .woff2 files and <out>/fonts.css, and prints the same @font-face rules
with paths relative to composition/. Paste them into the composition's own <style>:
Hyperframes' checker only sees in-file @font-face rules and warns about a linked
stylesheet. Google Fonts are OFL or Apache licensed; list them in credits.md.

Variable fonts (Inter, Geist, Roboto Flex...) are detected: Google serves every
requested weight from one file, so the weights become one rule with a weight range
(font-weight: 400 700) on a file named for that range (inter-400-700-normal-latin.woff2),
instead of one rule per weight that all point at a file named for the first weight.
A static family keeps one file and one rule per weight.
"""
import argparse
import os
import re
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")  # woff2 is served to modern browsers only


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def css_url(family, weights):
    fam = family.strip().replace(" ", "+")
    if ".." in weights:
        axis = f"wght@{weights}"
    else:
        ws = sorted({int(w) for w in weights.split(",") if w.strip()})
        axis = "wght@" + ";".join(str(w) for w in ws)
    return f"https://fonts.googleapis.com/css2?family={fam}:{axis}&display=swap"


def faces(css, keep):
    """The @font-face blocks of a Google Fonts stylesheet, for the kept subsets."""
    out = []
    for subset, block in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*{[^}]*})", css):
        if subset not in keep:
            continue
        urange = re.search(r"unicode-range:\s*([^;]+);", block)
        out.append({
            "subset": subset,
            "url": re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1),
            "weights": [int(w) for w in re.search(r"font-weight:\s*([^;]+);", block).group(1).split()],
            "style": re.search(r"font-style:\s*([^;]+);", block).group(1).strip(),
            "urange": urange.group(1).strip() if urange else None,
        })
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--font", action="append", required=True, help='"Family:400,600" or "Family:400..700"')
    ap.add_argument("--out", required=True)
    ap.add_argument("--subset", default="latin", help="comma-separated subsets to keep (default latin)")
    a = ap.parse_args()
    keep = {x.strip() for x in a.subset.split(",")}
    os.makedirs(a.out, exist_ok=True)
    rules, notes, count = [], [], 0
    saved = {}  # url -> file name: download each file once
    for spec in a.font:
        family, _, weights = spec.partition(":")
        family = family.strip()
        slug = re.sub(r"[^a-z0-9]+", "-", family.lower()).strip("-")
        # Google lists a variable font once per requested weight, every time with the same file:
        # group the blocks by file, and give each file one rule covering all its weights
        groups = {}
        for f in faces(get(css_url(family, weights or "400")).decode("utf-8"), keep):
            groups.setdefault((f["style"], f["subset"], f["url"]), []).append(f)
        variable = set()
        for (style, subset, url), fs in groups.items():
            ws = sorted({w for f in fs for w in f["weights"]})
            lo, hi = ws[0], ws[-1]
            weight = str(lo) if lo == hi else f"{lo} {hi}"
            if lo != hi:
                variable.add(f"{lo}–{hi}")
            name = saved.get(url) or f"{slug}-{weight.replace(' ', '-')}-{style}-{subset}.woff2"
            if url not in saved:
                with open(os.path.join(a.out, name), "wb") as fh:
                    fh.write(get(url))
                saved[url] = name
                count += 1
            urange = fs[0]["urange"]
            rules.append(f"@font-face {{ font-family: '{family}'; font-style: {style}; font-weight: {weight}; "
                         f"font-display: block; src: url('{name}') format('woff2');"
                         + (f" unicode-range: {urange};" if urange else "") + " }")
        if variable:
            notes.append(f"{family} is a variable font: one file covers weights {', '.join(sorted(variable))}, "
                         "in one rule per file")
    if not rules:
        raise SystemExit("no font files matched: check the family name, weights and --subset")
    with open(os.path.join(a.out, "fonts.css"), "w") as f:
        f.write("/* downloaded by fetch_fonts.py from Google Fonts (OFL / Apache licensed) */\n" + "\n".join(rules) + "\n")
    print(f"{a.out}: {count} font files + fonts.css ({', '.join(s.split(':')[0] for s in a.font)})")
    for n in notes:
        print(f"note: {n}")
    # Hyperframes' checker only sees @font-face rules inside the composition's own <style>, and
    # warns about a linked stylesheet; so paste these, with urls relative to composition/.
    rel = os.path.relpath(a.out, "composition") if not os.path.isabs(a.out) else a.out
    print("\nPaste into the composition's <style>:")
    for r in rules:
        print(re.sub(r"url\('([^']+)'\)", lambda m: f"url('{rel}/{m.group(1)}')", r))


if __name__ == "__main__":
    main()
