import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { senderChoices } from "./email-center";
import { LEARNING_EMAIL_SEGMENT_ID } from "./email-center-audience";
import { createEmailCenterResendTransport } from "./email-center-resend";
import { createLearningConsentProvider } from "./email-center-consent-provider";

// Both modes remain bounded, operator-reviewed and server-only. A live release
// never implies consent, contact import permission or transactional quota.
export function emailCenterRelease() {
  const emails = (process.env.LEARNING_EMAIL_CENTER_TEST_RECIPIENTS ?? "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  const mode = process.env.LEARNING_EMAIL_CENTER_RELEASE;
  const limit = process.env.LEARNING_EMAIL_CENTER_LIVE_MAX_RECIPIENTS ?? "";
  const liveLimit = /^(?:[1-9][0-9]?|100)$/.test(limit) ? Number(limit) : 0;
  const testEnabled = mode === "controlled-test"
    && emails.length >= 1 && emails.length <= 10 && new Set(emails).size === emails.length
    && emails.every(email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const enabled = process.env.RESEND_LEARNING_SEGMENT_ID === LEARNING_EMAIL_SEGMENT_ID
    && (testEnabled || mode === "admin-live" && liveLimit > 0);
  return { enabled, emails, mode, maxRecipients: mode === "admin-live" ? liveLimit : 10 };
}
export function emailCenterProviderRuntime(options: { recoveryOnly?: boolean } = {}) {
  const release = emailCenterRelease();
  if (!release.enabled && !(options.recoveryOnly && process.env.LEARNING_EMAIL_CENTER_RECOVERY === "enabled")) throw new Error("Sending is not activated. Complete the approved provider and release setup first. No email was sent.");
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
export async function checkEmailCenterRecipients(database: Pick<SupabaseClient, "rpc">, actor: string, id: string, revision: number) {
  const release = emailCenterRelease();
  if (!release.enabled) throw new Error("The approved email release is not activated.");
  const { data, error } = await database.rpc("read_learning_email_center_review", { p_actor: actor, p_id: id, p_revision: revision });
  if (error || !data || !Array.isArray(data.targets) || !data.targets.length || data.targets.length > release.maxRecipients
    || release.mode === "controlled-test" && data.targets.some((target: { email: string }) => !release.emails.includes(target?.email))) throw new Error("Recipients exceed the approved release limit or controlled-test allowlist. No email was sent.");
  const mode = data.document?.mode;
  if (!["marketing", "transactional"].includes(mode) || mode === "transactional" && data.targets.length > 10
    || data.targets.some((target: { email: string; confirmed: boolean; marketingOptIn: boolean }) =>
      !target || typeof target.email !== "string" || target.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target.email)
      || target.confirmed !== true || mode === "marketing" && target.marketingOptIn !== true)
    || new Set(data.targets.map((target: { email: string }) => target.email.toLowerCase())).size !== data.targets.length) throw new Error("Confirmed, unique Growvelt accounts and current marketing consent are required. No email was sent.");
  return data;
}
