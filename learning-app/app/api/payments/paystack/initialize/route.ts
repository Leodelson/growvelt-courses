import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { getPaystackTestConfig, initializePaystackTestTransaction } from "@/app/lib/payments/paystack";

type OrderRow = { order_id: number; order_reference: string; payment_attempt_id: number; amount_minor: number; currency: string };

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin", message: "This request was not accepted." }, { status: 403 });
  try { getPaystackTestConfig(true); } catch { return NextResponse.json({ code: "checkout_disabled", message: "Paid checkout is not available." }, { status: 503 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return NextResponse.json({ code: "not_signed_in", message: "Sign in before purchasing this course." }, { status: 401 });
  const body = await request.json().catch(() => null) as { courseId?: unknown } | null;
  if (!Number.isSafeInteger(body?.courseId) || Number(body?.courseId) <= 0) return NextResponse.json({ code: "invalid_course", message: "Choose a valid course." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("initialize_paystack_test_learning_order", { p_learner_id: user.id, p_course_id: Number(body?.courseId) });
  const order = (data as OrderRow[] | null)?.[0];
  if (error || !order) {
    const duplicate = error?.code === "23505";
    return NextResponse.json({ code: duplicate ? "purchase_exists" : "purchase_unavailable", message: duplicate ? "You already have access or a purchase in progress." : "This course cannot be purchased right now." }, { status: duplicate ? 409 : 400 });
  }
  try {
    const callback = new URL(getPaystackTestConfig(true).callbackUrl); callback.searchParams.set("reference", order.order_reference);
    const initialized = await initializePaystackTestTransaction({ email: user.email, amountMinor: order.amount_minor, reference: order.order_reference, callbackUrl: callback.href });
    const { error: pendingError } = await admin.rpc("mark_paystack_test_learning_attempt_pending", { p_order_reference: order.order_reference });
    if (pendingError) throw pendingError;
    return NextResponse.json({ authorizationUrl: initialized.authorizationUrl, reference: order.order_reference });
  } catch (error) {
    await admin.rpc("fail_paystack_test_learning_attempt", { p_order_reference: order.order_reference, p_failure_code: "paystack_initialize_failed", p_failure_message: error instanceof Error ? error.message : "Paystack initialization failed" });
    console.error("Growvelt Learning Paystack test initialization failed.", { reference: order.order_reference, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ code: "provider_unavailable", message: "Checkout could not be started. Please try again." }, { status: 502 });
  }
}
