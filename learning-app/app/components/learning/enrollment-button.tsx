"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import styles from "./enrollment-button.module.css";
import { createClient } from "@/app/lib/supabase/browser";

export function EnrollmentButton({ courseId, slug, isFree, isEnrolled, paidCheckoutEnabled = false, checkoutMode = "test", displayedPrice, testCouponCheckoutEnabled = false }: { courseId: number; slug: string; isFree: boolean; isEnrolled: boolean; paidCheckoutEnabled?: boolean; checkoutMode?: "test" | "live"; displayedPrice?: string; testCouponCheckoutEnabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  if (isEnrolled) return <div className="enrollment-actions"><Link className="button button-primary" href={`/dashboard/my-learning/${encodeURIComponent(slug)}`}>Continue Learning</Link><Link className="text-link" href="/dashboard/my-learning">View in My Learning</Link></div>;
  if (!isFree && !paidCheckoutEnabled) return <p className="enrollment-unavailable">Paid enrollment is not available yet.</p>;
  async function enroll() {
    if (pending) return;
    setPending(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("enroll_in_free_learning_course", { p_course_id: courseId });
    setPending(false);
    if (rpcError) {
      setError("We couldn’t enroll you right now. Please try again.");
      return;
    }
    router.refresh();
  }
  async function purchase() {
    if (pending) return;
    setPending(true); setError(null);
    const normalizedCoupon = couponCode.trim();
    const requestKey = normalizedCoupon ? checkoutKey ?? crypto.randomUUID() : null;
    if (requestKey) setCheckoutKey(requestKey);
    const response = await fetch("/api/payments/paystack/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId,
        ...(normalizedCoupon && requestKey ? { couponCode: normalizedCoupon, checkoutKey: requestKey } : {}),
      }),
    }).catch(() => null);
    if (response?.status === 401) { window.location.assign(`/sign-in?next=${encodeURIComponent(`/dashboard/courses/${slug}`)}`); return; }
    const result = await response?.json().catch(() => null) as { authorizationUrl?: unknown; message?: unknown } | null;
    if (!response?.ok || typeof result?.authorizationUrl !== "string") { if (response) setCheckoutKey(null); setPending(false); setError(typeof result?.message === "string" ? result.message : "Checkout could not be started. Please try again."); return; }
    window.location.assign(result.authorizationUrl);
  }
  if (!isFree) return <div className="enrollment-actions">
    {checkoutMode === "test" && testCouponCheckoutEnabled && <label className={styles.couponField}>
      <span>Coupon code (optional)</span>
      <input
        autoComplete="off"
        maxLength={24}
        name="couponCode"
        onChange={(event) => { setCouponCode(event.target.value); setCheckoutKey(null); }}
        placeholder="Enter coupon code"
        value={couponCode}
      />
      <small>A valid discount and the final Test Mode amount will be shown by Paystack before you confirm.</small>
    </label>}
    <ActionButton className="button button-primary" type="button" onClick={purchase} disabled={pending} isPending={pending} pendingLabel="Opening secure checkout…">Buy course · {checkoutMode === "live" ? "Live payment" : "Test mode"}</ActionButton>
    <p className="enrollment-unavailable">{displayedPrice ? `${displayedPrice} is the final displayed course price before any eligible promotion. ` : ""}Paystack processes payment. By continuing, you agree to the <Link href="/terms-of-service">Terms</Link> and <Link href="/refund-policy">Refund Policy</Link>. {checkoutMode === "live" ? "This is a real payment; access is granted only after Growvelt verifies the payment event." : "No real money is accepted in this test checkout."}</p>
    {error && <InlineFeedback variant="error">{error}</InlineFeedback>}
  </div>;
  return <div className="enrollment-actions"><ActionButton className="button button-primary" type="button" onClick={enroll} disabled={pending} isPending={pending} pendingLabel="Enrolling…">Enroll free</ActionButton>{error && <InlineFeedback variant="error">{error}</InlineFeedback>}</div>;
}
