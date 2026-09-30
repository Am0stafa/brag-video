# Step 4: Review, render, deliver

All commands are the `docker run` forms from runtime-docker.md. `<skill-dir>` is this
skill's folder and `$OUT` the absolute output folder; write both out in full.

## 1. The gate: check

```bash
docker run --rm --shm-size=2g -v "$OUT":/work -w /work/composition brag-tools:0.8.91-r3 hyperframes check
```

Fix everything it reports; the table "Common check failures" in step-3-compose.md covers
the usual causes. For a long report, save it with `--json` and read it through
`check_summary.py` (runtime-docker.md), which groups the findings by kind and moment and
says when the check cut its list short. Contrast failures come with a compliant color to
use. Two limits:

- `check` measures contrast only on hex and `rgb()` colors. If its contrast line says
  `0/0` or far fewer checks than there are text elements, the composition still uses
  `oklch()`/`lab()` colors: convert them (`css_colors.py`) and run it again.
- It audits structure, not looks. The next step does the looking.

## 2. Look at it: event-time contact sheets

In real runs `check` passed while captions overlapped, a card jumped in size, a logo
landed tilted, a wipe showed plain background frames, and a button had the wrong font.
Snapshots at the right moments caught all of them. Take them at every storyboard event:
each scene's settled state, the middle of each transition, each count-up's end, each
click, and the final lockup.

```bash
docker run --rm --shm-size=2g -v "$OUT":/work -w /work/composition brag-tools:0.8.91-r3 hyperframes snapshot --at 1.2,3.5,5.9,8.3,8.55 --no-end
```

Look at the contact sheet: `composition/snapshots/contact-sheet.jpg`, or
`contact-sheet-1.jpg … -N.jpg` for many frames. Then look at single frames only where
something looks wrong. Every snapshot run empties the folder, so copy a sheet into
`review/` if you want to keep it. A frame that is plain white except for emoji is a
snapshot glitch: re-take it in a small batch, or check that moment in the render. Fix,
re-check, re-snapshot the fixed moments, and delete `composition/snapshots/` before
rendering.

## 3. Share copy and credits

Write them now; the privacy scan reads them.

`share-copy.txt`: one to three sentences, postable as-is, in the audience's register.
Write one caption, not variants.

- By tone:
  - `launch` (default): two or three of the video's own statements, as short lines,
    then the name: "Find the horse that fits. / Your rides stay private. /
    Horse Tinder, now available." (For a team audience, end with "Shipped in #42.")
  - `polished`: "Introducing [name]: [its own one-liner]."
  - `ai-demo`: "[name] [does X], and shows its work."
  - `app-store`: "[name] is live. [feature], [feature], and [feature]."
  - `cinematic`: "[name]. [tagline]."
  - `default`: "Made [name]. It [what it does, in its own words]."
- Team (feature brag, before and after, `changelog`):

```
[What a person can now do, in plain words]. [The old friction, in one clause — optional].
Shipped in #42.   (or: #42 · in review)
```

