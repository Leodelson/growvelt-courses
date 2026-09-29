import "server-only";
import { paymentOperationsRecipient, sendPaymentNotification } from "@/app/lib/email/payment-notifications";
import { createAdminClient } from "@/app/lib/supabase/admin";

/**
 * A verified provider charge must not be retried forever after its purchase
 * becomes terminal. Persist an idempotent operator notice before acknowledging
 * the webhook; this never grants another seat or changes the paid purchase.
 */
export async function recordCompanyPaymentManualReview(reference: string) {
  if (!/^CP-[A-F0-9]{32}$/.test(reference)) return false;
  const admin = createAdminClient();
  const { data: attempt, error: attemptError } = await admin
    .from("learning_company_paid_course_purchase_attempts")
    .select("purchase_id,status")
    .eq("provider", "paystack")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (attemptError || !attempt) return false;
  const { data: purchase, error: purchaseError } = await admin
    .from("learning_company_paid_course_purchases")
    .select("id,status")
    .eq("id", attempt.purchase_id)
    .maybeSingle();
  if (purchaseError || !purchase) return false;
  const needsReview = (purchase.status === "paid" && attempt.status !== "succeeded") ||
    ["cancelled", "expired"].includes(purchase.status) ||
    ["failed", "abandoned"].includes(attempt.status);
  if (!needsReview) return false;

  const key = `company-payment-manual-review:${reference}`;
  await sendPaymentNotification({
    key,
    type: "operator_reconciliation",
    recipient: paymentOperationsRecipient(),
    subject: "Growvelt Learning company payment needs review",
    heading: "A verified company charge needs reconciliation",
    message: `Paystack Test confirmed company transaction ${reference} for purchase ${purchase.id}, but that attempt cannot be finalized because the purchase or attempt is already in a terminal state. Review the provider transaction and purchase before any adjustment. No additional employee access was granted.`,
  });
  const { data: notice, error: noticeError } = await admin
    .from("learning_payment_notifications")
    .select("id")
    .eq("idempotency_key", key)
    .maybeSingle();
  return !noticeError && !!notice;
}
