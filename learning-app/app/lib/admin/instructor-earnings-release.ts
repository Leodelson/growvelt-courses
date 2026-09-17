import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";

const RELEASE_BATCH_LIMIT = 100;
export type EarningsReleaseSource = "scheduler" | "admin_recovery";

export async function runMaturedInstructorEarningsRelease(source: EarningsReleaseSource, actorUserId: string | null) {
  const admin = createAdminClient();
  const { data: runId, error: startError } = await admin.rpc("start_learning_instructor_earnings_release_run", {
    p_invocation_source: source,
    p_actor_user_id: actorUserId,
  });
  if (startError || typeof runId !== "number") throw new Error("Unable to start the earnings release operation.");

  try {
    const { data: releasedCount, error: executeError } = await admin.rpc("execute_learning_instructor_earnings_release_run", {
      p_run_id: runId,
    });
    if (executeError || typeof releasedCount !== "number" || releasedCount < 0 || releasedCount > RELEASE_BATCH_LIMIT) throw new Error("Earnings release execution failed.");
    return { releasedCount };
  } catch (error) {
    const { error: auditError } = await admin.rpc("fail_learning_instructor_earnings_release_run", {
      p_run_id: runId,
      p_failure_code: "release_execution_failed",
    });
    if (auditError) console.error("commercial.earnings_release_audit_failed", { source, runId });
    console.error("commercial.earnings_release_failed", { source, runId });
    throw error;
  }
}
