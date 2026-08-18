import { NextResponse } from "next/server";
import { sendWelcomeEmailForEligibleAccount } from "@/app/lib/email/welcome-email";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await sendWelcomeEmailForEligibleAccount(user, new URL(request.url).origin);
  } catch {
    // A welcome email is optional and must never affect the signed-in experience.
    console.error("Growvelt welcome email processing failed.");
  }

  return new NextResponse(null, { status: 204 });
}
