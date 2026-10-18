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
// Finite inventory from Careers' app router; never a dashboard/assistant wildcard.
export const careersPrivatePages = [
  "/dashboard/saved", "/dashboard/pricing", "/dashboard/recruiter/pricing",
  "/dashboard/post-job", "/dashboard/post-job/preview", "/dashboard/jobs",
  "/dashboard/employer-verification", "/dashboard/ambassador", "/dashboard/alerts",
  ...["updates", "support", "growth", "employer-verifications", "emails", "ambassadors"].map(page => "/dashboard/admin/" + page),
  ...["", "/saved-reports", "/resume", "/job-match", "/interview", "/cover-letter"].map(page => "/career-assistant/job-seeker" + page),
  ...["", "/saved-outputs", "/job-description", "/interview-builder", "/candidate-screening", "/bias-evaluation"].map(page => "/career-assistant/employer" + page),
];
const safeSegment = "[A-Za-z0-9][A-Za-z0-9_-]{0,127}";
const privateDetail = new RegExp("^/(?:candidates/|dashboard/my-jobs/jobs/)" + safeSegment + "$");
const applicationStep = new RegExp("^/jobs/(" + safeSegment + ")/apply(?:/(?:preview|questions|success))?$");
const referral = /^\/ref\/([A-Za-z0-9_-]{1,128})$/;
const restartDestinations = {
  "/get-started/results": "/get-started",
  "/dashboard/post-job/preview": "/dashboard/post-job",
  "/post-job/success": "/dashboard/my-jobs",
};
const unsubscribePages = ["/unsubscribe", "/alerts/unsubscribe"];
// Syntax check only, not an assertion that the public record exists. Never
// decode arbitrary segments, allow slashes, or include stateful /apply steps.
const publicDetail = /^\/(?:jobs|companies)\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const legacyPosts = ["/api/auth/welcome", "/api/newsletter/subscribe", "/api/unsubscribe", "/api/alerts/unsubscribe", "/api/paystack/verify"];
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
  // Arguments are internal constants or bounded validated path captures, never
  // arbitrary query parameters, unsubscribe selectors or request payloads.
  const target = "https://jobs.growvelt.com" + (auth ? "/auth?mode=signin" : path);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Growvelt Careers has moved</title><style>html{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;font:1rem/1.65 system-ui,sans-serif;background:#faf7ff;color:#211333}main{max-width:44rem;margin:10vh auto;padding:clamp(1.25rem,5vw,3rem)}small{color:#7800c8}h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.12}a{display:inline-block;color:#7100ba;overflow-wrap:anywhere}a.primary{padding:.9rem 1.3rem;border-radius:.8rem;background:#8100d4;color:white;text-decoration:none}p{max-width:40rem}@media(prefers-color-scheme:dark){body{background:#160f23;color:#f8f1ff}a,small{color:#d7adff}}</style></head><body><main><small>GROWVELT CAREERS</small><h1>${auth ? "Continue your sign-in on Careers" : "Careers has a new address"}</h1><p>${auth ? "This sign-in or password-reset link was opened at our previous address. For your security, it has not been exchanged or sent to another website. Please sign in again at Growvelt Careers. If you were resetting your password, request a new recovery email from its sign-in screen." : "Jobs, applications and employer tools are now at jobs.growvelt.com. Your Careers account and records stay with Careers. You may need to sign in again."}</p><p><a class="primary" href="${target}" rel="noreferrer">${auth ? "Restart Careers sign-in" : "Open Growvelt Careers"}</a></p><p>If you installed the old Careers app, open the new address in your browser and install Careers again. Remove the old shortcut only after the new app works. The old app cannot change its website address automatically.</p><p>Offline? Reconnect before opening Careers. Devices that missed the update may need to reopen the old app online.</p><p>Looking for courses? <a href="https://learn.growvelt.com/" rel="noreferrer">Open Growvelt Learning</a>.</p></main><script>${recoveryScript}</script></body></html>`;
}

