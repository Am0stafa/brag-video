# Video types

One video per request. Pick the type from the prompt (SKILL.md), then use its shape,
timings and rules below. A length, format or structure the user asks for overrides
anything here.

| | Product demo | Feature brag | Before and after |
|---|---|---|---|
| Subject | the whole product | one new capability | one improvement to something that existed |
| Question it answers | "What is this and what can it do?" | "What problem did this solve, and how is the product better?" | "What changed?" |
| Source | the project (step 1) | the change (step 0) + its surroundings | the change (step 0) + its surroundings |
| Default audience | public | the team, stakeholders | the team, stakeholders |
| Default tone | `launch` | `launch` | `launch` |
| Covers | every feature, screen, flow step and result | every behaviour the change adds, every surface it touches, every edge case it handles, every proof | every place the change touched, before and after |
| Length (the full video, the default) | whatever covers everything, at most 117 s; usually 47–82 s, 82–117 s with many features | the same rule; usually 42–82 s | the same rule; usually 32–62 s |
| Quick version (only when asked) | 27–47 s, still everything | 27–47 s, still everything | 22–32 s, still everything |
| Poster | a frame that names the product (the title card, the lockup), or a settled UI frame with the name visible | the *after* state with the feature's name | the side-by-side frame |

When the prompt is mixed ("a demo of the app, focusing on the new export"), make a
product demo whose longest chapter is the feature, told problem-first. When a PR both
adds something and improves something, it is a feature brag if a user can now do
something they couldn't; a before-and-after if they do the same thing better.

## Cover everything

Every video shows everything: all that step 0 and step 1 found (the "Covers" row above)
and all that the user asked for. This holds at every length: the full video, the quick
version, and a length the prompt sets. Nothing is left out, folded away unseen or saved
for another version to make a video shorter.

- **The coverage list.** Step 1 lists every item as it reads; the plan maps each item to
  the scene that shows it (step-2-plan.md). An item without a scene is a gap to fix, not a
  choice.
- **Short on time? Show more per scene, never less.** Group related features in one scene
  (a parallel frame with one slot word per feature while the camera moves to each on its
  screen; one screen that holds several, visited in one camera move; floating chips over
  their screen; a split screen). Give the small ones a quick run: 1–2 s each, the feature's
  name over a glimpse of it working. For a product with dozens of screens, a screen wall
  shows every one that has no scene of its own: its real title and a glimpse, on one grid
  the camera glides across and pulls back from (launch-style.md, "Screen wall").
- **Every item stays readable.** A quick run still holds each name long enough to read
  (a short label about 0.8 s, a slot word about 0.37 s while its screen shows).

## How long

**The full video is the default.** It covers everything, and its length follows from
that, up to a hard ceiling of **117 s**. Don't squeeze the product into a small video to
hit a number: the room is there so every item gets its moment.

- **List first, then time it.** Before timing anything, fill in the coverage list: the
  features, the steps of the flow, the results after the actions, the motion found, the
  proof of what got better, the requests. Build the story to cover the list, and let that
  set the length.
- **Grow by scenes, never by slowing down.** Every scene keeps the style's pace:
  statements every 2.5–4 s, product moments 3–9 s (the feature at work up to 20 s). No
  longer holds, no repeated shot, no second tagline, no filler: extra seconds go to more
  of the product.
- **Over 117 s?** Show more per scene (above) until it fits. Every item keeps its scene.
- Most full videos land around: product demo 47–82 s, 82–117 s for a product with many
  features, feature brag 42–82 s, before and after 32–62 s. That is what covering things
  usually takes, not a target.
- **Under the usual range?** A full video that ends below its type's lower end (47 s for a
  demo, 42 s for a feature brag, 32 s for a before and after) has usually shown things too
  fast. Use the room: give each item its result, a second real use, its motion. Never pad
  with holds or repeats.
- **The prompt wins:** a stated length is exact, and "quick" asks for the quick version
  (below). Both still cover everything.

## The quick version (only when asked)

When the prompt says the video doesn't need to be long ("quick", "a quick demo", "quick
version", "short", "teaser", "brief"), make the quick version: **27–47 s** (before and
after 22–32 s). It covers the same list as the full video, with less depth: the key flow
is shown in full, and every other item appears in a quick run. Same style, same honesty,
same coverage.

```
Product demo      Hook (2-4 s) → What it is (3-5 s) → the key flow in use, with its result
                  (10-16 s) → every other feature in a quick run (1-2 s each) →
                  Outro with the logo (3-4 s)
Feature brag      The problem, on the old screen (4-6 s) → The feature at work, every use it
                  adds (12-20 s) → What got better, every proof in one frame (5-8 s) → Outro (3-4 s)
Before and after  Before (4-6 s) → The switch (0.5-1 s) → After in use, every changed place
                  (10-16 s) → Side by side (4-6 s) → Outro (3-4 s)
```

- The key flow is the one the type's question is about (the table above); everything
  else is in the quick run.
- Short of the lower end (27 s, or 22 s for a before and after), for example a product
  with few features? Give the spare seconds to the key flow's result, and up to 3 s to
  each quick-run item; never to holds.
- At most one scene transition; everything else is a one-frame reset.
- The logo's natural motion goes in the outro; no finale.
- End with "Want another version?" offering the full version ("make the full version"),
  where every feature gets its own scene.

---

## Product demo

**Goal:** someone who has never seen the product understands what it does and wants it.
The demo shows every feature: usually 47–82 s, and 82–117 s for a product with many.

```
Hook (2-4 s) → What it is: logo + one-line promise (3-6 s) →
every feature in use, one chapter each (5-9 s; small ones grouped or in a quick run) →
optional finale (4-16 s) → Outro (3-5 s)
```

