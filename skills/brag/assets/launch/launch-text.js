/* launch-text.js: the text engine of /brag's default "launch" style.
 *
 * Measured frame by frame from a modern AI launch film (see references/launch-style.md):
 *   - text streams in like a model's output: the first word arrives in token-sized pieces
 *     ("Po", "wer", "ed"), then whole words land 4, 4, 5 frames apart (no fade, no blur);
 *   - the text block glides to stay centred as it grows (exponential ease-out, tau 0.2 s);
 *   - the key word is typed letter by letter and flickers through a colour palette,
 *     4 frames per colour, then settles on the accent;
 *   - a "slot" word cycles through candidates, each whole and in its own colour;
 *   - "thinking" dots can pause the typing, then a caret types the rest;
 *   - a statement exits by a cut, a dim, a slide, a blur, or by collapsing into the product's
 *     own icon: its logo on a brand tile (with no logo, the brand orb: a breathing circle),
 *     which lands with one soft ring, then hides, stays, becomes the closing lockup with the
 *     name, fills the frame with the brand colour, or opens into the next scene the way an
 *     app opens. This is /brag's own move: the film collapses into a colour-cycling dot,
 *     which /brag never copies.
 *
 * Themes: light (the film's white canvas) by default, dark (the film's black scene), or the
 * app's own colours. Every text colour is fitted to at least 3.2:1 against the background.
 * With LaunchText.music({ bpm }) (the soundtrack's tempo, or its cue file's beats), the brand orb
 * breathes on the beat.
 *
 * Every typed chunk is logged in LaunchText.events ({t, kind}); scripts/launch_events.cjs
 * reads them and scripts/typing_track.py turns them into the typing sound. Every statement is
 * logged too, and LaunchText.timing() checks each one against the reading rules (0.3 s a word,
 * 1.2 s after the last word); launch_events.cjs prints that table, so timing is settled before
 * the music is composed.
 *
 * Deterministic and seek-safe: one proxy tween per statement renders every frame from
 * the timeline's time alone, so Hyperframes can render frames in any order.
 *
 * Usage, inside the composition's build(), after document.fonts.ready:
 *   LaunchText.theme({ bg: "#0b1220", ink: "#e8eef7", accent: "#4f8cff",
 *                      mark: { svg: "<svg …the product's logo, drawn to read on the brand tile…>" } });
 *   const s1 = LaunchText.statement(tl, stage, { at: 0.1, lines: ["Horse Tinder for {Riders}"] });
 *   const s2 = LaunchText.statement(tl, stage, { at: s1.end, lines: ["Find the horse that fits", "your weekends and your pace"] });
 *   LaunchText.statement(tl, stage, { at: s2.end, lines: ["Match on {slot}"],
 *     slot: ["temperament", "pasture", "schedule", "trust"], exit: "mark", markEnd: "open", next: productScene });
 */
