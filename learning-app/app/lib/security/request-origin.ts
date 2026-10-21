export function isSameOriginRequest(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === expectedOrigin;

  const fetchSite = request.headers.get("sec-fetch-site");
  // Sibling subdomains are separate products, not trusted request origins.
  // Header-less non-browser clients still rely on each route's authentication.
  return !fetchSite || fetchSite === "same-origin";
}
