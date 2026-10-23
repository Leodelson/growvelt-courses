import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailUuid } from "./email-center";
import type { LearningConsentProvider } from "./email-center-consent-provider";

type PendingConsent = { userId: string; email: string; version: number; optedIn: boolean; previousContactId: string | null };
// No scheduler/HTTP activation here. Errors retain the non-expiring segment lease
// for reconciliation; do not blindly retry a possibly incomplete remote change.
export async function synchronizeLearningConsent(input: {
  database: Pick<SupabaseClient, "rpc">; provider: LearningConsentProvider;
  userId: string; enabled?: boolean;
}) {
  if (input.enabled !== true) throw new Error("Consent synchronization activation is required.");
  if (!emailUuid.test(input.userId)) throw new Error("Invalid Learning user.");
  async function rpc(name: string, args: object) {
    const result = await input.database.rpc(name, args);
    if (result.error) throw new Error("Consent state could not be persisted; review before retry.");
    return result.data;
  }
  const pending = await rpc("read_learning_email_consent_sync", { p_user_id: input.userId }) as PendingConsent | null;
  if (!pending) return { state: "up_to_date" as const };
  if (pending.userId !== input.userId || !Number.isSafeInteger(pending.version) || pending.version < 1 || typeof pending.optedIn !== "boolean") throw new Error("Invalid pending consent state.");
  const holder = randomUUID();
  if (await rpc("claim_learning_email_segment", { p_holder: holder, p_kind: "consent" }) !== true) return { state: "busy" as const };
  const release = async () => {
    if (await rpc("release_learning_email_segment", { p_holder: holder }) !== true) throw new Error("Segment ownership requires review.");
  };
  const remove = async (id: string) => {
    if (await input.provider.isMember(id)) await input.provider.setMember(id, false);
    if (await input.provider.isMember(id)) throw new Error("Removal could not be verified.");
  };
  try {
    let contact = await input.provider.getContact(pending.email);
    if (pending.previousContactId && pending.previousContactId !== contact?.id) await remove(pending.previousContactId);
    if (!contact && pending.optedIn) { await release(); return { state: "awaiting_contact_import" as const }; }
    if (contact) {
      const wanted = pending.optedIn && !contact.unsubscribed;
      if (await input.provider.isMember(contact.id) !== wanted) await input.provider.setMember(contact.id, wanted);
      const current = await input.provider.getContact(pending.email);
      if (!current || current.id !== contact.id) throw new Error("Provider contact changed during synchronization.");
      contact = current;
      if (contact.unsubscribed || !pending.optedIn) await remove(contact.id);
      else if (!await input.provider.isMember(contact.id)) throw new Error("Membership could not be verified.");
    }
    const acknowledged = await rpc("mark_learning_email_consent_synchronized", {
      p_user_id: input.userId, p_version: pending.version, p_opt_in: pending.optedIn,
      p_contact_id: contact?.id ?? null, p_email: contact?.email ?? null,
    });
    if (acknowledged !== true) {
      // A newer opt-out may have arrived during the remote operation. Remove
      // membership conservatively; never acknowledge or re-add from stale state.
      if (contact) await remove(contact.id);
      await release(); return { state: "stale" as const };
    }
    await release();
    return { state: contact?.unsubscribed ? "globally_suppressed" as const : "synchronized" as const };
  } catch {
    return { state: "needs_review" as const };
  }
}
