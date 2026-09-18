import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { initiatePaystackTestTransfer, verifyPaystackTestTransfer } from "@/app/lib/payments/paystack";

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

export async function recoverInstructorTestPayout(payoutItemId: number, actorUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_learning_instructor_test_transfer_for_recovery", { p_payout_item_id: payoutItemId, p_actor_user_id: actorUserId });
  if (error) throw new Error("Payout transfer recovery is not available.");
  const item = (data as Array<{ payout_item_id?: number; payout_item_reference?: string; amount_minor?: number; currency?: string }> | null)?.[0];
  if (!item?.payout_item_id || !item.payout_item_reference || typeof item.amount_minor !== "number" || item.currency !== "NGN") throw new Error("Payout transfer recovery is not available.");
  const transfer = await verifyPaystackTestTransfer(item.payout_item_reference);
  if (transfer.amountMinor !== item.amount_minor || transfer.currency !== item.currency || transfer.reference !== item.payout_item_reference || transfer.domain !== "test") throw new Error("Verified transfer does not match the payout item.");
  const { error: recordError } = await admin.rpc("record_learning_instructor_test_transfer_verification", { p_payout_item_id: item.payout_item_id, p_transfer_id: transfer.transferId, p_transfer_code: transfer.transferCode, p_provider_status: transfer.status, p_actor_user_id: actorUserId });
  if (recordError) throw new Error("Verified transfer could not be recorded safely.");
  return { status: transfer.status };
}
