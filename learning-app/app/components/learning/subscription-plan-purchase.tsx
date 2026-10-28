"use client";

import { useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";

export type PublicTestSubscriptionPlan = {
  plan_id: string;
  name: string;
  description: string | null;
  amount_minor: number;
  currency: "NGN";
  billing_interval: "monthly";
  instructor_name: string;
  course_ids: number[];
  course_titles: string[];
};

export function SubscriptionPlanPurchase({ plan, privateTestCheckout = false }: { plan: PublicTestSubscriptionPlan; privateTestCheckout?: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function startCheckout() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    const requestId = crypto.randomUUID();
    const endpoint = privateTestCheckout
      ? "/api/payments/paystack/subscriptions/test-only/initialize"
      : "/api/payments/paystack/subscriptions/initialize";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.plan_id, requestId }),
    }).catch(() => null);
    if (response?.status === 401) {
      window.location.assign(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    const result = await response?.json().catch(() => null) as { authorizationUrl?: unknown; message?: unknown } | null;
    if (!response?.ok || typeof result?.authorizationUrl !== "string") {
      setPending(false);
      setMessage(typeof result?.message === "string" ? result.message : "Subscription checkout could not be started. Please try again.");
      return;
    }
    window.location.assign(result.authorizationUrl);
  }

  return <article className="subscription-plan-offer">
    <p className="eyebrow">{privateTestCheckout ? "Private learner preview" : "Monthly plan preview"}</p>
    <h3>{plan.name}</h3>
    {plan.description ? <p>{plan.description}</p> : null}
    <p className="subscription-plan-price">{new Intl.NumberFormat("en-NG", { style: "currency", currency: plan.currency }).format(plan.amount_minor / 100)} <span>/ month</span></p>
    <p>By {plan.instructor_name}. Includes {plan.course_titles.join(", ")}. Your existing one-time course purchases stay separate.</p>
    <ActionButton className="button button-secondary" type="button" onClick={startCheckout} disabled={pending} isPending={pending} pendingLabel="Opening checkout preview…">Continue to checkout preview</ActionButton>
    {message ? <InlineFeedback variant="error">{message}</InlineFeedback> : null}
    <small>This private preview is not available for real subscription purchases. Any access change requires a verified payment confirmation.</small>
  </article>;
}
