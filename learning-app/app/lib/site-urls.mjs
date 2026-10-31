// Explicit build-time configuration; defaults preserve the current Learning site.
export const legacyLearningOrigin = "https://learn.growvelt.com";
export const futureLearningOrigin = "https://www.growvelt.com";
const aliases = {
  "/dashboard": "/learning/dashboard",
  "/dashboard/profile": "/learning/dashboard/profile",
  "/dashboard/settings": "/learning/dashboard/settings",
  "/dashboard/admin/emails": "/learning/dashboard/admin/emails",
  "/auth/callback": "/auth/learning/callback",
  "/api/auth/welcome": "/api/learning/auth/welcome",
  "/api/newsletter/subscribe": "/api/learning/newsletter/subscribe",
};

function environment() {
  return {
    NEXT_PUBLIC_LEARNING_SITE_URL: process.env.NEXT_PUBLIC_LEARNING_SITE_URL,
    NEXT_PUBLIC_CAREERS_SITE_URL: process.env.NEXT_PUBLIC_CAREERS_SITE_URL,
    NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED: process.env.NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED,
    LEARNING_LEGACY_PAGE_REDIRECT_ENABLED: process.env.LEARNING_LEGACY_PAGE_REDIRECT_ENABLED,
  };
}

function exactOrigin(value, allowed) {
  const parsed = new URL(value);
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash
    || !allowed.includes(parsed.origin)) throw new Error("Unapproved Growvelt site origin.");
  return parsed.origin;
}

export function getLearningOrigin(env = environment()) {
  const selected = exactOrigin(env.NEXT_PUBLIC_LEARNING_SITE_URL?.trim() || legacyLearningOrigin,
    [legacyLearningOrigin, futureLearningOrigin]);
  // Preparation may be deployed safely before domain/settings handover. Merely
  // preconfiguring a future URL must not activate it in this release.
  return selected === futureLearningOrigin && env.NEXT_PUBLIC_LEARNING_DOMAIN_CUTOVER_ENABLED !== "true"
    ? legacyLearningOrigin : selected;
}

export function getCareersOrigin(env = environment()) {
  const origin = exactOrigin(env.NEXT_PUBLIC_CAREERS_SITE_URL?.trim() || futureLearningOrigin,
    ["https://growvelt.com", futureLearningOrigin, "https://jobs.growvelt.com"]);
  if (getLearningOrigin(env) === futureLearningOrigin && origin !== "https://jobs.growvelt.com") {
    throw new Error("The Growvelt cutover requires the explicit jobs.growvelt.com Careers origin.");
  }
  return origin;
}

const legacyLearningRedirectExemptPrefixes = [
  "/api", "/auth", "/payments", "/dashboard", "/learning/dashboard", "/settings",
  "/teach", "/instructor", "/admin", "/sign-in", "/sign-up", "/reset-password",
  "/forgot-password", "/check-email", "/unsubscribe", "/alerts/unsubscribe", "/ref",
  "/pwa", "/_next", "/.well-known",
];
const legacyLearningRedirectExemptPaths = new Set([
  "/sw.js", "/site.webmanifest", "/manifest.webmanifest", "/offline.html",
]);

function isPathFamily(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Return a temporary www destination for public document requests only.
 * A separate server-only flag is required in addition to the coordinated
 * host cutover, leaving Learn unchanged when this code is deployed dormant.
 */
export function legacyLearningPageRedirect(requestUrl, method, accept, env = environment(), requestHost = null) {
  if (env.LEARNING_LEGACY_PAGE_REDIRECT_ENABLED !== "true") return null;

  let request;
  try {
    request = new URL(requestUrl);
    const headerHostname = requestHost ? new URL(`http://${requestHost}`).hostname.toLowerCase() : null;
    const requestHostname = request.hostname.toLowerCase();
    const localLoopbackRequest = ["127.0.0.1", "localhost", "::1"].includes(requestHostname) && headerHostname === "learn.growvelt.com";
    if (requestHostname === "learn.growvelt.com") {
      if (headerHostname && headerHostname !== "learn.growvelt.com") return null;
    } else if (!localLoopbackRequest) {
      return null;
    }
    if (!["GET", "HEAD"].includes(method)) return null;
    if (getLearningOrigin(env) !== futureLearningOrigin || getCareersOrigin(env) !== "https://jobs.growvelt.com") return null;
  } catch {
    return null;
  }

  let pathname = request.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (pathname.includes("\\") || pathname.includes("//") || legacyLearningRedirectExemptPaths.has(pathname)
    || legacyLearningRedirectExemptPrefixes.some(prefix => isPathFamily(pathname, prefix))) return null;
  if (pathname.split("/").at(-1)?.includes(".")) return null;
  // Next client transitions request RSC payloads; redirect only document GETs.
  if (method === "GET" && !String(accept ?? "").toLowerCase().includes("text/html")) return null;

  // Do not forward legacy query strings that may contain one-time credentials
  // or payment references. The route remains the same, but transient parameters do not.
  return new URL(pathname, futureLearningOrigin).href;
}

export function internalLearningPath(pathname) {
  return Object.entries(aliases).find(([, alias]) => alias === pathname)?.[0] ?? pathname;
}

export function learningPath(value, env = environment()) {
  if (getLearningOrigin(env) !== futureLearningOrigin || !value.startsWith("/") || value.startsWith("//")) return value;
  const boundary = value.search(/[?#]/);
  const pathname = boundary < 0 ? value : value.slice(0, boundary);
  return (aliases[pathname] ?? pathname) + (boundary < 0 ? "" : value.slice(boundary));
}

export function learningAbsoluteUrl(value = "/", env = environment()) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) throw new Error("A relative Course path is required.");
  const result = new URL(learningPath(value, env), getLearningOrigin(env));
  if (result.origin !== getLearningOrigin(env)) throw new Error("Invalid Growvelt destination.");
  return result.href;
}

export function careersAbsoluteUrl(value = "/", env = environment()) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) throw new Error("A relative Careers path is required.");
  return new URL(value, getCareersOrigin(env)).href;
}

export function learningAuthCallbackUrl(origin, next, env = environment()) {
  const parsed = new URL(origin);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  const preview = parsed.hostname === "growvelt-learning.vercel.app"
    || /^growvelt-learning-[a-z0-9-]+-leodelsons-projects\.vercel\.app$/.test(parsed.hostname);
  const trusted = [legacyLearningOrigin, futureLearningOrigin, "https://www.learn.growvelt.com"].includes(parsed.origin);
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash
    || !(loopback && ["http:", "https:"].includes(parsed.protocol) || parsed.protocol === "https:" && (trusted || preview))) {
    throw new Error("Unapproved Growvelt authentication origin.");
  }
  // PKCE must return to the initiating origin, including throughout the grace period.
  const path = parsed.origin === legacyLearningOrigin || parsed.hostname === "www.learn.growvelt.com"
    ? "/auth/callback" : learningPath("/auth/callback", env);
  const callback = new URL(path, parsed.origin);
  callback.searchParams.set("next", next);
  return callback.href;
}

export function legacyCareersCollision(url, method, env = environment()) {
  const parsed = new URL(url);
  if (getLearningOrigin(env) !== futureLearningOrigin || parsed.hostname !== "www.growvelt.com") return null;
  if (["/dashboard", "/dashboard/profile", "/dashboard/settings"].includes(parsed.pathname)) return "page";
  if (parsed.pathname === "/auth/callback") return "auth";
  if (method === "POST" && ["/api/auth/welcome", "/api/newsletter/subscribe"].includes(parsed.pathname)) return "post";
  return null;
}
