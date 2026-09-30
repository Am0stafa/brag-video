# Tests for the launch engine

These pages test the launch engine and its product-screen kit (`skills/brag/assets/launch/`).
They are built from the Hyperframes blank template with the current engine, and they run inside
the same Docker image the skill uses, never on your Mac.

| Page | What it covers |
|---|---|
| `compositions/kit.html` | the product-screen kit: a statement that stays and gives way, a gradient icon filling the frame, a circle reveal, a 1280×720 console at 1.5× with a dialog, typing, counters, a status swap, labels cut with "…", a cursor with clicks, the "Sample data" label, a phone tap, a screen wall of 24 screens, and an app icon with its own tile in the lockup |
| `compositions/transitions.html` | `exit: "none"` followed by another statement on the same stage, then a focus pull and a circle reveal between scenes whose text sits in the same place |
| `compositions/marks.html` | the product's mark in every form: the bare logo coming into focus (in the lockup and filling the frame), an app icon with its own tile (opening a scene), a gradient tile (filling the frame), the older "pop" landing, and the brand orb |
| `compositions/backdrops.html` | the living backdrop behind the statements: slats, aurora and grid under lit words and slots, a cut and a focus pull between them, the music's downbeat pulse, and one backdrop shared by a whole world with a bare-logo lockup on it |
| `../skills/brag/assets/launch/example.html` | the skill's own working example |

Each page must pass four checks:

1. `hyperframes lint` passes.
2. `hyperframes check`, sampled at every tween boundary (`--at-transitions`), finds no errors and
   no warnings. It is read through `skills/brag/scripts/check_summary.py`.
3. Every statement can be read: `skills/brag/scripts/launch_events.cjs --strict` (about 0.3 s
   a word, and at least 1.2 s after the last word lands).
4. The frame-order test, `seek-test.cjs`: the same frames drawn forward, backward and in a
   shuffled order must look the same, element by element. Hyperframes renders frames out of
   order in parallel workers, so this is what "seek-safe" means in practice.

## Run them

You need Docker and the `brag-tools:0.8.91-r3` image. The skill builds it on its first run, or
build it yourself with `docker build -t brag-tools:0.8.91-r3 skills/brag/docker`. From the
repository root:

```bash
docker run --rm --shm-size=2g -v "$PWD":/repo -w /repo brag-tools:0.8.91-r3 sh tests/run-tests.sh
```

- **What it does:** it mounts this repository into the image and runs `tests/run-tests.sh`
  there. For each page, the script copies the blank template, adds the engine and the Geist
  font, and runs the four checks.
- **One page only:** add the page names after the script, for example
  `sh tests/run-tests.sh marks backdrops`.
- **Expected output:** one block per page, each line `ok` (for example
  `frame order: 130 times x 3 orders (3122 visible element states compared): 0 times differ`),
  then `all tests passed`, with exit code 0. It takes a few minutes.
- **What can go wrong:**
  - No network in the container: the font download fails, and the script says so.
  - Without `--shm-size=2g`, Chrome can crash or hang.
  - A failed check prints its details, and the exit code is the number of failed checks.

The results of the last run stay in `tests/.work/<page>/` (`check.json`, `check.txt`,
`reading.txt`, `seek.txt`); Git ignores that folder.
