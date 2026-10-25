import { NextResponse } from "next/server";
import { JsonBodyError, readBoundedJsonObject } from "@/app/lib/security/json-body";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string; memberId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const { organizationId: organizationIdText, memberId } = await params;
  const organizationId = Number(organizationIdText);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await readBoundedJsonObject(request, 4 * 1024); }
  catch (error) {
    if (!(error instanceof JsonBodyError)) throw error;
    return NextResponse.json({ code: "invalid_member" }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(memberId) || reason.length > 500) return NextResponse.json({ code: "invalid_member" }, { status: 400 });
  const { data, error } = await supabase.rpc("revoke_own_learning_provider_organization_member", { p_organization_id: organizationId, p_member_user_id: memberId, p_reason: reason || null });
  if (error) return NextResponse.json({ code: error.code === "42501" ? "organization_access_denied" : error.code === "P0002" ? "member_not_found" : error.code === "22023" ? "member_not_removable" : "member_revoke_unavailable" }, { status: error.code === "42501" ? 403 : 409 });
  return NextResponse.json({ membership: (data as unknown[] | null)?.[0] });
}
