import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export type AuthCookie = { name: string; value: string; options?: CookieOptions };

type RequestCookieTarget = {
  set(name: string, value: string): unknown;
};

type ResponseCookieTarget = {
  set(name: string, value: string, options?: CookieOptions): unknown;
};

export function propagateAuthCookies(
  cookiesToSet: AuthCookie[],
  requestCookies: RequestCookieTarget,
  responseCookies: ResponseCookieTarget,
) {
  for (const { name, value } of cookiesToSet) requestCookies.set(name, value);
  for (const { name, value, options } of cookiesToSet) responseCookies.set(name, value, options);
}

export function createAuthCallbackClient(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Growvelt Learning authentication is not configured.");

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        propagateAuthCookies(cookiesToSet, request.cookies, response.cookies);
      },
    },
  });
}

export function preventAuthRedirectCaching(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
