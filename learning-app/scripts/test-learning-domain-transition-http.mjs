import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import net from "node:net";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const mode = process.argv[2];
const compatibility = process.argv.includes("--compatibility");
if (compatibility) assert.equal(mode, "future", "Compatibility rehearsal requires future mode");
assert.ok(["legacy", "future"].includes(mode), "Choose legacy or future");
const root = fileURLToPath(new URL("../", import.meta.url));
const env = { ...process.env };
// Override dotenv names with blank values BEFORE Next loads .env.local. Missing
// values alone are unsafe: this repository's .env.local points to hosted Supabase.
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const file = new URL(`../${name}`, import.meta.url);
  if (existsSync(file)) for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (key) env[key] = "";
  }
}
for (const key of Object.keys(env)) if (/SUPABASE|PAYSTACK|RESEND|TURNSTILE|CRON_SECRET|SUBSCRIPTION.*ENABLED|PAYMENTS_.*ENABLED/.test(key)) env[key] = "";
Object.assign(env, {
  NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "",
  NEXT_PUBLIC_LEARNING_SITE_URL: mode === "future" ? "https://www.growvelt.com" : "https://learn.growvelt.com",
  NEXT_PUBLIC_CAREERS_SITE_URL: mode === "future" ? "https://jobs.growvelt.com" : "https://www.growvelt.com",
  NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: mode === "future" ? "true" : "false",
  GROWVELT_DOMAIN_TEST_MODE: mode, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
});
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "");
assert.equal(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "");
assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, "");
console.log(`Rehearsal ${mode}: Supabase URL/keys, email/payment secrets and feature gates are blank; no hosted write tests.`);

const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
async function command(args) {
  const child = spawn(process.execPath, [next, ...args], { cwd: root, env, stdio: "inherit", windowsHide: true });
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); });
  assert.equal(code, 0, `next ${args.join(" ")}`);
}
if (!process.argv.includes("--skip-build")) await command(["build"]);
const reservation = net.createServer();
await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const serverArgs = compatibility
  ? [fileURLToPath(new URL("./serve-learning-domain-rehearsal.mjs", import.meta.url)), String(port)]
  : [next, "start", "-H", "127.0.0.1", "-p", String(port)];
