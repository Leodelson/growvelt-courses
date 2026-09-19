import "server-only";
import { renderGrowveltEmail } from "@/app/lib/email/growvelt-email-template";

type DeliveryStatus = "sent" | "not_configured" | "failed";

async function sendInstructorEmail(input: { idempotencyKey: string; recipient: string; subject: string; html: string; category: string }): Promise<DeliveryStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "not_configured";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({ from: "Growvelt <no-reply@growvelt.com>", to: [input.recipient], reply_to: "support@growvelt.com", subject: input.subject, html: input.html, tags: [{ name: "category", value: input.category }, { name: "product", value: "learning" }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`provider_${response.status}`);
    return "sent";
  } catch (error) {
    console.error("instructor.notification_delivery_failed", { category: input.category, message: error instanceof Error ? error.message : "unknown" });
    return "failed";
  }
}

export async function sendOrganizationInvitationEmail(input: { recipient: string; recipientName: string | null; organizationName: string; inviterName: string | null; role: "admin" | "instructor"; invitationId: number; appBaseUrl: string }) {
  return sendInstructorEmail({
    idempotencyKey: `growvelt-learning-organization-invitation-${input.invitationId}`,
    recipient: input.recipient,
    subject: `You’re invited to join ${input.organizationName} on Growvelt`,
    category: "organization_invitation",
    html: renderGrowveltEmail({ baseUrl: input.appBaseUrl, greeting: input.recipientName?.split(/\s+/)[0] || "there", title: "You’re invited to a training organization", paragraphs: [`${input.inviterName || "A Growvelt instructor"} invited you to join ${input.organizationName} as an ${input.role}.`, "Sign in to Growvelt Learning to review and accept this invitation. Your individual courses and earnings will remain your own."], primaryAction: { label: "View invitation", href: new URL("/dashboard/instructor/organizations", input.appBaseUrl).href }, highlights: ["The invitation is available from your Organizations page", "Accepting adds you to the provider workspace", "Your personal earnings remain separate"], reason: "You received this email because a Growvelt instructor invited you to a training organization." }),
  });
}

export async function sendInstructorApplicationApprovedEmail(input: { recipient: string; recipientName: string | null; userId: string; reviewedAt: string; appBaseUrl: string }) {
  return sendInstructorEmail({
    idempotencyKey: `growvelt-learning-instructor-approved-${input.userId}-${input.reviewedAt}`,
    recipient: input.recipient,
    subject: "You’re approved to teach on Growvelt",
    category: "instructor_application_approved",
    html: renderGrowveltEmail({ baseUrl: input.appBaseUrl, greeting: input.recipientName?.split(/\s+/)[0] || "there", title: "You’re approved to teach on Growvelt", paragraphs: ["Your instructor application has been approved. You can now access your Instructor workspace and begin creating course drafts.", "If you join a training organization, your organization role and personal earnings remain clearly separated."], primaryAction: { label: "Open Instructor workspace", href: new URL("/dashboard/instructor", input.appBaseUrl).href }, highlights: ["Create and manage course drafts", "Join approved training organizations", "Track your individual Instructor activity"], reason: "You received this email because Growvelt approved your instructor application." }),
  });
}
