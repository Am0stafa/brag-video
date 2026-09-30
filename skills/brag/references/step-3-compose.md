# Step 3: Compose

Write the brief, prepare the audio, and build the composition with the Hyperframes
domain skills. /brag owns the story, the laws, the copy and the audio choices; the
Hyperframes skills own the composition structure, animation mechanics and rendering.
Every command runs in Docker (runtime-docker.md).

## 1. Read the Hyperframes skills

Read these files from the exported cache, `~/.cache/brag/hyperframes-0.8.91/skills/`, not
whole folders (the folders hold about 250 files):

- `hyperframes-core/SKILL.md`, and in its `references/`: `data-attributes.md`,
  `tracks-and-clips.md`, `determinism-rules.md`; for music fades, the "Volume fades /
  ducking" part of `creator-editing-recipes.md`;
- `hyperframes-cli/SKILL.md` (lint, check, snapshot, render);
- `hyperframes-animation/SKILL.md` and `hyperframes-keyframes/SKILL.md` (seek-safe motion);
- `hyperframes-audio/SKILL.md` only when there is a voice over;
- `hyperframes-creative` only for a technique you need (its audio-reactive recipe, a
  specific effect).

Skip the block catalogues and the registry search, and the design guides the Hyperframes
skills call mandatory (`house-style.md`, `video-composition.md`, the catalogue-first
rule): /brag's tones, launch-style.md and the product's own look replace them. Wherever
they say `npx hyperframes …`, use the `docker run` form from runtime-docker.md.

Don't enter the `hyperframes` intent interview, and don't route into its
`product-launch-video` or `pr-to-video` workflows. Those would replace this skill's laws
and story with their own.

### Where the Hyperframes skills disagree with /brag

| Hyperframes says | In /brag |
|---|---|
| render only after the user approves | The user's request is the approval. Render when check and the review pass; don't stop to ask. |
| send `hyperframes feedback` after a render | Don't. Telemetry is off in the image, and nothing is sent outward. |
| no exit animations; the transition is the exit | Follow it. |
| hyperframes-core: build after `document.fonts.ready`; hyperframes-animation and -keyframes: don't build the timeline inside a promise | Build once, after `document.fonts.ready`, then register it. The launch engine measures text with the real font, so it must wait for fonts; this works in every render. Don't add tweens later or piecemeal. |
| `house-style.md`, `video-composition.md` and the catalogue search are "not optional" | Skip them: /brag's tone, launch-style.md and the product's own look decide the design. |
| an audio "carve" is required under a voice, via `npm i -D @hyperframes/core` | Not needed. Use the `minimal` music style (it has a gap where speech sits) and dip the music under each line (audio.md). Nothing gets installed. |
| run `npx hyperframes …` / `npm run check` | Use the `docker run` forms in runtime-docker.md. |

## 2. Write composition-brief.md

```markdown
# Composition brief: [product or feature]

## Output
- Composition: `<output-dir>/composition/`   Video: `<output-dir>/brag.mp4`
- Format: [1920×1080 / 1080×1920 / 1080×1080], 30 fps   Duration: [s]

## Video
- Type: [product demo / feature brag / before and after]   Tone: [preset + the prompt's words]
- Angle: [from the plan]
- Must-haves from the prompt: [list]
- Coverage: the plan's `## Coverage` (every item and the scene that shows it)

## Source material
- Project: [repo or folder name, paths relative to it; never an absolute path]   Files read: [list]
- Product name / tagline / hook claim: [...]
- Copy that must appear verbatim: [lines]
- Change (feature / before-after only): `change-context.md`; before to recreate: [...];
  after to recreate: [...]; the cut: [which moment]; real strings from the diff: [...];
  must not claim: [...]

## Visual identity
- Colors: [hex values]   Fonts: [families, local files]   Logo: [file, rig or not]
- Product's mark (`launch`): [the bare logo in its own colours, or the brand orb when there is none; the brand colour for its glow; the name; the logo motion it plays]

## Storyboard
Use `brag-plan.md` as the contract. Scene summary:
1. [scene] — [start–end] — [what must be seen and read]

