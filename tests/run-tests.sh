#!/bin/sh
# The launch engine's tests. Run them inside the brag-tools image, never on the host:
#
#   docker run --rm --shm-size=2g -v "$PWD":/repo -w /repo brag-tools:0.8.91-r3 sh tests/run-tests.sh
#
# For each page in tests/compositions/ and the skill's own example, it builds a composition from
# the image's blank template with the current engine (skills/brag/assets/launch) and the Geist
# font, then checks four things:
#   1. hyperframes lint passes;
#   2. hyperframes check, sampled at every tween boundary, finds no errors and no warnings;
#   3. every statement can be read (launch_events.cjs --strict);
#   4. the same frames drawn forward, backward and shuffled look the same (seek-test.cjs).
# The results stay in tests/.work/<name>/ (ignored by Git). The font is downloaded once, so the
# container needs the network.
set -u
# One container runs many commands here. With an update check on, the pinned Hyperframes installs
# a newer version in the background as soon as no hyperframes command is running, and the next
# script fails to load its files. Keep the pinned version.
export HYPERFRAMES_NO_UPDATE_CHECK=1 HYPERFRAMES_NO_AUTO_INSTALL=1
cd "$(dirname "$0")/.."
WORK=tests/.work
SKILL=skills/brag
rm -rf "$WORK" && mkdir -p "$WORK"
if ! python3 "$SKILL/scripts/fetch_fonts.py" --font "Geist:600" --out "$WORK/fonts" >/dev/null; then
  echo "could not download the Geist font: the container needs the network"
  exit 1
fi
failed=0

test_page() {
  name=$1 page=$2 seconds=$3
  dir="$WORK/$name"
  cp -R /opt/brag/templates/landscape "$dir"
  mkdir -p "$dir/assets/launch" "$dir/assets/fonts"
  cp "$SKILL"/assets/launch/*.js "$SKILL"/assets/launch/launch.css "$dir/assets/launch/"
  cp "$WORK/fonts/geist-600-normal-latin.woff2" "$dir/assets/fonts/"
  cp "$page" "$dir/index.html"
  if [ -n "$seconds" ]; then
    # the example plays a music bed and a typing track: silent files of the right length
    mkdir -p "$dir/assets/music" "$dir/assets/sfx"
    ffmpeg -v error -f lavfi -i anullsrc=r=48000:cl=stereo -t "$seconds" -y "$dir/assets/music/score-ducked.wav"
    cp "$dir/assets/music/score-ducked.wav" "$dir/assets/sfx/typing.wav"
  fi
  echo "== $name"
  if (cd "$dir" && hyperframes lint > lint.txt 2>&1); then echo "   lint: ok"; else echo "   lint: FAILED"; cat "$dir/lint.txt"; failed=$((failed + 1)); fi
  (cd "$dir" && hyperframes check --json --at-transitions > check.json 2> check.err)
  python3 "$SKILL/scripts/check_summary.py" "$dir/check.json" > "$dir/check.txt"
  if head -1 "$dir/check.txt" | grep -q "0 errors, 0 warnings"; then echo "   $(head -1 "$dir/check.txt")"
  else echo "   check: FAILED"; cat "$dir/check.txt"; failed=$((failed + 1)); fi
  if node "$SKILL/scripts/launch_events.cjs" "$dir/index.html" --strict > "$dir/reading.txt" 2>&1; then echo "   reading time: $(grep -E 'statements' "$dir/reading.txt" | tail -1)"
  else echo "   reading time: FAILED"; cat "$dir/reading.txt"; failed=$((failed + 1)); fi
  if node tests/seek-test.cjs "$dir/index.html" 0.2 > "$dir/seek.txt" 2>&1; then echo "   frame order: $(tail -1 "$dir/seek.txt")"
  else echo "   frame order: FAILED"; tail -30 "$dir/seek.txt"; failed=$((failed + 1)); fi
}

# `sh tests/run-tests.sh marks backdrops` runs only the pages named; with no names, all of them
ONLY=" $* "
run_page() { case "$ONLY" in "  ") test_page "$@" ;; *" $1 "*) test_page "$@" ;; esac; }

run_page kit tests/compositions/kit.html ""
run_page transitions tests/compositions/transitions.html ""
run_page marks tests/compositions/marks.html ""
run_page backdrops tests/compositions/backdrops.html ""
run_page example "$SKILL/assets/launch/example.html" 22.5
run_page showcase "$SKILL/assets/launch/showcase.html" ""

if [ "$failed" -eq 0 ]; then echo "all tests passed"; else echo "$failed test(s) failed"; fi
exit "$failed"
