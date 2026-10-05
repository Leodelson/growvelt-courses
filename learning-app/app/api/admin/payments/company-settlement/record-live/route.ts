import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { verifyPaystackCompanyLiveSettlement } from "@/app/lib/payments/paystack";

// Records provider evidence only. No company seller release, reservation,
// transfer, or live-checkout capability is granted by this operator route.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  if (process.env.PAYMENTS_LIVE_COMPANY_SETTLEMENT_RECORDING_ENABLED !== "true") {
    return NextResponse.json({ code: "disabled" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_growvelt_learning_admin");
  if (adminError || isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { purchaseId?: unknown; settlementId?: unknown } | null;
  const purchaseId = body?.purchaseId;
  const settlementId = body?.settlementId;
  if (!Number.isSafeInteger(purchaseId) || Number(purchaseId) <= 0
      || typeof settlementId !== "string" || !/^[1-9]\d{0,18}$/.test(settlementId)) {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: sale, error: saleError } = await admin.from("learning_company_commercial_sales")
      .select("purchase_id,attempt_id,paystack_domain,provider_reference,provider_transaction_id,gross_amount_minor,currency")
      .eq("purchase_id", Number(purchaseId)).maybeSingle();
    if (saleError || !sale || sale.paystack_domain !== "live" || sale.currency !== "NGN"
        || !Number.isSafeInteger(sale.gross_amount_minor) || sale.gross_amount_minor <= 0) {
      return NextResponse.json({ code: "live_sale_not_found" }, { status: 409 });
    }

    // The provider lookup uses the configured Live key and fails closed if the
    // global Paystack mode is not Live. User input supplies only the settlement
    // ID; charge identity and amount come from the immutable database sale.
    const evidence = await verifyPaystackCompanyLiveSettlement({
      settlementId, transactionId: sale.provider_transaction_id,
      reference: sale.provider_reference, requestedAmountMinor: sale.gross_amount_minor,
    });
    const { data: recordedPurchaseId, error: recordError } = await admin.rpc(
      "record_learning_company_paystack_settlement_evidence", {
        p_purchase_id: Number(purchaseId), p_actor_user_id: user.id,
        p_settlement_id: evidence.settlementId,
        p_provider_transaction_id: evidence.transactionId,
        p_provider_reference: evidence.reference,
        p_amount_minor: evidence.requestedAmountMinor,
        p_settled_at: evidence.settledAt,
      });
    if (recordError || recordedPurchaseId !== Number(purchaseId)) {
      throw recordError ?? new Error("Settlement recording returned an unexpected result.");
    }
    return NextResponse.json({ recorded: true, purchaseId: recordedPurchaseId,
      fundsReleased: false, payoutInitiated: false });
  } catch (error) {
    console.error("company_learning.settlement_evidence_record_failed", {
      purchaseId, operatorId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ code: "settlement_evidence_deferred",
      message: "The live settlement could not be independently verified and recorded." }, { status: 502 });
  }
}
