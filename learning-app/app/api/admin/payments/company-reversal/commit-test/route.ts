import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { verifyPaystackCompanyDispute, verifyPaystackCompanyRefund } from "@/app/lib/payments/paystack";
import { planCompanySeatReversal } from "@/app/lib/payments/company-reversal-plan";

// An explicitly enabled, operator-only Test Mode recovery path. A signed
// webhook notice alone is never sufficient to change money or seat sources.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  if (process.env.PAYMENTS_TEST_COMPANY_REVERSAL_COMMIT_ENABLED !== "true") {
    return NextResponse.json({ code: "disabled" }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_growvelt_learning_admin");
  if (adminError || isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { eventId?: unknown; selectedUserIds?: unknown } | null;
  const eventId = body?.eventId;
  const selectedUserIds = body?.selectedUserIds;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!Number.isSafeInteger(eventId) || Number(eventId) <= 0 || !Array.isArray(selectedUserIds)
      || selectedUserIds.length < 1 || selectedUserIds.length > 500
      || !selectedUserIds.every((id) => typeof id === "string" && uuid.test(id))) {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: notice, error: noticeError } = await admin.from("learning_company_reversal_event_inbox")
      .select("id,purchase_id,paystack_domain,event_type,provider_reference,provider_case_id,reported_amount_minor,currency")
      .eq("id", Number(eventId)).maybeSingle();
    if (noticeError || !notice || notice.paystack_domain !== "test"
        || !["refund.processed", "charge.dispute.resolve"].includes(notice.event_type)) {
      return NextResponse.json({ code: "not_recoverable" }, { status: 409 });
    }
    const { data: sale, error: saleError } = await admin.from("learning_company_commercial_sales")
      .select("purchase_id,paystack_domain,provider_reference,provider_transaction_id,currency,gross_amount_minor")
      .eq("purchase_id", notice.purchase_id).maybeSingle();
    if (saleError || !sale || sale.paystack_domain !== "test"
        || sale.provider_reference !== notice.provider_reference || sale.currency !== "NGN") {
      return NextResponse.json({ code: "sale_not_recoverable" }, { status: 409 });
    }

    // This call fetches the current case directly from Paystack, independent
    // of the webhook. The configured key must itself be in Test Mode.
    const lookup = { caseId: notice.provider_case_id, transactionId: sale.provider_transaction_id,
      transactionReference: sale.provider_reference, domain: "test" as const };
    const verified = notice.event_type === "refund.processed"
      ? await verifyPaystackCompanyRefund(lookup) : await verifyPaystackCompanyDispute(lookup);
    const expectedKind = notice.event_type === "refund.processed" ? "processed_refund" : "lost_dispute";
    if (verified.finalOutcome !== expectedKind || verified.amountMinor !== notice.reported_amount_minor) {
      return NextResponse.json({ code: "provider_outcome_inconclusive" }, { status: 409 });
    }

    const { data: existing, error: existingError } = await admin.from("learning_company_commercial_reversals")
      .select("id,reversal_type,provider_case_id,provider_transaction_id,gross_amount_minor")
      .eq("inbox_event_id", Number(eventId)).maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const { data: reversedLines, error: reversedLinesError } = await admin
        .from("learning_company_commercial_reversal_lines").select("assigned_user_id")
        .eq("reversal_id", existing.id);
      if (reversedLinesError) throw reversedLinesError;
      const requested = [...selectedUserIds as string[]].sort();
      const recorded = (reversedLines ?? []).map((line) => line.assigned_user_id).sort();
      if (existing.reversal_type !== expectedKind || existing.provider_case_id !== verified.providerCaseId
          || existing.provider_transaction_id !== verified.transactionId
          || existing.gross_amount_minor !== verified.amountMinor
          || requested.length !== recorded.length || requested.some((id, index) => id !== recorded[index])) {
        return NextResponse.json({ code: "reversal_replay_conflict" }, { status: 409 });
      }
      return NextResponse.json({ outcome: expectedKind, reversalId: existing.id,
        reversedSeats: recorded.length, alreadyCommitted: true, sharedAccessRequiresReview: true });
    }

    const [{ data: lines, error: linesError }, { data: access, error: accessError }] = await Promise.all([
      admin.from("learning_company_commercial_sale_lines")
        .select("assigned_user_id,unit_amount_minor,platform_commission_minor,seller_gross_minor")
        .eq("purchase_id", sale.purchase_id),
      admin.from("learning_company_paid_seat_access").select("assigned_user_id,status")
        .eq("purchase_id", sale.purchase_id),
    ]);
    if (linesError || accessError || !lines || !access || lines.length !== access.length) {
      return NextResponse.json({ code: "seat_provenance_incomplete" }, { status: 409 });
    }
    const accessByUser = new Map(access.map((row) => [row.assigned_user_id, row.status]));
    const plan = planCompanySeatReversal({
      purchaseId: sale.purchase_id, paystackDomain: "test", providerReference: sale.provider_reference,
      currency: "NGN", grossAmountMinor: sale.gross_amount_minor,
      seats: lines.map((line) => ({ assignedUserId: line.assigned_user_id,
        unitAmountMinor: line.unit_amount_minor, platformCommissionMinor: line.platform_commission_minor,
        sellerGrossMinor: line.seller_gross_minor, accessStatus: accessByUser.get(line.assigned_user_id) ?? null })),
    }, { kind: expectedKind, paystackDomain: "test", providerReference: verified.transactionReference,
      currency: verified.currency, amountMinor: verified.amountMinor }, selectedUserIds as string[]);
    if (!plan) return NextResponse.json({ code: "seat_amount_mismatch" }, { status: 409 });

    const { data, error } = await admin.rpc("commit_learning_company_reversal_after_verification", {
      p_inbox_event_id: Number(eventId), p_provider_transaction_id: verified.transactionId,
      p_verified_status: verified.providerStatus, p_verified_resolution: verified.providerResolution,
      p_verified_amount_minor: verified.amountMinor, p_selected_user_ids: plan.assignedUserIds,
    });
    if (error) throw error;
    const result = (data as Array<{ reversal_id?: number; reversed_seat_count?: number }> | null)?.[0];
    if (!result?.reversal_id || result.reversed_seat_count !== plan.assignedUserIds.length) {
      throw new Error("Company reversal commit returned an unexpected result.");
    }
    return NextResponse.json({ outcome: plan.kind, reversalId: result.reversal_id,
      reversedSeats: result.reversed_seat_count, sharedAccessRequiresReview: true });
  } catch (error) {
    console.error("company_learning.operator_reversal_failed", { eventId, operatorId: user.id,
      message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ code: "reversal_deferred", message: "The company reversal could not be verified or committed safely." }, { status: 502 });
  }
}
