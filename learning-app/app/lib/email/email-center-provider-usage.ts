import "server-only";

export type EmailCenterProviderUsage = {
  checkedAt: number;
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
  contacts: { used: number; limit: number };
  segments: { used: number; limit: number };
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Shared provider usage could not be verified.");
  return value as Record<string, unknown>;
}
function counter(value: unknown, expectedLimit: number) {
  const row = record(value);
  if (!Number.isSafeInteger(row.used) || Number(row.used) < 0 || row.limit !== expectedLimit) throw new Error("The approved free provider allowance could not be verified.");
  return { used: Number(row.used), limit: expectedLimit };
}
export function parseEmailCenterProviderUsage(value: unknown): EmailCenterProviderUsage {
  const data = record(value), emails = record(data.emails);
  if (data.object !== "usage") throw new Error("Shared provider usage could not be verified.");
  return { checkedAt: Date.now(), daily: counter(emails.daily, 100), monthly: counter(emails.monthly, 3000),
    contacts: counter(data.contacts, 1000), segments: counter(data.segments, 3) };
}
export function hasEmailCenterProviderHeadroom(usage: EmailCenterProviderUsage) {
  // Conservative initial guard, not a reservation against other team senders.
  // The API owns its daily window; do not infer a midnight reset from our UTC ledger.
  const age = Date.now() - usage.checkedAt;
  return Number.isFinite(age) && age >= 0 && age <= 5000
    && usage.daily.limit === 100 && usage.monthly.limit === 3000
    && Number.isSafeInteger(usage.daily.used) && usage.daily.used >= 0
    && Number.isSafeInteger(usage.monthly.used) && usage.monthly.used >= 0
    && usage.daily.limit - usage.daily.used > 25
    && usage.monthly.limit - usage.monthly.used > 250;
}

// Explicitly injected server-side key/fetch. No dashboard scraping, key fallback,
// paid-plan assumption or network request at module load.
export async function readEmailCenterProviderUsage(input: { key: string; request: typeof fetch }) {
  if (!/^re_[A-Za-z0-9_-]+$/.test(input.key)) throw new Error("Provider usage access is not configured.");
  let response: Response;
  try {
    response = await input.request("https://api.resend.com/usage", { method: "GET", cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${input.key}` } });
    if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw new Error("usage unavailable"); }
    return parseEmailCenterProviderUsage(await response.json());
  } catch { throw new Error("Shared provider usage could not be verified. Sending stays blocked."); }
}
