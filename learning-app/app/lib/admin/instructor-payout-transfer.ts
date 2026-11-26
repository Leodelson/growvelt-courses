import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { assertPaystackLiveBalanceCoversPayout, finalizePaystackLiveTransfer, initiatePaystackLivePayoutBatchTransfer, initiatePaystackTestTransfer, verifyPaystackLiveTransfer, verifyPaystackTestTransfer } from "@/app/lib/payments/paystack";
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

export async function approveInstructorLivePayoutBatch(input: {
  instructorId: string; payoutProfileId: number; earningIds: number[];
  confirmedAmountMinor: number; idempotencyKey: string;
}, actorUserId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED !== "true"
    || !input.instructorId || !Number.isSafeInteger(input.payoutProfileId) || input.payoutProfileId <= 0
    || !Array.isArray(input.earningIds) || input.earningIds.length < 1 || input.earningIds.length > 100
    || input.earningIds.some(id => !Number.isSafeInteger(id) || id <= 0)
    || new Set(input.earningIds).size !== input.earningIds.length
    || !Number.isSafeInteger(input.confirmedAmountMinor) || input.confirmedAmountMinor < 100000
    || !/^[a-z][a-z0-9:_-]{2,120}$/.test(input.idempotencyKey)) {
    throw new Error("Live payout batch approval is unavailable.");
  }
  const { data, error } = await createAdminClient().rpc("approve_learning_instructor_live_payout_batch", {
    p_operator_id: actorUserId, p_instructor_id: input.instructorId,
    p_payout_profile_id: input.payoutProfileId, p_earning_ids: input.earningIds,
    p_confirmed_amount_minor: input.confirmedAmountMinor, p_idempotency_key: input.idempotencyKey,
  });
  const batch = (data as Array<{ batch_id?: number; batch_reference?: string; amount_minor?: number; member_count?: number }> | null)?.[0];
  if (error || !batch?.batch_id || !/^LPB-[0-9]+$/.test(batch.batch_reference ?? "")
    || batch.amount_minor !== input.confirmedAmountMinor || batch.member_count !== input.earningIds.length) {
    throw new Error("Live payout batch approval could not be completed safely.");
  }
  return batch;
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

/** Initiates exactly one immutable batch attempt. An idempotent replay that
 * returns an existing attempt never calls the provider again. */
export async function submitInstructorLivePayoutBatch(batchId: number, idempotencyKey: string, actorUserId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_SUBMISSION_ENABLED !== "true"
    || !Number.isSafeInteger(batchId) || batchId <= 0
    || !/^[a-z][a-z0-9:_-]{2,120}$/.test(idempotencyKey)) {
    throw new Error("Live payout batch submission is disabled.");
  }
  const admin = createAdminClient();
  const { data: preflightRows, error: preflightError } = await admin.rpc("get_learning_instructor_live_payout_batch_preflight", {
    p_operator_id: actorUserId, p_batch_id: batchId,
  });
  const preflight = (preflightRows as Array<{ amount_minor?: number; currency?: string }> | null)?.[0];
  const preflightAmount = preflight?.amount_minor;
  if (preflightError || typeof preflightAmount !== "number" || !Number.isSafeInteger(preflightAmount)
    || preflightAmount < 100000 || preflight?.currency !== "NGN") {
    throw new Error("Live payout batch is unavailable for balance preflight.");
  }
  // This is a read-only provider balance check. It runs before the database
  // attempt is created and before any transfer-initiation request is sent.
  await assertPaystackLiveBalanceCoversPayout(preflightAmount);
  const { data, error } = await admin.rpc("begin_learning_instructor_live_payout_batch_transfer", {
    p_batch_id: batchId, p_actor_user_id: actorUserId, p_idempotency_key: idempotencyKey,
  });
  const attempt = (data as Array<{ attempt_id?: number; attempt_reference?: string; recipient_code?: string;
    amount_minor?: number; currency?: string; transfer_submission_needed?: boolean }> | null)?.[0];
  if (error || !attempt?.attempt_id || !attempt.attempt_reference
    || !/^lpb-live-batch-[0-9]+-a[0-9]+$/.test(attempt.attempt_reference)
    || !attempt.recipient_code || !Number.isSafeInteger(attempt.amount_minor)
    || attempt.amount_minor! < 100000 || attempt.currency !== "NGN") {
    throw new Error("Live payout batch is not eligible for submission.");
  }
  if (attempt.transfer_submission_needed !== true) {
    return { status: "verification_required" as const, attemptReference: attempt.attempt_reference };
  }
  let transfer;
  try {
    transfer = await initiatePaystackLivePayoutBatchTransfer({ recipientCode: attempt.recipient_code,
      amountMinor: attempt.amount_minor!, reference: attempt.attempt_reference });
  } catch {
    await admin.rpc("mark_learning_instructor_live_payout_batch_recovery_required", {
      p_attempt_id: attempt.attempt_id, p_actor_user_id: actorUserId,
    });
    throw new Error("Live payout batch status is unknown. Verify its reference before any retry.");
  }
  const { error: persistError } = await admin.rpc("record_learning_instructor_live_payout_batch_transfer", {
    p_attempt_id: attempt.attempt_id, p_transfer_id: transfer.transferId,
    p_transfer_code: transfer.transferCode, p_provider_status: transfer.status, p_actor_user_id: actorUserId,
  });
  if (persistError) {
    await admin.rpc("mark_learning_instructor_live_payout_batch_recovery_required", {
      p_attempt_id: attempt.attempt_id, p_actor_user_id: actorUserId,
    });
    throw new Error("Live batch transfer identity could not be recorded; verify before further action.");
  }
  return { status: transfer.status as "otp" | "pending", attemptReference: attempt.attempt_reference };
}