function applicationRestartPage(jobId) {
  // jobId is a bounded regex capture, not decoded or interpolated query data.
  return movedPage(false, "/jobs/" + jobId + "#careers-moved")
    .replace("Careers has a new address</h1>", "Continue your application on Careers</h1>")
    .replace("Jobs, applications and employer tools are now at jobs.growvelt.com. Your Careers account and records stay with Careers. You may need to sign in again.", "This application link uses our previous address. Open the job on Careers and sign in there. Answers from this page have not been transferred or submitted. If you already submitted, check your Careers applications before starting again.")
    .replace(">Open Growvelt Careers</a>", '>Open job on Careers</a></p><p><a href="https://jobs.growvelt.com/dashboard/applications#careers-moved" rel="noreferrer">Check submitted applications</a>');
}

function validEmail(value) {
  if (value.length > 254 || !/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/.test(value)) return false;
  const [local, domain] = value.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..")
    && domain.includes(".") && domain.split(".").every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label));
}

function unsubscribeDestination(url) {
  // Narrow, reviewed exception for historic unsubscribe selectors, NOT Auth
  // codes/session tokens. Never log, fetch, process, or echo a selector in HTML.
  const tokens = url.searchParams.getAll("token");
  const emails = url.searchParams.getAll("email");
  if (tokens.length + emails.length !== 1) return null;
  const key = tokens.length ? "token" : "email";
  const value = (tokens.length ? tokens : emails)[0];
  if (key === "token" ? !/^[A-Za-z0-9_-]{1,256}$/.test(value) : url.pathname !== "/unsubscribe" || !validEmail(value)) return null;
  const target = new URL(url.pathname, "https://jobs.growvelt.com");
  target.searchParams.set(key, value);
  target.hash = "careers-moved";
  return target.href;
}

function unsubscribeGuidance() {
  return movedPage(false, "/dashboard/alerts#careers-moved")
    .replace("Careers has a new address</h1>", "Manage your Careers email preferences</h1>")
    .replace("Jobs, applications and employer tools are now at jobs.growvelt.com. Your Careers account and records stay with Careers. You may need to sign in again.", "This email-preference link is incomplete or invalid. No unsubscribe request was processed here. Open your Careers alert settings or contact Careers support for help.")
    .replace(">Open Growvelt Careers</a>", ">Open Careers alert settings</a>");
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
  return legacyCareersResponse(request, url, false);
}

