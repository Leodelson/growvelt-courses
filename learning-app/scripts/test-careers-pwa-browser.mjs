// Real headless Chromium, disposable context + loopback fixture only. Never use
// the user's browser profile or production DNS. No Supabase/provider credentials.
import assert from "node:assert/strict";
import http from "node:http";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { careersCompatibilityResponse, careersTransitionWorker, learningWwwSafetyBridgeResponse } from "../app/lib/careers-compatibility.mjs";
const require = createRequire(import.meta.url);
const moduleFlag = process.argv.indexOf("--playwright-module");
const { chromium } = require(moduleFlag >= 0 ? process.argv[moduleFlag + 1] : "playwright");
const executableFlag = process.argv.indexOf("--browser-executable");
const careersFlag = process.argv.indexOf("--careers-repo");
// Read only the explicitly supplied repository's committed worker, never its
// dirty worktree, credentials or environment. Git commands below are read-only.
const careersRepo = careersFlag >= 0 ? process.argv[careersFlag + 1] : null;
// Trust only this explicitly supplied repository for these two commands; do not
// alter global/system/repository Git configuration to accommodate sandbox ownership.
const gitArgs = careersRepo ? ["-c", "safe.directory=" + careersRepo, "-C", careersRepo] : [];
const careersRevision = careersRepo ? execFileSync("git", [...gitArgs, "rev-parse", "HEAD"], { encoding: "utf8" }).trim() : null;
const rollbackWorker = careersRepo ? execFileSync("git", [...gitArgs, "show", careersRevision + ":public/sw.js"], { encoding: "utf8" }) : null;
const future = { NEXT_PUBLIC_LEARNING_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_CAREERS_SITE_URL: "https://jobs.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "true" };
const bridge = { NEXT_PUBLIC_LEARNING_SITE_URL: "https://learn.growvelt.com", NEXT_PUBLIC_CAREERS_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "false", LEARNING_WWW_SAFETY_BRIDGE_ENABLED: "true" };
let phase = "legacy";
const jobsRequests = [];
const oldWorker = `
const name="growvelt-pwa-v16";
self.addEventListener("install",e=>e.waitUntil((async()=>{const c=await caches.open(name);await c.put("/pwa/launch.html",new Response("<!doctype html><h1>Old cached Careers launch</h1>",{headers:{"Content-Type":"text/html"}}));await self.skipWaiting();})()));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{if(new URL(e.request.url).pathname==="/pwa/launch.html")e.respondWith(caches.open(name).then(c=>c.match("/pwa/launch.html")));});
`;
// Legacy fixture models Careers v16's verified cache-first launch. The actual
// replacement worker and migration responses below are production-source code.
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path.startsWith("/mock-careers/")) {
    jobsRequests.push({ url: "http://" + req.headers.host + req.url, referrer: req.headers.referer });
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    // Synthetic receiver only: no unsubscribe writes or real signup.
    const referralCode = path.match(/^\/mock-careers\/ref\/([A-Za-z0-9_-]{1,128})$/)?.[1];
    res.end("<!doctype html><h1>Mock Careers destination</h1>" + (referralCode ? `<script>localStorage.setItem("referral_code",${JSON.stringify(referralCode)})</script>` : ""));
    return;
  }
  if (phase === "rollback") {
    res.writeHead(200, { "Content-Type": path === "/sw.js" ? "application/javascript" : "text/html; charset=utf-8", "Cache-Control": "no-store", "Service-Worker-Allowed": "/" });
    res.end(path === "/sw.js" ? rollbackWorker : "<!doctype html><h1>Careers rollback " + (path === "/offline.html" ? "offline" : "launch") + " fixture</h1>");
    return;
  }
  if (phase === "transition" || phase === "bridge") {
    const request = new Request("https://www.growvelt.com" + req.url, { method: req.method });
    const response = phase === "bridge" ? learningWwwSafetyBridgeResponse(request, bridge) : careersCompatibilityResponse(request, future);
    if (response) {
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
  }
  if (path === "/sw.js") {
    res.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store", "Service-Worker-Allowed": "/" });
    res.end(oldWorker); return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end("<!doctype html><h1>Learning fixture — not Careers</h1>");
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(executableFlag >= 0 ? { executablePath: process.argv[executableFlag + 1] } : {}) });
  const context = await browser.newContext({ serviceWorkers: "allow" });
  // Abort any attempted non-loopback navigation; there is no real jobs login.
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(origin + "/");
  await context.addCookies([{ name: "careers_synthetic", value: "not-a-session", url: origin }, { name: "learning_synthetic", value: "not-a-session", url: origin }]);
  await page.evaluate(async () => {
    localStorage.setItem("careers_synthetic", "not-a-token");
    localStorage.setItem("learning_synthetic", "not-a-token");
    await caches.open("learning-offline-v1");
    await caches.open("unrelated-cache");
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.goto(origin + "/pwa/launch.html");
  assert.ok((await page.textContent("h1")).includes("Old cached Careers"), "offline missed-update device still has its old launch before reconnect");
  // Transfer happens while the device was offline. Reconnection and update of
  // the same /sw.js must replace the old active worker without closing the app.
  phase = "bridge";
  await context.setOffline(false);
  await page.evaluate(async () => {
    const changed = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for replacement worker")), 15000);
      navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    const registration = await navigator.serviceWorker.getRegistration("/");
    await registration.update();
    await changed;
  });
  // Inspect the real installed active worker source through its served endpoint.
  assert.equal(await (await context.request.get(origin + "/sw.js")).text(), careersTransitionWorker());
  // controllerchange can precede activate's asynchronous cache cleanup finishing.
  await page.evaluate(async () => {
    const worker = (await navigator.serviceWorker.getRegistration("/"))?.active;
    if (worker && worker.state !== "activated") await new Promise(resolve => {
      worker.addEventListener("statechange", () => { if (worker.state === "activated") resolve(); });
    });
  });
  const cacheNames = await page.evaluate(() => caches.keys());
  assert.ok(!cacheNames.includes("growvelt-pwa-v16"));
  assert.ok(cacheNames.includes("learning-offline-v1") && cacheNames.includes("unrelated-cache"));
  await context.setOffline(true);
  await page.goto(origin + "/pwa/launch.html");
  assert.equal(await page.textContent("h1"), "Careers has a new address");
  assert.equal(await page.getAttribute("a.primary", "href"), "https://jobs.growvelt.com/dashboard");
  await page.goto(origin + "/dashboard?code=SYNTHETIC_SECRET");
  assert.equal(await page.textContent("h1"), "Careers has a new address");
  assert.equal(new URL(page.url()).search, "", "migration script strips old tokens/query");
  assert.equal(await page.evaluate(() => localStorage.getItem("careers_synthetic")), "not-a-token");
  assert.equal(await page.evaluate(() => localStorage.getItem("learning_synthetic")), "not-a-token");
  assert.equal((await context.cookies()).length, 2, "no cookie/session clearing");
  await context.setOffline(false);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(origin + "/?code=SYNTHETIC_SECRET#access_token=SYNTHETIC_SECRET");
  assert.equal(await page.textContent("h1"), "Choose your Growvelt destination");
  await page.waitForFunction(() => !location.search && !location.hash);
  assert.doesNotMatch(await page.content(), /SYNTHETIC_SECRET/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.goto(origin + "/auth/learning/callback?code=SYNTHETIC_SECRET");
  assert.equal(await page.textContent("h1"), "Choose your Growvelt destination");
  const blocked = await context.request.post(origin + "/api/payments/paystack/initialize", { data: { reference: "SYNTHETIC_SECRET" } });
  assert.equal(blocked.status(), 409);
  assert.doesNotMatch(await blocked.text(), /SYNTHETIC_SECRET/);
  phase = "transition"; // Only the fixture activates future behavior; no live switch.
  await page.goto(origin + "/learning/dashboard");
  assert.equal(await page.textContent("h1"), "Learning fixture — not Careers", "worker must not hijack Learning navigation");
  await page.goto(origin + "/auth/callback?code=SYNTHETIC_SECRET#access_token=SYNTHETIC_SECRET");
  assert.equal(await page.textContent("h1"), "Continue your sign-in on Careers");
  await page.waitForFunction(() => !location.search && !location.hash);
  assert.doesNotMatch(await page.content(), /SYNTHETIC_SECRET/);
  assert.equal(await page.getAttribute("a.primary", "href"), "https://jobs.growvelt.com/auth?mode=signin");
  // A fresh (no old-worker) device receives the same migration response online.
  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.goto(origin + "/pwa/launch.html");
  assert.equal(await freshPage.textContent("h1"), "Careers has a new address");
  await freshPage.setViewportSize({ width: 360, height: 780 });
  assert.ok(await freshPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "migration page must fit a small screen");
  for (const step of ["", "/questions", "/preview", "/success"]) {
    await freshPage.goto(origin + "/jobs/job_1/apply" + step + "?answers=SYNTHETIC_SECRET#access_token=SYNTHETIC_SECRET");
    assert.equal(await freshPage.textContent("h1"), "Continue your application on Careers");
    await freshPage.waitForFunction(() => !location.search && !location.hash);
    assert.doesNotMatch(await freshPage.content(), /SYNTHETIC_SECRET/);
    assert.equal(await freshPage.getAttribute("a.primary", "href"), "https://jobs.growvelt.com/jobs/job_1#careers-moved");
    assert.ok(await freshPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "application restart must fit a small screen");
  }
  // Validate the real Location, then mirror that destination onto loopback for
  // browser fragment/referrer semantics. Never connect to a hosted jobs server.
  await fresh.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/mock-careers/")) return route.continue();
    const response = await route.fetch({ maxRedirects: 0 });
    const location = response.headers().location;
    if (location) {
      const target = new URL(location);
      assert.equal(target.origin, "https://jobs.growvelt.com");
      assert.equal(target.hash, "#careers-moved");
      return route.fulfill({ response, headers: { ...response.headers(), location: origin + "/mock-careers" + target.pathname + target.search + target.hash } });
    }
    return route.fulfill({ response });
  });
  for (const path of ["/jobs/01234567-89ab-4cde-8123-0123456789ab", "/companies/employer_1", "/employers", "/updates", "/get-started", "/dashboard/admin/support", "/career-assistant/employer/interview-builder", "/candidates/candidate_1", "/dashboard/my-jobs/jobs/job_1"]) {
    await freshPage.goto(origin + path + "?code=SYNTHETIC_SECRET#access_token=SYNTHETIC_SECRET");
    assert.equal(freshPage.url(), origin + "/mock-careers" + path + "#careers-moved");
    const received = jobsRequests.at(-1);
    assert.equal(received.url, origin + "/mock-careers" + path);
    assert.equal(received.referrer, undefined);
  }
  const actionCases = [
    ["/ref/Ab_c-01?code=SYNTHETIC_SECRET", "/ref/Ab_c-01"],
    ["/unsubscribe?token=SYNTHETIC_TOKEN&code=SYNTHETIC_SECRET", "/unsubscribe?token=SYNTHETIC_TOKEN"],
    ["/unsubscribe?email=person%2Btag%40example.invalid&code=SYNTHETIC_SECRET", "/unsubscribe?email=person%2Btag%40example.invalid"],
    ["/alerts/unsubscribe?token=SYNTHETIC_TOKEN&code=SYNTHETIC_SECRET", "/alerts/unsubscribe?token=SYNTHETIC_TOKEN"],
    ["/get-started/results?answers=SYNTHETIC_SECRET", "/get-started"],
    ["/dashboard/post-job/preview?draft=SYNTHETIC_SECRET", "/dashboard/post-job"],
    ["/post-job/success?reference=SYNTHETIC_SECRET", "/dashboard/my-jobs"],
  ];
  for (const [path, target] of actionCases) {
    await freshPage.goto(origin + path + "#access_token=SYNTHETIC_SECRET");
    assert.equal(freshPage.url(), origin + "/mock-careers" + target + "#careers-moved");
    assert.equal(jobsRequests.at(-1).url, origin + "/mock-careers" + target);
    assert.equal(jobsRequests.at(-1).referrer, undefined);
    if (path.startsWith("/ref/")) assert.equal(await freshPage.evaluate(() => localStorage.getItem("referral_code")), "Ab_c-01");
  }
  await freshPage.goto(origin + "/unsubscribe?token=SYNTHETIC_SECRET&email=person%40example.invalid#access_token=SYNTHETIC_SECRET");
  await freshPage.waitForFunction(() => !location.search && !location.hash);
  assert.equal(await freshPage.textContent("h1"), "Manage your Careers email preferences");
  assert.doesNotMatch(await freshPage.content(), /SYNTHETIC_SECRET|example\.invalid/);
  await fresh.close();
  if (rollbackWorker) {
    phase = "rollback";
    assert.equal(await (await context.request.get(origin + "/sw.js")).text(), rollbackWorker);
    const waiting = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      await registration.update();
      // Explicitly await the asynchronous browser API inside the page. A Promise
      // itself must never be mistaken for a truthy polling predicate.
      for (let attempt = 0; attempt < 150; attempt++) {
        if (registration.waiting) return { active: registration.active?.state, waiting: registration.waiting.state, url: registration.waiting.scriptURL };
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error("Exact Careers rollback worker did not enter waiting state");
    });
    assert.deepEqual(waiting, { active: "activated", waiting: "installed", url: origin + "/sw.js" });
    await page.evaluate(async () => {
      const changed = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Rollback worker did not take control")), 15000);
        navigator.serviceWorker.addEventListener("controllerchange", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      (await navigator.serviceWorker.getRegistration("/")).waiting.postMessage({ type: "SKIP_WAITING" });
      await changed;
    });
    await page.evaluate(async () => {
      const worker = (await navigator.serviceWorker.getRegistration("/"))?.active;
      if (!worker) throw new Error("Missing rollback active worker");
      if (worker.state !== "activated") await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Rollback activation did not finish")), 15000);
        worker.addEventListener("statechange", () => { if (worker.state === "activated") { clearTimeout(timer); resolve(); } });
      });
    });
    await context.setOffline(true);
    await page.goto(origin + "/pwa/launch.html");
    assert.equal(await page.textContent("h1"), "Careers rollback launch fixture");
    await page.goto(origin + "/dashboard");
    assert.equal(await page.textContent("h1"), "Careers rollback offline fixture");
    const names = await page.evaluate(() => caches.keys());
    assert.ok(names.includes("learning-offline-v1") && names.includes("unrelated-cache"));
    assert.equal(await page.evaluate(() => localStorage.getItem("careers_synthetic")), "not-a-token");
    assert.equal(await page.evaluate(() => localStorage.getItem("learning_synthetic")), "not-a-token");
    assert.equal((await context.cookies()).length, 2);
    await context.setOffline(false);
    await page.goto(origin + "/dashboard");
    assert.equal(await page.textContent("h1"), "Careers rollback launch fixture");
    // Actual rollback source's notification handler, with browser API doubles:
    // no live push registration/delivery or native notifications are performed.
    const handlers = {}, opened = [];
    vm.runInNewContext(rollbackWorker, { URL, Response, TextEncoder, self: {
      location: { origin }, addEventListener: (name, fn) => { handlers[name] = fn; },
      clients: { matchAll: async () => [], openWindow: async path => { opened.push(path); } },
    } });
    for (const path of ["/dashboard/applications", "https://evil.invalid/?token=SYNTHETIC_SECRET"]) {
      const pending = [];
      handlers.notificationclick({ notification: { data: { path }, close() {} }, waitUntil: task => pending.push(task) });
      await Promise.all(pending);
    }
    assert.deepEqual(opened, ["/dashboard/applications", "/dashboard"]);
    console.log(JSON.stringify({ result: "PASS exact Careers rollback worker: waiting -> SKIP_WAITING -> active, offline/online launch, unrelated storage preserved; click handler via doubles", careersRevision, sha256: createHash("sha256").update(rollbackWorker).digest("hex") }));
  } else console.log("Rollback worker test skipped: supply --careers-repo for read-only committed Careers source");
  console.log("PASS real Chromium PWA lifecycle, mobile shell and public detail redirects without inherited queries/fragments/referrers (loopback + intercepted mock destination only)");
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
