import { NextResponse } from "next/server";
import { getCompanyPaymentForManager } from "@/app/lib/company/payment-status";
import { verifyPaystackCompanyTestTransaction } from "@/app/lib/payments/paystack";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as { reference?: unknown } | null;
  const reference = typeof body?.reference === "string" ? body.reference : "";
  if (!/^CP-[A-F0-9]{32}$/.test(reference)) return NextResponse.json({ code: "invalid_reference" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_authenticated" }, { status: 401 });
  try {
    const purchase = await getCompanyPaymentForManager(reference, user.id);
    if (!purchase) return NextResponse.json({ code: "payment_not_found" }, { status: 404 });
    if (purchase.status === "paid") return NextResponse.json({ status: "paid" });
    if (purchase.status !== "checkout_pending" || purchase.attemptStatus !== "pending") return NextResponse.json({ code: "payment_not_pending" }, { status: 409 });
    const verified = await verifyPaystackCompanyTestTransaction(reference);
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("finalize_learning_company_paid_course_purchase_by_reference", {
      p_provider_reference: reference,
      p_provider_transaction_id: verified.transactionId,
      p_amount_minor: verified.requestedAmountMinor,
      p_currency: verified.currency,
      p_domain: verified.domain,
    });
    if (error) throw error;
    const result = (data as Array<{ status?: string }> | null)?.[0];
    return NextResponse.json({ status: result?.status === "paid" ? "paid" : "pending" });
  } catch (error) {
    console.error("company_learning.payment_reconciliation_deferred", { reference, code: error && typeof error === "object" && "code" in error ? error.code : "verification_failed" });
    return NextResponse.json({ code: "verification_deferred" }, { status: 503 });
  }
}
