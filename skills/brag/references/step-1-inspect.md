# Step 1: Inspect

Read the project to learn what to show and how it looks. How much to read depends on the
video type:

- **Product demo:** the whole product, as described below.
- **Feature brag, before and after:** the change and what surrounds it. Read every
  changed file and its parent screens (from step 0), the project's visual identity, and
  the tests or fixtures the change touched (the best source of realistic sample data).
  The subject is everything the change does; the marketing site and unrelated routes are
  not, because a feature video that drifts into a product overview has failed.

Whatever the type, the colors, fonts and logo always come from the project, because the
video must look like the real product.

## What to read (product demo)

In priority order:

1. **The main page** — `index.html`, or the app shell and its routes (`App.tsx`,
   `app/`, `pages/`). Title, headline, tagline, section and page titles, button labels,
   empty states. This is the product's voice.
2. **Styles** — `styles.css`, theme and token files, `:root` custom properties. Exact
   background, text, accent and status colors; font families and weights.
3. **README and product docs** — the one-line description, the feature list, "how it
   works".
4. **`package.json`** (or equivalent) — name and description.
5. **Every feature and flow** — the product *in use* is the best material. Find every
   feature and, for each, its entry → action → result: route files, the navigation (every
   menu item is a screen), feature components (the editor, the result view, the
   dashboard), state machines and step components, settings that change behaviour,
   integrations, demo and example folders, the README's feature list.
6. **Assets** — the logo (prefer SVG), icons, product images.

## The coverage list

