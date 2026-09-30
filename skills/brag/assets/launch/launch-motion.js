/* launch-motion.js: the scene transitions and camera moves of /brag's "launch" style.
 *
 * Measured frame by frame from a modern AI launch film (see references/launch-style.md), and
 * made /brag's own where the film has a signature (its colour-cycling dot is never used):
 *   open    the product's icon opens into the next scene the way an app opens: a rounded
 *           rectangle grows from the icon to the full frame, its corners flattening (0.45 s);
 *   reveal  a circle grows from a point (ease-in, 0.3 s) and opens the next scene inside it;
 *   warp    streaks rush outward from the centre while the frame floods with the next
 *           background colour (0.35 s): out of a dark scene into a light one, or back;
 *   focus   the outgoing scene blurs away while the incoming one sharpens (0.4 s);
 *   cut     a hard cut on a beat;
 *   camera  deep zooms and pull-backs on a UI: push in on a field, follow what is typed,
 *           pull back to show the whole screen; keys eased in and out;
 *   veil    the product blurs and dims under a title card, then clears (the feature titles of
 *           the reference product films);
 *   morph   a rounded shape grows or shrinks between two rectangles with a scene inside it: a
 *           notch opening into a panel, a popover, the screen shrinking back into the logo.
 * Plus the statement exits that live in launch-text.js (one-frame reset, dim, slide, blur, and
 * the collapse into the product's icon, which calls open() for its app-open end).
 *
 * Scenes can come back: statement → product → statement → product works. Each transition
 * puts the incoming scene on top (z-index), shows it, and when it is done hides the outgoing
 * plain scene and resets what it did to it. Build transitions in time order.
 *
 * Seek-safe: inside a transition, every frame is drawn from the transition's own clock;
 * before and after it, GSAP property sets hold the state, and sets apply even when the
 * renderer jumps. Hyperframes owns the visibility of timed `.clip` elements, so nothing here
 * sets visibility on a clip. Needs launch-text.js first (for the theme and the event log).
 *
 * While open, reveal, focus or warp shows two scenes at once (or floods one), the outgoing
 * scene (for open and reveal, the incoming one too) is marked data-layout-check="ignore" (read
 * by `hyperframes check` through closest()), so the layout audit doesn't report the planned
 * cross-over as text overlapping or covered by text; both are audited again from the
 * transition's end. The warp's streak layer is never audited. Every transition is logged in
 * LaunchMotion.moves, which LaunchText.timing() reads: a statement is read until a transition
 * takes its stage away.
 */
