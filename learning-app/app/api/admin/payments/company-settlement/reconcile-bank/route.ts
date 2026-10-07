import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { verifyPaystackCompanyLiveSettlement } from "@/app/lib/payments/paystack";
import { validateCompanyBankSettlementEvidence } from "@/app/lib/payments/company-bank-settlement-core";

// Records a bank-statement match only. It cannot release seller proceeds or
// initiate a Paystack transfer. The bank side remains a human admin attestation.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  if (process.env.PAYMENTS_LIVE_COMPANY_BANK_RECONCILIATION_ENABLED !== "true") {
    return NextResponse.json({ code: "disabled" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_growvelt_learning_admin");
  if (adminError || isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    purchaseId?: unknown;
    settlementId?: unknown;
    bankCreditAmountMinor?: unknown;
    bankStatementReference?: unknown;
    bankCreditDate?: unknown;
  } | null;
  if (!Number.isSafeInteger(body?.purchaseId) || Number(body?.purchaseId) <= 0
      || typeof body?.settlementId !== "string" || !/^[1-9]\d{0,18}$/.test(body.settlementId)
      || !Number.isSafeInteger(body?.bankCreditAmountMinor) || Number(body?.bankCreditAmountMinor) <= 0
      || typeof body?.bankStatementReference !== "string"
      || typeof body?.bankCreditDate !== "string") {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }

  const purchaseId = Number(body.purchaseId);
  try {
    const admin = createAdminClient();
    const [{ data: sale, error: saleError }, { data: settlementRow, error: settlementError }] = await Promise.all([
      admin.from("learning_company_commercial_sales")
        .select("purchase_id,attempt_id,paystack_domain,provider_reference,provider_transaction_id,gross_amount_minor,currency")
        .eq("purchase_id", purchaseId).maybeSingle(),
      admin.from("learning_company_paystack_settlement_evidence")
        .select("settlement_id").eq("purchase_id", purchaseId).maybeSingle(),
    ]);
    if (saleError || !sale || sale.purchase_id !== purchaseId || sale.paystack_domain !== "live"
        || sale.currency !== "NGN" || !Number.isSafeInteger(sale.gross_amount_minor)
        || sale.gross_amount_minor <= 0) {
      return NextResponse.json({ code: "live_company_sale_not_found" }, { status: 409 });
    }
    if (settlementError || !settlementRow || settlementRow.settlement_id !== body.settlementId) {
      return NextResponse.json({ code: "verified_company_settlement_not_found" }, { status: 409 });
    }

    // Charge identity is read from the immutable sale. Paystack's Live API is
    // re-fetched; the request cannot supply or override the expected payout.
    const providerEvidence = await verifyPaystackCompanyLiveSettlement({
      settlementId: body.settlementId,
      transactionId: sale.provider_transaction_id,
      reference: sale.provider_reference,
      requestedAmountMinor: sale.gross_amount_minor,
    });
    const bankEvidence = validateCompanyBankSettlementEvidence(providerEvidence, {
      bankCreditAmountMinor: Number(body.bankCreditAmountMinor),
      bankStatementReference: body.bankStatementReference,
      bankCreditDate: body.bankCreditDate,
    });
    const { data: recordedSettlementId, error: recordError } = await admin.rpc(
      "record_learning_company_paystack_bank_settlement_evidence", {
        p_settlement_id: bankEvidence.settlementId,
        p_anchor_purchase_id: purchaseId,
        p_settlement_date: bankEvidence.settledAt,
        p_effective_amount_minor: bankEvidence.effectiveAmountMinor,
        p_bank_credit_amount_minor: bankEvidence.bankCreditAmountMinor,
        p_bank_statement_reference: bankEvidence.bankStatementReference,
        p_bank_credit_date: bankEvidence.bankCreditDate,
        p_actor_user_id: user.id,
      });
    if (recordError || recordedSettlementId !== bankEvidence.settlementId) {
      throw recordError ?? new Error("Bank settlement evidence recording returned an unexpected result.");
    }
    return NextResponse.json({ recorded: true, settlementId: recordedSettlementId,
      amountMinor: bankEvidence.bankCreditAmountMinor, currency: "NGN",
      sellerBalanceReleased: false, payoutInitiated: false });
  } catch (error) {
    console.error("company_learning.bank_settlement_reconciliation_failed", {
      purchaseId, settlementId: body.settlementId, operatorId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ code: "bank_settlement_reconciliation_deferred",
      message: "The Paystack settlement and bank-statement line did not pass reconciliation." }, { status: 409 });
  }
}
