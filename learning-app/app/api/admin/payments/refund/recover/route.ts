import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { requirePaystackTestRefundsEnabled, verifyPaystackTestRefund } from "@/app/lib/payments/paystack";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  try { requirePaystackTestRefundsEnabled(); } catch { return NextResponse.json({ code: "refunds_disabled", message: "Refund recovery is disabled." }, { status: 503 }); }
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin"); if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { caseId?: unknown } | null;
  const caseId = Number(body?.caseId);
  if (!Number.isSafeInteger(caseId) || caseId <= 0) return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  try {
    const admin = createAdminClient();
    const { data: targets, error: targetError } = await admin.rpc("get_learning_refund_case_for_recovery", { p_operator_id: user.id, p_case_id: caseId });
    const target = (targets as Array<{ order_reference: string; provider_case_id: string; provider_transaction_id: string }> | null)?.[0];
    if (targetError || !target) return NextResponse.json({ code: "refund_not_recoverable" }, { status: 409 });
    const verified = await verifyPaystackTestRefund({ refundId: target.provider_case_id, transactionReference: target.order_reference, transactionId: target.provider_transaction_id });
    const { data: eventId, error: receiveError } = await admin.rpc("receive_paystack_test_verified_refund", { p_case_id: caseId, p_provider_case_id: verified.id, p_provider_status: verified.status, p_provider_reference: verified.reference, p_amount_minor: verified.amountMinor, p_currency: verified.currency, p_domain: verified.domain, p_payload: verified.payload, p_operator_id: user.id });
    if (receiveError) throw receiveError;
    const { data, error } = await admin.rpc("recover_paystack_test_refund_event", { p_event_id: Number(eventId), p_operator_id: user.id }); if (error) throw error;
    return NextResponse.json({ outcome: (data as Array<{ outcome?: string }> | null)?.[0]?.outcome ?? verified.status });
  } catch (error) {
    console.error("refund.operator_recovery_failed", { provider: "paystack", caseId, operatorId: user.id, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ code: "recovery_failed", message: "The refund could not be verified safely." }, { status: 502 });
  }
}
