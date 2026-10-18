// Synthetic exact-route contracts only; no hosted requests or unsubscribe writes.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { careersCompatibilityResponse as respond } from "../app/lib/careers-compatibility.mjs";
const future = { NEXT_PUBLIC_LEARNING_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_CAREERS_SITE_URL: "https://jobs.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "true" };
const origin = "https://www.growvelt.com";
function response(path, method = "GET", env = future, host = origin) {
  const request = new Request(host + path, { method });
  for (const name of ["text", "json", "arrayBuffer", "formData"]) Object.defineProperty(request, name, { value() { assert.fail("no legacy body access"); } });
  Object.defineProperty(request, "cookies", { get() { assert.fail("no legacy cookie access"); } });
  Object.defineProperty(request, "headers", { get() { assert.fail("no forwarding Authorization/cookies"); } });
  return respond(request, env);
}
function safeHeaders(result) {
  assert.match(result.headers.get("cache-control"), /no-store/);
  assert.equal(result.headers.get("referrer-policy"), "no-referrer");
  assert.match(result.headers.get("x-robots-tag"), /noindex/);
  assert.equal(result.headers.get("set-cookie"), null);
  assert.equal(result.headers.get("access-control-allow-origin"), null);
}
const redirects = [
  ["/ref/Ab_c-01?code=DISCARD", "/ref/Ab_c-01"], ["/ref/_-?next=DISCARD", "/ref/_-"],
  ["/ref/" + "a".repeat(128), "/ref/" + "a".repeat(128)],
  ["/unsubscribe?token=synthetic_UUID-123&code=DISCARD", "/unsubscribe?token=synthetic_UUID-123"],
  ["/alerts/unsubscribe?token=synthetic-nanoid_32&next=DISCARD", "/alerts/unsubscribe?token=synthetic-nanoid_32"],
  ["/unsubscribe?email=person%2Btag%40example.invalid&code=DISCARD", "/unsubscribe?email=person%2Btag%40example.invalid"],
  ["/unsubscribe?token=" + "a".repeat(256), "/unsubscribe?token=" + "a".repeat(256)],
  ["/unsubscribe-success?email=DISCARD", "/unsubscribe-success"],
  ["/get-started/results?answers=DISCARD", "/get-started"],
  ["/dashboard/post-job/preview?draft=DISCARD", "/dashboard/post-job"],
  ["/post-job/success?reference=DISCARD", "/dashboard/my-jobs"],
];
for (const [path, destination] of redirects) {
  for (const method of ["GET", "HEAD"]) {
    const result = response(path + "#access_token=DISCARD", method);
    safeHeaders(result);
    assert.equal(result.status, 302);
    assert.equal(result.headers.get("location"), "https://jobs.growvelt.com" + destination + "#careers-moved");
    assert.equal(await result.text(), "");
  }
}
const invalid = [
  "", "?token=", "?email=", "?token=x&token=y", "?token=x&token=", "?email=a%40b.invalid&email=b%40c.invalid",
  "?token=x&email=a%40b.invalid", "?token=" + "a".repeat(257), "?token=%252Fsecret", "?token=%3Cscript%3E",
  "?token=x%0D%0ALocation%3Aevil", "?email=a%0D%0Ab%40example.invalid", "?email=a..b%40example.invalid",
  "?email=.a%40example.invalid", "?email=a.%40example.invalid", "?email=a%40-example.invalid",
  "?email=a%40example..invalid", "?email=a%40localhost", "?email=" + "a".repeat(65) + "%40example.invalid",
  "?email=a%40" + "b".repeat(64) + ".invalid", "?email=" + "a".repeat(255) + "%40example.invalid",
  "?access_token=DISCARD&code=DISCARD", "?email=%22person%22%40example.invalid",
];
for (const path of ["/unsubscribe", "/alerts/unsubscribe"]) {
  for (const query of [...invalid, ...(path.startsWith("/alerts") ? ["?email=a%40example.invalid"] : [])]) {
    for (const method of ["GET", "HEAD"]) {
      const result = response(path + query, method);
      safeHeaders(result);
      assert.equal(result.status, 200, "invalid selectors must not redirect");
      assert.equal(result.headers.get("location"), null);
      const html = await result.text();
      assert.doesNotMatch(html, /DISCARD|example\.invalid|%3Cscript|Location%3A/);
      if (method === "HEAD") assert.equal(html, "");
      else assert.match(html, /No unsubscribe request was processed here/);
    }
  }
}
const apis = ["/api/unsubscribe", "/api/alerts/unsubscribe", "/api/paystack/verify"];
for (const path of [...redirects.map(([path]) => path), ...apis]) {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const result = response(path, method);
    safeHeaders(result);
    assert.equal(result.status, 409);
    assert.equal(result.headers.get("location"), null);
    const json = await result.json();
    assert.equal(json.success, false);
    assert.equal(json.retryable, false);
    if (path === "/api/paystack/verify") {
      assert.match(json.message, /Do not pay again/);
      assert.match(json.message, /original receipt\/reference/);
    }
  }
}
for (const path of apis) for (const method of ["GET", "HEAD"]) {
  const result = response(path + "?token=DISCARD", method);
  assert.equal(result.status, 405);
  assert.equal(result.headers.get("location"), null);
  assert.doesNotMatch(await result.text(), /DISCARD/);
}
for (const path of [...redirects.map(([path]) => path), ...apis]) {
  for (const host of ["https://learn.growvelt.com", "https://www.learn.growvelt.com", "https://jobs.growvelt.com", "https://evil.invalid"]) assert.equal(response(path, "GET", future, host), null);
  assert.equal(response(path, "GET", { ...future, NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "false" }), null);
}
for (const path of ["/ref/a.b", "/ref/a/b", "/ref/%252fsecret", "/ref/" + "a".repeat(129), "/unsubscribe/nested", "/api/paystack/unknown", "/get-started/unknown", "/post-job/unknown"]) assert.equal(response(path), null);
for (const path of ["/jobs/job_1/apply", "/jobs/job_1/apply/success"]) assert.ok((await response(path).text()).includes('href="https://jobs.growvelt.com/dashboard/applications#careers-moved"'));
// No new Learning-owned page collisions: all new action routes belong solely
// to Careers; the reviewed exact API matcher list is enforced at the Next layer.
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
for (const path of [...apis, "/unsubscribe", "/alerts/unsubscribe", "/unsubscribe-success", "/ref/:code", "/get-started/results", "/post-job/success"]) assert.ok(proxy.includes(JSON.stringify(path)), "missing proxy matcher: " + path);
for (const path of [...apis, "/unsubscribe", "/alerts/unsubscribe", "/unsubscribe-success", "/ref/[code]", "/get-started/results", "/post-job/success", "/dashboard/post-job/preview"]) {
  for (const extension of ["tsx", "ts", "jsx", "js"]) {
    const convention = path.startsWith("/api/") ? "route" : "page";
    assert.equal(existsSync(new URL("../app" + path + "/" + convention + "." + extension, import.meta.url)), false, "new Learning route collides with reserved Careers compatibility path: " + path);
  }
}
console.log("PASS Careers action links: bounded referral, single-selector unsubscribe, restart targets, payment no-replay/no-repay guidance, host/flag isolation (synthetic only)");
