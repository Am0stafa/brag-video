#!/usr/bin/env python3
"""Convert a project's CSS colors to hex, and measure text contrast.

Runs inside the brag-tools image. `hyperframes check` measures contrast only on
colors it can parse as rgb()/hex. With oklch(), oklab() or hsl() tokens it quietly
reports "0/0 text checks" and passes. Convert the tokens to hex for the
composition (the same colors, a format the checker reads), and use --contrast to
test a text/background pair yourself.

  python3 css_colors.py --file styles.css                      # every color token -> hex
  python3 css_colors.py --contrast "oklch(0.97 0.01 90)" "#1d1b22"   # WCAG ratio

AA needs 4.5:1 for body text and 3:1 for large text (24 px, or 18.66 px bold).
"""
import argparse
import math
import re
import sys

FUNC = re.compile(r"(#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch|oklab)\([^)]*\))")


def _num(tok, pct_scale=1.0):
    tok = tok.strip()
    if tok.endswith("%"):
        return float(tok[:-1]) / 100 * pct_scale
    return float(tok)


def _hue(tok):
    tok = tok.strip()
    if tok.endswith("deg"):
        return float(tok[:-3])
    if tok.endswith("turn"):
        return float(tok[:-4]) * 360
    if tok.endswith("rad"):
        return math.degrees(float(tok[:-3]))
    return float(tok)


def _parts(inner):
    inner = inner.split("/")[0]
    return [p for p in re.split(r"[\s,]+", inner.strip()) if p]


def _encode(x):
    x = min(1.0, max(0.0, x))
    return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055


def oklab_to_srgb(L, a, b):
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(_encode(v) for v in (r, g, bl))


def to_rgb(value):
    """CSS color -> (r, g, b) in 0..1, or None if not understood."""
    v = value.strip()
    if v.startswith("#"):
        h = v[1:]
        if len(h) in (3, 4):
            h = "".join(c * 2 for c in h[:3])
        return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) if len(h) >= 6 else None
    m = re.match(r"(\w+)\((.*)\)", v)
    if not m:
        return None
    fn, p = m.group(1).lower(), _parts(m.group(2))
    try:
        if fn in ("rgb", "rgba"):
            return tuple(_num(x, 255) / 255 for x in p[:3])
        if fn in ("hsl", "hsla"):
            h, s, l = _hue(p[0]) % 360 / 360, _num(p[1]), _num(p[2])
            if p[1].strip().endswith("%") is False and s > 1:
                s /= 100
            if p[2].strip().endswith("%") is False and l > 1:
                l /= 100

            def f(n):
                k = (n + h * 12) % 12
                return l - s * min(l, 1 - l) * max(-1, min(k - 3, 9 - k, 1))
            return f(0), f(8), f(4)
        if fn == "oklch":
            L = _num(p[0])
            C = _num(p[1], 0.4)
            H = math.radians(_hue(p[2])) if p[2] != "none" else 0.0
            return oklab_to_srgb(L, C * math.cos(H), C * math.sin(H))
        if fn == "oklab":
            return oklab_to_srgb(_num(p[0]), _num(p[1], 0.4), _num(p[2], 0.4))
    except (ValueError, IndexError):
        return None
    return None


def hexcode(rgb):
    return "#" + "".join(f"{round(max(0, min(1, c)) * 255):02x}" for c in rgb)


def luminance(rgb):
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(c1, c2):
    a, b = sorted((luminance(c1), luminance(c2)), reverse=True)
    return (a + 0.05) / (b + 0.05)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--file", action="append", help="CSS/HTML/TS file to scan for color tokens")
    ap.add_argument("--contrast", nargs=2, metavar=("TEXT", "BACKGROUND"))
    a = ap.parse_args()
    if a.contrast:
        c1, c2 = to_rgb(a.contrast[0]), to_rgb(a.contrast[1])
        if not c1 or not c2:
            sys.exit("could not parse one of the colors")
        r = contrast(c1, c2)
        verdict = "passes AA (4.5:1)" if r >= 4.5 else ("large text only (3:1)" if r >= 3 else "FAILS")
        print(f"{hexcode(c1)} on {hexcode(c2)}: {r:.2f}:1  {verdict}")
    for path in a.file or []:
        raw = open(path, encoding="utf-8", errors="replace").read()
        props = {n: v.strip() for n, v in re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", raw)}

        def resolve(value, depth=0):
            """Replace var(--x) with its value (or its fallback), so oklch(0.7 0.1 var(--hue)) can be read."""
            if depth > 6 or "var(" not in value:
                return value

            def rep(m):
                if m.group(1) in props:
                    return resolve(props[m.group(1)], depth + 1)
                return m.group(2).strip() if m.group(2) else m.group(0)
            return resolve(re.sub(r"var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)", rep, value), depth + 1)

        seen, unresolved = set(), []
        for name, value in props.items():
            value = resolve(value)
            for col in FUNC.findall(value):
                rgb = to_rgb(col)
                if rgb and (name, col) not in seen:
                    seen.add((name, col))
                    print(f"{name:<28} {col:<34} {hexcode(rgb)}")
            if "var(" in value and re.search(r"(oklch|oklab|hsl|rgb)", value):
                unresolved.append(f"{name}: {value}")
        text = resolve(raw)
        for col in sorted(set(FUNC.findall(text))):
            if col.lower().startswith(("oklch", "oklab", "hsl")) and not any(col == c for _, c in seen):
                rgb = to_rgb(col)
                if rgb:
                    print(f"{'(inline)':<28} {col:<34} {hexcode(rgb)}")
        for u in unresolved:
            print(f"unresolved (set at runtime?): {u}")
    if not a.contrast and not a.file:
        ap.print_help()


if __name__ == "__main__":
    main()
