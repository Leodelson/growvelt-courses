import { NextResponse } from "next/server";
import { getSafeNextPath } from "@/app/lib/auth/redirect";
import { sendWelcomeEmailForNewAccount } from "@/app/lib/email/welcome-email";
import { createClient } from "@/app/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
    }

    if (data.user) {
      try {
        await sendWelcomeEmailForNewAccount(data.user, requestUrl.origin);
      } catch {
        // Email delivery must never prevent a confirmed account from reaching Growvelt.
        console.error("Growvelt welcome email processing failed.");
      }
    }
  } catch {
    return NextResponse.redirect(new URL("/auth/error", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
