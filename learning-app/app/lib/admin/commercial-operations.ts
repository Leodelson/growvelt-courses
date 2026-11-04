import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type SubscriptionInvoiceEarningReview = {
  invoice_id: string; provider_reference: string; instructor_id: string; instructor_name: string | null;
  earning_id: number; amount_minor: number; currency: string;
  earning_status: string; available_at: string | null;
  invoice_status: string; refund_status: string | null;
  has_live_payout_profile: boolean;
};

export async function listSubscriptionInvoiceEarningsForAdmin(operatorId: string) {
  const { data, error } = await createAdminClient().rpc(
    "list_learning_subscription_invoice_earnings_for_admin",
    { p_operator_id: operatorId, p_limit: 100 },
  );
  if (error) throw new Error("Unable to load subscription earnings review.");
  return (data ?? []) as SubscriptionInvoiceEarningReview[];
}

export type CommercialOperation = {
  earning_id: number;
  instructor_id: string;
  instructor_name: string | null;
  instructor_email: string | null;
  order_id: number;
  order_reference: string;
  course_id: number | null;
  course_title: string;
  gross_amount_minor: number;
  platform_commission_minor: number;
  instructor_gross_minor: number;
  currency: "NGN";
  earning_status: "held" | "available" | "reserved" | "paid" | "reversed" | "recoverable";
  available_at: string;
  released_at: string | null;
  reversed_at: string | null;
  recoverable_amount_minor: number;
  commercial_terms_version: string;
  allocation_status: "allocated" | "reversed";
  reversal_case_id: number | null;
  reconciliation_issue_count: number;
  reconciliation_details: string[];
};

export type CommercialEarningsReleaseRun = {
  run_id: number;
  invocation_source: "scheduler" | "admin_recovery";
  actor_user_id: string | null;
  status: "started" | "succeeded" | "failed";
  released_count: number;
  failure_code: string | null;
  started_at: string;
  completed_at: string | null;
};

export type InstructorPayoutProfile = {
  payout_profile_id: number;
  instructor_id: string;
  instructor_name: string | null;
  instructor_email: string | null;
  status: "active" | "disabled";
  provider: "paystack";
  provider_domain: "test" | "live";
  recipient_code: string;
  currency: "NGN";
  bank_code: string;
  bank_name: string;
  account_name: string;
  account_last4: string;
  created_at: string;
  disabled_at: string | null;
};

export type InstructorPayoutCandidate = { reservation_id: number; reservation_reference: string; instructor_name: string | null; instructor_email: string | null; amount_minor: number; currency: "NGN"; eligible: boolean };
export type InstructorLivePayoutCandidate = Omit<InstructorPayoutCandidate, "eligible">;
export type InstructorPayoutItem = { payout_item_id: number; reservation_id: number; reservation_reference: string; payout_item_reference: string; instructor_name: string | null; instructor_email: string | null; amount_minor: number; currency: "NGN"; status: string; provider_status: string | null; provider_transfer_code: string | null; provider_domain: "test" | "live"; approved_at: string; initiated_at: string | null };
export type InstructorPayoutReconciliationFinding = { finding_id: number; provider_event_id: number | null; payout_item_reference: string | null; finding_type: string; status: "open" | "resolved"; detail: string; created_at: string };
export type InstructorLivePayoutBatchCandidate = {
  source_type: "course_order" | "subscription_invoice";
  earning_id: number; instructor_id: string; instructor_name: string | null; instructor_email: string | null;
  payout_profile_id: number; bank_name: string; account_name: string; account_last4: string;
  source_reference: string; source_label: string; amount_minor: number; currency: "NGN";
  available_at: string; eligible_total_minor: number; eligible_earning_count: number;
};
export type InstructorLivePayoutBatch = {
  batch_id: number; batch_reference: string; source_type: "course_order" | "subscription_invoice";
  instructor_id: string; instructor_name: string | null;
  instructor_email: string | null; payout_profile_id: number; bank_name: string; account_name: string;
  account_last4: string; amount_minor: number; currency: "NGN"; status: string; member_count: number;
  assembled_at: string; attempt_id: number | null; attempt_reference: string | null;
  attempt_status: string | null; provider_status: string | null; provider_transfer_code: string | null;
  attempted_at: string | null;
};
export type InstructorLivePayoutBatchFinding = {
  finding_id: number; attempt_reference: string | null; finding_type: string; detail: string;
  status: "open" | "resolved"; created_at: string;
};

