// Original-www compatibility only. No Careers credentials, request-body reads,
// network forwarding, Auth exchanges, shared cookies or provider calls belong here.
import { createHash } from "node:crypto";
import { futureLearningOrigin, getCareersOrigin, getLearningOrigin } from "./site-urls.mjs";

export const careersLegacyPages = [
  "/dashboard", "/dashboard/profile", "/dashboard/settings",
  // Verified shortcuts from Careers' root-scoped installed-app manifest.
  "/jobs", "/career-assistant", "/dashboard/my-jobs", "/dashboard/applications",
  // Public sitemap pages verified against Careers' route contract; Learning
  // has no page/handler at these exact paths.
  "/employers", "/updates", "/get-started",
];
// Syntax check only, not an assertion that the public record exists. Never
// decode arbitrary segments, allow slashes, or include stateful /apply steps.
const publicDetail = /^\/(?:jobs|companies)\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const legacyPosts = ["/api/auth/welcome", "/api/newsletter/subscribe"];
const legacyAuth = ["/auth", "/auth/callback", "/auth/reset", "/auth/forgot-password"];
const pwaPages = ["/pwa/launch.html", "/offline.html"];
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};
const recoveryScript = 'history.replaceState(null,"",location.pathname);if("serviceWorker" in navigator){navigator.serviceWorker.getRegistration("/").then(function(r){if(r)r.update().catch(function(){});}).catch(function(){});}';
const scriptHash = createHash("sha256").update(recoveryScript).digest("base64");

function movedPage(auth = false, path = "/dashboard") {
  // All arguments are internal constants, never URL query parameters or payloads.
  const target = "https://jobs.growvelt.com" + (auth ? "/auth?mode=signin" : path);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Growvelt Careers has moved</title><style>html{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;font:1rem/1.65 system-ui,sans-serif;background:#faf7ff;color:#211333}main{max-width:44rem;margin:10vh auto;padding:clamp(1.25rem,5vw,3rem)}small{color:#7800c8}h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.12}a{display:inline-block;color:#7100ba;overflow-wrap:anywhere}a.primary{padding:.9rem 1.3rem;border-radius:.8rem;background:#8100d4;color:white;text-decoration:none}p{max-width:40rem}@media(prefers-color-scheme:dark){body{background:#160f23;color:#f8f1ff}a,small{color:#d7adff}}</style></head><body><main><small>GROWVELT CAREERS</small><h1>${auth ? "Continue your sign-in on Careers" : "Careers has a new address"}</h1><p>${auth ? "This sign-in or password-reset link was opened at our previous address. For your security, it has not been exchanged or sent to another website. Please sign in again at Growvelt Careers. If you were resetting your password, request a new recovery email from its sign-in screen." : "Jobs, applications and employer tools are now at jobs.growvelt.com. Your Careers account and records stay with Careers. You may need to sign in again."}</p><p><a class="primary" href="${target}" rel="noreferrer">${auth ? "Restart Careers sign-in" : "Open Growvelt Careers"}</a></p><p>If you installed the old Careers app, open the new address in your browser and install Careers again. Remove the old shortcut only after the new app works. The old app cannot change its website address automatically.</p><p>Offline? Reconnect before opening Careers. Devices that missed the update may need to reopen the old app online.</p><p>Looking for courses? <a href="https://learn.growvelt.com/" rel="noreferrer">Open Growvelt Learning</a>.</p></main><script>${recoveryScript}</script></body></html>`;
}

const pageHeaders = {
  ...headers, "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'; connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
};

export function careersTransitionWorker() {
  // Keep this script at the ORIGINAL worker URL indefinitely through grace and
  // rollback. Never unregister root workers or navigate existing Learning tabs.
  return `"use strict";
const legacyPages = ${JSON.stringify([...careersLegacyPages, ...pwaPages])};
const movedHTML = ${JSON.stringify(movedPage())};
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(name => /^growvelt-pwa-v[0-9]+$/.test(name)).map(name => caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET" || event.request.mode !== "navigate" || !legacyPages.includes(url.pathname)) return;
  event.respondWith(Promise.resolve(new Response(movedHTML, {status:200,headers:${JSON.stringify(pageHeaders)}})));
});
self.addEventListener("push", event => event.waitUntil(self.registration.showNotification("Growvelt Careers has moved", {body:"Open Careers at jobs.growvelt.com and sign in to enable notifications there.",tag:"careers-address-update"})));
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("https://jobs.growvelt.com/dashboard"));
});
`;
}

export function careersCompatibilityResponse(request, env) {
  const url = new URL(request.url);
  if (getLearningOrigin(env) !== futureLearningOrigin || url.hostname !== "www.growvelt.com") return null;
  // Validation also prevents accidental configuration of a foreign Careers host.
  getCareersOrigin(env);
  const path = url.pathname;
  const read = request.method === "GET" || request.method === "HEAD";
  const isPage = careersLegacyPages.includes(path) || publicDetail.test(path);
  const isAuth = legacyAuth.includes(path);
  const isPost = legacyPosts.includes(path);
  const isPwa = pwaPages.includes(path) || ["/sw.js", "/manifest.webmanifest", "/site.webmanifest"].includes(path);
  if (!isPage && !isAuth && !isPost && !isPwa) return null;
  const body = value => request.method === "HEAD" ? null : value;
  if (!read || isPost) {
    // Do not parse or replay POST bodies, even for old server actions or fetches.
    return new Response(body(JSON.stringify({ code: "careers_moved", success: false,
      message: "Growvelt Careers has moved. Open jobs.growvelt.com and submit your request again there. This request was not processed or forwarded.",
      retryable: false, careersUrl: "https://jobs.growvelt.com/auth?mode=signin" })), {
      status: read ? 405 : 409, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  }
  // A fixed benign fragment prevents inheriting an old hash token. Next's
  // redirect normalization drops an EMPTY fragment, so '#' alone is unsafe.
  if (isPage) return new Response(null, { status: 302, headers: { ...headers, Location: "https://jobs.growvelt.com" + path + "#careers-moved" } });
  if (path === "/sw.js") return new Response(body(careersTransitionWorker()), { headers: {
    ...headers, "Content-Type": "application/javascript; charset=utf-8", "Service-Worker-Allowed": "/",
  } });
  if (path === "/manifest.webmanifest" || path === "/site.webmanifest") {
    const legacy = path === "/manifest.webmanifest";
    return new Response(body(JSON.stringify({ id: legacy ? "/" : "/learning/", name: legacy ? "Growvelt Careers — moved" : "Growvelt Learning",
      short_name: legacy ? "Careers" : "Learning", start_url: legacy ? "/pwa/launch.html" : "/", scope: "/", display: "standalone",
      icons: [{ src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }],
    })), { headers: { ...headers, "Content-Type": "application/manifest+json" } });
  }
  return new Response(body(movedPage(isAuth)), { headers: pageHeaders });
}
