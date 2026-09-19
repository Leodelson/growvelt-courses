import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { renderGrowveltEmail } from "@/app/lib/email/growvelt-email-template";

type NoticeType = "payment_access_ready" | "payment_attention" | "refund_requested" | "refund_processed" | "refund_attention" | "access_revoked" | "operator_dispute" | "operator_reconciliation";
type NoticeInput = { key: string; type: NoticeType; recipient: string; subject: string; heading: string; message: string; orderId?: number; caseId?: number };

export async function sendPaymentNotification(input: NoticeInput) {
 try {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("learning_payment_notifications").select("id,delivery_status").eq("idempotency_key", input.key).maybeSingle();
  if (existing?.delivery_status === "sent") return;
  const { data: delivery, error } = await admin.from("learning_payment_notifications").upsert({
    idempotency_key: input.key, notification_type: input.type, order_id: input.orderId ?? null,
    payment_case_id: input.caseId ?? null, recipient_email: input.recipient.toLowerCase(), delivery_status: "pending",
  }, { onConflict: "idempotency_key", ignoreDuplicates: false }).select("id").single();
  if (error || !delivery) { console.error("payment.notification_claim_failed", { type: input.type }); return; }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await admin.from("learning_payment_notifications").update({ delivery_status: "failed", last_error: "Email delivery is not configured", last_attempted_at: new Date().toISOString() }).eq("id", delivery.id);
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.key },
      body: JSON.stringify({ from: "Growvelt Learning <no-reply@growvelt.com>", to: [input.recipient], reply_to: input.type.startsWith("refund_") ? "refund@growvelt.com" : "support@growvelt.com", subject: input.subject,
        html: renderGrowveltEmail({ baseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://learn.growvelt.com", greeting: "there", title: input.heading, paragraphs: [input.message], reason: "You received this email because of activity on your Growvelt Learning account." }),
      }), signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => null) as { id?: string } | null;
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    await admin.from("learning_payment_notifications").update({ delivery_status: "sent", provider_message_id: body?.id ?? null, attempt_count: 1, last_error: null, last_attempted_at: new Date().toISOString(), sent_at: new Date().toISOString() }).eq("id", delivery.id);
  } catch (notificationError) {
    await admin.from("learning_payment_notifications").update({ delivery_status: "failed", attempt_count: 1, last_error: notificationError instanceof Error ? notificationError.message.slice(0,1000) : "Email delivery failed", last_attempted_at: new Date().toISOString() }).eq("id", delivery.id);
    console.error("payment.notification_delivery_failed", { type: input.type, deliveryId: delivery.id });
  }
 } catch (notificationError) {
   console.error("payment.notification_unavailable", { type: input.type, message: notificationError instanceof Error ? notificationError.message : "Notification unavailable" });
 }
}

export async function getOrderNotificationContext(reference: string) {
  try {
    const admin = createAdminClient();
    const { data: order } = await admin.from("learning_orders").select("id,learner_id,course_title_snapshot").eq("order_reference", reference).maybeSingle();
    if (!order?.learner_id) return null;
    const { data: profile } = await admin.from("profiles").select("email").eq("id", order.learner_id).maybeSingle();
    return profile?.email ? { orderId: Number(order.id), email: profile.email, courseTitle: order.course_title_snapshot } : null;
  } catch { console.error("payment.notification_context_unavailable", { reference }); return null; }
}

export function paymentOperationsRecipient() { return process.env.PAYMENTS_OPERATIONS_EMAIL?.trim() || "support@growvelt.com"; }
