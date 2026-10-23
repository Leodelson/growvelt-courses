import { parseDocument } from "htmlparser2";
import { Element, Text, isTag, type ChildNode } from "domhandler";
import { appendChild, findAll, removeElement, textContent } from "domutils";
import render from "dom-serializer";

const inlineTags = new Set(["a", "span", "strong", "b", "em", "i", "u", "s", "small", "br", "code", "sup", "sub"]);
const structuralTags = new Set(["table", "thead", "tbody", "tfoot", "tr", "ul", "ol"]);
const skipTags = new Set(["img", "style", "script", "head", "title", "svg", "picture"]);

function addClass(element: Element, value: string) {
  element.attribs.class = [element.attribs.class, value].filter(Boolean).join(" ");
}
function backgroundColor(element: Element) {
  const declarations = [...(element.attribs.style || "").matchAll(/(?:^|;)\s*background(?:-color)?:\s*(#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\))\s*(?:!important\s*)?(?=;|$)/gi)];
  const value = declarations.at(-1)?.[1] || element.attribs.bgcolor;
  return value && /^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\))$/i.test(value) ? value.toLowerCase() : null;
}
function isPlainInline(node: ChildNode): boolean {
  if (!isTag(node)) return node.type === "text" || node.type === "comment";
  if (!inlineTags.has(node.name) || backgroundColor(node)) return false;
  if (node.name === "a" && /(?:padding|border-radius|display\s*:\s*(?:inline-)?block)/i.test(node.attribs.style || "")) return false;
  return node.children.every(isPlainInline);
}
function protectedText(nodes: ChildNode[], block: boolean) {
  // Short classes keep worst-case 4,000-character bullet emails below Gmail's
  // clipping threshold. Layout rules are shared once, not repeated per line.
  const screen = new Element("span", { class: block ? "gvl-s" : "gvl-s gvl-r" }, []);
  const difference = new Element("span", { class: "gvl-d" }, []);
  for (const node of nodes) { removeElement(node); appendChild(difference, node); }
  appendChild(screen, difference);
  return screen;
}
function protectText(element: Element) {
  if (skipTags.has(element.name)) return;
  const children = [...element.children];
  if (structuralTags.has(element.name)) {
    for (const child of children) if (isTag(child)) protectText(child);
    return;
  }
  if (children.every(isPlainInline) && textContent(element).trim()) {
    appendChild(element, protectedText(children, true));
    return;
  }
  const result: ChildNode[] = [];
  let inline: ChildNode[] = [];
  const finishRun = () => {
    if (!inline.length) return;
    result.push(...(inline.some(node => textContent(node).trim()) ? [protectedText(inline, false)] : inline));
    inline = [];
  };
  for (const child of children) {
    if (isPlainInline(child)) inline.push(child);
    else { finishRun(); if (isTag(child)) protectText(child); result.push(child); }
  }
  finishRun();
  for (const child of [...element.children]) removeElement(child);
  for (const child of result) appendChild(element, child);
}

/** Final pass for trusted, escaped email documents, NOT an HTML sanitizer.
 * Adapted from Growvelt Careers' owner-tested iPhone Gmail fix. No content,
 * border colours, desktop palette, action URLs or provider settings change.
 */
export function prepareMobileDarkEmailHtml(html: string): string {
  let prefix = "GVLEARNINGAUTHTOKEN";
  while (html.includes(prefix)) prefix += "_";
  const tokens: string[] = [];
  // Preserve Supabase Go expressions and Resend's triple-brace placeholder.
  const shielded = html.replace(/\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g, token => { tokens.push(token); return `${prefix}${tokens.length - 1}END`; });
  const document = parseDocument(shielded);
  const elements = findAll(isTag, document.children);
  const body = elements.find(node => node.name === "body"), head = elements.find(node => node.name === "head");
  if (!body || !head || body.attribs["data-gvl-mobile-email"] === "1") return html;
  body.attribs["data-gvl-mobile-email"] = "1";
  addClass(body, "gvl-gmail-compat");
  const backgrounds = new Map<string, string>(), rules: string[] = [];
  for (const element of elements) {
    // light-only caused Gmail's own surrounding message area to remain white.
    if (element.name === "meta" && ["color-scheme", "supported-color-schemes"].includes(element.attribs.name || "")) removeElement(element);
    if (element.name === "style" && textContent(element).includes("color-scheme:light only")) removeElement(element);
    if (element.attribs.style) element.attribs.style = element.attribs.style.replace(/(^|;)(\s*)background(\s*:\s*(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\))\s*(?:!important\s*)?)(?=;|$)/gi, "$1$2background-color$3");
    const color = backgroundColor(element);
    if (!color || element.name === "html") continue;
    let name = backgrounds.get(color);
    if (!name) {
      name = `gvl-gmail-surface-${backgrounds.size}`;
      backgrounds.set(color, name);
      rules.push(`u + .gvl-gmail-compat.${name},u + .gvl-gmail-compat .${name}{background-image:linear-gradient(${color},${color})!important;}`);
    }
    addClass(element, name);
  }
  protectText(body); // Images/buttons stay outside text blends; no global filters.
  const css = `.gvl-s,.gvl-d{display:block}.gvl-r{display:inline-block;max-width:100%;vertical-align:baseline}
@media screen and (max-width:600px){${rules.join("\n")}
u + .gvl-gmail-compat .gvl-s{background:#000000;mix-blend-mode:screen;}
u + .gvl-gmail-compat .gvl-d{background:#000000;mix-blend-mode:difference;}
u + .gvl-gmail-compat .gvl-d,u + .gvl-gmail-compat .gvl-d *{color:#ffffff!important;}
u + .gvl-gmail-compat .gvl-d a{text-decoration:underline!important;}
}`;
  const style = new Element("style", { "data-gvl-mobile-compat": "1" }, [new Text(css)]);
  appendChild(head, style);
  return render(document, { encodeEntities: "utf8" }).replace(new RegExp(`${prefix}(\\d+)END`, "g"), (_match, index: string) => tokens[Number(index)]);
}
