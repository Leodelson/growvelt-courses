import "server-only";
import { emailUuid, parseEmailDocument, senderChoices, type EmailDocument } from "./email-center";
import { renderEmailCenterMessage } from "./email-center-render";
import { legacyEmailCenterSender } from "./email-center-legacy";
import { readEmailCenterProviderUsage } from "./email-center-provider-usage";
import { LEARNING_EMAIL_SEGMENT_ID, type CompleteProviderContacts } from "./email-center-audience";
import { setTimeout as delay } from "node:timers/promises";

type Sender = EmailDocument["sender"];
type TransportOptions = {
  transactionalKey?: string;
  marketingKey?: string;
  senders: Partial<Record<Sender, string>>;
  // Supply from a verified server-side account check, not a browser request.
  verifiedDomains: readonly string[];
  request: typeof fetch;
  allowProviderWrites?: boolean;
  pace?: () => Promise<void>;
};

export class EmailCenterProviderError extends Error {
  constructor(
    public readonly status: number | null,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    // Never echo provider bodies, keys, recipient addresses or raw exceptions.
    super(status === 429 ? "Provider rate limit reached; reconciliation is required before retry." : "Provider operation could not be confirmed; review its audit record.");
    this.name = "EmailCenterProviderError";
  }
}

function retryAfter(value: string | null) {
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds, 86400) : null;
}

function operationKey(key: string) {
  if (!/^learning-center-[a-z0-9-]+$/.test(key) || key.length > 240) throw new Error("Invalid operation key.");
}

function mailbox(value: string) {
  return value.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
}

