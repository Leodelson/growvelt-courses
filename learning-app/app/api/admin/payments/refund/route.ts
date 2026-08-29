import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createPaystackTestFullRefund, requirePaystackTestRefundsEnabled } from "@/app/lib/payments/paystack";
import { getOrderNotificationContext, sendPaymentNotification } from "@/app/lib/email/payment-notifications";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  try { requirePaystackTestRefundsEnabled(); } catch { return NextResponse.json({ code: "refunds_disabled", message: "Refund initiation is disabled." }, { status: 503 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { reference?: unknown; confirmation?: unknown; reasonCode?: unknown; note?: unknown; idempotencyKey?: unknown } | null;
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";
  const reasonCode = typeof body?.reasonCode === "string" ? body.reasonCode.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" && /^[0-9a-f-]{36}$/i.test(body.idempotencyKey) ? body.idempotencyKey : randomUUID();
  if (!/^GL-[A-F0-9]{32}$/.test(reference) || confirmation !== reference || !/^[a-z][a-z0-9_]{1,60}$/.test(reasonCode) || note.length < 3 || note.length > 2000) return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  const admin = createAdminClient();
  const { data: requested, error: requestError } = await admin.rpc("request_paystack_test_full_refund", { p_order_reference: reference, p_operator_id: user.id, p_idempotency_key: idempotencyKey, p_confirmation: confirmation, p_reason_code: reasonCode, p_operator_note: note });
  if (requestError) return NextResponse.json({ code: "refund_not_eligible", message: "This order is not eligible for a new full refund." }, { status: 409 });
  const refundCase = (requested as Array<{ case_id: number; status: string; amount_minor: number; currency: string; provider_transaction_id: string }> | null)?.[0];
  if (!refundCase) return NextResponse.json({ code: "case_creation_failed" }, { status: 500 });
  if (refundCase.status !== "requested") return NextResponse.json({ outcome: refundCase.status, caseId: refundCase.case_id });
  const { error: submittingError } = await admin.rpc("mark_paystack_test_refund_submitting", { p_case_id: refundCase.case_id, p_operator_id: user.id });
  if (submittingError) return NextResponse.json({ code: "submission_failed" }, { status: 500 });
  let providerRefund;
  try { providerRefund = await createPaystackTestFullRefund({ transactionId: refundCase.provider_transaction_id, transactionReference: reference, note }); }
  catch (error) {
    await admin.rpc("record_paystack_test_refund_submission", { p_case_id: refundCase.case_id, p_provider_case_id: null, p_provider_status: "needs-attention", p_provider_reference: null, p_operator_id: user.id });
    console.error("refund.initiation_uncertain", { provider: "paystack", reference, caseId: refundCase.case_id, operatorId: user.id, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ code: "refund_status_uncertain", message: "The refund request needs verification before another action." }, { status: 502 });
  }
  const { error: submissionError } = await admin.rpc("record_paystack_test_refund_submission", { p_case_id: refundCase.case_id, p_provider_case_id: providerRefund.id, p_provider_status: providerRefund.status, p_provider_reference: providerRefund.reference, p_operator_id: user.id });
  if (submissionError) {
    console.error("refund.local_submission_record_failed", { provider: "paystack", reference, caseId: refundCase.case_id, operatorId: user.id });
    return NextResponse.json({ code: "refund_status_uncertain", message: "Paystack accepted the request, but Growvelt must reconcile its status." }, { status: 202 });
  }
  const context = await getOrderNotificationContext(reference);
  if (context) await sendPaymentNotification({ key: `refund-requested:${refundCase.case_id}`, type: "refund_requested", recipient: context.email, subject: "Growvelt Learning received your refund request", heading: "Your refund request was received", message: `Growvelt submitted the full-refund request for ${context.courseTitle}. A pending or processing status is not completion; we will notify you after authoritative Paystack confirmation.`, orderId: context.orderId, caseId: refundCase.case_id });
  return NextResponse.json({ outcome: providerRefund.status, caseId: refundCase.case_id });
}
