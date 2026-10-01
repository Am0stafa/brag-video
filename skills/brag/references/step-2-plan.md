# Step 2: Plan

Complete `<output-dir>/brag-plan.md` (step 1 started it with the rubric and the visual
identity). It is the creative contract for the whole video: what it must say, show and
sound like. It does not prescribe Hyperframes implementation details; those are decided in
step 3.

```bash
mkdir -p <output-dir>
```

## brag-plan.md

```markdown
# Brag plan: [product or feature]

## Video
- Type: [product demo / feature brag / before and after]
- Subject: [the project / PR #42 / branch / commits]
- Audience: [team / public / customers]
- Length: [seconds] ([full / quick / the prompt's length]): [how many coverage items, and how they fit]
- Format: [landscape 1920×1080 / vertical 1080×1920 / square], 30 fps
- Tone: [preset; `launch` unless the prompt asks for another] — [the prompt's own words, if any]

## Rubric
[From step 1, for a product demo. For a feature or change, see change-context.md.]

## Asked for in the prompt
[Every explicit request, one per line. These are must-haves: "voice over", "show the
settings page", "1,200 orders today", "mention Jira", "fake data".]

## Coverage
[Everything the video shows, one row each: every feature, screen, flow step and result
from step 1 (for a change: every behaviour it adds or changes, every surface it touches,
every edge case, every proof, from change-context.md), and every request above. Each row
names the scene that shows it. The video shows all of it at any length; a row without a
scene is a gap to fix.]
| Item | Found in | Scene | How it is shown |
|---|---|---|---|
| Saved searches | `src/search/Saved.tsx` | 4 | its own statement + the list filling in |
| Export to CSV | `src/export/csv.ts` | 7 | quick run: "Export" over 1.5 s of the download |
| "show the settings page" | the prompt | 8 | its own scene: the toggles switching |

## What it is
[One sentence. For a feature: what changed, in product words.]

## The angle
[The creative premise in two or three sentences. For a feature brag, the problem it
solves and for whom.]

## Hook (first 2-3 seconds)
[The opening line and image.]

## Story
[The type's shape from video-types.md, filled in: the scenes in order with one line each.]

## Showcase (`launch`)
[launch-style.md, "The showcase layer". Leave a line out only when it doesn't apply.]
- Context: [window / browser / laptop screen / phone], light or dark, and why that is where its user meets it
- Opening: [the product's trigger (which keys, which tap, which command) or the hook condensing into the logo, which opens into the product]
- Feature tour: [each feature's title as the product names it, with its counter if there are five or more, and the interaction that shows it in use: typed query, stepping highlight, morphing panel, toast, counter]
- Recap: [the closing line, and every tile: icon (the product's own, or none) and name]
- Close: [end card (tagline, call to action, site, note, each with its source) / lockup / loop back to the opening frame]

## Visual identity
[From step 1.]
- Background / surfaces / text / accent / status colors: [hex values; the source's oklch/hsl alongside]
- Theme: [light / dark] — statements on [background] with [text] and [brand accent]
- Backdrop (`launch`): [auto (slats on dark, aurora on light) / slats / aurora / grid; flat only when the prompt asks] — why it fits the product
- Fonts: [display, body, data; embedded locally from …]
- Logo: [file; animated or not]
- Product's mark (`launch`): [the bare logo in its own colours (no tile unless asked), or "no logo: the brand orb"; the brand colour for its glow; the name for the lockup]

## Motion found
[From step 1 and motion-opportunities.md: everything that moves by default, without being
asked. Element | motion | why | sound. The user can switch any of it off in one sentence.]

## Audio
- Voice over: [none / yes — voice, style, where the lines go]
- Music: [bundled <track> because it fits <mood> / composed: style, key, tempo, why / none because the prompt said so]
- Typing sound: [`launch`: the deep key on every typed piece (typing_track.py); `--under-voice` with a voice over; off for other tones unless asked]
- Sound effects: [bundled / generated / sourced — which moments, including the sounds of the motion found]
- Beat grid: [tempo; cuts land on beats]

## Fake data
[Only if the UI shows data: names, numbers and how they add up.]

## Claims
| On screen | Source | Status |
|---|---|---|
| "Filters now survive a reload" | `src/filters/store.ts` (after), PR #42 body | grounded |
| "1,200 orders today" | the user's prompt | requested |
| Team workspaces screen | `models/workspace.py` (workspace_id), no such page in the UI | requested (concept) |

## Storyboard
### Scene 1 — [name] — [start–end s]
[What is on screen, the exact text, which real UI or copy it uses.]
Interaction: [what appears one by one, or what is clicked, typed or swiped — or none]
Audio: [what the sound does; voice line if any]
Transition: [cut / dissolve / wipe] → Scene 2

[…every scene]

## Share copy (draft)
[One to three sentences for the audience above.]
```

