import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

// Actual header components with isolated hooks/DOM events; no backend calls.
const require = createRequire(import.meta.url);
let slots = [], effects = [], cursor = 0, nodes = [], locale = "en";
const document = { activeElement: null, addEventListener() {}, removeEventListener() {} };
const trigger = { focus() { document.activeElement = this; } };
const options = ["en", "fr", "es"].map(code => ({ code, focus() { document.activeElement = this; } }));
const root = {
  contains: target => target === trigger || options.includes(target),
  querySelector: selector => selector.includes("option") ? options.find(option => option.code === locale) : trigger,
  querySelectorAll: () => options,
};
const changed = (a, b) => !a || b.some((value, index) => !Object.is(a[index], value));
const react = {
  useState(initial) {
    const index = cursor++;
    if (!slots[index]) slots[index] = { value: initial };
    return [slots[index].value, next => { slots[index].value = typeof next === "function" ? next(slots[index].value) : next; }];
  },
  useRef(initial) { return (slots[cursor++] ??= { current: initial }); },
  useId() { return `navigation-fixture-${cursor++}`; },
  useEffect(fn, deps) {
    const index = cursor++;
    if (changed(slots[index]?.deps, deps)) effects.push(() => {
      slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: fn() };
    });
  },
};
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../app/components/public-header.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, {
  exports: moduleValue.exports, document,
  require: name => name === "react" ? react : name.endsWith(".module.css") ? new Proxy({}, { get: (_, key) => key })
    : name.endsWith("language-provider") ? { useLanguage: () => ({ locale, setLocale: value => { locale = value; }, t: key => key }) }
    : name.endsWith("/i18n") ? { languageOptions: options.map(({code}) => ({code, label: code})) }
    : name.endsWith("site-urls.mjs") ? { careersAbsoluteUrl: path => "https://jobs.growvelt.com" + path }
    : name.startsWith("@/") ? {} : require(name),
});
function render(Component, props = {}) {
  cursor = 0; nodes = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value?.props) return;
    nodes.push(value);
    if (value.props.ref) value.props.ref.current = root;
    visit(value.props.children);
  }
  visit(Component(props));
  while (effects.length) effects.shift()();
}
const find = predicate => { const value = nodes.find(node => predicate(node.props)); assert.ok(value); return value.props; };
const expanded = () => find(props => props["aria-expanded"] !== undefined);
function key(value) {
  const event = { key: value, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
  nodes[0].props.onKeyDown(event); return event;
}
const { PublicLanguageControl, CareersMenu } = moduleValue.exports;
for (const mobile of [false, true]) {
  slots = []; locale = "en";
  render(PublicLanguageControl, { mobile });
  assert.equal(expanded()["aria-expanded"], false);
  assert.equal(key("ArrowDown").prevented, true);
  render(PublicLanguageControl, { mobile });
  assert.equal(document.activeElement, options[0]);
  assert.equal(expanded()["aria-controls"], find(props => props.role === "listbox").id);
  assert.ok(nodes.filter(node => node.props.role === "option").every(node => node.props.tabIndex === -1));
  key("ArrowDown"); assert.equal(document.activeElement, options[1]);
  key("End"); assert.equal(document.activeElement, options[2]);
  key("ArrowDown"); assert.equal(document.activeElement, options[0]);
  key("ArrowUp"); assert.equal(document.activeElement, options[2]);
  key("Home"); assert.equal(document.activeElement, options[0]);
  const escape = key("Escape"); assert.ok(escape.prevented && escape.stopped);
  render(PublicLanguageControl, { mobile });
  assert.equal(expanded()["aria-expanded"], false); assert.equal(document.activeElement, trigger);
  expanded().onClick(); render(PublicLanguageControl, { mobile });
  find(props => props.role === "option" && props.children === "fr").onClick();
  render(PublicLanguageControl, { mobile });
  assert.equal(locale, "fr"); assert.equal(document.activeElement, trigger);
  expanded().onClick(); render(PublicLanguageControl, { mobile });
  assert.equal(document.activeElement, options[1], "reopen focuses saved selection");
  const outside = {}; document.activeElement = outside;
  nodes[0].props.onBlur({ currentTarget: root, relatedTarget: outside }); render(PublicLanguageControl, { mobile });
  assert.equal(expanded()["aria-expanded"], false); assert.equal(document.activeElement, outside);
}
slots = []; render(CareersMenu, { copy: {} });
expanded().onClick(); render(CareersMenu, { copy: {} });
assert.ok(key("Escape").stopped, "nested Escape does not reach mobile drawer");
render(CareersMenu, { copy: {} }); assert.equal(expanded()["aria-expanded"], false);
assert.equal(document.activeElement, trigger);
assert.equal(key("Escape").stopped, false, "closed submenu leaves Escape available to drawer");
const css = readFileSync(new URL("../app/components/public-header.module.css", import.meta.url), "utf8");
assert.match(css, /public-language-trigger\):focus-visible[^\n]+outline: 3px solid var\(--purple\)/);
assert.match(css, /public-language-options button\):focus-visible[^\n]+outline-offset: -2px/);
console.log("PASS public navigation: desktop/mobile language arrow/Home/End keys, saved-option focus, linked listbox, selection/Escape focus return, blur dismissal without focus theft, and nested Careers Escape isolation. Real browser QA is separate.");
