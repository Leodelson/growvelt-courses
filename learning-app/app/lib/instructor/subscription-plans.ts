import { createClient } from "@/app/lib/supabase/server";

export type InstructorSubscriptionPlan = {
  plan_id: string;
  name: string;
  description: string | null;
  amount_minor: number;
  currency: "NGN";
  billing_interval: "monthly";
  status: "draft" | "active" | "disabled";
  course_ids: number[];
  course_titles: string[];
  created_at: string;
  updated_at: string;
};

export type InstructorSubscriptionPlanProvisioning = {
  plan_id: string;
  provisioning_state: "claimed" | "recorded" | "needs_reconciliation" | "failed";
  attempt_count: number;
  payment_domain?: "test" | "live";
};

export type InstructorSubscriptionPlanCourse = {
  course_id: number;
  title: string;
  price_amount: number;
  currency: "NGN";
  commercial_terms_version: string;
  company_test_mode_only: boolean;
};

export async function getOwnInstructorSubscriptionPlanData() {
  const supabase = await createClient();
  const [plansResult, coursesResult, provisioningResult, liveProvisioningResult] = await Promise.all([
    supabase.rpc("list_own_learning_subscription_plans"),
    supabase.rpc("list_own_learning_subscription_plan_courses"),
    supabase.rpc("list_own_learning_subscription_plan_provisioning"),
    supabase.rpc("list_own_learning_live_subscription_plan_ids"),
  ]);

  const liveProvisioning = (liveProvisioningResult.data ?? []) as InstructorSubscriptionPlanProvisioning[];
  const livePlanIds = new Set(liveProvisioning.map((entry) => entry.plan_id));
  const testProvisioning = ((provisioningResult.data ?? []) as InstructorSubscriptionPlanProvisioning[])
    .filter((entry) => !livePlanIds.has(entry.plan_id));

  return {
    available: !plansResult.error && !coursesResult.error && !provisioningResult.error,
    plans: (plansResult.data ?? []) as InstructorSubscriptionPlan[],
    courses: (coursesResult.data ?? []) as InstructorSubscriptionPlanCourse[],
    provisioning: [...testProvisioning, ...liveProvisioning],
  };
}
