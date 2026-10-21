// Presentation-only checks: no credentials, backend requests, or database writes.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
let locale = "en";
const styles = new Proxy({}, { get: (_, key) => String(key) });
function load(file) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const moduleValue = { exports: {} };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports: moduleValue.exports,
    require: (id) => {
 if(id.endsWith("site-urls.mjs"))return require("../app/lib/site-urls.mjs");
      if (id === "@/app/components/language-provider") return { useLanguage: () => ({ locale }) };
      if (id.endsWith(".module.css")) return { __esModule: true, default: styles };
      if (id === "next/link") return function MockLink({ children, ...props }) { return React.createElement("a", props, children); };
      if (id === "next/image") return function MockImage(props) { return React.createElement("img", props); };
      if (id === "@/app/components/public-inquiry-form") return { PublicInquiryForm: ({ kind }) => React.createElement("form", { "data-inquiry-kind": kind }) };
      return require(id);
    },
  });
  return moduleValue.exports;
}

const { AboutPageContent } = load("app/components/about-page-content.tsx");
const { ContactPageContent } = load("app/components/contact-page-content.tsx");
const { PartnerPageContent } = load("app/components/partner-page-content.tsx");
for (locale of ["en", "fr", "es"]) {
  const about = renderToStaticMarkup(React.createElement(AboutPageContent));
  const contact = renderToStaticMarkup(React.createElement(ContactPageContent));
  const partner = renderToStaticMarkup(React.createElement(PartnerPageContent));
  for (const html of [about, contact, partner]) {
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${locale}: one page heading`);
    assert.match(html, /<main id="public-main"/);
    assert.doesNotMatch(html, /\bclearer\b/i);
  }
  assert.equal((about.match(/class="about-team-card"/g) || []).length, 5);
  for (const name of ["ndu-leonard", "ndu-faith", "ndu-queeneth", "joy-ezedo", "godswill-ukoha"]) assert.match(about, new RegExp(`/images/about/${name}\\.jpg`));
  assert.equal((about.match(/href="\/learn"/g) || []).length, 1, "No repeated Explore actions");
  assert.match(about, /href="\/contact"/);
  for (const href of ["mailto:support@growvelt.com", "https://wa.me/2349034876746", "tel:+2349034876746", "/frequently-asked-questions"]) assert.ok(contact.includes(`href="${href}"`));
  assert.match(contact, /data-inquiry-kind="contact"/);
  assert.match(contact, /contact-support-hero\.webp/);
  assert.equal((contact.match(/<article\b/g) || []).length, 3);
  assert.match(partner, /href="#partner-form"/);
  assert.match(partner, /id="partner-form"/);
  assert.match(partner, /data-inquiry-kind="partnership"/);
  assert.equal((partner.match(/<article\b/g) || []).length, 4);
  assert.equal((partner.match(/<li\b/g) || []).length, 6, "Three pathway stages and three process steps");
}

// Protect the actual shipped multilingual content and team data through URL changes.
// This fixed release includes the owner's approved Learning-specific SEO copy.
const shippedBaseline = "b305e73";
function declaration(source, name) {
  const ast = ts.createSourceFile("content.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let result;
  function walk(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = node.initializer.getText(ast);
    ts.forEachChild(node, walk);
  }
  walk(ast);
  return result;
}
for (const [file, names] of [["app/components/about-page-content.tsx", ["copy", "team"]], ["app/components/partner-page-content.tsx", ["copy"]]]) {
  const current = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const previous = execFileSync("git", ["show", `${shippedBaseline}:./${file}`], { encoding: "utf8" });
  for (const name of names) assert.equal(declaration(current, name), declaration(previous, name), `${file}: ${name} preserved`);
}
const formDiff = execFileSync("git", ["diff", shippedBaseline, "--", "app/components/public-inquiry-form.tsx"], { encoding: "utf8" });
assert.equal(formDiff, "", "Inquiry validation and submission behavior untouched");
assert.ok(fs.statSync(new URL("../public/images/contact-support-hero.webp", import.meta.url)).size < 100_000);
console.log("PASS: About, Contact and Partnerships render in English, French and Spanish; headings, team, support links, form kinds, pathway, original copy, and unchanged inquiry behavior. Hero asset under 100 KB. Browser layout QA remains separate.");
