// Synthetic requests + actual transpiled proxy with throw-on-side-effect doubles.
// No hosted backend, provider, browser profile or configuration writes.
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { AsyncLocalStorage } from "node:async_hooks";
import * as compatibility from "../app/lib/careers-compatibility.mjs";
import { internalLearningPath, legacyLearningPageRedirect, getLearningOrigin, getCareersOrigin } from "../app/lib/site-urls.mjs";
// Standalone Node tests lack Next's usual runtime global initialization.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
const nextTesting = (await import("next/experimental/testing/server.js")).default;
// Installed builds may retain the old utility export despite the proxy rename.
const doesProxyMatch = nextTesting.unstable_doesProxyMatch ?? nextTesting.unstable_doesMiddlewareMatch;
assert.equal(typeof doesProxyMatch, "function");
const { learningWwwSafetyBridgeResponse: bridge, careersCompatibilityResponse: careers } = compatibility;
const legacy = { NEXT_PUBLIC_LEARNING_SITE_URL: "https://learn.growvelt.com", NEXT_PUBLIC_CAREERS_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "false" };
const enabled = { ...legacy, LEARNING_WWW_SAFETY_BRIDGE_ENABLED: "true" };
const future = { NEXT_PUBLIC_LEARNING_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_CAREERS_SITE_URL: "https://jobs.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "true", LEARNING_WWW_SAFETY_BRIDGE_ENABLED: "true" };
const www = "https://www.growvelt.com";
const bridgeWithJobsLinks = { ...enabled, NEXT_PUBLIC_CAREERS_SITE_URL: "https://jobs.growvelt.com" };
assert.equal(getLearningOrigin(bridgeWithJobsLinks), "https://learn.growvelt.com");
assert.equal(getCareersOrigin(bridgeWithJobsLinks), "https://jobs.growvelt.com");
assert.equal(bridge(new Request(www + "/auth/learning/callback"), bridgeWithJobsLinks).status, 404);
function request(path, method = "GET", origin = www) {
  const req = new Request(origin + path, { method });
  for (const name of ["text", "json", "arrayBuffer", "formData"]) Object.defineProperty(req, name, { value() { assert.fail("bridge read a body"); } });
  for (const name of ["cookies", "headers", "nextUrl"]) Object.defineProperty(req, name, { get() { assert.fail("bridge must not trust headers/cookies or enter normal proxy processing"); } });
  return req;
}
const fallbackPaths = ["/", "/unknown", "/auth/learning/callback", "/sign-in", "/sign-up", "/reset-password", "/learning/dashboard", "/payments/paystack/callback", "/api", "/api/unknown", "/api/internal/commercial/release-matured", "/api/payments/paystack/initialize", "/api/payments/paystack/webhook", "/api/learning/auth/welcome", "/api/learning/newsletter/subscribe", "/_next/static/not-a-bundle.js", "/logo/unknown.png", "/sitemap.xml"];
const oldPaths = ["/auth/callback", "/auth/reset", "/dashboard", "/jobs/job_1/apply/questions", "/api/paystack/verify", "/api/auth/welcome", "/api/newsletter/subscribe", "/sw.js", "/pwa/launch.html"];
for (const env of [undefined, {}, legacy, { ...enabled, LEARNING_WWW_SAFETY_BRIDGE_ENABLED: "false" }, { ...enabled, LEARNING_WWW_SAFETY_BRIDGE_ENABLED: "TRUE" }]) {
  for (const path of [...fallbackPaths, ...oldPaths]) assert.equal(bridge(request(path), env), null, "bridge defaults OFF");
}
for (const host of ["learn.growvelt.com", "www.learn.growvelt.com", "jobs.growvelt.com", "growvelt.com", "www.growvelt.com.evil.invalid", "evil.invalid", "localhost"]) {
  for (const path of [...fallbackPaths, ...oldPaths]) assert.equal(bridge(request(path, "POST", "https://" + host), enabled), null, "no non-www interception");
}
for (const path of fallbackPaths) for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "BREW"]) {
  const result = bridge(request(path + "?code=SYNTHETIC_SECRET&reference=SYNTHETIC_SECRET#access_token=SYNTHETIC_SECRET", method), enabled);
  const api = path === "/api" || path.startsWith("/api/");
  const read = method === "GET" || method === "HEAD";
  assert.equal(result.status, !read || api ? 409 : path === "/" ? 200 : 404);
  assert.equal(result.headers.get("location"), null);
  assert.equal(result.headers.get("set-cookie"), null);
  assert.equal(result.headers.get("access-control-allow-origin"), null);
  assert.match(result.headers.get("cache-control"), /no-store/);
  assert.equal(result.headers.get("referrer-policy"), "no-referrer");
  assert.match(result.headers.get("x-robots-tag"), /noindex/);
  const body = await result.text();
  assert.doesNotMatch(body, /SYNTHETIC_SECRET/);
  if (method === "HEAD") assert.equal(body, "");
  else if (!read || api) { const json = JSON.parse(body); assert.equal(json.success, false); assert.equal(json.retryable, false); assert.match(json.message, /Do not pay again/); }
  else { assert.match(body, /Choose your Growvelt destination/); assert.match(body, /do not pay again/); }
}
for (const path of oldPaths) for (const method of ["GET", "HEAD", "POST"]) assert.ok(bridge(request(path, method), enabled), "known legacy routes also intercepted while public cutover OFF");
for (const [path, target] of [["/ref/Ab_c-01?code=DISCARD", "/ref/Ab_c-01"], ["/unsubscribe?token=SYNTHETIC_TOKEN&code=DISCARD", "/unsubscribe?token=SYNTHETIC_TOKEN"]]) {
  assert.equal(bridge(request(path), enabled).headers.get("location"), "https://jobs.growvelt.com" + target + "#careers-moved");
}
assert.equal(await bridge(request("/robots.txt"), enabled).text(), "User-agent: *\nDisallow: /\n");
assert.equal((await bridge(request("/site.webmanifest"), enabled).json()).id, "/", "no premature Learning PWA identity in bridge mode");
for (const path of ["/logo/growvelt-magenta-email.png", "/favicon.ico", "/apple-touch-icon.png"]) {
  assert.equal(bridge(request(path), enabled), null, "reviewed public asset pass-through only");
  assert.equal(bridge(request(path, "POST"), enabled).status, 409);
}
for (const env of [
  { ...enabled, NEXT_PUBLIC_LEARNING_SITE_URL: "https://evil.invalid" },
  { ...enabled, NEXT_PUBLIC_LEARNING_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "true", NEXT_PUBLIC_CAREERS_SITE_URL: "https://www.growvelt.com" },
  { ...enabled, NEXT_PUBLIC_LEARNING_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "false" },
]) assert.equal(bridge(request("/auth/learning/callback?code=DISCARD"), env).status, 404, "invalid/incomplete future config fails closed");
for (const path of [...fallbackPaths, ...oldPaths]) assert.equal(bridge(request(path), future), null, "fully enabled valid future mode uses normal Learning + reviewed compatibility");
assert.equal(careers(request("/dashboard"), future).status, 302);
assert.equal(careers(request("/learning/dashboard"), future), null);

