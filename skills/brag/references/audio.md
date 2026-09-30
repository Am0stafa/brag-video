# Audio

Sound is decided from the prompt, never by flags:

```
Did the prompt ask for a voice over ("voice over", "narration", "narrate", "with a voice")?
├─ yes → voice over + a quiet music bed under it + a few sound effects
└─ no  → music + sound effects carry the video
         Music:  a bundled track if it truly fits the mood → otherwise compose one
         Effects: bundled first → generate what's missing → source real-world sounds
The prompt can switch parts off in words: "no music", "silent", "no sound effects".
```

Everything runs in the `brag-tools` image (runtime-docker.md). Every file that is not
original and not from the project goes into `credits.md` with its licence.

---

## Voice over (only when asked)

**Write it first.** The narration sets the pace of the whole video.

- It adds to the pictures and doesn't read the on-screen text out loud. When the voice
  explains, the screen shows; the on-screen text gets shorter.
- It sounds like a person talking: short sentences, everyday words, one idea per line,
  and the product's own terms.
- For a feature brag it follows the story: the problem ("Every refresh wiped your
  filters."), then the change, then what's better.
- About 2.5 words per second at `--speed 1.0`. A 30-second video holds about 60–70
  words, with pauses; a 60-second one about 130–140; a 117-second one about 265.

**Generate one file per scene**, so each line can be placed and trimmed on its own:

```bash
docker run --rm -v "$OUT":/work -w /work brag-tools:0.8.91-r3 hyperframes tts "Every refresh wiped your filters." --voice af_heart -o composition/assets/voice/vo-01.wav
docker run --rm -v "$OUT":/work -w /work brag-tools:0.8.91-r3 ffprobe -v error -show_entries format=duration -of csv=p=0 composition/assets/voice/vo-01.wav
```

Keep each line's text in `tools/vo-NN.txt`, so it can be regenerated.

| Voice | Sound |
|---|---|
| `af_heart` (default), `af_nova`, `af_sky` | American English, female |
| `am_michael`, `am_adam` | American English, male |
| `bf_emma`, `bf_isabella` | British English, female |
| `bm_george` | British English, male |
| `ef_dora` · `ff_siwis` · `jf_alpha` · `zf_xiaobei` | Spanish · French · Japanese · Mandarin |

Match what the prompt says ("a male British voice" → `bm_george`). `--speed 0.9–1.0`
keeps it clear.

Generate the lines while planning (step 2), so the storyboard is timed to real audio.

**Fit the video to the voice.** Start each line about 0.3 s after its scene starts, and
make each scene the line's length plus 0.6–1.0 s of breathing room. Cuts land in the
pauses. To land a visual on a word inside a line, find the pauses in that file:

```bash
docker run --rm -v "$OUT":/work -w /work brag-tools:0.8.91-r3 sh -c 'ffmpeg -hide_banner -nostats -i composition/assets/voice/vo-03.wav -af silencedetect=noise=-35dB:d=0.12 -f null - 2>&1 | grep silence_'
```

**Wire each line on its own track** (20, 21, 22…) with `data-duration` set to its length;
back-to-back lines on one track make lint fail with `duplicate_audio_track`:

```html
<audio id="vo-01" src="assets/voice/vo-01.wav" data-start="0.3" data-duration="2.4" data-track-index="20" data-volume="1"></audio>
```

**Mix.** The voice at volume 1.0. Under it, a music bed: composed in the `minimal` style
(it leaves a gap where speech lives), or a bundled track. Dip the music to about
0.12–0.15 under each line and let it rise to 0.3–0.4 between lines. Either use a volume
lane on the music, or give `compose_score.py` a `duck` window for each line so the dips
are written into the track itself. Hyperframes' audio skill asks for a "carve" that needs
an npm package; /brag doesn't need it and installs nothing. Use only a few quiet sound
effects (0.3–0.5), never on top of a word.

---

## Music

### Route 1 — a bundled track, when it truly fits

All five are one series, "Happy Beats / Business Moves" by ende.app: upbeat, clean,
corporate. They fit `default`, `app-store` and `yc-parody`, and sometimes `polished`.
They don't fit "calm", "epic", "dark", "techy" or trailer moods. The skill doesn't
document their licence; say so in `credits.md`, and prefer a composed score for company
or public videos.

| File | Length | Character |
|---|---|---|
| `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` | 2:44 | most energetic |
| `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` | 1:54 | mid-energy, laid-back |
| `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` | 1:00 | compact loop, punchy |
| `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` | 1:28 | warm, business-like |
| `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` | 1:58 | steady, clean |

They live in `<skill-dir>/assets/music/`, with beat and cue data in `assets/music/cues/`.
Read the `.json` for timings; the `.md` summary covers only the first 25 s. A track must
be at least as long as the video: vol 10 (1:00) and vol 11 (1:28) are too short for a
long tour. A composed score has no length limit.

### Route 2 — compose music for this video (the default when nothing fits)

`compose_score.py` writes original music to the video's scene map. It is synthesised, so
it needs no licence, and the same plan always gives the same file. You write a small
plan from the storyboard: the sections with an energy level, the hit points, the style.
With `launch`, write it from the statements' locked times: build the statements first and
get every row of the reading-time check to `ok` (step-3-compose.md, "Lock the timing
first"), so the music is composed once.

| Style | Sounds like | Use for |
|---|---|---|
| `pulse` | an always-on arpeggio, "data blips", four-on-the-floor | the default under `launch`; AI, developer, security and data tools, anything technical |
| `cinematic` | big pads, low toms and booms, a slow arpeggio | launches, trailers, dramatic reveals |
| `warm` | bright plucks, a soft kick, claps and shakers; best in a major key | friendly consumer products, playful demos |
| `minimal` | pads and a soft pluck, a gap where speech sits, almost no drums | under a voice over, calm videos |

Energy: `0` pad only, `1` + arpeggio, `2` + drums and bass, `3` + bells, lead, and brighter.
Roles (optional): `hook` (tension, a ticking clock, data blips), `break` (drums out),
`build` (riser, snare roll, a dominant chord into the next section; the next section is
the drop), `resolve` (the final chord rings out). Hits: `boom`, `crash`, `impact`,
`riser` (the riser ends at `t`).

Example, for a 30-second feature brag at 120 BPM (a beat is 0.5 s, a bar 2 s):

```json
{
  "duration": 30, "bpm": 120, "key": "A", "mode": "minor", "style": "pulse", "seed": 1,
  "sections": [
    {"start": 0,  "end": 4,  "energy": 0, "role": "hook"},
    {"start": 4,  "end": 8,  "energy": 1},
    {"start": 8,  "end": 10, "energy": 3, "role": "build"},
    {"start": 10, "end": 22, "energy": 2},
    {"start": 22, "end": 26, "energy": 3},
    {"start": 26, "end": 30, "energy": 1, "role": "resolve"}
  ],
  "hits": [{"t": 4.0, "kind": "impact"}]
}
```

Here the problem is the hook, life before is energy 1, the build lands the feature on the
drop at 10.0, what got better is the peak, and the outro resolves.

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/compose_score.py tools/score.json --out composition/assets/music/score.wav --cues tools/score.cues.json --spectrogram review/score.png
```

It takes a few seconds per 30 s of music. Read its report, because it replaces
listening:

- integrated loudness about −14 LUFS and true peak at or below −1 dBTP (it masters to
  this itself);
- the hook quieter than the main sections, and each rise in energy at least 0.5 LU
  louder than the section before it (it prints a note if not). A drop is compared with the
  section before its build, not with the build: the build's riser and snare roll are loud
  at any energy level;
- no "almost all bass" note on the main sections (a short opening hook may
  lean on bass; the generator adds a quiet clock to keep it audible on small speakers);
- the cue file's `beats` are what `LaunchText.music` takes (the brand orb breathes on them), and
  its `strongCues` are the moments to lock cuts to (section starts, drops,
  hits).

To change the music, change the plan (energy, roles, style, key, tempo, or the seed for
different random details) and run it again. Save the plan in `tools/`. A hit adds
loudness to its section: when the report says a section isn't louder than the one before
it, move or drop a hit; a new seed changes details, not levels.

In the composition, play it at about 0.4–0.5. For fades, use Hyperframes' volume lane
(hyperframes-core, `creator-editing-recipes.md`, "Volume fades / ducking"): keep
`data-volume="1"` and put the level in the lane, here a 0.25 s fade-in to 0.45 and a
1.5 s fade-out at the end of a 30 s video:

```html
<audio id="music" src="assets/music/score-ducked.wav" data-start="0" data-duration="30" data-track-index="10" data-volume="1"
  data-automation='{"version":1,"lanes":[{"target":"volume","points":[{"t":0,"v":0},{"t":0.25,"v":0.45},{"t":28.5,"v":0.45},{"t":30,"v":0}]}]}'></audio>
```

Lane times are seconds from the clip's own start. Without fades, `data-volume="0.45"`
alone is enough. Either way, pass the level (0.45) to `typing_track.py --music-volume`.

### Route 3 — the user's own track

Copy it into `composition/assets/music/`, get approximate beats with
`hyperframes beats .`, and list it in `credits.md` as supplied by the user.

---

## Sound effects

### Route 1 — bundled (CC0, Kenney.nl and OpenGameArt)

In `<skill-dir>/assets/sfx/`. Read `assets/sfx/sfx-analysis.md` first: it lists safe
picks and flags harsh files. Prefer low high-frequency-risk files for repeated or
polished moments.

| Folder | Files | Use for |
|---|---|---|
| `interface/` | `click_001–005`, `select_008`, `switch_*`, `drop_001–003`, `glitch_002/004`, `error_005–006`, `bong_001` | taps, selection, soft landings, errors, a gentle announcement |
| `ui/` | `click1–5`, `mouseclick1`, `rollover*`, `switch*` | cursor clicks, hovers, toggles |
| `impact/` | `impactSoft_medium_*` (safest), `impactBell_heavy_000/003/004`, `impactGlass_light_*`, `impactWood_*`, `impactPlate_*`, `impactPunch_*`, `impactMetal_*` | reveals, logo landings, success, emphasis |
| `casino/` | `card-slide/place/fan/shove-*`, `chip-*`, `dice-*`, `cards-pack-open-*` | cards arriving, stacks, counters, a pack opening |
| `keyboard/` | `keypress-001…032.wav` | typing in a UI field, one sound every second character and at least 90 ms apart (the same limit `typing_track.py` uses; fast typing at every second character put hits 36 ms apart, which buzzes), varied across the set; `LaunchUI.keys` logs exactly those times (the big `launch` statements use the deep key below instead) |

### Route 2 — generate what's missing

`make_sfx.py` makes one effect per call. Everything is original; the same seed gives the
same file.

| Kind | For |
|---|---|
| `whoosh` | moves, wipes, a flight, a card flying in |
| `riser` | the build into a reveal |
| `boom` / `impact` | a logo landing, a big number, the before → after switch |
| `blip` / `tick` | data, notifications, UI accents |
| `shimmer` | success, a result appearing |
| `wingbeats` | anything that flaps |
| `glitch` | an error, the broken "before" |

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/make_sfx.py whoosh --dur 0.7 --from 400 --to 3600 --out composition/assets/sfx/gen/whoosh-1.wav
```

### The `launch` typing sound

Every typed piece of a `launch` statement lands with a short, deep "key" hit, as in the
film the style comes from (launch-style.md, "Sound"). `typing_track.py` synthesises it
(original: tuned to the film's measurements, no audio copied) and places one hit per word,
token piece, slot word and a thinned set of letters, read from the composition's event
log. It turns the whole typing into one track, levelled against the music, and writes a
copy of the music with a short 4 dB dip under every hit (sidechain ducking), so the hits
cut through without being louder. The commands are in step-3-compose.md, "The typing
sound"; `typing_track.py --one key.wav` writes a single hit to listen to or to reuse.
`audio_report.py --hits` proves on the final video that the hits are heard.
`typing_track.py --transitions` adds soft whooshes when a scene opens (app open, fill,
reveal, warp) and a small pop when the product's icon lands; give it `--cues
tools/score.cues.json` too, so no whoosh doubles a hit the music already has there.

### Route 3 — source a real-world sound

For something that must sound real (an animal, a crowd, a door, weather), use a
public-domain or CC0 recording:

- the US National Park Service sound gallery (nps.gov/subjects/sound): public domain,
  credit "National Park Service";
- Freesound (freesound.org), filtered to the CC0 licence;
- the bundled Kenney packs (CC0).

Download with `curl` on the host (downloading only; nothing downloaded runs there). Then
find the best moment and clean it in the image:

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/clean_sound.py --in tools/src/call.mp3 --start 9.15 --dur 1.1 --gate 1.5 --semitones -2 --space mountain --out composition/assets/sfx/cry.wav --spectrogram review/cry.png
```

`--gate` removes background noise (0 turns it off), `--semitones` below zero makes a
sound bigger, and `--space` gives it a room (`room`) or stereo echoes (`mountain`). Look
at the spectrogram to pick `--start` and `--dur`: a clean call shows clear bright bands
with little noise around them.

Pick the sound people recognise, not the literal one: the "eagle cry" viewers know from
films is a hawk's scream (a bald eagle's real call is a thin chatter), and a film horse
whinnies far more than a real one. Write any substitution into `credits.md`.

---

## Placing sound in the composition

- **Tracks:** music on track 10, the `launch` typing track on 11 (one pre-mixed file),
  then the sound effects from 12 up, and voice lines from 20. Two clips that overlap in
  time never share a track (lint's `duplicate_audio_track`); clips one after another can.
- **Write the effect tags with `sfx_tags.py`**, not by hand or with a shell loop (in one
  run a zsh loop shifted every sound, because zsh counts array positions from 1). List
  the sounds in `tools/sfx.json`: a file (or several to take in turn) and either times or
  a kind from the event log, which holds the clicks and taps of `launch-ui.js` and its UI
  typing keys:

  ```json
  [
    {"src": "assets/sfx/ui/click2.ogg", "events": "click", "volume": 0.55},
    {"src": ["assets/sfx/keyboard/keypress-004.wav", "assets/sfx/keyboard/keypress-007.wav",
             "assets/sfx/keyboard/keypress-010.wav"], "events": "key", "volume": 0.35, "min_gap": 0.09},
    {"src": "assets/sfx/interface/bong_001.ogg", "t": [15.4, 22.95], "volume": 0.45, "id": "done"}
  ]
  ```

  Put two lines inside the root once, after the music and typing tags:
  `<!-- sfx:begin -->` and `<!-- sfx:end -->`. Then:

  ```bash
  docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$OUT":/work -w /work brag-tools:0.8.91-r3 python3 /skill/sfx_tags.py tools/sfx.json --events tools/launch-events.json --into composition/index.html
  ```

  It measures each file's length, cuts a sound at the video's end, gives each the lowest
  free track from 12 (leaving alone tracks the composition's other `<audio>` tags use at
  that moment), and replaces what is between the two lines, so running it again after a
  change is safe. Without `--into` it prints the tags. It warns if the sounds need a track
  past 19.
- **Timing:** a sound starts with its visual: an entry pop 0.0–0.1 s before the first
  visible frame, a transition sound at the transition's start, a success sound when the
  thing is fully visible. For staggered items, sound the first, the last or the strongest,
  not every one, unless the rhythm is the point.
- **Levels:** without a voice, the music lane is 0.4–0.5 for a composed score (it is
  mastered to −14 LUFS) and 0.3–0.4 for a bundled track. Effects 0.3–0.85, softer for
  polished and deadpan tones. With a voice: see above. `finalize.py` sets the final
  loudness, so balance the parts against each other and not the overall level.
- **Paths:** relative to `composition/` (`assets/sfx/…`). Absolute paths fail silently
  in the renderer.

| Tone | Effects |
|---|---|
| `launch` (default) | the deep key on every typed piece (`typing_track.py`, about 8 dB over the music), composed `pulse` at 120–128 BPM with a breakdown under a dark or trust scene, clicks only on real UI actions, the sounds of the motion found, a small pop when the product's icon lands |
| `polished`, `ai-demo` | a light layer on real actions (clicks, arrivals, a completion) and one warm impact per big moment |
| `changelog` | very few: the before → after switch, the proof moment, the outro |
| `app-store`, `default` | one sound per feature card or arrival, a bell on the outro |
| `cinematic` | 2–3 big hits: the reveal, the drop, the logo |
| `chaotic` | on every beat, stacked |
| `deadpan`, `yc-parody` | one or two dry cues |

When in doubt, use fewer sounds with better timing, from one coherent palette.

## The honest line

Measurements (`compose_score.py`'s report and `audio_report.py`) catch loudness,
balance and dynamics. They can't say whether the music fits the mood. When you deliver,
say the audio was checked by measurement, not by ear, and invite the user to listen.

## For maintainers

`scripts/analyze_music_cues.py` generated the bundled cue presets. It needs `librosa`,
which is not in the image, so it isn't part of a normal run.
