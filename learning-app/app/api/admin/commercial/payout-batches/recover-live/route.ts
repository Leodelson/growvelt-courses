import { NextResponse } from "next/server";
import { getLivePayoutBatchAttemptSource, recoverInstructorLivePayoutBatch } from "@/app/lib/admin/instructor-payout-transfer";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_RECONCILIATION_ENABLED !== "true"
    && process.env.LEARNING_LIVE_SUBSCRIPTION_PAYOUT_BATCH_RECONCILIATION_ENABLED !== "true") {
    return NextResponse.json({ code: "live_batch_recovery_disabled" }, { status: 503 });
  }
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as { attemptId?: unknown } | null;
  if (!body || !Number.isSafeInteger(body.attemptId) || Number(body.attemptId) <= 0) {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  let sourceType: "course_order" | "subscription_invoice";
  try { sourceType = await getLivePayoutBatchAttemptSource(Number(body.attemptId), user.id); }
  catch { return NextResponse.json({ code: "live_batch_recovery_requires_review" }, { status: 409 }); }
  const recoveryEnabled = sourceType === "subscription_invoice"
    ? process.env.LEARNING_LIVE_SUBSCRIPTION_PAYOUT_BATCH_RECONCILIATION_ENABLED === "true"
    : process.env.LEARNING_LIVE_PAYOUT_BATCH_RECONCILIATION_ENABLED === "true";
  if (!recoveryEnabled) return NextResponse.json({ code: "live_batch_recovery_disabled" }, { status: 503 });
  try {
    const result = await recoverInstructorLivePayoutBatch(Number(body.attemptId), user.id, sourceType);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "live_batch_recovery_requires_review" }, { status: 409 });
  }
}
