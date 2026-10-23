import "server-only";
import { emailUuid } from "./email-center";

export const LEARNING_EMAIL_SEGMENT_ID = "f0815500-6d8a-4662-857f-eaec9d4e0971";
export type LearningAudienceAccount = { userId: string; email: string; confirmed: boolean; marketingOptIn: boolean };
export type ProviderAudienceContact = { id: string; email: string; unsubscribed: boolean };
export type CompleteProviderContacts = { complete: boolean; contacts: ProviderAudienceContact[] };
const canonicalEmail = (email: string) => {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Invalid audience record.");
  return normalized;
};
function catalog(input: CompleteProviderContacts) {
  if (input.complete !== true || input.contacts.length > 1000) throw new Error("A complete within-plan provider audience check is required.");
  const byEmail = new Map<string, ProviderAudienceContact>(), ids = new Set<string>();
  for (const contact of input.contacts) {
    const email = canonicalEmail(contact.email);
    if (!emailUuid.test(contact.id) || typeof contact.unsubscribed !== "boolean" || byEmail.has(email) || ids.has(contact.id)) throw new Error("Provider audience is inconsistent.");
    byEmail.set(email, { ...contact, email }); ids.add(contact.id);
  }
  return byEmail;
}
function eligible(accounts: LearningAudienceAccount[]) {
  if (accounts.length > 1000) throw new Error("Learning audience review limit exceeded.");
  const emails = new Set<string>();
  for (const account of accounts) {
    if (!emailUuid.test(account.userId) || typeof account.confirmed !== "boolean" || typeof account.marketingOptIn !== "boolean") throw new Error("Invalid Learning consent record.");
    const email = canonicalEmail(account.email);
    if (account.confirmed && account.marketingOptIn) emails.add(email);
  }
  return emails;
}

// A plan only; this function never imports contacts, changes global unsubscribe
// status, or reads Careers' database. Applying it needs separate provider approval.
export function planLearningAudienceSync(input: {
  segmentId: string; accounts: LearningAudienceAccount[];
  providerCatalog: CompleteProviderContacts; segment: CompleteProviderContacts;
}) {
  if (input.segmentId !== LEARNING_EMAIL_SEGMENT_ID) throw new Error("Only the reserved Learning segment may be changed.");
  const provider = catalog(input.providerCatalog), segment = catalog(input.segment), wanted = eligible(input.accounts);
  const add: string[] = [], remove: string[] = [], missing: string[] = [], suppressed: string[] = [];
  for (const [email, contact] of segment) {
    const current = provider.get(email);
    if (!current || current.id !== contact.id || current.unsubscribed !== contact.unsubscribed) throw new Error("Provider audience changed; repeat the check.");
    if (!wanted.has(email) || current.unsubscribed) remove.push(current.id);
  }
  for (const email of wanted) {
    const contact = provider.get(email);
    if (!contact) missing.push(email);
    else if (contact.unsubscribed) suppressed.push(email);
    else if (!segment.has(email)) add.push(contact.id);
  }
  if (provider.size + missing.length > 1000) throw new Error("The shared free contact allowance is insufficient. No contacts were changed.");
  return { segmentId: input.segmentId, addContactIds: add.sort(), removeContactIds: remove.sort(),
    missingContactEmails: missing.sort(), globallySuppressedEmails: suppressed.sort(), requiresContactImportApproval: missing.length > 0 };
}

// All roles must compare an exact reviewed set, not merely the segment's count.
// Same-sized wrong/Careers audiences fail closed. Recheck directly before send.
export function verifyLearningBroadcastAudience(input: Parameters<typeof planLearningAudienceSync>[0]) {
  const plan = planLearningAudienceSync(input);
  if (plan.addContactIds.length || plan.removeContactIds.length || plan.missingContactEmails.length) throw new Error("Provider membership does not match the reviewed Learning audience.");
  const count = eligible(input.accounts).size - plan.globallySuppressedEmails.length;
  if (count < 1) throw new Error("No eligible subscribed Learning recipients.");
  return { recipients: count, suppressed: plan.globallySuppressedEmails.length, segmentId: input.segmentId };
}
