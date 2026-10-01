/* launch-ui.js: the product-screen kit of /brag's "launch" style.
 *
 * launch-text.js types the statements and launch-motion.js joins the scenes; this file animates
 * the product itself, the rebuilt screens between the statements (a console, a dashboard, a
 * phone). Each helper came out of a real run, where writing them by hand caused most of the
 * check-and-fix rounds (step-3-compose.md, "Animate the product screens"):
 *
 *   clock      a scene clock: one function draws typed text, counters and any other changing
 *              state from the timeline's time alone (typed, count and caret give the values)
 *   show, hide, pop, swap, fromTo
 *              appearances where only an element's earliest animation sets its starting look,
 *              so a dialog is hidden on frame 0 and a later fade never flashes it early
 *   quiet      leaves the page behind an open dialog out of the layout audit (its backdrop
 *              covers the page's text on purpose)
 *   cursor     an arrow that glides between targets, clicks (a ring and a small dip) and hides
 *   tap        a finger tap on a phone screen
 *   point      a point inside an element, measured from the layout in its UI's own coordinates,
 *              so a camera zoom never moves a click target
 *   ellipsis   cuts the labels the product cuts with "…" at the same width, when the page is
 *              built, so the layout audit (which measures the full text) agrees with the picture
 *   sample     the "Sample data" label, pinned to the frame while the camera moves the UI
 *   wall       the screen wall: a grid of the product's screens that the camera glides across,
 *              then pulls back from, each screen coming alive as the camera reaches it
 *   keys       key sounds for typing inside the UI: every second character, at least 90 ms apart
 *   select     a selection highlight that steps through a list, like a launcher's results
 *   frames     CSS in launch.css puts the product in its context: a window (.lu-window), a browser
 *              (.lu-browser), the top of a laptop screen (.lu-laptop), a phone (.lu-phone), and a recap
 *              grid of every feature (.lu-recap, .lu-chip)
 *
 * Seek-safe like the rest of the engine. Hyperframes renders frames out of order: it jumps to a
 * frame silently (no callbacks), then steps back 1 ms with callbacks on, so a tween's onUpdate
 * runs only while the frame is inside that tween. Hence: a clock runs from the start of the video
 * to its end; every appearance is a fromTo whose start look is the element's real look just
 * before it (GSAP draws that start look when the renderer seeks back past it); and a flash that
 * starts from nothing (a click ring, a tap) is a set followed by a tween, which GSAP undoes
 * correctly in both directions.
 *
 * Needs GSAP. Link it after launch-text.js and launch-motion.js: it takes the theme from
 * LaunchText, logs cursor clicks ("click"), taps ("tap") and UI typing ("key") into
 * LaunchText.events for scripts/sfx_tags.py (typing_track.py ignores those kinds), and the wall
 * uses LaunchMotion.camera.
 *
 * Usage, inside build() after document.fonts.ready (ui is the product screen the camera moves,
 * scene the layer that holds it):
 *   const U = window.LaunchUI;
 *   U.ellipsis(ui);                                     // first: cut "…" labels before measuring
 *   U.sample(scene);                                    // "Sample data", bottom right of the frame
 *   U.show(tl, modal, 19.45, { y: 0 });                 // hidden until 19.45, then it fades in
 *   U.swap(tl, "#vWait", "#vDone", 22.9);               // "Waiting…" becomes "Connected"
 *   U.clock(tl, (t) => {                                // everything that changes with time
 *     nameField.textContent = U.typed("CrowdStrike Falcon", 19.8, 30, t);
 *     total.textContent = U.count(1284, 28.1, 0.9, t);  // "0" … "1,284"
 *   });
 *   U.keys(19.8, "CrowdStrike Falcon", 30);             // key sounds for that typing
 *   U.cursor(tl, ui, [{ t: 18.85, at: [1010, 640] }, { t: 19.35, at: tile, click: true },
 *                     { t: 21.15, from: 20.8, at: testButton, click: true, hide: 21.6 }]);
 */
