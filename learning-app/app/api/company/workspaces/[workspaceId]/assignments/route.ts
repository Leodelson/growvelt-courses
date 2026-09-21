import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const workspaceKey = Number(workspaceId);
  if (!Number.isSafeInteger(workspaceKey)) return NextResponse.json({ code: "invalid_workspace" }, { status: 400 });
  const body = await request.json().catch(() => null) as { courseId?: unknown; assignedUserId?: unknown } | null;
  const courseId = Number(body?.courseId);
  const assignedUserId = typeof body?.assignedUserId === "string" ? body.assignedUserId : "";
  if (!Number.isSafeInteger(courseId) || !assignedUserId) return NextResponse.json({ code: "invalid_assignment" }, { status: 400 });
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return NextResponse.json({ code: "not_authenticated" }, { status: 401 });
  const { data, error } = await supabase.rpc("assign_learning_company_course", { p_workspace_id: workspaceKey, p_course_id: courseId, p_assigned_user_id: assignedUserId });
  if (error) {
    const code = error.code === "42501" ? "company_access_denied" : error.code === "22023" ? "course_not_assignable" : "assignment_unavailable";
    return NextResponse.json({ code }, { status: code === "company_access_denied" ? 403 : 400 });
  }
  return NextResponse.json({ assignment: (data ?? [])[0] ?? null }, { status: 201 });
}
