# The launch style (the default)

`launch` is the default tone for every /brag video unless the prompt asks for another
(`polished`, `app-store`, `changelog`, `cinematic`… all stay available). It is the way
modern AI product launch films write on screen: big statements typed onto a flat canvas,
one idea at a time, one word lit up in colour, a deep "key" sound on every typed piece,
and a small set of sharp transitions. Its signature is the product's own logo, shown bare
the way the product shows it: statements condense into it as it comes into focus, it opens
the next scene the way an app opens, and the video closes on the logo with the product's name.

Everything below was measured frame by frame from a current AI launch film
(78 s, 1080p, 30 fps): positions, sizes, colours, timings and sounds. It describes the
*pattern*, never that film's brand: use the project's own logo, name, font and colours, and
keep this rhythm. Where the film has a move that is its own signature (its colour-cycling
dot), /brag uses its own instead: the product's mark (below). It works for any product: a
dating app, an attack surface manager, a design tool, a bank.

The engine in `assets/launch/` does the typing, gliding, flicker, slots, thinking dots,
caret, exits, the product's mark, transitions and camera for you, logs every typed piece
for the sound, and checks that every statement can be read (see "Build it"). Its kit
`launch-ui.js` animates the product screens between the statements: a scene clock for
typed fields and counters, appearances, a cursor, taps, "…" labels, the "Sample data"
label and the screen wall. A working example is `assets/launch/example.html`.

---

## The look

| Element | Value (measured) | In /brag |
|---|---|---|
| Canvas | flat near-white `#fdfdfd`; one scene in pure black `#000000` | **the app's own theme** (below); the film's white when the app is light and has no background of its own |
| Ink | pure black on white; pure white on black | the app's main text colour |
| Statement size | cap height 86 px on 1080p (≈ 118 px type, 11% of the frame height) | engine default: 6.15% of the frame width |
| Weight | semibold (stems ≈ 0.2 of the cap height) | 600 |
| Tracking | slightly tight | −0.012 em |
| Line height | 153 px between baselines at 118 px (1.3) | 1.3 |
| Lines | at most 2, broken by meaning ("Find the horse that fits / your weekends and your pace") | written by hand in `lines` |
| Alignment | lines left-aligned inside a block; the block centred on the frame | engine |
| Line width | up to ≈ 70% of the frame width | a single line wider than 80% is wrapped into two balanced lines; the type shrinks only if that still doesn't fit (and the console warns: split the statement) |
| Typeface | a clean geometric grotesk (single-storey g, double-storey a) | the project's font; else **Geist SemiBold** (`fetch_fonts.py --font "Geist:600"`) |

### The theme follows the app

White is the film's default, not a rule. Step 1 records the app's background, text and
brand colours; the statements use them:

| The app looks like | Statements use |
|---|---|
| light screens | the app's light background (or the film's `#fdfdfd`), its dark text, its brand colour as the accent |
| dark screens (common for security, developer, trading and media tools) | the app's dark background (or `#000000`), its light text, its brand colour as the accent |
| a strong brand colour field (a coloured splash, a coloured header) | that colour as the background only if its text contrast holds; otherwise keep it for one reveal |

```js
LaunchText.theme({ bg: "#0b1220", ink: "#e8eef7", accent: "#4f8cff" });  // the app's colours
LaunchText.theme("light");                                               // the film's white
LaunchText.theme("dark", stageEl);                                       // one stage only
```

The engine fits every text colour to at least 3.2:1 against the background (4.5:1 for the
ink), keeping the hue, so `hyperframes check` passes on every frame, mid-flicker included.
If the brand colour had to move a lot, it warns in the console (`launch_events.cjs` prints
the warnings); pick another accent from the app's palette then. Keep one theme for the
statements of a video, and switch only at a transition (the logo opening into a dark
scene, a warp back out), like the film does once. Product UI scenes always show the app as
it is.

**Colour.** One small palette drives the lit word, its flicker and the slot candidates:

| Role | Film (measured) | Engine text colour on the white canvas | On a dark canvas |
|---|---|---|---|
| blue (the usual settle colour) | `#0A84F9` | `#0A84F9` | `#0A84F9` |
| orange | `#F67824` | `#E8691A` | `#F67824` |
| lavender | `#CBAEF9` (lighter `#DAC9F8`) | `#9D7BF0` | `#CBAEF9` |
| pink | `#FBC4C5` | `#E6608F` | `#FBC4C5` |
| green | `#08B450` | `#07A64B` | `#08B450` |