export async function finalizeInstructorLivePayoutBatchOtp(attemptId: number, otp: string, actorUserId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_SUBMISSION_ENABLED !== "true"
    || process.env.LEARNING_LIVE_PAYOUT_BATCH_OTP_ENABLED !== "true"
    || !Number.isSafeInteger(attemptId) || attemptId <= 0 || !/^\d{6}$/.test(otp)) {
    throw new Error("Live payout batch OTP finalization is unavailable.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("begin_learning_instructor_live_payout_batch_otp_finalization", {
    p_attempt_id: attemptId, p_actor_user_id: actorUserId,
  });
  const attempt = (data as Array<{ otp_attempt_id?: number; attempt_reference?: string; transfer_code?: string;
    transfer_id?: string; amount_minor?: number; currency?: string }> | null)?.[0];
  if (error || !attempt?.otp_attempt_id || !attempt.attempt_reference
    || !/^lpb-live-batch-[0-9]+-a[0-9]+$/.test(attempt.attempt_reference)
    || !attempt.transfer_code || !attempt.transfer_id || !Number.isSafeInteger(attempt.amount_minor)
    || attempt.currency !== "NGN") throw new Error("Live payout batch OTP finalization is unavailable.");
  try {
    await finalizePaystackLiveTransfer({ transferCode: attempt.transfer_code, transferId: attempt.transfer_id,
      reference: attempt.attempt_reference, amountMinor: attempt.amount_minor!, otp });
  } catch {
    await admin.rpc("complete_learning_instructor_live_payout_batch_otp_finalization", {
      p_otp_attempt_id: attempt.otp_attempt_id, p_outcome: "needs_attention", p_actor_user_id: actorUserId,
    });
    throw new Error("Live batch transfer status requires verification; do not submit another OTP.");
  }
  const { error: persistError } = await admin.rpc("complete_learning_instructor_live_payout_batch_otp_finalization", {
    p_otp_attempt_id: attempt.otp_attempt_id, p_outcome: "submitted", p_actor_user_id: actorUserId,
  });
  if (persistError) throw new Error("Batch OTP result could not be recorded; verify the transfer reference.");
  return { status: "awaiting_provider_outcome" as const };
}

export async function recoverInstructorLivePayoutBatch(attemptId: number, actorUserId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_RECONCILIATION_ENABLED !== "true"
    || !Number.isSafeInteger(attemptId) || attemptId <= 0) throw new Error("Live payout batch recovery is disabled.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_learning_instructor_live_payout_batch_transfer_for_recovery", {
    p_attempt_id: attemptId, p_actor_user_id: actorUserId,
  });
  const attempt = (data as Array<{ attempt_id?: number; attempt_reference?: string; amount_minor?: number;
    currency?: string; provider_transfer_id?: string | null; provider_transfer_code?: string | null }> | null)?.[0];
  if (error || !attempt?.attempt_id || !attempt.attempt_reference
    || !/^lpb-live-batch-[0-9]+-a[0-9]+$/.test(attempt.attempt_reference)
    || !Number.isSafeInteger(attempt.amount_minor) || attempt.currency !== "NGN") {
    throw new Error("Live payout batch recovery is unavailable.");
  }
  const transfer = await verifyPaystackLiveTransfer(attempt.attempt_reference);
  if (transfer.reference !== attempt.attempt_reference || transfer.amountMinor !== attempt.amount_minor
    || transfer.currency !== attempt.currency || transfer.domain !== "live"
    || (attempt.provider_transfer_id && attempt.provider_transfer_id !== transfer.transferId)
    || (attempt.provider_transfer_code && attempt.provider_transfer_code !== transfer.transferCode)) {
    throw new Error("Provider transfer does not match the Live payout batch attempt.");
  }
  const providerStatus = transfer.status === "otp" ? "pending" : transfer.status;
  if (!["succeeded", "failed", "reversed", "pending"].includes(providerStatus)) {
    return { status: "needs_attention" as const };
  }
  const identity = `provider-api:${transfer.reference}:${providerStatus}:${transfer.transferId}`;
  const { data: received, error: receiptError } = await admin.rpc("receive_paystack_live_instructor_payout_batch_event", {
    p_provenance: "provider_api", p_provider_event_id: identity,
    p_payload_digest: digestPaystackPayload(JSON.stringify(transfer)), p_reference: transfer.reference,
    p_transfer_id: transfer.transferId, p_transfer_code: transfer.transferCode,
    p_status: providerStatus, p_amount_minor: transfer.amountMinor, p_currency: transfer.currency,
    p_actor_user_id: actorUserId,
  });
  const receipt = (received as Array<{ provider_event_id?: number; outcome?: string }> | null)?.[0];
  if (receiptError || !receipt?.provider_event_id || receipt.outcome === "duplicate_conflict") {
    throw new Error("Live payout batch evidence could not be received safely.");
  }
  const { error: processError } = await admin.rpc("process_paystack_live_instructor_payout_batch_event", {
    p_provider_event_id: receipt.provider_event_id,
  });
  if (processError) throw new Error("Live payout batch evidence is retained for reconciliation.");
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
