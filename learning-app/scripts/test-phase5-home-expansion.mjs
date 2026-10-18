// In-memory presentation checks only. No browser, credentials, or backend writes.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
let locale = "en";
let values = [];
let cursor = 0;
const cache = new Map();
const styles = new Proxy({}, { get: (_, key) => String(key) });
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const mod = { exports: {} };
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled, {
    exports: mod.exports,
    require: (id) => {
 if(id.endsWith("site-urls.mjs"))return require("../app/lib/site-urls.mjs");
      if (id === "react") return { ...React, useState: (initial) => {
        const index = cursor++;
        if (values[index] === undefined) values[index] = initial;
        return [values[index], (next) => { values[index] = next; }];
      } };
      if (id === "@/app/components/language-provider") return { useLanguage: () => ({ locale, t: (key) => key }) };
      if (id === "@/app/lib/home-discovery-copy") return load("app/lib/home-discovery-copy.ts");
      if (id === "@/app/lib/public-experience-copy") return load("app/lib/public-experience-copy.ts");
      if (id === "./home-discovery-sections") return load("app/components/public/home-discovery-sections.tsx");
      if (id === "./home-motion-reel") return { HomeMotionReel: () => React.createElement("section", { "data-motion-reel": true }) };
      if (id.endsWith(".module.css")) return { __esModule: true, default: styles };
      if (id === "next/link") return function MockLink({ children, ...props }) { return React.createElement("a", props, children); };
      if (id === "next/image") return function MockImage({ fill, priority, ...props }) { return React.createElement("img", { ...props, "data-fill": fill, "data-priority": priority }); };
      if (id === "@/app/components/public-header") return { PublicHeader: () => null };
      if (id === "@/app/components/FooterWrapper") return () => null;
      if (id === "@/app/components/published-course-card") return { PublishedCourseCard: ({ course }) => React.createElement("article", { "data-course": course.id }, course.title) };
      if (id === "@/app/lib/seo") return { growveltOrganizationJsonLd: { "@type": "Organization", name: "Growvelt" } };
      return require(id);
    },
  });
  cache.set(file, mod.exports);
  return mod.exports;
}

const sections = load("app/components/public/home-discovery-sections.tsx");
const { homeDiscoveryCopy } = load("app/lib/home-discovery-copy.ts");
const { publicExperienceCopy } = load("app/lib/public-experience-copy.ts");
const { PublicHome } = load("app/components/public/public-home.tsx");
const flatten = (node) => !node || typeof node !== "object" ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(flatten)];
const render = (Component) => { cursor = 0; return Component(); };
const buttons = (tree) => flatten(tree).filter((node) => node.type === "button");

for (locale of ["en", "fr", "es"]) {
  assert.match(publicExperienceCopy[locale].nav.placeholder, /\?$/);
  assert.doesNotMatch(publicExperienceCopy[locale].nav.placeholder, /I want to learn|Find a skill/i);
  values = [];
  let tree = render(sections.HomeSkillFinder);
  assert.equal(buttons(tree).length, 4);
  for (let index = 0; index < 4; index++) {
    buttons(tree)[index].props.onClick();
    tree = render(sections.HomeSkillFinder);
    assert.equal(buttons(tree).filter((node) => node.props["aria-pressed"]).length, 1);
    const links = flatten(tree).filter((node) => node.props?.href);
    assert.equal(links.length, 4);
    links.forEach((link, termIndex) => assert.equal(link.props.href, `/learn?q=${encodeURIComponent(homeDiscoveryCopy[locale].finder.goals[index].terms[termIndex])}`));
  }
  values = [];
  tree = render(sections.HomeStudyRoutine);
  for (const [index, minutes] of [10, 20, 30].entries()) {
    buttons(tree)[index].props.onClick();
    tree = render(sections.HomeStudyRoutine);
    assert.equal(buttons(tree).filter((node) => node.props["aria-pressed"]).length, 1);
    const html = renderToStaticMarkup(tree);
    assert.ok(html.includes(`>${minutes * 3}<small>`), "Weekly total is three sessions");
    const allocations = [...html.matchAll(/<strong>(\d+) <small>/g)].map((match) => Number(match[1]));
    assert.equal(allocations.reduce((total, value) => total + value, 0), minutes);
  }
  const hiring = renderToStaticMarkup(React.createElement(sections.HomeHiring));
  assert.equal((hiring.match(/<a /g) || []).length, 1);
  assert.match(hiring, /href="https:\/\/www.growvelt.com\/" target="_blank" rel="noreferrer"/);
  assert.match(hiring, /home-hiring-corporate-woman.webp/);
  const partner = renderToStaticMarkup(React.createElement(sections.HomePartnership));
  assert.equal((partner.match(/<a /g) || []).length, 1);
  assert.match(partner, /href="\/partner-with-growvelt"/);
  assert.match(partner, /home-partnership-collaboration.webp/);
  values = [];
  const home = renderToStaticMarkup(React.createElement(PublicHome, { courses: [] }));
  assert.equal((home.match(/<h1\b/g) || []).length, 1);
  assert.equal((home.match(/id="home-hiring-title"/g) || []).length, 1);
  assert.equal((home.match(/href="\/partner-with-growvelt"/g) || []).length, 1, "Old partnership link removed");
  assert.doesNotMatch(home, /data-course=|Ready to put your skills to work|\bclearer\b|Add to cart/i);
  assert.match(home, /id="how-it-works"/);
  assert.ok(home.indexOf('data-motion-reel="true"') < home.indexOf('id="home-title"'));
  assert.ok(home.indexOf('data-motion-reel="true"') < home.indexOf('id="subjects"'));
  assert.equal((home.match(/<details\b/g) || []).length, 6, "Existing guides and FAQ remain");
}
locale = "en";
values = [];
const fixture = renderToStaticMarkup(React.createElement(PublicHome, { courses: [{ id: 123, title: "In-memory published-course fixture" }] }));
assert.match(fixture, /data-course="123"/);
const header = fs.readFileSync(new URL("../app/components/public-header.tsx", import.meta.url), "utf8");
assert.match(header, /action="\/learn" method="get"/);
assert.match(header, /type="search" name="q"/);
assert.equal(publicExperienceCopy.en.nav.placeholder, "What would you like to learn?");
for (const file of ["home-hiring-corporate-woman.webp", "home-partnership-collaboration.webp"]) assert.ok(fs.statSync(new URL(`../public/images/${file}`, import.meta.url)).size < 100_000);
console.log("PASS: question-style search, four goal choices and encoded search links, all routine selections and arithmetic, three locales, single employer/partnership actions, no synthetic catalog/cart, retained FAQ/guides and published-course shelf, optimized assets. Browser QA remains separate.");
