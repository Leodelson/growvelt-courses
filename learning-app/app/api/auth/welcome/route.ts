import { NextResponse } from "next/server";
import { sendWelcomeEmailForEligibleAccount } from "@/app/lib/email/welcome-email";
import { createClient } from "@/app/lib/supabase/server";
import { isLearningBrowserOrigin } from "@/app/lib/security/request-origin";
import { learningAuthResponseOrigin } from "@/app/lib/site-urls.mjs";

export async function POST(request: Request) {
  if (!isLearningBrowserOrigin(request)) return new NextResponse(null, { status: 403 });
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await sendWelcomeEmailForEligibleAccount(user, learningAuthResponseOrigin(request.url));
  } catch {
    // A welcome email is optional and must never affect the signed-in experience.
    console.error("Growvelt welcome email processing failed.");
  }

  return new NextResponse(null, { status: 204 });
}
