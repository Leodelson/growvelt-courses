import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { verifyPaystackCompanyLiveTransfer } from "@/app/lib/payments/paystack";

// Records evidence for a transfer that already succeeded at Paystack. This
// endpoint never creates a transfer, reservation, or release.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  if (process.env.PAYMENTS_LIVE_COMPANY_TRANSFER_EVIDENCE_RECORDING_ENABLED !== "true") {
    return NextResponse.json({ code: "disabled" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_growvelt_learning_admin");
  if (adminError || isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { purchaseId?: unknown; transferReference?: unknown } | null;
  const purchaseId = body?.purchaseId;
  const transferReference = body?.transferReference;
  if (!Number.isSafeInteger(purchaseId) || Number(purchaseId) <= 0
      || typeof transferReference !== "string" || !/^lcs-[a-z0-9_-]{12,46}$/.test(transferReference)) {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: sale, error: saleError } = await admin.from("learning_company_commercial_sales")
      .select("purchase_id,seller_payee_id,paystack_domain,currency")
      .eq("purchase_id", Number(purchaseId)).maybeSingle();
    if (saleError || !sale || sale.paystack_domain !== "live" || sale.currency !== "NGN") {
      return NextResponse.json({ code: "live_company_sale_not_found" }, { status: 409 });
    }

    const { data: boundary, error: boundaryError } = await admin
      .from("learning_company_seller_outflow_boundaries")
      .select("id,purchase_id,seller_payee_id,boundary_kind,amount_minor,currency,movement_reference")
      .eq("purchase_id", Number(purchaseId)).eq("boundary_kind", "transferred")
      .eq("movement_reference", transferReference).maybeSingle();
    if (boundaryError || !boundary || boundary.purchase_id !== sale.purchase_id
        || boundary.seller_payee_id !== sale.seller_payee_id || boundary.boundary_kind !== "transferred"
        || boundary.currency !== "NGN" || !Number.isSafeInteger(boundary.amount_minor)
        || boundary.amount_minor <= 0) {
      return NextResponse.json({ code: "transferred_boundary_not_found" }, { status: 409 });
    }

    const { data: payoutProfile, error: profileError } = await admin
      .from("learning_instructor_payout_profiles")
      .select("id,recipient_code,instructor_id,provider,provider_domain,status,currency")
      .eq("instructor_id", sale.seller_payee_id).eq("provider", "paystack")
      .eq("provider_domain", "live").eq("status", "active").eq("currency", "NGN")
      .maybeSingle();
    if (profileError || !payoutProfile || payoutProfile.instructor_id !== sale.seller_payee_id
        || payoutProfile.provider !== "paystack" || payoutProfile.provider_domain !== "live"
        || payoutProfile.status !== "active" || payoutProfile.currency !== "NGN") {
      return NextResponse.json({ code: "active_live_recipient_not_found" }, { status: 409 });
    }

    // Charge, reservation, seller and recipient identity are read from private
    // server-side records; the request supplies only the transfer reference.
    const evidence = await verifyPaystackCompanyLiveTransfer({
      reference: boundary.movement_reference,
      recipientCode: payoutProfile.recipient_code,
      amountMinor: boundary.amount_minor,
    });
    const { data: evidenceId, error: recordError } = await admin.rpc(
      "record_learning_company_seller_transfer_evidence", {
        p_boundary_id: boundary.id,
        p_payout_profile_id: payoutProfile.id,
        p_provider_transfer_id: evidence.transferId,
        p_provider_transfer_code: evidence.transferCode,
        p_recipient_code: evidence.recipientCode,
        p_amount_minor: evidence.amountMinor,
        p_operator_id: user.id,
      });
    if (recordError || !Number.isSafeInteger(evidenceId) || Number(evidenceId) <= 0) {
      throw recordError ?? new Error("Company transfer evidence recording returned an unexpected result.");
    }
    return NextResponse.json({ recorded: true, evidenceId, purchaseId: sale.purchase_id,
      amountMinor: evidence.amountMinor, currency: evidence.currency,
      transferInitiated: false, sellerBalanceReleased: false });
  } catch (error) {
    console.error("company_learning.transfer_evidence_record_failed", {
      purchaseId: Number(purchaseId), operatorId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ code: "transfer_evidence_deferred",
      message: "The successful Live transfer could not be independently verified and recorded." }, { status: 502 });
  }
}
