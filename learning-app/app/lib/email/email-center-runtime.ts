import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { senderChoices } from "./email-center";
import { LEARNING_EMAIL_SEGMENT_ID } from "./email-center-audience";
import { createEmailCenterResendTransport } from "./email-center-resend";
import { createLearningConsentProvider } from "./email-center-consent-provider";

// First release is intentionally a bounded test, not a full-list launch. No
// NEXT_PUBLIC flags or provider keys, and no fallback to Careers configuration.
export function emailCenterRelease() {
  const emails = (process.env.LEARNING_EMAIL_CENTER_TEST_RECIPIENTS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  const enabled = process.env.LEARNING_EMAIL_CENTER_RELEASE === "controlled-test"
    && process.env.RESEND_LEARNING_SEGMENT_ID === LEARNING_EMAIL_SEGMENT_ID
    && emails.length >= 1 && emails.length <= 10 && new Set(emails).size === emails.length
    && emails.every(email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  return { enabled, emails };
}
export function emailCenterProviderRuntime(options: { recoveryOnly?: boolean } = {}) {
  const release = emailCenterRelease();
  if (!release.enabled && !(options.recoveryOnly && process.env.LEARNING_EMAIL_CENTER_RECOVERY === "enabled")) throw new Error("Sending is not activated. Complete the approved controlled-test setup first. No email was sent.");
  return {
    transport: createEmailCenterResendTransport({
      transactionalKey: process.env.RESEND_API_KEY, marketingKey: process.env.RESEND_MARKETING_API_KEY,
      senders: Object.fromEntries(senderChoices.map(sender => [sender.id, process.env[sender.variable]])),
      // Operator-approved domain verification is a release prerequisite. The
      // adapter still rejects other domains, unconfigured aliases and spoofing.
      verifiedDomains: (process.env.LEARNING_EMAIL_VERIFIED_DOMAINS ?? "").split(",").map(value => value.trim()),
      request: fetch, allowProviderWrites: true,
    }),
    membership: createLearningConsentProvider({ key: process.env.RESEND_MARKETING_API_KEY ?? "", request: fetch, enabled: true }),
  };
}
export async function checkEmailCenterTestRecipients(database: Pick<SupabaseClient, "rpc">, actor: string, id: string, revision: number) {
  const release = emailCenterRelease();
  if (!release.enabled) throw new Error("The controlled-test release is not activated.");
  const { data, error } = await database.rpc("read_learning_email_center_review", { p_actor: actor, p_id: id, p_revision: revision });
  if (error || !data || !Array.isArray(data.targets) || !data.targets.length || data.targets.length > 10
    || data.targets.some((target: { email: string }) => !release.emails.includes(target.email))) throw new Error("Recipients differ from the approved controlled-test allowlist. No email was sent.");
  return data;
}
