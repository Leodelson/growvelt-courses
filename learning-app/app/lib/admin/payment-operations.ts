import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";

export type PaymentOperation = { order_id: number; order_reference: string; learner_email: string | null; course_title: string; amount_minor: number; currency: string; order_status: string; attempt_status: string | null; provider_transaction_id: string | null; latest_event_id: number | null; event_status: string | null; recovery_status: string | null; created_at: string; issue_count: number };

export async function listPaymentOperations(operatorId: string, query?: string) {
  const { data, error } = await createAdminClient().rpc("list_learning_payment_operations", { p_operator_id: operatorId, p_query: query?.trim() || null, p_limit: 50 });
  if (error) throw new Error("Unable to load payment operations.");
  return (data ?? []) as PaymentOperation[];
}
