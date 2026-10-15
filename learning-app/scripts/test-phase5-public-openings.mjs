// In-memory presentation tests only: no Auth, Storage or database requests.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
const require = createRequire(import.meta.url);
let locale = "en";
const cache = new Map();
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const compiled = ts.transpileModule(read(file), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled, { exports: mod.exports, require: (id) => {
    if (id === "@/app/components/language-provider") return { useLanguage: () => ({ locale, t: (key) => key }) };
    if (id === "@/app/lib/public-experience-copy") return load("app/lib/public-experience-copy.ts");
    if (id === "./teach-opening") return load("app/components/public/teach-opening.tsx");
    if (id.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id === "next/image") return function Image({ fill, priority, ...props }) { return React.createElement("img", { ...props, "data-fill": fill, "data-priority": priority }); };
    if (id === "next/link") return function MockLink({ children, ...props }) { return React.createElement("a", props, children); };
    if (id === "@/app/components/public-header") return { PublicHeader: () => React.createElement("header", null, "Existing navigation") };
    if (id === "@/app/components/FooterWrapper") return function MockFooter() { return React.createElement("footer", null, "Existing footer"); };
    return require(id);
  } });
  cache.set(file, mod.exports);
  return mod.exports;
}
const { PublicTeach } = load("app/components/public/public-teach.tsx");
for (locale of ["en", "fr", "es"]) {
  const html = renderToStaticMarkup(React.createElement(PublicTeach));
  assert.ok(html.indexOf('id="teach-opening-title"') < html.indexOf('id="teach-title"'));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/href="\/teach\/apply"/g) || []).length, 1, "Existing application CTA is not duplicated");
  assert.equal((html.match(/href="#teach-introduction"/g) || []).length, 1);
  assert.match(html, /id="teach-introduction"/);
  assert.match(html, /<picture[^>]*>.*<source media="\(max-width: 780px\)" srcSet="\/images\/teach-opening-mobile-v1.webp"/);
  assert.match(html, /src="\/images\/teach-opening-educator-v1.webp"/);
  assert.match(html, /src="\/images\/black-american-lady.png"/, "Existing hero image retained");
  for (const id of ["teach-benefits-title", "teach-process-title", "teaching-rights-title", "teach-faq-title"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.equal((html.match(/<details\b/g) || []).length, 3);
}
const home = read("app/components/public/public-home.tsx");
assert.ok(home.indexOf("<HomeMotionReel />") < home.indexOf('aria-labelledby="home-title"'));
assert.equal((home.match(/<HomeMotionReel \/>/g) || []).length, 1);
const motion = read("app/components/public/home-motion-reel.module.css");
assert.match(motion, /\.reel \{ width: 100%; margin: 0;/);
assert.doesNotMatch(motion, /border-radius/);
for (const file of ["teach-opening-educator-v1.webp", "teach-opening-mobile-v1.webp"]) assert.ok(fs.statSync(new URL(`../public/images/${file}`, import.meta.url)).size < 200_000);
console.log("PASS: full-width video precedes retained homepage hero; new photo opening precedes retained Teach hero; mobile art direction, 3 locales, one application CTA, existing sections, FAQ and images preserved; optimized assets.");