`credits.md` lists every asset that isn't original and isn't from the project, with its
licence. That covers bundled music and effects (and the fact that the skill doesn't
document the bundled music's licence), downloaded recordings with their source page and
credit line, and fonts. List composed music and generated effects as original.

## 4. Privacy scan

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/scan_text.py --terms privacy-terms.txt composition brag-plan.md composition-brief.md share-copy.txt credits.md
```

- **FAIL** lines are private text from the project that the user didn't ask for. Replace
  it with a fictional stand-in, then scan again. Terms match as whole words, so a
  customer called "Tines" is not found inside "routines".
- **WARN** lines look like emails, IPs or keys. Confirm each is fake or requested.
  Numbers from icon paths ("7.178.07.207") and version strings are no longer reported as
  addresses.
- **requested** items are allowed; say nothing about them.

## 5. Render

```bash
docker run --rm --name brag-render-<subject> --shm-size=4g -v "$OUT":/work -w /work/composition brag-tools:0.8.91-r3 hyperframes render --quality delivery --fps 30 --output ../brag.mp4
```

Then review the real render, not only the composition: one contact sheet over the whole
video, and one at the storyboard events.

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/contact_sheet.py --video brag.mp4 --every 3 --out review/overview.png
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/contact_sheet.py --video brag.mp4 --at 1.2,8.3,12.4 --out review/events.png
```

## 6. Measure the sound

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/audio_report.py brag.mp4 --sections 0-4,4-10,10-26,26-30
```

Use the storyboard's sections, and read the flags:

- Loudness far from −14 LUFS is fixed in the next step.
- A true peak above −1 dBTP, a silent section, or one section much louder than the rest
  means going back to the volumes or the music.
- "Almost all bass" is expected on a short opening hook, whatever the style. On any other
  section, lower the music's low end or change its style.
- With a voice over, the voice lines must be clearly the loudest thing. If the music
  competes, dip it further under the lines (audio.md).

## 7. Poster and finalize

Pick the poster, the frame shown before the video plays. It must be a **settled** frame
(text fully in, nothing mid-transition) that works on its own and names the product:

- product demo → a frame that names the product: the title card or the logo lockup (in
  `launch`, the settled lockup: the product's icon beside its name), or a settled UI frame
  with the name visible;
- feature brag → the *after* state with the feature's name (a frozen "before" is a
  screenshot of the bug);
- before and after → the side-by-side frame.

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/finalize.py --video brag.mp4 --poster-at 8.3 --loudnorm -14
```

It writes `brag.jpg` and bakes it in as frame 0 (every platform's thumbnail), with the
video's colour matrix named in every conversion, so brand colours don't shift. It
normalises the loudness to −14 LUFS with the true peak at or below −1 dBTP, and says how:
**linear** (one plain gain; dynamics untouched) or **linear gain + peak limiter** (the
gain would have pushed brief peaks past −1 dBTP, so only those peaks were shaved; short
hits keep their punch). It checks everything: the same frame count and
duration, audio present, frame 0 matching the poster, and a middle frame unchanged. If
any check fails, it keeps the original and says why. Don't work around a failed check by
moving files by hand; fix the cause and run it again.

**Then check the typing on the final file** (whenever there is a typing track). The
loudness step is where short hits get lost, so this runs on the finalized `brag.mp4`:

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/audio_report.py brag.mp4 --hits tools/typing-placed.json
```

A typical hit's onset should rank at or above the 85th percentile of the whole file (90+
is clear; in tests the music alone at the same moments ranks about 60–80), land within
20 ms, and not make the mix jump more than 15 dB. Buried hits: raise `--duck-db` (up to
6) or `--above`, or keep the music one energy step lower under the statements; then
rebuild the typing, render and finalize again.

## 8. The output folder

```
<output-dir>/
  brag.mp4               the video, poster as frame 0, −14 LUFS
  brag.jpg               the poster
  brag-plan.md           rubric, visual identity, plan, storyboard, claims list
  composition-brief.md   the Hyperframes brief
  change-context.md      feature / before-and-after only
  privacy-terms.txt      deny / allow terms
  credits.md             third-party assets and licences
  share-copy.txt         the caption
  composition/           the Hyperframes project
  tools/                 score plans, cue files, voice-over scripts, logo rig, launch events,
                         typing hits, sfx.json, check.json
  review/                contact sheets
  versions/              earlier versions (revision mode)
```

The folder is often over 100 MB. In a Git repo it is kept out of Git by the local exclude
line from SKILL.md, "Output folder"; mention that in the delivery message.

## 9. Revision mode

When the prompt changes an existing video, work in its folder. First move the current
`brag.mp4`, `brag.jpg`, `brag-plan.md`, `composition-brief.md` and `composition/index.html`
into `versions/v<N>/`. Add a "Changes in v<N+1>" section to the plan saying what changed
and why, and re-run steps 3–4 for what changed. Keep the claims list and the privacy
terms up to date.

## 10. Tell the user

- where the video is, and the command to watch it: `open <output-dir>/brag.mp4`;
- one sentence on what it does creatively;
- what it claims; for a change, the PR and its state;
- that everything on the coverage list is in the video, with the scenes that hold the
  prompt's own requests;
- the motion added without being asked (the plan's `## Motion found`), in one line, so
  they know it was a choice and can switch any of it off;
- that the audio was checked by measurement, not by ear;
- the retained resources (the Docker image and `~/.cache/brag/`), and, in a Git repo,
  that `brag-output*/` was added to its local exclude file (`.git/info/exclude`, never
  committed);
- for a PR: the `gh pr comment` command they can run, if they want it there. Never post
  it yourself.

Deliver one video. Don't render extra cuts or variants; suggest them instead.

### Try another version

End with 3–5 ideas for another version of **this** video, each with the sentence to
say. Choose them from what this video actually is; never a fixed list:

- **Where it will be posted:** landscape now → "make it vertical for Reels" (1080×1920),
  or square for a feed.
- **Another feel:** the tone that fits its audience next best, named by its phrase
  ("try it like an Apple keynote", "try it for the sprint review").
- **Sound:** no voice now → "add a voice over"; music only → "try it with a calmer
  track"; typing sound → "make the typing quieter".
- **Length and depth:** a full video now → "make a quick version" (27–47 s: the same
  features, the small ones in a quick run); a quick version now → "make the full version"
  (every feature in its own scene); a feature shown in a quick run → "give [feature] its
  own scene"; one feature with more to it → "go deeper on [feature]" (a second use, an
  edge case).
- **Look:** the other theme ("try the light version"), the brand colour as the lit word,
  the icon's ending (the lockup, or a fill into the brand colour), the logo's motion
  switched off or made bigger.

Write each as a question with its sentence ready to copy:

```text
Want another version?
- Vertical for Reels? Say: "make it vertical for Reels"
- Calmer, like a keynote? Say: "try it like an Apple keynote"
- With a narrator? Say: "add a voice over"
```

### Noticed in the product (only when real)

While rebuilding the product, you read its UI closely. If you saw real problems (a toast
clipped by its container, a label that overflows, text that fails contrast, a typo, a
broken empty state), list them briefly with their file, as changes the user may want to
make to the product. Never invent any; leave the section out when there is nothing.
