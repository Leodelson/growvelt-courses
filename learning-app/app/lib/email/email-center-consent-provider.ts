import "server-only";
import { setTimeout as delay } from "node:timers/promises";
import { emailUuid } from "./email-center";
import { LEARNING_EMAIL_SEGMENT_ID, type ProviderAudienceContact } from "./email-center-audience";

export type LearningConsentProvider = {
  getContact: (email: string) => Promise<ProviderAudienceContact | null>;
  isMember: (contactId: string) => Promise<boolean>;
  setMember: (contactId: string, member: boolean) => Promise<void>;
};
// Intentionally has no contact-create/update/delete or global-subscribe method.
export function createLearningConsentProvider(input: { key: string; request: typeof fetch; enabled?: boolean; pace?: () => Promise<void> }): LearningConsentProvider {
  let sequence = Promise.resolve();
  async function perform(path: string, method: "GET" | "POST" | "DELETE") {
    if (input.enabled !== true) throw new Error("Consent provider access is not activated.");
    if (!/^re_[A-Za-z0-9_-]+$/.test(input.key)) throw new Error("Consent provider access is not configured.");
    try {
      await (input.pace ? input.pace() : delay(250));
      const response = await input.request(`https://api.resend.com${path}`, { method, redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${input.key}` } });
      if (method === "GET" && response.status === 404) return null;
      if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw new Error("provider unavailable"); }
      return await response.json() as Record<string, unknown>;
    } catch { throw new Error("Consent provider outcome requires review."); }
  }
  function request(path: string, method: "GET" | "POST" | "DELETE") {
    const operation = sequence.then(() => perform(path, method));
    sequence = operation.then(() => undefined, () => undefined);
    return operation;
  }
  const contactId = (id: string) => { if (!emailUuid.test(id)) throw new Error("Invalid provider contact."); return id; };
  return {
    async getContact(email) {
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid consent address.");
      const result = await request(`/contacts/${encodeURIComponent(email)}`, "GET");
      if (!result) return null;
      if (typeof result.id !== "string" || !emailUuid.test(result.id) || typeof result.email !== "string"
        || result.email.trim().toLowerCase() !== email.trim().toLowerCase() || typeof result.unsubscribed !== "boolean") throw new Error("Consent provider record could not be verified.");
      return { id: result.id, email: result.email.trim().toLowerCase(), unsubscribed: result.unsubscribed };
    },
    async isMember(id) {
      const result = await request(`/contacts/${contactId(id)}/segments`, "GET");
      if (!result || result.has_more !== false || !Array.isArray(result.data)
        || result.data.some(value => !value || typeof value.id !== "string" || !emailUuid.test(value.id))) throw new Error("A complete membership check is required.");
      return result.data.some(value => value.id === LEARNING_EMAIL_SEGMENT_ID);
    },
    async setMember(id, member) {
      if (typeof member !== "boolean") throw new Error("Invalid membership intent.");
      await request(`/contacts/${contactId(id)}/segments/${LEARNING_EMAIL_SEGMENT_ID}`, member ? "POST" : "DELETE");
    },
  };
}
