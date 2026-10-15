// Pure in-memory playback tests. No network, credentials or backend writes.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../app/components/public/home-motion-reel.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const flatten = (node) => !node || typeof node !== "object" ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(flatten)];

async function scenario({ reduced = false, saveData = false, reject = false, locale = "en" } = {}) {
  const effects = [], refs = [], listeners = new Map();
  const motion = { matches: reduced, addEventListener: (_, fn) => listeners.set("motion", fn), removeEventListener: () => listeners.delete("motion") };
  const document = { hidden: false, addEventListener: (_, fn) => listeners.set("visibility", fn), removeEventListener: () => listeners.delete("visibility") };
  let intersection, disconnected = false, attempts = 0;
  const video = { paused: true, src: "", getAttribute: () => video.src, pause: () => { video.paused = true; }, play: () => { attempts++; video.paused = reject; return reject ? Promise.reject(new Error("autoplay denied")) : Promise.resolve(); } };
  const mod = { exports: {} };
  vm.runInNewContext(compiled, { exports: mod.exports, window: { matchMedia: () => motion }, navigator: { connection: { saveData } }, document,
    IntersectionObserver: class { constructor(callback) { intersection = callback; } observe() {} disconnect() { disconnected = true; } },
    require: (id) => {
      if (id === "react") return { ...React, useRef: (value) => { const ref = { current: value }; refs.push(ref); return ref; }, useState: (value) => [value, () => {}], useEffect: (fn) => effects.push(fn) };
      if (id === "@/app/components/language-provider") return { useLanguage: () => ({ locale }) };
      if (id.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
      return require(id);
    },
  });
  const tree = mod.exports.HomeMotionReel();
  const nodes = flatten(tree), element = nodes.find((node) => node.type === "video"), button = nodes.find((node) => node.type === "button");
  assert.equal(element.props.muted, true); assert.equal(element.props.loop, true); assert.equal(element.props.playsInline, true);
  assert.equal(element.props.preload, "none"); assert.equal(element.props.src, undefined); assert.equal(element.props.autoPlay, undefined);
  assert.equal(button.props["aria-controls"], element.props.id);
  const html = renderToStaticMarkup(tree);
  assert.match(html, /poster="\/videos\/growvelt-learning-reel-v1.webp"/);
  assert.doesNotMatch(html, /<a |<h1/);
  refs[0].current = video; refs[1].current = {};
  const cleanup = effects[0]();
  assert.equal(attempts, 0, "No video requested before intersection");
  intersection([{ isIntersecting: true }]); await Promise.resolve();
  assert.equal(attempts, reduced || saveData ? 0 : 1);
  button.props.onClick(); await Promise.resolve();
  if (reduced || saveData || reject) assert.equal(attempts, reduced || saveData ? 1 : 2, "Manual play can retry or opt into motion");
  else {
    assert.equal(video.paused, true);
    intersection([{ isIntersecting: false }]); intersection([{ isIntersecting: true }]);
    document.hidden = true; listeners.get("visibility")(); document.hidden = false; listeners.get("visibility")();
    motion.matches = true; listeners.get("motion")(); motion.matches = false; listeners.get("motion")();
    assert.equal(attempts, 1, "Explicit pause survives scrolling, tab visibility and preference changes");
    button.props.onClick(); await Promise.resolve(); assert.equal(video.paused, false);
    document.hidden = true; listeners.get("visibility")(); assert.equal(video.paused, true);
  }
  cleanup(); assert.equal(disconnected, true); assert.equal(listeners.size, 0); assert.equal(video.paused, true);
}
await scenario(); await scenario({ reduced: true }); await scenario({ saveData: true }); await scenario({ reject: true });
await scenario({ locale: "fr" }); await scenario({ locale: "es" });
for (const name of ["growvelt-learning-reel-v1.mp4", "growvelt-learning-reel-v1.webp"]) assert.ok(fs.statSync(new URL(`../public/videos/${name}`, import.meta.url)).size < 1_000_000);
console.log("PASS: lazy muted loop, poster, three locales, manual pause persistence, reduced-motion/data-saver opt-in, blocked-autoplay retry, hidden-tab pause, cleanup and sub-1MB assets.");
