---
name: brag
description: Make one polished video about a project, a feature, or a change — a product demo, a feature brag, or a before-and-after — built with Hyperframes and rendered entirely inside Docker. Use whenever someone says "/brag", "brag about", "make a demo video", "product demo", "feature video", "before and after video", "show what this PR changed", "make a video about this new functionality", or shares a pull request link and wants a video about it, even if they never say "brag". Everything comes from the prompt in plain words (video type, tone, length, format, voice over); there are no flags. Reads the code, the PR and the git history directly; no screenshots or live URL needed.
---

# /brag

You built it. Now show it off: one polished video, made from the project's own code, copy and look.

## What it makes

Read the prompt and pick one of three videos.

| Video | The prompt is about… | The story | Length |
|---|---|---|---|
| **Product demo** | the product as a whole: "a demo of the app", "show every feature", "walkthrough", "launch video" | hook → what it is → every feature in use → outro | usually 47–82 s; 82–117 s with many features |
| **Feature brag** | something new: a PR link, "this feature I added", "the new export", "brag about this change" | the problem → life before it → the feature as the answer, every use it adds → how the product got better | usually 42–82 s |
| **Before and after** | an improvement to something that already existed: "before and after", "the redesign", "it's faster now", "old vs new" | the old state → the switch → the new state → side by side, for every place it changed | usually 32–62 s |

Full shapes, timings and what to show: [references/video-types.md](references/video-types.md). A length or format stated in the prompt always wins.

**Cover everything.** The video shows everything you found and everything the user asked for: every feature, screen, flow step and result of the product, or every behaviour, surface and proof of the change. Never leave anything out to make a video shorter: not in the quick version, and not at a length the user sets. When time is short, show more in each scene (related features grouped in one scene, the small ones in a quick run of 1–2 s beats), never less. The plan's coverage list maps every item to the scene that shows it.

**Length: the full video is the default.** List everything first and let the length follow, up to **117 s** at most: more scenes at the same pace, never slower ones. When the prompt says it doesn't need to be long ("quick", "a quick demo", "quick version", "short", "teaser"), make the **quick version**: 27–47 s (before and after 22–32 s), with the key flow shown in full and every other feature in a quick run.

Make exactly **one** video per request. No extra cuts, variants or second versions unless the prompt asks for them; suggest them at the end instead (step 4, "Try another version").

It works for any product with a codebase: a consumer app, a dashboard, a developer tool, an attack surface manager, a shop. Everything specific (words, colours, logo, data, motion) comes from the project in front of you.

## Read the prompt — there are no flags

Everything is plain words. Take these from the prompt; when something isn't said, use the default and write the choice into the plan.

| What | Listen for | Default |
|---|---|---|
| Video type | see the table above | product demo; feature brag when a PR, branch or "feature I added" is mentioned |
| Subject | the project in the working directory, a PR link or number, a branch, commits, "this feature", a folder | the current project |
| Voice over | "voice over", "voiceover", "narration", "narrate", "narrator", "with a voice", "explain it out loud" | **none** — music and sound effects carry the video |
| Voice | "male / female voice", "British", a language | `af_heart` (see audio.md for the list) |
| Music | "no music", "silent", a mood ("calm", "epic", "techy"), a track file | on: a bundled track when it truly fits the mood, otherwise original music composed for this video |
| Sound effects | "no sound effects", "no typing sound" | on: bundled first; generated or sourced when nothing fits; with `launch`, a deep key sound on every typed piece |
| Tone | "OpenAI-style", "Apple keynote", "playful", "serious", "like a trailer", "for the sprint review" | `launch`: typed statements, one lit word, the film's transitions (see Tones) |
| Theme | "dark", "light", "on white", "in our brand colours" | the app's own: its background, text and brand colour, light or dark |
| Background | "flat background", "plain background", "no moving background", "with a grid", "soft glows" | a slow living backdrop behind the statements, drawn from the app's colours: glossy slats on a dark theme, soft brand glows on a light one (launch-style.md, "The backdrop") |
| Motion | "keep the logo still", "no animation on the charts" | everything that naturally moves is animated without asking: a bird's wings, a radar's sweep, counts, charts, scans (references/motion-opportunities.md) |
| Length | "30 seconds", "under a minute", "full"; "quick", "a quick demo", "quick version", "short" | the full video: everything, at most 117 s; the quick words → the quick version, 27–47 s, still everything |
| Format | "vertical", "for Reels / TikTok / Shorts" → 1080×1920; "square" → 1080×1080 | landscape 1920×1080, 30 fps |
| Audience | "for the team", "for the PR", "for LinkedIn / X", "for customers" | team for feature and before/after; public for product demo |
| Data | "fake data", "sample data", "use the real numbers" | fictional stand-ins for any customer or personal data |
| Anything specific | "show the settings page", "mention Jira", "1,200 orders today", "use our tagline" | — |

