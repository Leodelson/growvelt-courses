import { NextResponse } from "next/server";
import { approveInstructorLivePayoutBatch } from "@/app/lib/admin/instructor-payout-transfer";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED !== "true") {
    return NextResponse.json({ code: "live_payout_approval_disabled" }, { status: 503 });
  }
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as {
    instructorId?: unknown; payoutProfileId?: unknown; earningIds?: unknown;
    confirmedAmountMinor?: unknown; idempotencyKey?: unknown;
  } | null;
  if (!body || typeof body.instructorId !== "string" || !Number.isSafeInteger(body.payoutProfileId)
    || !Array.isArray(body.earningIds) || body.earningIds.length < 1 || body.earningIds.length > 100
    || !body.earningIds.every(id => Number.isSafeInteger(id) && Number(id) > 0)
    || !Number.isSafeInteger(body.confirmedAmountMinor) || Number(body.confirmedAmountMinor) < 100000
    || typeof body.idempotencyKey !== "string" || !/^[a-z][a-z0-9:_-]{2,120}$/.test(body.idempotencyKey)) {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  try {
    const batch = await approveInstructorLivePayoutBatch({
      instructorId: body.instructorId, payoutProfileId: Number(body.payoutProfileId),
      earningIds: body.earningIds.map(Number), confirmedAmountMinor: Number(body.confirmedAmountMinor),
      idempotencyKey: body.idempotencyKey,
    }, user.id);
    return NextResponse.json({ status: "approved", ...batch }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "live_payout_batch_approval_requires_review" }, { status: 409 });
  }
}
