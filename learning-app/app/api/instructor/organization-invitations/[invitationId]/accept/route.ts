import { NextResponse } from "next/server";
import { sendOrganizationInvitationAcceptedEmail } from "@/app/lib/email/instructor-notifications";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const invitationId = Number((await params).invitationId);
  if (!Number.isSafeInteger(invitationId) || invitationId <= 0) return NextResponse.json({ code: "invalid_invitation" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("accept_own_learning_provider_organization_invitation", { p_invitation_id: invitationId });
  if (error) return NextResponse.json({ code: "acceptance_unavailable" }, { status: 409 });
  let notification: "sent" | "not_configured" | "failed" = "not_configured";
  try {
    const admin = createAdminClient();
    const { data: invitation } = await admin.from("learning_provider_organization_invitations").select("organization_id,invited_by,role,responded_at").eq("id", invitationId).eq("invited_user_id", user.id).maybeSingle();
    if (invitation?.responded_at) {
      const [organizationResult, ownerResult, instructorResult] = await Promise.all([
        admin.from("learning_provider_organizations").select("name").eq("id", invitation.organization_id).maybeSingle(),
        admin.from("profiles").select("email,full_name").eq("id", invitation.invited_by).maybeSingle(),
        admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);
      if (organizationResult.data?.name && ownerResult.data?.email) notification = await sendOrganizationInvitationAcceptedEmail({ recipient: ownerResult.data.email, recipientName: ownerResult.data.full_name ?? null, organizationName: organizationResult.data.name, acceptedInstructorName: instructorResult.data?.full_name ?? null, role: invitation.role, invitationId, respondedAt: invitation.responded_at, appBaseUrl: new URL(request.url).origin });
    }
  } catch (notificationError) {
    console.error("organization.invitation_acceptance_notification_failed", { invitationId, message: notificationError instanceof Error ? notificationError.message : "unknown" });
    notification = "failed";
  }
  return NextResponse.json({ membership: (data as unknown[] | null)?.[0], notification });
}
