import assert from "node:assert/strict";

// Run against a local production server: next start --hostname 127.0.0.1 --port 4316.
// This suite uses unauthenticated GETs only, without credentials or database writes.
const base = new URL(process.env.PHASE6_LOCAL_BASE_URL ?? "http://127.0.0.1:4316");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname), "Use a local Learning server only");
assert.equal(base.protocol, "http:");

async function check(path, status, referrer = "strict-origin-when-cross-origin") {
  const response = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, status, path);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN", path);
  assert.equal(response.headers.get("referrer-policy"), referrer, path);
  assert.equal(response.headers.get("x-powered-by"), null, path);
  return response;
}

const faq = await check("/frequently-asked-questions", 200);
const faqHtml = await faq.text();
assert.match(faqHtml, /How much does Growvelt charge per course/);
assert.match(faqHtml, /Instructor payouts are not currently enabled/);
assert.equal((faqHtml.match(/<details(?:\s|>)/g) ?? []).length, 60, "English FAQ serves all 60 answers");
await check("/privacy-policy", 200);
await check("/favicon.ico", 200);
await check("/forgot-password", 200, "no-referrer");
for (const path of ["/auth/callback", "/auth/learning/callback"]) {
  const response = await check(path, 307, "no-referrer");
  assert.equal(new URL(response.headers.get("location")).pathname, "/auth/error");
  assert.match(response.headers.get("cache-control"), /no-store/);
}
const unsubscribe = await check("/api/learning/email/unsubscribe?token=invalid", 400, "no-referrer");
assert.match(unsubscribe.headers.get("cache-control"), /no-store/);
console.log("PASS local production HTTP headers on public pages/assets, recovery, both callback routes, and unsubscribe; FAQ content and callback cache protections remain intact");
