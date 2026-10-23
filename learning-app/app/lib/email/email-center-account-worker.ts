import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { createEmailCenterResendTransport } from "./email-center-resend";
import { emailUuid, parseEmailDocument } from "./email-center";
import { deliverEmailCenterOperation } from "./email-center-delivery";
import { hasEmailCenterProviderHeadroom } from "./email-center-provider-usage";

// Internal worker, not a public route. Call only after the verified operator
// session AND existing Learning admin RPC. No client-supplied content/addresses.
export async function deliverLearningAccountNotice(input: {
  database: Pick<SupabaseClient, "from" | "rpc">;
  transport: Pick<ReturnType<typeof createEmailCenterResendTransport>, "sendTransactional" | "readSharedUsage">;
  actorId: string; draftId: string; revision: number; targetUserId: string;
  enabled?: boolean;
}) {
  if (input.enabled !== true) throw new Error("Delivery activation is required.");
  if (![input.actorId, input.draftId, input.targetUserId].every(value => emailUuid.test(value))
    || !Number.isSafeInteger(input.revision) || input.revision < 1) throw new Error("Invalid reviewed operation.");
  const draft = await input.database.from("learning_email_center_drafts").select("document,revision,status").eq("id", input.draftId).maybeSingle();
  const target = await input.database.from("learning_email_center_targets").select("email,first_name").eq("draft_id", input.draftId).eq("user_id", input.targetUserId).maybeSingle();
  if (draft.error || target.error || !draft.data || !target.data || draft.data.revision !== input.revision
    || !["reviewed", "sending", "accepted", "needs_review"].includes(draft.data.status)) throw new Error("The saved review could not be verified.");
  const document = parseEmailDocument(draft.data.document);
  const reviewedTarget = target.data;
  if (document.mode !== "transactional") throw new Error("Marketing requires the separate broadcast workflow.");
  const args = { p_actor: input.actorId, p_id: input.draftId, p_revision: input.revision, p_target_key: input.targetUserId };
  const rpc = async (name: string, values: object) => {
    const result = await input.database.rpc(name, values);
    if (result.error) throw new Error("The operation needs database review; do not resend.");
    return result.data;
  };
  // Existing terminal/uncertain attempts are never resent, including after a
  // response was lost. A separate reconciliation flow must resolve uncertainty.
  const existing = await input.database.from("learning_email_center_attempts").select("state").eq("draft_id", input.draftId).eq("target_key", input.targetUserId).maybeSingle();
  if (existing.error) throw new Error("Attempt history could not be verified.");
  if (existing.data) return { state: "already_claimed" as const };
  return deliverEmailCenterOperation({
    claim: async () => await rpc("claim_learning_email_center_attempt", args) === true,
    reserveBudget: async () => {
      if (await rpc("reserve_learning_email_center_budget", args) !== true) return false;
      try { return hasEmailCenterProviderHeadroom(await input.transport.readSharedUsage()); }
      catch { return false; }
    },
    checkpoint: async (state, providerId) => {
      await rpc("complete_learning_email_center_attempt", { p_actor: input.actorId, p_id: input.draftId,
        p_target_key: input.targetUserId, p_state: state, p_provider_id: providerId ?? null });
    },
  }, key => input.transport.sendTransactional({ document, email: reviewedTarget.email,
    firstName: reviewedTarget.first_name || "there", operationKey: key }),
  `learning-center-${input.draftId}-${input.revision}-${input.targetUserId}`, true);
}
