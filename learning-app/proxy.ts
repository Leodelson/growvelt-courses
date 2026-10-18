import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { defaultAuthenticatedPath, getExplicitSafeNextPath, getSafeNextPath } from "@/app/lib/auth/redirect";
import { internalLearningPath } from "@/app/lib/site-urls.mjs";
import { careersCompatibilityResponse, learningWwwSafetyBridgeResponse } from "@/app/lib/careers-compatibility.mjs";

const protectedPrefixes = ["/dashboard", "/settings", "/teach/apply", "/teach/application", "/instructor", "/admin"];
const guestOnlyPaths = new Set(["/sign-in", "/sign-up"]);

function copySessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function proxy(request: NextRequest) {
  const bridge = learningWwwSafetyBridgeResponse(request);
  if (bridge) return bridge;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const compatibility = careersCompatibilityResponse(request);
  if (compatibility) return compatibility;
  const pathname = internalLearningPath(request.nextUrl.pathname);
  const passThrough = () => {
    if (pathname === request.nextUrl.pathname) return NextResponse.next({ request });
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    return NextResponse.rewrite(target, { request });
  };
  // Callback and legacy API matchers exist only for collision isolation, not session refresh.
  const isProtectedPath = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!isProtectedPath && !guestOnlyPaths.has(pathname)) return passThrough();

  // Keep public rendering and local visual QA operational before environment
  // variables are configured. Production configuration is required before
  // protected routes can become usable.
  if (!url || !publishableKey) {
    if (protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      const destination = new URL(pathname === "/teach/apply" ? "/sign-up" : "/sign-in", request.url);
      destination.searchParams.set("next", getSafeNextPath(`${pathname}${request.nextUrl.search}`));
      return NextResponse.redirect(destination);
    }
    return passThrough();
  }

  let response = passThrough();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = passThrough();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims) && !error;

  if (isProtectedPath && !isAuthenticated) {
    const destination = new URL(pathname === "/teach/apply" ? "/sign-up" : "/sign-in", request.url);
    destination.searchParams.set("next", getSafeNextPath(`${pathname}${request.nextUrl.search}`));
    return copySessionCookies(response, NextResponse.redirect(destination));
  }

  if (guestOnlyPaths.has(pathname) && isAuthenticated) {
    const destination = getExplicitSafeNextPath(request.nextUrl.searchParams.get("next")) ?? defaultAuthenticatedPath;
    return copySessionCookies(response, NextResponse.redirect(new URL(destination, request.url)));
  }

  return response;
}

export const config = {
  // Additional finite Careers families are filtered by the compatibility helper;
  // matching a family here does not authorize a redirect or backend access.
  matcher: [
    { source: "/:path*", has: [{ type: "host", value: "www\\.growvelt\\.com" }] },
    "/dashboard/:path*", "/learning/dashboard/:path*", "/auth", "/auth/callback", "/auth/reset", "/auth/forgot-password", "/api/auth/welcome", "/api/newsletter/subscribe", "/api/unsubscribe", "/api/alerts/unsubscribe", "/api/paystack/verify", "/unsubscribe", "/alerts/unsubscribe", "/unsubscribe-success", "/ref/:code", "/sw.js", "/pwa/launch.html", "/offline.html", "/manifest.webmanifest", "/site.webmanifest", "/jobs", "/jobs/:id", "/jobs/:id/apply/:path*", "/candidates/:id", "/companies/:id", "/employers", "/updates", "/get-started", "/get-started/results", "/post-job/success", "/career-assistant/:path*", "/settings/:path*", "/teach/apply/:path*", "/teach/application/:path*", "/instructor/:path*", "/admin/:path*", "/sign-in", "/sign-up"],
};
