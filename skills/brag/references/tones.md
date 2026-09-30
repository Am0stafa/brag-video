# Tone reference

Ten tones. Each changes scripting energy, pacing, typography personality, and transition style. The scene counts below describe about 30 s of video; a longer video repeats the tone's rhythm with more scenes, never slower ones (video-types.md, "How long"). **`launch` is the default** whenever the prompt doesn't ask for another. The prompt picks one in plain words ("like an Apple keynote" → `polished`, "for the sprint review" → `changelog`, "like a movie trailer" → `cinematic`); a freeform direction always refines or overrides the preset.

---

## `launch` (the default)

**Energy:** Bright, fast, confident. Big statements typed onto a flat canvas, one idea at a time, each typed piece landing with a deep "key" sound, driven by an energetic electronic beat. This is how modern AI product launch films write on screen. The full spec, measured frame by frame, is in [launch-style.md](launch-style.md).

**Voice:** Short statements in sentence case, second person, 2–7 words per line, at most two lines. Parallel frames with a cycling last word ("Match on ___"). Full stops only on complete sentences.

**Typography:** The project's font (else Geist SemiBold) at about 118 px on 1080p, lines left-aligned in a centred block, in the app's own theme: dark text on the app's light background, or light text on its dark one (the film's black on near-white when the app gives nothing). One word per statement lit in the brand colour.

**Motion:** Text streams in like a model's answer: the first word in token-sized pieces, then whole words 4–5 frames apart, no fades; the block glides to stay centred. The lit word flickers through a five-colour palette, then settles. Statements reset in one frame; where the story changes place, the product's bare logo opens the next scene the way an app opens, a warp rushes back out, a focus pull or a camera deep zoom enters the product. Thinking dots turn into a typing caret. Logos, numbers and screens get their natural motion without being asked (motion-opportunities.md). The engine in `assets/launch/` does the text and the transitions.

**Sound:** The deep key on every typed piece (`typing_track.py`), `pulse` music at 120–128 BPM, clicks only on real UI actions.

**Hook style:** The product and its domain, with the domain lit.
```
Horse Tinder for Riders        ← "Riders" flickers, then settles blue
```

**Feature style:** A statement, then the product in use (a UI card, a deep zoom, a cursor click).
```
Match on temperament → pasture → trust
```

**Outro style:** The closing line flickers as it lands ("Swipe right on your next ride"), condenses into the product's bare logo as it comes into focus, and the logo slides aside as the name types in beside it: the lockup.

**Transitions:** One-frame resets between statements; 2–4 scene transitions per 30 s: the product's logo opening the next scene like an app, a warp out of a special scene, a focus pull, a camera deep zoom and pull-back; a quick slide-out left. Never a slow crossfade.

**When to use:** Always, unless the prompt asks for another tone. Words that pick it explicitly: "OpenAI-style", "like an AI launch video", "launch style", "typed statements".

---

## `default`

**Energy:** Playful, clean, postable. The product gets to be funny on its own terms.

**Voice:** First person plural. Warm. Direct. No corporate language.

**Typography:** Mixed case. Comfortable weight. Let words breathe.

**Pacing:** 4-5 scenes. Each scene 3-5 seconds. Comfortable rhythm.

**Hook style:** A simple question or observation that sets up the reveal.
```
Dating apps were built for humans.
Obvious mistake.
```

**Feature style:** Short punchy phrases. One idea per scene.
```
Swipe through eligible horses near your pasture.
```

**Outro style:** The product name, then a tagline. Light punchline.
```
Horse Tinder.
Find your perfect stablemate.
```

**Transitions:** Crossfade or clean slide.

**When to use:** Most absurd consumer apps. Projects that have personality without trying too hard.

---

## `polished`

**Energy:** Serious, elegant. Uses restraint as the creative choice.

**Voice:** Third person or no voice. The product speaks for itself.

**Typography:** Mixed case. Light-to-medium weight. Generous letter-spacing. Nothing aggressive.

**Pacing:** 3-4 scenes. Each scene 4-6 seconds. Confidence through slow reveals.

**Hook style:** A single strong image or the product name at full scale.

