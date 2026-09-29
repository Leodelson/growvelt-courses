import { NextResponse } from "next/server";
import { getPaystackConfig, initializePaystackLiveTransaction, initializePaystackTestTransaction } from "@/app/lib/payments/paystack";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

type CheckoutRow = { purchase_id: number; attempt_id: number; provider_reference: string; amount_minor: number; currency: string; status: string };

function describeProviderError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message.slice(0, 500) };
  if (typeof error === "string") return { name: "string", message: error.slice(0, 500) };
  if (error && typeof error === "object") {
    const candidate = error as { name?: unknown; message?: unknown };
    return {
      name: typeof candidate.name === "string" ? candidate.name.slice(0, 100) : "provider_error",
      message: typeof candidate.message === "string" ? candidate.message.slice(0, 500) : "Paystack initialization failed.",
    };
  }
  return { name: typeof error, message: "Paystack initialization failed." };
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string; purchaseId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  let config;
  try {
    config = getPaystackConfig(true);
    if (config.mode === "live" && (
      process.env.PAYMENTS_LIVE_COMPANY_CHECKOUT_ENABLED !== "true"
      || process.env.PAYMENTS_LIVE_COMPANY_ACCOUNTING_READY !== "true"
    )) throw new Error("Live company checkout is disabled pending commercial accounting review.");
  } catch { return NextResponse.json({ code: "checkout_disabled", message: "Company checkout is not enabled in this environment." }, { status: 503 }); }
  const { workspaceId: workspaceText, purchaseId: purchaseText } = await params;
  const workspaceId = Number(workspaceText); const purchaseId = Number(purchaseText);
  if (!Number.isSafeInteger(workspaceId) || !Number.isSafeInteger(purchaseId)) return NextResponse.json({ code: "purchase_invalid" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ code: "not_authenticated" }, { status: 401 });
  const { data, error } = await supabase.rpc("start_learning_company_paid_course_checkout", { p_purchase_id: purchaseId });
  const checkout = (data as CheckoutRow[] | null)?.[0];
  if (error || !checkout) return NextResponse.json({ code: error?.code === "42501" ? "company_access_denied" : "purchase_unavailable" }, { status: error?.code === "42501" ? 403 : 400 });
  const admin = createAdminClient();
  const { error: domainError } = await admin.rpc("set_learning_company_paid_checkout_domain", {
    p_provider_reference: checkout.provider_reference,
    p_domain: config.mode,
  });
  if (domainError) {
    console.error("company_learning.checkout_domain_rejected", { purchaseId, workspaceId, reference: checkout.provider_reference, code: domainError.code });
    return NextResponse.json({ code: "payment_domain_conflict", message: "This checkout belongs to another payment environment. Please contact support." }, { status: 409 });
  }
  try {
    // Record submission before contacting Paystack so a provider checkout can
    // never be created without a matching, recoverable database attempt.
    const { error: pendingError } = await admin.rpc("mark_learning_company_paid_course_checkout_pending", { p_provider_reference: checkout.provider_reference });
    if (pendingError) throw pendingError;
    const callback = new URL(config.callbackUrl);
    callback.searchParams.set("reference", checkout.provider_reference);
    const initialize = config.mode === "live" ? initializePaystackLiveTransaction : initializePaystackTestTransaction;
    const initialized = await initialize({ email: user.email, amountMinor: checkout.amount_minor, reference: checkout.provider_reference, callbackUrl: callback.href });
    return NextResponse.json({ authorizationUrl: initialized.authorizationUrl, reference: checkout.provider_reference });
  } catch (error) {
    const providerError = describeProviderError(error);
    await admin.rpc("fail_learning_company_paid_course_checkout", {
      p_provider_reference: checkout.provider_reference,
      p_failure_code: "paystack_initialize_failed",
      p_failure_message: providerError.message,
    });
    console.error("company_learning.paystack_initialize_failed", { purchaseId, workspaceId, reference: checkout.provider_reference, domain: config.mode, ...providerError });
    return NextResponse.json({ code: "provider_unavailable", message: "Checkout could not be started. Please try again." }, { status: 502 });
  }
}