## The claims list

Every name, number, capability and quote on screen gets a row. The status is one of:

- **grounded** — it is in the code, the docs, the product's copy or the change. Name the
  file.
- **requested** — the user asked for it in the prompt. It goes in exactly as asked,
  with no warning attached.
- **fake data** — invented sample data. That is fine when the user asked for fake data, or
  when it replaces private data; list it under "Fake data".

Anything else is an invention: rewrite it from the project's own words or cut it. Tone,
jokes, hooks, transitions and connective lines ("Here's the part nobody asked for")
assert nothing about the product and don't need rows.

## Timing: pick the beat grid first

Choose the tempo before timing scenes, then put every cut and major reveal on a beat.

- **Composed music:** 120 BPM makes a beat 0.5 s and a bar 2 s, so every time in the plan
  is a round number and the music can be written to it exactly (audio.md). The tempo is
  all step 3 needs to place the statements; the music itself is composed only after
  their reading time is checked, to the final times.
- **A bundled track:** read its cue file and snap cuts to its beats.
- **Voice over:** the narration sets the times. Write the lines into the plan and generate
  them now, one file per scene (audio.md), then measure each file and time the storyboard
  to the real audio. Place cuts in the pauses between lines. Estimating at 2.5 words per
  second and correcting later means redoing the storyboard.

## Length

Use video-types.md, "Cover everything" and "How long". A length in the prompt wins;
"quick" (and "a quick demo", "quick version", "short", "teaser") asks for the quick
version. Every length covers the whole coverage list.

**The full video (the default):**

1. Fill in `## Coverage`: every feature or step, the result after each action, the motion
   found, the proof of what got better, and every request.
2. Storyboard to show the whole list at the style's pace, and add up the scenes. That sum
   is the length.
3. Over 117 s? Show more per scene until it fits: related features in one scene (a
   parallel frame with one slot word per feature, one camera move across a screen that
   holds several, floating chips over their screen), and the small ones in a quick run of
   1–2 s beats. For a product with dozens of screens, a screen wall: a grid of every
   screen that has no scene of its own, by its real title and a glimpse of it, that the
   camera glides across and pulls back from (launch-style.md; 32 screens in about 8.5 s
   in one run). Every row keeps its scene.
4. Check each scene against the coverage list, not against a feeling of "enough": a row
   without a scene goes back in.

**The quick version (only when asked):** 27–47 s (before and after 22–32 s), using the
type's quick shape in video-types.md: the key flow in full, and every other row of the
coverage list in a quick run. Same coverage, less depth.

Write the result into the plan: `Length: 96 s (full): 14 features, 9 with their own scene
and result, 5 small ones in one quick run, + the radar finale`. If the story still doesn't
fit, group more per scene; never rush text or remove rows.

## Reading time

Pace comes from motion and cuts, not from pulling text away. Every line a viewer must
read needs enough settled time (fully in, not yet leaving):

- a short label (1–3 words): about 0.8 s;
- a sentence: about 0.3 s per word, at least 1.2 s; the hook gets the most.

