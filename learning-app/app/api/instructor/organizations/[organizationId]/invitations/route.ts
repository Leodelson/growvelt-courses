import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

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
  if (error) return NextResponse.json({ code: "invitation_unavailable" }, { status: 409 });
  return NextResponse.json({ invitation: (data as unknown[] | null)?.[0] }, { status: 201 });
}
