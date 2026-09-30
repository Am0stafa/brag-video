# Runtime: everything in Docker

The user's rules: nothing third-party gets installed on the host, and no downloaded
or generated code (scripts, inline interpreters, heredocs) runs on the host. So every
tool this skill needs lives in one image, and every tool command below is a `docker run`.

## What runs where

| On the host (allowed) | In the `brag-tools` image (everything else) |
|---|---|
| `docker` — build, run, inspect | `hyperframes` — lint, check, snapshot, beats, tts, render |
| `git` — read history and fetch a PR's commits (never switch the user's branch) | `ffmpeg` / `ffprobe` — frames, loudness, poster bake |
| `gh` — PR metadata and diffs; it needs the host's GitHub login | `python3` / `node` — the skill's scripts in `scripts/` and the Hyperframes helper scripts |
| `curl` — download public assets (download only, nothing downloaded runs on the host) | Chrome headless shell — rendering |
| `open` — show the finished video | Kokoro — the voice over |
| ordinary macOS file and inspection tools: `ls`, `cp`, `mv`, `mkdir`, `rm` (on this run's own files), `cat`, `head`, `grep`, `sed`, `find`, `wc` | `npm` — only inside the image, never on the host |
| the agent's own file tools (Read, Write, Edit) | |

Never run `python3`, `node`, `npx`, `npm`, `uv` or any script from this skill on the host,
even if it is installed there.

## Names used below

| Name | Meaning |
|---|---|
| `<skill-dir>` | this skill's folder (Claude Code prints it as "Base directory for this skill") |
| `brag-tools:0.8.91-r3` | the image |
| `$OUT` | the absolute path of the output folder, e.g. `/Users/me/repos/app/brag-output` |
| `$PROJECT` | the absolute path of the project root |
| `~/.cache/brag/hyperframes-0.8.91/skills` | the Hyperframes skills, exported for reading |

Shell variables don't survive between tool calls, so write the values out in each command.
Quote every path, and brace variables that are followed by a colon (`"${OUT}:x"`): zsh
reads `"$OUT:x"` as a history modifier. Keep absolute paths out of the plan, the brief and
the composition, because they contain the user's name. Use paths relative to the project.

## Preflight (once per run)

```bash
docker info >/dev/null 2>&1 && echo "docker ok" || echo "Docker is not running"
docker image inspect brag-tools:0.8.91-r3 >/dev/null 2>&1 && echo "image ok" \
  || docker build -t brag-tools:0.8.91-r3 "<skill-dir>/docker"
mkdir -p ~/.cache/brag && docker run --rm -v "$HOME/.cache/brag":/cache brag-tools:0.8.91-r3 sh -c \
  'test -d /cache/hyperframes-0.8.91/skills || { mkdir -p /cache/hyperframes-0.8.91 && cp -R /opt/hf-home/.agents/skills /cache/hyperframes-0.8.91/skills; }; ls /cache/hyperframes-0.8.91/skills'
```

- Docker not running → ask the user to start Docker Desktop, then continue.
- The first build downloads about 1.3 GB and takes 5–10 minutes (the image is ~3.7 GB).
  Run it in the background and plan the video while it builds.
- Read the Hyperframes skills from the cache with the normal Read tool. Don't install them
  into the host's agent folders.

## Commands

**Create the composition.** Copy a ready blank composition out of the image: offline and
instant, with GSAP already local in `assets/vendor/gsap.min.js`. Use `portrait`
(1080×1920) or `square` (1080×1080) instead of `landscape` for other formats.

```bash
docker run --rm -v "$OUT":/out brag-tools:0.8.91-r3 sh -c 'test ! -e /out/composition && cp -R /opt/brag/templates/landscape /out/composition && echo created'
```

Don't use `hyperframes init` for this. It needs the network, it fails with `EACCES` when it
writes into a mounted folder, and it writes a `CLAUDE.md` and an `AGENTS.md` that send agents
to other workflows and to `npm` on the host. The blank template fails `check` with "Timeline
did not advance" until something animates; that is expected.

**Fonts.** In order of preference:

1. The project's own font files (`node_modules/@fontsource*/files/`, `public/fonts/`): copy
   the ones you need into `composition/assets/fonts/` and write `@font-face` rules for them
   inside the composition's own `<style>`.
2. Google Fonts, downloaded once into the composition, so the render is offline and exact:

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/fetch_fonts.py --font "Inter:400,600" --font "IBM Plex Mono:400,500" --out composition/assets/fonts
```

   It prints the `@font-face` rules with paths relative to `composition/`; paste them into
   the composition's own `<style>`. Hyperframes' checker only sees in-file rules; a linked
   `fonts.css` gets a false "text will fall back" warning. (Hyperframes also fetches
   Google Fonts by itself at compile time, but that needs the network on every run.) A
   variable font (Inter, Geist, Roboto Flex) comes as one file for all the weights asked
   for, so it gets one rule with a weight range (`font-weight: 400 700`) and a file named
   for that range, and prints a note saying so.

**Lint, check, snapshot, beats** (run in the composition folder; Chrome needs shared memory):

```bash
docker run --rm --shm-size=2g -v "$OUT":/work -w /work/composition brag-tools:0.8.91-r3 hyperframes lint
docker run --rm --shm-size=2g -v "$OUT":/work -w /work/composition brag-tools:0.8.91-r3 hyperframes check
docker run --rm --shm-size=2g -v "$OUT":/work -w /work/composition brag-tools:0.8.91-r3 hyperframes snapshot --at 1.2,3.5,8.3 --no-end
docker run --rm --shm-size=2g -v "$OUT":/work -w /work/composition brag-tools:0.8.91-r3 hyperframes beats .
```

- `check --json > ../tools/check.json` gives a machine-readable report. It is long (one run's
  was 84 KB, with 80 findings), so read it through the summary, which groups the findings
  by kind, severity and moment, and labels the moments inside a scene transition:

```bash
docker run --rm --shm-size=2g -v "$OUT":/work -w /work/composition brag-tools:0.8.91-r3 sh -c 'mkdir -p ../tools && hyperframes check --json > ../tools/check.json'
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/check_summary.py tools/check.json --events tools/launch-events.json
```

  Leave out `--events` until `launch_events.cjs` has saved that file. `--code
  content_overlap` and `--at 18-19` narrow it down, `--all` lists every finding. It exits 1
  when the check has errors, like the check itself.
- `snapshot` empties `composition/snapshots/` on every run. It writes
  `frame-NN-at-Ts.png` and a contact sheet: `contact-sheet.jpg`, or
  `contact-sheet-1.jpg … -N.jpg` when there are many frames. Without `--no-end` it also
  adds a frame near the end. Delete `composition/snapshots/` before rendering.

**Voice over** (offline; the model is baked into the image; missing folders are created):

```bash
docker run --rm -v "$OUT":/work -w /work brag-tools:0.8.91-r3 hyperframes tts "One line of narration." --voice af_heart -o composition/assets/voice/vo-01.wav
docker run --rm -v "$OUT":/work -w /work brag-tools:0.8.91-r3 hyperframes tts tools/vo-02.txt --voice af_heart --speed 0.95 -o composition/assets/voice/vo-02.wav
```

It writes 24 kHz mono WAV and takes about a second per second of speech.

**Render** (name the container, so a long render can be found and stopped safely):

```bash
docker run --rm --name brag-render-<subject> --shm-size=4g -v "$OUT":/work -w /work/composition brag-tools:0.8.91-r3 hyperframes render --quality delivery --fps 30 --output ../brag.mp4
```

Use `--quality draft` for quick checks. On an M1 Max a delivery render runs at about
0.7× real time with four parallel workers: 34 s of video in about 24 s (BeginFrame
capture, software GPU). Heavy effects (blur, many layers) are slower.

Never pass API keys or tokens into a container. `hyperframes snapshot --describe` would
send frames to an outside model if a key such as `GEMINI_API_KEY` were set; /brag never
sets one, so it only prints a note.

**The skill's scripts** (mount the scripts folder read-only):

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/compose_score.py tools/score.json --out composition/assets/music/score.wav --cues tools/score.cues.json
```

| Script | Job |
|---|---|
| `compose_score.py` | original music from a plan of sections (audio.md) |
| `make_sfx.py` | generated sound effects: whoosh, riser, boom, impact, blip, tick, shimmer, wingbeats, glitch |
| `clean_sound.py` | turn a downloaded public-domain recording into a clean effect |
| `audio_report.py` | loudness, peaks and balance of a track or the finished video; `--hits` checks that short sounds (the typing) are heard and on time |
| `launch_events.cjs` | (run with `node`) opens a `launch` composition, prints the reading-time table (is every statement on screen long enough to read?), and with an output file saves its event log: every typed piece, transition, click, tap and UI key, with times |
| `typing_track.py` | the `launch` typing sound: one deep key hit per typed piece, as one track levelled against the music; `--one` writes a single hit |
| `sfx_tags.py` | the sound-effect `<audio>` tags from a JSON list (`tools/sfx.json`): real durations, tracks that never overlap, written between the `sfx:begin` and `sfx:end` lines |
| `check_summary.py` | reads `hyperframes check --json` and prints its findings grouped by kind, severity and moment, with transitions labelled |
| `contact_sheet.py` | many frames on one labelled image, for review |
| `scan_text.py` | private-text scan (`--terms privacy-terms.txt`), and `--list-text` for the claims check |
| `finalize.py` | poster as frame 0, loudness to −14 LUFS, and checks that nothing else changed |
| `fetch_fonts.py` | Google Fonts into `composition/assets/fonts/` with a `fonts.css`; a variable font becomes one file and one rule covering its weights (`font-weight: 400 700`) |
| `css_colors.py` | `oklch()` / `oklab()` / `hsl()` tokens → hex, and WCAG contrast of a pair |
| `verify_rig.py` | proves a logo cut into parts still matches the original at rest |
| `compact_audio_data.py` | shrinks Hyperframes' audio data for an audio-reactive background |

Run each with `--help` for its options. Every script creates missing output folders.

**Hyperframes helper scripts** are inside the image too, e.g. the audio-data extractor:

```bash
docker run --rm -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /opt/hf-home/.agents/skills/hyperframes-creative/scripts/extract-audio-data.py composition/assets/music/score.wav --fps 30 --bands 16 -o tools/audio-data.json
```

**Reading project files from a container:** add `-v "$PROJECT":/project:ro`.

## Traps (all hit in real runs)

- **Shared memory.** Chrome needs `--shm-size=2g` (render: `4g`); the 64 MB default
  makes it crash or hang.
- **Hyperframes updates itself.** When a newer version exists, the pinned CLI starts a
  background install of it, which waits while any `hyperframes` command runs and then
  replaces the global package. A one-shot `docker run --rm` per command (as everywhere in
  this skill) exits first, so the image never changes. But in one container that runs
  several commands (`sh -c 'hyperframes check …; node …'`), the next command can fail with
  `Cannot find module …/hyperframes/node_modules/…`. For such chains, add
  `-e HYPERFRAMES_NO_UPDATE_CHECK=1` to the `docker run`.
- **Contrast is only measured on hex and `rgb()` colors.** `check` catches low-contrast text
  written in hex or `rgb()`. Text colored with `oklch()`, `oklab()`, `lab()` or `color()` is
  silently skipped, so the check passes while testing nothing. Convert the product's tokens
  with `css_colors.py --file` and use the hex values in the composition.
- **The layout audit reads boxes, not what is visible.** A row collapsed with
  `height: 0; overflow: hidden` still counts as overlapping text, and a transparent
  full-frame gradient counts as covering it. Hide things that aren't shown yet with
  `autoAlpha: 0` (visibility), keep shades and scrims only as large as they need to be,
  and mark purely decorative full-frame layers `data-layout-ignore`.
- **Snapshots can come out blank.** Now and then a snapshot frame is plain white
  with only emoji painted, even when the render at that time is correct. Re-take that
  moment in a small batch (`--at` with a few times). If it stays blank, check the render
  with `contact_sheet.py` instead.
- **Piping into a container** (a heredoc or `cat x |`) needs `docker run -i`; without it,
  stdin is silently empty and nothing happens.
- **Preview.** `hyperframes preview` listens inside the container, so the Mac usually can't
  reach it. Review with snapshots and contact sheets; the user watches the final MP4 with
  `open brag-output/brag.mp4`.
- **Beat detection on composed music** is approximate (it read a 120 BPM track as "129,
  uncertain"). For music from `compose_score.py`, use its exact cue file instead.
- **Paths.** Inside the container the output folder is `/work`; audio and image paths in
  the composition stay relative to `composition/`.
- **Stopping work.** Every run uses `--rm`. To stop a render, run `docker stop brag-render-<subject>`
  after checking with `docker ps` that it is the container this run started. Never kill
  processes by name or pattern.
- **macOS grep** is strict about complex regular expressions. Keep patterns simple, or
  search inside the container.
- **zsh and `=`.** A word that starts with `=` is expanded (`echo ===` fails with
  "== not found"). Quote it.
- **zsh arrays count from 1.** A shell loop that pairs `${files[i]}` with `${times[i]}`
  from 0 shifts everything by one in zsh, without an error. Don't loop over parallel
  arrays on the host: put the data in a JSON file and let a script in the image read it
  (the effect tags: `sfx_tags.py`).
- **Helper agents run code on the host.** Two of three helpers in one run ran `python`
  on the Mac to read files. Brief every helper with the read-only template in
  step-1-inspect.md.
- **A big untracked folder in the user's repo.** The output folder is often over 100 MB.
  Add `brag-output*/` to the repo's local exclude file (SKILL.md, "Output folder").
- **Colour in extracted frames.** Renders are tagged BT.709. A JPEG written straight from the
  video by FFmpeg is read back as BT.601, which shifts saturated colours (a brand orange went
  from 236,63,9 to 223,50,14). `finalize.py` and `contact_sheet.py` name the matrix
  explicitly. For your own extractions, go through RGB:
  `-vf scale=in_color_matrix=bt709:in_range=tv,format=rgb24`, writing PNG.

## Upgrading Hyperframes

Change `ARG HYPERFRAMES_VERSION` in `docker/Dockerfile`, bump the tag (`0.9.x-r1`), rebuild,
export the skills to a new `~/.cache/brag/hyperframes-<version>/skills`, update the names
in this file, and render a 6-second smoke test (a title, a music bed, a voice line) before
using it for real. If the Dockerfile recipe changes without a version change, bump only
the `-rN` suffix.

## Retained resources

Report these to the user at the end of a run:

- image `brag-tools:0.8.91-r3` (~3.7 GB) — reused by every run; remove with
  `docker rmi brag-tools:0.8.91-r3`.
- `~/.cache/brag/` (~5 MB of Hyperframes skills) — remove with `rm -rf ~/.cache/brag`.
- build cache from the image build — `docker builder prune` (affects all build cache, so
  check first).