const source = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function proxyHarness(env, allowNormal = false) {
  const calls = { backend: 0, normal: 0, redirects: 0 };
  const withCookies = response => { response.cookies = { getAll: () => [], set() {} }; return response; };
  const exports = {};
  const require = name => {
    if (name === "@supabase/ssr") return { createServerClient() { calls.backend++; assert.ok(allowNormal, "bridge initialized Learning Auth/DB"); return { auth: { getClaims: async () => ({ data: null, error: null }) } }; } };
    if (name === "next/server") return { NextResponse: {
      next() { calls.normal++; assert.ok(allowNormal, "bridge fell through to app/API/provider handler"); return withCookies(new Response(null, { headers: { "x-fixture-next": "1" } })); },
      rewrite() { calls.normal++; assert.ok(allowNormal); return withCookies(new Response(null)); },
      redirect(url) { calls.redirects++; assert.ok(allowNormal); return withCookies(new Response(null, { status: 307, headers: { location: url.href } })); },
    } };
    if (name === "@/app/lib/careers-compatibility.mjs") return {
      learningWwwSafetyBridgeResponse: req => bridge(req, env), careersCompatibilityResponse: req => careers(req, env),
    };
    if (name === "@/app/lib/site-urls.mjs") return {
      internalLearningPath,
      legacyLearningPageRedirect: (url, method, accept) => legacyLearningPageRedirect(url, method, accept, env),
    };
    if (name === "@/app/lib/auth/redirect") return { getSafeNextPath: value => value, getExplicitSafeNextPath: () => null, defaultAuthenticatedPath: "/dashboard" };
    throw new Error("Unexpected proxy dependency: " + name);
  };
  vm.runInNewContext(compiled, { exports, require, process: { env: { ...env, NEXT_PUBLIC_SUPABASE_URL: "https://backend.invalid", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-not-a-key" } }, URL, Response });
  return { ...exports, calls };
}
const guarded = proxyHarness(enabled);
for (const path of [...fallbackPaths, ...oldPaths]) for (const method of ["GET", "HEAD", "POST"]) await guarded.proxy(request(path, method));
assert.deepEqual(guarded.calls, { backend: 0, normal: 0, redirects: 0 });
const wwwHostMatcher = guarded.config.matcher.find(value => typeof value === "object" && value.has?.some(condition => condition.type === "host" && condition.value.includes("www")));
const learnHostMatcher = guarded.config.matcher.find(value => typeof value === "object" && value.has?.some(condition => condition.type === "host" && condition.value.includes("learn")));
assert.equal(wwwHostMatcher.source, "/:path*");
assert.deepEqual(JSON.parse(JSON.stringify(wwwHostMatcher.has)), [{ type: "host", value: "www\\.growvelt\\.com" }]);
assert.deepEqual(JSON.parse(JSON.stringify(learnHostMatcher.has)), [{ type: "host", value: "learn\\.growvelt\\.com" }]);
for (const path of fallbackPaths) assert.equal(doesProxyMatch({ config: guarded.config, nextConfig: {}, url: www + path }), true, "actual Next matcher must cover every www path");
for (const host of ["www.learn.growvelt.com", "www.growvelt.com.evil.invalid", "evil.invalid"]) {
  assert.equal(doesProxyMatch({ config: guarded.config, nextConfig: {}, url: "https://" + host + "/unknown", headers: { "x-forwarded-host": "www.growvelt.com" } }), false);
}
assert.equal(doesProxyMatch({ config: guarded.config, nextConfig: {}, url: "https://learn.growvelt.com/unknown", headers: { "x-forwarded-host": "www.growvelt.com" } }), true, "redirect matcher covers exact Learn host");
// Untrusted forwarded/Host header values never turn a trusted learn URL into www.
for (const spoof of ["www.growvelt.com", "www.growvelt.com, learn.growvelt.com", "evil.invalid"]) {
  const req = new Request("https://learn.growvelt.com/", { headers: { host: spoof, "x-forwarded-host": spoof, forwarded: "host=" + spoof } });
  assert.equal(bridge(req, enabled), null);
}
const normal = proxyHarness(enabled, true);
const learn = new Request("https://learn.growvelt.com/dashboard", { headers: { "x-forwarded-host": "www.growvelt.com" } });
Object.defineProperty(learn, "nextUrl", { value: new URL(learn.url) });
const signedOut = await normal.proxy(learn);
assert.equal(signedOut.status, 307);
assert.equal(new URL(signedOut.headers.get("location")).origin, "https://learn.growvelt.com");
assert.equal(normal.calls.backend, 1, "learn retains its own normal authentication path");
console.log("PASS safety bridge OFF/bridge/future matrix, exact trusted-URL host and forged-header isolation, catch-all coverage, zero Auth/DB/provider fall-through, learn preservation (synthetic only)");
