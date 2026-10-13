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
  const [plansResult, coursesResult, provisioningResult] = await Promise.all([
    supabase.rpc("list_own_learning_subscription_plans"),
    supabase.rpc("list_own_learning_subscription_plan_courses"),
    supabase.rpc("list_own_learning_subscription_plan_provisioning"),
  ]);

  return {
    available: !plansResult.error && !coursesResult.error && !provisioningResult.error,
    plans: (plansResult.data ?? []) as InstructorSubscriptionPlan[],
    courses: (coursesResult.data ?? []) as InstructorSubscriptionPlanCourse[],
    provisioning: (provisioningResult.data ?? []) as InstructorSubscriptionPlanProvisioning[],
  };
}
