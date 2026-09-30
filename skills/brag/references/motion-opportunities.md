# Motion opportunities

Find what should move, and move it without being asked. Nobody should have to write "make
the wings flap": if the logo is a bird, its wings beat. The user asks for the video; /brag
spots the motion that makes it feel alive, builds it, and lists it in the plan so it can
be switched off in one sentence.

Look at every visual from step 1 and ask: **what does this thing do in the real world?**

## The logo and any mascot

| The mark shows | Natural motion | At rest | Optional sound |
|---|---|---|---|
| a bird, a bat, a butterfly, an insect, a dragon | wings beat as it flies in | lands, wings folded as in the logo | soft wing beats (`make_sfx.py wingbeats`); its call once, at the finale |
| a radar, a sonar, a scanner, a lighthouse | the sweep or the beam turns | stops at the logo's angle | a soft blip on each pass (`blip`) |
| an eye, a face, a character | blinks, looks toward the product | open, straight ahead | none |
| a shield, a lock, a key | a shine sweeps across; the lock clicks shut; the key turns | closed, straight | a click |
| a flame, a spark, a star | flickers, twinkles | steady | `shimmer`, very soft |
| a wave, water, wind, a flag | ripples, rolls | still | none |
| a wheel, a gear, a fan, a globe, a planet | turns | stops at the logo's angle | a quiet tick, or none |
| a rocket, a plane, a paper plane, a car | travels in on a path | parks in the lockup | `whoosh` |
| a plant, a leaf, a sprout, a tree | grows, unfurls | full size | a soft rise |
| a heart, a pulse line, a signal | beats, draws | steady | a soft thump |
| a bell, a speaker, a chat bubble | rings, pulses, pops | still | a soft ring or pop |
| a clock, an hourglass, a timer | hands move, sand falls | the logo's time | a tick |
| a pin, a target, a crosshair | drops and bounces; locks on | still | a soft drop, a lock click |
| a letter mark or an abstract shape | assembles: strokes draw on, parts slide together | the exact mark | one soft impact |

Rules, because a moving logo is still the brand:

- **At rest it is exactly the logo.** Animate SVG groups directly; cut a raster logo into
  a verified rig first (step-3-compose.md, "Animating a logo"). Never recolour or distort
  it at rest. Mirroring or squashing during the motion is fine; say so in the plan.
- **Settle every wobble and tilt to zero** before the lockup.
- **Short.** A logo move lasts 0.6–1.5 s, except one signature finale (the mascot carries
  the story's one key item through the flow and lands in the lockup).
- **Match the rhythm.** Wing beats, sweeps and pulses land on the music's beats.
- **The product's mark too.** In `launch` the statements condense into the bare logo
  (launch-style.md, "The product's mark"). As it comes into focus, it plays the same motion
  in small: the wings beat once, the sweep turns, the check draws, the horseshoe swings on
  its nail. Tween the statement's `glyph` (or its SVG parts) from its `markAt`, and list it
  under `## Motion found` like any other. Its glow breathes on its own. A product with no
  logo gets the brand orb, whose breath is built in; list it as found too.

## The product itself

| On screen | Natural motion |
|---|---|
| a number, a total, a score | counts up (in `launch`, inside the sentence, while it types) |
| a chart | lines draw left to right, bars grow, a donut sweeps round |
| a list, a table, search results | rows arrive one by one, one per beat (every other beat when each row must be read) |
| a search box, a prompt, a form | typed with a caret in the UI's own font; the cursor clicks submit |
| a scan, a discovery, a sync, an import, a build | progress moves, and the results appear as they are "found": assets on a map, items in a list, nodes on a graph |
| a graph, a network, a dependency map | nodes pop in, then edges draw between them |
| a map | pins drop, routes draw, regions fill |
| a status, a badge, a severity | changes in place: "Open" → "Fixed", red → green |
| toggles, switches, checkboxes | flip with a cursor click |
| notifications, toasts, chat messages | slide in from where the app puts them |
| an empty state | fills with the plan's fake data |
| a before and after | the same frame; only the change moves |

## Icons and illustrations

- A feature icon next to its statement plays its small natural move once as it appears
  (the bell rings, the shield shines, the magnifier sweeps).
- An illustration gets gentle depth (layers drift at different speeds), or only its one
  part that naturally moves.

## How much

- **One signature motion** per video (usually the logo's), plus every natural motion the
  product has, each in its own moment so they never compete on screen.
- **Motion that explains.** The best motion shows what the product does: the radar sweeps
  because the product scans; the rows arrive because the product finds them.
- In `launch`, product motion stays calm and smooth; the typing carries the energy. Build
  it with `launch-ui.js`: counters and typed fields from one scene clock, rows and cards
  with `show`, clicks with its cursor, taps on a phone (step-3-compose.md, "Animate the
  product screens").

## Sound for motion

Something that naturally makes a sound can get a soft version of it: wing beats, one call
for the finale, a blip per radar pass, a click when a lock shuts. Keep it under the music,
and never on top of a typed statement's key hits. Pick the sound people recognise, not the
literal one: film birds of prey scream like a red-tailed hawk, whatever the species (audio.md,
"Route 3"). Write any substitution into `credits.md`.

## In the plan

List every candidate under `## Motion found` in `brag-plan.md`, marked as found, not asked:

```markdown
## Motion found (done by default; the user can say "keep the logo still" to switch one off)
| Element | Motion | Why | Sound |
|---|---|---|---|
| Logo: a radar dish | the sweep turns twice, stops at the logo's angle | the product scans | a soft blip per pass |
| Dashboard: "1,284 assets" | counts up while the sentence types | the number is the claim | none |
| Asset graph | nodes pop in, edges draw | shows discovery | none |
```

Build them in step 3, and name them in the delivery message, so the user learns what was
added and can say what to keep.
