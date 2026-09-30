#!/usr/bin/env node
/* The frame-order test: runs inside the brag-tools image, never on the host.
 *
 * Hyperframes renders frames out of order, in parallel workers, and `check` and `snapshot`
 * sample times in any order. So a composition must look the same at a given time whatever
 * frame was drawn before it. This opens the composition three times (fresh pages), draws the
 * same times forward, backward and in a shuffled order, and compares every visible element:
 * its place in the page, its box, its effective opacity, its own text, its colours, filter
 * and clip. It seeks the way Hyperframes' GSAP adapter does: a silent jump to t + 1 ms, then a
 * seek to t with events on.
 *
 *   node tests/seek-test.cjs <composition/index.html> [step seconds, default 0.2]
 *
 * Exits 1 when any time differs, or on a script error.
 */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
const puppeteer = require(path.join(execSync("npm root -g").toString().trim(), "hyperframes/node_modules/puppeteer-core"));

const html = process.argv[2];
const step = +(process.argv[3] || 0.2);
if (!html) {
  console.error("usage: node seek-test.cjs <composition/index.html> [step]");
  process.exit(2);
}

async function open(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1920, height: 1080 });
  await page.evaluateOnNewDocument(() => { window.__timelines = window.__timelines || {}; });
  await page.goto("file://" + path.resolve(html), { waitUntil: "load" });
  // return a boolean: puppeteer can't hand back the timeline object itself
  await page.waitForFunction(() => !!(window.__timelines && window.__timelines.main), { timeout: 60000 });
  return { page, errors };
}

async function run(browser, times) {
  const { page, errors } = await open(browser);
  const out = {};
  for (const t of times) {
    out[t.toFixed(3)] = await page.evaluate((t) => {
      const tl = window.__timelines.main;
      tl.totalTime(t + 0.001, true);
      tl.totalTime(t, false);
      function where(e) {
        const parts = [];
        for (let c = e; c && c.id !== "root"; c = c.parentElement) {
          parts.unshift((c.id ? "#" + c.id : c.tagName.toLowerCase()) + ":" + Array.prototype.indexOf.call(c.parentElement.children, c));
        }
        return parts.join(">");
      }
      const rows = [];
      document.querySelectorAll("#root *").forEach((e) => {
        if (!e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return;
        const r = e.getBoundingClientRect();
        if (r.width < 0.5 || r.height < 0.5 || r.right < 0 || r.bottom < 0 || r.left > 1920 || r.top > 1080) return;
        let op = 1;
        for (let c = e; c; c = c.parentElement) op *= +getComputedStyle(c).opacity;
        if (op < 0.004) return;
        const cs = getComputedStyle(e);
        const own = Array.from(e.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
        rows.push([where(e), [r.left, r.top, r.width, r.height].map((v) => v.toFixed(1)).join(","), op.toFixed(3), own,
          cs.backgroundColor, cs.backgroundImage.slice(0, 60), cs.color, cs.filter, cs.clipPath,
          e.getAttribute("data-layout-check") || ""].join("|"));
      });
      return rows;
    }, t);
  }
  await page.close();
  return { out, errors };
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.PRODUCER_HEADLESS_SHELL_PATH,
    args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const probe = await open(browser);
  const dur = await probe.page.evaluate(() => parseFloat(document.querySelector("[data-composition-id]").getAttribute("data-duration")));
  await probe.page.close();
  const times = [];
  for (let t = 0; t <= dur - 0.01; t += step) times.push(Math.round(t * 1000) / 1000);
  let s = 12345;   // a fixed shuffle, so a failure can be repeated
  const rand = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const shuffled = times.slice().sort(() => rand() - 0.5);
  const fwd = await run(browser, times);
  const rev = await run(browser, times.slice().reverse());
  const shf = await run(browser, shuffled);
  await browser.close();
  let diffs = 0, visible = 0;
  for (const [name, other] of [["reverse", rev], ["shuffled", shf]]) {
    for (const t of times) {
      const k = t.toFixed(3), a = new Set(fwd.out[k]), b = new Set(other.out[k]);
      if (name === "reverse") visible += a.size;
      const onlyA = [...a].filter((x) => !b.has(x)), onlyB = [...b].filter((x) => !a.has(x));
      if (onlyA.length || onlyB.length) {
        if (diffs < 12) {
          console.log(`DIFF ${name} t=${k}`);
          onlyA.slice(0, 4).forEach((x) => console.log("  forward only : " + x));
          onlyB.slice(0, 4).forEach((x) => console.log(`  ${name} only: ` + x));
        }
        diffs++;
      }
    }
  }
  const errs = [...new Set([...probe.errors, ...fwd.errors, ...rev.errors, ...shf.errors])];
  errs.forEach((e) => console.log("SCRIPT ERROR " + e));
  console.log(`${times.length} times x 3 orders (${visible} visible element states compared): ${diffs} times differ`);
  process.exit(diffs || errs.length ? 1 : 0);
})().catch((e) => { console.error("FAILED", e.message); process.exit(2); });