In `launch`, viewers read the words as they land, so the build counts: a statement needs
about 0.3 s per word counted from its first word, and at least 1.2 s after its last word
lands (the style's 1.2–1.8 s hold). A 7-word statement built in 0.9 s holds 1.2 s: 2.1 s.
Plan with that, but don't work typing times out by hand: in step 3, `launch_events.cjs`
prints this check for every statement from the real typing, and its table must be all
`ok` before the music is composed (step-3-compose.md, "Lock the timing first").

Two mistakes to design out now:

- **Too much text for the scene.** A 4-second scene holds 2–3 short reads, not 6. Split
  the scene, or say the same thing in fewer words; don't speed it up.
- **Text on a fast beat.** At 110+ BPM beats are about 0.5 s apart. That is fine for
  accents (glows, ticks), but too fast for lines of text. Reveal text on every other beat,
  or reveal a set quickly and hold it.

## What to show

In order of preference:

1. **The working app doing its job**: the upload, the editor, the result, the dashboard
   with real-looking data, rebuilt from the real components' markup and styles.
2. **A real UI element**: a card, a verdict, a progress meter.
3. **The core idea animated**, when there is no UI (see change-source.md for non-visual
   changes).
4. **Text-forward**, when the product is its copy.

A stat block or headline card may frame the product, at most once, and never replaces it.
Never fill a scene with abstract patterns or generic motion graphics.

**Real product, real flaws.** Rebuild the product as it is. If an unrelated bug would ruin
a shot (a toast clipped by its container, a stray scrollbar), frame the shot around it or
show the intended design when the code makes the intent clear, for example a comment or a
style that was clearly meant to apply. Write the deviation into the claims list. Never
hide a flaw that the video's own claim depends on.

## Make it alive, without being asked

Motion is a default, not a request. Take the `## Motion found` list from step 1
(motion-opportunities.md) and give each item a place in the storyboard: the logo's natural
move (wings beat, a sweep turns, a mark assembles), the numbers that count up, the charts
that draw, the rows that arrive, the scan that fills in, the cursor that clicks, the text
typed into a field. Write them into the scene descriptions explicitly ("three result rows
arrive one by one, each with a soft drop"; "the radar logo's sweep turns twice and stops
at its logo angle"). Hyperframes implements what the plan names; it doesn't invent rhythm
on its own. Never ask the user whether to animate these; build them, and list them so the
user can switch any off. In `launch`, the product's icon plays the logo's motion as it
lands (launch-style.md, "The product's mark").

## Transitions by tone

| Tone | Transitions |
|---|---|
| `default` | crossfade, clean wipe |
| `launch` (default) | one-frame resets between statements; where the story changes place (2–4 per 30 s): the product's icon opening the next scene like an app, a warp back out, a focus pull into the product, a camera deep zoom inside it; the close collapses into the icon beside the product's name (launch-style.md, "Transitions between scenes" and "The product's mark") |
| `polished`, `ai-demo` | soft blur-dissolve through the background, slow push-ins |
| `app-store` | slide, smooth wipe |
| `changelog` | clean slide or wipe (0.35–0.45 s), one hard cut at the before → after moment |
| `cinematic` | dramatic wipe, crossfade |
| `yc-parody` | hard cut |
| `chaotic` | hard cut, flash, zoom |
| `deadpan` | slow crossfade, long hold |

Hyperframes' rule, which /brag follows: **the transition is the exit.** Don't animate a
scene's content out before its transition; the outgoing scene stays fully visible until
the transition carries it away. End on a held final frame (the lockup, the outro line)
rather than fading to black; Hyperframes advises against ending on black. A plain crossfade
between two busy layouts makes a muddy double exposure, so pick a transition that keeps
them apart: a blur-dissolve through the background, a push, a wipe, or a hard cut on the
beat. Hyperframes' transition catalogue has the implementations.

## Gate

`brag-plan.md` exists with the full storyboard; every row of `## Coverage`, every request
included, has a scene that shows it; the length is at most 117 s at the style's pace
(27–47 s for the quick version, or the prompt's length); every row of the claims list is
grounded, requested or fake data.
