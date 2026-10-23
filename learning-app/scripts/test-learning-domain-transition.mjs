import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { NextRequest } from "next/server.js";
import * as urls from "../app/lib/site-urls.mjs";
import { careersCompatibilityResponse, learningWwwSafetyBridgeResponse } from "../app/lib/careers-compatibility.mjs";

const require = createRequire(import.meta.url);
const current = {};
const future = { NEXT_PUBLIC_LEARNING_SITE_URL: "https://www.growvelt.com", NEXT_PUBLIC_CAREERS_SITE_URL: "https://jobs.growvelt.com", NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "true" };
function load(relative, mocks = {}, environment = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const moduleValue = { exports: {} };
  vm.runInNewContext(output, {
    module: moduleValue, exports: moduleValue.exports, URL, Request, Response, Headers, Buffer, console,
    process: { env: environment },
    require: name => name in mocks ? mocks[name] : name.endsWith("site-urls.mjs") ? urls : require(name),
  }, { filename: fileURLToPath(new URL(relative, import.meta.url)) });
  return moduleValue.exports;
}

for (const bad of ["https://jobs.growvelt.com", "https://evil.invalid", "http://www.growvelt.com", "https://www.growvelt.com:444", "https://user@www.growvelt.com", "https://www.growvelt.com/path", "https://www.growvelt.com?next=bad"]) {
  assert.throws(() => urls.getLearningOrigin({ NEXT_PUBLIC_LEARNING_SITE_URL: bad }));
}
assert.equal(urls.getLearningOrigin(current), "https://learn.growvelt.com");
assert.equal(urls.getLearningOrigin(future), "https://www.growvelt.com");
assert.throws(() => urls.getCareersOrigin({ NEXT_PUBLIC_LEARNING_SITE_URL: future.NEXT_PUBLIC_LEARNING_SITE_URL, NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: "true" }));
for (const disabled of [undefined, "", "false", "1", "TRUE"]) {
  const preparedOnly = { ...future, NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: disabled };
  assert.equal(urls.getLearningOrigin(preparedOnly), "https://learn.growvelt.com");
  assert.equal(urls.learningPath("/dashboard", preparedOnly), "/dashboard");
  assert.equal(urls.legacyCareersCollision("https://www.growvelt.com/dashboard", "GET", preparedOnly), null);
}
assert.equal(urls.careersAbsoluteUrl("/career-assistant", future), "https://jobs.growvelt.com/career-assistant");
// Deliberately misspelled negative fixtures: never valid Careers destinations.
for (const bad of ["https://jobs.grovelt.com", "https://jobs.grovel.com"]) {
  assert.throws(() => urls.getCareersOrigin({ ...future, NEXT_PUBLIC_CAREERS_SITE_URL: bad }));
  assert.throws(() => urls.learningAuthCallbackUrl(bad, "/dashboard", future));
}
assert.equal(urls.learningAbsoluteUrl("/courses/data%20analysis?x=1#about", future), "https://www.growvelt.com/courses/data%20analysis?x=1#about");
assert.throws(() => urls.learningAbsoluteUrl("//jobs.growvelt.com", future));

