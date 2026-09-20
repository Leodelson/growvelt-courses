import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const organizationId = Number((await params).organizationId);
  const body = await request.json().catch(() => null) as { decision?: unknown; note?: unknown } | null;
  const decision = body?.decision === "verified" || body?.decision === "rejected" ? body.decision : null;
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (!Number.isSafeInteger(organizationId) || organizationId < 1 || !decision || note.length > 2000 || (decision === "rejected" && note.length < 10)) return NextResponse.json({ code: "invalid_review" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_growvelt_learning_admin");
  if (isAdmin !== true) return NextResponse.json({ code: "forbidden" }, { status: 403 });
  const { data, error } = await supabase.rpc("review_learning_provider_organization_verification", { p_organization_id: organizationId, p_decision: decision, p_review_note: note || null });
  if (error) return NextResponse.json({ code: error.code === "P0002" ? "not_found" : error.code === "P0001" ? "not_pending" : error.code === "22023" ? "invalid_review" : "review_unavailable" }, { status: error.code === "P0002" ? 404 : error.code === "P0001" ? 409 : error.code === "22023" ? 400 : 500 });
  return NextResponse.json({ review: (data as unknown[] | null)?.[0] ?? null });
}
