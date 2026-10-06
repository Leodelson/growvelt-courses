import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";

// Records an externally confirmed seller repayment. It does not collect money
// and never deducts the receivable from future earnings or payouts.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  if (process.env.PAYMENTS_LIVE_COMPANY_RECOVERY_RECEIPT_RECORDING_ENABLED !== "true") {
    return NextResponse.json({ code: "disabled" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_growvelt_learning_admin");
  if (adminError || isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    purchaseId?: unknown; amountMinor?: unknown; paymentMethod?: unknown; paymentReference?: unknown;
  } | null;
  const purchaseId = body?.purchaseId;
  const amountMinor = body?.amountMinor;
  const paymentMethod = body?.paymentMethod;
  const paymentReference = body?.paymentReference;
  if (!Number.isSafeInteger(purchaseId) || Number(purchaseId) <= 0
      || !Number.isSafeInteger(amountMinor) || Number(amountMinor) <= 0
      || (paymentMethod !== "bank_transfer" && paymentMethod !== "other")
      || typeof paymentReference !== "string"
      || !/^[A-Za-z0-9][A-Za-z0-9._:/ -]{5,159}$/.test(paymentReference.trim())) {
    return NextResponse.json({ code: "invalid_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: balances, error: balanceError } = await admin.rpc("list_learning_company_seller_recovery_balances");
  if (balanceError || !Array.isArray(balances)) {
    console.error("company_learning.recovery_balance_lookup_failed", {
      purchaseId: Number(purchaseId), operatorId: user.id, errorCode: balanceError?.code ?? "invalid_response",
    });
    return NextResponse.json({ code: "recovery_ledger_unavailable" }, { status: 503 });
  }
  const balance = (balances as Array<{ purchase_id?: number; seller_payee_id?: string; outstanding_minor?: number }>)
    .find((row) => row.purchase_id === Number(purchaseId));
  if (!balance || typeof balance.seller_payee_id !== "string"
      || !Number.isSafeInteger(balance.outstanding_minor) || Number(balance.outstanding_minor) <= 0
      || Number(amountMinor) > Number(balance.outstanding_minor)) {
    return NextResponse.json({ code: "no_matching_outstanding_recovery" }, { status: 409 });
  }

  const { data: receiptId, error: recordError } = await admin.rpc(
    "record_learning_company_seller_recovery_receipt", {
      p_purchase_id: Number(purchaseId),
      p_seller_payee_id: balance.seller_payee_id,
      p_amount_minor: Number(amountMinor),
      p_payment_method: paymentMethod,
      p_payment_reference: paymentReference.trim(),
      p_operator_id: user.id,
    });
  if (recordError || !Number.isSafeInteger(receiptId) || Number(receiptId) <= 0) {
    const errorCode = recordError?.code;
    if (errorCode === "23505" || errorCode === "23514" || errorCode === "22023") {
      return NextResponse.json({ code: "receipt_conflict_or_balance_changed" }, { status: 409 });
    }
    console.error("company_learning.recovery_receipt_record_failed", {
      purchaseId: Number(purchaseId), operatorId: user.id, errorCode: errorCode ?? "invalid_response",
    });
    return NextResponse.json({ code: "recovery_receipt_unavailable" }, { status: 503 });
  }

  return NextResponse.json({ recorded: true, receiptId, purchaseId: Number(purchaseId),
    amountMinor: Number(amountMinor), currency: "NGN", paymentMethod,
    collectionInitiated: false, earningsDeducted: false });
}