## Audio
- Voice over: [files and start times, or none]
- Music: [file, cue file, volume lane]
- Sound effects: [chosen after the animation exists; moments listed in the plan]
- Audio-reactive: [subtle / none; what breathes with the music]
```

The brief is the boundary. Product positioning, copy, tone, source material and the
coverage belong to /brag. Composition structure and animation mechanics belong
to Hyperframes.

## 3. Prepare the audio

Follow audio.md, in this order, because each step sets the timing for the next:

1. **Voice over** (only if the prompt asked): already generated in step 2. Regenerate a
   line only if its text changed, then re-fit that scene.
2. **With `launch`: the statements before the music.** Build the statements and
   transitions on the plan's beat grid (its `bpm` is all they need), run the reading-time
   check, and fix every short statement ("Lock the timing first", below). Fixing one moves
   the scenes after it, and in one run that meant composing the music twice, with every
   section time changed.
3. **Music**: a bundled track that fits, or a score composed to the scene map (for
   `launch`, to the locked times), with its cue file.
4. **Sound effects**: choose after the animation exists, so they land on real motion.
   Bundled first; generated or sourced when nothing fits. `sfx_tags.py` writes their
   `<audio>` tags (audio.md, "Placing sound in the composition").
5. Copy everything into `composition/assets/`, and record every third-party file in
   `credits.md` (step 4).

## 4. Build the composition

Copy the blank composition out of the image (runtime-docker.md), then build
`composition/index.html`. With the default `launch` tone, also copy
`<skill-dir>/assets/launch/launch-text.js`, `launch-motion.js`, `launch-ui.js` and
`launch.css` into `composition/assets/launch/`, link them in `<head>` (the three scripts in
that order), set the app's theme with `LaunchText.theme(...)` (step 1's light or dark
colours), build every statement with `LaunchText.statement(...)`, join scenes with
`LaunchMotion.reveal / warp / focus / camera`, and animate the product screens with
`LaunchUI` (below), as in `assets/launch/example.html` and launch-style.md, "Build it".
Then:

- **Local assets only**: GSAP is already in `assets/vendor/gsap.min.js`; put the product's
  fonts in `assets/fonts/` (the project's files, or `fetch_fonts.py`), logos and audio in
  `assets/`. A render must not depend on the network.
- **Hex colors.** Use the hex values from the plan, not `oklch()` or `lab()`, so
  `check` measures contrast.
- **Rebuild the product's UI in HTML** from its real tokens and markup, at video scale
  (body text 21–27 px, labels 15 px or more) and with the fake data from the plan.
  **For a desktop app or console, lay it out at its real size and let the camera scale
  it:** build the screen at 1280×720 CSS px with the product's own sizes (its 14 px body
  text, its 240 px sidebar), and show it through `LaunchMotion.camera` at zoom 1.5, which
  fills a 1920×1080 frame; 14 px text then reads as 21 px. The real proportions stay
  (nothing is rescaled by hand, so the layout is the product's), deeper zooms onto a
  field stay sharp, and clicks and cursors use the same 1280×720 coordinates. Mark the
  screen `data-layout-allow-overflow`.
- **One paused timeline** registered on `window.__timelines`, built after
  `document.fonts.ready`. Deterministic only: no `Date.now()`, no `Math.random()`
  (use a seeded generator), no fetches.
- **Text over busy images** (a photo, a map) gets a soft gradient shade behind it, only
  as large as the text needs.
- **A push-in toward something off-center** sets `transform-origin` to that point's
  coordinates; the default zoom recipes only center the target.

### Lock the timing first (`launch`)

As soon as the statements and transitions exist, before any music, check that every
statement can be read (step-2-plan.md, "Reading time": about 0.3 s a word counted from the
first word, and at least 1.2 s after the last word lands):

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 node /skill/launch_events.cjs composition/index.html
```