const mappings = [
  ["/dashboard", "/learning/dashboard"], ["/dashboard/profile", "/learning/dashboard/profile"],
  ["/dashboard/settings", "/learning/dashboard/settings"], ["/auth/callback", "/auth/learning/callback"],
  ["/api/auth/welcome", "/api/learning/auth/welcome"], ["/api/newsletter/subscribe", "/api/learning/newsletter/subscribe"],
  ["/dashboard/admin/emails", "/learning/dashboard/admin/emails"],
];
for (const [old, alias] of mappings) {
  assert.equal(urls.learningPath(old, current), old);
  assert.equal(urls.learningPath(old + "?next=%2Fteach%2Fapply#section", future), alias + "?next=%2Fteach%2Fapply#section");
  assert.equal(urls.internalLearningPath(alias), old);
}
assert.equal(urls.learningPath("/dashboard/my-learning", future), "/dashboard/my-learning");
assert.equal(urls.learningPath("/dashboard/profiles", future), "/dashboard/profiles");
assert.equal(urls.legacyCareersCollision("https://www.growvelt.com/", "GET", future), null);
assert.equal(urls.legacyCareersCollision("http://www.growvelt.com/auth/callback?code=fake", "GET", future), "auth");
for (const path of ["/auth/callback?code=old-careers-code", "/dashboard", "/dashboard/profile", "/dashboard/settings"]) {
  assert.ok(urls.legacyCareersCollision("https://www.growvelt.com" + path, "GET", future));
  assert.equal(urls.legacyCareersCollision("https://learn.growvelt.com" + path, "GET", future), null);
  assert.equal(urls.legacyCareersCollision("https://www.growvelt.com" + path, "GET", current), null);
}
for (const path of ["/api/auth/welcome", "/api/newsletter/subscribe"]) {
  assert.equal(urls.legacyCareersCollision("https://www.growvelt.com" + path, "POST", future), "post");
  assert.equal(urls.legacyCareersCollision("https://www.growvelt.com" + path, "GET", future), null);
}
for (const env of [current, future]) {
  for (const origin of ["https://learn.growvelt.com", "https://www.learn.growvelt.com"]) {
    const callback = new URL(urls.learningAuthCallbackUrl(origin, "/reset-password", env));
    assert.equal(callback.origin, origin);
    assert.equal(callback.pathname, "/auth/callback");
    assert.equal(callback.searchParams.get("next"), "/reset-password");
  }
}
assert.equal(new URL(urls.learningAuthCallbackUrl("https://www.growvelt.com", "/learning/dashboard", future)).pathname, "/auth/learning/callback");
for (const origin of ["https://jobs.growvelt.com", "https://evil.invalid", "https://learn.growvelt.com.evil.invalid", "https://growvelt-learning-foreign.vercel.app"]) assert.throws(() => urls.learningAuthCallbackUrl(origin, "/dashboard", future));

const { resolvePaystackConfiguration } = load("../app/lib/payments/paystack-config.ts");
const live = { PAYSTACK_MODE: "live", PAYSTACK_LIVE_SECRET_KEY: "sk_live_dummy_not_a_real_key" };
for (const origin of ["https://learn.growvelt.com", "https://www.growvelt.com"]) {
  const value = resolvePaystackConfiguration({ ...live, ...future, PAYSTACK_CALLBACK_URL: origin + "/payments/paystack/callback" });
  assert.equal(value.mode, "live");
  assert.equal(value.checkoutEnabled, false);
  assert.equal(value.liveLearnerCheckoutEnabled, false);
}
assert.throws(() => resolvePaystackConfiguration({ ...live, PAYSTACK_CALLBACK_URL: "https://www.growvelt.com/payments/paystack/callback" }));
const { resolvePaystackCallbackReference } = load("../app/lib/payments/paystack-callback.ts");
for (const type of ["GL", "CP", "GS"]) {
  const reference = type + "-" + "A".repeat(32);
  assert.equal(resolvePaystackCallbackReference({ reference, trxref: reference }), reference);
  assert.equal(resolvePaystackCallbackReference({ reference, trxref: type + "-" + "B".repeat(32) }), null);
}
for (const bad of ["https://jobs.growvelt.com/payments/paystack/callback", "https://www.growvelt.com:444/payments/paystack/callback", "http://www.growvelt.com/payments/paystack/callback", "https://user@www.growvelt.com/payments/paystack/callback", "https://www.growvelt.com/payments/paystack/callback#token", "https://www.growvelt.com/api/payments/paystack/webhook"]) {
  assert.throws(() => resolvePaystackConfiguration({ ...live, ...future, PAYSTACK_CALLBACK_URL: bad }));
}

const boundUrls = Object.fromEntries(Object.entries(urls).map(([key, value]) => [key,
  ["learningPath", "getLearningOrigin", "getCareersOrigin", "learningAbsoluteUrl", "careersAbsoluteUrl", "legacyCareersCollision"].includes(key)
    ? (...args) => value(...args, future) : value]));
