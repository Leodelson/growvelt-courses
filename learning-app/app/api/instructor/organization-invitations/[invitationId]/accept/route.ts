import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
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
  return NextResponse.json({ membership: (data as unknown[] | null)?.[0] });
}
