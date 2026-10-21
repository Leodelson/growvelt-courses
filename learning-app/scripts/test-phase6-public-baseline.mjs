import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";

// HTTP/render-size baseline only, not Lighthouse, browser LCP/INP/CLS, or a
// production speed claim. Public GETs only; no sign-in, mutations or providers.
const base = new URL(process.env.PHASE6_LOCAL_BASE_URL ?? "http://127.0.0.1:4316");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
assert.equal(base.protocol, "http:");
const rows = [];
for (const path of ["/frequently-asked-questions", "/teach", "/company-learning", "/contact", "/privacy-policy", "/about"]) {
  const timings = [];
  let html = "";
  for (let sample = 0; sample < 2; sample++) {
    const start = performance.now();
    const response = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200, path);
    html = await response.text();
    timings.push(Math.round(performance.now() - start));
  }
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, `${path}: one primary heading`);
  assert.match(html, /<main(?:\s|>)/, `${path}: main landmark`);
  assert.match(html, /<meta name="viewport"/, `${path}: responsive viewport`);
  assert.match(html, /Skip to content/, `${path}: keyboard skip link`);
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  for (const image of images) assert.match(image, /\balt="[^"]*"/, `${path}: image alternatives`);
  rows.push({ path, firstGetMs: timings[0], secondGetMs: timings[1], htmlBytes: Buffer.byteLength(html), estimatedGzipBytes: gzipSync(html).length, images: images.length });
}
console.log(JSON.stringify({ kind: "Local HTTP and HTML-size baseline; not browser Web Vitals", rows }, null, 2));
console.log("PASS six public pages: one primary heading, main landmark, viewport, skip link, and image alt attributes. Interactive focus, contrast, mobile overflow, and Web Vitals remain separate checks.");