const server = spawn(process.execPath, serverArgs, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
let logs = "";
server.stdout.on("data", data => { logs += data; });
server.stderr.on("data", data => { logs += data; });
const origin = `http://127.0.0.1:${port}`;
async function request(path, options = {}) {
  return fetch(origin + path, { ...options, redirect: "manual", signal: AbortSignal.timeout(20000) });
}
try {
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try { await request("/robots.txt"); break; }
    catch (error) { if (attempt >= 40) throw error; await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  const canonical = env.NEXT_PUBLIC_LEARNING_SITE_URL;
  const html = await (await request("/")).text();
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`) || html.includes(`rel="canonical" href="${canonical}/"`));
  assert.ok(html.includes(`${env.NEXT_PUBLIC_CAREERS_SITE_URL}/career-assistant`));
  const robots = await (await request("/robots.txt")).text();
  const sitemap = await (await request("/sitemap.xml")).text();
  assert.ok(robots.includes(canonical + "/sitemap.xml"));
  assert.ok(sitemap.includes(canonical + "/learn"));
  for (const path of ["/learning/dashboard", "/learning/dashboard/profile", "/learning/dashboard/settings"]) {
    const response = await request(path + "?tab=details");
    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location"), origin);
    assert.equal(location.pathname, "/sign-in");
    assert.equal(location.searchParams.get("next"), (mode === "future" ? path : path.replace("/learning", "")) + "?tab=details");
  }
  for (const callback of ["/auth/callback", "/auth/learning/callback"]) {
    const response = await request(callback);
    if (compatibility && callback === "/auth/callback") {
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes("Restart Careers sign-in"));
      continue;
    }
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location")).pathname, "/auth/error");
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  const badNewsletter = await request("/api/learning/newsletter/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "invalid" }) });
  assert.equal(badNewsletter.status, 400); // Validation only; never attempts a database insert.
  const welcome = await request("/api/learning/auth/welcome", { method: "POST", headers: { Origin: "https://evil.invalid" } });
  assert.equal(welcome.status, 403); // Rejected before Auth/email processing.
  if (compatibility) {
    for (const path of ["/dashboard", "/dashboard/profile", "/dashboard/settings", "/dashboard/my-jobs", "/dashboard/applications", "/jobs", "/career-assistant", "/employers", "/updates", "/get-started", "/jobs/01234567-89ab-4cde-8123-0123456789ab", "/companies/employer_1"]) {
      for (const method of ["GET", "HEAD"]) {
        const response = await request(path + "?code=SECRET&next=//evil.invalid", { method });
        assert.equal(response.status, 302, path);
        assert.equal(response.headers.get("location"), "https://jobs.growvelt.com" + path + "#careers-moved");
        assert.match(response.headers.get("cache-control"), /no-store/);
      }
      const blocked = await request(path, { method: "POST", body: "synthetic-unused-body" });
      assert.equal(blocked.status, 409);
      assert.equal(blocked.headers.get("location"), null);
    }
    for (const path of ["/jobs/id/apply", "/jobs/id/apply/questions", "/jobs/id/preview", "/jobs/id/success", "/companies/id/private", "/jobs/with.dot", "/jobs/%252fsecret", "/ref/code", "/unsubscribe?token=SECRET", "/alerts/unsubscribe?token=SECRET", "/api/unsubscribe?token=SECRET", "/api/paystack/verify"]) {
      const response = await request(path);
      assert.equal(response.status, 404, "Unreviewed legacy route must not be captured or processed: " + path);
      assert.equal(response.headers.get("location"), null);
    }
    const logo = await request("/logo/growvelt-magenta-email.png");
    assert.equal(logo.status, 200);
    assert.match(logo.headers.get("content-type"), /image\/png/);
    assert.equal(createHash("sha256").update(Buffer.from(await logo.arrayBuffer())).digest("hex"), "d91eb40371a73cf24f4b8f14804d4bb5ee7da2336507278caf2673590c81ea3a", "Preserve delivered Careers email logo bytes at the exact old www path");
    for (const path of ["/api/auth/welcome", "/api/newsletter/subscribe"]) {
      const response = await request(path, { method: "POST", body: "synthetic-unused-body" });
      assert.equal(response.status, 409);
      assert.equal((await response.json()).retryable, false);
    }
    const oldCallback = await request("/auth/callback?code=SECRET&next=//evil.invalid");
    assert.equal(oldCallback.status, 200);
    assert.doesNotMatch(await oldCallback.text(), /SECRET|evil\.invalid/);
    for (const path of ["/auth", "/auth/reset", "/auth/forgot-password"]) {
      const response = await request(path + "?code=SECRET");
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes("Restart Careers sign-in"));
    }
    for (const path of ["/pwa/launch.html", "/offline.html"]) {
      const response = await request(path);
      assert.equal(response.status, 200);
      assert.ok((await response.text()).includes("install Careers again"));
    }
    const sw = await request("/sw.js");
    assert.equal(sw.status, 200);
    assert.match(sw.headers.get("content-type"), /javascript/);
    assert.equal(sw.headers.get("service-worker-allowed"), "/");
    assert.match(sw.headers.get("cache-control"), /no-store/);
    assert.ok((await sw.text()).includes("clients.claim"));
    assert.equal((await (await request("/manifest.webmanifest")).json()).id, "/");
    assert.equal((await (await request("/site.webmanifest")).json()).id, "/learning/");
    console.log("PASS future-www real Next HTTP compatibility: dashboard/shortcuts, rejected POSTs, Auth restart, worker/launch/manifests; no backend credentials.");
  }
  // The payment confirmation page requires an authenticated backend; do not
  // enable hosted Supabase merely to render it. Its references/guards and
  // subscription verification are covered separately with isolated unit tests.
  console.log(`PASS ${mode}: optimized build + loopback HTTP canonical/links/SEO, protected aliases, both callbacks and rejected POSTs (backends disabled).`);
} finally {
  server.kill();
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once("exit", resolve); });
}
