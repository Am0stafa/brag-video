#!/usr/bin/env node
/* Read the launch engine's logs from a composition: the reading-time check and the event log.
 *
 * Runs inside the brag-tools image (Node, Hyperframes' puppeteer-core, the bundled headless
 * shell). It opens the composition, waits for its timeline, and:
 *
 * 1. prints the reading-time table: every statement's start, when its last word lands, when it
 *    goes, and whether a viewer can read it (about 0.3 s a word counted from the first word, and
 *    at least 1.2 s after the last word lands; step-2-plan.md, "Reading time"). Run it as soon as
 *    the statements are built, and fix every SHORT row before composing the music: moving a
 *    statement moves the music's sections too.
 * 2. with an output file, writes every typed chunk, transition, click, tap and UI key as {t, kind},
 *    the statements' rows and the composition's duration, for typing_track.py and sfx_tags.py.
 *
 *   node /skill/launch_events.cjs composition/index.html                              # the check
 *   node /skill/launch_events.cjs composition/index.html tools/launch-events.json [--strict]
 *
 * --strict exits 1 when a statement is too short to read. It also prints the engine's warnings
 * (a colour that needed a big contrast shift, a statement too long for two lines, a cut that
 * leaves under 0.8 s to read, a mark with no logo) and any script error, so they are seen
 * before rendering.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const [html, out] = args.filter((a) => !a.startsWith("--"));
if (!html) {
  console.error("usage: node launch_events.cjs <composition/index.html> [<out.json>] [--strict]");
  process.exit(2);
}
const puppeteer = require(path.join(execSync("npm root -g").toString().trim(), "hyperframes/node_modules/puppeteer-core"));

function pad(s, n, right) {
  s = String(s);
  return right ? s.padStart(n) : s.padEnd(n);
}

function printTiming(rows) {
  if (!rows) {
    console.log("reading time: this composition's launch-text.js has no timing(); copy the current engine from " +
      "<skill-dir>/assets/launch/ into composition/assets/launch/ to get the check");
    return 0;
  }
  if (!rows.length) {
    console.log("reading time: no statements");
    return 0;
  }
  console.log("reading time: 0.3 s a word from the first word, and 1.2 s after the last word lands (step-2-plan.md)");
  console.log(`  ${pad("#", 3, true)}  ${pad("start", 7, true)} ${pad("last word", 9, true)} ${pad("gone", 7, true)} ` +
    `${pad("words", 5, true)} ${pad("shown", 6, true)} ${pad("after", 6, true)} ${pad("needs", 6, true)}  ${pad("result", 16)} statement`);
  let short = 0;
  for (const r of rows) {
    if (!r.ok) short++;
    const result = r.ok ? "ok" : `SHORT ${r.short.toFixed(2)} s`;
    const text = r.text.length > 70 ? r.text.slice(0, 69) + "…" : r.text;
    console.log(`  ${pad(r.n, 3, true)}  ${pad(r.at.toFixed(2), 7, true)} ${pad(r.last.toFixed(2), 9, true)} ` +
      `${pad(r.gone.toFixed(2), 7, true)} ${pad(r.words, 5, true)} ${pad(r.shown.toFixed(2), 6, true)} ` +
      `${pad(r.after.toFixed(2), 6, true)} ${pad(r.need.toFixed(2), 6, true)}  ${pad(result, 16)} ${text}`);
  }
  if (short) {
    console.log(`${rows.length} statements, ${short} too short to read. Fix them before composing the music: start ` +
      "earlier, type faster (`step`), or leave later (`hold`, `until`, or move the transition that takes the stage away).");
  } else {
    console.log(`${rows.length} statements, all readable.`);
  }
  return short;
}

(async () => {
  const src = fs.readFileSync(html, "utf8");
  const width = +((src.match(/data-width="(\d+)"/) || [])[1] || 1920);
  const height = +((src.match(/data-height="(\d+)"/) || [])[1] || 1080);
  const browser = await puppeteer.launch({
    executablePath: process.env.PRODUCER_HEADLESS_SHELL_PATH,
    args: ["--no-sandbox", "--allow-file-access-from-files"],
  });
  const page = await browser.newPage();
  const notes = [];
  page.on("pageerror", (e) => notes.push("script error: " + e.message));
  // Puppeteer 25 reports console.warn as "warn" (older versions said "warning"): accept both
  page.on("console", (m) => { const k = m.type(); if (k === "warn" || k === "warning" || k === "error") notes.push((k === "error" ? "error" : "warning") + ": " + m.text()); });
  await page.setViewport({ width, height });
  // The Hyperframes runtime provides window.__timelines; this plain page has no runtime, so
  // provide the registry, or a composition that writes window.__timelines["main"] throws.
  await page.evaluateOnNewDocument(() => { window.__timelines = window.__timelines || {}; });
  await page.goto("file://" + path.resolve(html), { waitUntil: "load", timeout: 60000 });
  try {
    await page.waitForFunction(() => window.LaunchText && window.__timelines && Object.keys(window.__timelines).length > 0,
      { timeout: 60000 });
  } catch (e) {
    notes.forEach((n) => console.error("NOTE " + n));
    throw new Error("the composition never registered its timeline (the notes above say why): " + e.message);
  }
  const data = await page.evaluate(() => {
    const root = document.querySelector("[data-composition-id]");
    const duration = root ? parseFloat(root.getAttribute("data-duration")) : null;
    const events = window.LaunchText.events.slice().sort((a, b) => a.t - b.t);
    const statements = typeof window.LaunchText.timing === "function" ? window.LaunchText.timing() : null;
    return { duration, events, statements };
  });
  await browser.close();
  const short = printTiming(data.statements);
  if (out) {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(data, null, 1));
    const kinds = {};
    data.events.forEach((e) => { kinds[e.kind] = (kinds[e.kind] || 0) + 1; });
    console.log(`events: ${data.events.length} (${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(", ")}); duration ${data.duration} s -> ${out}`);
  }
  notes.forEach((n) => console.log("NOTE " + n));
  if (strict && short) process.exit(1);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
