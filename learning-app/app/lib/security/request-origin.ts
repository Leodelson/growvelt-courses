import { futureLearningOrigin, learningProductionWorkerOrigin } from "../site-urls.mjs";

export function isSameOriginRequest(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;

  const fetchSite = request.headers.get("sec-fetch-site");
  // Sibling subdomains are separate products, not trusted request origins.
  // Header-less non-browser clients still rely on each route's authentication.
  return !fetchSite || fetchSite === "same-origin";
}

export function isLearningBrowserOrigin(request: Request) {
  if (isSameOriginRequest(request)) return true;

  // The public Learning forwarder preserves the browser's Origin while
  // Cloudflare invokes this route at the production Worker's own URL.
  const fetchSite = request.headers.get("sec-fetch-site");
  return new URL(request.url).origin === learningProductionWorkerOrigin
    && request.headers.get("origin") === futureLearningOrigin
    && (!fetchSite || fetchSite === "same-origin");
}