(function () {
  "use strict";

  var FRAME = 1 / 30;
  var FLICK = 4 * FRAME;   // one palette step
  var TAU = 0.2;           // glide time constant: about 95% settled after 0.6 s
  var RHYTHM = [4, 4, 5];  // frames between whole words, repeating (measured)

  // ---- colour ----
  function rgb(c) {
    c = String(c).trim();
    var m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      var h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (m) return [+m[1], +m[2], +m[3]];
    throw new Error("launch-text: use a hex or rgb() colour, not " + c);
  }
  function hex(a) {
    return "#" + a.map(function (v) { return ("0" + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join("");
  }
  function lum(a) {
    var v = a.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) {
    var la = lum(rgb(a)), lb = lum(rgb(b));
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function isDark(bg) { return lum(rgb(bg)) < 0.18; }
  // Move a colour toward black (light background) or white (dark background) until it
  // reaches the contrast needed for large text; the hue stays.
  function fit(colour, bg, min, warn) {
    min = min || 3.2;
    var c = rgb(colour), target = isDark(bg) ? [255, 255, 255] : [0, 0, 0];
    for (var k = 0; k <= 50; k++) {
      var t = k / 50;
      var m = [c[0] + (target[0] - c[0]) * t, c[1] + (target[1] - c[1]) * t, c[2] + (target[2] - c[2]) * t];
      if (contrast(hex(m), bg) >= min) {
        if (warn && t > 0.35 && window.console) console.warn("launch-text: " + colour + " needed a big shift to read on " + bg + "; consider another accent");
        return hex(m);
      }
    }
    return hex(target);
  }

  // The film's hues, for the lit word's flicker. On its white canvas the text versions are
  // deepened to pass contrast.
  var FILM_HUES = ["#0a84f9", "#f67824", "#cbaef9", "#fbc4c5", "#08b450"];
  var LIGHT_TEXT = ["#0a84f9", "#e8691a", "#9d7bf0", "#e6608f", "#07a64b"];
  var PRESETS = {
    light: { bg: "#fdfdfd", ink: "#000000", accent: "#0a84f9" },
    dark: { bg: "#000000", ink: "#ffffff", accent: "#0a84f9" }
  };

  /**
   * Resolve a theme: "light", "dark", or {bg, ink, accent, palette, mark} (any part may be left out).
   * mark is the product's icon for the "mark" exit:
   *   { svg: "<svg…>" } or { src: "assets/brand/icon.svg" }  the logo; with neither, the icon is
   *     the brand orb, a breathing circle in the brand colour (a product with no logo); { text: "P" } only when an
   *     initial was asked for
   *   tile: true (default) sets the logo on a brand-colour tile like an app icon; false shows it as
   *     is (a logo that is already a shape); "own" when the svg or src is a whole app icon that
   *     draws its own tile (a gradient, a border): it fills the icon and the engine draws no tile
   *   color: the brand colour: the tile, its ring, and the flat field a "fill" ends in (default
   *     the first colour of `background`, else the theme's brand accent as the brand has it)
   *   background: any CSS background for the tile, such as the app icon's gradient
   *     ("linear-gradient(135deg, #1d4ed8, #0ea5e9)"); as the tile grows ("fill", "open") it
   *     turns into the flat `color`
   *   radius: the tile's corner radius as a share of its size (default 0.23, an app icon's)
   *   style: extra CSS for the tile, e.g. { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)" }
   *   name: the product's name, for the "lockup" end
   */
  function resolve(spec) {
    if (!spec) spec = "light";
    if (typeof spec === "string") spec = PRESETS[spec] || PRESETS.light;
    var bg = spec.bg || "#fdfdfd";
    var dark = isDark(bg);
    var ink = spec.ink || (dark ? "#ffffff" : "#000000");
    if (contrast(ink, bg) < 4.5) ink = fit(ink, bg, 4.5, true);
    var brand = spec.accent || "#0a84f9";
    var accent = fit(brand, bg, 3.2, true);
    // light backgrounds start from the deepened text hues, dark ones from the film's own
    var hues = spec.palette || (dark ? FILM_HUES : LIGHT_TEXT);
    var text = hues.map(function (c) { return fit(c, bg); });
    // the accent leads the flicker and is where the key word settles
    text = [accent].concat(text.filter(function (c) { return c.toLowerCase() !== accent.toLowerCase(); })).slice(0, 5);
    return { bg: bg, ink: ink, accent: accent, brand: brand, text: text, mark: spec.mark || null, dark: dark };
  }

  var current = resolve("light");

  /**
   * theme(spec, [el]) sets the theme for the statements that follow (or, with el, for one stage)
   * and writes --lt-bg, --lt-ink and --lt-accent on the root (or on el). Returns the resolved theme.
   */
  function theme(spec, el) {
    var th = resolve(spec);
    var target = el || document.documentElement;
    target.style.setProperty("--lt-bg", th.bg);
    target.style.setProperty("--lt-ink", th.ink);
    target.style.setProperty("--lt-accent", th.accent);
    if (el) el.__ltTheme = th; else current = th;
    return th;
  }

  // ---- the event log (for the typing sound) ----
  var events = [];
  function emit(t, kind) { events.push({ t: Math.round(t * 1000) / 1000, kind: kind }); }

  // ---- the statement log (for the reading-time check, timing() below) ----
  var statements = [];

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  // ---- the product's mark: its icon on a brand tile, like an app icon ----
  // Built from the theme's mark (or the global theme's). A product with no logo gets the
  // brand orb instead: a circle the size of a capital letter in its one brand colour, with
  // light and depth (a lighter top, a deeper edge). It lands like the icon, then breathes:
  // it swells, lights up and glows once, then settles, and keeps breathing slowly while it
  // stays on screen. One hue only: it never cycles through colours (that is the film's dot).
  // `exact` keeps the size the caller asked for.
  function hasLogo(th) {
    var spec = th.mark || current.mark || {};
    return !!(spec.svg || spec.src || spec.text);
  }
  function mix(a, b, t) {
    var x = rgb(a), y = rgb(b);
    return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  // the first colour in a CSS background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)" -> "#1d4ed8"
  function firstColour(css) {
    var m = String(css || "").match(/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\([^)]*\)/i);
    if (!m) return null;
    var c = m[0];
    if (c[0] === "#" && (c.length === 5 || c.length === 9)) c = c.slice(0, c.length === 5 ? 4 : 7);   // drop the alpha
    return c;
  }
  var ORB_BREATH = 0.9;   // without music: the orb's first breath; later ones take 2.4 s

  // ---- the soundtrack's beats (optional): the orb breathes on the beat ----
  var music = null;
  /**
   * music({bpm, offset} | {beats, bpm}) gives the engine the soundtrack's beats: a steady grid
   * (offset: the time of the first beat, default 0), or the cue file's own beat times
   * (numbers or {time}, with its tempo). The orb then breathes with the music: its first
   * breath starts on a beat and lasts two beats, so the swell peaks on the next beat, and
   * while it stays on screen it breathes once a bar (four beats). Call it before the
   * statements; music(null) turns it off. Returns the grid.
   */
  function setMusic(spec) {
    music = null;
    if (!spec) return null;
    var beats = (spec.beats || []).map(function (b) { return typeof b === "number" ? b : +b.time; })
      .filter(function (t) { return isFinite(t); }).sort(function (a, b) { return a - b; });
    var bpm = +(spec.bpm || spec.tempo) || 0;
    if (!bpm && beats.length > 2) {
      var gaps = [];
      for (var i = 1; i < beats.length; i++) gaps.push(beats[i] - beats[i - 1]);
      gaps.sort(function (a, b) { return a - b; });
      bpm = 60 / gaps[gaps.length >> 1];
    }
    if (!(bpm > 0)) throw new Error("launch-text: music() needs bpm, or at least three beat times");
    music = { bpm: bpm, beat: 60 / bpm, offset: spec.offset !== undefined ? +spec.offset : (beats.length ? beats[0] : 0), beats: beats };
    return music;
  }
  // the first beat at or after t (a listed beat, else the steady grid)
  function nextBeat(t) {
    var b = music.beats;
    if (b.length) {
      for (var i = 0; i < b.length; i++) if (b[i] >= t - 1e-6) return b[i];
      var last = b[b.length - 1];
      return last + Math.ceil((t - last) / music.beat - 1e-6) * music.beat;
    }
    return music.offset + Math.max(0, Math.ceil((t - music.offset) / music.beat - 1e-6)) * music.beat;
  }
  // the beat n beats after the beat at t
  function beatAfter(t, n) {
    var b = music.beats;
    for (var i = 0; i < b.length; i++) if (Math.abs(b[i] - t) < 1e-3) return i + n < b.length ? b[i + n] : t + n * music.beat;
    return t + n * music.beat;
  }
  // when the orb breathes, once it has landed at landEnd: {t0, t1} is the first breath
  // (on the beat when there is music), idle the slower breath while it stays
  function breathPlan(landEnd, stays) {
    if (!music) return { t0: landEnd, t1: landEnd + ORB_BREATH, idle: 2.4, stays: stays };
    var t0 = nextBeat(landEnd);
    return { t0: t0, t1: beatAfter(t0, 2), idle: 4 * music.beat, stays: stays };
  }
  // how far into a breath the orb is at this time: 0 at rest, 1 at the full inhale
  function breathAt(time, p) {
    if (time <= p.t0) return 0;
    if (time < p.t1) return Math.pow(Math.sin(Math.PI * (time - p.t0) / (p.t1 - p.t0)), 2);
    return p.stays ? 0.45 * Math.pow(Math.sin(Math.PI * (time - p.t1) / p.idle), 2) : 0;
  }
  // paint the orb: depth 1 is the full light and shade (0 is the flat brand colour, for a
  // fill or an opening); b is the breath, which brightens it, moves its light and glows
  function paintOrb(mk, depth, b) {
    var o = mk.orb, s = mk.el.style;
    s.background = "radial-gradient(circle at " + (32 + 7 * b).toFixed(1) + "% " + (28 + 6 * b).toFixed(1) + "%, " +
      mix(mk.brand, o.tint, depth * (0.7 + 0.3 * b)) + " 0%, " + mk.brand + " 55%, " + mix(mk.brand, o.shade, depth) + " 100%)";
    s.boxShadow = b > 0.005 ? "0 0 " + (mk.px * 0.38 * b).toFixed(1) + "px " + (mk.px * 0.06 * b).toFixed(1) + "px rgba(" +
      o.rgb.map(Math.round).join(",") + "," + (0.5 * b).toFixed(3) + ")" : "none";
  }
  function makeMark(th, px, parent, exact) {
    var spec = th.mark || current.mark || {};
    var orb = !hasLogo(th);
    var own = !orb && spec.tile === "own";   // the logo is a whole app icon that draws its own tile
    var tileBg = own || orb ? null : spec.background || null;
    var brand = spec.color || firstColour(spec.background) || th.brand || current.brand || "#0a84f9";
    if (orb) {
      if (!exact) px = Math.round(px / 1.3);
      if (window.console && !makeMark.noted) {
        makeMark.noted = true;
        console.warn("launch-text: the mark has no logo, so the icon is the brand orb (a breathing circle in " + brand +
          "); if the product has a logo, pass it as theme({ mark: { svg } })");
      }
    }
    var tile = !orb && !own && spec.tile !== false;
    var radius = (tile || own) && !orb ? (spec.radius !== undefined ? +spec.radius : 0.23) : 0.5;
    var m = el("div", "lt-mark");
    m.style.width = m.style.height = px + "px";
    m.style.borderRadius = (radius * 100) + "%";
    m.style.background = orb ? brand : tile ? tileBg || brand : "transparent";
    if (spec.style && !orb) for (var prop in spec.style) m.style[prop] = spec.style[prop];
    m.style.visibility = "hidden";
    // Under the logo, a flat layer of the brand colour: a gradient tile, or an app icon's own
    // tile, turns into it as the tile grows into the frame ("fill", "open").
    var flat = null;
    if (tileBg || own) {
      flat = el("div", "lt-mark-flat");
      flat.style.background = brand;
      flat.style.opacity = "0";
      m.appendChild(flat);
    }
    var glyph, gcls = "lt-mark-glyph" + (own ? " lt-mark-own" : "");
    if (spec.svg) { glyph = el("div", gcls); glyph.innerHTML = spec.svg; }
    else if (spec.src) { glyph = el("img", gcls); glyph.src = spec.src; glyph.alt = ""; }
    else if (spec.text) {
      glyph = el("span", "lt-mark-glyph lt-mark-text");
      glyph.textContent = spec.text;
      glyph.style.fontSize = Math.round(px * 0.56) + "px";
      // white or ink on the tile, whichever reads better
      glyph.style.color = contrast("#ffffff", brand) >= contrast("#0b0d10", brand) ? "#ffffff" : "#0b0d10";
    }
    if (glyph) m.appendChild(glyph);
    var ring = el("div", "lt-ping");
    ring.style.width = ring.style.height = px + "px";
    ring.style.borderRadius = (radius * 100) + "%";
    ring.style.borderColor = brand;
    ring.style.visibility = "hidden";
    parent.appendChild(ring);
    parent.appendChild(m);
    var mk = { el: m, ring: ring, glyph: glyph, flat: flat, own: own, px: px, radius: radius, brand: brand, orb: null };
    if (orb) {
      mk.orb = { tint: mix(brand, "#ffffff", 0.42), shade: mix(brand, "#000000", 0.25), rgb: rgb(brand) };
      paintOrb(mk, 1, 0);
    }
    return mk;
  }

  // the end of the window a stage is visible in: its own clip, its nearest timed ancestor,
  // or the composition root
  function windowEnd(elm, fallbackFrom) {
    for (var e = elm; e && e.getAttribute; e = e.parentElement) {
      var s = parseFloat(e.getAttribute("data-start")), d = parseFloat(e.getAttribute("data-duration"));
      if (isFinite(s) && isFinite(d)) return s + d;
    }
    return (fallbackFrom || 0) + 60;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // "Match on {slot}" / "Horse Tinder for {Riders}" -> [[{w, key}]] per line
  function parse(lines) {
    return lines.map(function (line) {
      var out = [];
      var re = /\{([^}]*)\}|(\S+)/g;
      var m;
      while ((m = re.exec(line))) {
        if (m[1] !== undefined) out.push({ w: m[1], key: true });
        else out.push({ w: m[2], key: false });
      }
      return out;
    });
  }

  // token-sized pieces for a statement's first word: "Powered" -> "Po", "wer", "ed"
  function pieces(word) {
    var n = word.length;
    if (n < 5) return [word];
    var sizes = n <= 6 ? [2] : n <= 9 ? [2, 3] : [3, 3];
    var out = [], i = 0;
    sizes.forEach(function (s) { if (n - i - s >= 2) { out.push(word.slice(i, i + s)); i += s; } });
    out.push(word.slice(i));
    return out;
  }

  function ease(p, kind) {
    p = Math.max(0, Math.min(1, p));
    if (kind === "in") return p * p * p;
    if (kind === "out") return 1 - Math.pow(1 - p, 3);
    if (kind === "back") { var c = 1.70158, q = p - 1; return 1 + (c + 1) * q * q * q + c * q * q; }
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  var LAND = 0.35;  // the mark lands in 0.35 s (a small overshoot), its ring spreads over 0.6 s
  var OPEN = 0.45;  // an opening or a fill takes 0.45 s

  /**
   * statement(tl, stage, opts) -> { at, built, exitAt, end, size, theme }, and for exit "mark"
   *   also { mark, glyph, markAt, markX, markY, markSize }: animate the logo's own parts from
   *   markAt (wings beat, a wheel turns, a radar sweeps) with ordinary tl.fromTo tweens on glyph
   *   lines      array of strings; {word} marks the key word, {slot} the cycling slot
   *   at         start time in seconds
   *   step       seconds between whole words (default: the measured 4, 4, 5 frames rhythm)
   *   pieces     stream the first word in token-sized pieces (default true)
   *   unit       "word" (default) or "char" (caret typing, `rate` chars per second)
   *   rate       chars per second for unit "char" (default 30)
   *   caret      show a typing caret (default: true for unit "char")
   *   theme      "light" | "dark" | {bg, ink, accent, palette}; default: the stage's or the global theme
   *   accent     settle colour of the key word (default the theme's accent); fitted for contrast
   *   ink        text colour (default the theme's ink)
   *   flicker    seconds the key word flickers through the palette (default 1.0; 0 = none)
   *   flickerAll every word flickers as it appears, then settles to ink (default false)
   *   slot       candidate words for {slot}; each appears whole, in its own colour
   *   slotColors colours for the candidates (default: the theme's text palette in order)
   *   slotHold   seconds each non-final candidate stays (default 0.37)
   *   think      { after: n words, dur: seconds }: accent dots pause the typing, then a caret types on
   *   hold       seconds the finished statement holds before its exit (default 1.4)
   *   until      the exit's absolute time instead (a beat from the cue file); it warns when that
   *              leaves under 0.8 s to read the finished statement
   *   exit       "cut" (default) | "dim" | "slide" | "blur" | "mark" | "none"
   *              "mark": the statement shrinks into its centre and becomes the product's icon
   *              (the theme's mark), which lands with a small overshoot and one soft ring
   *              "none": it stays until the next statement on this stage starts (or a transition
   *              takes the stage away); its exitAt is where that transition should start
   *   markEnd    for exit "mark": "hide" (default) | "keep" (the icon stays until the next
   *              statement on this stage) | "lockup" (the closing lockup: the icon slides left
   *              and the product's name types in beside it, then both stay) | "open" (the next
   *              scene opens from the icon like an app; pass it as `next`) | "fill" (the icon
   *              grows into a flat brand-colour field)
   *   next       the element "open" opens (see LaunchMotion.open)
   *   name       the product's name for "lockup" (default the theme's mark.name)
   *   markHold   seconds the landed icon holds before its end (default 0.45; the orb: one full breath,
   *              0.9 s, or on the beat for two beats once music() is set)
   *   (the older names still work and give the icon: exit "dot", dotEnd "reveal" → "open",
   *   "wipe" → "fill"; there is no colour-cycling dot any more)
   *   size       font size in px (default 6.15% of the stage width: 118 px at 1920)
   *   maxWidth   widest a line may be, as a share of the stage width (default 0.8); a single
   *              line wider than this is wrapped into two balanced lines first
   *   noWrap     keep a single line on one line (shrink the type instead)
   *   y          vertical offset of the block centre in px (default 0)
   */
  function statement(tl, stage, opts) {
    opts = opts || {};
    var th = opts.theme ? resolve(opts.theme) : (stage.__ltTheme || current);
    var W = stage.clientWidth || 1920;
    var H = stage.clientHeight || 1080;
    var at = opts.at || 0;
    var fixedStep = opts.step || null;
    var usePieces = opts.pieces !== false;
    var unit = opts.unit || "word";
    var rate = opts.rate || 30;
    var caretOn = opts.caret !== undefined ? opts.caret : unit === "char";
    var ink = opts.ink ? fit(opts.ink, th.bg, 4.5, true) : th.ink;
    var accent = opts.accent ? fit(opts.accent, th.bg, 3.2, true) : th.accent;
    var palette = [accent].concat(th.text.filter(function (c) { return c !== accent; })).slice(0, 5);
    var flicker = opts.flicker !== undefined ? opts.flicker : 1.0;
    var flickerAll = !!opts.flickerAll;
    var slot = opts.slot || null;
    var slotColors = (opts.slotColors || palette).map(function (c) { return fit(c, th.bg); });
    var slotHold = opts.slotHold !== undefined ? opts.slotHold : 0.37;
    var think = opts.think || null;
    var hold = opts.hold !== undefined ? opts.hold : 1.4;
    var exit = opts.exit === "dot" ? "mark" : (opts.exit || "cut");
    var markEnd = { reveal: "open", wipe: "fill" }[opts.markEnd || opts.dotEnd] || opts.markEnd || opts.dotEnd || "hide";
    var markHold = opts.markHold !== undefined ? opts.markHold
      : (opts.dotFlicker !== undefined ? Math.max(0.1, opts.dotFlicker - LAND) : (hasLogo(th) ? 0.45 : ORB_BREATH));
    var size = opts.size || Math.round(W * 0.0615);
    var maxW = (opts.maxWidth || 0.8) * W;
    var yOff = opts.y || 0;
    var rawLines = (opts.lines || [""]).slice();
    // an icon an earlier statement left on this stage (keep, lockup, fill) gives way to this one
    if (stage.__ltKept && stage.__ltKept.from < at) {
      stage.__ltKept.els.forEach(function (e) { tl.set(e, { visibility: "hidden" }, at); });
      stage.__ltKept = null;
    }

    // An over-long single line is wrapped into two balanced lines at a word boundary
    // (the style allows two short lines); the type shrinks only if that still doesn't fit.
    var block = el("div", "lt-block");
    block.style.fontSize = size + "px";
    block.style.color = ink;
    block.style.visibility = "hidden";
    // a slide exit leaves the frame on purpose (Hyperframes' mark for exit travel)
    if (exit === "slide") block.setAttribute("data-layout-allow-overflow", "");
    stage.appendChild(block);
    function plainWidth(str) {
      var longest = slot ? slot.reduce(function (a, b) { return a.length >= b.length ? a : b; }, "") : "slot";
      block.textContent = str.replace(/\{slot\}/g, longest).replace(/[{}]/g, "");
      return block.offsetWidth;
    }
    if (rawLines.length === 1 && !opts.noWrap && plainWidth(rawLines[0]) > maxW) {
      var toks = rawLines[0].match(/\{[^}]*\}|\S+/g) || [];
      var best = null;
      for (var cut = 1; cut < toks.length; cut++) {
        var first = toks.slice(0, cut).join(" "), second = toks.slice(cut).join(" ");
        var wide = Math.max(plainWidth(first), plainWidth(second));
        if (!best || wide < best.wide) best = { wide: wide, lines: [first, second] };
      }
      if (best) rawLines = best.lines;
    }
    var lines = parse(rawLines);

    // ---- 1. the typing script: a list of states, each the visible text at a time ----
    // A state is a list of lines; each line is a list of {text, key, word, slotIdx, born}.
    var states = [];
    var t = at;
    var lastT = at;
    var cur = lines.map(function () { return []; });
    var mode = unit;
    var typedWords = 0;
    var wid = 0;
    var beat = 0;
    function nextStep() {
      if (fixedStep) return fixedStep;
      return RHYTHM[beat++ % RHYTHM.length] * FRAME;
    }

    function snapshot(time, extra) {
      lastT = time;
      states.push({
        t: time,
        lines: cur.map(function (ln) { return ln.map(function (s) { return Object.assign({}, s); }); }),
        think: extra && extra.think ? extra.think : null,
        caret: !!(extra && extra.caret)
      });
    }

    for (var li = 0; li < lines.length; li++) {
      for (var wi = 0; wi < lines[li].length; wi++) {
        var tok = lines[li][wi];
        var lead = cur[li].length ? " " : "";
        if (think && typedWords === think.after) {
          snapshot(t, { think: { t0: t } });
          emit(t, "think");
          t += think.dur || 0.9;
          mode = "char";
          caretOn = true;
        }
        var id = wid++;
        if (tok.key && tok.w === "slot" && slot) {
          // cycle the candidates: each lands whole, in its own colour; the last one stays
          for (var c = 0; c < slot.length; c++) {
            var seg = { text: lead + slot[c], key: true, word: id, slotIdx: c, born: t };
            if (c === 0) cur[li].push(seg); else cur[li][cur[li].length - 1] = seg;
            snapshot(t, { caret: caretOn });
            emit(t, "slot");
            if (c < slot.length - 1) t += slotHold;
          }
          t += nextStep();
        } else if (tok.key || mode === "char") {
          // key words (and caret typing) arrive letter by letter
          var perChar = mode === "char" ? 1 / rate : 2 * FRAME;
          var born = t;
          var text = lead + tok.w;
          var firstLetter = true;
          for (var k = 1; k <= text.length; k++) {
            var s2 = { text: text.slice(0, k), key: tok.key, word: id, born: born };
            if (k === 1) cur[li].push(s2); else cur[li][cur[li].length - 1] = s2;
            if (text[k - 1] !== " ") {
              snapshot(t, { caret: caretOn });
              emit(t, mode === "char" ? "char" : (firstLetter ? "word" : "letter"));
              firstLetter = false;
              t += perChar;
            }
          }
          if (mode !== "char") t += nextStep() - perChar;
        } else if (typedWords === 0 && usePieces && pieces(tok.w).length > 1) {
          // the first word streams in token-sized pieces, 2 then 3 frames apart
          var ps = pieces(tok.w), acc = "";
          for (var pi = 0; pi < ps.length; pi++) {
            acc += ps[pi];
            var s3 = { text: lead + acc, key: false, word: id, born: t };
            if (pi === 0) cur[li].push(s3); else cur[li][cur[li].length - 1] = s3;
            snapshot(t, { caret: caretOn });
            emit(t, "piece");
            if (pi < ps.length - 1) t += (pi === 0 ? 2 : 3) * FRAME;
          }
          t += nextStep();
        } else {
          cur[li].push({ text: lead + tok.w, key: false, word: id, born: t });
          snapshot(t, { caret: caretOn });
          emit(t, "word");
          t += nextStep();
        }
        typedWords++;
      }
    }
    var built = lastT + FRAME;
    var exitAt = built + hold;
    if (opts.until !== undefined) {
      exitAt = Math.max(built + FRAME, opts.until);
      if (opts.until - built < 0.8 && window.console) {
        console.warn("launch-text: \"" + rawLines.join(" / ") + "\" is built at " + built.toFixed(2) + " s but exits at " +
          opts.until.toFixed(2) + " s: under 0.8 s to read it; start it earlier or exit later");
      }
    }

    // ---- 2. measure every state with the real font, fit the size, lay out the glide ----
    function html(state) {
      var out = state.lines.map(function (ln) {
        return ln.map(function (s) {
          var cls = "lt-w" + (s.key ? " lt-key" : "");
          return '<span class="' + cls + '" data-word="' + s.word + '"' +
            (s.slotIdx !== undefined ? ' data-slot="' + s.slotIdx + '"' : "") +
            ' data-born="' + s.born.toFixed(4) + '">' + esc(s.text) + "</span>";
        }).join("");
      });
      while (out.length > 1 && out[out.length - 1] === "") out.pop();
      var tail = "";
      if (state.think) tail = '<span class="lt-think"><i></i><i></i><i></i></span>';
      else if (state.caret) tail = '<span class="lt-caret"></span>';
      return out.join("<br>") + tail;
    }

    states.forEach(function (s) { s.html = html(s); });
    // fit: measure the widest state; shrink the font once for the whole statement if needed
    var widest = 0;
    states.forEach(function (s) {
      block.innerHTML = s.html;
      widest = Math.max(widest, block.offsetWidth);
    });
    if (widest > maxW) {
      var fitted = Math.floor(size * maxW / widest);
      if (fitted < size * 0.7 && window.console) {
        console.warn("launch-text: a statement is too long for two lines; split it into two statements: " + rawLines.join(" / "));
      }
      size = fitted;
      block.style.fontSize = size + "px";
    }
    states.forEach(function (s) {
      block.innerHTML = s.html;
      s.w = block.offsetWidth;
      s.h = block.offsetHeight;
      s.x = (W - s.w) / 2;
      s.y = (H - s.h) / 2 + yOff;
    });
    // the glide: each state starts from wherever the previous one had got to
    states[0].x0 = states[0].x;
    states[0].y0 = states[0].y;
    for (var i = 1; i < states.length; i++) {
      var p = states[i - 1];
      var dt = states[i].t - p.t;
      states[i].x0 = p.x + (p.x0 - p.x) * Math.exp(-dt / TAU);
      states[i].y0 = p.y + (p.y0 - p.y) * Math.exp(-dt / TAU);
    }
    block.innerHTML = "";

    // ---- 3. the exit ----
    var cap = size * 0.72;
    var markPx = Math.round(cap * 1.3);   // the icon: about 110 px next to 118 px type
    var mk = null;
    var end = exitAt;
    var markAt = null, fillAt = null, openAt = null, growAt = null, orbPlan = null;
    var lcx = 0, lcy = 0;
    var lockAt = null, lockDX = 0, nameEl = null, nameWords = [], nameT = [], nameX = 0, nameH = 0;
    if (exit === "dim") end = exitAt + 0.3 + 0.4;
    else if (exit === "slide") end = exitAt + 0.28;
    else if (exit === "blur") end = exitAt + 0.4;
    else if (exit === "mark") {
      markAt = exitAt + 0.2;
      if (!hasLogo(th)) {
        // the orb holds for its first breath, which is on the beat when there is music
        orbPlan = breathPlan(markAt + LAND, markEnd === "keep" || markEnd === "lockup");
        if (opts.markHold === undefined && opts.dotFlicker === undefined) markHold = orbPlan.t1 - (markAt + LAND);
      }
      end = markAt + LAND + markHold;
      if (markEnd === "fill") { fillAt = end; end = fillAt + OPEN; }
      if (markEnd === "open") openAt = end;
      growAt = fillAt !== null ? fillAt : openAt;
      mk = makeMark(th, markPx, stage);
      markPx = mk.px;   // a circle (no logo) is smaller than the icon tile
      // the landed place, set now: a frame the clock never reaches still shows it right
      var fin0 = states[states.length - 1];
      lcx = fin0.x + fin0.w / 2;
      lcy = fin0.y + fin0.h / 2;
      mk.el.style.transformOrigin = "50% 50%";
      if (markEnd === "lockup") {
        // the icon makes room and the name types in beside it, word by word, in the ink colour
        var spec = th.mark || current.mark || {};
        nameWords = String(opts.name || spec.name || "").split(/\s+/).filter(Boolean);
        if (!nameWords.length) throw new Error("launch-text: markEnd \"lockup\" needs `name` (or the theme's mark.name)");
        nameEl = el("div", "lt-block lt-name");
        nameEl.style.fontSize = size + "px";
        nameEl.style.color = ink;
        nameEl.style.visibility = "hidden";
        stage.appendChild(nameEl);
        nameEl.textContent = nameWords.join(" ");
        var nameW = nameEl.offsetWidth;
        var gap = Math.round(size * 0.3);
        if (markPx + gap + nameW > maxW) {
          // a long name shrinks to fit beside the icon, like a long statement does
          nameEl.style.fontSize = Math.floor(size * (maxW - markPx - gap) / nameW) + "px";
          nameW = nameEl.offsetWidth;
        }
        nameH = nameEl.offsetHeight;
        nameEl.textContent = "";
        lockAt = end;
        lockDX = -(gap + nameW) / 2;
        nameX = lcx + lockDX + markPx / 2 + gap;
        var nt = lockAt + 0.3;   // once the icon has made room (its slide takes 0.35 s)
        for (var nw = 0; nw < nameWords.length; nw++) {
          nameT.push(nt);
          emit(nt, "word");
          nt += RHYTHM[nw % RHYTHM.length] * FRAME;
        }
        end = nameT[nameT.length - 1] + FRAME;
        nameEl.style.transform = "translate(" + nameX.toFixed(2) + "px," + (lcy - nameH / 2).toFixed(2) + "px)";
      }
      mk.el.style.transform = "translate(" + (lcx + lockDX - markPx / 2).toFixed(2) + "px," + (lcy - markPx / 2).toFixed(2) + "px)";
      emit(markAt, "mark");
      if (fillAt !== null) emit(fillAt, "fill");
    } else if (exit === "none") end = exitAt;

    // ---- 4. render every frame ----
    // Hyperframes seeks each frame by a silent jump (events suppressed) followed by a
    // 1 ms step back with events on. So a tween's onUpdate runs only while the frame is
    // inside its range, and never for a tween the jump passed over. Presence is therefore
    // handled by GSAP property sets (applied even during silent jumps), and the look
    // inside the range by the proxy tween's own clock.
    var hideAt = null;
    if (exit === "cut") hideAt = exitAt;
    else if (exit === "dim") hideAt = exitAt + 0.7;
    else if (exit === "slide") hideAt = exitAt + 0.28;
    else if (exit === "blur") hideAt = exitAt + 0.4;
    else if (exit === "mark") hideAt = exitAt + 0.2;
    var stageEnd = windowEnd(stage, at);
    var keeps = exit === "none" || (exit === "mark" && (markEnd === "keep" || markEnd === "lockup" || markEnd === "fill"));
    var tweenEnd = keeps ? Math.max(end, stageEnd) : end;
    if (openAt !== null) tweenEnd = Math.max(tweenEnd, openAt + OPEN);
    var last = -1;
    function indexAt(time) {
      var lo = 0, hi = states.length - 1, ans = 0;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (states[mid].t <= time + 1e-6) { ans = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return ans;
    }
    function flickerColor(since, offset) {
      return palette[(Math.floor(since / FLICK + 1e-6) + offset) % palette.length];
    }
    var proxy = { t: at };
    function render() {
      var time = proxy.t;
      var k = indexAt(time);
      var s = states[k];
      if (k !== last) { block.innerHTML = s.html; last = k; }
      var x = s.x + (s.x0 - s.x) * Math.exp(-(time - s.t) / TAU);
      var y = s.y + (s.y0 - s.y) * Math.exp(-(time - s.t) / TAU);
      var scale = 1, opacity = 1, blur = 0;
      if (time >= exitAt && exit !== "none") {
        var q = time - exitAt;
        if (exit === "dim") opacity = 1 - 0.72 * ease(q / 0.3, "out");
        else if (exit === "slide") { x -= W * 0.7 * ease(q / 0.28, "in"); opacity = 1 - ease(q / 0.28, "in"); }
        else if (exit === "blur") { blur = 20 * ease(q / 0.4, "out"); opacity = 1 - ease(q / 0.4, "in"); }
        else if (exit === "mark") scale = Math.max(0.02, 1 - ease(q / 0.2, "in"));
      }
      block.style.opacity = opacity.toFixed(3);
      block.style.filter = blur ? "blur(" + blur.toFixed(2) + "px)" : "none";
      block.style.transformOrigin = (s.w / 2) + "px " + (s.h / 2) + "px";
      block.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px) scale(" + scale.toFixed(4) + ")";
      // colours: the key word flickers then settles; slot candidates keep their own colour
      var spans = block.querySelectorAll(".lt-w");
      for (var n = 0; n < spans.length; n++) {
        var sp = spans[n];
        var born = parseFloat(sp.getAttribute("data-born"));
        var since = time - born;
        if (sp.hasAttribute("data-slot")) {
          var si = parseInt(sp.getAttribute("data-slot"), 10);
          sp.style.color = si === slot.length - 1 && opts.accent ? accent : slotColors[si % slotColors.length];
        } else if (sp.classList.contains("lt-key")) {
          sp.style.color = flicker > 0 && since < flicker ? flickerColor(since, 0) : accent;
        } else if (flickerAll) {
          sp.style.color = since < flicker ? flickerColor(since, 1) : ink;
        } else sp.style.color = ink;
      }
      var thk = block.querySelector(".lt-think");
      if (thk) {
        var dots = thk.querySelectorAll("i");
        var t0 = s.think.t0;
        for (var d = 0; d < dots.length; d++) {
          var ph = (time - t0) * 2 * Math.PI * 1.6 - d * 0.7;
          dots[d].style.background = accent;
          dots[d].style.transform = "translateY(" + (-0.18 * cap * Math.max(0, Math.sin(ph))).toFixed(2) + "px)";
        }
      }
      var caret = block.querySelector(".lt-caret");
      if (caret) caret.style.opacity = time > built ? (Math.floor((time - built) / 0.5) % 2 === 0 ? "1" : "0") : "1";
      if (mk) {
        // Place the icon on every frame, not only from markAt: tl.set shows it at markAt, and
        // the tween's time can land a hair before markAt on that same frame.
        var lq = Math.max(0, time - markAt + 1e-6) / LAND;
        var sc = lq >= 1 ? 1 : 0.55 + 0.45 * ease(lq, "back");   // lands with a small overshoot
        var mw = markPx, mh = markPx, mx = lcx - markPx / 2, my = lcy - markPx / 2, mr = mk.radius * markPx;
        var glyphOp = 1, flatOp = 0, orbDepth = 1, orbB = 0;
        if (mk.orb) {
          // the orb breathes once it has landed, and is calm again by the time it grows
          orbB = breathAt(time, orbPlan);
          if (growAt !== null) orbB *= Math.max(0, Math.min(1, (growAt - time) / 0.12));
          sc *= 1 + 0.08 * orbB;
        }
        if (growAt !== null && time >= growAt - 1e-6) {
          // "fill" and "open": the tile grows to the full frame and its corners flatten, like an
          // app opening; for "open", LaunchMotion.open fades the next scene in along the same path
          var fq = ease((time - growAt) / OPEN, "inout");
          mx *= 1 - fq; my *= 1 - fq;
          mw += (W - mw) * fq; mh += (H - mh) * fq;
          mr *= 1 - fq; sc = 1;
          glyphOp = Math.max(0, 1 - (time - growAt) / 0.15);
          // a gradient tile fades into the flat brand colour as it grows; an app icon's own tile
          // gives way to it at once, under its fading picture
          flatOp = mk.own ? 1 : fq;
          orbDepth = 1 - fq;   // the orb's light and shade flatten into the brand colour
        }
        if (lockAt !== null) {
          mx += lockDX * ease((time - lockAt) / 0.35, "out");   // the icon makes room for the name
          var nn = 0;
          while (nn < nameT.length && nameT[nn] <= time + 1e-6) nn++;
          if (nameEl.__n !== nn) { nameEl.textContent = nameWords.slice(0, nn).join(" "); nameEl.__n = nn; }
        }
        var ms = mk.el.style;
        ms.width = mw.toFixed(1) + "px";
        ms.height = mh.toFixed(1) + "px";
        ms.borderRadius = mr.toFixed(1) + "px";
        ms.transform = "translate(" + mx.toFixed(2) + "px," + my.toFixed(2) + "px) scale(" + sc.toFixed(4) + ")";
        if (mk.glyph) mk.glyph.style.opacity = glyphOp.toFixed(3);
        if (mk.flat) mk.flat.style.opacity = flatOp.toFixed(3);
        if (mk.orb) paintOrb(mk, orbDepth, orbB);
        // one soft ring spreads from the landed icon
        var rq = Math.max(0, time - markAt) / 0.6;
        mk.ring.style.transform = "translate(" + (lcx - markPx / 2).toFixed(2) + "px," + (lcy - markPx / 2).toFixed(2) + "px) scale(" +
          (1 + 1.4 * ease(Math.min(1, rq), "out")).toFixed(4) + ")";
        mk.ring.style.opacity = (rq < 1 ? 0.55 * (1 - rq) : 0).toFixed(3);
      }
    }
    tl.to(proxy, { t: tweenEnd, duration: Math.max(FRAME, tweenEnd - at), ease: "none", onUpdate: render, immediateRender: false }, at);
    tl.set(block, { visibility: "inherit" }, at); // "inherit", not "visible": a hidden scene hides its text
    if (hideAt !== null) tl.set(block, { visibility: "hidden" }, hideAt);
    // A statement that stays ("none") gives way to the next statement on this stage, the way a
    // kept icon does; otherwise it shows again whenever the stage comes back.
    if (exit === "none") stage.__ltKept = { els: [block], from: at };
    if (mk) {
      tl.set(mk.el, { visibility: "inherit" }, markAt);
      tl.set(mk.ring, { visibility: "inherit" }, markAt);
      tl.set(mk.ring, { visibility: "hidden" }, markAt + 0.6);
      if (markEnd === "hide") tl.set(mk.el, { visibility: "hidden" }, end);
      else if (markEnd === "open") tl.set(mk.el, { visibility: "hidden" }, openAt + OPEN);
      else stage.__ltKept = { els: nameEl ? [mk.el, nameEl] : [mk.el], from: markAt };
      if (nameEl) tl.set(nameEl, { visibility: "inherit" }, nameT[0]);
    }
    var out = { at: at, built: built, exitAt: exitAt, end: end, mark: mk ? mk.el : null, size: size, theme: th };
    if (mk) {
      out.markAt = markAt;
      out.markX = out.dotX = lcx;
      out.markY = out.dotY = lcy;
      out.markSize = markPx;
      out.glyph = mk.glyph || null;   // the logo inside the tile, to animate its parts
    }
    if (exit === "mark" && markEnd === "open") {
      if (!opts.next || !window.LaunchMotion) throw new Error("launch-text: markEnd \"open\" needs `next` and launch-motion.js");
      var o = window.LaunchMotion.open(tl, { at: openAt, scene: opts.next, from: stage, x: lcx, y: lcy,
        w: markPx, h: markPx, r: mk.radius * markPx, dur: OPEN });
      out.end = o.end;
    }
    // for the reading-time check: the words a viewer reads are the final text (a slot's last word)
    var plain = rawLines.join(" ").replace(/\{slot\}/g, slot ? slot[slot.length - 1] : "").replace(/[{}]/g, "");
    statements.push({ stage: stage, at: at, last: lastT, built: built, exitAt: exitAt, end: out.end, exit: exit,
      text: rawLines.join(" / "), words: plain.split(/\s+/).filter(Boolean).length });
    return out;
  }

  var READ_WORD = 0.3;    // seconds a word, counted from the statement's first word
  var READ_AFTER = 1.2;   // seconds after the last word lands (the style's 1.2–1.8 s hold)
  /**
   * timing() -> one row per statement, in time order, checked against the reading rules
   * (step-2-plan.md, "Reading time"): about 0.3 s a word counted from the first word, and at
   * least 1.2 s after the last word lands. A statement is read until the first of: its exit, the
   * next statement on its stage, and a transition that takes its stage away (LaunchMotion). A row
   * is {n, stage, at, last, gone, words, shown, after, need, short, ok, exit, text}; `short` is how
   * many seconds it lacks. scripts/launch_events.cjs prints it as a table.
   */
  function timing() {
    var moves = (window.LaunchMotion && window.LaunchMotion.moves) || [];
    var list = statements.slice().sort(function (a, b) { return a.at - b.at; });
    function r3(v) { return Math.round(v * 1000) / 1000; }
    return list.map(function (s, i) {
      var gone = s.exit === "none" ? Infinity : s.exitAt;
      list.forEach(function (n) {
        if (n !== s && n.stage === s.stage && n.at > s.at + 1e-6 && n.at < gone) gone = n.at;
      });
      moves.forEach(function (m) {
        if (m.from && (m.from === s.stage || m.from.contains(s.stage)) && m.at > s.at + 1e-6 && m.at < gone) gone = m.at;
      });
      if (!isFinite(gone)) gone = windowEnd(s.stage, s.at);
      var need = Math.max(READ_WORD * s.words, s.last - s.at + READ_AFTER);
      var short = need - (gone - s.at);
      return { n: i + 1, stage: s.stage.id || s.stage.className || "", at: r3(s.at), last: r3(s.last), gone: r3(gone),
        words: s.words, shown: r3(gone - s.at), after: r3(gone - s.last), need: r3(need), short: r3(Math.max(0, short)),
        ok: short <= FRAME / 2, exit: s.exit, text: s.text };
    });
  }

  /**
   * mark(tl, stage, {at, x, y, hold, keep, size}) -> {at, end, el, glyph} shows the product's
   * icon on its own (a logo moment, a scene opener): it lands with a small overshoot and one
   * soft ring (the orb then breathes), then hides after `hold` seconds (default 0.8; the orb's
   * one breath, 0.9) or, with keep, stays until the next statement on the same stage.
   */
  function mark(tl, stage, opts) {
    opts = opts || {};
    var th = opts.theme ? resolve(opts.theme) : (stage.__ltTheme || current);
    var W = stage.clientWidth || 1920, H = stage.clientHeight || 1080;
    var at = opts.at || 0;
    var stays = !!opts.keep;
    var orbPlan = hasLogo(th) ? null : breathPlan(at + LAND, stays);
    var hold = opts.hold !== undefined ? opts.hold : (opts.dur !== undefined ? opts.dur : (orbPlan ? orbPlan.t1 - (at + LAND) : 0.8));
    var px = opts.size || Math.round(W * 0.0615 * 0.72 * 1.3);
    var cx = opts.x !== undefined ? opts.x : W / 2, cy = opts.y !== undefined ? opts.y : H / 2;
    var mk = makeMark(th, px, stage, !!opts.size);
    px = mk.px;
    // the clock runs through the landing and the ring, and on to the end while the orb breathes
    var tEnd = stays ? Math.max(at + LAND + hold, windowEnd(stage, at)) : at + Math.max(0.6, LAND + hold);
    function render(time) {
      var lq = Math.max(0, time - at + 1e-6) / LAND;
      var sc = lq >= 1 ? 1 : 0.55 + 0.45 * ease(lq, "back");
      var b = orbPlan ? breathAt(time, orbPlan) : 0;
      sc *= 1 + 0.08 * b;
      mk.el.style.transformOrigin = "50% 50%";
      mk.el.style.transform = "translate(" + (cx - px / 2).toFixed(2) + "px," + (cy - px / 2).toFixed(2) + "px) scale(" + sc.toFixed(4) + ")";
      if (mk.orb) paintOrb(mk, 1, b);
      var rq = Math.max(0, time - at) / 0.6;
      mk.ring.style.transform = "translate(" + (cx - px / 2).toFixed(2) + "px," + (cy - px / 2).toFixed(2) + "px) scale(" +
        (1 + 1.4 * ease(Math.min(1, rq), "out")).toFixed(4) + ")";
      mk.ring.style.opacity = (rq < 1 ? 0.55 * (1 - rq) : 0).toFixed(3);
    }
    render(orbPlan ? orbPlan.t1 : at + LAND + ORB_BREATH);   // the landed state at rest, for any frame the clock never reaches
    var proxy = { t: at };
    tl.to(proxy, { t: tEnd, duration: tEnd - at, ease: "none", immediateRender: false,
      onUpdate: function () { render(proxy.t); } }, at);
    tl.set(mk.el, { visibility: "inherit" }, at);
    tl.set(mk.ring, { visibility: "inherit" }, at);
    tl.set(mk.ring, { visibility: "hidden" }, at + 0.6);
    if (!opts.keep) tl.set(mk.el, { visibility: "hidden" }, at + LAND + hold);
    else {
      // joins whatever else stays on this stage (a statement with exit "none"): all of it gives
      // way to the next statement
      var kept = stage.__ltKept;
      stage.__ltKept = { els: (kept ? kept.els : []).concat([mk.el]), from: kept ? Math.min(kept.from, at) : at };
    }
    emit(at, "mark");
    return { at: at, end: at + LAND + hold, el: mk.el, glyph: mk.glyph || null };
  }

  window.LaunchText = {
    statement: statement, mark: mark, dot: mark /* the older name, now the product icon */,
    theme: theme, resolve: resolve, fit: fit, contrast: contrast, mix: mix, music: setMusic,
    // the first beat of the music at or after t (t itself without music): lock cuts to it
    nextBeat: function (t) { return music ? nextBeat(t) : t; },
    current: function () { return current; },
    events: events, emit: emit, statements: statements, timing: timing,
    pieces: pieces, FILM_HUES: FILM_HUES, PRESETS: PRESETS,
    get TEXT_PALETTE() { return current.text; }
  };
})();