**The user's requests are the brief.** Anything the prompt explicitly asks for goes in, even when the code doesn't have it yet (a concept screen, an invented number, a real name). Mark it *requested* in the plan's claims list and move on; don't argue with it or warn about it. The checks in this skill exist to catch what *you* invented or leaked without being asked.

Ask a question only when the subject can't be found at all (no project, no PR, nothing to read). Everything else has a default.

## Everything runs in Docker

Nothing gets installed on the host, and no downloaded or generated code runs on the host. Every tool this skill uses lives in one image, `brag-tools:0.8.91-r3`: the Hyperframes CLI, Chrome for rendering, FFmpeg, Python for the music, sound and review scripts, the Kokoro voice, GSAP, and blank compositions to start from. On the host you run only `docker`, `git`, `gh` (PR details, using the host's GitHub login), `curl` to download public assets, `open` to show the result, and ordinary file and inspection tools (`ls`, `cp`, `mkdir`, `grep`…). Never run an interpreter (`python3`, `node`, `npx`, `npm`) or a script on the host. Helper agents you start follow the same rule: brief them with the read-only template in [references/step-1-inspect.md](references/step-1-inspect.md), because helpers left to themselves have run `python` on the host.

Read [references/runtime-docker.md](references/runtime-docker.md) before the first command: it has the preflight and the exact `docker run` form for every task, plus the known traps.

**Gate (preflight):** Docker is running, the image exists (build it from `docker/Dockerfile` if not), and the Hyperframes skills are exported to `~/.cache/brag/hyperframes-0.8.91/skills/`. If Docker isn't running, ask the user to start Docker Desktop; that is the one blocking question.

## Workflow

### Step 0 — Gather the change (feature brag and before/after only)

**Read:** [references/change-source.md](references/change-source.md)

Work out from the prompt where the change lives (a PR, a branch, commits, uncommitted work), read the changed files at the *before* and *after* points without touching the user's working tree, and find the problem it solves.

**Gate:** `<output-dir>/change-context.md` states the problem, the before, the after, everything the change does (the coverage list), and what the video must not claim.

### Step 1 — Inspect

**Read:** [references/step-1-inspect.md](references/step-1-inspect.md)

The whole product for a demo; the change and its surroundings for the other two. Exact colors, fonts and logo (in `launch` it becomes the product's mark, shown bare, never on a tile unless asked), whether the app is light or dark, the product's real copy, every feature and user flow (the coverage list), everything that could move (the logo, icons, numbers, charts, scans), and a list of private terms.

**Gate:** the rubric is answered; the coverage list, the theme and the motion candidates are recorded; and `<output-dir>/privacy-terms.txt` exists.

### Step 2 — Plan

**Read:** [references/step-2-plan.md](references/step-2-plan.md), [references/video-types.md](references/video-types.md), [references/motion-opportunities.md](references/motion-opportunities.md), and with the default `launch` tone [references/launch-style.md](references/launch-style.md) (its words, pacing, transitions and story shapes drive the storyboard)

Write `<output-dir>/brag-plan.md`: the angle, the coverage list, the storyboard timed on a beat grid, the motion found (built by default, never asked about), the audio decision, and the claims list.

**Gate:** the plan exists; every row of its coverage list (everything found and everything asked for) has a scene; the length is at most 117 s (the quick version 27–47 s, or the prompt's length); and every claim on screen has a source or is marked requested.

### Step 3 — Compose

**Read:** the Hyperframes domain skills from the exported cache — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`, and `hyperframes-audio` when there is a voice over. Then [references/step-3-compose.md](references/step-3-compose.md) and [references/audio.md](references/audio.md).

Write `composition-brief.md`, prepare the audio (voice over first, because it sets the timing; then music and sound effects), and build `<output-dir>/composition/`, including every motion found in the plan ([references/motion-opportunities.md](references/motion-opportunities.md)). With the default `launch` tone, read [references/launch-style.md](references/launch-style.md), and work in this order, so the music is composed once, to final times:

1. set the app's theme (with its backdrop and its bare logo), and build the statements and scene transitions with the engine in `assets/launch/`, on the plan's beat grid; for a product demo or a feature with several uses, lay out the showcase from `assets/launch/showcase.html` (one world, the product in its context, a titled feature tour, the recap, the end card);
2. check that every statement can be read: `launch_events.cjs` prints a reading-time table, and every row must say `ok`;
3. lock those times, then compose the music to them (or place the bundled track);
4. animate the product screens with `assets/launch/launch-ui.js` (scene clock, appearances, a stepping highlight, cursor, taps, "…" labels, the "Sample data" label, the screen wall) and the morphs and camera of `launch-motion.js`;
5. once the timeline is final, make the typing sound from the event log, and the other sound-effect tags with `sfx_tags.py`.

/brag is its own workflow: don't enter the `hyperframes` intent interview, and don't hand off to its `product-launch-video` or `pr-to-video` workflows. /brag owns the story, the laws and the copy; the Hyperframes domain skills own the implementation. Where they disagree with /brag (waiting for approval to render, sending feedback reports, audio carving), follow the list in step-3-compose.md.

**Gate:** `hyperframes check` passes with zero errors (read its `--json` report with `scripts/check_summary.py`, which groups the findings by type, severity and moment); with `launch`, every statement is `ok` in the reading-time table.

### Step 4 — Review, render, deliver

**Read:** [references/step-4-deliver.md](references/step-4-deliver.md)

Review a contact sheet of every event, scan for private text, render, measure the sound (and, with a typing track, that every hit is heard), bake the poster as frame 0 at −14 LUFS, write the share copy and the credits, then tell the user, ending with a few ideas for another version.

**Gate:** `brag.mp4` exists with the poster as frame 0 and loudness at −14 ±1 LUFS; with a typing track, `audio_report.py --hits` on the final file shows the hits are heard; `brag.jpg`, `share-copy.txt` and `credits.md` are written; the privacy scan has no unrequested hits.

## Output folder

- **New video:** `brag-output/` in the project root. If that exists, `brag-output-<subject>/` (for example `brag-output-pr-42/`, `brag-output-saved-filters/`); if that exists too, add `-YYYY-MM-DD-HHmmss`.
- **Keep it out of Git.** An output folder is often over 100 MB (the music and typing tracks are uncompressed WAV) and shows up as untracked inside the user's repo. When the project is a Git repo, add `brag-output*/` to its local exclude file, which Git reads but never commits, and leave `.gitignore` alone:

  ```bash
  if EX="$(git -C "$PROJECT" rev-parse --git-path info/exclude 2>/dev/null)"; then case "$EX" in /*) ;; *) EX="$PROJECT/$EX" ;; esac; mkdir -p "$(dirname "$EX")"; grep -qxF 'brag-output*/' "$EX" 2>/dev/null || echo 'brag-output*/' >> "$EX"; echo "brag-output*/ is excluded in $EX"; else echo "not a Git repo: nothing to exclude"; fi
  ```

  It finds the exclude file (in a linked worktree, that is the main repo's `.git/info/exclude`), adds the line only if it isn't there yet, and changes nothing outside a Git repo. Say in the delivery message that you added it.
- **Changing an existing video** ("change the music", "make the ending shorter", "update the video"): revision mode. Keep the same folder, move the current `brag.mp4`, `brag.jpg`, `brag-plan.md`, `composition-brief.md` and `composition/index.html` into `versions/v<N>/` first, and add a "Changes in v<N+1>" section to the plan.
- The folder holds everything needed to rebuild the video: plan, brief, change context, privacy terms, credits, the composition, and in `tools/` the inputs of anything generated (score plans, sound-effect commands).

## Creative laws

These apply to every video, whatever the type or tone.

**Hook first.** The first two seconds decide whether anyone keeps watching. Plan the hook before anything else; for a feature it is usually the problem, stated the way the person who hit it would say it.

**Show the real thing.** Rebuild the product's actual UI, copy and flow in HTML with its real colors and fonts, and show it *in use*: typing, clicking, results appearing. Show it in its context (a window, a browser, a laptop screen, a phone), the way its user meets it. Never fill a scene with abstract shapes or generic motion graphics.

**Alive by default.** Whatever naturally moves, moves, without being asked: the logo's wings beat, a radar's sweep turns, numbers count up, charts draw, a scan fills in as it finds things. Build it, list it in the plan, and name it when delivering, so the user can switch any of it off in one sentence.

**Readable.** Pace comes from motion and cuts, never from pulling text away early. A short label needs about 0.8 s fully on screen; a sentence about 0.3 s per word.

**Specific.** It must feel made for this exact project. Use its own words; generic SaaS lines ("streamline your workflow") are banned.

**Claims come from the project or the prompt.** Names, numbers, capabilities and quotes must be traceable to the code, the docs, the change, or the user's request. Tone, jokes, hooks and transitions are free. When a line isn't grounded, quote what the project does say; it is almost always better than the invented line.

**Private stays private unless asked.** No secrets, internal hosts or URLs, real customer or personal data on screen, unless the user explicitly asked for them.

**Sound serves the picture.** Music and effects land on the cuts and the actions; a voice over is always the loudest thing; the finished video sits at −14 LUFS.

**Cover everything.** Every feature, screen, result and request is on screen; a shorter video shows more per scene, never less.

**One continuous world.** No flat single-colour canvas and no hard cuts between product moments: a slow backdrop drawn from the app's colours sits under everything, and the camera, focus pulls and morphs carry every change.

**Every frame postable.** Any frozen frame should look good enough to post.

## Tones

Tones are vocabulary for pacing and style; the prompt picks one in words ("like an Apple keynote" → `polished`, "for the sprint review" → `changelog`, "like a movie trailer" → `cinematic`). Full definitions: [references/tones.md](references/tones.md).

| Tone | Feel | Good for |
|---|---|---|
| **`launch`** (default) | Statements that stream in like a model's answer, in the app's own theme, over a slow living backdrop; one lit word flickering through colour; a deep key sound on every typed piece; the product's bare logo coming into focus and opening scenes like an app; the product in its context, a feature tour with title cards, camera moves and morphs; a recap of every feature and an end card (or the logo beside the product's name) | every video, unless the prompt asks for another tone; "OpenAI-style" |
| `polished` | Serious, elegant, restrained | "like an Apple keynote", premium products |
| `ai-demo` | Dark, calm keynote; typed prompt → thinking → cited answer | "show it thinking", agent demos |
| `app-store` | Smooth feature cards | "clean feature cards" |
| `changelog` | Plain, benefit-first | "for the sprint review", team updates |
| `cinematic` | Trailer scale | "like a movie trailer" |
| `default` | Playful, clean, postable | "playful" |
| `yc-parody` | Deadpan startup launch | absurd projects |
| `chaotic` | Fast and loud | when the prompt asks for chaos |
| `deadpan` | Dry, nothing is a joke | understated humor |

**When the prompt says nothing about tone, every video type uses `launch`.** Its writing rules, look, motion, transitions, typing sound and pacing were measured frame by frame from a modern AI launch film, and the way it shows the product (one world over a moving backdrop, the product in its context, a feature tour with title cards, the recap of every feature, the end card) from two current product films: [references/launch-style.md](references/launch-style.md). It takes the app's own theme (light or dark) rather than always white. Its text and transition engine, its kit for animating product screens (`launch-ui.js`) and two working examples (`example.html`, `showcase.html`) are in `assets/launch/`; `scripts/launch_events.cjs` checks the statements' reading time and, with `scripts/typing_track.py`, makes the typing sound.

## Telling the user

When the video is done, say where it is, one sentence on what it does creatively, what it claims (for a feature or change: which PR, open or merged), and that everything on the coverage list is in it. Name the motion you added without being asked. Say plainly that the audio was checked by measurement, not by ear. Report the Docker image and cache as retained resources. Offer to post to a PR only as a command they can run; never post it yourself.

End with **"Want another version?"**: 3–5 ideas chosen for this video (another format for where it will be posted, the next-best tone, a voice over, the quick or the full version, the other theme, its own scene for a feature shown in a quick run), each with the exact sentence to say. Add real product problems you noticed while rebuilding the UI, if any (step-4-deliver.md).
