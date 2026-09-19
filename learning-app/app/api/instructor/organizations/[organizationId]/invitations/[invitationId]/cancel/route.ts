import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string; invitationId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const { organizationId: organizationIdText, invitationId: invitationIdText } = await params;
  const organizationId = Number(organizationIdText), invitationId = Number(invitationIdText);
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0 || !Number.isSafeInteger(invitationId) || invitationId <= 0) return NextResponse.json({ code: "invalid_invitation" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("cancel_own_learning_provider_organization_invitation", { p_organization_id: organizationId, p_invitation_id: invitationId });
  if (error) return NextResponse.json({ code: error.code === "P0001" ? "invitation_not_pending" : error.code === "42501" ? "organization_access_denied" : "invitation_unavailable" }, { status: error.code === "42501" ? 403 : 409 });
  const result = (data as Array<{ invitation_id: number }> | null)?.[0];
  if (!result?.invitation_id) return NextResponse.json({ code: "invitation_unavailable" }, { status: 409 });
  return NextResponse.json({ invitation: result });
}
