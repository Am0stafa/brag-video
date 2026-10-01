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
 *   - a statement exits by a cut, a dim, a slide, a blur, or by condensing into the product's
 *     own logo, bare on the canvas (with no logo, the brand orb: a breathing circle). The
 *     logo comes into focus with a soft glow of its brand colour (no tile, no pop, unless the
 *     theme's mark asks for them), then hides, stays, becomes the closing lockup with the
 *     name, fills the frame with the brand colour, or opens into the next scene the way an
 *     app opens. This is /brag's own move: the film collapses into a colour-cycling dot,
 *     which /brag never copies.
 *
 * Themes: light (the film's white canvas) by default, dark (the film's black scene), or the
 * app's own colours. The canvas is never one flat colour: every stage gets a living backdrop
 * drawn from its theme (glossy slats drifting at depth on a dark theme, soft glows of the brand
 * colours on a light one, or a gliding grid), and every text colour is fitted to at least 3.2:1
 * against the background and the brightest (or darkest) colour its backdrop can put behind it.
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
 *                      mark: { svg: "<svg …the product's logo in its own colours…>" } });
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
  // reaches the contrast needed for large text against every background given (the canvas,
  // and the brightest or darkest colours its backdrop can put behind the text); the hue stays.
  function fitAll(colour, backs, min, warn) {
    min = min || 3.2;
    var bg = backs[0];
    var c = rgb(colour), target = isDark(bg) ? [255, 255, 255] : [0, 0, 0];
    for (var k = 0; k <= 50; k++) {
      var t = k / 50;
      var m = hex([c[0] + (target[0] - c[0]) * t, c[1] + (target[1] - c[1]) * t, c[2] + (target[2] - c[2]) * t]);
      if (backs.every(function (b) { return contrast(m, b) >= min; })) {
        // warn only when the colour needs a big shift on the app's own background: the extra
        // lift for the backdrop is the engine's business, not a reason to change the brand
        if (warn) warn = (backs.length > 1 ? shiftOf(colour, bg, min) : t) > 0.35;
        if (warn && window.console) console.warn("launch-text: " + colour + " needed a big shift to read on " + bg + "; consider another accent");
        return m;
      }
    }
    return hex(target);
  }
  function fit(colour, bg, min, warn) { return fitAll(colour, [bg], min, warn); }
  // how far toward black or white a colour must move to reach `min` against bg alone (0 to 1)
  function shiftOf(colour, bg, min) {
    var c = rgb(colour), target = isDark(bg) ? [255, 255, 255] : [0, 0, 0];
    for (var k = 0; k <= 50; k++) {
      var t = k / 50;
      if (contrast(hex([c[0] + (target[0] - c[0]) * t, c[1] + (target[1] - c[1]) * t, c[2] + (target[2] - c[2]) * t]), bg) >= min) return t;
    }
    return 1;
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
   * mark is the product's logo for the "mark" exit:
   *   { svg: "<svg…>" } or { src: "assets/brand/logo.svg" }  the logo, drawn in its own colours so
   *     it reads on the canvas as it is; with neither, the mark is the brand orb, a breathing circle
   *     in the brand colour (a product with no logo: say orb: true, and the console note that
   *     catches a forgotten logo stays quiet); { text: "P" } only when an initial was asked for
   *   tile: false (the default) shows the logo bare on the canvas, the way the product shows it:
   *     it comes into focus with a soft glow of the brand colour. true (or a tile `background`)
   *     sets it on a brand-colour tile like an app icon, and "own" takes an svg or src that is a
   *     whole app icon drawing its own tile; use either only when the user asks for the app icon
   *   land: "focus" (the default): the logo comes into focus, out of a soft blur, settling from
   *     a hair larger, with no overshoot and no ring; "pop": the older landing, from 55% with a
   *     small overshoot and one soft ring
   *   color: the brand colour: the glow, a tile, its ring, and the flat field a "fill" ends in
   *     (default the first colour of `background`, else the theme's brand accent as the brand has it)
   *   background: any CSS background for a tile, such as the app icon's gradient
   *     ("linear-gradient(135deg, #1d4ed8, #0ea5e9)"); as the tile grows ("fill", "open") it
   *     turns into the flat `color`
   *   radius: the corner radius of a tile, and of the shape a "fill" or "open" grows from the
   *     logo, as a share of its size (default 0.23, an app icon's)
   *   style: extra CSS for a tile, e.g. { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)" }
   *   name: the product's name, for the "lockup" end
   */
  function resolve(spec, inherit, quiet) {
    if (!spec) spec = "light";
    if (typeof spec === "string") spec = PRESETS[spec] || PRESETS.light;
    var bg = spec.bg || "#fdfdfd";
    var dark = isDark(bg);
    var brand = spec.accent || "#0a84f9";
    var rawInk = spec.ink || (dark ? "#ffffff" : "#000000");
    // the backdrop behind the statements, and the colours it can put behind the text
    var bd = backdropSpec(spec.backdrop !== undefined ? spec.backdrop : inherit, dark);
    var look = backdropLook(bd, bg, rawInk, brand, spec.palette, dark);
    var backs = [bg].concat(look.peaks);
    var ink = rawInk;
    if (!backs.every(function (b) { return contrast(ink, b) >= 4.5; })) ink = fitAll(ink, backs, 4.5, !quiet);
    var accent = fitAll(brand, backs, 3.2, !quiet);
    // light backgrounds start from the deepened text hues, dark ones from the film's own
    var hues = spec.palette || (dark ? FILM_HUES : LIGHT_TEXT);
    var text = hues.map(function (c) { return fitAll(c, backs); });
    // the accent leads the flicker and is where the key word settles
    text = [accent].concat(text.filter(function (c) { return c.toLowerCase() !== accent.toLowerCase(); })).slice(0, 5);
    return { bg: bg, ink: ink, accent: accent, brand: brand, text: text, mark: spec.mark || null, dark: dark,
      backdrop: bd, look: look, backs: backs, rawBackdrop: spec.backdrop !== undefined ? spec.backdrop : inherit };
  }

  // ---- the backdrop: the canvas behind the statements is never one flat colour ----
  // Every stage that holds statements gets a living background drawn from its theme (its
  // background, ink and brand colour), moving slowly on the video's own clock: glossy slats
  // drifting at depth, soft glows of the brand colours, or a grid gliding toward the viewer.
  // Every text colour is fitted against the brightest (dark theme) or darkest (light theme)
  // colour the backdrop can put behind it, so the statements keep their contrast on every frame.
  var BACKDROPS = { slats: 1, aurora: 1, grid: 1, flat: 1 };
  function backdropSpec(b, dark) {
    if (b === undefined || b === null || b === "auto" || b === true) b = {};
    if (b === false || b === "none") b = { kind: "flat" };
    if (typeof b === "string") b = { kind: b };
    var kind = b.kind && b.kind !== "auto" ? b.kind : (dark ? "slats" : "aurora");
    if (!BACKDROPS[kind]) throw new Error("launch-text: a backdrop is \"slats\", \"aurora\", \"grid\" or \"flat\", not \"" + kind + "\"");
    return { kind: kind, intensity: b.intensity !== undefined ? Math.max(0, Math.min(1.6, +b.intensity)) : 1,
      speed: b.speed !== undefined ? +b.speed : 1, seed: b.seed || 11, angle: b.angle !== undefined ? +b.angle : 42,
      pulse: b.pulse !== false, colors: b.colors || null };
  }
  // a colour turned around the hue wheel by `deg`, for glows that sit beside the brand colour
  function hueTurn(c, deg) {
    var x = rgb(c).map(function (v) { return v / 255; });
    var mx = Math.max(x[0], x[1], x[2]), mn = Math.min(x[0], x[1], x[2]), l = (mx + mn) / 2, d = mx - mn, h = 0, s = 0;
    if (d > 1e-6) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === x[0] ? ((x[1] - x[2]) / d) % 6 : mx === x[1] ? (x[2] - x[0]) / d + 2 : (x[0] - x[1]) / d + 4;
      h *= 60;
    }
    h = ((h + deg) % 360 + 360) % 360;
    var C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs((h / 60) % 2 - 1)), m = l - C / 2;
    var p = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
    return hex(p.map(function (v) { return (v + m) * 255; }));
  }
  var PULSE = 1.15;   // the music's downbeat lifts the backdrop's light this much at most
  // the backdrop's colours, and `peaks`: the extremes it can put behind the text
  function backdropLook(bd, bg, ink, brand, palette, dark) {
    var k = bd.intensity, P = bd.pulse ? PULSE : 1;
    if (bd.kind === "slats") {
      // glossy bars: a highlight toward white (dark) or a soft shade toward black (light),
      // tinted a little by the brand, and one faint brand glow drifting behind them
      var lift = dark ? mix("#ffffff", brand, 0.14) : mix("#000000", brand, 0.25);
      var hiA = (dark ? 0.26 : 0.085) * k;
      var glowA = (dark ? 0.12 : 0.08) * k;
      return { hi: mix(bg, lift, hiA), sh: mix(bg, lift, hiA * 0.22), glow: brand, glowA: glowA,
        peaks: [mix(bg, lift, Math.min(1, hiA * P)), mix(bg, brand, glowA)] };
    }
    if (bd.kind === "aurora") {
      var cols = (bd.colors || (palette && palette.length > 2 ? palette.slice(0, 3) : [brand, hueTurn(brand, 38), hueTurn(brand, -34)]))
        .concat([mix(brand, dark ? "#ffffff" : "#000000", 0.25)]);
      var a = (dark ? 0.2 : 0.14) * k;   // soft enough that a lit word in the brand colour still reads on its glow
      var at = Math.min(0.85, 1 - Math.pow(1 - a * P, 2));   // two glows overlapping, on the beat
      return { cols: cols, alpha: a, peaks: cols.map(function (c) { return mix(bg, c, at); }) };
    }
    if (bd.kind === "grid") {
      var la = (dark ? 0.13 : 0.1) * k, ga = (dark ? 0.3 : 0.18) * k;
      return { line: ink, lineA: la, glow: brand, glowA: ga,
        peaks: [mix(mix(bg, brand, Math.min(1, ga * P)), ink, la)] };
    }
    return { peaks: [] };
  }
  // a deterministic random stream (no Math.random in a render)
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function rgba(c, a) { return "rgba(" + rgb(c).map(Math.round).join(",") + "," + Math.max(0, Math.min(1, a)).toFixed(3) + ")"; }
  // how strongly the music's latest downbeat (every four beats) still lifts the light: 1 on it, fading
  function pulseAt(t) {
    if (!music) return 0;
    var bar = 4 * music.beat;
    if (t < music.offset - 1e-6) return 0;
    var since = ((t - music.offset) % bar + bar) % bar;
    return Math.exp(-since / 0.45);
  }
  /**
   * backdrop(tl, host, [spec]) -> {el, kind} draws the living background inside `host` (a stage,
   * a product scene, or the root) as its first child, and moves it on the video's clock from 0 to
   * the end of the host's window. Statements give every stage its theme's backdrop on their own;
   * call this for a product scene the product floats over, or once on the root before any
   * statement for one backdrop shared by every scene (the stages then turn transparent, so focus
   * pulls and cuts keep one continuous background). spec: "slats" | "aurora" | "grid" | "flat" |
   * {kind, intensity, speed, seed, angle, pulse, colors}; default: the host's theme's backdrop.
   */
  function backdrop(tl, host, spec) {
    var th = host.__ltTheme || current;
    var bd = spec !== undefined ? backdropSpec(spec, th.dark) : th.backdrop;
    var look = spec !== undefined ? backdropLook(bd, th.bg, th.ink, th.brand, null, th.dark) : th.look;
    if (bd.kind === "flat") { host.__ltBd = null; return { el: null, kind: "flat" }; }
    var W = host.clientWidth || 1920, H = host.clientHeight || 1080, s = W / 1920;
    var layer = el("div", "lt-bd lt-bd-" + bd.kind);
    layer.setAttribute("data-layout-ignore", "");   // decorative: its parts leave the frame on purpose
    layer.style.background = th.bg;
    var rand = rng(bd.seed), v = bd.speed, parts = [], draw;
    var TAU2 = Math.PI * 2;
    if (bd.kind === "slats") {
      // glossy bars at depth, drifting along their length at different speeds, the whole field
      // sliding slowly sideways; a bar that leaves the frame comes back from the other end unseen
      var group = el("div", "lt-bd-group");
      var diag = Math.sqrt(W * W + H * H);
      group.style.transform = "translate(" + (W / 2).toFixed(1) + "px," + (H / 2).toFixed(1) + "px) rotate(" + bd.angle + "deg)";
      var glow = el("i", "lt-bd-glow");
      var gs = W * 0.7;
      glow.style.width = glow.style.height = gs.toFixed(0) + "px";
      glow.style.background = "radial-gradient(circle, " + rgba(look.glow, look.glowA) + " 0%, " + rgba(look.glow, 0) + " 68%)";
      layer.appendChild(glow);
      // the bars catch a pool of light that drifts slowly, so they read as solid shapes at depth
      var lit = el("div", "lt-bd-lit");
      var n = 9;
      for (var i = 0; i < n; i++) {
        var depth = rand(), thick = (130 + depth * 190) * s, len = (0.6 + rand() * 0.55) * diag;
        var hi = mix(look.sh, look.hi, 0.45 + 0.55 * depth);
        var bar = el("i", "lt-bd-slat");
        bar.style.width = len.toFixed(0) + "px";
        bar.style.height = thick.toFixed(0) + "px";
        bar.style.borderRadius = (thick / 2).toFixed(0) + "px";
        // round like a glossy cylinder: a broad lit face with a brighter band, falling into shade
        bar.style.background = "linear-gradient(to bottom, " + rgba(look.sh, 0) + " 0%, " + look.sh + " 10%, " + mix(look.sh, hi, 0.55) +
          " 26%, " + hi + " 40%, " + mix(look.sh, hi, 0.35) + " 62%, " + look.sh + " 84%, " + rgba(look.sh, 0) + " 100%)";
        group.appendChild(bar);
        parts.push({ el: bar, len: len, thick: thick, across: (i - (n - 1) / 2) * 250 * s + (rand() - 0.5) * 60 * s,
          along: (rand() - 0.5) * diag, v: (14 + depth * 22) * s * v, R: diag / 2 + len / 2 + 60 * s });
      }
      lit.appendChild(group);
      layer.appendChild(lit);
      draw = function (t) {
        var lift = 1 / PULSE + (1 - 1 / PULSE) * (bd.pulse ? pulseAt(t) : 0);
        var slide = 9 * s * v * t;
        var pool = "radial-gradient(ellipse 62% 78% at " + (50 + 16 * Math.sin(TAU2 * t * v / 37)).toFixed(1) + "% " +
          (64 + 10 * Math.sin(TAU2 * t * v / 29 + 0.8)).toFixed(1) + "%, #000 0%, rgba(0,0,0,0.36) 100%)";
        lit.style.webkitMaskImage = pool;
        lit.style.maskImage = pool;
        for (var k = 0; k < parts.length; k++) {
          var p = parts[k], R = p.R;
          var a = ((p.along + p.v * t + R) % (2 * R) + 2 * R) % (2 * R) - R;
          var c = ((p.across + slide + diag * 0.6) % (diag * 1.2) + diag * 1.2) % (diag * 1.2) - diag * 0.6;
          p.el.style.transform = "translate(" + (a - p.len / 2).toFixed(1) + "px," + (c - p.thick / 2).toFixed(1) + "px)";
          p.el.style.opacity = lift.toFixed(3);
        }
        glow.style.transform = "translate(" + (W * (0.5 + 0.18 * Math.sin(TAU2 * t / 29 * v)) - gs / 2).toFixed(1) + "px," +
          (H * (0.55 + 0.12 * Math.sin(TAU2 * t / 23 * v + 1.3)) - gs / 2).toFixed(1) + "px)";
      };
    } else if (bd.kind === "aurora") {
      // soft glows of the brand's colours, each drifting on its own slow loop and breathing
      var m = look.cols.length;
      for (var j = 0; j < m; j++) {
        var size = (0.55 + rand() * 0.45) * W;
        var blob = el("i", "lt-bd-blob");
        blob.style.width = blob.style.height = size.toFixed(0) + "px";
        blob.style.background = "radial-gradient(circle, " + rgba(look.cols[j], look.alpha) + " 0%, " +
          rgba(look.cols[j], look.alpha * 0.5) + " 34%, " + rgba(look.cols[j], 0) + " 68%)";
        layer.appendChild(blob);
        parts.push({ el: blob, size: size, x: (0.18 + rand() * 0.64) * W, y: (0.2 + rand() * 0.6) * H,
          ax: (0.1 + rand() * 0.12) * W, ay: (0.08 + rand() * 0.1) * H, tx: 17 + rand() * 14, ty: 19 + rand() * 15,
          px: rand() * TAU2, py: rand() * TAU2 });
      }
      draw = function (t) {
        var lift = 1 / PULSE + (1 - 1 / PULSE) * (bd.pulse ? pulseAt(t) : 0);
        for (var k = 0; k < parts.length; k++) {
          var p = parts[k];
          var x = p.x + p.ax * Math.sin(TAU2 * t * v / p.tx + p.px), y = p.y + p.ay * Math.sin(TAU2 * t * v / p.ty + p.py);
          var sc = 1 + 0.08 * Math.sin(TAU2 * t * v / (p.tx * 1.3) + p.py);
          p.el.style.transform = "translate(" + (x - p.size / 2).toFixed(1) + "px," + (y - p.size / 2).toFixed(1) + "px) scale(" + sc.toFixed(4) + ")";
          p.el.style.opacity = lift.toFixed(3);
        }
      };
    } else {
      // a floor grid gliding toward the viewer under a glow on the horizon
      var cell = 96 * s, horizon = H * 0.64;
      var hglow = el("i", "lt-bd-hglow");
      hglow.style.width = (W * 1.3).toFixed(0) + "px";
      hglow.style.height = (H * 0.7).toFixed(0) + "px";
      hglow.style.transform = "translate(" + (-W * 0.15).toFixed(1) + "px," + (horizon - H * 0.35).toFixed(1) + "px)";
      hglow.style.background = "radial-gradient(ellipse at 50% 50%, " + rgba(look.glow, look.glowA) + " 0%, " + rgba(look.glow, 0) + " 70%)";
      var floor = el("i", "lt-bd-floor");
      floor.style.width = (W * 3).toFixed(0) + "px";
      floor.style.height = (H * 1.6).toFixed(0) + "px";
      floor.style.transform = "translate(" + (-W).toFixed(1) + "px," + horizon.toFixed(1) + "px) perspective(" + (H * 0.55).toFixed(0) + "px) rotateX(64deg)";
      var line = rgba(look.line, look.lineA), lw = Math.max(1.5, 2 * s).toFixed(1);
      floor.style.backgroundImage = "linear-gradient(" + line + " " + lw + "px, transparent " + lw + "px), " +
        "linear-gradient(90deg, " + line + " " + lw + "px, transparent " + lw + "px)";
      floor.style.backgroundSize = cell.toFixed(1) + "px " + cell.toFixed(1) + "px";
      layer.appendChild(hglow);
      layer.appendChild(floor);
      draw = function (t) {
        var lift = 1 / PULSE + (1 - 1 / PULSE) * (bd.pulse ? pulseAt(t) : 0);
        floor.style.backgroundPosition = "0px " + ((t * 40 * s * v) % cell).toFixed(2) + "px";
        hglow.style.opacity = lift.toFixed(3);
      };
    }
    if (th.dark) layer.appendChild(el("i", "lt-bd-vignette"));   // depth: darker toward the edges
    host.insertBefore(layer, host.firstChild);
    draw(0);
    var tEnd = windowEnd(host, 0), proxy = { t: 0 };
    tl.to(proxy, { t: tEnd, duration: Math.max(FRAME, tEnd), ease: "none", immediateRender: false,
      onUpdate: function () { draw(proxy.t); } }, 0);
    host.__ltBd = { el: layer, kind: bd.kind };
    return { el: layer, kind: bd.kind };
  }
  // A stage gets its theme's backdrop the first time it shows something, unless an ancestor
  // already holds a shared one: then the stage turns transparent over it.
  function ensureBackdrop(tl, stage, th) {
    if (stage.__ltBd !== undefined) return;
    // a title stage over a veiled product (class "lt-over") stays transparent
    if (stage.classList && stage.classList.contains("lt-over")) { stage.__ltBd = null; return; }
    for (var p = stage.parentElement; p; p = p.parentElement) {
      if (p.__ltBd) { stage.__ltBd = null; stage.style.background = "transparent"; return; }
    }
    if (th.backdrop.kind === "flat") { stage.__ltBd = null; return; }
    var own = stage.__ltTheme;
    stage.__ltTheme = th;   // draw it in the theme the statements use
    backdrop(tl, stage);
    stage.__ltTheme = own;
  }

  var current = resolve("light", undefined, true);   // the default, quiet until a composition picks its own

  /**
   * theme(spec, [el]) sets the theme for the statements that follow (or, with el, for one stage)
   * and writes --lt-bg, --lt-ink and --lt-accent on the root (or on el). Returns the resolved theme.
   * spec.backdrop picks the living background behind the statements: "auto" (the default: slats
   * on a dark theme, aurora on a light one), "slats", "aurora", "grid", "flat" (only when asked),
   * or {kind, intensity (0–1.6, default 1), speed, seed, angle, pulse, colors}. A stage's theme
   * with no backdrop of its own takes the global theme's choice.
   */
  function theme(spec, el) {
    var th = resolve(spec, el ? current.rawBackdrop : undefined);
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

  // ---- the product's mark: its logo, bare on the canvas ----
  // Built from the theme's mark (or the global theme's). The logo shows as the product shows
  // it, with no tile: it comes into focus out of a soft blur, settling from a hair larger, and
  // a soft glow of its brand colour blooms around it, then breathes while it stays. A tile
  // (an app icon) and the older pop-and-ring landing are there only when the mark asks. A
  // product with no logo gets the brand orb instead: a circle the size of a capital letter in
  // its one brand colour, with light and depth (a lighter top, a deeper edge). It comes into
  // focus like the logo, then breathes: it swells, lights up and glows once, then settles, and
  // keeps breathing slowly while it stays on screen. One hue only: it never cycles through
  // colours (that is the film's dot). `exact` keeps the size the caller asked for.
  function hasLogo(th) {
    var spec = th.mark || current.mark || {};
    return !!(spec.svg || spec.src || spec.text);
  }
  function landOf(th) {
    var spec = th.mark || current.mark || {};
    return spec.land === "pop" ? "pop" : "focus";
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
    // a tile only when asked for: tile true, a tile `background`, or a letter (which needs one)
    var tile = !orb && !own && (spec.tile === true || (spec.tile === undefined && !!(spec.text || spec.background)));
    var bare = !orb && !own && !tile;
    var land = landOf(th);
    var tileBg = tile ? spec.background || null : null;
    var brand = spec.color || firstColour(spec.background) || th.brand || current.brand || "#0a84f9";
    if (orb) {
      if (!exact) px = Math.round(px / 1.3);
      // orb: true says the product really has no logo; otherwise a forgotten logo gets noticed
      if (window.console && !makeMark.noted && !spec.orb) {
        makeMark.noted = true;
        console.warn("launch-text: the mark has no logo, so it is the brand orb (a breathing circle in " + brand +
          "); if the product has a logo, pass it as theme({ mark: { svg } })");
      }
    }
    var radius = orb ? 0.5 : (spec.radius !== undefined ? +spec.radius : 0.23);
    var m = el("div", "lt-mark" + (bare ? " lt-mark-bare" : ""));
    m.style.width = m.style.height = px + "px";
    m.style.borderRadius = (radius * 100) + "%";
    m.style.background = orb ? brand : tile ? tileBg || brand : "transparent";
    if (spec.style && tile) for (var prop in spec.style) m.style[prop] = spec.style[prop];
    m.style.visibility = "hidden";
    // Under the logo, a flat layer of the brand colour: a gradient tile or an app icon's own
    // tile turns into it as the tile grows into the frame ("fill", "open"), and a bare logo's
    // "fill" grows it out of the logo.
    var flat = null;
    if (tileBg || own || bare) {
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
    // the soft ring belongs to the older "pop" landing only
    var ring = null;
    if (land === "pop") {
      ring = el("div", "lt-ping");
      ring.style.width = ring.style.height = px + "px";
      ring.style.borderRadius = (radius * 100) + "%";
      ring.style.borderColor = brand;
      ring.style.visibility = "hidden";
      parent.appendChild(ring);
    }
    parent.appendChild(m);
    var mk = { el: m, ring: ring, glyph: glyph, flat: flat, own: own, bare: bare, land: land, px: px, radius: radius,
      brand: brand, rgb: rgb(brand), dark: th.dark, orb: null };
    if (orb) {
      mk.orb = { tint: mix(brand, "#ffffff", 0.42), shade: mix(brand, "#000000", 0.25), rgb: rgb(brand) };
      paintOrb(mk, 1, 0);
    }
    return mk;
  }

  var FOCUS = 0.5;   // the logo comes into focus in 0.5 s
  // how the mark looks while it lands, `at` being when it starts: {sc, op, blur}
  function landing(mk, time, at) {
    var dt = time - at + 1e-6;
    if (mk.land === "pop") {
      var lq = Math.max(0, dt) / LAND;
      return { sc: lq >= 1 ? 1 : 0.55 + 0.45 * ease(lq, "back"), op: 1, blur: 0 };   // a small overshoot
    }
    // into focus: out of a soft blur, settling from 6% larger, no overshoot
    var e = ease(dt / FOCUS, "out");
    return { sc: 1.06 - 0.06 * e, op: Math.max(0, Math.min(1, dt / (FOCUS * 0.6))), blur: mk.px * 0.12 * (1 - e) };
  }
  function landTime(mk) { return mk.land === "pop" ? LAND : FOCUS; }
  // the bare logo's glow: it blooms as the logo comes into focus, settles to half, and breathes
  // with the plan (on the beat once there is music)
  function glowAt(time, at, plan) {
    var dt = time - at;
    if (dt <= 0) return 0;
    var g = dt < 0.6 ? ease(dt / 0.6, "out") : 1 - 0.5 * ease((dt - 0.6) / 0.9, "inout");
    return g + (plan ? 0.5 * breathAt(time, plan) : 0);
  }
  function paintGlow(mk, g) {
    if (!mk.glyph) return;
    var a = (mk.dark ? 0.5 : 0.32) * g;
    mk.glyph.style.filter = a > 0.004 ? "drop-shadow(0 0 " + (mk.px * 0.3).toFixed(1) + "px rgba(" +
      mk.rgb.map(Math.round).join(",") + "," + a.toFixed(3) + "))" : "none";
  }
  function paintLanding(mk, lk) {
    mk.el.style.opacity = lk.op.toFixed(3);
    mk.el.style.filter = lk.blur > 0.05 ? "blur(" + lk.blur.toFixed(2) + "px)" : "none";
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
   *              "mark": the statement condenses into its centre (it shrinks, blurs and fades in
   *              0.3 s) while the product's logo (the theme's mark) comes into focus there, bare,
   *              with a soft glow; with the mark's land "pop", it shrinks to a point in 0.2 s and
   *              the logo lands with a small overshoot and one soft ring
   *              "none": it stays until the next statement on this stage starts (or a transition
   *              takes the stage away); its exitAt is where that transition should start
   *   markEnd    for exit "mark": "hide" (default) | "keep" (the icon stays until the next
   *              statement on this stage) | "lockup" (the closing lockup: the icon slides left
   *              and the product's name types in beside it, then both stay) | "open" (the next
   *              scene opens from the icon like an app; pass it as `next`) | "fill" (the icon
   *              grows into a flat brand-colour field)
   *   next       the element "open" opens (see LaunchMotion.open)
   *   name       the product's name for "lockup" (default the theme's mark.name)
   *   markHold   seconds the landed logo holds before its end (default 0.45; the orb: one full breath,
   *              0.9 s, or on the beat for two beats once music() is set)
   *   (the older names still work and give the icon: exit "dot", dotEnd "reveal" → "open",
   *   "wipe" → "fill"; there is no colour-cycling dot any more)
   *   size       font size in px (default 6.15% of the stage width: 118 px at 1920)
   *   maxWidth   widest a line may be, as a share of the stage width (default 0.8); a single
   *              line wider than this is wrapped into two balanced lines first
   *   noWrap     keep a single line on one line (shrink the type instead)
   *   y          vertical offset of the block centre in px (default 0)
   *   count      [n, total]: a small feature counter ("03 / 17") centred above the statement, the
   *              number in the accent, for a feature tour where each feature has its own title
   *              (launch-style.md, "The showcase layer"); it arrives with the first word and
   *              leaves with the statement
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
    var ink = opts.ink ? fitAll(opts.ink, th.backs, 4.5, true) : th.ink;
    var accent = opts.accent ? fitAll(opts.accent, th.backs, 3.2, true) : th.accent;
    var palette = [accent].concat(th.text.filter(function (c) { return c !== accent; })).slice(0, 5);
    var flicker = opts.flicker !== undefined ? opts.flicker : 1.0;
    var flickerAll = !!opts.flickerAll;
    var slot = opts.slot || null;
    var slotColors = (opts.slotColors || palette).map(function (c) { return fitAll(c, th.backs); });
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
    ensureBackdrop(tl, stage, th);   // the living background behind the statements
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
    // the feature counter above the statement ("03 / 17")
    var countEl = null, countW = 0, countH = 0;
    if (opts.count) {
      var cn = String(opts.count[0]), ct = String(opts.count[1]);
      while (cn.length < Math.max(2, ct.length)) cn = "0" + cn;
      countEl = el("div", "lt-block lt-count");
      countEl.style.fontSize = Math.max(24, Math.round(size * 0.2)) + "px";
      countEl.style.color = fitAll(mix(th.ink, th.bg, 0.4), th.backs, 4.5);
      countEl.style.visibility = "hidden";
      countEl.innerHTML = '<span class="lt-count-n">' + esc(cn) + "</span> / " + esc(ct);
      countEl.firstChild.style.color = th.accent;
      stage.appendChild(countEl);
      countW = countEl.offsetWidth; countH = countEl.offsetHeight;
    }
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
    var markPx = Math.round(cap * 1.3);   // the logo: about 110 px next to 118 px type
    var mk = null;
    var end = exitAt;
    var markAt = null, fillAt = null, openAt = null, growAt = null, orbPlan = null, glowPlan = null;
    var focusLand = exit === "mark" && landOf(th) === "focus";
    var gone = focusLand ? 0.3 : 0.2;     // how long the statement takes to condense into the logo
    var lcx = 0, lcy = 0;
    var lockAt = null, lockDX = 0, nameEl = null, nameWords = [], nameT = [], nameX = 0, nameH = 0;
    if (exit === "dim") end = exitAt + 0.3 + 0.4;
    else if (exit === "slide") end = exitAt + 0.28;
    else if (exit === "blur") end = exitAt + 0.4;
    else if (exit === "mark") {
      // a focus landing starts while the statement is still condensing, so one becomes the other
      markAt = exitAt + (focusLand ? 0.15 : 0.2);
      var landDur = focusLand ? FOCUS : LAND;
      var stays = markEnd === "keep" || markEnd === "lockup";
      if (!hasLogo(th)) {
        // the orb holds for its first breath, which is on the beat when there is music
        orbPlan = breathPlan(markAt + landDur, stays);
        if (opts.markHold === undefined && opts.dotFlicker === undefined) markHold = orbPlan.t1 - (markAt + landDur);
      } else if (focusLand) glowPlan = breathPlan(markAt + landDur, stays);   // the logo's glow breathes too
      end = markAt + landDur + markHold;
      if (markEnd === "fill") { fillAt = end; end = fillAt + OPEN; }
      if (markEnd === "open") openAt = end;
      growAt = fillAt !== null ? fillAt : openAt;
      mk = makeMark(th, markPx, stage);
      markPx = mk.px;   // a circle (no logo) is smaller than the logo's box
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
        var nt = lockAt + 0.3;   // once the logo has made room (its slide takes 0.35 s)
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
    else if (exit === "mark") hideAt = exitAt + gone;
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
        else if (exit === "mark" && focusLand) {
          // it condenses into the logo: shrinks toward its centre, blurs and fades
          var cq = ease(q / gone, "in");
          scale = 1 - 0.45 * cq; blur = size * 0.12 * cq; opacity = 1 - cq;
        } else if (exit === "mark") scale = Math.max(0.02, 1 - ease(q / 0.2, "in"));
      }
      block.style.opacity = opacity.toFixed(3);
      block.style.filter = blur ? "blur(" + blur.toFixed(2) + "px)" : "none";
      block.style.transformOrigin = (s.w / 2) + "px " + (s.h / 2) + "px";
      block.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px) scale(" + scale.toFixed(4) + ")";
      if (countEl) {
        countEl.style.opacity = opacity.toFixed(3);
        countEl.style.filter = block.style.filter;
        countEl.style.transform = "translate(" + ((W - countW) / 2).toFixed(2) + "px," + (y - countH - size * 0.14).toFixed(2) + "px)";
      }
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
        // Place the logo on every frame, not only from markAt: tl.set shows it at markAt, and
        // the tween's time can land a hair before markAt on that same frame.
        var lk = landing(mk, time, markAt);
        var sc = lk.sc;
        var mw = markPx, mh = markPx, mx = lcx - markPx / 2, my = lcy - markPx / 2, mr = mk.radius * markPx;
        var glyphOp = 1, flatOp = 0, orbDepth = 1, orbB = 0, glow = 0;
        var calm = growAt !== null ? Math.max(0, Math.min(1, (growAt - time) / 0.12)) : 1;
        if (mk.orb) {
          // the orb breathes once it has landed, and is calm again by the time it grows
          orbB = breathAt(time, orbPlan) * calm;
          sc *= 1 + 0.08 * orbB;
        } else if (mk.bare && mk.land === "focus") glow = glowAt(time, markAt, glowPlan) * calm;
        if (growAt !== null && time >= growAt - 1e-6) {
          // "fill" and "open": a rounded shape grows from the logo to the full frame and its
          // corners flatten, like an app opening; for "open", LaunchMotion.open fades the next
          // scene in along the same path
          var fq = ease((time - growAt) / OPEN, "inout");
          mx *= 1 - fq; my *= 1 - fq;
          mw += (W - mw) * fq; mh += (H - mh) * fq;
          mr *= 1 - fq; sc = 1;
          lk = { sc: 1, op: 1, blur: 0 };
          glyphOp = Math.max(0, 1 - (time - growAt) / 0.15);
          // a gradient tile fades into the flat brand colour as it grows; an app icon's own tile
          // gives way to it at once, under its fading picture; a bare logo's "fill" grows the
          // brand colour out of it, and its "open" shows only the next scene
          flatOp = mk.own ? 1 : mk.bare ? (fillAt !== null ? fq : 0) : fq;
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
        paintLanding(mk, lk);
        if (mk.glyph) mk.glyph.style.opacity = glyphOp.toFixed(3);
        if (mk.flat) mk.flat.style.opacity = flatOp.toFixed(3);
        if (mk.orb) paintOrb(mk, orbDepth, orbB);
        if (mk.bare) paintGlow(mk, glow);
        if (mk.ring) {
          // the "pop" landing: one soft ring spreads from the landed icon
          var rq = Math.max(0, time - markAt) / 0.6;
          mk.ring.style.transform = "translate(" + (lcx - markPx / 2).toFixed(2) + "px," + (lcy - markPx / 2).toFixed(2) + "px) scale(" +
            (1 + 1.4 * ease(Math.min(1, rq), "out")).toFixed(4) + ")";
          mk.ring.style.opacity = (rq < 1 ? 0.55 * (1 - rq) : 0).toFixed(3);
        }
      }
    }
    tl.to(proxy, { t: tweenEnd, duration: Math.max(FRAME, tweenEnd - at), ease: "none", onUpdate: render, immediateRender: false }, at);
    tl.set(block, { visibility: "inherit" }, at); // "inherit", not "visible": a hidden scene hides its text
    if (hideAt !== null) tl.set(block, { visibility: "hidden" }, hideAt);
    if (countEl) {
      tl.set(countEl, { visibility: "inherit" }, at);
      tl.set(countEl, { visibility: "hidden" }, hideAt !== null ? (exit === "mark" ? exitAt : hideAt) : tweenEnd);
    }
    // A statement that stays ("none") gives way to the next statement on this stage, the way a
    // kept icon does; otherwise it shows again whenever the stage comes back.
    if (exit === "none") stage.__ltKept = { els: countEl ? [block, countEl] : [block], from: at };
    if (mk) {
      tl.set(mk.el, { visibility: "inherit" }, markAt);
      if (mk.ring) {
        tl.set(mk.ring, { visibility: "inherit" }, markAt);
        tl.set(mk.ring, { visibility: "hidden" }, markAt + 0.6);
      }
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
      out.glyph = mk.glyph || null;   // the logo itself, to animate its parts
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
   * logo on its own (a logo moment, a scene opener): it comes into focus with its soft glow (the
   * orb then breathes; with the mark's land "pop", it lands with a small overshoot and one soft
   * ring), then hides after `hold` seconds (default 0.8; the orb's one breath, 0.9) or, with
   * keep, stays until the next statement on the same stage.
   */
  function mark(tl, stage, opts) {
    opts = opts || {};
    var th = opts.theme ? resolve(opts.theme) : (stage.__ltTheme || current);
    ensureBackdrop(tl, stage, th);
    var W = stage.clientWidth || 1920, H = stage.clientHeight || 1080;
    var at = opts.at || 0;
    var stays = !!opts.keep;
    var px = opts.size || Math.round(W * 0.0615 * 0.72 * 1.3);
    var cx = opts.x !== undefined ? opts.x : W / 2, cy = opts.y !== undefined ? opts.y : H / 2;
    var mk = makeMark(th, px, stage, !!opts.size);
    px = mk.px;
    var landDur = landTime(mk);
    var orbPlan = mk.orb ? breathPlan(at + landDur, stays) : null;
    var glowPlan = mk.bare && mk.land === "focus" ? breathPlan(at + landDur, stays) : null;
    var hold = opts.hold !== undefined ? opts.hold : (opts.dur !== undefined ? opts.dur : (orbPlan ? orbPlan.t1 - (at + landDur) : 0.8));
    // the clock runs through the landing (and the ring), and on to the end while it breathes
    var tEnd = stays ? Math.max(at + landDur + hold, windowEnd(stage, at)) : at + Math.max(0.6, landDur + hold);
    function render(time) {
      var lk = landing(mk, time, at);
      var b = orbPlan ? breathAt(time, orbPlan) : 0;
      var sc = lk.sc * (1 + 0.08 * b);
      mk.el.style.transformOrigin = "50% 50%";
      mk.el.style.transform = "translate(" + (cx - px / 2).toFixed(2) + "px," + (cy - px / 2).toFixed(2) + "px) scale(" + sc.toFixed(4) + ")";
      paintLanding(mk, lk);
      if (mk.orb) paintOrb(mk, 1, b);
      if (glowPlan) paintGlow(mk, glowAt(time, at, glowPlan));
      if (mk.ring) {
        var rq = Math.max(0, time - at) / 0.6;
        mk.ring.style.transform = "translate(" + (cx - px / 2).toFixed(2) + "px," + (cy - px / 2).toFixed(2) + "px) scale(" +
          (1 + 1.4 * ease(Math.min(1, rq), "out")).toFixed(4) + ")";
        mk.ring.style.opacity = (rq < 1 ? 0.55 * (1 - rq) : 0).toFixed(3);
      }
    }
    render(orbPlan ? orbPlan.t1 : at + landDur + ORB_BREATH);   // the landed state at rest, for any frame the clock never reaches
    var proxy = { t: at };
    tl.to(proxy, { t: tEnd, duration: tEnd - at, ease: "none", immediateRender: false,
      onUpdate: function () { render(proxy.t); } }, at);
    tl.set(mk.el, { visibility: "inherit" }, at);
    if (mk.ring) {
      tl.set(mk.ring, { visibility: "inherit" }, at);
      tl.set(mk.ring, { visibility: "hidden" }, at + 0.6);
    }
    if (!opts.keep) tl.set(mk.el, { visibility: "hidden" }, at + landDur + hold);
    else {
      // joins whatever else stays on this stage (a statement with exit "none"): all of it gives
      // way to the next statement
      var kept = stage.__ltKept;
      stage.__ltKept = { els: (kept ? kept.els : []).concat([mk.el]), from: kept ? Math.min(kept.from, at) : at };
    }
    emit(at, "mark");
    return { at: at, end: at + landDur + hold, el: mk.el, glyph: mk.glyph || null };
  }

  /**
   * endcard(tl, stage, {at, name, tagline, cta, url, note, hold, y}) -> {at, end, glyph, markAt}:
   * the close of the reference product films (launch-style.md, "The showcase layer"). The logo
   * comes into focus with its glow, large, above the centre; the product's name types in under
   * it word by word with the key sound; then the tagline, the call to action (a pill in the
   * brand colour) beside the site, and a small note come into focus one after another, 0.3 s
   * apart. Everything stays to the end of the stage. Every line must come from the project (its
   * README tagline, its site, its install command, its "requires" line) or the prompt; leave
   * out whatever the project doesn't have.
   *   name     default the theme's mark.name     tagline, cta, url, note  optional strings
   *   hold     seconds from the last line to `end` (default 2)
   *   y        vertical offset of the whole card in px (default 0)
   */
  function endcard(tl, stage, opts) {
    opts = opts || {};
    var th = opts.theme ? resolve(opts.theme) : (stage.__ltTheme || current);
    ensureBackdrop(tl, stage, th);
    var W = stage.clientWidth || 1920, H = stage.clientHeight || 1080;
    var at = opts.at || 0;
    var spec = th.mark || current.mark || {};
    var name = String(opts.name || spec.name || "");
    if (!name) throw new Error("launch-text: endcard needs `name` (or the theme's mark.name)");
    if (stage.__ltKept && stage.__ltKept.from < at) {
      stage.__ltKept.els.forEach(function (e) { tl.set(e, { visibility: "hidden" }, at); });
      stage.__ltKept = null;
    }
    var muted = fitAll(mix(th.ink, th.bg, 0.3), th.backs, 4.5);
    var faint = fitAll(mix(th.ink, th.bg, 0.45), th.backs, 4.5);
    function line(cls, px, colour, text) {
      var e = el("div", "lt-block lt-card " + cls);
      e.style.fontSize = Math.round(px) + "px";
      e.style.color = colour;
      e.style.visibility = "hidden";
      if (text !== undefined) e.textContent = text;
      stage.appendChild(e);
      return e;
    }
    // the parts, measured at their final size
    var nameEl = line("lt-card-name", W * 0.047, th.ink, name);
    var tagEl = opts.tagline ? line("lt-card-tag", W * 0.0185, muted, opts.tagline) : null;
    var rowEl = null, pill = null;
    if (opts.cta || opts.url) {
      rowEl = line("lt-card-row", W * 0.0135, th.ink);
      if (opts.cta) {
        pill = el("span", "lt-card-cta");
        var onPill = contrast("#ffffff", th.brand) >= contrast("#0b0d10", th.brand) ? "#ffffff" : "#0b0d10";
        var pillBg = contrast(onPill, th.brand) >= 4.5 ? th.brand : fit(th.brand, onPill, 4.5);
        pill.style.background = pillBg;
        pill.style.color = onPill;
        pill.textContent = opts.cta;
        rowEl.appendChild(pill);
      }
      if (opts.url) {
        var u = el("span", "lt-card-url");
        u.textContent = opts.url;
        rowEl.appendChild(u);
      }
    }
    var noteEl = opts.note ? line("lt-card-note", Math.max(20, W * 0.0105), faint, opts.note) : null;
    var logoPx = Math.round(W * 0.085);
    var mk = makeMark(th, logoPx, stage, true);
    // stack them, centred, a little above the frame's centre
    var gaps = [H * 0.035, H * 0.012, H * 0.04, H * 0.035];
    var parts = [{ h: mk.px }, { el: nameEl }, { el: tagEl }, { el: rowEl }, { el: noteEl }];
    var total = 0;
    parts.forEach(function (p, i) {
      if (p.el === null) return;
      p.h = p.h || p.el.offsetHeight;
      p.w = p.el ? p.el.offsetWidth : mk.px;
      total += p.h + (i ? gaps[i - 1] : 0);
    });
    var y = (H - total) / 2 + (opts.y || 0), placed = [];
    parts.forEach(function (p, i) {
      if (p.el === null) return;
      if (i) y += gaps[i - 1];
      p.y = y;
      y += p.h;
      placed.push(p);
    });
    var cx = W / 2, logoY = parts[0].y + mk.px / 2;
    mk.el.style.transformOrigin = "50% 50%";
    mk.el.style.transform = "translate(" + (cx - mk.px / 2).toFixed(2) + "px," + (logoY - mk.px / 2).toFixed(2) + "px)";
    // the name types in, word by word, left-aligned inside its final centred box
    var words = name.split(/\s+/).filter(Boolean), nameT = [], nt = at + 0.45;
    for (var w = 0; w < words.length; w++) { nameT.push(nt); emit(nt, "word"); nt += RHYTHM[w % RHYTHM.length] * FRAME; }
    var nameBox = parts[1];
    nameEl.style.width = nameBox.w + "px";
    nameEl.textContent = "";
    nameEl.style.transform = "translate(" + (cx - nameBox.w / 2).toFixed(2) + "px," + nameBox.y.toFixed(2) + "px)";
    // the rest come into focus one after another
    var next = nt + 0.25, rest = [];
    [tagEl, rowEl, noteEl].forEach(function (e, k) {
      if (!e) return;
      var p = parts[k + 2];
      rest.push({ el: e, t: next, x: cx - p.w / 2, y: p.y });
      next += 0.3;
    });
    var last = rest.length ? rest[rest.length - 1].t : nameT[nameT.length - 1];
    var end = last + (opts.hold !== undefined ? opts.hold : 2);
    var glowPlan = mk.bare && mk.land === "focus" ? breathPlan(at + landTime(mk), true) : null;
    var orbPlan = mk.orb ? breathPlan(at + landTime(mk), true) : null;
    var FOCUS_IN = 0.4;
    function look(e, t0, x, yy, time) {
      var q = ease((time - t0) / FOCUS_IN, "out");
      e.style.opacity = Math.max(0, Math.min(1, (time - t0) / (FOCUS_IN * 0.7))).toFixed(3);
      e.style.filter = q < 0.999 ? "blur(" + (8 * (1 - q)).toFixed(2) + "px)" : "none";
      e.style.transform = "translate(" + x.toFixed(2) + "px," + (yy + 10 * (1 - q)).toFixed(2) + "px)";
    }
    function render(time) {
      var lk = landing(mk, time, at);
      var b = orbPlan ? breathAt(time, orbPlan) : 0;
      mk.el.style.transform = "translate(" + (cx - mk.px / 2).toFixed(2) + "px," + (logoY - mk.px / 2).toFixed(2) + "px) scale(" +
        (lk.sc * (1 + 0.08 * b)).toFixed(4) + ")";
      paintLanding(mk, lk);
      if (mk.orb) paintOrb(mk, 1, b);
      if (glowPlan) paintGlow(mk, glowAt(time, at, glowPlan));
      var nn = 0;
      while (nn < nameT.length && nameT[nn] <= time + 1e-6) nn++;
      if (nameEl.__n !== nn) { nameEl.textContent = words.slice(0, nn).join(" "); nameEl.__n = nn; }
      rest.forEach(function (r) { look(r.el, r.t, r.x, r.y, time); });
    }
    rest.forEach(function (r) { look(r.el, r.t, r.x, r.y, r.t + FOCUS_IN); });   // the settled look, for frames the clock never reaches
    var tEnd = Math.max(end, windowEnd(stage, at)), proxy = { t: at };
    tl.to(proxy, { t: tEnd, duration: Math.max(FRAME, tEnd - at), ease: "none", immediateRender: false,
      onUpdate: function () { render(proxy.t); } }, at);
    tl.set(mk.el, { visibility: "inherit" }, at);
    tl.set(nameEl, { visibility: "inherit" }, nameT[0]);
    rest.forEach(function (r) { tl.set(r.el, { visibility: "inherit" }, r.t); });
    stage.__ltKept = { els: [mk.el, nameEl].concat(rest.map(function (r) { return r.el; })), from: at };
    emit(at, "mark");
    var plain = name + (opts.tagline ? " " + opts.tagline : "");
    statements.push({ stage: stage, at: nameT[0], last: rest.length && tagEl ? rest[0].t : nameT[nameT.length - 1],
      built: nameT[nameT.length - 1] + FRAME, exitAt: end, end: end, exit: "none",
      text: name + (opts.tagline ? " / " + opts.tagline : ""), words: plain.split(/\s+/).filter(Boolean).length });
    return { at: at, end: end, glyph: mk.glyph || null, markAt: at };
  }

  window.LaunchText = {
    statement: statement, mark: mark, dot: mark /* the older name, now the product's logo */,
    endcard: endcard, backdrop: backdrop,
    theme: theme, resolve: resolve, fit: fit, fitAll: fitAll, contrast: contrast, mix: mix, music: setMusic,
    // the first beat of the music at or after t (t itself without music): lock cuts to it
    nextBeat: function (t) { return music ? nextBeat(t) : t; },
    current: function () { return current; },
    events: events, emit: emit, statements: statements, timing: timing,
    pieces: pieces, FILM_HUES: FILM_HUES, PRESETS: PRESETS,
    get TEXT_PALETTE() { return current.text; }
  };
})();
