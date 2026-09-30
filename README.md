# /brag

**Type one sentence. /brag reads your project, plans a story, and makes one finished video.**

Every tool runs inside Docker, so nothing is installed on your Mac. There are no flags: you say what you want in normal words. It works for any app: a shop, a dashboard, a developer tool, an attack surface manager. The words, colours, logo and motion all come from the project in front of it.

/brag is a Claude Code skill. This repository holds an improved version of [latent-spaces/brag](https://github.com/latent-spaces/brag), as of 30-09-26, running Hyperframes 0.8.91 in the Docker image `brag-tools:0.8.91-r3`.

> **Interactive guide:** [Using /brag](https://claude.ai/artifact/1sdfp2ouqJX9cJoUX64Xhe) is this guide as a web page, with a sentence builder and a live preview of every tone, including the typing sound. A copy that opens locally in a browser is in [`docs/using-brag.html`](docs/using-brag.html).

**Product demo**

```text
use /brag to make a product demo of this app, like an Apple keynote
```

**Feature brag**

```text
use /brag to create a video about the change in this PR https://github.com/org/repo/pull/42 with voice over
```

**Before and after**

```text
use /brag to make a before and after video of the new checkout page
```

## Contents

- [Install](#install)
- [Before you start](#before-you-start)
- [Build your sentence](#build-your-sentence)
- [What each word does](#what-each-word-does)
- [The three videos](#the-three-videos)
- [Tone: the personality of the video](#tone-the-personality-of-the-video)
- [Sound](#sound)
- [Honest by default. Your words win.](#honest-by-default-your-words-win)
- [What you get](#what-you-get)
- [Changing a video](#changing-a-video)
- [Behind the scenes](#behind-the-scenes)
- [What's in this repository](#whats-in-this-repository)
- [Tests](#tests)
- [Words used here](#words-used-here)
- [Credits and licence](#credits-and-licence)

## Install

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) and Claude Code. `git` and the GitHub CLI `gh` are used for videos about pull requests.

```bash
git clone https://github.com/Am0stafa/brag-video.git ~/Developer/repos/brag-video
mkdir -p ~/.claude/skills && cp -R ~/Developer/repos/brag-video/skills/brag ~/.claude/skills/brag
```

The first command downloads this repository; the second puts the skill where Claude Code looks for your personal skills. If you already have a skill at `~/.claude/skills/brag`, move it somewhere else first, or the copy lands inside it. To follow this repository instead of copying it, link it: `ln -s ~/Developer/repos/brag-video/skills/brag ~/.claude/skills/brag`.

## Before you start

1. **Open Docker Desktop.** /brag runs every tool inside Docker. If Docker is off, /brag stops and asks you to start it. That is the only question it will ask you.
2. **Open Claude Code in your project folder**, the repository you want the video about. To make a video about a pull request, you can also just paste its link.
3. **Type your sentence.** The first time, /brag builds its tools image: 5–10 minutes and about 1.3 GB to download. After that it is reused, and if it is ever missing (for example after you delete it), /brag builds it again first. A video takes Claude about 40–70 minutes of work; the three test videos took 39, 45 and 68 minutes.
4. **Watch it** with `open brag-output/brag.mp4`. Then listen to it: /brag checks the sound with measurements, but it cannot hear.

## Build your sentence

The [interactive guide](https://claude.ai/artifact/1sdfp2ouqJX9cJoUX64Xhe) builds the sentence for you as you pick options. Here is how it builds it. Start with `use /brag to`, add the words for your video, then add the words of each option you want, separated by commas. Anything else you want goes at the end, after `Also`.

**Which video, and about what?** The default subject is in the example; replace it with yours ("the export feature", "PR #42", "the branch login-v2", "my last 3 commits"):

| Which video? | Its words |
|---|---|
| Product demo | `make a product demo of this app` |
| Feature brag | `create a video about the change in this PR https://github.com/org/repo/pull/42` |
| Before and after | `make a before and after video of the new checkout page` |

For a length, put it before the word "video" or "product demo": `make a quick product demo of …`, `create a 30-second video about …`.

**The options, and the words each one adds:**

| Choice | If you say nothing | The words to add |
|---|---|---|
| Voice over | no voice: music and sound effects | `with voice over` · `with a male voice over` · `with a British voice over` |
| Tone | `launch`, the default | `like an Apple keynote` · `showing it thinking, as a dark keynote` · `with clean feature cards` · `for the sprint review` · `like a movie trailer` · `playful` · `as a deadpan startup launch` · `fast and loud` · `dry and understated` |
| Length | the full video | `quick` (a quick version, 27–47 seconds) · `27-second` · `30-second` · `45-second` · `60-second` · `90-second` · `117-second` (the most) |
| Shape | landscape (YouTube, slides) | `vertical for Reels` (Reels, TikTok, Shorts) · `square` |
| For whom | /brag chooses | `for the team` · `for LinkedIn` · `for customers` |
| Data on screen | invented stand-ins for private data | `with fake data` (all fake) |
| Anything specific | nothing extra | at the end: `Also show the settings page, start with 1,200 orders today.` |

The guide adds them in this order: tone, voice, audience, shape, data. Three sentences it builds:

```text
use /brag to make a quick product demo of this app, vertical for Reels, with fake data.
```

```text
use /brag to create a video about the change in this PR https://github.com/org/repo/pull/42, for the sprint review, with a British voice over, for the team.
```

```text
use /brag to make a before and after video of the new checkout page, like an Apple keynote, square. Also show the mobile layout.
```

**What /brag will follow** for each video, with the default choices:

| | Product demo | Feature brag | Before and after |
|---|---|---|---|
| Video | every feature, each one in use | the problem first, then everything the feature does | same frame, then the switch, for every place that changed |
| Reads first | the whole project: pages, copy, colours, fonts, every feature and flow | the change first (the PR, branch or commit), then the screens around it | the old and the new code of the change, then the screens around it |
| Length (the full video) | everything, never over 117 seconds (usually 47–82, or 82–117 with many features) | everything, never over 117 seconds (usually 42–82) | everything, never over 117 seconds (usually 32–62) |
| Length ("quick") | 27–47 seconds: still everything, the main flow in full and the rest in a quick run | 27–47 seconds, the same way | 22–32 seconds, the same way |

And for every video:

| | |
|---|---|
| Length (a number) | that many seconds, still covering everything (more in each scene) |
| Tone | `launch`, the default for every video type, or the one you name |
| Look | your app's own theme (light or dark), with your brand colour for the lit word |
| Motion | anything that naturally moves is animated without asking (the logo, numbers, charts, scans) |
| Sound | without a voice: music and sound effects, a bundled track only if it fits, otherwise music composed for this video, plus the deep typing sound with `launch`. With a voice: the voice over by Heart (US English), Michael (US English, male) or Emma (British English), with quiet music underneath and a few soft effects |
| Shape | 1920 × 1080, 1080 × 1920 or 1080 × 1080, at 30 frames per second |
| Data | real product copy, with invented stand-ins for private data; with fake data, all fake, marked "requested" |
| Saved in | `brag-output/` (or `brag-output-<subject>/` if taken), kept out of Git |

## What each word does

/brag reads your sentence and looks for these things. Anything you don't say gets a sensible default, which /brag writes into its plan.

| Setting | Say something like | If you say nothing |
|---|---|---|
| Video type | "product demo", "show every feature", "brag about this PR", "before and after" | A product demo, or a feature brag when you mention a PR, a branch or "the feature I added" |
| Subject | "this app", a PR link, "PR #42", "the branch login-v2", "my last 3 commits", "the new export in src/export/" | The project in the current folder |
| Voice over | "with voice over", "narrate it", "with a voice" | No voice. Music and sound effects carry the video. |
| Voice | "a male voice", "a British voice", "in Spanish" | Heart, an American English female voice |
| Music | "calm music", "epic music", "techy music", "no music" | On. A bundled track if it really fits the mood; otherwise music composed for this video. |
| Sound effects | "no sound effects", "no typing sound", "make the typing quieter" | On. Bundled sounds first; new ones are made or found when nothing fits. With `launch`, a deep "key" sound on every typed piece. |
| Tone | "like an Apple keynote", "like an AI launch video", "like a movie trailer", "for the sprint review" | `launch`: statements that stream in, one word lit in colour, your product's icon opening the scenes (see [Tone](#tone-the-personality-of-the-video)) |
| Theme | "dark", "light", "on white", "in our brand colours" | Your app's own look: its background, text colour and brand colour, light or dark |
| Motion | "keep the logo still", "no animation on the charts" | Anything that naturally moves is animated without asking: a bird logo's wings, a radar's sweep, numbers counting up, charts drawing, a scan filling in |
| Length | "quick", "a quick demo", "a quick version", "30 seconds", "under a minute" | The full video: everything, with the room it needs, never over 117 seconds. The quick words give a 27–47 second quick version that still shows every feature. |
| Shape | "vertical for Reels", "for TikTok", "square" | Landscape, 1920 × 1080, 30 frames per second |
| Audience | "for the team", "for LinkedIn", "for customers" | The team for features and before/after; the public for product demos |
| Data | "with fake data", "use the real numbers" | Invented stand-ins for any customer or personal data |
| Anything specific | "show the settings page", "mention Jira", "start with 1,200 orders today" | Nothing extra |

> **Your words win.** If you ask for something, /brag does it, even when the code doesn't have it yet. It marks it "requested" in the plan and does not argue or add warnings.

> **Everything is shown.** /brag lists every feature, screen and result it finds, plus everything you ask for, and the video shows all of it. A shorter video (the quick version, or a number you give) shows more in each scene. It never leaves something out.

## The three videos

Each video type has its own story. The tables below read like clips on an editing timeline, left to right, each with its time; the clip in **bold** is the heart of the video.

**How long.** By default you get the **full video**. /brag first lists everything (every feature, each result, the motion it found, everything you asked for) and gives it the room it needs, so nothing is rushed into a small video. It never goes over **117 seconds**. Extra time always means more of the product at the same pace, never slower scenes. When you know the video doesn't need to be long, say **"quick"** ("a quick demo", "a quick version"): you get 27–47 seconds that still show every feature, with the main flow in full and the rest in a quick run. A number in your sentence always wins, and it still covers everything. The tables below show examples.

### Product demo

*Usually 47–82 s · many features 82–117 s · quick 27–47 s*

Answers: **what is this, and what can it do?** It is about the whole product, every feature of it.

A full product demo of eight features, about 60 seconds (full: every feature gets its own chapter):

| Hook | Intro | **F1** | **F2** | **F3** | **F4** | **F5** | **F6** | **F7** | **F8** | Outro |
|---|---|---|---|---|---|---|---|---|---|---|
| 0–3 s | 3–8 s | 8–14 s | 14–20 s | 20–26 s | 26–32 s | 32–38 s | 38–44 s | 44–50 s | 50–56 s | 56–60 s |

The quick version of the same eight features, 30 seconds (quick: the same eight features, less depth):

| Hook | What it is | **Main flow** | **Quick run: F2–F8** | Outro |
|---|---|---|---|---|
| 0–3 s | 3–6 s | 6–15 s | 15–26 s | 26–30 s |

- Each feature is shown **in use**: typing, clicking, results arriving. It is not a slide of feature names.
- Nothing is left out. With many features, related ones share a scene and small ones get a quick run of 1–2 seconds each, so the video stays under 117 seconds.
- In the keynote-like tones, chapters get numbers ("03 / 08 · Reports") and a thin progress bar; in `launch`, the typed statements carry the thread.

```text
use /brag to make a quick demo of this app
```

```text
use /brag to make a product demo of this app with fake data
```

### Feature brag

*Usually 42–82 s · quick 27–47 s*

Answers: **what problem did this solve, and how is the product better?** It is about one new thing: a PR, a branch, "the feature I added".

A 45-second feature brag (problem first, then the answer):

| The problem | Life before | Meet it | **The feature at work** | What got better | Outro |
|---|---|---|---|---|---|
| 0–5 s | 5–13 s | 13–16 s | 16–34 s | 34–41 s | 41–45 s |

- It starts with **the problem**, in the words of the person who had it: "Every refresh wiped your filters."
- "Life before" is rebuilt from the **old code**, not imagined. The feature then appears in the same frame, so only the change moves.
- It shows **everything the change does**: every use it adds, every screen it touches, every edge case it handles, and any small side change in the same PR.
- If the PR is still open, the ending says `#42 · in review`. /brag never posts to GitHub; it gives you the command to do it yourself.

```text
use /brag to create a video about the change in this PR https://github.com/org/repo/pull/42 with voice over
```

```text
brag about the feature I added in this branch, for the team
```

### Before and after

*Usually 32–62 s · quick 22–32 s*

Answers: **what changed?** It is about an improvement to something that already existed: a redesign, a speed-up, a fix.

A 35-second before and after (the switch is the whole video):

| Hook | Before | **Switch** | After, in use | Side by side | Outro |
|---|---|---|---|---|---|
| 0–3 s | 3–9 s | 9–10 s | 10–22 s | 22–30 s | 30–35 s |

- **Same frame, same crop.** The old and the new look exactly alike except for the change.
- Every place the change touched gets its own before and after (or one split screen that holds them all).
- Numbers like "2× faster" appear only if they were measured, or if you gave them.

```text
use /brag to make a before and after video of the mobile hero fix in commit 9b5a758
```

```text
make a before and after video of the new settings page, vertical for Reels
```

> You always get **one video**. /brag does not make extra cuts or other versions unless you ask. At the end it suggests them, for example a quick version of a full video, with the sentence to say.

## Tone: the personality of the video

The same product can be shown calm and elegant, or loud and fast. That difference is the **tone**. You choose it with normal words, like "like an Apple keynote" or "like a movie trailer". The tone changes four things:

| | |
|---|---|
| **Pace** | how long each scene stays and how fast the cuts come |
| **Words** | how the lines on screen sound |
| **Type** | how the text looks: big or small, bold or light, capitals or not |
| **Transitions** | how one scene becomes the next: a soft fade, a slide, a hard cut |

**The default tone is `launch`.** It is built on how modern AI launch films write on screen, measured frame by frame from one, and made your product's own: big statements that stream in like a model's answer (the first word in small pieces, then whole words), the line gliding to stay centred, and one word lit in colour that flickers through a palette before it settles. Every typed piece lands with a short, deep "key" sound. Statements reset in a single frame. Where the story moves somewhere new, the line collapses into **your product's own icon** (or, when your app has no logo, a glowing orb in your brand colour that breathes on the beat of the music): it lands with a small bounce and one soft ring, then opens the next scene the way an app opens. The icon plays your logo's own motion as it lands (a horseshoe swings, wings beat, a radar sweeps), and the video closes with your product's name typing in beside it.

**It takes your app's look.** White is only the starting point. A dark app gets dark statements with light text, and the lit word takes your brand colour. Every colour is adjusted automatically so it stays readable. If your app icon is a gradient, or draws its own rounded tile, the icon in the video keeps that exact look. In the [interactive guide](https://claude.ai/artifact/1sdfp2ouqJX9cJoUX64Xhe), the **Theme** buttons under the preview compare light, dark and an app's own colours, and **Play with sound** plays the typing. Everything else below stays available when you ask for it.

**Your product, in use.** Between the statements, /brag rebuilds your real screens and animates them: text types into fields, numbers count up, dialogs open, a cursor glides to a button and clicks, a finger taps a phone screen. A desktop app is laid out at its real size and filmed through a camera that zooms in and out, so its layout stays exactly yours. A big product with dozens of screens gets a **screen wall**: every screen that has no scene of its own, by its real title, in one camera glide that ends on all of them at once.

Here is one fictional app, **Horse Tinder** (swipe to find a horse), in each of the ten tones. "On screen" is what the guide's preview shows.

### `launch` (the default)

- **Feels like:** crisp and confident; the words do the work
- **Pace:** a new statement every 2.5–4 s: the first word streams in pieces, then words land about 0.14 s apart, then it holds
- **Words:** short, plain statements; one key word lit in the brand colour
- **Type:** big semibold statements in the app's own theme (dark text on light, or light on dark); lines left-aligned in a centred block
- **Transitions:** one-frame resets between statements; where the story moves: your product's icon opening the next scene like an app, a warp out, a focus pull, a camera deep zoom; it closes on the icon beside the product's name
- **Sound:** a short, deep "key" hit on every typed piece, plus energetic electronic music
- **Best for:** every video type. It is what you get when you say nothing about tone.
- **Ask with:** nothing: it is the default · "launch style" · "like an AI launch video"
- **On screen:** "Horse Tinder for **Riders**" → "Find the horse that fits / your weekends and your pace" → "Swipe right on your next **ride**", which collapses into the horseshoe icon; the horseshoe swings on its nail, then the icon slides left while "Horse Tinder" types in beside it

```text
use /brag to make a product demo of this app
```

### `polished`

- **Feels like:** serious, elegant, calm
- **Pace:** 3–5 scenes, long holds
- **Words:** short, confident lines from the product's own copy
- **Type:** light to medium weight, lots of space
- **Transitions:** soft dissolves, slow push-ins
- **Best for:** products that are not jokes, when you want a calm, premium keynote
- **Ask with:** "like an Apple keynote" · "premium" · "serious" · "elegant"
- **On screen:** HORSE TINDER · "Find the horse that fits." · "Stable Match, on every profile card."

```text
use /brag to make a product demo of this app, like an Apple keynote
```

### `ai-demo`

- **Feels like:** calm keynote pacing; the product thinks on screen
- **Pace:** chapters of 4–7 s, slow push-ins
- **Words:** sentence case, declarative, no superlatives
- **Type:** large, light display type; small spaced labels
- **Transitions:** soft dissolves
- **Best for:** AI and agent products, when you want a dark keynote: a typed prompt, then "thinking", then an answer with its sources
- **Ask with:** "showing it thinking" · "dark keynote" · "like an agent demo"
- **On screen:** "Which horse fits my weekend rides?" types in → "… thinking" → "✓ read 3 profiles ✓ compared pastures ✓ checked turnout hours" → "Thunder is a 92% fit: same turnout hours, both grazers." with its sources: profile, pasture log

```text
use /brag to make a product demo of the agent, showing it thinking, as a dark keynote
```

### `app-store`

- **Feels like:** clean, professional, feature-forward
- **Pace:** 4–6 scenes, one feature card each
- **Words:** feature name, then one line of benefit
- **Type:** title case, medium weight, tidy
- **Transitions:** clean slides and wipes
- **Best for:** a product demo with many features
- **Ask with:** "with clean feature cards" · "like an app store video"
- **On screen:** a card with a 92% ring: "Stable Match · See the fit before you swipe."

```text
use /brag to make a product demo of this app with clean feature cards
```

### `changelog`

- **Feels like:** plain, informative, benefit-first
- **Pace:** 4–6 scenes; the feature at work gets the most time
- **Words:** "You can now…", no engineering words
- **Type:** mixed case, medium weight; the cut carries the emphasis
- **Transitions:** clean slides, one hard cut at before → after
- **Best for:** a plain team update: feature brags and before-and-afters for a sprint review ("for the team" alone sets the audience, not this tone)
- **Ask with:** "for the sprint review" · "changelog style" · "keep it plain"
- **On screen:** BEFORE: "Every swipe came down to the photo." → AFTER: "Now the card says why." `#1 · in review`

```text
brag about the feature I added in this branch, for the sprint review
```

### `cinematic`

- **Feels like:** dramatic, trailer-scale
- **Pace:** 4–5 scenes, big moments, dark pauses
- **Words:** epic claims, short lines
- **Type:** huge capitals, wide letter spacing
- **Transitions:** dramatic wipes, slow zooms
- **Best for:** big launches, or anything with a grand feeling
- **Ask with:** "like a movie trailer" · "epic" · "dramatic"
- **On screen:** IN A WORLD OF A THOUSAND HORSES · ONE WILL FIT.

```text
use /brag to make a 25-second cinematic product demo of this app, like a movie trailer
```

### `default`

- **Feels like:** playful, clean, easy to share
- **Pace:** 4–5 scenes, comfortable
- **Words:** light and friendly
- **Type:** bold, rounded, big
- **Transitions:** crossfades and bouncy entrances
- **Best for:** a fun product demo
- **Ask with:** "playful" · "fun"
- **On screen:** "Swipe right on your next horse." and a Horse Tinder pill

```text
use /brag to make a playful product demo of this app
```

### `yc-parody`

- **Feels like:** a startup launch, played completely straight
- **Pace:** 4–5 scenes, one claim each
- **Words:** corporate and very serious about something absurd
- **Type:** clean corporate sans, small and tidy
- **Transitions:** hard cuts
- **Best for:** absurd side projects
- **Ask with:** "as a deadpan startup launch" · "like a pitch"
- **On screen:** horse tinder · "We are building the operating system for horse compatibility." · "Backed by people who own horses."

```text
use /brag to make a product demo of this app as a deadpan startup launch
```

### `chaotic`

- **Feels like:** fast, loud, all capitals
- **Pace:** 6–8 scenes, some under 2 s
- **Words:** shouting, on purpose
- **Type:** huge, heavy, tilted
- **Transitions:** hard cuts, flashes, zooms
- **Best for:** only when you ask for chaos
- **Ask with:** "fast and loud" · "chaotic" · "crazy energy"
- **On screen:** SWIPE! MATCH! NEIGH!

```text
use /brag to make a fast and loud product demo of this app
```

### `deadpan`

- **Feels like:** dry; nothing is a joke
- **Pace:** 3–4 scenes, long holds, big empty space
- **Words:** flat statements, one at a time
- **Type:** small, plain, lots of space
- **Transitions:** slow fades
- **Best for:** understated humor
- **Ask with:** "dry and understated" · "deadpan"
- **On screen:** "This is an app. For horses." · "That is all."

```text
use /brag to make a dry and understated product demo of this app
```

> **If you say nothing about tone:** every video type gets `launch`: a product demo, a feature brag and a before-and-after. Name another tone only when you want a different look, for example "like an Apple keynote" for `polished`, or "for the sprint review" for `changelog`.

## Sound

**Did your sentence ask for a voice over?**

- **Yes:** a narrator speaks the story. Quiet music plays under the voice and dips on every line, with only a few soft sound effects. The voice is made on your Mac, inside Docker, with no internet needed.
- **No:** music and sound effects carry the video. /brag uses a bundled track only if it truly fits the mood. Otherwise it composes new music, timed so the big moments land on the beat. With `launch` it first checks that every statement stays on screen long enough to read, and only then writes the music to those final times, so the music is made once.

### Music /brag can make

| Style | Sounds like | Best for |
|---|---|---|
| `pulse` | a steady electronic pulse with small "data" blips | the default with launch (120–128 BPM); AI, developer, security and data tools |
| `cinematic` | big pads, deep booms, a slow build | trailers, big launches |
| `warm` | bright plucks, a soft beat, claps | friendly consumer apps |
| `minimal` | soft pads that leave room for speech | under a voice over |

The bundled tracks are upbeat and business-like ("Happy Beats"). They fit playful demos. Their licence is not written down in the skill, so for company videos /brag prefers its own music.

### The typing sound

With `launch`, every typed piece lands with a short, deep "key" hit: a click that drops fast from a high pitch to a low thump, gone in about 30 ms. It was measured from the reference film and rebuilt as an original sound, so nothing is copied. The pitch changes a little from hit to hit, the lit word's letters sound a bit higher, and fast letters are thinned so it never buzzes. /brag sets every hit about 8 dB above the music around it, then checks the finished video to prove each one is heard. Say "no typing sound" or "make the typing quieter" to change it. Try it with **Play with sound** in the [interactive guide](https://claude.ai/artifact/1sdfp2ouqJX9cJoUX64Xhe)'s tone preview.

### Sound effects

**Bundled:** clicks, soft drops, impacts, typing. **Made new:** whoosh, riser, boom, impact, blip, tick, shimmer, wing beats, glitch. **Found:** real recordings (an animal, a crowd, the weather) from free public-domain libraries, cleaned up and listed in the credits. Things that move on their own get a soft matching sound: wing beats for a bird logo, a blip for each pass of a radar sweep.

**Clicks, taps and typing in your screens** get their sounds from the animation itself: every click of the cursor and every tap is recorded with its time, and text typed into a field gets a soft keyboard sound on every second letter, never closer than 90 ms, so fast typing never buzzes. /brag then writes all the sound cues in one go, from a short list, measuring each sound's length and keeping overlapping sounds on separate tracks.

### How loud

Every finished video is set to **−14 LUFS**, the loudness most platforms use, on a scale that runs from about −30 (quiet) to −8 (loud). So your video is never much quieter or louder than the ones around it.

### Voices

| Voice | Language |
|---|---|
| Heart | US English, female (the default) |
| Nova | US English, female |
| Sky | US English, female |
| Michael | US English, male |
| Adam | US English, male |
| Emma | British English, female |
| Isabella | British English, female |
| George | British English, male |
| Dora | Spanish |
| Siwis | French |
| Alpha | Japanese |
| Xiaobei | Mandarin |

## Honest by default. Your words win.

Every name, number and feature on screen gets a line in the plan's **claims list**, with where it came from. Each line has one of three labels:

| Label | What it means | Example |
|---|---|---|
| **grounded** | found in the code, the docs or the change | "Filters now survive a reload." Source: `src/filters/store.ts` |
| **requested** | you asked for it, so it goes in exactly as asked | "1,200 orders today", because your sentence said so |
| **fake data** | sample names and numbers, used when you ask for fake data or to hide private data | "Acme Health", "Northwind Bank" |

Private things work the same way. While reading your project, /brag writes a file called `privacy-terms.txt`. Before rendering, it scans all the text in the video against that file.

```text
# found in the project: must never appear on screen
deny: ops@realcustomer.com
deny: 10.20.30.40
# you asked for it: allowed
allow: Acme Health
```

A `deny` hit must be fixed before the video is rendered. An `allow` line is fine. So the check stops leaks *you* didn't ask for, and never blocks what you did ask for.

Names are matched as whole words: a customer called "Tines" is found in "Tines," but not inside "routines". The scan also flags anything that looks like an email, a key or a network address, and it no longer mistakes the numbers in an icon's drawing (`7.178.07.207`) or a version number for an address.

## What you get

Everything lands in one folder in your project: `brag-output/`. If that folder already exists, the new one gets the subject in its name, for example `brag-output-pr-42/`.

| In `brag-output/` | What it is |
|---|---|
| `brag.mp4` | The video. Its first frame is the poster, so every app shows a good thumbnail. |
| `brag.jpg` | The poster image on its own. |
| `share-copy.txt` | One caption, ready to post. |
| `brag-plan.md` | The plan: the story, every scene with its timing, and the claims list. |
| `composition-brief.md` | The build instructions for the video engine. |
| `change-context.md` | For a feature or a before-and-after: the problem, the before and the after. |
| `privacy-terms.txt` | What must never appear, and what you allowed. |
| `credits.md` | Every sound, song and font that is not original, with its licence. |
| `composition/` | The video's source, built as a web page. Change it and render again. |
| `tools/` | Music plans, voice scripts, the list of sound effects, the log of every typed piece and click, and the last check report: everything needed to rebuild the sound and review the build. |
| `review/` | Contact sheets: many small frames on one image, used to check the video. |
| `versions/` | Older versions, kept when you change a video. |

> **Kept out of Git.** The folder is often over 100 MB, because the music and typing tracks are uncompressed. When your project is a Git repository, /brag adds one line, `brag-output*/`, to the repository's local exclude file (`.git/info/exclude`). Git reads that file only on your machine and never commits it, so the folder stays out of `git status` and out of every commit, and your `.gitignore` is not touched. To undo it, delete that line.

### In the chat, at the end

/brag tells you where the video is, what it claims, what it animated on its own (so you can say "keep the logo still" next time), and, in a Git repository, that it kept the output folder out of Git. It ends with **"Want another version?"**: three to five ideas picked for this video, each with the sentence to say. It only suggests them; it never makes extra versions unless you ask. For example:

> **Want another version?**
> - Vertical for Reels? Say: `make it vertical for Reels`
> - The light version of your dark app? Say: `try the light version`
> - Calmer, like a keynote? Say: `try it like an Apple keynote`
> - With a narrator? Say: `add a voice over`
> - A 30-second cut for a feed? Say: `make a quick version`

If it noticed real problems in your product while rebuilding the screens (a label that overflows, text that is hard to read, a typo), it lists them too, with the file. It never invents any.

## Changing a video

Ask for the change in the same project. /brag keeps the old video in `versions/v1/`, makes the change, and writes down what changed and why.

```text
change the music to something calmer
```

```text
make the ending shorter and use a British male voice
```

```text
make the same video vertical for Reels
```

```text
show the settings screen in chapter 3
```

## Behind the scenes

All the tools live in one Docker image, `brag-tools:0.8.91-r3` (3.7 GB). It holds Hyperframes (the engine that turns a web page into video), Chrome to render, FFmpeg for audio and video, Python for the music and checks, the Kokoro voice, the animation library and blank video templates. On your Mac, /brag only uses `docker`, `git`, `gh`, `curl`, `open` and file tools. It never runs Python or Node there, and any helper it starts to read a big project gets the same rule, written into its instructions.

The Hyperframes guides it reads are copied to `~/.cache/brag` (5 MB).

### How /brag checks its own work

- **Reading time, before the music.** As soon as the statements are built, a table lists each one with its start, when its last word lands, when it leaves, and whether it can be read: about 0.3 s per word, and at least 1.2 s after the last word. Every row must say `ok` before the music is composed.
- **The layout check, summarized.** Hyperframes' `check` looks for text that overlaps, overflows or is hidden. Its full report is long, so /brag reads a summary grouped by kind, severity and moment. Transitions leave their two scenes out of the check while they cross, so planned cross-overs no longer bury the real problems.
- **Screens that animate the same way every time.** The kit that animates your screens computes every frame from the time alone, because frames are rendered out of order. It was tested by drawing the same video forward, backward and in a shuffled order: every visible element matched. The tests are in [`tests/`](tests/).
- **Frames and sound, measured.** Contact sheets of every key moment, loudness and peaks measured on the final file, and a check that every typing hit is heard.

### Changes on 30-09-26

From a 114-second demo of a large product, and the problems that run met:

- A kit for animating product screens: a scene clock for typed text and counters, appearances that start hidden, a cursor that measures its targets from the layout, phone taps, "…" labels cut the way the product cuts them, a "Sample data" label that stays in the corner, the screen wall, and quieting the page behind an open dialog.
- The reading-time table, run before the music is composed.
- A statement that stays on screen (`exit: "none"`) now gives way to the next statement on its stage.
- The product's icon accepts a gradient tile, or a full app icon that draws its own tile.
- Focus pulls, app opens, circle reveals and warps no longer fill the layout check with warnings (one run had 40 from focus pulls alone).
- Scenes, cameras and transitions look right even when frames are drawn in reverse order; before, a scene could keep the blur of a later transition.
- Fixes to the privacy scan (whole-word names, no false addresses), the music report (a drop is compared with the section before its build), and font downloads (a variable font becomes one file and one rule).
- New helpers: a summary of the check report, and the sound-effect tags written from a list.
- The output folder is kept out of Git with a local exclude line.

### Free the space later

```bash
docker rmi brag-tools:0.8.91-r3
rm -rf ~/.cache/brag
```

The first removes the tools image (3.7 GB), the second the copied guides (5 MB). The next /brag run rebuilds both, which takes 5–10 minutes.

### Go back to the original skill

The original, untouched skill (and its lean sibling, `brag-slim`) is in the upstream repository:

```bash
git clone https://github.com/latent-spaces/brag.git ~/Developer/repos/brag
rm -rf ~/.claude/skills/brag && cp -Rp ~/Developer/repos/brag/skills/brag ~/.claude/skills/brag && cp -Rp ~/Developer/repos/brag/skills/brag-slim ~/.claude/skills/brag-slim
```

The second line deletes the version you installed from this repository, so copy it somewhere first if you want to keep it.

## What's in this repository

| Path | What it is |
|---|---|
| `skills/brag/SKILL.md` | The skill: what it makes, how it reads your sentence, and its four steps |
| `skills/brag/references/` | The guides it reads at each step: inspect, plan, compose, deliver, the tones, the launch style, audio, Docker |
| `skills/brag/assets/launch/` | The launch engine: `launch-text.js` (statements and the product's icon), `launch-motion.js` (transitions and camera), `launch-ui.js` (the product-screen kit), `launch.css`, and a working `example.html` |
| `skills/brag/assets/music/`, `assets/sfx/` | The bundled music (with beat and cue files) and sound effects |
| `skills/brag/scripts/` | Music, sound, fonts, privacy, reading-time, check-summary and delivery scripts, all run inside Docker |
| `skills/brag/docker/Dockerfile` | The recipe for the `brag-tools:0.8.91-r3` image |
| `docs/using-brag.html` | The interactive version of this guide, to open in a browser |
| `tests/` | The engine tests, run inside the same image |

## Tests

The launch engine and its product-screen kit have tests: four compositions checked with `hyperframes lint`, with `hyperframes check` at every tween boundary, for reading time, and for frame order (drawn forward, backward and shuffled, and compared). From the repository root:

```bash
docker run --rm --shm-size=2g -v "$PWD":/repo -w /repo brag-tools:0.8.91-r3 sh tests/run-tests.sh
```

It prints one line per check and ends with `all tests passed`. [`tests/README.md`](tests/README.md) explains each check and what can go wrong.

## Words used here

| Word | Meaning |
|---|---|
| Hook | The first 2–3 seconds. Their job is to make people keep watching. |
| Outro | The last few seconds: the logo and a final line. |
| Lockup | The logo and the product name placed together, at rest. |
| Poster (frame 0) | The still image people see before the video plays. /brag makes it the very first frame. |
| Beat, BPM | The music's pulse, counted in beats per minute. At 120 BPM a beat lasts half a second, and cuts land on beats. |
| Drop, hit | A strong moment in the music where something big happens on screen. |
| Voice over | A narrator's voice playing over the pictures. |
| LUFS | How loud something sounds to people. −14 is the level most platforms use. |
| Contact sheet | Many small frames on one image, to spot visual problems quickly. |
| Claims list | The table in the plan of every fact on screen and where it came from. |
| Composition | The web page (HTML) that Hyperframes turns into the video. |
| Render | Turning the composition into the final MP4 file. |
| Hyperframes | The open-source tool that records a web page, frame by frame, as a video. |
| Docker image | A sealed box with all the tools inside, so nothing is installed on your Mac. |
| PR, merge base | A pull request is a proposed code change. The merge base is the code just before it: the "before". |
| Revision | A new version of an existing video. The old one is kept in `versions/`. |
| Reading time | How long a line must stay on screen to be read: about 0.3 s per word, and at least 1.2 s after its last word appears. |
| Screen wall | A grid of a big product's screens, each with its real title, that the camera glides across in a few seconds. |
| Layout check | Hyperframes' `check`: it looks for text that overlaps, overflows the frame or is hidden under something. |

## Credits and licence

- **The skill** is based on [latent-spaces/brag](https://github.com/latent-spaces/brag) by Shunit Haviv Hakimi, under the MIT licence. The changes in this repository are by Abdelrahman Mostafa, under the same licence. See [LICENSE](LICENSE).
- **[Hyperframes](https://hyperframes.heygen.com/)** renders the videos. It runs inside the Docker image with Chrome, FFmpeg, the Kokoro voice and GSAP; none of them are stored in this repository.
- **Music:** the five bundled tracks in `skills/brag/assets/music/` are from the "Happy Beats / Business Moves" series by [ende.app](https://ende.app/en), as shipped by the upstream project. Their licence is not documented in either project, so check ende.app's terms before you publish a video that uses them. By default /brag composes its own original music, which needs no licence.
- **Sound effects** in `skills/brag/assets/sfx/` are CC0, from Kenney.nl and OpenGameArt.
- **Fonts** are downloaded from Google Fonts when a video needs them (OFL or Apache licensed); none are stored here.

This guide describes the skill as of 30-09-26: Hyperframes 0.8.91 in the image `brag-tools:0.8.91-r3`.
