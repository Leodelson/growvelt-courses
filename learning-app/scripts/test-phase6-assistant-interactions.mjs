import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

// Isolated hook/event fixture for the actual component. This is not a browser
// accessibility audit. No DOM package, hosted session, or network is needed.
const require = createRequire(import.meta.url);
const slots = [];
const effects = [];
let cursor = 0;
let fetches = 0;
const document = { body: {}, activeElement: null };
class Element {
  isConnected = true;
  parent = null;
  focus() { document.activeElement = this; }
  contains(target) { return target === this || target?.parent === this; }
}
const launcher = new Element();
const panel = new Element();
document.activeElement = launcher;
const changed = (a, b) => !a || b.some((value, index) => !Object.is(a[index], value));
const react = {
  useState(initial) {
    const index = cursor++;
    if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
    return [slots[index].value, value => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }];
  },
  useRef(initial) { const index = cursor++; return (slots[index] ??= { current: initial }); },
  useId() { cursor++; return "assistant-fixture"; },
  useMemo(fn, deps) {
    const index = cursor++;
    if (changed(slots[index]?.deps, deps)) slots[index] = { value: fn(), deps };
    return slots[index].value;
  },
  useEffect(fn, deps) {
    const index = cursor++;
    if (changed(slots[index]?.deps, deps)) effects.push(() => {
      slots[index]?.cleanup?.();
      slots[index] = { deps, cleanup: fn() };
    });
  },
};
const listeners = new Map();
const source = readFileSync(new URL("../app/components/learning-help-assistant.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleValue, exports: moduleValue.exports, document, HTMLElement: Element, AbortController,
  window: {
    setTimeout: () => 1, clearTimeout() {},
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
    sessionStorage: { getItem: () => "1", setItem() {} },
  },
  fetch: async (_url, options) => { fetches++; assert.equal(options.credentials, "same-origin"); return { status: 401 }; },
  require: name => name === "react" ? react : name.endsWith(".module.css") ? new Proxy({}, { get: (_target, key) => key }) : name === "next/image" || name.includes("learning-link") ? () => null : name.includes("site-urls") ? { careersAbsoluteUrl: path => "https://jobs.growvelt.com" + path } : require(name),
});
let nodes = [];
function render() {
  cursor = 0;
  const tree = moduleValue.exports.LearningHelpAssistant();
  nodes = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value?.props) return;
    nodes.push(value);
    if (value.props.ref) value.props.ref.current = value.props.role === "dialog" ? panel : launcher;
    visit(value.props.children);
  }
  visit(tree);
  while (effects.length) effects.shift()();
}
const find = predicate => { const node = nodes.find(node => predicate(node.props)); assert.ok(node, "expected rendered control"); return node.props; };
const openControl = () => find(props => props["aria-expanded"] !== undefined);
const tabs = () => nodes.filter(node => node.props.role === "tab").map(node => node.props);
const active = () => tabs().find(props => props["aria-selected"]).id;
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };

render();
assert.equal(fetches, 0, "closed assistant does not fetch private support previews");
openControl().onClick(); render();
assert.equal(document.activeElement, panel, "opening assistant moves focus into its dialog");
assert.equal(tabs().filter(props => props.tabIndex === 0).length, 1);
assert.equal(find(props => props.role === "tabpanel")["aria-labelledby"], active());

function pressTabKey(key, from) {
  const controls = tabs().map(props => Object.assign(new Element(), { parent: panel, click: props.onClick }));
  let prevented = false;
  find(props => props.role === "tablist").onKeyDown({ key, target: controls[from], currentTarget: { querySelectorAll: () => controls }, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  render();
}
pressTabKey("ArrowRight", 0);
await settle();
assert.match(active(), /messages$/);
assert.equal(fetches, 1);
assert.ok(nodes.some(node => typeof node.props.children === "string" && node.props.children.includes("Sign in to see")));
tabs()[1].onClick(); render();
assert.equal(fetches, 1, "clicking the selected Messages tab does not restart loading");
assert.ok(!nodes.some(node => typeof node.props.children === "string" && node.props.children.includes("Loading your recent")));
pressTabKey("End", 1); assert.match(active(), /updates$/);
pressTabKey("ArrowRight", 2); assert.match(active(), /guide$/);
pressTabKey("ArrowLeft", 0); assert.match(active(), /updates$/);
pressTabKey("Home", 2); assert.match(active(), /guide$/);

document.activeElement = Object.assign(new Element(), { parent: panel });
find(props => props["aria-label"] === "Close assistant").onClick(); render();
assert.equal(document.activeElement, launcher, "closing returns focus to the opener");
openControl().onClick(); render();
let stopped = false;
find(props => props.role === "dialog").onKeyDown({ key: "Escape", defaultPrevented: false, stopPropagation: () => { stopped = true; } }); render();
assert.equal(stopped, true);
assert.equal(openControl()["aria-expanded"], false);
assert.equal(document.activeElement, launcher);

openControl().onClick(); render();
tabs()[1].onClick(); render(); await settle();
openControl().onClick(); render();
const outside = new Element(); outside.focus();
openControl().onClick(); render(); await settle();
assert.equal(fetches, 3, "reopening Messages refreshes instead of retaining an aborted loading state");
outside.focus();
find(props => props["aria-label"] === "Close assistant").onClick(); render();
assert.equal(document.activeElement, outside, "non-modal close preserves focus already outside");
assert.equal(listeners.has("growvelt:open-help-assistant"), true);
console.log("PASS actual Help Assistant hook/event fixtures: open/close focus, scoped Escape, roving tabs and panel labels, repeated Messages clicks, reopen refresh, and no closed-panel fetch. Browser/assistive-technology review remains separate.");