const redirect = load("../app/lib/auth/redirect.ts", { "../site-urls.mjs": boundUrls });
assert.equal(redirect.getSafeNextPath("/dashboard/profile?tab=details"), "/learning/dashboard/profile?tab=details");
assert.equal(redirect.getSafeNextPath("/learning/dashboard"), "/learning/dashboard");
assert.equal(redirect.getSafeNextPath("/dashboard/admin/emails"), "/learning/dashboard/admin/emails");
assert.equal(redirect.getSafeNextPath("/learning/dashboard/admin/emails"), "/learning/dashboard/admin/emails");
assert.equal(redirect.getSafeNextPath("https://jobs.growvelt.com/dashboard"), "/learning/dashboard");
for (const bad of ["//jobs.growvelt.com/dashboard", "/learning/dashboard/../../api/auth/welcome", "%2F%2Fjobs.growvelt.com", "/learning/dashboard/unknown", "/learning/dashboard\\evil"]) {
  assert.equal(redirect.getSafeNextPath(bad), "/learning/dashboard");
}
const link = load("../app/components/learning-link.tsx", {
  "@/app/lib/site-urls.mjs": boundUrls,
  "next/link": { __esModule: true, default: ({ href, children }) => React.createElement("a", { href: typeof href === "string" ? href : href.pathname }, children) },
}).default;
assert.ok(renderToStaticMarkup(React.createElement(link, { href: "/dashboard/profile?tab=details" }, "Profile")).includes('href="/learning/dashboard/profile?tab=details"'));
assert.ok(renderToStaticMarkup(React.createElement(link, { href: "/dashboard/admin/emails" }, "Email Center")).includes('href="/learning/dashboard/admin/emails"'));

// Exercise the real proxy with synthetic requests and a fake Auth client; no network.
let clientCalls = 0;
const proxyMocks = {
  "@/app/lib/careers-compatibility.mjs": { learningWwwSafetyBridgeResponse: request => learningWwwSafetyBridgeResponse(request, future), careersCompatibilityResponse: request => careersCompatibilityResponse(request, future) },
  "@/app/lib/site-urls.mjs": boundUrls,
  "@/app/lib/auth/redirect": redirect,
  "@supabase/ssr": { createServerClient: (_url, _key, options) => {
    clientCalls++;
    return { auth: { getClaims: async () => {
      options.cookies.setAll([{ name: "sb-learning-fake", value: "fake-session", options: { path: "/", sameSite: "lax" } }]);
      return { data: { claims: { sub: "fake-user" } }, error: null };
    } } };
  } },
};
const { proxy, config } = load("../proxy.ts", proxyMocks, { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "dummy-local-test-only" });
for (const [path, method] of [["/dashboard", "GET"], ["/dashboard/profile", "GET"], ["/dashboard/settings", "GET"], ["/auth/callback?code=fake", "GET"], ["/api/auth/welcome", "POST"], ["/api/newsletter/subscribe", "POST"]]) {
  const before = clientCalls;
  const response = await proxy(new NextRequest("https://www.growvelt.com" + path, { method }));
  assert.equal(response.status, path.startsWith("/dashboard") ? 302 : method === "POST" ? 409 : 200);
  assert.equal(response.headers.get("location"), path.startsWith("/dashboard") ? "https://jobs.growvelt.com" + path + "#careers-moved" : null);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(clientCalls, before, "collision must be rejected before any Learning Auth/database work");
}
for (const [old, alias] of [...mappings.slice(0, 3), mappings.at(-1)]) {
  const response = await proxy(new NextRequest("https://www.growvelt.com" + alias + "?tab=details"));
  assert.equal(response.headers.get("x-middleware-rewrite"), "https://www.growvelt.com" + old + "?tab=details");
  assert.match(response.headers.get("set-cookie"), /sb-learning-fake=fake-session/);
  assert.doesNotMatch(response.headers.get("set-cookie"), /domain=/i);
}
const legacyEmailCenter = await proxy(new NextRequest("https://www.growvelt.com/dashboard/admin/emails"));
assert.equal(legacyEmailCenter.headers.get("location"), "https://jobs.growvelt.com/dashboard/admin/emails#careers-moved");
const learnEmailCenter = await proxy(new NextRequest("https://learn.growvelt.com/dashboard/admin/emails"));
assert.equal(learnEmailCenter.headers.get("x-middleware-next"), "1");
const oldAuth = await proxy(new NextRequest("https://learn.growvelt.com/auth/callback?code=fake"));
assert.equal(oldAuth.headers.get("x-middleware-next"), "1");
assert.ok(config.matcher.includes("/learning/dashboard/:path*"));

