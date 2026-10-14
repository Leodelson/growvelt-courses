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
  const { data: subscription, error } = await admin.from("learning_subscriptions")
    .select("id,plan_id,paystack_subscription_code,payment_domain,status")
    .eq("id", subscriptionId)
    .eq("learner_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("subscription.management_lookup_failed", { code: error.code });
    return unavailable(request);
  }
  if (!subscription) return NextResponse.json({ code: "not_found" }, { status: 404 });
  if (subscription.payment_domain !== "test"
    || !["active", "attention"].includes(subscription.status)) {
    return unavailable(request);
  }

  try {
    let subscriptionCode = typeof subscription.paystack_subscription_code === "string"
      ? subscription.paystack_subscription_code.trim()
      : "";
    if (!subscriptionCode) {
      if (!user.email) return unavailable(request);
      const { data: plan, error: planError } = await admin.from("learning_subscription_plans")
        .select("paystack_plan_code,amount_minor,currency,billing_interval")
        .eq("id", subscription.plan_id)
        .maybeSingle();
      if (planError || plan?.currency !== "NGN" || plan.billing_interval !== "monthly"
        || typeof plan.paystack_plan_code !== "string") {
        if (planError) console.error("subscription.management_plan_lookup_failed", { code: planError.code });
        return unavailable(request);
      }
      subscriptionCode = await findPaystackTestSubscriptionCode({
        email: user.email,
        planCode: plan.paystack_plan_code,
        amountMinor: plan.amount_minor,
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
