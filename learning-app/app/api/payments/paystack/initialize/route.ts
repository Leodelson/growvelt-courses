import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { classifyPaystackCheckoutRecovery, getPaystackConfig, getPaystackTestConfig, initializePaystackLiveTransaction, initializePaystackTestTransaction, PaystackVerificationError, verifyPaystackTransaction } from "@/app/lib/payments/paystack";
import type { PaystackConfiguration } from "@/app/lib/payments/paystack-config";
import { paystackCallbackForRequest } from "@/app/lib/payments/paystack-config";
import { getOrderNotificationContext, sendPaymentNotification } from "@/app/lib/email/payment-notifications";

type OrderRow = { order_id: number; order_reference: string; payment_attempt_id: number; amount_minor: number; currency: string };
type ActiveOrderRow = { id: number; order_reference: string; status: string };
type ActiveAttemptRow = { status: string; paystack_domain: string | null; initialized_at: string };

const PAYSTACK_ORDER_REFERENCE = /^GL-[A-F0-9]{32}$/;

async function recoverPriorCheckout(input: {
  admin: ReturnType<typeof createAdminClient>;
  learnerId: string;
  courseId: number;
}) {
  const { data: existingOrder, error: orderError } = await input.admin
    .from("learning_orders")
    .select("id, order_reference, status")
    .eq("learner_id", input.learnerId)
    .eq("course_id", input.courseId)
    .in("status", ["created", "payment_pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (orderError || !existingOrder || !PAYSTACK_ORDER_REFERENCE.test(existingOrder.order_reference)) {
    return { kind: "unavailable" as const };
  }

  const order = existingOrder as ActiveOrderRow;
  const { data: existingAttempt, error: attemptError } = await input.admin
    .from("learning_payment_attempts")
    .select("status, paystack_domain, initialized_at")
    .eq("order_id", order.id)
    .eq("provider", "paystack")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (attemptError || !existingAttempt) return { kind: "unavailable" as const };
  const attempt = existingAttempt as ActiveAttemptRow;
  if (!["initialized", "pending"].includes(attempt.status)) return { kind: "unavailable" as const };

  // Legacy attempts without an explicit domain are test-domain records. Verify
  // the exact existing attempt's domain; never infer it from the current mode.
  const domain = attempt.paystack_domain === "live" ? "live" : "test";
  let verified: Awaited<ReturnType<typeof verifyPaystackTransaction>>;
  try {
    verified = await verifyPaystackTransaction(order.order_reference, domain);
  } catch (error) {
    return {
      kind: "verification_failed" as const,
      reason: error instanceof PaystackVerificationError ? error.kind : "inconclusive" as const,
    };
  }

  const recoveryState = classifyPaystackCheckoutRecovery(verified.status, attempt.initialized_at);
  if (verified.status === "success") {
    const payload = {
      transaction_id: verified.transactionId,
      reference: verified.reference,
      amount: verified.requestedAmountMinor,
      requested_amount: verified.requestedAmountMinor,
      charged_amount: verified.amountMinor,
      fees: verified.feesMinor,
      currency: verified.currency,
      domain: verified.domain,
      status: verified.status,
      paid_at: verified.paidAt,
    };
    const { data, error } = await input.admin.rpc("reconcile_own_paystack_learning_payment", {
      p_learner_id: input.learnerId,
      p_reference: order.order_reference,
      p_provider_transaction_id: verified.transactionId,
      p_amount_minor: verified.amountMinor,
      p_requested_amount_minor: verified.requestedAmountMinor,
      p_fees_minor: verified.feesMinor,
      p_currency: verified.currency,
      p_domain: verified.domain,
      p_payload: payload,
    });
    if (error) return { kind: "unavailable" as const };

    const result = (data as Array<{ outcome?: string; event_id?: number }> | null)?.[0];
    const outcome = result?.outcome ?? "unknown";
    if (!["paid_and_enrolled", "already_paid", "already_processed"].includes(outcome)) {
      return { kind: "unavailable" as const };
    }
    if (outcome === "paid_and_enrolled" && result?.event_id) {
      try {
        const context = await getOrderNotificationContext(order.order_reference);
        if (context) await sendPaymentNotification({
          key: `payment-ready:provider-api:${result.event_id}`,
          type: "payment_access_ready",
          recipient: context.email,
          greeting: context.firstName ?? "there",
          subject: "Your Growvelt course is ready",
          heading: "Payment confirmed, access is ready",
          message: `Growvelt confirmed your payment for ${context.courseTitle}. The course is now available in My Courses.`,
          orderId: context.orderId,
        });
      } catch (error) {
        console.error("payment.access_notification_failed", {
          reference: order.order_reference,
          eventId: result.event_id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
    return { kind: "paid" as const, outcome };
  }

  if (recoveryState === "pending") return { kind: "unavailable" as const };
  if (recoveryState === "cooldown") {
    return { kind: "waiting" as const };
  }

  const failureFunction = domain === "live"
    ? "fail_paystack_live_learning_attempt"
    : "fail_paystack_test_learning_attempt";
  const { error: failureError } = await input.admin.rpc(failureFunction, {
    p_order_reference: order.order_reference,
    p_failure_code: `provider_${verified.status}`,
    p_failure_message: verified.status === "abandoned"
      ? "Paystack verified that checkout was abandoned."
      : "Paystack verified that checkout failed.",
  });
  return failureError ? { kind: "unavailable" as const } : { kind: "released" as const };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin", message: "This request was not accepted." }, { status: 403 });
  let configuration: PaystackConfiguration;
  try {
    configuration = getPaystackConfig(true);
    configuration.callbackUrl = paystackCallbackForRequest(request.url, configuration.callbackUrl);
    if (configuration.mode === "live" && !configuration.liveLearnerCheckoutEnabled) {
      throw new Error("Live learner checkout is disabled.");
    }
    if (configuration.mode === "test") getPaystackTestConfig(true);
  } catch { return NextResponse.json({ code: "checkout_disabled", message: "Paid checkout is not available." }, { status: 503 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return NextResponse.json({ code: "not_signed_in", message: "Sign in before purchasing this course." }, { status: 401 });
  const body = await request.json().catch(() => null) as { courseId?: unknown; couponCode?: unknown; checkoutKey?: unknown } | null;
  if (!Number.isSafeInteger(body?.courseId) || Number(body?.courseId) <= 0) return NextResponse.json({ code: "invalid_course", message: "Choose a valid course." }, { status: 400 });
  const courseId = Number(body?.courseId);
  const couponCode = typeof body?.couponCode === "string" ? body.couponCode.trim() : "";
  if (body?.couponCode !== undefined && typeof body.couponCode !== "string") {
    return NextResponse.json({ code: "invalid_checkout", message: "Checkout details are invalid." }, { status: 400 });
  }
  if (couponCode && !/^[A-Za-z0-9][A-Za-z0-9_-]{3,23}$/.test(couponCode)) {
    return NextResponse.json({ code: "invalid_checkout", message: "Enter a valid coupon code." }, { status: 400 });
  }
  if (couponCode && (configuration.mode !== "test" || process.env.PAYMENTS_TEST_COUPONS_ENABLED !== "true")) {
    return NextResponse.json({ code: "coupon_checkout_disabled", message: "Coupon checkout is not available right now." }, { status: 503 });
  }
  if (couponCode && (typeof body?.checkoutKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.checkoutKey))) {
    return NextResponse.json({ code: "invalid_checkout", message: "Refresh the page and try checkout again." }, { status: 400 });
  }
  if (configuration.mode === "test") {
    const { data: eligibilityData, error: eligibilityError } = await supabase.rpc("get_own_paystack_test_fixture_eligibility", { p_course_id: courseId });
    const eligible = (eligibilityData as { eligible?: unknown }[] | null)?.[0]?.eligible === true;
    if (eligibilityError || !eligible) {
      return NextResponse.json({ code: "fixture_not_eligible", message: "This purchase option is not available for this account." }, { status: 403 });
    }
  }
  const admin = createAdminClient();
  const initializeFunction = couponCode
    ? "initialize_paystack_test_learning_order_with_coupon"
    : configuration.mode === "live"
      ? "initialize_paystack_live_learning_order"
      : "initialize_paystack_test_learning_order";
  const initializeArgs = couponCode
    ? { p_learner_id: user.id, p_course_id: courseId, p_coupon_code: couponCode, p_reservation_key: body?.checkoutKey as string }
    : { p_learner_id: user.id, p_course_id: courseId };
  let { data, error } = await admin.rpc(initializeFunction, initializeArgs);
  let order = (data as OrderRow[] | null)?.[0];
  if (error || !order) {
    const duplicate = error?.code === "23505";
    if (duplicate && !couponCode) {
      const recovery = await recoverPriorCheckout({ admin, learnerId: user.id, courseId });
      if (recovery.kind === "paid") {
        return NextResponse.json({ outcome: recovery.outcome, message: "Your payment is verified. Updating your course access." });
      }
      if (recovery.kind === "waiting") {
        return NextResponse.json({ code: "purchase_pending", message: "Your previous checkout was confirmed as failed or abandoned. To help prevent a duplicate charge, please try again 30 minutes after you started checkout. We haven’t started another payment. If 30 minutes have already passed and you still see this message, contact support." }, { status: 409 });
      }
      if (recovery.kind === "released") {
        ({ data, error } = await admin.rpc(initializeFunction, initializeArgs));
        order = (data as OrderRow[] | null)?.[0];
        if (!error && order) {
          // Continue with the newly created attempt below.
        } else {
          return NextResponse.json({ code: "purchase_pending", message: "Your previous checkout is being resolved. Please check again shortly; no second payment was started." }, { status: 409 });
        }
      } else if (recovery.kind === "verification_failed") {
        const messages = {
          not_found: "We couldn’t find a record of your previous checkout in the payment account currently checked. This can happen if the wrong payment account was used. No new payment has been started; please contact support so we can confirm it before you retry.",
          configuration: "We couldn’t confirm the payment account for your previous checkout. No new payment has been started; please contact support before trying again.",
          temporary: "Payment verification is temporarily unavailable. No new payment has been started. Please wait a few minutes and try again; if this continues, contact support.",
          inconclusive: "We couldn’t safely confirm your previous checkout. No new payment has been started. Please contact support before trying again.",
        } as const;
        return NextResponse.json({ code: "purchase_verification_failed", reason: recovery.reason, message: messages[recovery.reason] }, { status: 409 });
      } else {
        return NextResponse.json({ code: "purchase_pending", message: "Your previous checkout is being resolved. Please check again shortly; no second payment was started." }, { status: 409 });
      }
    } else {
      return NextResponse.json({ code: duplicate ? "purchase_exists" : "purchase_unavailable", message: duplicate ? "You already have access or a purchase in progress." : "This course cannot be purchased right now." }, { status: duplicate ? 409 : 400 });
    }
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
    console.error("Growvelt Paystack checkout initialization failed.", {
      reference: order.order_reference,
      mode: configuration.mode,
      message: error instanceof Error ? error.message : "Unknown error",
      cleanupFailed: Boolean(cleanupError),
    });
    return NextResponse.json({ code: "provider_unavailable", message: "Checkout could not be started. Please try again." }, { status: 502 });
  }
}