let exchanges = 0;
const signInEvents = [];
const authHandler = load("../app/auth/callback/route.ts", {
  "@/app/lib/auth/login-activity": {
    recordLearningSignIn: async (user, headers, timestamp) => {
      signInEvents.push({ userId: user.id, timestamp, hasHeaders: headers instanceof Headers });
    },
  },
  "@/app/lib/auth/redirect": redirect,
  "@/app/lib/supabase/logging": { logSupabaseError() {} },
  "@/app/lib/supabase/auth-callback": {
    preventAuthRedirectCaching(response) { response.headers.set("cache-control", "private, no-store"); return response; },
    createAuthCallbackClient(request, response) {
      assert.ok(["learn.growvelt.com", "www.growvelt.com"].includes(new URL(request.url).hostname));
      return { auth: { exchangeCodeForSession: async code => {
        assert.equal(code, "fake-once-only-code"); exchanges++;
        response.cookies.set("sb-learning-fake", "same-origin-session", { path: "/", sameSite: "lax" });
        return { data: { session: { user: { id: "fake-user" } } }, error: null };
      } } };
    },
  },
});
for (const [origin, path] of [["https://learn.growvelt.com", "/auth/callback"], ["https://www.growvelt.com", "/auth/learning/callback"]]) {
  const response = await authHandler.GET(new NextRequest(origin + path + "?code=fake-once-only-code&next=%2Fdashboard"));
  assert.equal(response.headers.get("location"), origin + "/learning/dashboard");
  assert.match(response.headers.get("set-cookie"), /same-origin-session/);
  assert.match(response.headers.get("cache-control"), /no-store/);
}
assert.equal(exchanges, 2);
assert.equal(signInEvents.length, 2, "both Learning callback hosts record fresh sign-in activity");
assert.ok(signInEvents.every(event => event.userId === "fake-user"));
assert.ok(signInEvents.every(event => event.hasHeaders && Number.isFinite(Date.parse(event.timestamp))));

// Render the actual app email template without server-only effects or sending email.
const template = load("../app/lib/email/growvelt-email-template.ts", { "server-only": {}, "../site-urls.mjs": boundUrls, "./email-markdown": load("../app/lib/email/email-markdown.ts") });
const html = template.renderGrowveltEmail({ greeting: "Test <person>", title: "Account", paragraphs: ["Example"], reason: "Test only", baseUrl: "https://evil.invalid" });
assert.ok(html.includes("https://www.growvelt.com/logo/growvelt-wordmark-purple-20261019.png"));
assert.ok(html.includes("https://www.growvelt.com/privacy-policy"));
assert.ok(!html.includes("https://evil.invalid"));
assert.ok(html.includes("Test &lt;person&gt;"));
const robots = load("../app/robots.ts", { "@/app/lib/seo": { absoluteLearningUrl: value => urls.learningAbsoluteUrl(value, future) } }).default();
assert.equal(robots.sitemap, "https://www.growvelt.com/sitemap.xml");
assert.ok(robots.rules.disallow.includes("/learning/dashboard/"));
const root = fileURLToPath(new URL("../", import.meta.url));
// Approved branding may change presentation; authentication content and links
// must still match the fixed pre-transition release.
function emailContent(template) {
  return template.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1]
    .replace(/\s(?:style|bgcolor)="[^"]*"/g, "")
    .replace(/growvelt-(?:magenta-email|wordmark-purple-20261019)\.png/g, "approved-logo.png")
    .replace(/width="(?:116|124)" alt="Growvelt"/g, 'alt="Growvelt"');
}
for (const name of readdirSync(new URL("../supabase/email-templates/", import.meta.url)).filter(name => name.endsWith(".html"))) {
  const currentTemplate = readFileSync(new URL(`../supabase/email-templates/${name}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
  // Fixed pre-transition release, not HEAD: this protection must still work
  // after the preparation itself is committed and deployed.
  const originalTemplate = execFileSync("git", ["show", `35021b7:learning-app/supabase/email-templates/${name}`], { cwd: root, encoding: "utf8" }).replaceAll("\r\n", "\n");
  assert.equal(emailContent(currentTemplate), emailContent(originalTemplate.replaceAll("https://learn.growvelt.com", "{{ .SiteURL }}")), `${name}: preserve all authentication variables, content and links`);
}
console.log("PASS Learning domain transition: strict origins, exact collisions, alias protection/cookies, original-origin PKCE, payment guards, email and robots (no hosted writes)");
