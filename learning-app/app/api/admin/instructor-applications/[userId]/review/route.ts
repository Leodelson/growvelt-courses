import { NextResponse } from "next/server";
import { sendInstructorApplicationApprovedEmail } from "@/app/lib/email/instructor-notifications";
import { isSameOriginRequest } from "@/app/lib/security/request-origin";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";

type ReviewBody = { decision?: unknown; reviewNote?: unknown };

function reviewErrorCode(error: { code?: string }) {
  if (error.code === "42501") return "admin_access_denied";
  if (error.code === "P0001") return "application_already_reviewed";
  if (error.code === "P0002") return "application_not_found";
  return "review_unavailable";
}

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  const userId = (await params).userId;
  const body = await request.json().catch(() => null) as ReviewBody | null;
  const decision = body?.decision === "approved" || body?.decision === "rejected" ? body.decision : null;
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) || !decision || reviewNote.length > 2000) return NextResponse.json({ code: "invalid_review" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("review_instructor_application", { p_application_user_id: userId, p_decision: decision, p_review_note: reviewNote || null });
  if (error) return NextResponse.json({ code: reviewErrorCode(error) }, { status: error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409 });

  let notification: "sent" | "not_configured" | "failed" | "not_applicable" = "not_applicable";
  if (decision === "approved") {
    try {
      const admin = createAdminClient();
      const [profileResult, applicationResult] = await Promise.all([
        admin.from("profiles").select("email,full_name").eq("id", userId).maybeSingle(),
        admin.from("instructor_profiles").select("reviewed_at").eq("user_id", userId).maybeSingle(),
      ]);
      if (profileResult.data?.email && applicationResult.data?.reviewed_at) notification = await sendInstructorApplicationApprovedEmail({ recipient: profileResult.data.email, recipientName: profileResult.data.full_name ?? null, userId, reviewedAt: applicationResult.data.reviewed_at, appBaseUrl: new URL(request.url).origin });
    } catch (notificationError) {
      console.error("instructor.approval_notification_context_failed", { userId, message: notificationError instanceof Error ? notificationError.message : "unknown" });
      notification = "failed";
    }
  }
  return NextResponse.json({ review: (data as unknown[] | null)?.[0] ?? null, notification });
}
