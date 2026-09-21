import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";
export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string; invitationId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const { workspaceId, invitationId } = await params; const workspace = Number(workspaceId); const invitation = Number(invitationId); if (!Number.isSafeInteger(workspace) || !Number.isSafeInteger(invitation)) return NextResponse.json({ code: "invalid_invitation" }, { status: 400 });
  const supabase = await createClient(); if (!(await supabase.auth.getUser()).data.user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { error } = await supabase.rpc("cancel_learning_company_invitation", { p_workspace_id: workspace, p_invitation_id: invitation }); if (error) return NextResponse.json({ code: "company_access_denied" }, { status: error.code === "42501" ? 403 : 409 }); return NextResponse.json({ ok: true });
}
