// Synthetic Requests and worker lifecycle harness only. No hosted traffic/storage.
import assert from "node:assert/strict";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { careersCompatibilityResponse as respond, careersLegacyPages, careersTransitionWorker } from "../app/lib/careers-compatibility.mjs";

const future = { NEXT_PUBLIC_LEARNING_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_CAREERS_SITE_URL: "https://jobs.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "true" };
const origin = "https://www.growvelt.com";
const make = (path, options) => new Request(origin + path, options);
function isolatedResponse(path, method = "GET") {
  const request = make(path, { method });
  Object.defineProperties(request, {
    text: { value() { throw new Error("Must not read legacy bodies"); } },
    json: { value() { throw new Error("Must not read legacy bodies"); } },
    cookies: { get() { throw new Error("Must not read legacy cookies"); } },
  });
  const response = respond(request, future);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  return response;
}
const publicDetails = ["/jobs/123", "/companies/123", "/jobs/01234567-89ab-4cde-8123-0123456789ab", "/companies/employer_1"];
for (const path of [...careersLegacyPages, ...publicDetails]) {
  for (const method of ["GET", "HEAD"]) {
    const response = isolatedResponse(path + "?next=https://evil.invalid&code=SECRET&tab=private", method);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://jobs.growvelt.com" + path + "#careers-moved");
    assert.equal(await response.text(), "");
  }
}
for (const path of [...careersLegacyPages, ...publicDetails, "/auth/callback", "/api/auth/welcome", "/api/newsletter/subscribe", "/sw.js"]) {
  for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
    const response = isolatedResponse(path, method);
    assert.equal(response.status, 409);
    assert.equal(response.headers.get("location"), null, "never 307/308-replay a body into Careers or Learning");
    const json = await response.json();
    assert.equal(json.code, "careers_moved");
    assert.equal(json.success, false);
    assert.equal(json.retryable, false);
    assert.equal(json.careersUrl, "https://jobs.growvelt.com/auth?mode=signin");
  }
}
for (const path of ["/api/auth/welcome", "/api/newsletter/subscribe"]) assert.equal(isolatedResponse(path).status, 405);
for (const token of ["?code=SECRET&next=//evil.invalid", "?error_description=%3Cscript%3E&token_hash=SECRET", "#access_token=SECRET"]) {
  const response = isolatedResponse("/auth/callback" + token);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes("Restart Careers sign-in"));
  assert.ok(html.includes("request a new recovery email"));
  assert.doesNotMatch(html, /SECRET|evil\.invalid|error_description|token_hash|access_token/);
  const script = html.match(/<script>(.*?)<\/script>/s)[1];
  assert.ok(response.headers.get("content-security-policy").includes("'sha256-" + createHash("sha256").update(script).digest("base64") + "'"));
  const replacements = [];
  vm.runInNewContext(script, { history: { replaceState: (...args) => replacements.push(args) }, location: { pathname: "/auth/callback" }, navigator: {} });
  assert.equal(replacements[0][2], "/auth/callback", "strip sensitive query/fragment from current history entry");
}
for (const path of ["/pwa/launch.html", "/offline.html"]) {
  const response = isolatedResponse(path);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.ok(html.includes("install Careers again"));
  assert.ok(html.includes("https://jobs.growvelt.com/dashboard"));
  assert.ok(!html.includes('location.replace("/dashboard")'));
}
const manifest = await isolatedResponse("/manifest.webmanifest").json();
assert.equal(manifest.id, "/");
assert.equal(manifest.start_url, "/pwa/launch.html");
const learningManifest = await isolatedResponse("/site.webmanifest").json();
assert.equal(learningManifest.id, "/learning/");
assert.notEqual(manifest.id, learningManifest.id);
const worker = isolatedResponse("/sw.js");
assert.match(worker.headers.get("content-type"), /javascript/);
assert.equal(worker.headers.get("service-worker-allowed"), "/");
assert.equal(await worker.text(), careersTransitionWorker());