It prints one row per statement: when it starts, when its last word lands, when it is gone
(its exit, the next statement on its stage, or the transition that takes its stage away),
its words, and `ok` or `SHORT 0.30 s`. Fix every short one (start it earlier, type it
faster with `step`, or leave later with `hold` or `until`, or move the transition), and
run it again until every row says `ok`. Then the times are locked: write the music plan's
sections from them, and compose once. A statement the engine's own check finds under 0.8 s
is printed as a warning too.

### Animate the product screens (`launch-ui.js`)

The statements have their engine; the rebuilt product screens between them have
`LaunchUI`, the helpers real runs kept writing by hand. Most check-and-fix rounds in one
run were UI animation bugs these helpers now prevent:

| Helper | What it does | The bug it prevents |
|---|---|---|
| `U.clock(tl, fn)` with `U.typed`, `U.count`, `U.caret` | calls `fn(t)` on every frame, from the video's start to its end; typed text and counters are computed from `t` alone | stale text on frames drawn out of order |
| `U.show / hide / pop / swap / fromTo(tl, el, t)` | appearances; only an element's earliest animation sets its starting look, whatever order they were written in; `swap` never shows both states at once | a dialog visible from the first frame; two labels overlapping mid-swap |
| `U.quiet(tl, page, t0, t1)` | leaves the page behind an open dialog or drawer out of the layout audit while it is open (its sidebar, header and content; not the dialog) | every label under a dim backdrop reported as "text hidden beneath an opaque element" |
| `U.cursor(tl, ui, keys)` | an arrow that glides, clicks (a ring and a dip) and hides; targets are elements, measured from the layout | cursor positions guessed by hand, and wrong |
| `U.point(el, ui)` | a point inside an element in the UI's own coordinates, so camera zooms can't move it | click targets broken by a zoom |
| `U.tap(tl, screen, el, t)` | a finger tap on a phone screen | a tap marker without `left`/`top`, sitting at the screen's bottom |
| `U.ellipsis(ui)` | cuts every label the product cuts with "…" (CSS `text-overflow: ellipsis`, line clamps) at build time | long titles failing the overlap check (the audit measures the full text) |
| `U.sample(scene)` | the "Sample data" label, pinned to the frame, outside the camera | a label that zooms and slides with the UI |
| `U.wall(tl, wallEl, {at, pan})` | the screen wall (launch-style.md): a camera glide over every screen's real title, then a pull-back | covering 30+ screens honestly in a few seconds |
| `U.keys(at, text, cps)` | logs key sounds for typing inside the UI: every second character, at least 90 ms apart | hits 36 ms apart that buzz |

Call `U.ellipsis(ui)` first in `build()`, before anything measures a point. Clicks, taps and
keys are logged in the event log, so `sfx_tags.py` places their sounds (audio.md). The
header of `launch-ui.js` documents every option.

### Common check failures, and the fix

Seen in real runs; fixing them before the first `check` saves rounds. Read the report with
`check_summary.py` (runtime-docker.md) rather than the raw JSON: it groups the findings by
kind, severity and moment, and labels the moments inside a scene transition.