**Feature style:** One feature per scene. No bullets. No lists.
```
Wing certification
upon completion.
```

**Outro style:** Product name. Tagline. Silence.

**Transitions:** Slow crossfade (0.6-0.8s).

**When to use:** Projects that aren't jokes. Products that want to feel premium. Anytime the user says "clean" or "elegant."

---

## `yc-parody`

**Energy:** Deadpan startup launch energy. The joke is how seriously it's delivered.

**Voice:** Serious. Matter-of-fact. No winking. The absurdity comes from the product, not the tone.

**Typography:** Sentence case. Heavy weight or medium weight. Courier-adjacent for data points. No decoration.

**Pacing:** 4-5 scenes. Structured. Each scene makes one claim.

**Hook style:** The problem, stated completely seriously.
```
Every day, taxis carry us.
But who carries the taxis?
```

**Feature style:** Feature or metric stated as fact.
```
Available in 12 metros.
99.1% fleet uptime.
```

**Outro style:** Product name. The tagline. A URL that implies legitimacy.
```
Taxi for Taxis
The ride-hailing app for ride-hailing assets.
taxifortaxis.com
```

**Transitions:** Hard cut or minimal crossfade (0.2s).

**When to use:** Any recursive or absurd concept that benefits from being played straight. "Psychologists for Chatbots", "Taxi for Taxis", "Briefcase for Baby."

---

## `chaotic`

**Energy:** Fast, loud, unhinged. The video is the joke.

**Voice:** Aggressive. SHORT WORDS. CAPS. Metric dumps. Exclamation marks optional but not mandatory — confidence is louder.

**Typography:** ALL CAPS. Heavy weight. Slightly oversized. Some words tilted. Some words larger than expected.

**Pacing:** 6-8 scenes. Some scenes under 2 seconds. Never more than 4 seconds per scene.

**Hook style:** Something that shouldn't exist, stated at full volume.
```
TRANSPORTATION WAS TOO CALM.
```

**Feature style:** Rapid-fire. One word or one number per beat.
```
8,400 BOARS
3 MINUTE ETA
TUSKS-FIRST PICKUP
```

**Outro style:** The name slams in. Tagline hits. Cut to black.
```
UBER FOR WILD BOARS
On-demand chaos, now with routing.
```

**Transitions:** Hard cut. Flash cut (brief white/black frame). Zoom cut (scale 1.2→1.0 on entrance).

**When to use:** Chaotic concepts, logistics parodies, anything that can be played as a hype reel. "Uber for Wild Boars", anything with urgency or speed.

---

## `deadpan`

**Energy:** Calm. Dry. The joke is that nothing registers as unusual.

**Voice:** Minimal. One observation. Then the product. That's it.

**Typography:** Mixed case. Large. Sparse. Lots of empty space. One thought at a time.

**Pacing:** 3-4 scenes. Long holds. 4-7 seconds per scene. The pace is the joke.

**Hook style:** A quiet observation. No setup. No punchline yet.
```
I used to fear the sky.
```

**Feature style:** One sentence per scene. No bullets. No excitement.
```
Now I fear birds, weather, and gravity.
```

**Outro style:** The product name. Nothing else. Maybe a very small tagline. Long hold on empty space.
```
Fish Flight School.
```

**Transitions:** Very slow crossfade (0.8-1.0s). Or long hold before the next scene.

**When to use:** Projects that have a quote as the strongest thing on the site. "Psychologists for Chatbots" testimonial-forward approach. Anything where restraint makes the joke land harder.

---

## `cinematic`

**Energy:** Dramatic. Trailer-scale. The product is being treated like a blockbuster.

**Voice:** Epic. Short declarative sentences. Each one lands before the next begins.

**Typography:** ALL CAPS or heavy mixed case. Full-bleed scenes. Large type. Significant scale.

**Pacing:** 4-5 scenes. 3-5 seconds each. Dramatic reveals, not quick cuts.

**Hook style:** A sweeping statement about the world, stated seriously.
```
For too long,
fish were told to stay underwater.
```

**Feature style:** The product's capabilities stated like superpowers.
```
Thermal identification.
Cloud navigation.
Emergency splash landing protocols.
```