// Shared finite routing policy; callers must establish the explicit host/mode.
// The bridge does not forge future public URL settings to reuse this handler.
function legacyCareersResponse(request, url, bridge) {
  const path = url.pathname;
  const read = request.method === "GET" || request.method === "HEAD";
  const isPage = careersLegacyPages.includes(path) || careersPrivatePages.includes(path) || publicDetail.test(path) || privateDetail.test(path);
  const application = path.match(applicationStep);
  const referralMatch = path.match(referral);
  const restart = Object.hasOwn(restartDestinations, path) ? restartDestinations[path] : null;
  const isUnsubscribe = unsubscribePages.includes(path);
  const isUnsubscribeSuccess = path === "/unsubscribe-success";
  const isAuth = legacyAuth.includes(path);
  const isPost = legacyPosts.includes(path);
  const isPwa = pwaPages.includes(path) || ["/sw.js", "/manifest.webmanifest", "/site.webmanifest"].includes(path);
  if (!isPage && !application && !referralMatch && !restart && !isUnsubscribe && !isUnsubscribeSuccess && !isAuth && !isPost && !isPwa) return null;
  const body = value => request.method === "HEAD" ? null : value;
  if (!read || isPost) {
    // Do not parse or replay POST bodies, even for old server actions or fetches.
    return new Response(body(JSON.stringify({ code: "careers_moved", success: false,
      message: path === "/api/paystack/verify"
        ? "This payment verification request was not processed or forwarded. Do not pay again. Sign in at jobs.growvelt.com and contact Careers support with your original receipt/reference if you paid."
        : "Growvelt Careers has moved. Open jobs.growvelt.com and submit your request again there. This request was not processed or forwarded.",
      retryable: false, careersUrl: "https://jobs.growvelt.com/auth?mode=signin" })), {
      status: read ? 405 : 409, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  }
  // A fixed benign fragment prevents inheriting an old hash token. Next's
  // redirect normalization drops an EMPTY fragment, so '#' alone is unsafe.
  if (isUnsubscribe) {
    const target = unsubscribeDestination(url);
    return target ? new Response(null, { status: 302, headers: { ...headers, Location: target } })
      : new Response(body(unsubscribeGuidance()), { headers: pageHeaders });
  }
  if (isPage || referralMatch || restart || isUnsubscribeSuccess) return new Response(null, { status: 302, headers: { ...headers, Location: "https://jobs.growvelt.com" + (restart || path) + "#careers-moved" } });
  if (application) return new Response(body(applicationRestartPage(application[1])), { headers: pageHeaders });
  if (path === "/sw.js") return new Response(body(careersTransitionWorker()), { headers: {
    ...headers, "Content-Type": "application/javascript; charset=utf-8", "Service-Worker-Allowed": "/",
  } });
  if (path === "/manifest.webmanifest" || path === "/site.webmanifest") {
    const legacy = bridge || path === "/manifest.webmanifest";
    return new Response(body(JSON.stringify({ id: legacy ? "/" : "/learning/", name: legacy ? "Growvelt Careers — moved" : "Growvelt Learning",
      short_name: legacy ? "Careers" : "Learning", start_url: legacy ? "/pwa/launch.html" : "/", scope: "/", display: "standalone",
      icons: [{ src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }],
    })), { headers: { ...headers, "Content-Type": "application/manifest+json" } });
  }
  return new Response(body(movedPage(isAuth)), { headers: pageHeaders });
}

const bridgeAssets = new Set([
  "/logo/growvelt-magenta-email.png", "/favicon.ico", "/favicon-16x16.png",
  "/favicon-32x32.png", "/android-chrome-192x192.png", "/android-chrome-512x512.png",
  "/apple-touch-icon.png",
]);

function bridgePage() {
  return movedPage()
    .replace("<small>GROWVELT CAREERS</small>", "<small>GROWVELT</small>")
    .replace("Careers has a new address</h1>", "Choose your Growvelt destination</h1>")
    .replace("Jobs, applications and employer tools are now at jobs.growvelt.com. Your Careers account and records stay with Careers. You may need to sign in again.", "Our web addresses are being updated. No account, form or payment action was processed on this page. Open Careers for jobs or Learning for courses using the links below. If you already paid, do not pay again; contact the relevant product support with your original receipt/reference.");
}

export function learningWwwSafetyBridgeResponse(request, env) {
  const url = new URL(request.url);
  // Only the platform-provided request URL is consulted. Never promote a Host,
  // Forwarded or X-Forwarded-Host header into cross-product routing authority.
  if (url.hostname !== "www.growvelt.com" || (env ?? process.env).LEARNING_WWW_SAFETY_BRIDGE_ENABLED !== "true") return null;
  let futureReady = false;
  try {
    futureReady = getLearningOrigin(env) === futureLearningOrigin && getCareersOrigin(env) === "https://jobs.growvelt.com";
  } catch {
    // Invalid/missing future configuration cannot fall into Learning handlers.
  }
  if (futureReady) return null;
  const legacy = legacyCareersResponse(request, url, true);
  if (legacy) return legacy;
  const read = request.method === "GET" || request.method === "HEAD";
  const body = value => request.method === "HEAD" ? null : value;
  // This small static allowlist contains public branding only, not app bundles,
  // broad /logo or /api prefixes. Unsafe methods never pass through.
  if (read && bridgeAssets.has(url.pathname)) return null;
  if (!read || url.pathname === "/api" || url.pathname.startsWith("/api/")) return new Response(body(JSON.stringify({
    code: "growvelt_handover", success: false, retryable: false,
    message: "No account, form or payment action was processed or forwarded. Do not pay again if you paid. Open the appropriate product and contact its support with your original receipt/reference.",
    learningUrl: "https://learn.growvelt.com/", careersUrl: "https://jobs.growvelt.com/",
  })), { status: 409, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
  if (url.pathname === "/robots.txt") return new Response(body("User-agent: *\nDisallow: /\n"), { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(body(bridgePage()), { status: url.pathname === "/" ? 200 : 404, headers: pageHeaders });
}