export async function listCommercialOperations(operatorId: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_commercial_operations", { p_operator_id: operatorId, p_limit: 100 });
  if (error) throw new Error("Unable to load commercial operations.");
  return (data ?? []) as CommercialOperation[];
}

export async function listCommercialEarningsReleaseRuns(operatorId: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_instructor_earnings_release_runs", { p_operator_id: operatorId, p_limit: 20 });
  if (error) throw new Error("Unable to load earnings release audit runs.");
  return (data ?? []) as CommercialEarningsReleaseRun[];
}

export async function listInstructorPayoutProfiles(operatorId: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_instructor_payout_profiles", { p_operator_id: operatorId, p_limit: 100 });
  if (error) throw new Error("Unable to load payout profiles.");
  return (data ?? []) as InstructorPayoutProfile[];
}

export async function listInstructorPayoutCandidates(operatorId: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_instructor_payout_candidates", { p_operator_id: operatorId, p_limit: 100 });
  if (error) throw new Error("Unable to load payout candidates.");
  return (data ?? []) as InstructorPayoutCandidate[];
}

export async function listInstructorLivePayoutCandidates(operatorId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_APPROVAL_ENABLED !== "true") return [] as InstructorLivePayoutCandidate[];
  const { data, error } = await createAdminClient().rpc("list_learning_instructor_live_payout_candidates", { p_operator_id: operatorId, p_limit: 100 });
  if (error) throw new Error("Unable to load Live payout candidates.");
  return (data ?? []) as InstructorLivePayoutCandidate[];
}

export async function listInstructorLivePayoutBatchCandidates(operatorId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED !== "true") return [] as InstructorLivePayoutBatchCandidate[];
  const { data, error } = await createAdminClient().rpc("list_learning_live_payout_batch_candidates", {
    p_operator_id: operatorId, p_limit: 200,
  });
  if (error) throw new Error("Unable to load Live payout batch candidates.");
  return (data ?? []) as InstructorLivePayoutBatchCandidate[];
}

export async function listInstructorLivePayoutBatches(operatorId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED !== "true") return [] as InstructorLivePayoutBatch[];
  const { data, error } = await createAdminClient().rpc("list_learning_live_payout_batches", {
    p_operator_id: operatorId, p_limit: 100,
  });
  if (error) throw new Error("Unable to load Live payout batch history.");
  return (data ?? []) as InstructorLivePayoutBatch[];
}

export async function listInstructorLivePayoutBatchFindings(operatorId: string) {
  if (process.env.LEARNING_LIVE_PAYOUT_BATCH_APPROVAL_ENABLED !== "true") return [] as InstructorLivePayoutBatchFinding[];
  const { data, error } = await createAdminClient().rpc("list_learning_instructor_payout_batch_reconciliation_findings", {
    p_operator_id: operatorId, p_limit: 100,
  });
  if (error) throw new Error("Unable to load Live payout batch reconciliation findings.");
  return (data ?? []) as InstructorLivePayoutBatchFinding[];
}

export async function listInstructorPayoutItems(operatorId: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_instructor_payout_items", { p_operator_id: operatorId, p_limit: 100 });
  if (error) throw new Error("Unable to load payout items.");
  return (data ?? []) as InstructorPayoutItem[];
}

export async function listInstructorPayoutReconciliationFindings(operatorId: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_instructor_payout_reconciliation_findings", { p_operator_id: operatorId, p_limit: 100 });
  if (error) throw new Error("Unable to load payout reconciliation findings.");
  return (data ?? []) as InstructorPayoutReconciliationFinding[];
}