While reading, write down everything the product does: every feature, every screen in the
navigation, every flow step and the result it produces, every integration, every setting
that changes behaviour. Put it under `## Coverage` in `brag-plan.md`, in the order a user
meets it. This is what the video shows, all of it, at any length (video-types.md, "Cover
everything"). Don't rank it or trim it; step 2 finds each item its scene.

## Don't read

Build output (`dist/`, `.next/`, `build/`), lock files, `.git/`, environment and secret
files (`.env*`), keys and certificates (`.pem`, `.key`, `id_rsa`, service-account JSON,
anything under `secrets/` or `credentials/`), local config that holds tokens, and
anything `.gitignore` excludes for those reasons.

## Helper agents: a read-only brief

A large product reads faster with helpers (one for the routes and navigation, one for the
styles and assets, one for the docs). Helpers don't see this skill, so they don't know its
rules: in one run, two of three helpers ran `python` on the Mac to read files. Use a
read-only agent type when there is one, and start every helper's prompt with this brief,
filled in:

```text
You are a read-only helper for a video about <product>, in <project folder>. Read and
report; change nothing.

Rules:
- Read with your file tools, or with grep, sed, cat, head, ls, find and wc. Never run
  python, python3, node, npx, npm, uv or any other interpreter or script on this Mac, not
  even to parse JSON or to count something. If a task seems to need one, say so in your
  report instead.
- Don't write, move or delete files. Don't run git commands that change anything
  (checkout, switch, stash, commit, reset, pull).
- Don't open secrets: .env*, *.pem, *.key, id_rsa, service-account JSON, anything under
  secrets/ or credentials/, local config that holds tokens.
- Never copy a secret, token, internal host, URL, email address or real customer or
  person's name into your report. Write [private: what it is] and the file where you saw
  it, so it can go into privacy-terms.txt.
- Quote the product's own words exactly, with file:line.

Task: <what to find: every screen in the navigation with its exact title; every feature
with its entry, action and result; the colours, fonts and logo; …>

Report as: <a table: item | file:line | exact words>
```

Check what the helpers report against the files before it goes into the plan.

## Where the notes go

Start `<output-dir>/brag-plan.md` now: write the rubric answers under `## Rubric` and the
colors, fonts and logo under `## Visual identity`. Step 2 completes the same file. For a
feature brag or a before and after, the questions live in `change-context.md` (step 0),
and the visual identity still goes into `brag-plan.md`.

## The rubric (product demo)

Answer all nine before planning. For a feature brag or a before and after, the questions
in change-source.md replace these.

```
1. What is the product? One sentence: what it actually does.
2. What is the hook line? The one line from its own copy that earns a reaction.
3. What is the visual hook? The real UI moment to open on: a screen, a card, a result.
4. What does it do? Every feature, screen and result: the coverage list (all of it is
   shown).
5. What is the length? The full video, sized to cover the whole list (at most 117 s),
   unless the prompt asks for the quick version or a length; see video-types.md.
6. What tone fits? The prompt's words mapped to a preset (tones.md).
7. What should the audio feel like? Voice over only if asked; otherwise the music's mood.
8. What should the share caption say? Draft one sentence.
9. What are the user flows? For each feature: entry → key action → result, in the working
   app.
```

## Colors and fonts

Look for custom properties first:

```css
:root { --bg: …; --text: …; --accent: …; }
```

Without them, take the most-used background, text, border and accent colors. Write down
exact values for background, surfaces, text (primary and secondary), accent and status
colors (success, warning, error), and any gradient or glow.

If the tokens use `oklch()`, `oklab()` or `hsl()`, convert them to hex now and record both.
Hyperframes' contrast check only measures hex and `rgb()` colors, so the composition must
use the hex values. The script resolves `var(--x)` references inside tokens, and it lists
the ones it can't resolve because they are set at runtime:

```bash
docker run --rm -v "<skill-dir>/scripts":/skill:ro -v "$PROJECT":/project:ro brag-tools:0.8.91-r3 python3 /skill/css_colors.py --file /project/src/styles.css
```

For fonts, record the display, body and data (mono) families and weights, and where the
files come from: the project's own files first (`@fontsource` packages, `public/fonts/`),
otherwise Google Fonts through `fetch_fonts.py` (runtime-docker.md).

## The theme

Record whether the product's main screens are **light or dark**, and the three colours the
statements will use: the page background, the main text colour and the brand (primary)
colour. Check the default theme, not a toggle nobody uses: the `:root` or `body` tokens,
a `dark` class on `<html>`, `color-scheme`, `prefers-color-scheme` defaults, the theme
provider's initial value. Write it into `## Visual identity`:

```text
Theme: dark. Background #0b1220, text #e8eef7, brand #4f8cff (from src/theme.ts)
```

The `launch` statements use this theme (launch-style.md, "The theme follows the app").
White is the style's default only when the product is light or has no screens.

## The logo, and everything that could move

Find the real logo file. SVG is best, because its groups can be animated. If the video
will animate a raster logo (wings that beat, a sweep that turns, a mark that assembles),
it has to be cut into parts first; step 3 explains the "rig" and the check that proves it
still looks exactly like the original at rest.

In `launch`, the logo also becomes the product's mark: statements condense into it, and the
video closes on it beside the product's name (launch-style.md, "The product's mark"). It
shows **bare, the way the product shows it**, with no tile or square behind it. Record the
logo mark itself in its own colours (the glyph from the navbar or the favicon, without the
favicon's rounded square), in a form that reads at about 110 px on the statements'
background, the brand colour for its glow, and the product's name for the closing lockup.
If the logo is white-on-colour only, draw it in the brand colour (or the ink) so it reads on
the canvas. Put it on an app-icon tile only when the user asks for the app icon. With no
logo, write "no logo": the mark becomes the brand orb, a breathing circle in the brand colour.

Then look at every visual with one question: **what does this thing do in the real
world?** The logo and any mascot, the icons, the illustrations, and the product's own
screens (numbers, charts, lists, scans, maps, graphs). Anything with a natural motion is
animated by default, without being asked: a bird's wings beat, a radar's sweep turns, a
count counts up, a scan fills in as it finds things. List the candidates now, under
`## Motion found` in `brag-plan.md`; motion-opportunities.md has the catalogue and the
rules. The only reasons to leave something still: the prompt says so, or the brand's
guidelines (a `brand/` or `press/` folder) forbid moving the logo.

## Private terms: privacy-terms.txt

Anything read in this step can end up on screen in a video the user posts. While
reading, collect every private thing you see into `<output-dir>/privacy-terms.txt`: real
customer or company names, people, hostnames, internal URLs, IP addresses, connection
names, account IDs, emails, tokens. The docs of real deployments are the usual source.

```text
# found in the project: must never appear on screen
deny: Harbor & Pine Insurance
deny: 10.20.30.40
deny: ops@realcustomer.com
# always: the user's own home folder (an absolute path gives away their name)
deny: /Users/jane/
# asked for by the user: allowed even though it looks private
allow: Acme Health
```

Add an `allow:` line for everything the prompt explicitly asks to show. The home-folder
line uses the real one (the value of `$HOME`, with a trailing slash). When nothing private
turns up (a demo app with sample data), keep that line and write
`# nothing private found in <what you read>`. Step 4 scans the composition, plan and share
copy against this file. The scan treats documentation addresses (`203.0.113.x`,
`198.51.100.x`, `192.0.2.x`) and reserved domains (`.example`, `example.com`) as fake.

Never carry secrets, API keys, tokens, internal hostnames or URLs, real customer or user
names, email addresses, or other personal data into the plan, the brief, the composition,
the video or the share copy, unless the user explicitly asked for that specific item.
Replace them with plausible fictional stand-ins and say so in the plan. Write file paths
relative to the project, never absolute: `/Users/<name>/…` gives away the user's name.

## Fake data

When the UI shows data (tables, counts, names, charts) and the user did not ask for real
data, plan a small fake data sheet in `brag-plan.md`:

- Use well-known fictional names: Acme, Globex, Initech, Northwind, Umbrella, Hooli;
  hosts like `web-01.example.com`, addresses from `203.0.113.0/24`; IDs in the product's
  own format (`#10482`, `SUP-4821`).
- Make the numbers add up across scenes (2,318 orders today → 2,301 shipped + 17 waiting).
  Viewers notice when a count changes between scenes.
- Keep the real product's labels, units and formats, so the data looks native.

If the user asked for fake data, all of it is *requested*. If they asked for real
numbers, use exactly what they gave.

## Gate

`brag-plan.md` has `## Rubric` (product demo), `## Visual identity` (hex colors, the theme,
fonts and their source, the logo) and `## Motion found` (the candidates); for a feature or
change, `change-context.md` answers its questions; and `privacy-terms.txt` exists (it may
hold only `allow:` lines).