(function () {
  "use strict";

  var FRAME = 1 / 30;
  var Z = 10; // each incoming scene goes on top of everything shown before it

  function ease(p, kind) {
    p = Math.max(0, Math.min(1, p));
    if (kind === "in") return p * p * p;
    if (kind === "out") return 1 - Math.pow(1 - p, 3);
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  // the end of the window an element is visible in: its own clip, its nearest timed
  // ancestor, or the whole composition
  function windowEnd(elm) {
    for (var e = elm; e && e.getAttribute; e = e.parentElement) {
      var s = parseFloat(e.getAttribute("data-start")), d = parseFloat(e.getAttribute("data-duration"));
      if (isFinite(s) && isFinite(d)) return s + d;
    }
    return 3600;
  }
  function timed(elm) { return elm && elm.hasAttribute && elm.hasAttribute("data-start"); }

  // a deterministic random stream (no Math.random in a render)
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  function log(t, kind) { if (window.LaunchText) window.LaunchText.emit(t, kind); }

  // every transition, in the order built: {kind, at, end, from, to}
  var moves = [];
  function note(kind, at, end, from, to) { moves.push({ kind: kind, at: at, end: end, from: from || null, to: to || null }); }

  // A cross-over transition leaves its scenes out of the layout audit while both show: in one run
  // a focus pull gave 40 "text overlaps text" warnings, which hid the real ones. Focus and warp
  // leave out the outgoing scene; open and reveal leave out both, because their growing clip
  // makes the audit read the incoming scene's text as covered by the outgoing scene. GSAP sets
  // the attribute, so any frame order gets it right; "on" is simply any value but "ignore". A
  // scene the author already marked "ignore" keeps its mark.
  function quiet(tl, el, t0, t1) {
    if (!el || el.getAttribute("data-layout-check") === "ignore") return;
    if (!el.hasAttribute("data-layout-check")) el.setAttribute("data-layout-check", "on");
    tl.set(el, { attr: { "data-layout-check": "ignore" } }, t0);
    tl.set(el, { attr: { "data-layout-check": "on" } }, t1);
  }

  function theme() {
    return window.LaunchText && window.LaunchText.current ? window.LaunchText.current() : { ink: "#ffffff", bg: "#000000" };
  }

  /** Show `el` at time t, on top of what came before. A plain scene whose first appearance
   *  is an entrance starts hidden. "inherit", not "visible": a scene inside another one must
   *  stay hidden while its parent is. */
  function enter(tl, el, t) {
    if (!timed(el)) {
      if (el.__lmFirst === undefined) { el.__lmFirst = "enter"; el.style.visibility = "hidden"; }
      tl.set(el, { visibility: "inherit" }, t);
    }
    tl.set(el, { zIndex: ++Z }, t);
  }

  /** Hide the plain scene `el` at time t and undo what the transition did to it, so it can
   *  come back later. A timed clip is hidden by Hyperframes when its window ends (end it there). */
  function leave(tl, el, t) {
    if (el.__lmFirst === undefined) el.__lmFirst = "leave";
    if (timed(el)) {
      tl.set(el, { opacity: 0 }, t);
      return;
    }
    tl.set(el, { visibility: "hidden" }, t);
    tl.set(el, { opacity: 1, filter: "none", clipPath: "none" }, t + 0.001);
  }

  /**
   * open(tl, {at, scene, from, x, y, w, h, r, dur, fade}) opens `scene` the way an app opens:
   * a rounded rectangle (the product's icon: centre x, y, size w × h, corner radius r) grows to
   * fill the frame while its corners flatten (ease in and out, default 0.45 s), and the scene
   * fades in inside it over the first `fade` seconds (default 40% of dur). The statement's
   * "mark" exit grows its icon tile along the same path underneath, so the icon turns into the
   * scene; on its own, open() works from any rectangle (a card, a thumbnail, a button).
   *   from  the scene it covers (hidden when the opening is complete)
   */
  function open(tl, o) {
    var scene = o.scene;
    var W = scene.clientWidth || 1920, H = scene.clientHeight || 1080;
    var at = o.at || 0, dur = o.dur || 0.45;
    var fade = o.fade !== undefined ? o.fade : dur * 0.4;
    var w = o.w || Math.round(W * 0.06), h = o.h || w;
    var x0 = (o.x !== undefined ? o.x : W / 2) - w / 2, y0 = (o.y !== undefined ? o.y : H / 2) - h / 2;
    var r0 = o.r !== undefined ? o.r : Math.min(w, h) * 0.23;
    function shape(time) {
      var q = ease((time - at) / dur, "inout");
      var top = y0 * (1 - q), left = x0 * (1 - q);
      var right = (W - x0 - w) * (1 - q), bottom = (H - y0 - h) * (1 - q);
      return "inset(" + top.toFixed(1) + "px " + right.toFixed(1) + "px " + bottom.toFixed(1) + "px " +
        left.toFixed(1) + "px round " + (r0 * (1 - q)).toFixed(1) + "px)";
    }
    function draw(time) {
      scene.style.clipPath = shape(time);
      scene.style.opacity = fade > 0 ? Math.max(0, Math.min(1, (time - at) / fade)).toFixed(3) : "1";
    }
    enter(tl, scene, at);
    tl.set(scene, { clipPath: shape(at), opacity: fade > 0 ? 0 : 1 }, at);
    var proxy = { t: at };
    tl.to(proxy, { t: at + dur, duration: dur, ease: "none", immediateRender: false,
      onUpdate: function () { draw(proxy.t); } }, at);
    tl.set(scene, { clipPath: "none", opacity: 1 }, at + dur);
    // both scenes: the growing clip lets the outgoing scene show around the incoming one's text
    quiet(tl, scene, at, at + dur);
    if (o.from) { quiet(tl, o.from, at, at + dur); leave(tl, o.from, at + dur); }
    log(at, "open");
    note("open", at, at + dur, o.from, scene);
    return { at: at, end: at + dur };
  }

  /**
   * reveal(tl, {at, scene, from, x, y, r0, dur}) opens `scene` inside a growing circle.
   *   scene  the element to open; from  the scene it covers (hidden when the circle is full)
   *   x, y   the circle's centre in px (default the frame centre); r0 its starting radius
   *   dur    seconds (default 0.3, measured); the growth accelerates (ease-in)
   */
  function reveal(tl, o) {
    var scene = o.scene;
    var W = scene.clientWidth || 1920, H = scene.clientHeight || 1080;
    var at = o.at || 0, dur = o.dur || 0.3;
    var x = o.x !== undefined ? o.x : W / 2, y = o.y !== undefined ? o.y : H / 2;
    var r0 = o.r0 || W * 0.012;
    var R = Math.sqrt(Math.max(x, W - x) * Math.max(x, W - x) + Math.max(y, H - y) * Math.max(y, H - y)) + 2;
    function shape(time) {
      var r = r0 + (R - r0) * ease((time - at) / dur, "in");
      return "circle(" + r.toFixed(1) + "px at " + x.toFixed(1) + "px " + y.toFixed(1) + "px)";
    }
    enter(tl, scene, at);
    tl.set(scene, { clipPath: shape(at) }, at);
    var proxy = { t: at };
    tl.to(proxy, { t: at + dur, duration: dur, ease: "none", immediateRender: false,
      onUpdate: function () { scene.style.clipPath = shape(proxy.t); } }, at);
    tl.set(scene, { clipPath: "none" }, at + dur);
    // both scenes: outside the growing circle the outgoing scene covers the incoming one's text
    quiet(tl, scene, at, at + dur);
    if (o.from) { quiet(tl, o.from, at, at + dur); leave(tl, o.from, at + dur); }
    log(at, "reveal");
    note("reveal", at, at + dur, o.from, scene);
    return { at: at, end: at + dur };
  }

  /**
   * warp(tl, {at, from, to, color, dur, streaks, ink, seed}) rushes out of `from` into `to`.
   *   from     the outgoing scene (the streaks and the flood are drawn inside it)
   *   to       the incoming scene (optional), shown when the flood is full
   *   color    the colour the frame floods to: the incoming scene's background
   *   ink      the streak colour (default: the outgoing scene's theme ink, else the current theme's)
   *   streaks  how many (default 90); dur seconds (default 0.35, measured)
   */
  function warp(tl, o) {
    var from = o.from;
    var W = from.clientWidth || 1920, H = from.clientHeight || 1080;
    var at = o.at || 0, dur = o.dur || 0.35, n = o.streaks || 90;
    var ink = o.ink || (from.__ltTheme || theme()).ink;
    var layer = document.createElement("div");
    layer.className = "lm-warp";
    layer.setAttribute("data-layout-ignore", "");   // decorative: the streaks leave the frame on purpose
    var flood = document.createElement("div");
    flood.className = "lm-flood";
    flood.style.background = o.color || "#fdfdfd";
    var rand = rng(o.seed || 7);
    var cx = W / 2, cy = H / 2, diag = Math.sqrt(W * W + H * H) / 2;
    var list = [];
    for (var i = 0; i < n; i++) {
      var s = document.createElement("i");
      s.style.background = "linear-gradient(90deg, rgba(0,0,0,0), " + ink + ")";
      layer.appendChild(s);
      list.push({ el: s, a: rand() * Math.PI * 2, r: 0.04 + rand() * 0.55, v: 0.8 + rand() * 1.6, w: 1.5 + rand() * rand() * 7 });
    }
    layer.appendChild(flood);
    from.appendChild(layer);
    function draw(time) {
      var q = Math.max(0, Math.min(1, (time - at) / dur));
      layer.style.opacity = q > 0 ? "1" : "0";
      for (var k = 0; k < list.length; k++) {
        var p = list[k];
        var r = (p.r + p.v * ease(q, "in")) * diag;
        var len = (0.02 + 0.45 * ease(q, "in") * p.v) * diag;
        p.el.style.width = len.toFixed(1) + "px";
        p.el.style.height = p.w.toFixed(1) + "px";
        p.el.style.opacity = (Math.min(1, q * 4) * (1 - 0.5 * q)).toFixed(3);
        p.el.style.transform = "translate(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px) rotate(" + p.a.toFixed(4) + "rad) translate(" + (r - len).toFixed(1) + "px,0)";
      }
      flood.style.opacity = ease(q, "in").toFixed(3);
    }
    draw(at);
    // hidden again when the renderer seeks back to before the warp (its clock never runs there)
    tl.set([layer, flood], { opacity: 0 }, at);
    var proxy = { t: at };
    tl.to(proxy, { t: at + dur, duration: dur, ease: "none", immediateRender: false,
      onUpdate: function () { draw(proxy.t); } }, at);
    if (o.to) enter(tl, o.to, at + dur);
    // while the flood covers the outgoing scene's text, the audit leaves that scene out (a clip
    // that runs on past the warp stays flooded, so until its window ends)
    quiet(tl, from, at, timed(from) ? Math.max(at + dur, windowEnd(from)) : at + dur);
    if (timed(from)) {
      // a clip that runs on past the warp stays flooded until Hyperframes hides it
      tl.set(layer, { opacity: 1 }, at + dur);
      tl.set(flood, { opacity: 1 }, at + dur);
    } else {
      leave(tl, from, at + dur);
      tl.set(layer, { opacity: 0 }, at + dur + 0.001); // clean for a later return
    }
    log(at, "warp");
    note("warp", at, at + dur, from, o.to);
    return { at: at, end: at + dur };
  }

  /**
   * focus(tl, {at, from, to, dur, blur}) is a focus pull: `from` blurs out while `to` sharpens.
   */
  function focus(tl, o) {
    var at = o.at || 0, dur = o.dur || 0.4, b = o.blur || 20;
    function draw(time) {
      var q = Math.max(0, Math.min(1, (time - at) / dur));
      if (o.from) {
        o.from.style.filter = q > 0 ? "blur(" + (b * ease(q, "out")).toFixed(2) + "px)" : "none";
        o.from.style.opacity = (1 - ease(q, "in")).toFixed(3);
      }
      if (o.to) {
        o.to.style.filter = q < 1 ? "blur(" + (b * (1 - ease(q, "out"))).toFixed(2) + "px)" : "none";
        o.to.style.opacity = ease(Math.min(1, q * 1.6), "out").toFixed(3);
      }
    }
    if (o.to) {
      enter(tl, o.to, at);
      tl.set(o.to, { opacity: 0, filter: "blur(" + b + "px)" }, at);
    }
    // changes nothing going forward; when the renderer seeks back to before the pull, GSAP puts
    // back the outgoing scene's look from before it (the clock below never runs out there)
    if (o.from) tl.set(o.from, { opacity: "+=0", filter: "none" }, at);
    var proxy = { t: at };
    tl.to(proxy, { t: at + dur, duration: dur, ease: "none", immediateRender: false,
      onUpdate: function () { draw(proxy.t); } }, at);
    if (o.to) tl.set(o.to, { opacity: 1, filter: "none" }, at + dur);
    if (o.from) { quiet(tl, o.from, at, at + dur); leave(tl, o.from, at + dur); }
    log(at, "focus");
    note("focus", at, at + dur, o.from, o.to);
    return { at: at, end: at + dur };
  }

  /**
   * veil(tl, {at, scene, over, until, blur, dim, color, dur}) -> {at, clearAt, end}: the title card of
   * the reference product films. `scene` (the product, still on screen) blurs and dims under a
   * veil of `color` (default the current theme's background) over `dur` seconds (default 0.25),
   * stays so while a title is typed over it on a transparent stage above it, then clears from
   * `until` (default at + 1.2) as the title leaves. blur in px (default 14), dim the veil's
   * opacity (default 0.6). The scene stays out of the layout audit while veiled: the title sits
   * over its text on purpose. Pass the title's stage as `over`: a stage with class "lt-stage lt-over"
   * (transparent), which the veil shows on top of the scene at `at`; exit the title with "blur" at
   * `until` (default at + 1.6, enough for a two-word title to be read).
   */
  function veil(tl, o) {
    var scene = o.scene, at = o.at || 0, dur = o.dur || 0.25;
    var until = o.until !== undefined ? o.until : at + 1.6;
    var b = o.blur !== undefined ? o.blur : 14, dim = o.dim !== undefined ? o.dim : 0.6;
    var cover = scene.__lmVeil;
    if (!cover) {
      cover = document.createElement("div");
      cover.className = "lm-veil";
      cover.setAttribute("data-layout-ignore", "");
      cover.style.opacity = "0";
      scene.appendChild(cover);
      scene.__lmVeil = cover;
    }
    var color = o.color || theme().bg;
    function draw(time) {
      var k = ease((time - at) / dur, "out") * (1 - ease((time - until) / dur, "inout"));
      k = Math.max(0, Math.min(1, k));
      scene.style.filter = k > 0.002 ? "blur(" + (b * k).toFixed(2) + "px)" : "none";
      cover.style.background = color;
      cover.style.opacity = (dim * k).toFixed(3);
    }
    // clean before and after, for frames drawn out of order
    tl.set(scene, { filter: "none" }, at);
    tl.set(cover, { opacity: 0 }, at);
    var proxy = { t: at };
    tl.to(proxy, { t: until + dur, duration: until + dur - at, ease: "none", immediateRender: false,
      onUpdate: function () { draw(proxy.t); } }, at);
    tl.set(scene, { filter: "none" }, until + dur);
    tl.set(cover, { opacity: 0 }, until + dur);
    if (o.over) enter(tl, o.over, at);   // the title's stage, on top of the scene
    // out of the audit until the title has blurred away too (a "blur" exit takes 0.4 s)
    quiet(tl, scene, at, until + Math.max(dur, 0.45));
    log(at, "veil");
    note("veil", at, until + dur, null, null);
    return { at: at, clearAt: until, end: until + dur };
  }

  /**
   * morph(tl, {at, scene, from, to, dur, fade, hide}) -> {at, end}: a rounded shape grows or
   * shrinks from one rectangle to another with `scene` showing inside it: a notch opening into a
   * panel, a popover springing out of its menu-bar item, a card becoming the whole screen, or the
   * whole screen shrinking back to a rounded square before the logo comes into focus there (the
   * close of the first reference film). from and to are {x, y, w, h, r}: centre, size and corner
   * radius in frame px; leave one out for the full frame. dur seconds (default 0.5, eased in and
   * out). A growing scene is shown on top at `at` and fades in over `fade` seconds (default 0);
   * with hide: true the scene is leaving: it is hidden at the end, fading out over the last
   * `fade` seconds. Pair it with camera() when the content should scale with the shape.
   */
  function morph(tl, o) {
    var scene = o.scene;
    var W = scene.clientWidth || 1920, H = scene.clientHeight || 1080;
    var full = { x: W / 2, y: H / 2, w: W, h: H, r: 0 };
    var A = Object.assign({}, full, o.from || {}), B = Object.assign({}, full, o.to || {});
    var at = o.at || 0, dur = o.dur || 0.5, fade = o.fade || 0, hiding = !!o.hide;
    function isFull(R) { return R.w >= W - 0.5 && R.h >= H - 0.5 && !R.r; }
    function shape(time) {
      var q = ease((time - at) / dur, "inout");
      var x = A.x + (B.x - A.x) * q, y = A.y + (B.y - A.y) * q, w = A.w + (B.w - A.w) * q, h = A.h + (B.h - A.h) * q;
      var r = (A.r || 0) + ((B.r || 0) - (A.r || 0)) * q;
      return "inset(" + (y - h / 2).toFixed(1) + "px " + (W - x - w / 2).toFixed(1) + "px " + (H - y - h / 2).toFixed(1) + "px " +
        (x - w / 2).toFixed(1) + "px round " + r.toFixed(1) + "px)";
    }
    function alpha(time) {
      if (!fade) return 1;
      return hiding ? Math.max(0, Math.min(1, (at + dur - time) / fade)) : Math.max(0, Math.min(1, (time - at) / fade));
    }
    if (!hiding) enter(tl, scene, at);
    tl.set(scene, { clipPath: shape(at), opacity: alpha(at) }, at);
    var proxy = { t: at };
    tl.to(proxy, { t: at + dur, duration: dur, ease: "none", immediateRender: false,
      onUpdate: function () { scene.style.clipPath = shape(proxy.t); scene.style.opacity = alpha(proxy.t).toFixed(3); } }, at);
    if (hiding) leave(tl, scene, at + dur);
    else tl.set(scene, { clipPath: isFull(B) ? "none" : shape(at + dur), opacity: 1 }, at + dur);
    quiet(tl, scene, at, at + dur);
    log(at, "morph");
    note("morph", at, at + dur, hiding ? scene : null, hiding ? null : scene);
    return { at: at, end: at + dur };
  }

  /** cut(tl, {at, from, to}) is a hard cut: `to` on top and visible, `from` hidden, on one frame. */
  function cut(tl, o) {
    var at = o.at || 0;
    if (o.to) enter(tl, o.to, at);
    if (o.from) leave(tl, o.from, at);
    note("cut", at, at, o.from, o.to);
    return { at: at, end: at };
  }

  /**
   * camera(tl, el, keys, [opts]) moves a view over `el` (a UI laid out at full size).
   *   keys  [{t, x, y, zoom}]: at time t, the point (x, y) of el sits at the frame centre,
   *         magnified `zoom` times. Between keys the move eases in and out.
   *   opts  {w, h}: the frame size (default el's parent size); {until}: when this camera stops
   *         (default: the end of el's scene). A later camera on the same element takes over.
   * Mark `el` data-layout-allow-overflow: a zoom moves it past the frame on purpose.
   * Example, deep zoom on a field while a prompt types, then the pull-back to the whole UI:
   *   camera(tl, ui, [{t: 12, x: 700, y: 540, zoom: 3.2}, {t: 14.5, x: 1100, y: 540, zoom: 3.2},
   *                   {t: 15.2, x: 960, y: 540, zoom: 1}]);
   */
  function camera(tl, elm, keys, opts) {
    opts = opts || {};
    var par = elm.parentElement || elm;
    var W = opts.w || par.clientWidth || 1920, H = opts.h || par.clientHeight || 1080;
    keys = keys.slice().sort(function (a, b) { return a.t - b.t; });
    elm.style.transformOrigin = "0 0";
    function at(time) {
      var a = keys[0], b = keys[keys.length - 1];
      if (time <= a.t) b = a;
      else if (time >= b.t) a = b;
      else for (var i = 0; i < keys.length - 1; i++) if (time >= keys[i].t && time <= keys[i + 1].t) { a = keys[i]; b = keys[i + 1]; break; }
      var q = a === b ? 0 : ease((time - a.t) / (b.t - a.t), "inout");
      var z = Math.exp(Math.log(a.zoom || 1) + (Math.log(b.zoom || 1) - Math.log(a.zoom || 1)) * q);
      var x = a.x + (b.x - a.x) * q, y = a.y + (b.y - a.y) * q;
      return "translate(" + (W / 2 - x * z).toFixed(2) + "px," + (H / 2 - y * z).toFixed(2) + "px) scale(" + z.toFixed(4) + ")";
    }
    var first = elm.__lmCamera === undefined;
    if (first) { elm.__lmCamera = true; elm.style.transform = at(keys[0].t); }
    var t0 = keys[0].t;
    // The first camera on an element holds its first key from the start of the video: its scene
    // can show before that key, and a renderer seeking back from a later frame must find the
    // element there, not where the camera last left it.
    var from = first ? 0 : t0;
    var proxy = { t: from };
    var until = Math.max(keys[keys.length - 1].t, opts.until !== undefined ? opts.until : windowEnd(elm));
    tl.to(proxy, { t: until, duration: Math.max(FRAME, until - from), ease: "none", immediateRender: false,
      onUpdate: function () { elm.style.transform = at(proxy.t); } }, from);
    return { at: t0, end: keys[keys.length - 1].t };
  }

  window.LaunchMotion = {
    open: open, reveal: reveal, warp: warp, focus: focus, cut: cut, camera: camera, enter: enter,
    veil: veil, morph: morph,
    // leave() on its own is a transition too: the scene goes at t
    leave: function (tl, el, t) { leave(tl, el, t); note("leave", t, t, el, null); },
    moves: moves
  };
})();
