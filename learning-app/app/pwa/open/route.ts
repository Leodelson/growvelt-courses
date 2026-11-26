import { NextResponse } from "next/server";
import { defaultAuthenticatedPath } from "@/app/lib/auth/redirect";
import { createClient } from "@/app/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let destination = "/";

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (data?.claims && !error) destination = defaultAuthenticatedPath;
  } catch {
    // An unavailable auth service falls back to Learning's public home.
  }

  const requestUrl = new URL(request.url);
  const launchTimestamp = requestUrl.searchParams.get("__gwlaunch");
  const target = new URL(destination, requestUrl.origin);
  if (launchTimestamp && /^\d{13}$/.test(launchTimestamp)) {
    target.searchParams.set("__gwlaunch", launchTimestamp);
  }

  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
