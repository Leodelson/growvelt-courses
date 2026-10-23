import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { createEmailCenterResendTransport } from "./email-center-resend";
import type { LearningConsentProvider } from "./email-center-consent-provider";
import { emailUuid, parseEmailDocument } from "./email-center";
import { LEARNING_EMAIL_SEGMENT_ID, planLearningAudienceSync, verifyLearningBroadcastAudience, type LearningAudienceAccount } from "./email-center-audience";

type Transport = ReturnType<typeof createEmailCenterResendTransport>;
type Input = {
  database: Pick<SupabaseClient, "from" | "rpc">; transport: Transport; membership: LearningConsentProvider;
  actorId: string; draftId: string; revision: number; enabled?: boolean;
};
type Operation = { phase: string; provider_id: string | null; revision: number };
type Review = { document: unknown; targets: (LearningAudienceAccount & { firstName: string })[] };

// Every public caller must first authenticate the confirmed designated operator
// AND the existing Learning admin RPC. Inputs never contain message/recipients.
export async function runLearningBroadcast(input: Input, action: "prepare" | "dispatch" | "reconcile" | "cancel") {
  if (input.enabled !== true) throw new Error("Broadcast release is not activated.");
  if (![input.actorId, input.draftId].every(id => emailUuid.test(id)) || !Number.isSafeInteger(input.revision) || input.revision < 1) throw new Error("Invalid saved operation.");
  const args = { p_actor: input.actorId, p_id: input.draftId, p_revision: input.revision };
  async function rpc(name: string, values: object) {
    const result = await input.database.rpc(name, values);
    if (result.error) throw new Error("Database checkpoint needs review. Do not recreate or resend this operation.");
    return result.data;
  }
  async function readReview(): Promise<Review> {
    const result = await rpc("read_learning_email_center_review", args);
    if (!result || !Array.isArray(result.targets)) throw new Error("Saved recipients could not be checked.");
    return result;
  }
  async function operation(): Promise<Operation | null> {
    const result = await input.database.from("learning_email_broadcast_operations").select("phase,provider_id,revision").eq("draft_id", input.draftId).maybeSingle();
    if (result.error || result.data && result.data.revision !== input.revision) throw new Error("Operation history needs review.");
    return result.data;
  }
  async function advance(expected: string, next: string, providerId: string | null = null, providerStatus: string | null = null) {
    if (!await rpc("advance_learning_email_broadcast", { p_actor: input.actorId, p_id: input.draftId,
      p_expected: expected, p_next: next, p_provider_id: providerId, p_provider_status: providerStatus })) throw new Error("Another worker changed this operation. Reconcile; do not resend.");
  }
  const key = `learning-center-${input.draftId}-${input.revision}-broadcast`;
  async function audience(review: Review, changeMembership = false) {
    const providerCatalog = await input.transport.readAudience(), segment = await input.transport.readAudience(true);
    const values = { segmentId: LEARNING_EMAIL_SEGMENT_ID, accounts: review.targets, providerCatalog, segment };
    const plan = planLearningAudienceSync(values);
    if (plan.missingContactEmails.length) throw new Error("Confirmed opted-in contacts need a separately approved provider import. No contacts were created.");
    if (changeMembership) {
      for (const id of plan.removeContactIds) await input.membership.setMember(id, false);
      for (const id of plan.addContactIds) await input.membership.setMember(id, true);
      // Exact read-back, not the local recipient count or provider's API success.
      return verifyLearningBroadcastAudience({ ...values, providerCatalog: await input.transport.readAudience(), segment: await input.transport.readAudience(true) });
    }
    return verifyLearningBroadcastAudience(values);
  }
  if (action === "prepare") {
    // Reject imports before taking the non-expiring lease. Existing provider
    // global suppression remains authoritative; never re-subscribe contacts.
    const preflight = await readReview();
    const plan = planLearningAudienceSync({ segmentId: LEARNING_EMAIL_SEGMENT_ID, accounts: preflight.targets,
      providerCatalog: await input.transport.readAudience(), segment: await input.transport.readAudience(true) });
    if (plan.missingContactEmails.length) throw new Error("Confirmed opted-in contacts need a separately approved provider import. No contacts were created.");
    const usage = await input.transport.readMarketingUsage();
    if (Date.now() - usage.checkedAt > 5000 || usage.contacts.used > usage.contacts.limit) throw new Error("Fresh shared free-plan usage verification is required.");
    if (!await rpc("start_learning_email_broadcast", { ...args, p_holder: randomUUID() })) return { state: "already_claimed" };
    const review = await readReview(), document = parseEmailDocument(review.document);
    // Any uncertain membership mutation retains the segment lease. It cannot
    // expire while an old HTTP request may still be changing the shared segment.
    const checked = await audience(review, true);
    await readReview();
    await advance("syncing", "creating");
    const draft = await input.transport.createBroadcastDraft({ document, segmentId: LEARNING_EMAIL_SEGMENT_ID, operationKey: key });
    await advance("creating", "draft", draft.id, "draft");
    return { state: "draft", recipients: checked.recipients, suppressed: checked.suppressed };
  }
  const op = await operation();
  if (!op) throw new Error("Prepare the saved broadcast first.");
  if (["sent", "canceled", "abandoned"].includes(op.phase)) return { state: op.phase };
  if (op.phase === "syncing") return { state: "needs_review", notice: "Audience synchronization was interrupted. The lease stays locked; operator reconciliation is required before any new campaign." };
  // Recover a lost create response by a full, unique operation-name lookup.
  // The browser is never allowed to supply/adopt an arbitrary provider ID.
  const providerId = op.provider_id ?? await input.transport.findBroadcast(key);
  const saved = await input.database.from("learning_email_center_drafts").select("document").eq("id", input.draftId).maybeSingle();
  if (saved.error || !saved.data) throw new Error("Saved content could not be verified.");
  const document = parseEmailDocument(saved.data.document);
  let remote = await input.transport.getBroadcast(providerId);
  if (!input.transport.matchesBroadcast(remote, document, key)) throw new Error("Provider content or audience changed. Quarantined; no send or lease release.");
  if (op.phase === "creating") {
    if (remote.status !== "draft") throw new Error("An uncheckpointed provider draft was changed outside Growvelt. Operator review required.");
    await advance("creating", "draft", providerId, "draft");
    return { state: "draft", notice: "Recovered the existing provider draft. Nothing was sent." };
  }
  if (action === "dispatch") {
    if (op.phase !== "draft" || remote.status !== "draft") return { state: "already_claimed" };
    const review = await readReview();
    const checked = await audience(review);
    await readReview();
    // Durable claim and release approval before the only POST /send call.
    await advance("draft", "dispatching", providerId, "draft");
    await input.transport.sendBroadcast(providerId);
    // A lost send reply or failed checkpoint stays dispatching. Reconciliation
    // only reads status; even a provider 'draft' never means it is safe to retry.
    remote = await input.transport.getBroadcast(providerId);
    if (!input.transport.matchesBroadcast(remote, document, key)) throw new Error("Provider content changed after dispatch; reconcile manually.");
    if (["queued", "sent", "canceled"].includes(String(remote.status))) {
      await advance("dispatching", String(remote.status), providerId, String(remote.status));
    }
    return { state: remote.status, recipients: checked.recipients, notice: "Provider acceptance is not proof of inbox delivery." };
  }
  if (action === "cancel") {
    if (!["dispatching", "queued"].includes(op.phase) || !["queued", "scheduled"].includes(String(remote.status))) throw new Error("Only a verified queued broadcast can be canceled. Already sent mail cannot be recalled.");
    await input.transport.cancelBroadcast(providerId);
    remote = await input.transport.getBroadcast(providerId);
    if (!input.transport.matchesBroadcast(remote, document, key)) throw new Error("Canceled status could not be verified.");
  }
  if (["dispatching", "queued"].includes(op.phase) && ["queued", "sent", "canceled"].includes(String(remote.status))) {
    await advance(op.phase, String(remote.status), providerId, String(remote.status));
    return { state: remote.status, notice: "Verified provider status; no message was resent. Sent does not guarantee delivered." };
  }
  return { state: op.phase, providerStatus: remote.status, notice: "No retry was attempted. Unknown or draft-after-dispatch outcomes stay locked for operator review." };
}
