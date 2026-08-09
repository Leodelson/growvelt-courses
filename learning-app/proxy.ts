import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { defaultAuthenticatedPath, getSafeNextPath } from "@/app/lib/auth/redirect";

const protectedPrefixes = ["/dashboard", "/settings", "/teach/apply", "/teach/application", "/instructor"];
const guestOnlyPaths = new Set(["/sign-in", "/sign-up"]);

function copySessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pathname = request.nextUrl.pathname;

  // Keep public rendering and local visual QA operational before environment
  // variables are configured. Production configuration is required before
  // protected routes can become usable.
  if (!url || !publishableKey) {
    if (protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      const destination = new URL("/sign-in", request.url);
      destination.searchParams.set("next", getSafeNextPath(`${pathname}${request.nextUrl.search}`));
      return NextResponse.redirect(destination);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims) && !error;
  const isProtectedPath = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProtectedPath && !isAuthenticated) {
    const destination = new URL("/sign-in", request.url);
    destination.searchParams.set("next", getSafeNextPath(`${pathname}${request.nextUrl.search}`));
    return copySessionCookies(response, NextResponse.redirect(destination));
  }

  if (guestOnlyPaths.has(pathname) && isAuthenticated) {
    return copySessionCookies(response, NextResponse.redirect(new URL(defaultAuthenticatedPath, request.url)));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/teach/apply/:path*", "/teach/application/:path*", "/instructor/:path*", "/sign-in", "/sign-up"],
};