**Outro style:** Product name slams in full-screen. Tagline. Music swell implied.
```
FISH FLIGHT SCHOOL
The sky was never the limit.
```

**Transitions:** Dramatic wipe or slow crossfade with scale (scene enters at 0.95, reaches 1.0).

**When to use:** Anything with natural epic quality. "Fish Flight School" maps perfectly. Anything involving scale, nature, or grand claims.

---

## `app-store`

**Energy:** Clean. Professional. Feature-forward. The product is real (even when it's not).

**Voice:** Feature-benefit. Third person. Present tense.

**Typography:** Title case. Medium weight. Clean, readable. No aggression.

**Pacing:** 4-6 scenes. Each scene: product name or feature name, then 1-2 supporting details.

**Hook style:** Product name + tagline, clean.
```
Psychologists for Chatbots.
Because even helpful assistants need help.
```

**Feature style:** Feature card structure. Name + brief description.
```
Prompt Trauma Processing
Identify and resolve harmful conversation patterns.
```

**Outro style:** CTA-style. Call to action or download prompt.
```
Available now.
All chatbot models welcome.
```

**Transitions:** Clean slide or wipe (0.35-0.45s). Nothing dramatic.

**When to use:** Products that benefit from being taken seriously as a product, even if absurd. Good for anything B2B-parody or therapy/wellness adjacent.

---

## `ai-demo`

**Energy:** Calm, confident, precise. The product thinks on screen; the edit stays out of its way. Borrowed from how AI labs present their launches: quiet type, one idea per beat, and the model visibly working.

**Voice:** Sentence case, declarative, short. The product's own claims, never superlatives. "It reads every contract, and shows its work."

**Typography:** Large, light-to-medium display weight, generous tracking on small mono eyebrows (`03 / 11 · VERDICT`). Lots of air.

**Pacing:** Chapters for a tour (4–7 s each), 3–5 scenes for a short demo. Slow push-ins on the UI; soft blur-dissolves through the background.

**Signature moves:** a prompt typed into the product's own composer; a "thinking" or tool-call list that ticks from spinner to check; an answer that arrives with its citations; a verdict that lands with a small stamp.

**Hook style:** A number or a situation at scale, then the need.
```
4,200 support tickets this week.
Every one needs an answer.
```

**Outro style:** The logo lockup and one line from the product's own copy.

**Transitions:** Soft dissolves (0.4–0.5 s), no wipes, no bounce.

**When to use:** When the prompt asks for a dark, calm keynote that shows an agent thinking: "show it thinking", "dark keynote", "agent demo". (For "OpenAI-style" launch videos, use `launch`.)

---

## `changelog`

**Energy:** Calm, informative, benefit-first. Clear beats clever. The register for showing a shipped change to people who did not read the diff: product managers, design, support, the rest of the team.

**Voice:** Plain language, addressed to the person who gets the benefit. "You can now…", "Filters stay put." No engineering words: no component names, no ticket jargon, no "refactored" or "implemented". Say what a user feels, not what the code does.

**Typography:** Mixed case, medium weight, generous spacing. Nothing shouts; the before → after cut carries the emphasis.

**Pacing:** 4–6 scenes. The feature at work gets the longest stretch (8–15 s), because the viewer is reading a product, not a slogan.

**Hook style:** The old pain, in one line, the way the person who hit it would say it.
```
Every refresh wiped your filters.
```

**Feature style:** The change shown, with at most one line of text over it.
```
Now they stay.
```

**Outro style:** What it unlocks for the person who asked, then the reference. Small, factual, no call to action.
```
Set your view once. It's there tomorrow.
#42 · in review
```

**Transitions:** Clean slide or wipe (0.35–0.45 s) everywhere, with one hard cut at the before → after moment. That cut is the whole video; nothing else competes with it.

**When to use:** When the prompt asks for a plain team update: "for the sprint review", "changelog style", "keep it plain". Good for release notes and "here's what shipped" posts. (The default is `launch`.)

**Never:** Overstate. This tone's credibility is the product; see the honesty rule in change-source.md.
