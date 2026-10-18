// Explicitly invoked public GET checks only. No credentials, cookies, POSTs or settings writes.
import { resolveCname } from "node:dns/promises";

const learningHosts = ["learn.growvelt.com", "www.learn.growvelt.com",
  "courses.growvelt.com", "www.courses.growvelt.com", "growvelt-learning.vercel.app"];
await Promise.all(learningHosts.map(async host => {
  try {
    const response = await fetch(`https://${host}/`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    console.log(JSON.stringify({ host, status: response.status, location: response.headers.get("location") }));
    await response.body?.cancel();
  } catch (error) { console.log(JSON.stringify({ host, error: error.code ?? error.cause?.code ?? error.message })); }
}));
await Promise.all(["/", "/dashboard", "/auth/callback", "/site.webmanifest", "/sw.js", "/offline.html", "/robots.txt", "/sitemap.xml"].map(async pathname => {
  try {
    const response = await fetch(`https://learn.growvelt.com${pathname}`, { redirect: "manual", signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    const result = { pathname, status: response.status, location: response.headers.get("location"),
      contentType: response.headers.get("content-type"), cacheControl: response.headers.get("cache-control") };
    if (pathname === "/") {
      result.canonical = body.match(/<link rel="canonical"[^>]*>/)?.[0] ?? null;
      result.manifest = body.match(/<link rel="manifest"[^>]*>/)?.[0] ?? null;
    }
    if (["/site.webmanifest", "/robots.txt"].includes(pathname) && response.ok) result.body = body;
    if (pathname === "/sitemap.xml" && response.ok) result.sitemapHosts = [...new Set([...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).host))];
    console.log(JSON.stringify(result));
  } catch (error) { console.log(JSON.stringify({ pathname, error: error.code ?? error.cause?.code ?? error.message })); }
}));
// DNS only: no Careers application requests or settings inspection.
for (const host of ["learn.growvelt.com", "www.learn.growvelt.com", "www.growvelt.com", "jobs.growvelt.com"]) {
  try { console.log(JSON.stringify({ dns: host, cname: await resolveCname(host) })); }
  catch (error) { console.log(JSON.stringify({ dns: host, code: error.code })); }
}