// Provider adapter only: no env loading, default fetch, contacts mutation, retry
// loop or route activation. The durable worker owns claims/budgets/checkpoints.
export function createEmailCenterResendTransport(options: TransportOptions) {
  let sequence = Promise.resolve();
  async function request(path: string, key: string | undefined, method = "GET", payload?: object, idempotencyKey?: string): Promise<Record<string, unknown>> {
    if (options.allowProviderWrites !== true) throw new Error("Provider writes are not activated.");
    if (!key || !/^re_[A-Za-z0-9_-]+$/.test(key)) throw new Error("A valid server-side provider key is required.");
    const operation = sequence.then(async () => {
      await (options.pace ? options.pace() : delay(250));
      let response: Response;
      try {
        response = await options.request(`https://api.resend.com${path}`, {
          method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
          ...(payload ? { body: JSON.stringify(payload) } : {}),
        });
      } catch { throw new EmailCenterProviderError(null); }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new EmailCenterProviderError(response.status, retryAfter(response.headers.get("Retry-After")));
      }
      try {
        const data = await response.json();
        if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
        return data as Record<string, unknown>;
      } catch { throw new EmailCenterProviderError(response.status); }
    });
    sequence = operation.then(() => undefined, () => undefined);
    return operation;
  }
  async function list(path: string, maximum: number) {
    const rows: Record<string, unknown>[] = [], ids = new Set<string>();
    let after = "";
    for (;;) {
      const page = await request(`${path}${path.includes("?") ? "&" : "?"}limit=100${after ? `&after=${after}` : ""}`, options.marketingKey);
      if (typeof page.has_more !== "boolean" || !Array.isArray(page.data) || page.data.length > 100) throw new Error("Complete provider pagination is required.");
      for (const row of page.data) {
        if (!row || typeof row.id !== "string" || !emailUuid.test(row.id) || ids.has(row.id)) throw new Error("Provider pagination changed; repeat the review.");
        ids.add(row.id); rows.push(row);
      }
      if (rows.length > maximum) throw new Error("Provider review limit exceeded.");
      if (!page.has_more) return rows;
      if (!page.data.length || rows.length >= maximum) throw new Error("Complete provider pagination is required.");
      after = page.data.at(-1).id;
    }
  }
  function from(sender: Sender) {
    const address = options.senders[sender]?.trim().toLowerCase() ?? "";
    const domain = address.split("@")[1];
    if (!mailbox(address) || !["growvelt.com", "updates.growvelt.com"].includes(domain)
      || !options.verifiedDomains.includes(domain)) throw new Error("Verify the configured Growvelt sender domain first.");
    if (sender === "partnerships" && address !== "partnership@growvelt.com") throw new Error("Use the approved partnership sender address.");
    return `${senderChoices.find(choice => choice.id === sender)!.label} <${address}>`;
  }

  async function post(path: "/emails" | "/broadcasts", key: string | undefined, payload: object, idempotencyKey?: string) {
    const data = await request(path, key, "POST", payload, idempotencyKey);
    if (typeof data.id !== "string" || !emailUuid.test(data.id)) {
      throw new EmailCenterProviderError(null);
    }
    return { id: data.id };
  }

  return {
    senderIdentity: from,
    async readAudience(segmentOnly = false): Promise<CompleteProviderContacts> {
      const rows = await list(`/contacts${segmentOnly ? `?segment_id=${LEARNING_EMAIL_SEGMENT_ID}` : ""}`, 1000);
      return { complete: true, contacts: rows.map(row => {
        if (typeof row.email !== "string" || typeof row.unsubscribed !== "boolean") throw new Error("Invalid provider audience.");
        return { id: row.id as string, email: row.email, unsubscribed: row.unsubscribed };
      }) };
    },
    async findBroadcast(operation: string) {
      operationKey(operation);
      const rows = await list("/broadcasts", 1000);
      const matches = rows.filter(row => row.name === operation && row.segment_id === LEARNING_EMAIL_SEGMENT_ID);
      if (matches.length !== 1) throw new Error("A unique provider operation could not be established. Do not recreate or resend.");
      return matches[0].id as string;
    },
    async getBroadcast(id: string) {
      if (!emailUuid.test(id)) throw new Error("Invalid broadcast ID.");
      const data = await request(`/broadcasts/${id}`, options.marketingKey);
      if (data.id !== id || typeof data.status !== "string") throw new Error("Provider broadcast could not be verified.");
      return data;
    },
    matchesBroadcast(data: Record<string, unknown>, document: EmailDocument, operation: string) {
      // Already-prepared/queued campaigns keep their exact original HTML. Do
      // not edit, recreate or quarantine them merely because new email CSS ships.
      const identity = from(document.sender);
      return data.name === operation && data.segment_id === LEARNING_EMAIL_SEGMENT_ID
        && data.subject === document.subject && !data.topic_id
        && (data.from === identity && data.html === renderEmailCenterMessage(document, "there")
          || data.from === legacyEmailCenterSender(document.sender, identity)
            && data.html === renderEmailCenterMessage(document, "there", undefined, true));
    },
    async sendBroadcast(id: string) {
      if (!emailUuid.test(id)) throw new Error("Invalid broadcast ID.");
      // No retries/idempotency assumption for this endpoint. A durable dispatch
      // claim must already exist; read provider status to reconcile a lost reply.
      return request(`/broadcasts/${id}/send`, options.marketingKey, "POST", {});
    },
    async cancelBroadcast(id: string) {
      if (!emailUuid.test(id)) throw new Error("Invalid broadcast ID.");
      return request(`/broadcasts/${id}/cancel`, options.marketingKey, "POST", {});
    },
    async readSharedUsage() {
      if (options.allowProviderWrites !== true) throw new Error("Provider access is not activated.");
      // Same key as the account notice: never preflight a different team's key.
      return readEmailCenterProviderUsage({ key: options.transactionalKey ?? "", request: options.request });
    },
    async readMarketingUsage() {
      if (options.allowProviderWrites !== true) throw new Error("Provider access is not activated.");
      return readEmailCenterProviderUsage({ key: options.marketingKey ?? "", request: options.request });
    },
    async sendTransactional(input: { document: EmailDocument; email: string; firstName: string; operationKey: string }) {
      const document = parseEmailDocument(input.document);
      if (document.mode !== "transactional") throw new Error("Marketing must use broadcasts, not transactional delivery.");
      operationKey(input.operationKey);
      if (!mailbox(input.email) || input.firstName.length > 120) throw new Error("Check the reviewed recipient.");
      return post("/emails", options.transactionalKey, {
        from: from(document.sender), to: [input.email], subject: document.subject,
        html: renderEmailCenterMessage(document, input.firstName || "there"),
        tags: [{ name: "product", value: "learning" }, { name: "category", value: "admin_account_notice" }],
      }, input.operationKey);
    },
    async createBroadcastDraft(input: { document: EmailDocument; segmentId: string; topicId?: string; operationKey: string }) {
      const document = parseEmailDocument(input.document);
      if (document.mode !== "marketing") throw new Error("Only marketing content belongs in a broadcast draft.");
      operationKey(input.operationKey);
      if (input.segmentId !== LEARNING_EMAIL_SEGMENT_ID || input.topicId !== undefined) throw new Error("Check the approved Growvelt segment/topic. Topics are not activated.");
      // The create endpoint is not assumed idempotent. Claim/persist its ID in
      // the durable worker; a lost response must never trigger blind creation.
      // No send:true shortcut: recipient/provider review happens before sending.
      return post("/broadcasts", options.marketingKey, {
        name: input.operationKey, segment_id: input.segmentId,
        ...(input.topicId ? { topic_id: input.topicId } : {}),
        from: from(document.sender), subject: document.subject,
        // Use a neutral greeting until provider personalization is explicitly
        // integrated/tested; arbitrary content must not become template logic.
        html: renderEmailCenterMessage(document, "there"), send: false,
      });
    },
  };
}
