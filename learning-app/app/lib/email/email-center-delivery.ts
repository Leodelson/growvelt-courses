import "server-only";
export type DeliveryStore = {
  claim: () => Promise<boolean>;
  reserveBudget: () => Promise<boolean>;
  checkpoint: (state:"accepted"|"uncertain"|"skipped", providerId?:string) => Promise<void>;
};
// Local worker contract, not connected to the HTTP send action before approval.
// Claims never expire/retry automatically; lost responses need reconciliation.
export async function deliverEmailCenterOperation(store: DeliveryStore, provider: (idempotencyKey:string) => Promise<{id:string}>, key:string, enabled=false) {
  if (!enabled) throw new Error("Delivery activation is required");
  if (!/^learning-center-[a-z0-9-]+$/.test(key) || key.length>240) throw new Error("Invalid operation key");
  if (!await store.claim()) return {state:"already_claimed" as const};
  if (!await store.reserveBudget()) { await store.checkpoint("skipped"); return {state:"budget_blocked" as const}; }
  let result: {id:string};
  try {
    result = await provider(key);
    if (!result?.id || typeof result.id !== "string") throw new Error("Uncertain provider response");
  } catch {
    await store.checkpoint("uncertain");
    return {state:"needs_review" as const};
  }
  // A persistence failure must not be mistaken for a failed send and retried.
  await store.checkpoint("accepted",result.id);
  return {state:"accepted" as const,providerId:result.id};
}
