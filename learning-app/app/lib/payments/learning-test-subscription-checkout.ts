import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { getPaystackTestConfig } from "@/app/lib/payments/paystack";
import { initializePaystackTestSubscriptionCheckout, PaystackTestSubscriptionCheckoutError } from "@/app/lib/payments/paystack-subscriptions";
import { canStartTestSubscriptionCheckout, canUsePrivateTestSubscriptionCheckout } from "@/app/lib/subscriptions/feature";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CheckoutReservation = {
  outcome: string;
  subscription_id: string | null;
  invoice_id: string | null;
  reference: string | null;
  amount_minor: number | string | null;
  plan_code: string | null;
  authorization_url: string | null;
};

type PrivateTestPlan = { plan_id: string };

export async function handleLearningTestSubscriptionCheckout(
  request: Request,
  options: { privateTestOnly: boolean },
) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  if (!canStartTestSubscriptionCheckout()) {
    return NextResponse.json({ code: "subscription_checkout_disabled", message: "Test Mode subscriptions are not available right now." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return NextResponse.json({ code: "not_signed_in", message: "Sign in before starting a subscription." }, { status: 401 });
  if (options.privateTestOnly && !canUsePrivateTestSubscriptionCheckout(user.email)) {
    return NextResponse.json({ code: "not_found", message: "This private Test Mode checkout is unavailable." }, { status: 404 });
  }

  const body = await request.json().catch(() => null) as { planId?: unknown; requestId?: unknown } | null;
  if (typeof body?.planId !== "string" || !UUID_PATTERN.test(body.planId)
    || typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) {
    return NextResponse.json({ code: "invalid_checkout", message: "Refresh the page and try again." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ code: "subscription_checkout_unavailable", message: "This subscription could not be started right now." }, { status: 503 });
  }

  const { data: privatePlanData, error: privatePlanError } = await admin.rpc(
    "get_company_test_learning_subscription_plan_for_checkout",
    { p_plan_id: body.planId },
  );
  const privatePlan = (privatePlanData as PrivateTestPlan[] | null)?.[0];
  if (privatePlanError) {
    if (options.privateTestOnly) {
      console.error("subscription.private_test_plan_lookup_failed", { learnerId: user.id, code: privatePlanError.code });
      return NextResponse.json({ code: "subscription_checkout_unavailable", message: "Private Test Mode checkout is not ready in this environment." }, { status: 503 });
    }
    // Older databases still reject Company Test Mode-only courses in the
    // reservation function, while ordinary public plans remain usable.
  } else if (options.privateTestOnly) {
    if (!privatePlan || privatePlan.plan_id !== body.planId) {
      return NextResponse.json({ code: "not_found", message: "This private Test Mode checkout is unavailable." }, { status: 404 });
    }
  } else if (privatePlan?.plan_id === body.planId) {
    return NextResponse.json({ code: "not_found", message: "This private Test Mode checkout is unavailable." }, { status: 404 });
  }

  const { data, error } = await admin.rpc("begin_own_learning_test_subscription_checkout", {
    p_learner_id: user.id,
    p_plan_id: body.planId,
    p_request_id: body.requestId,
  });
  const reservation = (data as CheckoutReservation[] | null)?.[0];
  if (error || !reservation) {
    console.error("subscription.checkout_reservation_failed", { learnerId: user.id, code: error?.code });
    return NextResponse.json({ code: "subscription_checkout_unavailable", message: "This subscription could not be started. Please try again shortly." }, { status: 503 });
  }
  if (reservation.outcome === "ready" && reservation.authorization_url) {
    return NextResponse.json({ authorizationUrl: reservation.authorization_url, reference: reservation.reference });
  }
  const amountMinor = Number(reservation.amount_minor);
  if (reservation.outcome !== "initialize" || !reservation.subscription_id || !reservation.invoice_id
    || !reservation.reference || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !reservation.plan_code) {
    const message = reservation.outcome === "already_subscribed"
      ? "You already have an active subscription or paid access for this plan."
      : reservation.outcome === "needs_reconciliation"
        ? "This subscription checkout needs a safety review. Please do not pay again."
        : "A checkout request is already being processed. Please wait and try again.";
    return NextResponse.json({ code: reservation.outcome, message }, { status: 409 });
  }

  try {
    const configuration = getPaystackTestConfig(true);
    const callback = new URL(configuration.callbackUrl);
    callback.searchParams.set("reference", reservation.reference);
    const checkout = await initializePaystackTestSubscriptionCheckout({
      email: user.email,
      amountMinor,
      reference: reservation.reference,
      planCode: reservation.plan_code,
      callbackUrl: callback.href,
      subscriptionId: reservation.subscription_id,
      invoiceId: reservation.invoice_id,
    });
    const { data: finished, error: finishError } = await admin.rpc("finish_own_learning_test_subscription_checkout", {
      p_request_id: body.requestId,
      p_outcome: "ready",
      p_authorization_url: checkout.authorizationUrl,
    });
    if (finishError || finished !== "ready") throw new Error("Checkout URL could not be saved safely.");
    return NextResponse.json({ authorizationUrl: checkout.authorizationUrl, reference: reservation.reference });
  } catch (error) {
    const outcome = error instanceof PaystackTestSubscriptionCheckoutError ? error.disposition : "ambiguous";
    const { error: finishError } = await admin.rpc("finish_own_learning_test_subscription_checkout", {
      p_request_id: body.requestId,
      p_outcome: outcome,
    });
    console.error("subscription.test_checkout_initialization_failed", {
      learnerId: user.id,
      reference: reservation.reference,
      disposition: outcome,
      cleanupFailed: Boolean(finishError),
    });
    return NextResponse.json({
      code: outcome === "rejected" ? "provider_rejected" : "provider_outcome_uncertain",
      message: outcome === "rejected"
        ? "Paystack did not start this checkout. You can safely try again."
        : "We could not confirm whether checkout started. Please do not pay again; this attempt is held for review.",
    }, { status: outcome === "rejected" ? 502 : 503 });
  }
}
