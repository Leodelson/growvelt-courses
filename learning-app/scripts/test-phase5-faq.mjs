// Component-render checks only: no browser, Supabase, credentials, or writes.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../app/components/faq-page-content.tsx", import.meta.url), "utf8");
let locale = "en";
let values = ["", null];
let cursor = 0;
const moduleValue = { exports: {} };
const styles = new Proxy({}, { get: (_, key) => String(key) });
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

// Supply controlled hook values so the real component's event handlers can
// be exercised without mounting an app or contacting a backend.
vm.runInNewContext(compiled, {
  exports: moduleValue.exports,
  require: (id) => {
    if (id === "react") return { ...React, useState: (initial) => {
      const index = cursor++;
      if (values[index] === undefined) values[index] = initial;
      return [values[index], (next) => { values[index] = next; }];
    } };
    if (id === "@/app/components/language-provider") return { useLanguage: () => ({ locale }) };
    if (id === "./faq-page-content.module.css") return { __esModule: true, default: styles };
    if (id === "next/link") return function MockLink(props) { return React.createElement("a", props, props.children); };
    return require(id);
  },
});

const render = () => { cursor = 0; return moduleValue.exports.FaqPageContent(); };
const flatten = (node) => !node || typeof node !== "object" ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(flatten)];
const details = (tree) => flatten(tree).filter((node) => node.type === "details");
const topics = (tree) => flatten(tree).filter((node) => node.type === "button" && "aria-pressed" in node.props);
const search = (tree) => flatten(tree).find((node) => node.type === "input");

for (locale of ["en", "fr", "es"]) {
  values = ["", null];
  const tree = render();
  assert.equal(details(tree).length, 10, `${locale}: all ten answers are initially available`);
  assert.equal(topics(tree).length, 4, `${locale}: all topics and three groups`);
  assert.equal(flatten(tree).filter((node) => node.props?.href === "/contact").length, 1, "One contact action");
  assert.equal(search(tree).props.type, "search");
  assert.match(renderToStaticMarkup(tree), /id="faq-answer-search"/);
}

locale = "en";
values = ["", null];
let tree = render();
topics(tree)[2].props.onClick();
tree = render();
assert.equal(details(tree).length, 3, "Jobs topic has three answers");
search(tree).props.onChange({ target: { value: "SALARY" } });
tree = render();
assert.equal(details(tree).length, 1, "Search includes answer text and ignores case");
assert.match(renderToStaticMarkup(tree), /no course or certificate guarantees an interview/);
flatten(tree).find((node) => node.type === "button" && node.props["aria-pressed"] === undefined).props.onClick();
assert.equal(details(render()).length, 10, "Reset clears both filters");
values = ["not-a-real-question", null];
tree = render();
assert.equal(details(tree).length, 0);
assert.match(renderToStaticMarkup(tree), /Try a shorter phrase/);
locale = "fr";
values = ["verification", null];
assert.ok(details(render()).length > 0, "Accent-insensitive French search");
locale = "es";
values = ["certificado", null];
assert.ok(details(render()).length > 0, "Spanish question search");

console.log("PASS: FAQ rendering in three locales; topic and combined filters; answer search; case/accent normalization; reset; no-result message; single contact action. Browser layout QA remains separate.");
