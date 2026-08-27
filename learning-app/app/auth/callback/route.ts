import { type NextRequest, NextResponse } from "next/server";
import { getSafeNextPath } from "@/app/lib/auth/redirect";
import { createAuthCallbackClient, preventAuthRedirectCaching } from "@/app/lib/supabase/auth-callback";
import { logSupabaseError } from "@/app/lib/supabase/logging";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return preventAuthRedirectCaching(NextResponse.redirect(new URL("/auth/error", requestUrl.origin)));
  }

  const response = preventAuthRedirectCaching(NextResponse.redirect(new URL(next, requestUrl.origin)));
  try {
    const supabase = createAuthCallbackClient(request, response);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      logSupabaseError("auth.oauth_code_exchange_failed", error);
      return preventAuthRedirectCaching(NextResponse.redirect(new URL("/auth/error", requestUrl.origin)));
    }
  } catch (error) {
    logSupabaseError("auth.oauth_callback_failed", error);
    return preventAuthRedirectCaching(NextResponse.redirect(new URL("/auth/error", requestUrl.origin)));
  }

  return response;
}
