"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton } from "@/app/components/ui/action-button";
import { InlineFeedback } from "@/app/components/ui/inline-feedback";
import { createClient } from "@/app/lib/supabase/browser";

export function EnrollmentButton({ courseId, slug, isFree, isEnrolled, paidCheckoutEnabled = false }: { courseId: number; slug: string; isFree: boolean; isEnrolled: boolean; paidCheckoutEnabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const response = await fetch("/api/payments/paystack/initialize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId }) }).catch(() => null);
    if (response?.status === 401) { window.location.assign(`/sign-in?next=${encodeURIComponent(`/dashboard/courses/${slug}`)}`); return; }
    const result = await response?.json().catch(() => null) as { authorizationUrl?: unknown; message?: unknown } | null;
    if (!response?.ok || typeof result?.authorizationUrl !== "string") { setPending(false); setError(typeof result?.message === "string" ? result.message : "Checkout could not be started. Please try again."); return; }
    window.location.assign(result.authorizationUrl);
  }
  if (!isFree) return <div className="enrollment-actions"><ActionButton className="button button-primary" type="button" onClick={purchase} disabled={pending} isPending={pending} pendingLabel="Opening secure checkout…">Buy course · Test mode</ActionButton><p className="enrollment-unavailable">No real money is accepted in this test checkout.</p>{error && <InlineFeedback variant="error">{error}</InlineFeedback>}</div>;
  return <div className="enrollment-actions"><ActionButton className="button button-primary" type="button" onClick={enroll} disabled={pending} isPending={pending} pendingLabel="Enrolling…">Enroll free</ActionButton>{error && <InlineFeedback variant="error">{error}</InlineFeedback>}</div>;
}
