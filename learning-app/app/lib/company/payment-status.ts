import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";

export async function getCompanyPaymentForManager(reference: string, userId: string) {
  if (!/^CP-[A-F0-9]{32}$/.test(reference)) return null;
  const admin = createAdminClient();
  const { data: attempt, error: attemptError } = await admin.from("learning_company_paid_course_purchase_attempts")
    .select("purchase_id,status").eq("provider", "paystack").eq("provider_reference", reference).maybeSingle();
  if (attemptError) throw attemptError;
  if (!attempt) return null;
  const { data: purchase, error: purchaseError } = await admin.from("learning_company_paid_course_purchases")
    .select("id,workspace_id,status,course_title_snapshot,seat_count").eq("id", attempt.purchase_id).maybeSingle();
  if (purchaseError) throw purchaseError;
  if (!purchase) return null;
  const { data: membership, error: membershipError } = await admin.from("learning_company_memberships")
    .select("id").eq("workspace_id", purchase.workspace_id).eq("user_id", userId)
    .eq("status", "active").in("role", ["owner", "admin"]).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;
  return { purchaseId: purchase.id, workspaceId: purchase.workspace_id, status: purchase.status,
    attemptStatus: attempt.status, courseTitle: purchase.course_title_snapshot, seatCount: purchase.seat_count };
}
