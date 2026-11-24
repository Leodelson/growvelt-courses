import { type NextRequest, NextResponse } from "next/server";
import { getSafeNextPath } from "@/app/lib/auth/redirect";
import { createAuthCallbackClient, preventAuthRedirectCaching } from "@/app/lib/supabase/auth-callback";
import { logSupabaseError } from "@/app/lib/supabase/logging";
import { recordLearningSignIn } from "@/app/lib/auth/login-activity";
import { learningAuthResponseOrigin } from "@/app/lib/site-urls.mjs";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const responseOrigin = learningAuthResponseOrigin(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return preventAuthRedirectCaching(NextResponse.redirect(new URL("/auth/error", responseOrigin)));
  }

  const response = preventAuthRedirectCaching(NextResponse.redirect(new URL(next, responseOrigin)));
  try {
    const supabase = createAuthCallbackClient(request, response);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      logSupabaseError("auth.oauth_code_exchange_failed", error);
      return preventAuthRedirectCaching(NextResponse.redirect(new URL("/auth/error", responseOrigin)));
    }
    // A successful PKCE exchange is a fresh sign-in even if the provider's
    // returned user object omits or lags `last_sign_in_at`.
    await recordLearningSignIn(data.session.user, request.headers, new Date().toISOString()).catch(() => {
      console.error("Growvelt OAuth login activity could not be recorded.");
    });
  } catch (error) {
    logSupabaseError("auth.oauth_callback_failed", error);
    return preventAuthRedirectCaching(NextResponse.redirect(new URL("/auth/error", responseOrigin)));
  }

  return response;
}