- The hook is the problem at scale or the product's boldest real claim
  ("4,200 support tickets this week. Every one needs an answer.").
- Each chapter is one feature *in use*: entry → key action → result. Show the result after
  the action, not just the action. In the default `launch` tone, a chapter is one typed
  statement followed by the feature's real UI doing its thing (a click, a typed prompt, a
  result arriving). There are no numbers and no progress bar: the statements carry the
  thread (launch-style.md).
- In `polished`, `app-store` or `ai-demo`, a chapter instead gets a mono eyebrow
  (`02 / 11 · REPORTS`), one headline sentence and a sub-line, with a thin progress
  rail at the bottom that fills chapter by chapter.
- Order chapters the way a user moves through the product, not the way the code is
  organised.
- Many features? Group related ones into one chapter that still shows each of them on
  its screen, and give the small ones a quick run, so the video stays within 117 s and
  every feature is seen. Dozens of screens? A screen wall near the end shows the rest by
  their real titles in a few seconds.
- A finale is optional: one signature moment that ties it together, usually the logo's
  natural motion (motion-opportunities.md) carrying the story's key item through the
  whole flow before it lands in the lockup: a bird carries one order from cart to
  doorstep; a radar sweep finds the last exposed server.
- Keep the rhythm steady: every chapter the same shape, so viewers learn where to look.
- The outro is the logo lockup and one line from the product's own copy.

---

## Feature brag — problem first

**Goal:** show the problem, the world without the feature, and then the feature as the
answer, and prove the product got better. The feature is the hero, but the problem earns
the reveal. A video that only shows the new thing is an ad; this one is a story.

Usually 42–82 s, at most 117 s:

```
1. The problem       (3-6 s)   who hit it and what it cost them, in their words
2. Life before       (4-10 s)  the real old screen or flow, with the friction visible
3. Meet the feature  (2-4 s)   its name and a one-line promise
4. The feature at work (8-20 s) the same frame as scene 2, now working: the click,
                               the typed input, the result arriving
5. What got better   (4-10 s)  the difference, shown: fewer steps, no data lost, a new
                               outcome; before and after side by side if it helps
6. Outro             (2-4 s)   logo, feature name, "#42", and "in review" if the PR is open
```

Scene 4 shows every use the change adds, on every surface it touches, and every edge
case it now handles; scene 5 shows every proof. A PR that also ships small side changes
shows them too, in a quick run before the outro. Extra time goes to scenes 4 and 5, never
to the problem.

- **The problem** comes from `change-context.md`: the linked issue, the PR description,
  commit messages, or the user's prompt. Name the person and the pain ("Support was
  re-typing every filter after a refresh"), not the feature. If nothing says who asked,
  describe what a user was doing when it hurt.
- **Life before** is read from the code at the *before* point, never imagined. Hold it
  about a second longer than comfortable, so the viewer feels the friction. Show the
  workaround if there was one (the extra clicks, the export to a spreadsheet, the
  waiting).
- **The feature at work** reuses scene 2's frame, so the only thing that changes is the
  feature. Simulate the real gesture; don't cut straight to a finished state.
- **What got better** states outcomes the change really delivers, counted from the two
  flows ("3 steps → 1") or shown (the value survives a reload). Use a timing or a
  percentage only if it was measured or the user gave it.
- A change with no screen still gets a real surface; see the table in change-source.md
  (request and response, terminal, failing test → passing test, the measured number).

---

## Before and after — the transformation is the story

**Goal:** make the difference impossible to miss. The frame stays still; only the
change moves.

Usually 32–62 s, at most 117 s:

```
1. Hook          (2-3 s)  the claim of change, or the old pain in one line
2. Before        (3-6 s)  the old state, held long enough to register
3. The switch    (0.5-2 s) a hard cut on the beat, a wipe, or a split slider
4. After in use  (5-15 s) the new state doing the thing
5. Side by side  (3-8 s)  both states together, with a measured difference if one exists
6. Outro         (2-3 s)
```

When the change touched several places (the list and the detail page), each one gets its
own before → switch → after pair under the same frame rules, or one split screen that
holds them all.

- **Same frame.** Before and after use the same layout, position and crop. Rebuild the
  old version exactly from the *before* code; a flattering or blurred "before" is dishonest.
- **The switch** is the whole video. Give it the strongest beat in the music (or a
  silence just before it) and a single clean sound.
- For speed improvements, show the wait (a real spinner, a real count) against the new
  instant result. Use numbers only if they were measured.
- For a redesign, a split slider that the viewer "drags" across the screen works well.

---

## With a voice over

The narration sets the pace. Write and generate it while planning (step 2), then fit the scenes
to the audio. Keep the total at 117 s or less (27–47 s for the quick version), unless the
user asked for another length. Voice-over lines add to the on-screen text and don't read it out word
for word. The on-screen text gets shorter, because the voice carries the explanation; the
coverage stays the same.

## Length and format asked for in the prompt

"30 seconds", "under a minute", "vertical for Reels": use it. Rescale scene durations
proportionally, keep the reading-time floors (step-2-plan.md), and fit everything by
showing more per scene ("Cover everything", above), never by rushing text or leaving items
out. For vertical, stack side-by-side comparisons top and bottom.

Words that set a length without a number: "quick", "a quick demo", "quick version",
"short", "teaser", "brief" → the quick version; "full", "detailed", "in depth", "every
feature" → the full video (the default anyway); "under a minute" → at most 59 s. A number
above 117 s is the user's call: use it, and say it is past the usual ceiling.