// Never apply future-www compatibility on learn, www.learn, jobs, arbitrary
// hosts or the current configuration, regardless of headers or cookies supplied.
for (const host of ["learn.growvelt.com", "www.learn.growvelt.com", "jobs.growvelt.com", "evil.invalid"]) {
  for (const path of [...careersLegacyPages, ...publicDetails, "/auth/callback", "/sw.js", "/pwa/launch.html", "/api/auth/welcome"]) {
    assert.equal(respond(new Request("https://" + host + path), future), null);
  }
}
assert.equal(respond(make("/dashboard"), {}), null);
assert.equal(respond(make("/dashboard"), { ...future, NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "false" }), null);
for (const path of ["/", "/dashboard/my-learning", "/learning/dashboard", "/auth/learning/callback", "/payments/paystack/callback", "/api/payments/paystack/webhook", "/courses/data",
  "/jobs/id/apply", "/jobs/id/apply/questions", "/jobs/id/preview", "/jobs/id/success", "/companies/id/private", "/jobs/", "/jobs/%2Fsecret", "/jobs/%5csecret", "/jobs/with.dot", "/jobs/" + "a".repeat(129),
  "/ref/code", "/unsubscribe?token=SECRET", "/alerts/unsubscribe?token=SECRET", "/api/unsubscribe?token=SECRET", "/api/alerts/unsubscribe?token=SECRET", "/api/paystack/verify", "/candidates/id", "/career-assistant/private",
]) {
  assert.equal(respond(make(path), future), null);
}
for (const path of ["/auth", "/auth/reset", "/auth/forgot-password"]) {
  const response = isolatedResponse(path + "?code=SECRET");
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes("Restart Careers sign-in"));
}
const head = isolatedResponse("/auth/callback", "HEAD");
assert.equal(await head.text(), "");

// Test the actual generated worker source with browser API doubles. The caches
// are disposable Maps, NOT the user's browser or application data.
const handlers = {}, deleted = [], opened = [], notifications = [];
let skips = 0, claims = 0;
const stores = new Map([
  ["growvelt-pwa-v16", new Map([["/pwa/launch.html", "OLD_CACHED_CAREERS_LAUNCH"]])],
  ["growvelt-pwa-v5", new Map()], ["learning-offline-v1", new Map()],
  ["growvelt-pwa-personal-data", new Map()], ["unrelated-cache", new Map()],
]);
const self = {
  location: { origin }, addEventListener: (name, fn) => { handlers[name] = fn; },
  skipWaiting: async () => { skips++; },
  clients: { claim: async () => { claims++; }, openWindow: async target => { opened.push(target); } },
  registration: { showNotification: async (...args) => { notifications.push(args); } },
};
vm.runInNewContext(careersTransitionWorker(), {
  self, URL, Response, Promise,
  caches: { keys: async () => [...stores.keys()], delete: async name => { deleted.push(name); return stores.delete(name); } },
  fetch() { throw new Error("The compatibility worker must not fetch or forward anything"); },
});
async function event(name, extra = {}) {
  const pending = [];
  handlers[name]({ waitUntil: task => pending.push(task), ...extra });
  await Promise.all(pending);
}
await event("install");
assert.equal(skips, 1, "late-returning devices must not wait indefinitely for the old app to close");
await event("activate");
assert.equal(claims, 1);
assert.deepEqual(deleted.sort(), ["growvelt-pwa-v16", "growvelt-pwa-v5"]);
assert.ok(stores.has("learning-offline-v1") && stores.has("unrelated-cache") && stores.has("growvelt-pwa-personal-data"));
for (const path of [...careersLegacyPages, "/pwa/launch.html", "/offline.html"]) {
  let result;
  await event("fetch", { request: { url: origin + path + "?code=SECRET", method: "GET", mode: "navigate" }, respondWith: task => { result = task; } });
  const response = await result;
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes("Careers has a new address"), "launch has an offline-capable migration page, not old Learning/dashboard content");
  assert.doesNotMatch(html, /SECRET/);
}
for (const [url, method, mode] of [
  [origin + "/", "GET", "navigate"], [origin + "/learning/dashboard", "GET", "navigate"],
  [origin + "/auth/callback?code=SECRET", "GET", "navigate"],
  [origin + "/payments/paystack/callback", "GET", "navigate"],
  [origin + "/api/newsletter/subscribe", "POST", "cors"],
  [origin + "/dashboard", "POST", "navigate"], [origin + "/dashboard", "GET", "cors"],
  ["https://jobs.growvelt.com/dashboard", "GET", "navigate"],
]) {
  await event("fetch", { request: { url, method, mode }, respondWith() { assert.fail("must not hijack Learning/API/Auth/payment/foreign traffic"); } });
}
await event("push", { data: { text() { assert.fail("do not reuse old push payloads"); } } });
assert.equal(notifications[0][0], "Growvelt Careers has moved");
let closed = false;
await event("notificationclick", { notification: { data: { path: "https://evil.invalid/?token=SECRET" }, close: () => { closed = true; } } });
assert.equal(closed, true);
assert.deepEqual(opened, ["https://jobs.growvelt.com/dashboard"]);
console.log("PASS Careers compatibility: redirects, no-replay POSTs, token-free Auth restart, manifests, worker install/activate/offline-launch/push, learn/payment isolation (synthetic only)");
