#!/usr/bin/env python3
"""Check a video's text for private data before rendering, and list its claims.

Runs inside the brag-tools image. Two jobs:

1. Privacy scan (default). Reads privacy-terms.txt and searches the given files
   and folders (composition, plan, brief, share copy):

     deny: <text>    found in the project and must not appear (a real customer,
                     host, person, internal URL, IP, credential...)
     allow: <text>   the user asked for it, so it may appear even if it looks private

   A term matches as a whole word: "Tines" finds "Tines," and "tines_logo" but
   not "routines". Its ends that are symbols match as they are, so
   "/Users/jane/" still finds every path under it.

   It also warns on anything that looks like an email, an IPv4 address, an API
   key, a token or a private key, and lists URLs for a quick look. Documentation
   addresses (192.0.2.x, 198.51.100.x, 203.0.113.x) and reserved example domains
   (.example, .test, .invalid, example.com/.net/.org) count as fake: step 1 asks for
   them. Numbers that only look like addresses are skipped: a part with a leading
   zero ("7.178.07.207", from an icon's path data; real addresses never have one)
   or four parts inside a longer dotted run (a version like 1.2.3.4.5). A deny hit
   exits with status 1; warnings do not (add --strict to fail on them too).
   Anything covered by an allow line is reported as "requested" and never fails.

     python3 scan_text.py --terms privacy-terms.txt composition brag-plan.md share-copy.txt

2. Claims list (--list-text). Prints the visible text of a composition page, so
   every name, number and capability on screen can be checked against its
   source in the plan's claims table. Lines with digits are marked, because
   numbers are the claims most often invented.

     python3 scan_text.py --list-text composition/index.html

Text set from JavaScript at runtime (typed prompts, count-ups) is not in the
page's markup; check those strings in the script by eye.
"""
import argparse
import html.parser
import os
import re
import sys

TEXT_EXT = {".html", ".htm", ".js", ".mjs", ".css", ".md", ".txt", ".json", ".srt", ".vtt", ".svg", ".csv"}
SKIP_DIRS = {"node_modules", ".git", "snapshots", "fonts", "vendor", "__pycache__"}
PATTERNS = {
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    # four dotted numbers, not inside a longer dotted run
    "ipv4": re.compile(r"(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?!\w|\.\d)"),
    "aws key": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "github token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    "api key": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"),
    "slack token": re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}"),
    "private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
}
URL = re.compile(r"https?://[^\s\"'<>)\]]+")
# reserved example domains (RFC 2606) and retina-image names like logo@2x
SAFE_EMAIL = re.compile(r"@(([\w-]+\.)*(example|test|invalid)\b|example\.(com|org|net)|\d+x\b)", re.I)


def term_rx(term):
    """A term as a pattern that matches it as a whole word, in any case. A side of the term that
    is a letter or digit must not touch another letter or digit ("Tines" is not in "routines");
    a side that is a symbol matches as it is ("/Users/jane/" finds "/Users/jane/repos")."""
    left = r"(?<![^\W_])" if term[:1].isalnum() else ""
    right = r"(?![^\W_])" if term[-1:].isalnum() else ""
    return re.compile(left + re.escape(term) + right, re.I)


def load_terms(path):
    deny, allow = [], []
    if not path:
        return deny, allow
    for raw in open(path, encoding="utf-8"):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        kind, _, term = line.partition(":")
        term = term.strip()
        if not term:
            continue
        if kind.strip().lower() == "deny":
            deny.append(term)
        elif kind.strip().lower() == "allow":
            allow.append(term)
    return deny, allow


def files_under(paths):
    for p in paths:
        if os.path.isfile(p):
            yield p
            continue
        for root, dirs, names in os.walk(p):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for n in names:
                fp = os.path.join(root, n)
                if os.path.splitext(n)[1].lower() in TEXT_EXT and os.path.getsize(fp) < 5_000_000:
                    yield fp


def allowed(text, allow):
    low = text.lower()
    return any(a.lower() in low or low in a.lower() for a in allow)


# documentation addresses (RFC 5737): reserved for examples, so the fake data step 1 asks for
DOC_NETS = ("192.0.2.", "198.51.100.", "203.0.113.")


def ipv4_ok(ip):
    """True when the text looks like a real IPv4 address worth a warning."""
    parts = ip.split(".")
    if any(len(p) > 1 and p.startswith("0") for p in parts):
        return False  # "07": real addresses never have a leading zero; SVG path numbers do
    return (all(int(p) <= 255 for p in parts) and ip not in ("0.0.0.0", "127.0.0.1")
            and not ip.startswith(DOC_NETS))


class TextOnly(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.lines = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "template"):
            self.skip += 1
        for k, v in attrs:
            if k in ("alt", "title", "aria-label", "placeholder") and v and v.strip():
                self.lines.append(v.strip())

    def handle_endtag(self, tag):
        if tag in ("script", "style", "template") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip and data.strip():
            self.lines.append(" ".join(data.split()))


def list_text(path):
    p = TextOnly()
    p.feed(open(path, encoding="utf-8").read())
    seen = []
    for line in p.lines:
        if line not in seen:
            seen.append(line)
    for line in seen:
        print(("# " if re.search(r"\d", line) else "  ") + line)
    print(f"\n{len(seen)} distinct text strings; '#' marks lines with numbers.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--terms", help="privacy-terms.txt (deny:/allow: lines)")
    ap.add_argument("--strict", action="store_true", help="also fail on warnings")
    ap.add_argument("--list-text", action="store_true", help="print the visible text of an HTML page instead")
    a = ap.parse_args()
    if a.list_text:
        for p in a.paths:
            list_text(p)
        return

    deny, allow = load_terms(a.terms)
    deny_rx = [(term, term_rx(term)) for term in deny]
    fails, warns, urls, requested = [], [], set(), set()
    for fp in files_under(a.paths):
        if a.terms and os.path.abspath(fp) == os.path.abspath(a.terms):
            continue
        try:
            lines = open(fp, encoding="utf-8", errors="replace").read().splitlines()
        except OSError:
            continue
        for no, line in enumerate(lines, 1):
            for term, rx in deny_rx:
                if rx.search(line):
                    if allowed(term, allow):
                        requested.add(term)
                    else:
                        fails.append(f"{fp}:{no}: deny term {term!r}: {line.strip()[:140]}")
            for name, rx in PATTERNS.items():
                for m in rx.finditer(line):
                    hit = m.group(0)
                    if name == "email" and SAFE_EMAIL.search(hit):
                        continue
                    if name == "ipv4" and not ipv4_ok(hit):
                        continue
                    if allowed(hit, allow):
                        requested.add(hit)
                        continue
                    warns.append(f"{fp}:{no}: looks like {name}: {hit}")
            for m in URL.finditer(line):
                urls.add(m.group(0))
    print(f"deny terms: {len(deny)}   allow terms: {len(allow)}")
    print(f"FAIL ({len(fails)}): private text that was not asked for" if fails else "FAIL: none")
    for f in fails:
        print(f"  {f}")
    print(f"WARN ({len(warns)}): check these are fake or asked for" if warns else "WARN: none")
    for w in warns[:200]:
        print(f"  {w}")
    if requested:
        print("requested by the user (allowed): " + ", ".join(sorted(requested)))
    if urls:
        print(f"URLs present ({len(urls)}), make sure none is private if it shows on screen:")
        for u in sorted(urls)[:60]:
            print(f"  {u}")
    sys.exit(1 if fails or (a.strict and warns) else 0)


if __name__ == "__main__":
    main()
