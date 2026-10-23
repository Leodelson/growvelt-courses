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
    throw new Error("The Learning cutover requires the explicit jobs.growvelt.com Careers origin.");
  }
  return origin;
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
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) throw new Error("A relative Learning path is required.");
  const result = new URL(learningPath(value, env), getLearningOrigin(env));
  if (result.origin !== getLearningOrigin(env)) throw new Error("Invalid Learning destination.");
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
    throw new Error("Unapproved Learning authentication origin.");
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
