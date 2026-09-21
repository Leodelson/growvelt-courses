import { NextResponse } from "next/server";
import { sendCompanyInvitationEmail } from "@/app/lib/email/company-notifications";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const workspaceId = Number((await params).workspaceId); const body = await request.json().catch(() => null) as { email?: unknown; role?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""; const role = body?.role === "admin" ? "admin" : body?.role === "member" ? "member" : "";
  if (!Number.isSafeInteger(workspaceId) || workspaceId < 1 || !/^\S+@\S+\.\S+$/.test(email) || !role) return NextResponse.json({ code: "invalid_invitation" }, { status: 400 });
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("create_learning_company_invitation", { p_workspace_id: workspaceId, p_invited_email: email, p_role: role });
  if (error) { const code = error.code === "23505" ? "already_member" : error.code === "P0001" ? "seat_limit_reached" : error.code === "42501" ? "company_access_denied" : "invitation_unavailable"; return NextResponse.json({ code }, { status: error.code === "42501" ? 403 : 409 }); }
  const invitation = (data as Array<{ invitation_id: number; role: "admin" | "member" }> | null)?.[0]; let notification: "sent" | "not_configured" | "failed" = "not_configured";
  if (invitation) { try { const admin = createAdminClient(); const [workspaceResult, inviterResult] = await Promise.all([admin.from("learning_company_workspaces").select("name").eq("id", workspaceId).maybeSingle(), admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle()]); if (workspaceResult.data?.name) notification = await sendCompanyInvitationEmail({ recipient: email, organizationName: workspaceResult.data.name, inviterName: inviterResult.data?.full_name ?? null, role: invitation.role, invitationId: invitation.invitation_id, appBaseUrl: new URL(request.url).origin }); } catch { notification = "failed"; } }
  return NextResponse.json({ invitation, notification }, { status: 201 });
}
