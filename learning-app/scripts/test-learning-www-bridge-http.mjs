// Optimized bridge build + loopback Next HTTP; NO hosted keys/providers.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import net from "node:net";
import http from "node:http";
const root = fileURLToPath(new URL("../", import.meta.url));
const env = { ...process.env };
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  const file = new URL("../" + name, import.meta.url);
  if (existsSync(file)) for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
    if (key) env[key] = "";
  }
}
for (const key of Object.keys(env)) if (/SUPABASE|PAYSTACK|RESEND|TURNSTILE|CRON_SECRET|SUBSCRIPTION.*ENABLED|PAYMENTS_.*ENABLED/.test(key)) env[key] = "";
Object.assign(env, {
  NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "",
  NEXT_PUBLIC_LEARNING_SITE_URL: "https://learn.growvelt.com", NEXT_PUBLIC_CAREERS_SITE_URL: "https://www.growvelt.com",
  NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "false", LEARNING_WWW_SAFETY_BRIDGE_ENABLED: "true",
  GROWVELT_DOMAIN_TEST_MODE: "bridge", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
});
console.log("Bridge rehearsal: legacy public URLs, cutover OFF, server bridge ON only in child fixture; Supabase/email/payment credentials blank.");
const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
if (!process.argv.includes("--skip-build")) {
  const child = spawn(process.execPath, [next, "build"], { cwd: root, env, stdio: "inherit", windowsHide: true });
  assert.equal(await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); }), 0);
}
for (const [hostname, bridgeEnabled] of [["www.growvelt.com", true], ["learn.growvelt.com", true], ["www.learn.growvelt.com", true], ["www.growvelt.com", false]]) {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = spawn(process.execPath, [fileURLToPath(new URL("./serve-learning-domain-rehearsal.mjs", import.meta.url)), String(port)], {
    cwd: root, env: { ...env, GROWVELT_DOMAIN_TEST_HOST: hostname, LEARNING_WWW_SAFETY_BRIDGE_ENABLED: String(bridgeEnabled) }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let logs = "";
  server.stdout.on("data", data => { logs += data; });
  server.stderr.on("data", data => { logs += data; });
  const origin = "http://127.0.0.1:" + port;
  // Node's bundled fetch ignores a custom Host in this runtime. Core HTTP
  // supplies the actual Host header while connecting ONLY to loopback; no
  // production DNS, trustHostHeader override or request-URL spoof is enabled.
  const request = (path, options = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path, method: options.method || "GET", headers: { Host: hostname, ...options.headers }, signal: AbortSignal.timeout(20000) }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("error", reject);
      res.on("end", () => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        resolve(new Response(options.method === "HEAD" || [204, 304].includes(res.statusCode) ? null : Buffer.concat(chunks), { status: res.statusCode, headers }));
      });
    });
    req.on("error", reject);
    req.end(options.body);
  });
  try {
    for (let attempt = 0; ; attempt++) {
      if (server.exitCode !== null) throw new Error(logs);
      try { await request("/robots.txt"); break; } catch (error) { if (attempt > 60) throw error; await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    if (hostname === "www.growvelt.com" && bridgeEnabled) {
      for (const path of ["/", "/unknown", "/auth/learning/callback", "/learning/dashboard", "/sign-in", "/reset-password", "/payments/paystack/callback", "/_next/static/not-a-bundle.js", "/_next/image", "/logo/not-allowlisted.png", "/sitemap.xml"]) {
        for (const method of ["GET", "HEAD", "POST"]) {
          const result = await request(path + "?code=SYNTHETIC_SECRET&reference=SYNTHETIC_SECRET", { method });
          assert.equal(result.status, method === "POST" ? 409 : path === "/" ? 200 : 404, path);
          assert.equal(result.headers.get("location"), null);
          assert.match(result.headers.get("cache-control"), /no-store/);
          assert.equal(result.headers.get("set-cookie"), null);
          const text = await result.text();
          assert.doesNotMatch(text, /SYNTHETIC_SECRET/, path + " must not enter the Learning renderer");
          if (method === "GET") assert.match(text, /Choose your Growvelt destination/);
          if (method === "HEAD") assert.equal(text, "");
        }
      }
      for (const path of ["/api", "/api/unknown", "/api/internal/commercial/release-matured", "/api/learning/auth/welcome", "/api/learning/newsletter/subscribe", "/api/payments/paystack/initialize", "/api/payments/paystack/webhook"]) {
        for (const method of ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"]) {
          const result = await request(path + "?token=SYNTHETIC_SECRET", { method, headers: { "x-forwarded-host": "learn.growvelt.com", Authorization: "Bearer synthetic-not-a-token" } });
          assert.equal(result.status, 409, path);
          assert.equal(result.headers.get("location"), null);
          const text = await result.text();
          assert.doesNotMatch(text, /SYNTHETIC_SECRET/);
          if (method === "HEAD") assert.equal(text, ""); else assert.equal(JSON.parse(text).success, false);
        }
      }
      const auth = await request("/auth/callback?code=SYNTHETIC_SECRET");
      assert.equal(auth.status, 200);
      assert.match(await auth.text(), /Restart Careers sign-in/);
      const dashboard = await request("/dashboard");
      assert.equal(dashboard.status, 302);
      assert.equal(dashboard.headers.get("location"), "https://jobs.growvelt.com/dashboard#careers-moved");
      for (const [path, target] of [["/ref/Ab_c-01?code=DISCARD", "/ref/Ab_c-01"], ["/unsubscribe?token=SYNTHETIC_TOKEN&code=DISCARD", "/unsubscribe?token=SYNTHETIC_TOKEN"]]) {
        assert.equal((await request(path)).headers.get("location"), "https://jobs.growvelt.com" + target + "#careers-moved");
      }
      assert.equal((await request("/api/paystack/verify", { method: "POST", body: "SYNTHETIC_UNUSED_REFERENCE" })).status, 409);
      assert.equal((await (await request("/site.webmanifest")).json()).id, "/");
      assert.equal(await (await request("/robots.txt")).text(), "User-agent: *\nDisallow: /\n");
      assert.equal((await request("/logo/growvelt-magenta-email.png")).status, 200);
      const worker = await request("/sw.js");
      assert.equal(worker.status, 200);
      assert.match(worker.headers.get("content-type"), /javascript/);
    } else {
      const headers = { "x-forwarded-host": "www.growvelt.com", forwarded: "host=www.growvelt.com" };
      const root = await request("/", { headers });
      assert.equal(root.status, 200);
      const html = await root.text();
      assert.ok(html.includes('rel="canonical" href="https://learn.growvelt.com"') || html.includes('rel="canonical" href="https://learn.growvelt.com/"'));
      assert.doesNotMatch(html, /Choose your Growvelt destination/);
      const dashboard = await request("/dashboard", { headers });
      assert.equal(dashboard.status, 307);
      assert.equal(new URL(dashboard.headers.get("location"), origin).pathname, "/sign-in");
      const callback = await request("/auth/callback", { headers });
      assert.equal(callback.status, 307);
      assert.equal(new URL(callback.headers.get("location")).pathname, "/auth/error");
      const webhook = await request("/api/payments/paystack/webhook", { method: "POST", body: "{}", headers });
      assert.doesNotMatch(await webhook.text(), /growvelt_handover/);
      const unknown = await request("/unknown", { method: "POST", headers });
      assert.notEqual(unknown.status, 409);
      assert.notEqual((await (await request("/site.webmanifest")).json()).name, "Growvelt Careers — moved");
    }
    console.log("PASS real Next bridge HTTP for trusted fixture host " + hostname + ", bridge " + bridgeEnabled + "; forwarded headers do not select the product");
  } finally {
    server.kill();
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once("exit", resolve); });
  }
}
console.log("PASS optimized bridge build/TypeScript, www unknown/API/bundle containment, Careers compatibility, original learn/www.learn Auth/payment routing (backends disabled)");
