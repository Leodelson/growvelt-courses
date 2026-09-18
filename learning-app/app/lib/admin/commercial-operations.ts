import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";

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
export type InstructorPayoutItem = { payout_item_id: number; reservation_id: number; reservation_reference: string; payout_item_reference: string; instructor_name: string | null; instructor_email: string | null; amount_minor: number; currency: "NGN"; status: string; provider_status: string | null; provider_transfer_code: string | null; provider_domain: "test"; approved_at: string; initiated_at: string | null };

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

export async function listInstructorPayoutItems(operatorId: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_instructor_payout_items", { p_operator_id: operatorId, p_limit: 100 });
  if (error) throw new Error("Unable to load payout items.");
  return (data ?? []) as InstructorPayoutItem[];
}
