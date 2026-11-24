import { NextResponse } from "next/server";
import { recordLearningSignIn } from "@/app/lib/auth/login-activity";
import { isLearningBrowserOrigin } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (!isLearningBrowserOrigin(request)) return new NextResponse(null, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return new NextResponse(null, { status: 401 });
  try {
    await recordLearningSignIn(user, request.headers);
  } catch {
    // Activity must never block an authenticated learner.
    console.error("Growvelt login activity could not be recorded.");
  }
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
