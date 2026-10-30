import { NextResponse } from "next/server";
import { finalizeInstructorLivePayoutOtp } from "@/app/lib/admin/instructor-payout-transfer";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (process.env.LEARNING_LIVE_PAYOUT_SUBMISSION_ENABLED !== "true"
    || process.env.LEARNING_LIVE_PAYOUT_OTP_ENABLED !== "true") {
    return NextResponse.json({ code: "live_otp_disabled" }, { status: 503 });
  }
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const raw = await request.text();
  if (!raw || raw.length > 1024) return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  const body = (() => { try { return JSON.parse(raw) as { payoutItemId?: unknown; otp?: unknown }; } catch { return null; } })();
  if (!body || !Number.isSafeInteger(body.payoutItemId) || Number(body.payoutItemId) <= 0
    || typeof body.otp !== "string" || !/^\d{6}$/.test(body.otp)) {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  try {
    const result = await finalizeInstructorLivePayoutOtp(Number(body.payoutItemId), body.otp, user.id);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "live_otp_requires_verification" },
      { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
