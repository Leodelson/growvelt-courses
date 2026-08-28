import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type PaymentOperation = { order_id: number; order_reference: string; learner_email: string | null; course_title: string; amount_minor: number; currency: string; order_status: string; attempt_status: string | null; provider_transaction_id: string | null; latest_event_id: number | null; event_status: string | null; recovery_status: string | null; created_at: string; issue_count: number };
export type RefundCase = { case_id: number; order_id: number; order_reference: string; case_reference: string; status: string; amount_minor: number; currency: string; reason_code: string | null; operator_note: string | null; provider_case_id: string | null; provider_case_reference: string | null; provider_status: string | null; requested_at: string | null; provider_submitted_at: string | null; last_verified_at: string | null; action_required_at: string | null; processed_at: string | null; failed_at: string | null; failure_code: string | null; failure_message: string | null };
export type RefundCaseEvent = { event_id: number; payment_case_id: number; event_type: string; normalized_status: string; provenance: string; note: string | null; created_at: string };
export type DisputeCase = { case_id:number;order_id:number;order_reference:string;status:string;amount_minor:number;currency:string;provider_case_id:string;provider_status:string|null;provider_resolution:string|null;dispute_category:string|null;dispute_reason:string|null;response_deadline_at:string|null;action_required_at:string|null;opened_at:string;resolved_at:string|null };

export async function listPaymentOperations(operatorId: string, query?: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_payment_operations", { p_operator_id: operatorId, p_query: query?.trim() || null, p_limit: 50 });
  if (error) throw new Error("Unable to load payment operations.");
  return (data ?? []) as PaymentOperation[];
}

export async function listRefundCases(operatorId: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_refund_cases", { p_operator_id: operatorId, p_order_id: null });
  if (error) throw new Error("Unable to load refund cases.");
  return (data ?? []) as RefundCase[];
}

export async function listRefundCaseEvents(operatorId: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_payment_case_events", { p_operator_id: operatorId, p_case_id: null });
  if (error) throw new Error("Unable to load refund case history.");
  return (data ?? []) as RefundCaseEvent[];
}

export async function listDisputeCases(operatorId:string){const {data,error}=await createAdminClient().rpc("list_learning_dispute_cases",{p_operator_id:operatorId,p_order_id:null});if(error)throw new Error("Unable to load dispute cases.");return(data??[])as DisputeCase[];}