(function () {
  "use strict";

  var FRAME = 1 / 30;

  function ease(p, kind) {
    p = Math.max(0, Math.min(1, p));
    if (kind === "in") return p * p * p;
    if (kind === "out") return 1 - Math.pow(1 - p, 3);
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  // one element, a selector, a NodeList or an array -> an array of elements
  function list(x, what) {
    var out = !x ? [] : typeof x === "string" ? document.querySelectorAll(x) : x.nodeType === 1 ? [x] : x;
    out = Array.prototype.slice.call(out);
    if (!out.length) throw new Error("launch-ui: " + (what || "a helper") + " found no element for " + String(x));
    return out;
  }
  function one(x, what) { return list(x, what)[0]; }

  // the composition's length: the default end of a clock
  function total() {
    var r = document.querySelector("[data-composition-id]");
    var d = r ? parseFloat(r.getAttribute("data-duration")) : NaN;
    if (isFinite(d)) return d;
    if (window.console) console.warn("launch-ui: the root has no data-duration; clocks run 60 s");
    return 60;
  }
  function log(t, kind) { if (window.LaunchText && window.LaunchText.emit) window.LaunchText.emit(t, kind); }
  function theme() {
    return window.LaunchText && window.LaunchText.current ? window.LaunchText.current()
      : { bg: "#0d1119", ink: "#e2e8f0", accent: "#60a5fa" };
  }

  // ---- the scene clock ----

  /**
   * clock(tl, fn, {from, until}) calls fn(t) on every frame from `from` (default 0) to `until`
   * (default the end of the video), and once while building, with `from`. Draw everything that
   * changes with time inside fn, from t alone: typed text, counters, a status that flips, a
   * progress bar. It runs over the whole video on purpose: a clock that stops at its scene's end
   * leaves a stale look behind for frames the renderer draws out of order, and a scene can come
   * back later. Returns {from, until}.
   */
  function clock(tl, fn, opts) {
    opts = opts || {};
    var from = opts.from !== undefined ? opts.from : 0;
    var until = opts.until !== undefined ? opts.until : total();
    var p = { t: from };
    fn(from);
    tl.to(p, { t: until, duration: Math.max(FRAME, until - from), ease: "none", immediateRender: false,
      onUpdate: function () { fn(p.t); } }, from);
    return { from: from, until: until };
  }

  /** typed(text, at, cps, t): the part of `text` typed by time t, `cps` characters a second (default 30). */
  function typed(text, at, cps, t) {
    var n = Math.floor((t - at) * (cps || 30) + 1e-6);
    return text.slice(0, Math.max(0, Math.min(text.length, n)));
  }
  /** doneAt(text, at, cps): when that typing finishes. */
  function doneAt(text, at, cps) { return at + text.length / (cps || 30); }
  /** caret(t, done): whether a typing caret shows at t: steady until `done`, then blinking every 0.5 s. */
  function caret(t, done) { return t <= done || Math.floor((t - done) / 0.5) % 2 === 0; }

  /**
   * count(to, at, dur, t, fmt): a counter's text at time t. It rises from fmt.from (default 0) to
   * `to` over `dur` seconds from `at`, easing out, formatted the way the product shows it:
   * fmt.decimals (default: as many as `to` has), fmt.sep (thousands separator, default ",";
   * "" for none), fmt.prefix and fmt.suffix ("$", "%", "s").
   */
  function count(to, at, dur, t, fmt) {
    fmt = fmt || {};
    var from = fmt.from || 0;
    var p = dur > 0 ? ease((t - at) / dur, "out") : t >= at ? 1 : 0;
    var v = from + (to - from) * p;
    var dec = fmt.decimals !== undefined ? fmt.decimals : (String(to).split(".")[1] || "").length;
    var s = Math.abs(v).toFixed(dec);
    var sep = fmt.sep !== undefined ? fmt.sep : ",";
    if (sep) {
      var parts = s.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
      s = parts.join(".");
    }
    return (v < 0 && Number(s.replace(/[^\d.]/g, "")) !== 0 ? "-" : "") + (fmt.prefix || "") + s + (fmt.suffix || "");
  }

  /**
   * keys(at, text, cps, {every, gap, kind}): logs a key sound for text typed inside the product (a
   * search box, a form): one on every second character (`every`, default 2), never closer than
   * `gap` seconds (default 0.09, the same limit typing_track.py uses: fast typing at every
   * second character put hits 36 ms apart in one run, which buzzes). Each lands as its character
   * appears in typed(). Returns the times; sfx_tags.py turns the "key" events into <audio> tags.
   * (The big statements get the deep key sound from typing_track.py instead.)
   */
  function keys(at, text, cps, opts) {
    opts = opts || {};
    var every = opts.every || 2, gap = opts.gap !== undefined ? opts.gap : 0.09;
    var out = [], last = -Infinity;
    for (var i = 0; i < text.length; i += every) {
      var t = at + (i + 1) / (cps || 30);
      if (t - last < gap - 1e-6) continue;
      out.push(Math.round(t * 1000) / 1000);
      last = t;
    }
    out.forEach(function (t) { log(t, opts.kind || "key"); });
    return out;
  }

  // ---- appearances: only an element's earliest animation sets its starting look ----
  // A fromTo draws its start look for every frame before it once the renderer has passed it and
  // come back, so each helper's start look is the element's real look just before it: hidden
  // before a show, shown before a hide. While building, the earliest helper's start look is also
  // set at once, whatever order the helpers were called in; that keeps a dialog hidden on frame 0.
  var looks = new WeakMap();
  function starts(e, t, vars) {
    var r = looks.get(e);
    if (r !== undefined && r <= t + 1e-6) return;
    looks.set(e, t);
    gsap.set(e, Object.assign({}, vars));
  }

  /**
   * fromTo(tl, el, from, to, t, {stagger}): a GSAP fromTo at t that joins the rule above. `from`
   * must be the element's look just before t. el may be a list; each next one starts `stagger`
   * seconds later. Returns {at, end}.
   */
  function fromTo(tl, target, from, to, t, o) {
    o = o || {};
    var els = list(target, "fromTo()"), stagger = o.stagger || 0;
    els.forEach(function (e, i) {
      var at = t + i * stagger;
      starts(e, at, from);
      tl.fromTo(e, Object.assign({}, from), Object.assign({ immediateRender: false }, to), at);
    });
    return { at: t, end: t + (els.length - 1) * stagger + (to.duration || 0) };
  }

  /**
   * show(tl, el, t, {dur, y, x, scale, blur, stagger, ease}): hidden until t, then it fades in (0.25 s)
   * rising `y` px (default 8); with `blur` (px) it also comes into focus, the way the reference
   * product films bring in a grid of feature tiles.
   */
  function show(tl, target, t, o) {
    o = o || {};
    var from = { autoAlpha: 0, y: o.y !== undefined ? o.y : 8 };
    var to = { autoAlpha: 1, y: 0, duration: o.dur || 0.25, ease: o.ease || "power2.out" };
    if (o.x !== undefined) { from.x = o.x; to.x = 0; }
    if (o.scale !== undefined) { from.scale = o.scale; to.scale = 1; }
    if (o.blur) { from.filter = "blur(" + o.blur + "px)"; to.filter = "blur(0px)"; }
    return fromTo(tl, target, from, to, t, o);
  }
  /** hide(tl, el, t, {dur, stagger, ease}): shown until t, then it fades out (0.2 s). */
  function hide(tl, target, t, o) {
    o = o || {};
    return fromTo(tl, target, { autoAlpha: 1 }, { autoAlpha: 0, duration: o.dur || 0.2, ease: o.ease || "power1.in" }, t, o);
  }
  /** pop(tl, el, t, {dur, scale, stagger}): hidden until t, then it pops in from `scale` (default 0.6) with a small overshoot. */
  function pop(tl, target, t, o) {
    o = o || {};
    return fromTo(tl, target, { autoAlpha: 0, scale: o.scale || 0.6 },
      { autoAlpha: 1, scale: 1, duration: o.dur || 0.35, ease: o.ease || "back.out(2.2)" }, t, o);
  }
  /**
   * swap(tl, outEl, inEl, t, {dur, y}): one state becomes the next in place ("Testing…" →
   * "Connected", a tab's panel): the old one fades out over `dur` (default 0.12 s), then the new
   * one fades in. They never show together, so two labels in one spot never read as overlapping.
   */
  function swap(tl, outEl, inEl, t, o) {
    o = o || {};
    var d = o.dur || 0.12;
    hide(tl, outEl, t, { dur: d });
    return show(tl, inEl, t + d, { dur: d, y: o.y !== undefined ? o.y : 0 });
  }

  /**
   * quiet(tl, el, t0, t1): leaves el (one element or a list) out of the layout audit from t0 to
   * t1. For the page behind a dialog: a dim backdrop 60% opaque or more reads to `hyperframes
   * check` as "text hidden beneath an opaque element" for every label it covers, which is the
   * point of a backdrop. Quiet the page (its sidebar, header and content), not the dialog, so
   * the dialog is still audited. data-layout-ignore on the backdrop doesn't help: the audit
   * judges the covered text, not what covers it. Seek-safe: GSAP sets the attribute.
   */
  function quiet(tl, target, t0, t1) {
    list(target, "quiet()").forEach(function (e) {
      if (e.getAttribute("data-layout-check") === "ignore") return;
      if (!e.hasAttribute("data-layout-check")) e.setAttribute("data-layout-check", "on");
      tl.set(e, { attr: { "data-layout-check": "ignore" } }, t0);
      tl.set(e, { attr: { "data-layout-check": "on" } }, t1);
    });
  }

  // ---- where things are ----

  // an element's layout position (border edge), from offsets: transforms don't count
  function pos(e) {
    var x = 0, y = 0;
    while (e) {
      x += e.offsetLeft;
      y += e.offsetTop;
      var p = e.offsetParent;
      if (p) { x += p.clientLeft - p.scrollLeft; y += p.clientTop - p.scrollTop; }
      e = p;
    }
    return { x: x, y: y };
  }

  /**
   * point(el, box, fx, fy) -> {x, y}: the point fx, fy (0-1, default the centre) of el, in the
   * coordinates of `box` (default el's offset parent), from its padding edge, which is where a
   * child placed at left: 0; top: 0 sits. Measured from the layout, so no transform on the way
   * changes it: the camera can zoom and pan and the target stays put. Transforms other
   * animations put on el or its parents don't count either; nudge the result for those (a panel
   * slid in with x, a list scrolled with y). An SVG part is measured inside its nearest HTML
   * parent.
   */
  function point(target, box, fx, fy) {
    var e = one(target, "point()");
    fx = fx === undefined ? 0.5 : fx;
    fy = fy === undefined ? 0.5 : fy;
    if (!("offsetLeft" in e)) {
      var h = e.parentElement;
      while (h && !("offsetLeft" in h)) h = h.parentElement;
      var hr = h.getBoundingClientRect(), er = e.getBoundingClientRect();
      var s = h.offsetWidth / (hr.width || 1);
      var base = point(h, box, 0, 0);
      return { x: base.x + (er.left - hr.left + er.width * fx) * s, y: base.y + (er.top - hr.top + er.height * fy) * s };
    }
    if (e.offsetParent === null && window.console) console.warn("launch-ui: point() can't measure an element with display: none");
    box = box ? one(box, "point()") : e.offsetParent;
    var a = pos(e), b = pos(box);
    return { x: a.x - b.x - box.clientLeft + e.offsetWidth * fx, y: a.y - b.y - box.clientTop + e.offsetHeight * fy };
  }
  function place(key, box) {
    if (Array.isArray(key.at)) return { x: key.at[0], y: key.at[1] };
    if (key.at && key.at.x !== undefined && key.at.nodeType === undefined) return { x: key.at.x, y: key.at.y };
    return point(key.at, box, key.fx, key.fy);
  }

  /**
   * select(tl, bar, keys, {dur, from, until}) -> {keys}: a selection highlight that steps through
   * a list the way a launcher's or a menu's highlight follows the arrow keys (the reference
   * product films do this in every search). `bar` is an absolutely placed element inside the same
   * box as the rows and behind their text (class "lu-select"); at each key's time it moves onto
   * that key's row (by its left and top, so show() and hide() can still fade it) and takes the row's size, in `dur` seconds (default 0.14).
   * keys [{t, at}]: at is a row element, measured from the layout. Before the first key it sits on
   * the first key's row; show or hide it with show() and hide(). Each step is logged as "select"
   * for a soft tick (sfx_tags.py). Seek-safe: one clock draws it from the time alone.
   */
  function select(tl, bar, keys, opts) {
    opts = opts || {};
    var b = one(bar, "select()"), box = b.offsetParent, dur = opts.dur || 0.14;
    var ks = keys.map(function (k) {
      var e = one(k.at, "select()"), p = point(e, box, 0, 0);
      return { t: k.t, x: p.x, y: p.y, w: e.offsetWidth, h: e.offsetHeight };
    }).sort(function (a, c) { return a.t - c.t; });
    if (!ks.length) throw new Error("launch-ui: select() needs at least one key");
    function draw(t) {
      var i = 0;
      while (i + 1 < ks.length && ks[i + 1].t <= t + 1e-6) i++;
      var cur = ks[i], prev = i > 0 ? ks[i - 1] : cur;
      var q = i > 0 ? ease((t - cur.t) / dur, "out") : 1;
      var x = prev.x + (cur.x - prev.x) * q, y = prev.y + (cur.y - prev.y) * q;
      var w = prev.w + (cur.w - prev.w) * q, h = prev.h + (cur.h - prev.h) * q;
      b.style.left = x.toFixed(2) + "px";   // left and top, not transform: show() and hide() tween its transform
      b.style.top = y.toFixed(2) + "px";
      b.style.width = w.toFixed(1) + "px";
      b.style.height = h.toFixed(1) + "px";
    }
    clock(tl, draw, { from: opts.from, until: opts.until });
    ks.slice(1).forEach(function (k) { log(k.t, "select"); });
    return { keys: ks };
  }

  // ---- the cursor and the tap ----

  var ARROW = '<svg viewBox="0 0 22 26" aria-hidden="true"><path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.6 15.2 ' +
    'L17.5 15.2 Z" fill="FILL" stroke="STROKE" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  /**
   * cursor(tl, box, keys, opts) -> {el, clicks}: an arrow that glides from key to key.
   *   box   the element it moves in: usually the product UI the camera moves, so it zooms with
   *         the screen and each target stays under it
   *   keys  [{t, at, fx, fy, dx, dy, from, click, hide, show}], in time order:
   *         t      when it arrives (for the first key: when it fades in there)
   *         at     an element (its centre, or fx, fy inside it, measured with point()), or
   *                [x, y] in box coordinates; dx, dy nudge the point
   *         from   when it leaves the previous key (default: that key's t)
   *         click  it presses on arrival: a ring spreads and the arrow dips (a "click" event)
   *         hide   a time to fade it out (true: 0.3 s after t); show: true fades it back in as
   *                it leaves for this key
   *   opts  {color: "#ffffff", stroke: "#0a0d14", ring: the theme's accent, size: 22, z: 50}
   */
  function cursor(tl, box, keyList, opts) {
    opts = opts || {};
    box = one(box, "cursor()");
    var size = opts.size || 22, k = size / 22, tip = 2 * k, R = 14 * k;
    var c = document.createElement("div");
    c.className = "lu-cursor";
    c.setAttribute("data-layout-ignore", "");
    if (opts.z !== undefined) c.style.zIndex = opts.z;
    c.innerHTML = '<div class="lu-ring"></div><div class="lu-arrow">' +
      ARROW.replace("FILL", opts.color || "#ffffff").replace("STROKE", opts.stroke || "#0a0d14") + "</div>";
    box.appendChild(c);
    var ring = c.firstChild, arrow = c.lastChild;
    arrow.style.width = size + "px";
    arrow.style.height = Math.round(size * 26 / 22) + "px";
    arrow.style.transformOrigin = tip + "px " + tip + "px";
    ring.style.width = ring.style.height = 2 * R + "px";
    ring.style.left = ring.style.top = tip - R + "px";
    ring.style.borderColor = opts.ring || theme().accent;
    var pts = keyList.map(function (key) {
      var p = place(key, box);
      return { t: key.t, x: p.x + (key.dx || 0) - tip, y: p.y + (key.dy || 0) - tip, from: key.from,
        click: key.click, hide: key.hide, show: key.show };
    });
    var clicks = [];
    function press(t) {
      tl.set(ring, { autoAlpha: 0.9, scale: 0.35 }, t);
      tl.to(ring, { autoAlpha: 0, scale: 1.7, duration: 0.4, ease: "power2.out", immediateRender: false }, t);
      tl.fromTo(arrow, { scale: 1 }, { scale: 0.84, duration: 0.07, ease: "power1.out", yoyo: true, repeat: 1,
        immediateRender: false }, Math.max(0, t - 0.03));
      log(t, "click");
      clicks.push(t);
    }
    gsap.set(c, { x: pts[0].x, y: pts[0].y });
    fromTo(tl, c, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, pts[0].t);
    pts.forEach(function (b, i) {
      if (i > 0) {
        var a = pts[i - 1];
        var t0 = b.from !== undefined ? b.from : a.t;
        if (b.t < a.t && window.console) console.warn("launch-ui: cursor keys must be in time order (" + b.t + " after " + a.t + ")");
        if (b.show) tl.fromTo(c, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, immediateRender: false }, t0);
        if (b.x !== a.x || b.y !== a.y) {
          tl.fromTo(c, { x: a.x, y: a.y }, { x: b.x, y: b.y, duration: Math.max(0.12, b.t - t0), ease: "power2.inOut",
            immediateRender: false }, t0);
        }
      }
      if (b.click) press(b.t);
      if (b.hide !== undefined && b.hide !== false) {
        tl.fromTo(c, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2, immediateRender: false }, b.hide === true ? b.t + 0.3 : b.hide);
      }
    });
    return { el: c, clicks: clicks };
  }

  /**
   * tap(tl, box, at, t, {fx, fy, dx, dy, size}) -> t: a finger tap on a phone screen: a soft disc
   * presses in at the target (an element, or [x, y] in box coordinates) and spreads away. Logged
   * as a "tap" event for its sound.
   */
  function tap(tl, box, target, t, o) {
    o = o || {};
    box = one(box, "tap()");
    var size = o.size || 64;
    var p = place({ at: target, fx: o.fx, fy: o.fy }, box);
    var d = document.createElement("div");
    d.className = "lu-tap";
    d.setAttribute("data-layout-ignore", "");
    d.style.width = d.style.height = size + "px";
    box.appendChild(d);
    gsap.set(d, { x: p.x + (o.dx || 0) - size / 2, y: p.y + (o.dy || 0) - size / 2 });
    tl.set(d, { autoAlpha: 1, scale: 0.6 }, t);
    tl.to(d, { scale: 1, duration: 0.15, ease: "power2.out", immediateRender: false }, t);
    tl.to(d, { autoAlpha: 0, scale: 1.3, duration: 0.3, ease: "power2.out", immediateRender: false }, t + 0.18);
    log(t, "tap");
    return t;
  }

  // ---- labels ----

  function fits(e) { return e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1; }
  function cut(e) {
    var full = e.textContent, lo = 1, hi = full.length - 1, best = 1;
    function at(n) { return full.slice(0, n).replace(/[\s,.;:·—–-]+$/, "") + "…"; }
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      e.textContent = at(mid);
      if (fits(e)) { best = mid; lo = mid + 1; } else hi = mid - 1;
    }
    e.textContent = at(best);
    e.setAttribute("data-full-text", full);
  }

  /**
   * ellipsis(scope) -> how many labels it cut. It cuts every label the product cuts with "…"
   * (CSS text-overflow: ellipsis, or a line clamp) to the width it has, in the DOM, now. The
   * layout audit measures a label's whole text, not the part the browser paints, so an
   * overflowing label reads as text running under its neighbours. scope: an element (its
   * subtree is searched), a selector, or a list; with a selector or a list, every element that
   * overflows is cut, whatever its CSS. Only elements holding text and no child elements are cut.
   * Call it first in build(), before point() measures anything and before any statement.
   */
  function ellipsis(scope) {
    var all = scope && scope.nodeType === 1, n = 0;
    var cands = all ? [scope].concat(Array.prototype.slice.call(scope.querySelectorAll("*"))) : list(scope, "ellipsis()");
    cands.forEach(function (e) {
      if (e.children.length || !e.textContent.trim()) return;
      if (all) {
        var cs = getComputedStyle(e);
        if (cs.textOverflow !== "ellipsis" && (!cs.webkitLineClamp || cs.webkitLineClamp === "none")) return;
        if (cs.overflowX === "visible" && cs.overflowY === "visible") return;   // no "…" is painted then
      }
      if (fits(e)) return;
      cut(e);
      n++;
    });
    return n;
  }

  /**
   * sample(scene, {text, corner, size}) -> el: the "Sample data" label, pinned to a corner of the
   * frame (corner "br" default, "bl", "tr", "tl"). Put it in the scene, not inside the UI the
   * camera moves, so it stays still and readable while the screen zooms. Styled from the theme;
   * left out of the layout audit, since it sits over the product on purpose.
   */
  function sample(scene, o) {
    o = o || {};
    scene = one(scene, "sample()");
    var th = theme(), L = window.LaunchText;
    var fw = scene.clientWidth || 1920, fh = scene.clientHeight || 1080;
    var px = o.size || Math.round(Math.min(fw, fh) * 0.0157);   // 17 px at 1080p
    var d = document.createElement("div");
    d.className = "lu-sample";
    d.setAttribute("data-layout-ignore", "");
    d.textContent = o.text || "Sample data";
    d.style.fontSize = px + "px";
    var m = Math.round(px * 1.4) + "px", corner = o.corner || "br";
    d.style[corner.indexOf("b") >= 0 ? "bottom" : "top"] = m;
    d.style[corner.indexOf("r") >= 0 ? "right" : "left"] = m;
    var ink = th.ink, bg = th.bg;
    if (L && L.mix && L.fit) ink = L.fit(L.mix(th.ink, th.bg, 0.3), th.bg, 4.5);
    d.style.color = ink;
    d.style.background = bg;
    d.style.borderColor = L && L.mix ? L.mix(th.ink, th.bg, 0.8) : "rgba(148, 163, 184, 0.25)";
    scene.appendChild(d);
    return d;
  }

  // ---- the screen wall ----

  /**
   * wall(tl, wallEl, {at, pan, pull, zoom, tiles, reveal, margin}) -> {at, end, keys}: for a
   * product with more screens than the video has scenes. wallEl is one large element, wider than
   * the frame, holding a grid of tiles: one per screen, each with the screen's real title and a
   * glimpse of it (a few rows, a chart, its main button). The camera starts on the wall's left
   * edge, glides to its right edge over `pan` seconds, then pulls back over `pull` seconds
   * (default 1) until the whole wall shows. Each tile, or its `reveal` child (a selector), comes
   * in as the camera reaches it. Mark wallEl data-layout-allow-overflow.
   *   zoom    the zoom while gliding (default: the wall's height fills the frame)
   *   pan     default 0.25 s a column, at least 3 s
   *   margin  how far inside the frame edge a tile comes in, in frame px (default 60)
   */
  function wall(tl, wallEl, o) {
    o = o || {};
    wallEl = one(wallEl, "wall()");
    if (!window.LaunchMotion) throw new Error("launch-ui: wall() needs launch-motion.js (its camera)");
    var par = wallEl.parentElement;
    var W = par.clientWidth || 1920, H = par.clientHeight || 1080;
    var ww = wallEl.offsetWidth, wh = wallEl.offsetHeight;
    var tiles = list(typeof o.tiles === "string" ? wallEl.querySelectorAll(o.tiles) : o.tiles || wallEl.children, "wall()");
    var base = pos(wallEl);
    var cells = tiles.map(function (t) { var p = pos(t); return { el: t, x: p.x - base.x, y: p.y - base.y }; });
    var xs = [], ys = [];
    cells.forEach(function (c) { if (xs.indexOf(c.x) < 0) xs.push(c.x); if (ys.indexOf(c.y) < 0) ys.push(c.y); });
    xs.sort(function (a, b) { return a - b; });
    ys.sort(function (a, b) { return a - b; });
    var z = o.zoom || H / wh;
    var half = W / 2 / z, cy = wh / 2;
    var x0 = half, x1 = Math.max(half, ww - half);
    var at = o.at || 0;
    var pan = o.pan || Math.max(3, 0.25 * xs.length), pull = o.pull !== undefined ? o.pull : 1;
    var zAll = Math.min(W / ww, H / wh) * 0.94;
    var keys = [{ t: at, x: x0, y: cy, zoom: z }, { t: at + pan, x: x1, y: cy, zoom: z },
      { t: at + pan + pull, x: ww / 2, y: cy, zoom: zAll }];
    window.LaunchMotion.camera(tl, wallEl, keys, { w: W, h: H });
    // the moment the frame's right edge (less the margin) reaches x, on the camera's eased path
    var edge = (o.margin !== undefined ? o.margin : 60) / z;
    function camX(t) { return x0 + (x1 - x0) * ease((t - at) / pan, "inout"); }
    function reaches(x) {
      if (x <= x0 + half - edge) return null;   // in view from the start
      var lo = at, hi = at + pan;
      for (var i = 0; i < 40; i++) { var mid = (lo + hi) / 2; if (camX(mid) + half - edge >= x) hi = mid; else lo = mid; }
      return hi;
    }
    cells.forEach(function (c) {
      var col = xs.indexOf(c.x), row = ys.indexOf(c.y);
      var te = reaches(c.x);
      var t = (te === null ? at + 0.05 + col * 0.12 : te) + row * 0.07;
      var target = o.reveal ? c.el.querySelector(o.reveal) || c.el : c.el;
      show(tl, target, t, { dur: 0.35, y: 12 });
    });
    return { at: at, end: at + pan + pull, keys: keys };
  }

  window.LaunchUI = {
    clock: clock, typed: typed, doneAt: doneAt, caret: caret, count: count, keys: keys,
    fromTo: fromTo, show: show, hide: hide, pop: pop, swap: swap, quiet: quiet,
    point: point, select: select, cursor: cursor, tap: tap, ellipsis: ellipsis, sample: sample, wall: wall, ease: ease
  };
})();
