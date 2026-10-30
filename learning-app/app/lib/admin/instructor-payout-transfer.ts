import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { initiatePaystackLiveTransfer, initiatePaystackTestTransfer, verifyPaystackTestTransfer } from "@/app/lib/payments/paystack";
import { digestPaystackPayload } from "@/app/lib/payments/paystack-core";

function idempotencyKey(reservationId: number) {
  return `payout-approval:${reservationId}`;
}

export async function approveInstructorTestPayout(reservationId: number, actorUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("approve_learning_instructor_payout_item", { p_reservation_id: reservationId, p_idempotency_key: idempotencyKey(reservationId), p_actor_user_id: actorUserId });
  if (error) throw new Error("Payout approval could not be completed safely.");
  const item = (data as Array<{ payout_item_id?: number; status?: string }> | null)?.[0];
  if (!item?.payout_item_id) throw new Error("Payout approval could not be completed safely.");
  return item;
}

/** Records admin approval only; there is intentionally no Live transfer writer here. */
export async function approveInstructorLivePayout(reservationId: number, actorUserId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_APPROVAL_ENABLED !== "true") throw new Error("Live payout approval is disabled.");
  const { data, error } = await createAdminClient().rpc("approve_learning_instructor_live_payout_item", {
    p_reservation_id: reservationId,
    p_idempotency_key: `payout-live-approval:${reservationId}`,
    p_actor_user_id: actorUserId,
  });
  if (error) throw new Error("Live payout approval could not be completed safely.");
  const item = (data as Array<{ payout_item_id?: number; status?: string; payout_item_reference?: string }> | null)?.[0];
  if (!item?.payout_item_id || !item.payout_item_reference?.startsWith("lpi-live-reservation-") || item.status !== "approved") {
    throw new Error("Live payout approval could not be completed safely.");
  }
  return item;
}

export async function submitInstructorTestPayout(payoutItemId: number, actorUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("begin_learning_instructor_test_transfer", { p_payout_item_id: payoutItemId, p_actor_user_id: actorUserId });
  if (error) throw new Error("Payout transfer is not eligible for submission.");
  const item = (data as Array<{ payout_item_id?: number; payout_item_reference?: string; recipient_code?: string; amount_minor?: number; currency?: string }> | null)?.[0];
  if (!item?.payout_item_id || !item.payout_item_reference || !item.recipient_code || typeof item.amount_minor !== "number" || !Number.isSafeInteger(item.amount_minor) || item.currency !== "NGN") throw new Error("Payout transfer is not eligible for submission.");
  let transfer;
  try {
    transfer = await initiatePaystackTestTransfer({ recipientCode: item.recipient_code, amountMinor: item.amount_minor, reference: item.payout_item_reference });
  } catch (error) {
    await admin.rpc("mark_learning_instructor_test_transfer_recovery_required", { p_payout_item_id: item.payout_item_id, p_actor_user_id: actorUserId });
    throw error;
  }
  const { error: persistError } = await admin.rpc("record_learning_instructor_test_transfer_submission", { p_payout_item_id: item.payout_item_id, p_transfer_id: transfer.transferId, p_transfer_code: transfer.transferCode, p_provider_status: transfer.status, p_actor_user_id: actorUserId });
  if (persistError) throw new Error("Payout transfer receipt could not be recorded; provider verification is required before any retry.");
  return { status: "pending" as const };
}

/** One Live initiation attempt per approved item. Unknown outcomes are frozen
 * for read-only provider verification, never automatically resent. */
export async function submitInstructorLivePayout(payoutItemId: number, actorUserId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_SUBMISSION_ENABLED !== "true") throw new Error("Live payout submission is disabled.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("begin_learning_instructor_live_transfer", {
    p_payout_item_id: payoutItemId, p_actor_user_id: actorUserId,
  });
  const item = (data as Array<{ payout_item_id?: number; payout_item_reference?: string; recipient_code?: string; amount_minor?: number; currency?: string }> | null)?.[0];
  if (error || !item?.payout_item_id || !item.payout_item_reference?.match(/^lpi-live-reservation-[0-9]+$/)
    || !item.recipient_code || !Number.isSafeInteger(item.amount_minor) || item.currency !== "NGN") {
    throw new Error("Live payout is not eligible for submission.");
  }
  let transfer;
  try {
    transfer = await initiatePaystackLiveTransfer({ recipientCode: item.recipient_code,
      amountMinor: item.amount_minor!, reference: item.payout_item_reference });
  } catch {
    await admin.rpc("mark_learning_instructor_live_transfer_recovery_required", {
      p_payout_item_id: item.payout_item_id, p_actor_user_id: actorUserId,
    });
    throw new Error("Live transfer status is unknown. Verify its reference before further action.");
  }
  const { error: persistError } = await admin.rpc("record_learning_instructor_live_transfer_submission", {
    p_payout_item_id: item.payout_item_id, p_transfer_id: transfer.transferId,
    p_transfer_code: transfer.transferCode, p_provider_status: transfer.status, p_actor_user_id: actorUserId,
  });
  if (persistError) throw new Error("Live transfer identity could not be recorded; verify before further action.");
  return { status: transfer.status };
}

export async function recoverInstructorTestPayout(payoutItemId: number, actorUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_learning_instructor_test_transfer_for_recovery", { p_payout_item_id: payoutItemId, p_actor_user_id: actorUserId });
  if (error) throw new Error("Payout transfer recovery is not available.");
  const item = (data as Array<{ payout_item_id?: number; payout_item_reference?: string; amount_minor?: number; currency?: string }> | null)?.[0];
  if (!item?.payout_item_id || !item.payout_item_reference || typeof item.amount_minor !== "number" || item.currency !== "NGN") throw new Error("Payout transfer recovery is not available.");
  const transfer = await verifyPaystackTestTransfer(item.payout_item_reference);
  if (transfer.amountMinor !== item.amount_minor || transfer.currency !== item.currency || transfer.reference !== item.payout_item_reference || transfer.domain !== "test") throw new Error("Verified transfer does not match the payout item.");
  const verificationIdentity = `provider-api:${transfer.reference}:${transfer.status}:${transfer.transferId}`;
  const { data: received, error: receiptError } = await admin.rpc("receive_paystack_test_transfer_provider_event", {
    p_provenance: "provider_api", p_provider_event_id: verificationIdentity,
    p_payload_digest: digestPaystackPayload(JSON.stringify({ reference: transfer.reference, transferId: transfer.transferId, transferCode: transfer.transferCode, status: transfer.status, amountMinor: transfer.amountMinor, currency: transfer.currency, domain: transfer.domain })),
    p_reference: transfer.reference, p_transfer_id: transfer.transferId, p_transfer_code: transfer.transferCode,
    p_status: transfer.status, p_amount_minor: transfer.amountMinor, p_currency: transfer.currency, p_actor_user_id: actorUserId,
  });
  const receipt = (received as Array<{ provider_event_id?: number }> | null)?.[0];
  if (receiptError || !receipt?.provider_event_id) throw new Error("Verified transfer could not be received safely.");
  const { error: processError } = await admin.rpc("process_learning_instructor_payout_provider_event", { p_provider_event_id: receipt.provider_event_id });
  if (processError) throw new Error("Verified transfer is retained and requires reconciliation.");
  return { status: transfer.status };
}