| `check` says | Usually because | Fix |
|---|---|---|
| `X2 is not a function`, or `Cannot access 'X2' before initialization`: a name you never wrote | a local variable in `build()` has the name of a global helper `X`; Hyperframes renames one of the two when it prepares the page | rename the local variable |
| `content_overlap` on a label the product cuts with "…" | the audit measures the label's whole text, not the part the browser paints | cut it when the page is built: `LaunchUI.ellipsis(ui)` |
| text from a hidden scene still showing in a later scene (seen in a snapshot) | a child set to `visibility: visible` overrides its hidden parent | use `visibility: inherit` (GSAP's `autoAlpha`, the engine and `LaunchUI` do) |
| nothing, but a snapshot shows an element in the wrong place | an absolutely positioned element without `top` and `left` sits wherever the page flow puts it (a phone's tap marker sat at the bottom of its screen) | give it `left: 0; top: 0` and move it with `x` and `y`; only a snapshot catches this |
| `content_overlap`, `text_occluded` or `container_overflow` during a focus pull, app open, circle reveal or warp | a composition with an older copy of the engine, from before transitions left their scenes out of the audit | copy the current `launch-motion.js` from the skill |
| `content_overlap` between two states of one element ("Testing…" and "Connected") | the old state fades out while the new one fades in, in the same spot | `LaunchUI.swap`, which shows them one after the other |
| `text_occluded` for the page's labels while a dialog or drawer is open | a dim backdrop 60% opaque or more (or an opaque drawer) covers the page's text, which is its job; `data-layout-ignore` on the backdrop doesn't help, because the audit judges the covered text, not what covers it | `LaunchUI.quiet(tl, page, openAt, closedAt)` on the page's sidebar, header and content for the time it is covered (not on the dialog, which stays audited) |
| `content_overlap` / `text_occluded` from an earlier scene | an earlier scene is still painted under a later one | give each scene a clip window that ends at its cut, or hide finished layers at the cut (`autoAlpha: 0`) |
| text "occluded" by a vignette, grain or scrim | a full-frame decorative layer counts as covering text | keep overlays narrow, mark them `data-layout-ignore`, or move them to the root background |
| overlap from a hidden row | `height: 0; overflow: hidden` still has a box | hide it with `autoAlpha: 0` until it opens |
| clipped text | a `line-height` under 1.0 | use 1.05 or more |
| a label covered by a card | the product's own layout at video scale | move the label; say so in the plan if it changes the product's look |
| "Timeline did not advance" | nothing animates yet (the blank template) | expected until the first tween exists |
| an element "escapes its container" | a camera push-in or a card flying in moves it past its parent | mark the moving element `data-layout-allow-overflow` |
| duplicate `<img>` of one file | the same picture repeated (two phones showing one screenshot) | use a CSS `background-image` for the extra copies |
| "font families used without @font-face" | fonts linked from a separate stylesheet | paste the `@font-face` rules into the composition's `<style>` |
| `nested_structure_needs_subcomposition` (a warning) | scenes nested inside one timed `.clip` wrapper | put the scenes directly under the root as plain layers (the launch engine shows and hides them), or give each its own clip |
| a font "fetched from Google Fonts" during `check` | a family in a font stack that isn't embedded (a fallback like "Inter") | drop it from the stack, or embed it; renders must not need the network |
| `font_family_without_font_face` | a family named anywhere without an `@font-face` in the composition, even as a fallback | embed it, or remove the name; for `launch`, set `--lt-font` to the embedded family |
| `composition_file_too_large` (a warning) | a whole video in one `index.html`, normal for `launch` compositions | fine to leave; split into sub-compositions only if the file becomes hard to edit |
| `launch_events.cjs` says the timeline never registered | a script error before `window.__timelines["main"] = tl` (it prints the error) | fix the error it shows; start the script with `window.__timelines = window.__timelines || {};` as the example does |

### Motion that stays correct in every frame

These came from real renders, where frames are captured out of order and in parallel:

- For complex motion (a character on a path, a count-up, a typed prompt), drive
  everything from **one proxy tween** whose `onUpdate` computes the state from the time
  alone. Then any frame renders the same no matter which frame came before it. For product
  screens, `LaunchUI.clock` is that tween, running from the video's start to its end.
- A tween's look before it starts is its `from` look once the renderer has passed it and
  seeked back. So the `from` of every appearance must be the element's real look just
  before it, and only its earliest animation may set its look at build time: that is what
  `LaunchUI.show / hide / pop` do. A flash that starts from nothing (a click ring) is a
  `set` and then a `to`, not a `fromTo`.
- When an oscillation changes speed (wings, a pulse), add up its phase over time in a
  table. `sin(2π·f(t)·t)` jumps whenever `f` changes.
- Never put text inside an element that gets mirrored (`scaleX(-1)`). Carry the text in
  a separate element that follows it.
- Repeated `fromTo` tweens on the same element need `immediateRender: false` on the later
  ones, or the later start state overwrites the earlier scene.
- Settle every tilt and wobble to zero before a lockup, so the logo lands straight.

### Build the motion you found

Every row of the plan's `## Motion found` gets built, without asking first
(motion-opportunities.md): the logo's natural move, count-ups, charts that draw, rows that
arrive, scans that fill in, cursor clicks. Use one proxy tween per complex motion (below),
land the beats on the music, and give each its sound from the plan. Only the prompt or the
brand's own rules (a guideline that forbids moving the logo) keep a found motion still;
write which one in the plan. In `launch`, the logo's motion also plays on the product's
icon as it lands: tween the statement's `glyph` from its `markAt`.

### Animating a logo (the rig)

A logo that moves must still be exactly the brand's logo when it rests.

- **SVG:** animate its groups directly.
- **Raster (PNG):** cut it into parts with a small Python script run in the image. Mask
  the parts by color and connected regions, grow each mask a few pixels so the
  anti-aliased edges come along, and never let two parts claim the same pixel. Save
  each part cropped with its position and pivot in `pieces.json`, then prove the result:

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/verify_rig.py --original tools/logo/logo.png --pieces tools/logo/pieces.json --dir composition/assets/brand/parts
```

It must report 0 uncovered, 0 overlapping, 0 difference. Keep the cutting script in
`tools/logo/`. The logo must never be recolored or distorted at rest. Mirroring it during
motion (a bird flying back toward the viewer) is fine; flag it in the plan, because some
brand rules forbid it.

## 5. Beat sync

Get the cues from the right source:

- **Composed music:** the cue file written by `compose_score.py`. It is exact, so every
  section start and hit is a strong cue.
- **Bundled music:** `<skill-dir>/assets/music/cues/<track>.music-cues.json` (the `.md`
  summary covers only the first 25 s; read the JSON for longer videos).
- **Any other track:** `hyperframes beats .` in the composition folder. It is approximate:
  treat its strongest beats as candidates and check them against the music report.

How to use them:

- **Major moments** (scene cuts, the hero reveal, the before → after switch, the logo)
  go on strong cues, within ±0.15 s. Mark them `// beat-locked: 10.0s`.
- **Sequential items** (cards, rows, chapter steps) snap to consecutive beats, within
  ±0.10 s. Mark them `// beat-grid: 12.5, 13.0, 13.5`. For readable text, use every other
  beat (step-2-plan.md).
- **With `launch`, give the engine the beats** before the statements:
  `LaunchText.music({ bpm: 124 })` for a composed score (its plan's `bpm`, first beat at 0),
  or `LaunchText.music({ bpm: cues.tempo, beats: cues.beats.map((b) => b.time) })` for a
  bundled or detected track (paste the times from the cue file; the composition can't
  read files). The brand orb then breathes on the beat, and `LaunchText.nextBeat(t)` gives
  the first beat at or after `t` for locking cuts.
- Readability and the story come first; ignore a cue that hurts them.

## 6. The typing sound (`launch`)

Make it once the timeline is final (every statement's time settled, the reading-time
table all `ok`), because it follows the typing exactly. First save the engine's event log
from the composition, then build the track against the music:

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 node /skill/launch_events.cjs composition/index.html tools/launch-events.json
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/typing_track.py tools/launch-events.json --out composition/assets/sfx/typing.wav --music composition/assets/music/score.wav --music-volume 0.45 --duck-music composition/assets/music/score-ducked.wav --placed tools/typing-placed.json
```

The first prints the reading-time table again, how many words, pieces, letters,
transitions, clicks and UI keys it found, and any engine warning (a colour that needed a
big contrast shift, a statement too long for two lines). The second prints how many hits
it placed and how many fast letters it thinned. It also
writes the music with a short 4 dB dip under every hit (`--duck-music`): the standard way
to let a short sound through a full mix without making it louder. Its hits are capped so
the final loudness step keeps them intact. Play the ducked music in place of the original,
at the same volume, and the typing on its own track at 1.0:

```html
<audio id="music" src="assets/music/score-ducked.wav" data-start="0" data-duration="<video length>" data-track-index="10" data-volume="0.45"></audio>
<audio id="typing" src="assets/sfx/typing.wav" data-start="0" data-duration="<video length>" data-track-index="11" data-volume="1"></audio>
```

With a voice over add `--under-voice`; with a bundled track pass it as `--music` with the
volume it plays at. Changing a statement's time means running both commands again. Step 4
checks the hits on the finalized video with `audio_report.py --hits tools/typing-placed.json`.

The same event log holds the cursor's clicks, the taps and the UI typing keys that
`launch-ui.js` logged. Write `tools/sfx.json` (which sound for each kind, and any sound at
a fixed time) and let `sfx_tags.py` write the tags between the `<!-- sfx:begin -->` and
`<!-- sfx:end -->` lines (audio.md, "Placing sound in the composition"):

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/sfx_tags.py tools/sfx.json --events tools/launch-events.json --into composition/index.html
```

## 7. Audio-reactive background (optional)

Optional, and off for `launch` (its canvas stays flat). For other tones, when a scene
feels static, one existing element may breathe with the music: the background glow, a
light wash, the card's presence. Never use waveform or equalizer graphics, and drive it
from a proxy tween's time like every other motion here (not from per-frame `tl.call()`
callbacks). Extract the data in the image, compact it, and load it as a local script:

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 sh -c 'python3 /opt/hf-home/.agents/skills/hyperframes-creative/scripts/extract-audio-data.py composition/assets/music/score.wav --fps 30 --bands 16 -o tools/audio-data.json && python3 /skill/compact_audio_data.py tools/audio-data.json composition/assets/audio-data.js --fps 30 --duration <video length in seconds>'
```

## 8. Grounding factual claims

`hyperframes check` audits structure; it has no opinion on copy. A scene can read
"Ships 10× faster", a sentence nobody in the project wrote, and still pass. So read the
composition once with the claims list in hand:

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/scan_text.py --list-text composition/index.html
```

It prints the visible text, marking lines with numbers. Text set by script (a typed
prompt, a count-up target) isn't in the markup; check those strings in the script.

- **Must be grounded or requested:** names, numbers, capabilities, feature claims, quotes,
  anything presented as the product's own copy. Recased, trimmed or split across
  elements is fine; invented is not.
- **Free:** tone, framing, jokes, hooks, transitions and connective lines. They assert
  nothing about the product.
- **Requested:** anything the user explicitly asked for, even if the project doesn't have
  it. It stays exactly as asked.

When a line isn't grounded, quote what the project does say; it is almost always
stranger and better than the invented version.

## Self-review before step 4

- [ ] `composition-brief.md` exists and names every item to show and its scene.
- [ ] Every row of the plan's `## Coverage` is on screen in its scene: every feature,
      screen, result and request. Nothing was left out to save time.
- [ ] Every must-have from the prompt is in the composition.
- [ ] The composition shows the real product's UI, copy or flow (for a feature, both the
      before and the after, framed the same way).
- [ ] Every on-screen claim is grounded, requested or listed fake data.
- [ ] Every item of `## Motion found` is built (or kept still because the prompt or the
      brand's rules say so, noted in the plan).
- [ ] With `launch`: the statements use the app's theme; the theme has the product's
      mark (its bare logo in its own colours, with no tile unless the user asked for the app
      icon, or the brand orb when it has none; its brand colour; its name), and the logo
      plays its motion; there is no colour-cycling dot; the reading-time
      table was all `ok` before the music was composed; the typing track was made from the
      final timeline.
- [ ] Product screens are animated with `LaunchUI` (or follow its rules): `ellipsis` ran
      first, clocks run to the end of the video, every clicked or tapped target was
      measured, and a "Sample data" label, if the video has one, is `LaunchUI.sample`
      (pinned to the frame).
- [ ] Sound-effect tags come from `tools/sfx.json` through `sfx_tags.py`, not by hand.
- [ ] Assets are local; audio is wired (voice over, music with a volume lane, typing on
      its own track, effects on their own tracks).
- [ ] Major moments are beat-locked (or natural timing was chosen for readability).
- [ ] The duration matches the plan.
- [ ] `hyperframes check` passes with zero errors.
