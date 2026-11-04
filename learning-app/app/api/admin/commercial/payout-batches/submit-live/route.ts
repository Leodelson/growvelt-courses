import { NextResponse } from "next/server";
import { submitInstructorLivePayoutBatch } from "@/app/lib/admin/instructor-payout-transfer";
import { PaystackLiveBalancePreflightError } from "@/app/lib/payments/paystack";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_SUBMISSION_ENABLED !== "true"
    && process.env.LEARNING_LIVE_SUBSCRIPTION_PAYOUT_BATCH_SUBMISSION_ENABLED !== "true") {
    return NextResponse.json({ code: "live_payout_submission_disabled" }, { status: 503 });
  }
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as { batchId?: unknown; sourceType?: unknown; idempotencyKey?: unknown } | null;
  const sourceType = body?.sourceType === "subscription_invoice" ? "subscription_invoice" : "course_order";
  if (body?.sourceType !== undefined && body.sourceType !== "course_order" && body.sourceType !== "subscription_invoice") {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }
  if (sourceType === "subscription_invoice"
    ? process.env.LEARNING_LIVE_SUBSCRIPTION_PAYOUT_BATCH_SUBMISSION_ENABLED !== "true"
    : process.env.LEARNING_LIVE_PAYOUT_BATCH_SUBMISSION_ENABLED !== "true") {
    return NextResponse.json({ code: "live_payout_submission_disabled" }, { status: 503 });
  }
  if (!body || !Number.isSafeInteger(body.batchId) || Number(body.batchId) <= 0
    || typeof body.idempotencyKey !== "string" || !/^[a-z][a-z0-9:_-]{2,120}$/.test(body.idempotencyKey)) {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  try {
    const result = await submitInstructorLivePayoutBatch(Number(body.batchId), body.idempotencyKey, user.id, sourceType);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PaystackLiveBalancePreflightError) {
      return NextResponse.json({ code: "live_batch_balance_preflight_failed" }, { status: 409 });
    }
    return NextResponse.json({ code: "live_batch_transfer_requires_verification" }, { status: 409 });
  }
}
