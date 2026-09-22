import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const workspaceId = Number((await params).workspaceId);
  if (!Number.isSafeInteger(workspaceId)) return NextResponse.json({ code: "invalid_workspace" }, { status: 400 });
  const body = await request.json().catch(() => null) as { courseId?: unknown; assignedUserIds?: unknown } | null;
  const courseId = Number(body?.courseId);
  const assignedUserIds = Array.isArray(body?.assignedUserIds) ? body.assignedUserIds.filter((value): value is string => typeof value === "string") : [];
  if (!Number.isSafeInteger(courseId) || assignedUserIds.length === 0 || new Set(assignedUserIds).size !== assignedUserIds.length) return NextResponse.json({ code: "purchase_invalid" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "not_authenticated" }, { status: 401 });
  const { data, error } = await supabase.rpc("prepare_learning_company_paid_course_purchase", { p_workspace_id: workspaceId, p_course_id: courseId, p_assigned_user_ids: assignedUserIds });
  if (error) {
    const code = error.code === "42501" ? "company_access_denied" : error.code === "23505" ? "purchase_exists" : error.code === "22023" ? "purchase_invalid" : "purchase_unavailable";
    return NextResponse.json({ code }, { status: code === "company_access_denied" ? 403 : 400 });
  }
  return NextResponse.json({ purchase: (data ?? [])[0] ?? null, checkout: "unavailable_pending_live_approval" }, { status: 201 });
}
