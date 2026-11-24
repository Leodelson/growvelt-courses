export function isSameOriginRequest(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;

  const fetchSite = request.headers.get("sec-fetch-site");
  // Sibling subdomains are separate products, not trusted request origins.
  // Header-less non-browser clients still rely on each route's authentication.
  return !fetchSite || fetchSite === "same-origin";
}

export function isLearningLoginActivityOrigin(request: Request) {
  if (isSameOriginRequest(request)) return true;

  // The public Learning forwarder preserves the browser's Origin while
  // Cloudflare invokes this route at the production Worker's own URL.
  const fetchSite = request.headers.get("sec-fetch-site");
  return new URL(request.url).origin === "https://growvelt-learning-production.late-smoke-33c0.workers.dev"
    && request.headers.get("origin") === "https://www.growvelt.com"
    && (!fetchSite || fetchSite === "same-origin");
}
