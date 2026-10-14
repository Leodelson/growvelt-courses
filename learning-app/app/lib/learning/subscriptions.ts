import { createClient } from "@/app/lib/supabase/server";
import { logSupabaseError } from "@/app/lib/supabase/logging";

export type OwnLearningSubscription = {
  subscription_id: string;
  plan_name: string;
  amount_minor: number;
  currency: "NGN";
  subscription_status: "pending" | "active" | "non_renewing" | "attention" | "cancelled" | "completed" | "expired";
  paid_through: string | null;
  cancel_requested_at: string | null;
  course_titles: string[];
  provider_management_available: boolean;
};

export async function listOwnLearningSubscriptions(): Promise<OwnLearningSubscription[]> {
  const { data, error } = await (await createClient()).rpc("list_own_learning_subscriptions");
  if (error) {
    logSupabaseError("learner.subscriptions_load_failed", error);
    throw new Error("Unable to load your subscriptions.");
  }
  return (data ?? []) as OwnLearningSubscription[];
}
