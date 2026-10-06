import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { getPaystackConfig, getPaystackTestConfig, initializePaystackLiveTransaction, initializePaystackTestTransaction } from "@/app/lib/payments/paystack";
import type { PaystackConfiguration } from "@/app/lib/payments/paystack-config";

type OrderRow = { order_id: number; order_reference: string; payment_attempt_id: number; amount_minor: number; currency: string };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin", message: "This request was not accepted." }, { status: 403 });
  let configuration: PaystackConfiguration;
  try {
    configuration = getPaystackConfig(true);
    if (configuration.mode === "live" && !configuration.liveLearnerCheckoutEnabled) {
      throw new Error("Live learner checkout is disabled.");
    }
    if (configuration.mode === "test") getPaystackTestConfig(true);
  } catch { return NextResponse.json({ code: "checkout_disabled", message: "Paid checkout is not available." }, { status: 503 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return NextResponse.json({ code: "not_signed_in", message: "Sign in before purchasing this course." }, { status: 401 });
  const body = await request.json().catch(() => null) as { courseId?: unknown } | null;
  if (!Number.isSafeInteger(body?.courseId) || Number(body?.courseId) <= 0) return NextResponse.json({ code: "invalid_course", message: "Choose a valid course." }, { status: 400 });
  const courseId = Number(body?.courseId);
  if (configuration.mode === "test") {
    const { data: eligibilityData, error: eligibilityError } = await supabase.rpc("get_own_paystack_test_fixture_eligibility", { p_course_id: courseId });
    const eligible = (eligibilityData as { eligible?: unknown }[] | null)?.[0]?.eligible === true;
    if (eligibilityError || !eligible) {
      return NextResponse.json({ code: "fixture_not_eligible", message: "This controlled test checkout is not available for this account." }, { status: 403 });
    }
  }
  const admin = createAdminClient();
  const initializeFunction = configuration.mode === "live"
    ? "initialize_paystack_live_learning_order"
    : "initialize_paystack_test_learning_order";
  const { data, error } = await admin.rpc(initializeFunction, { p_learner_id: user.id, p_course_id: courseId });
  const order = (data as OrderRow[] | null)?.[0];
  if (error || !order) {
    const duplicate = error?.code === "23505";
    return NextResponse.json({ code: duplicate ? "purchase_exists" : "purchase_unavailable", message: duplicate ? "You already have access or a purchase in progress." : "This course cannot be purchased right now." }, { status: duplicate ? 409 : 400 });
  }
  try {
    const callback = new URL(configuration.callbackUrl); callback.searchParams.set("reference", order.order_reference);
    const initialize = configuration.mode === "live" ? initializePaystackLiveTransaction : initializePaystackTestTransaction;
    const initialized = await initialize({ email: user.email, amountMinor: order.amount_minor, reference: order.order_reference, callbackUrl: callback.href });
    const pendingFunction = configuration.mode === "live"
      ? "mark_paystack_live_learning_attempt_pending"
      : "mark_paystack_test_learning_attempt_pending";
    const { error: pendingError } = await admin.rpc(pendingFunction, { p_order_reference: order.order_reference });
    if (pendingError) throw pendingError;
    return NextResponse.json({ authorizationUrl: initialized.authorizationUrl, reference: order.order_reference });
  } catch (error) {
    const failFunction = configuration.mode === "live"
      ? "fail_paystack_live_learning_attempt"
      : "fail_paystack_test_learning_attempt";
    const { error: cleanupError } = await admin.rpc(failFunction, { p_order_reference: order.order_reference, p_failure_code: "paystack_initialize_failed", p_failure_message: error instanceof Error ? error.message : "Paystack initialization failed" });
    console.error("Growvelt Learning Paystack checkout initialization failed.", {
      reference: order.order_reference,
      mode: configuration.mode,
      message: error instanceof Error ? error.message : "Unknown error",
      cleanupFailed: Boolean(cleanupError),
    });
    return NextResponse.json({ code: "provider_unavailable", message: "Checkout could not be started. Please try again." }, { status: 502 });
  }
}