On white, the film's lavender and pink are too light to read as text, so the engine
deepens them; on black they read as they are. The brand colour takes the blue's place as
the accent. Give the theme a `palette` of the app's own colours to make the flicker the
product's too. The product's mark uses the brand colour, never this palette.

---

## The words

The copy carries this style, so write it first.

- **One statement per screen**, 2–7 words per line, at most 2 lines. A statement is a
  phrase or a short sentence: "The horse that fits your weekends",
  "Your rides stay private. Zero data shared."
- **Sentence case.** Product names keep their capitals ("Stable Match, now in Horse Tinder").
- **Full stops only on complete sentences.** "Verified stables. Real photos." has
  them; titles and fragments ("Match on temperament", "120+ breeds, sorted for
  you") don't.
- **Second person.** "your weekends", "your pace", "the ride you want".
- **Parallel frames** that come back: "Match on ___", "Ride with ___". The last
  word is the slot that cycles.
- **Numbers with a plus** when they grow: "120+ breeds". They count up while the sentence
  types.
- **One lit word** per statement, at most: who it is for ("for **Riders**"), or the slot.
- **A chain, not a list.** Each statement leads to the next:
  what it is → what powers it → what you can do → what it connects to → why you can
  trust it → the close, ending on the lockup: the logo beside the product's name.
- **Break lines by meaning**, never mid-phrase: "Find the horse that fits / your
  weekends and your pace", not "Find the horse / that fits your weekends".

Turning ordinary copy into launch copy:

| Instead of | Write |
|---|---|
| "Our platform leverages AI to streamline invoice processing." | "Invoices that / file themselves" |
| "Supports 30+ integrations with popular tools." | "Works with the tools / you already use" → orbiting logos → "30+ integrations" (counting) |
| "We take privacy and security seriously." | "Your data stays yours. / Nothing is kept." |
| "Continuously discovers internet-facing assets." | "Every exposed server, / found before anyone else" |
| "Filters now persist across page reloads (#42)." | "Your filters, / exactly where you left them." |

Everything on screen still follows the claims rule: the statement must be true of the
product (or requested by the user). The style changes how things are said, not what is
claimed.

---

## The motion

Words never fade, blur or slide in. They **arrive whole**, like a model streaming its
answer, and only the layout moves.

| # | Move | How it behaves (measured) | Engine |
|---|---|---|---|
| 1 | **Streamed typing** | the first word arrives in token-sized pieces ("Po" → "Power" → "Powered", 2 then 3 frames apart); then whole words land 4, 4, 5 frames apart (0.13–0.17 s); no fade | default (`pieces`, the rhythm); `step` fixes the gap |
| 2 | **Live centring** | as the line grows, the block glides to stay centred: exponential ease-out, ≈ 0.6 s to settle; a new line makes the block glide up | automatic |
| 3 | **Lit word** | the key word is typed letter by letter (2 frames per letter) and flickers through the palette, 4 frames per colour, for ≈ 1 s, then settles on the accent | `{word}`, `flicker`, `accent` |
| 4 | **Flicker all** | on the closing line, every chunk flickers as it lands, then settles to the ink | `flickerAll: true` |
| 5 | **Slot cycling** | a fixed frame ("Match on ___") tries 3–4 words, each whole and in its own colour, ≈ 0.37 s each; the last one stays | `{slot}`, `slot: [...]` |
| 6 | **Hard reset** | between statements the old one is gone in one frame (a blank frame, or the next statement's first piece lands on the old one's last frame) | `exit: "cut"` (default) |
| 7 | **Condense into the logo** (/brag's own) | the statement shrinks toward its centre, blurs and fades (0.3 s) while the product's logo comes into focus in its place: bare, in its own colours (≈ 1.3× the cap height), out of a soft blur, settling from 6% larger with no overshoot (0.5 s), as a soft glow of the brand colour blooms around it and then breathes; with no logo, the brand orb (a circle the size of the cap height in the brand colour, with light and depth, which breathes once after it lands). Then it hides, stays, opens the next scene or fills the frame | `exit: "mark"`, `markEnd` |
| 8 | **Thinking dots → caret** | accent dots after the first word bounce (≈ 0.9 s), then a thin caret types the rest letter by letter (≈ 30 per second) and blinks when done | `think: {after: 1, dur: 0.9}` |
| 9 | **Dim** | the statement fades to grey while the next element takes focus | `exit: "dim"` |
| 10 | **Slide out** | the finished line slides left out of frame in ≈ 0.25 s | `exit: "slide"` |
| 11 | **Blur out** | the statement blurs away (≈ 20 px) in 0.4 s | `exit: "blur"` |
| 12 | **Lockup** (/brag's own) | the closing line condenses into the logo, which slides left while the product's name types in beside it, word by word, with the key sound; both hold to the end (≈ 1–2 s) | `markEnd: "lockup"` |

### Transitions between scenes

Measured from the film's scene changes; `assets/launch/launch-motion.js` draws them.

| Transition | How it behaves (measured) | Use it for | Engine |
|---|---|---|---|
| **One-frame reset** | the next statement starts on the next frame | statement → statement (the default) | `exit: "cut"` |
| **App open** (/brag's own) | a rounded shape the size of the logo grows out of it to the full frame while its corners flatten (0.45 s, ease in and out), with the next scene fading in inside it and the logo fading away, the way an app opens | into a different world: a dark scene, the product UI, the big reveal | `exit: "mark", markEnd: "open", next: el`; `LaunchMotion.open` opens from any rectangle (a card, a thumbnail, a button) |
| **Warp** | streaks rush outward from the centre while the frame floods with the next background (≈ 10 frames, 0.35 s); the old text fades with it | out of a special or dark scene, back to the main theme; "and now, the product" | `LaunchMotion.warp` |
| **Brand fill** (/brag's own) | a field of the brand colour grows out of the logo to fill the frame and becomes the next background | a colour field before a UI card or a big number | `markEnd: "fill"` |
| **Circle reveal** | a circle grows from a point, accelerating (≈ 9 frames, 0.3 s), with the next scene already inside it | out of a click: the button or the result the cursor just hit | `LaunchMotion.reveal` |
| **Focus pull** | the outgoing scene blurs out (≈ 20 px) while the next sharpens (0.4 s) | statement → product UI, UI → statement | `LaunchMotion.focus` |
| **Camera** | a deep zoom into a field or a card, following along what is typed, then a smooth pull-back to the whole screen | inside a product scene | `LaunchMotion.camera` |
| **Carry-over cut** | the text resets in one frame while floating chips or logos keep drifting across the cut | a run of statements about the same feature | put the floating layer above the stages, outside them |

Product moments (built with `launch-ui.js` and Hyperframes, in the same calm rhythm):

| Move | How it behaves |
|---|---|
| **UI card** | the product UI as a card with a soft shadow, centred, at comfortable size |
| **Cursor click** | an arrow glides to a tile, the tile grows 1.2×, everything else fades, the chosen thing becomes the next scene (`LaunchUI.cursor`, targets measured from the layout) |
| **Typed field, counting number** | a prompt or a form fills in character by character with a caret, numbers count up in the product's own format, all drawn from one scene clock (`LaunchUI.clock`, `typed`, `count`) |
| **Screen wall** | for a product with more screens than scenes: a grid of the real screens (each tile its real page title and a glimpse of it) that the camera glides across, each tile coming alive as the camera reaches it, then pulls back from to show them all (`LaunchUI.wall`); one run showed 32 screens in about 8.5 s |
| **Marquee** | a row of rounded logo tiles slides slowly under a statement, fading at both edges |
| **Orbit** | after a statement builds, integration logos pop in one by one along an ellipse around it (clockwise from the right), the ring turns slowly, far logos are blurred, then the ring breaks outward |
| **Floating chips** | pills with feature names drift at different depths: near ones big and sharp, far ones small and blurred |
| **Streamed answer** | inside the UI, an answer arrives word by word in the UI's own small type, with a shimmer on the "working" line; the camera scrolls with the newest line |

---

## The product's mark

This is /brag's own signature. The film ends its statements in a colour-cycling dot, and
/brag never copies it. Here a statement condenses into **the product's own logo** instead,
shown bare, the way the product shows it: no square, no tile, no pop. The product carries
the motion, so the video can't be mistaken for anyone else's.

- **Find it in step 1.** Take the logo mark from the repo (a `logo.svg`, the navbar, the
  favicon's glyph without its rounded square) and draw it as a simple SVG in its own
  colours that reads at about 110 px on the statements' background. A logo that exists only
  white-on-colour is drawn in the brand colour (or the ink) so it reads on the canvas.
  Record the brand colour and the product's name.
- **How it arrives.** It comes into focus: out of a soft blur (about 12% of its size), from
  transparent, settling from 6% larger to its size in 0.5 s, with no overshoot and no ring.
  A soft glow of its brand colour blooms around it as it sharpens, settles to half, and
  breathes while the logo stays (on the beat once the engine has the music).
- **No logo? The brand orb.** When the product has no logo, the mark is the brand orb: a
  circle the size of a capital letter in the brand colour, with light and depth (a lighter
  top, a deeper edge). It comes into focus like the logo, then takes one **breath** (0.9 s):
  it swells about 8%, its light brightens and moves, and a soft glow of the brand colour
  blooms around it, then it settles. While it stays on screen (the lockup "● Name", or
  `keep`), it keeps breathing, smaller and slower (every 2.4 s). Before it opens a scene or
  fills the frame it is calm, and its light flattens into the brand colour as it grows. It
  is one hue only and never cycles through colours, which keeps it far from the film's
  dot. Don't invent a logo, or use a letter, for it.
- **The breath follows the music.** Once the engine has the beats (`LaunchText.music`),
  the orb's first breath (and the logo's glow) starts on the first beat after it lands and
  lasts two beats, so the swell peaks exactly on the next beat. The opening, fill or slide
  that follows starts on a beat too, and the slow breath while it stays takes one bar (four
  beats). At 124 BPM a breath is 0.97 s. Without music it keeps the 0.9 s and 2.4 s timing.
- **Give it to the theme.** Use `LaunchText.theme({ …, mark: { svg, color, name } })`, or
  `src` for an image file. With no logo, pass `{ color, name, orb: true }`; without
  `orb: true`, `launch_events.cjs` prints a note, so a forgotten logo gets noticed.
- **The app icon, only when asked.** When the user asks for the app icon ("show our app
  icon", "like an iOS icon"), the mark can sit on a tile again: `tile: true` (the brand
  colour), `background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)"` for a gradient tile
  (with `color` as its main colour), or the whole app icon SVG with `tile: "own"` (the
  engine draws no tile; `radius`, default 0.23, matches its corners). `style` adds CSS to
  the tile. `land: "pop"` brings back the older landing (from 55% with a small overshoot and
  one soft ring). Use these rather than a CSS `!important` override on `.lt-mark`: an
  override can't reach the ring, or the flat colour the tile turns into as it grows.
- **Its moves:**
  - **condense:** a statement becomes the logo as it comes into focus (`exit: "mark"`);
  - **open:** a rounded shape grows out of the logo into the next scene, like an app
    opening (`markEnd: "open", next`);
  - **fill:** a field of the brand colour grows out of the logo (`markEnd: "fill"`);
  - **lockup:** the logo slides left and the product's name types in beside it
    (`markEnd: "lockup"`), which is the close;
  - **on its own:** `LaunchText.mark(tl, stage, { at, x, y })` gives a logo moment
    anywhere.
- **Give it the logo's own motion.** Look at what the logo shows, and play that motion
  once as it comes into focus: an eagle's wings beat, a radar sweeps, a shield's check
  draws, a wheel turns, a horseshoe swings on its nail. A statement with a mark returns
  `glyph` and `markAt`; tween the glyph or its SVG parts from `markAt` with ordinary
  `tl.fromTo` (motion-opportunities.md). This isn't optional polish: it is what makes the
  moment the product's. (The orb has no logo, so `glyph` is null: its breath is its motion,
  built in.)
- **How often:** once or twice in the middle as a transition (open, fill), and once at the
  close (lockup). Not after every statement: the one-frame reset stays the
  default.

For example, an attack surface manager whose logo is a teal radar shows the radar bare on
its dark canvas, and the sweep turns once as it comes into focus. A rounded shape grows out
of it into the asset inventory, and the video closes on the radar beside the product's name.

---

## Pacing

- **Build** a statement in 0.6–1.2 s (4–5 frames per word; letters for the lit word).
- **Hold** the finished statement 1.2–1.8 s. Hold the title and the close a little longer.
- A **new statement every 2.5–4 s**. A 30-second video holds 6–9 statements; a 60-second
  one 12–16; a 117-second one about 27, with product moments between them. A longer video
  has more statements and moments at this same pace, never slower ones.
- **Resets are instant.** The energy comes from the typing rhythm, not from transitions.
  Use an app open, warp or focus pull only where the story changes place: about one every
  8–15 s (2–4 in 30 s, 8–11 in 117 s; at most one in the quick version).
- Put each statement's first word on a beat of the music.

## Sound

**The typing sound (on by default).** In the film's opening, before the beat starts, every
typed piece lands with a short, deep "key" hit. Measured: its pitch falls fast from about
1.5 kHz to 75 Hz (the energy passes 400 Hz → 200 Hz → under 100 Hz within 15 ms), with a
knock near 420 Hz and a slightly wide stereo image; it is down 30 dB after about 30 ms.
The hits share one shape but change pitch a little from one to the next, the lit word's
letters sit higher, and they land about 0.1–0.13 s apart. Under the full beat later on,
the music's kick and hats carry the rhythm.

In /brag every launch video gets this sound on its typing:

1. `launch_events.cjs` reads the composition's event log (every word, piece, letter,
   slot and caret character, with its time).
2. `typing_track.py` builds one track from it with an original "deep key" synth, tuned
   until its measurements matched the film's hit (no audio is taken from the film). It
   rotates the pitch a little, brightens letters, keeps fast letters at least 90 ms apart,
   caps each hit so the final loudness step can keep it intact, and writes the music with
   a short 4 dB dip under every hit (sidechain ducking), so the hits cut through a full
   mix without being louder.
3. Play the ducked music in place of the original (same volume) and the typing track on
   its own audio track at volume 1.0.
4. After finalizing, `audio_report.py --hits` checks the final file: a typical hit's onset
   should rank at or above the 85th percentile of the whole video, within 20 ms of the
   text. (Before this check existed, the loudness step silently flattened the hits.)

With a voice over, use `--under-voice` (word hits only, 6 dB lower). Only typed text gets
the key sound; rows arriving in a UI, clicks and toggles get their own soft sounds.

**Music.** The film rides on an energetic electronic track, about 128 BPM, with a beat on
every quarter, a short breakdown in the middle, and a quiet ending on the logo. In /brag:
compose the `pulse` style at 120–128 BPM (audio.md) unless the product's mood asks for
`warm` or `cinematic`. Give the product-demo part energy 2, put a `break` under a dark or
trust scene, and energy 3 for the close. Other effects: clicks on real UI actions, a small
soft chime or pop when the logo comes into focus, and a whoosh on an app open, fill, reveal or warp only when the
music has no hit there (`typing_track.py --transitions` adds soft ones and skips the
whoosh where the music's cue file has a hit).

## Shapes by video type

Lengths follow video-types.md. Every video covers everything on the plan's coverage list.
The full video takes the room that needs, at most 117 s; the quick version (only when
asked) is 27–47 s and covers the same list in less depth.

**Product demo (usually 47–82 s; 82–117 s with many features):** the title with the lit
word → what powers it, condensing into the logo, which opens a dark scene or the product
→ every feature, each a statement and a product moment (UI card, camera), in the order a
user meets them → a warp or focus pull back → the closing line → the lockup. There are no
chapter numbers or progress bar in this style; the statements are the chapters. With many
features, show more in each scene: a parallel frame ("Match on ___") whose slot names one
feature per word while the camera moves to each on its screen, floating chips for the
small ones, an orbit for integrations and counts, and for a large product the screen wall:
every screen that has no scene of its own, by its real title, in one glide and pull-back
(`LaunchUI.wall`, about 8.5 s for 32 screens). It is the honest way to show everything
within 117 s: each screen is really on screen, titled as the product titles it.

**Feature brag (usually 42–82 s):** the problem as a statement ("Every refresh wiped your
filters.") → life before as a product moment, dimmed → the feature's name, lit and
flickering → the feature at work, every use it adds (UI card, camera, cursor) → what got
better as a slot or a counting number → the lockup. Keep the problem-first order from
video-types.md; this style only changes how it is written and moved.

**Before and after (usually 32–62 s):** "Before" as a dimmed UI moment → a statement
condensing into the logo → the logo opens on "After" in use → a statement naming what
changed. Every place the change touched gets its own before → after pair.

**The quick version (27–47 s; before and after 22–32 s):** the title with the lit word → the key flow in
use (one statement, one product moment) → a quick run through every other feature (a slot
naming each one while the camera glimpses its screen, 1–2 s each) → the lockup. One-frame
resets, and one app open at most.

## Build it

1. Copy `assets/launch/launch-text.js`, `launch-motion.js`, `launch-ui.js` and
   `launch.css` into `composition/assets/launch/`. GSAP is already in the blank template.
2. Link them in `<head>` (the three scripts in that order), paste the project's
   `@font-face` rules into `<style>`, and name that family in `--lt-font`
   (`:root { --lt-font: "Geist", sans-serif; }`). The stylesheet names no family of its
   own, because a family without an `@font-face` fails lint.
3. Make the scenes. The simplest is plain layers under the root, one per scene
   (`<div id="sLight" class="lt-stage"></div>`, a `<div class="scene">` for a product
   screen): the transitions show and hide them, and put each incoming scene on top, so DOM
   order doesn't matter and a scene can come back later (statement → product → statement
   → product). Use `LaunchMotion.cut` for a hard cut between scenes, and build the
   transitions in time order. Timed `.clip` scenes work too; Hyperframes then shows and
   hides them, so give them windows that end where their outgoing transition ends.
4. In `build()` (after `document.fonts.ready`), set the theme, give the engine the plan's
   beat grid (`LaunchText.music({ bpm })` with the plan's tempo, or a bundled track's cue
   file `tempo` and `beats`; step-3-compose.md, "Beat sync"), then chain statements and
   transitions; each returns its `end`. Put each statement's `at` on a beat
   (`LaunchText.nextBeat(t)` finds one), and its exit on another with `until` when the cut
   must land on the music:

```js
const L = window.LaunchText, M = window.LaunchMotion;   // Horse Tinder: a fictional app
const mark = { name: "Horse Tinder", color: "#4f8cff", svg: HORSESHOE_SVG };  // its logo, in its own colours
L.theme({ ...L.PRESETS.light, mark });                   // or the app's {bg, ink, accent, mark}
L.theme("dark", dark);                                   // one scene in the other theme
const a = L.statement(tl, light, { at: 0.1, lines: ["Horse Tinder for {Riders}"] });
const b = L.statement(tl, light, { at: a.end + 1 / 30, lines: ["Match on {slot}"],
  slot: ["temperament", "pasture", "trust"], exit: "mark", markEnd: "open", next: dark });
// the logo's own motion as it comes into focus: the horseshoe swings on its nail
tl.fromTo(b.glyph, { rotation: -18, transformOrigin: "50% 12%" },
  { rotation: 0, duration: 1, ease: "elastic.out(1, 0.35)" }, b.markAt);
// "none": it stays until the next statement on this stage, or until the warp takes the stage away
const c = L.statement(tl, dark, { at: b.end + 0.2, lines: ["Your rides stay private.", "Zero data shared."],
  think: { after: 1, dur: 0.9 }, exit: "none" });
const w = M.warp(tl, { at: c.exitAt, from: dark, to: uiScene, color: "#f4f6fb" });
M.camera(tl, ui, [{ t: w.end, x: 700, y: 408, zoom: 2.4 }, { t: w.end + 2, x: 960, y: 540, zoom: 1 }]);
// … every feature …, then the close: the line becomes the logo, and the name types in beside it
L.statement(tl, brand, { at: f.end, lines: ["Swipe right on your next {ride}"], exit: "mark", markEnd: "lockup" });
```

5. **Check the reading time now, before any music.** `launch_events.cjs` (step-3-compose.md,
   "Lock the timing first") prints one row per statement; fix every `SHORT` one and run it
   again until all say `ok`. Then the times are locked: compose the music to them
   (audio.md), once.
6. Animate the product screens with `launch-ui.js` (step-3-compose.md, "Animate the product
   screens"): cut the "…" labels first, then one scene clock for typed fields and
   counters, appearances, the cursor and its clicks, taps, the "Sample data" label, and the
   screen wall for a large product:

```js
const U = window.LaunchUI;
U.ellipsis(ui);                                         // first, before anything is measured
U.sample(uiScene);                                      // pinned to the frame, outside the camera
const SEARCH = "Calm horse for trail rides near me", typeAt = w.end + 0.15;
U.clock(tl, (t) => { query.textContent = U.typed(SEARCH, typeAt, 28, t); });
U.keys(typeAt, SEARCH, 28);                             // key sounds: every second character, 90 ms apart
U.show(tl, ui.querySelectorAll(".row"), w.end + 1.6, { stagger: 0.15 });
U.cursor(tl, ui, [{ t: w.end + 2.1, at: [1380, 860] }, { t: w.end + 2.7, at: ui.querySelector(".row"), click: true, hide: true }]);
```

7. A camera moves an element past the frame on purpose: mark it
   `data-layout-allow-overflow`.
8. Run `check`, and read its `--json` report with `check_summary.py`. The engine's colours
   pass contrast, and its transitions don't report their planned cross-over as overlap.
9. When the timeline is final, make the typing sound and the ducked music, and the
   sound-effect tags with `sfx_tags.py` (commands in step-3-compose.md), and after
   finalizing, check the typing with `audio_report.py --hits`.

Options at a glance: `at`, `lines`, `theme` (with `mark`), `step`, `pieces`, `unit`,
`rate`, `caret`, `accent`, `ink`, `flicker`, `flickerAll`, `slot`, `slotColors`,
`slotHold`, `think`, `hold` or `until`, `exit` (`none`: stays until the next statement on
its stage), `markEnd` (`hide`, `keep`, `lockup` + `name`, `open` + `next`, `fill`),
`markHold`, `size`, `maxWidth`, `noWrap`, `y`. The mark takes `svg` or `src`, `color`,
`name`, `orb` (no logo, on purpose), and only for an app icon the user asked for: `tile`
(`true`, or `"own"` for an app icon with its own tile), `background`, `radius`, `style` and
`land` (`"pop"` for the older landing).
`LaunchText.mark(tl, stage, {at, x, y, hold, keep})` shows the logo on its own.
`LaunchText.music({bpm, offset} | {bpm, beats})` gives it the music's beats, and
`LaunchText.nextBeat(t)` returns the first beat at or after `t`. `LaunchText.timing()`
returns the reading-time rows that `launch_events.cjs` prints.
`LaunchMotion.open / reveal / warp / focus / cut / camera` join scenes, and
`LaunchMotion.moves` lists them. `LaunchUI.clock / typed / doneAt / caret / count / keys /
show / hide / pop / swap / fromTo / quiet / cursor / tap / point / ellipsis / sample / wall`
animate the product screens. Each file's header documents every option. Older compositions that
say `exit: "dot"` get the logo.

The engine is seek-safe. Visibility uses GSAP property sets, and the look is computed from
each move's own clock, which runs to the end of the scene it touches. Hyperframes renders
frames out of order in parallel workers, and a tween's `onUpdate` never runs for a frame
the renderer jumped past, so never drive visibility from a callback. And the reverse:
whatever a set makes visible must already be placed and coloured on every frame, not only
after its start time. On the frame of the set, the tween's time can land a hair before it,
and a mark placed only from its start time on showed for one frame in the stage's top-left
corner. Every transition also resets, at its own start, what it will change, so a frame
drawn after a seek back looks as it did before the transition; and the first camera on an
element holds its first key from the start of the video. The engine and `LaunchUI` were
tested for this: seeked forward, backward and in a shuffled order, every visible element
matched on every sampled frame.
Nothing in the engine tweens visibility on a `.clip`; Hyperframes owns that. While a focus
pull, app open, circle reveal or warp shows two scenes at once (or floods one), it marks
them `data-layout-check="ignore"` (for focus and warp, only the outgoing one), so `check`
doesn't report the planned cross-over as text overlapping or hidden under text; both are
audited again from the transition's end. The warp's streak layer is never audited.

## Don't

- Fade, blur, slide or bounce individual words in. Only the layout moves.
- Light up more than one word per statement, or use gradient text.
- Centre each line separately. Lines are left-aligned in a centred block.
- Write three lines, or long sentences. Split them into two statements.
- Force the white canvas on a dark app, or switch themes between every statement.
- Put the key sound on anything but typed text, or leave the typing silent.
- Use more than about one scene transition every 8 s, or use one where a reset would do.
- Stretch a video with longer holds or repeats; extra seconds go to more of the product.
- Leave out any feature to make a video shorter, or fold it into another scene where it
  is never actually shown, even in the quick version. When time is short, show more in
  each scene (grouped features, a quick run), never less.
- Add chapter numbers, eyebrows or progress bars. Those belong to other tones.
- Copy the reference film's brand (its logo, product names, lines or its own typeface), or
  its signature moves: a colour-cycling dot, or any other moment a viewer would recognise
  as that film's. The product's own logo is this style's signature.
