import "server-only";
import { renderGrowveltEmail } from "@/app/lib/email/growvelt-email-template";
import { createAdminClient } from "@/app/lib/supabase/admin";

type DeliveryStatus = "sent" | "not_configured" | "failed";
type NotificationType = "organization_invitation" | "organization_invitation_accepted" | "instructor_application_approved";

async function sendInstructorEmail(input: { idempotencyKey: string; type: NotificationType; recipient: string; subject: string; html: string; category: string; invitationId?: number; instructorUserId?: string }): Promise<DeliveryStatus> {
  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin.from("learning_instructor_notifications").upsert({
    idempotency_key: input.idempotencyKey, notification_type: input.type, organization_invitation_id: input.invitationId ?? null, instructor_user_id: input.instructorUserId ?? null, recipient_email: input.recipient.toLowerCase(), delivery_status: "pending",
  }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle();
  if (claimError) {
    console.error("instructor.notification_claim_failed", { category: input.category, code: claimError.code });
    return "failed";
  }
  if (!claimed) {
    const { data: existing } = await admin.from("learning_instructor_notifications").select("delivery_status").eq("idempotency_key", input.idempotencyKey).maybeSingle();
    return existing?.delivery_status === "sent" ? "sent" : existing?.delivery_status === "not_configured" ? "not_configured" : "failed";
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    await admin.from("learning_instructor_notifications").update({ delivery_status: "not_configured", last_error: "Email delivery is not configured", last_attempted_at: new Date().toISOString() }).eq("id", claimed.id);
    return "not_configured";
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({ from: "Growvelt <no-reply@growvelt.com>", to: [input.recipient], reply_to: "support@growvelt.com", subject: input.subject, html: input.html, tags: [{ name: "category", value: input.category }, { name: "product", value: "learning" }] }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json().catch(() => null) as { id?: string } | null;
    if (!response.ok) throw new Error(`provider_${response.status}`);
    await admin.from("learning_instructor_notifications").update({ delivery_status: "sent", provider_message_id: body?.id ?? null, attempt_count: 1, last_error: null, last_attempted_at: new Date().toISOString(), sent_at: new Date().toISOString() }).eq("id", claimed.id);
    return "sent";
  } catch (error) {
    console.error("instructor.notification_delivery_failed", { category: input.category, message: error instanceof Error ? error.message : "unknown" });
    await admin.from("learning_instructor_notifications").update({ delivery_status: "failed", attempt_count: 1, last_error: error instanceof Error ? error.message.slice(0, 1000) : "Email delivery failed", last_attempted_at: new Date().toISOString() }).eq("id", claimed.id);
    return "failed";
  }
}

export async function sendOrganizationInvitationEmail(input: { recipient: string; recipientName: string | null; organizationName: string; inviterName: string | null; role: "admin" | "instructor"; invitationId: number; appBaseUrl: string }) {
  return sendInstructorEmail({
    idempotencyKey: `growvelt-learning-organization-invitation-${input.invitationId}`,
    type: "organization_invitation",
    recipient: input.recipient,
    subject: `You’re invited to join ${input.organizationName} on Growvelt`,
    category: "organization_invitation",
    invitationId: input.invitationId,
    html: renderGrowveltEmail({ baseUrl: input.appBaseUrl, greeting: input.recipientName?.split(/\s+/)[0] || "there", title: "You’re invited to a training organization", paragraphs: [`${input.inviterName || "A Growvelt instructor"} invited you to join ${input.organizationName} as an ${input.role}.`, "Sign in to Growvelt Learning to review and accept this invitation. Your individual courses and earnings will remain your own."], primaryAction: { label: "View invitation", href: new URL("/dashboard/instructor/organizations", input.appBaseUrl).href }, highlights: ["The invitation is available from your Organizations page", "Accepting adds you to the provider workspace", "Your personal earnings remain separate"], reason: "You received this email because a Growvelt instructor invited you to a training organization." }),
  });
}

export async function sendInstructorApplicationApprovedEmail(input: { recipient: string; recipientName: string | null; userId: string; reviewedAt: string; appBaseUrl: string }) {
  return sendInstructorEmail({
    idempotencyKey: `growvelt-learning-instructor-approved-${input.userId}-${input.reviewedAt}`,
    type: "instructor_application_approved",
    recipient: input.recipient,
    subject: "You’re approved to teach on Growvelt",
    category: "instructor_application_approved",
    instructorUserId: input.userId,
    html: renderGrowveltEmail({ baseUrl: input.appBaseUrl, greeting: input.recipientName?.split(/\s+/)[0] || "there", title: "You’re approved to teach on Growvelt", paragraphs: ["Your instructor application has been approved. You can now access your Instructor workspace and begin creating course drafts.", "If you join a training organization, your organization role and personal earnings remain clearly separated."], primaryAction: { label: "Open Instructor workspace", href: new URL("/dashboard/instructor", input.appBaseUrl).href }, highlights: ["Create and manage course drafts", "Join approved training organizations", "Track your individual Instructor activity"], reason: "You received this email because Growvelt approved your instructor application." }),
  });
}

export async function sendOrganizationInvitationAcceptedEmail(input: { recipient: string; recipientName: string | null; organizationName: string; acceptedInstructorName: string | null; role: string; invitationId: number; respondedAt: string; appBaseUrl: string }) {
  return sendInstructorEmail({
    idempotencyKey: `growvelt-learning-organization-invitation-accepted-${input.invitationId}-${input.respondedAt}`,
    type: "organization_invitation_accepted",
    recipient: input.recipient,
    subject: `${input.acceptedInstructorName || "An instructor"} joined ${input.organizationName}`,
    category: "organization_invitation_accepted",
    invitationId: input.invitationId,
    html: renderGrowveltEmail({ baseUrl: input.appBaseUrl, greeting: input.recipientName?.split(/\s+/)[0] || "there", title: "Your organization invitation was accepted", paragraphs: [`${input.acceptedInstructorName || "The invited instructor"} accepted your invitation and is now an active ${input.role} in ${input.organizationName}.`, "They can create course drafts for this organization. Their individual courses and earnings remain separate."], primaryAction: { label: "View organization team", href: new URL("/dashboard/instructor/organizations", input.appBaseUrl).href }, highlights: ["The team roster has been updated", "The instructor can now attribute new course drafts", "Personal earnings remain separate"], reason: "You received this email because an instructor accepted your Growvelt training-organization invitation." }),
  });
}
