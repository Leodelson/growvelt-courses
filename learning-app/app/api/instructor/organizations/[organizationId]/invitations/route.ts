import { NextResponse } from "next/server";
import { sendOrganizationInvitationEmail } from "@/app/lib/email/instructor-notifications";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

function invitationErrorCode(error: { code?: string; message?: string }) {
  if (error.code === "P0002") return "invitee_not_found";
  if (error.code === "23505") return "already_member";
  if (error.message?.toLowerCase().includes("approved instructor")) return "invitee_not_approved";
  if (error.code === "42501") return "organization_access_denied";
  return "invitation_unavailable";
}

export async function GET(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const organizationId = Number((await params).organizationId);
  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() || "";
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0 || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ code: "invalid_invitation" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("list_own_learning_provider_organization_invitations_as_owner", { p_organization_id: organizationId });
  if (error) return NextResponse.json({ code: "organization_access_denied" }, { status: 403 });
  const invitation = (data as Array<{ invitation_id: number; invited_email: string; role: string; status: string }> | null)?.find((item) => item.invited_email === email && item.status === "pending") ?? null;
  return NextResponse.json({ invitation }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const organizationId = Number((await params).organizationId);
  const body = await request.json().catch(() => null) as { email?: unknown; role?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role === "admin" || body?.role === "instructor" ? body.role : "";
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0 || !/^\S+@\S+\.\S+$/.test(email) || !role) return NextResponse.json({ code: "invalid_invitation" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("create_learning_provider_organization_invitation", { p_organization_id: organizationId, p_invited_email: email, p_role: role });
  if (error) return NextResponse.json({ code: invitationErrorCode(error) }, { status: error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409 });
  const invitation = (data as Array<{ invitation_id: number; invited_email: string; role: "admin" | "instructor" }> | null)?.[0];
  let notification: "sent" | "not_configured" | "failed" = "not_configured";
  if (invitation) {
    try {
      const admin = createAdminClient();
      const [organizationResult, inviterResult, recipientResult] = await Promise.all([
        admin.from("learning_provider_organizations").select("name").eq("id", organizationId).maybeSingle(),
        admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        admin.from("profiles").select("full_name").eq("email", email).maybeSingle(),
      ]);
      if (organizationResult.data?.name) notification = await sendOrganizationInvitationEmail({ recipient: email, recipientName: recipientResult.data?.full_name ?? null, organizationName: organizationResult.data.name, inviterName: inviterResult.data?.full_name ?? null, role: invitation.role, invitationId: invitation.invitation_id, appBaseUrl: new URL(request.url).origin });
    } catch (notificationError) {
      console.error("organization.invitation_notification_context_failed", { organizationId, message: notificationError instanceof Error ? notificationError.message : "unknown" });
      notification = "failed";
    }
  }
  return NextResponse.json({ invitation, notification }, { status: 201 });
}
