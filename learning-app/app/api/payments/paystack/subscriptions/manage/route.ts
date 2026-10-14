import { NextResponse } from "next/server";
import { findPaystackTestSubscriptionCode, getPaystackTestSubscriptionManagementLink } from "@/app/lib/payments/paystack-subscriptions";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unavailable(request: Request) {
  const destination = new URL("/dashboard/subscriptions?management=unavailable", request.url);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) {
    const next = `${new URL(request.url).pathname}${new URL(request.url).search}`;
    return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(next)}`, request.url), 303);
  }

  const subscriptionId = new URL(request.url).searchParams.get("subscriptionId")?.trim() ?? "";
  if (!UUID_PATTERN.test(subscriptionId)) return NextResponse.json({ code: "not_found" }, { status: 404 });

  let admin;
  try { admin = createAdminClient(); } catch {
    return unavailable(request);
  }
  const { data: managementRows, error } = await admin.rpc("get_own_learning_subscription_management_details", {
    p_learner_id: user.id,
    p_subscription_id: subscriptionId,
  });
  if (error) {
    console.error("subscription.management_lookup_failed", { code: error.code });
    return unavailable(request);
  }
  const subscription = Array.isArray(managementRows) ? managementRows[0] as {
    subscription_code: string | null;
    payment_domain: string;
    subscription_status: string;
    plan_code: string | null;
    amount_minor: number | string;
    currency: string;
    billing_interval: string;
  } | undefined : undefined;
  if (!subscription) return NextResponse.json({ code: "not_found" }, { status: 404 });
  if (subscription.payment_domain !== "test"
    || !["active", "attention"].includes(subscription.subscription_status)) {
    return unavailable(request);
  }

  try {
    let subscriptionCode = typeof subscription.subscription_code === "string"
      ? subscription.subscription_code.trim()
      : "";
    if (!subscriptionCode) {
      if (!user.email || subscription.currency !== "NGN" || subscription.billing_interval !== "monthly"
        || typeof subscription.plan_code !== "string") return unavailable(request);
      subscriptionCode = await findPaystackTestSubscriptionCode({
        email: user.email,
        planCode: subscription.plan_code,
        amountMinor: Number(subscription.amount_minor),
      });
    }
    const managementUrl = await getPaystackTestSubscriptionManagementLink(subscriptionCode);
    const response = NextResponse.redirect(managementUrl, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    console.error("subscription.management_link_unavailable");
    return unavailable(request);
  }
}
