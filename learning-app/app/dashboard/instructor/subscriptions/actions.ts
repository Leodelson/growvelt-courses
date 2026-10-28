"use server";

import { revalidatePath } from "next/cache";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import { areLearningSubscriptionPlansEnabled, canProvisionTestSubscriptionPlans } from "@/app/lib/subscriptions/feature";
import { getPaystackTestConfig } from "@/app/lib/payments/paystack";
import { createPaystackTestSubscriptionPlan, PaystackTestPlanCreateError } from "@/app/lib/payments/paystack-subscriptions";
import { parseNgNPriceToMinorUnits, parseSelectedSubscriptionCourseIds } from "@/app/lib/subscriptions/plan-input";

export type SubscriptionPlanActionState = {
  status: "idle" | "error" | "success";
  message: string;
  planId: string | null;
};

export type SubscriptionPlanProvisionActionState = {
  status: "idle" | "error" | "notice" | "success";
  message: string;
};

function firstRow(value: unknown) {
  return Array.isArray(value) && value[0] && typeof value[0] === "object"
    ? value[0] as Record<string, unknown>
    : null;
}

export async function createOwnSubscriptionPlan(
  _previousState: SubscriptionPlanActionState,
  formData: FormData,
): Promise<SubscriptionPlanActionState> {
  if (!areLearningSubscriptionPlansEnabled()) {
    return { status: "error", message: "Subscription plans are not enabled in this environment.", planId: null };
  }
  if (!await isApprovedInstructor()) {
    return { status: "error", message: "An approved instructor account is required.", planId: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amountMinor = parseNgNPriceToMinorUnits(String(formData.get("monthly_price") ?? ""));
  const courseIds = parseSelectedSubscriptionCourseIds(formData.getAll("course_ids").map(String));

  if (name.length < 3 || name.length > 100 || description.length > 1000 || amountMinor === null || !courseIds) {
    return { status: "error", message: "Check the plan details, monthly price, and selected courses, then try again.", planId: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_own_learning_subscription_plan", {
    p_name: name,
    p_description: description || null,
    p_amount_minor: amountMinor,
    p_course_ids: courseIds,
  });

  if (error || typeof data !== "string") {
    return { status: "error", message: "We couldn’t save this draft. Confirm the subscription database migration is available and try again.", planId: null };
  }

  revalidatePath("/dashboard/instructor/subscriptions");
  return { status: "success", message: "Draft plan saved. No recurring plan was started and no learner was charged.", planId: data };
}

export async function provisionOwnTestSubscriptionPlan(
  _previousState: SubscriptionPlanProvisionActionState,
  formData: FormData,
): Promise<SubscriptionPlanProvisionActionState> {
  if (!canProvisionTestSubscriptionPlans()) {
    return { status: "error", message: "Private plan preview setup is not available in this environment." };
  }
  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId)) {
    return { status: "error", message: "Choose a valid subscription draft." };
  }

  // Fail before claiming a draft if the server does not have a valid Test key.
  try { getPaystackTestConfig(false); } catch {
    return { status: "error", message: "Private plan preview setup is unavailable; no plan was submitted." };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { status: "error", message: "Sign in again with an approved instructor account." };
  }
  const { data: approved, error: approvalError } = await supabase.rpc("is_approved_growvelt_instructor");
  if (approvalError || approved !== true) {
    return { status: "error", message: "An approved instructor account is required." };
  }
  let admin;
  try { admin = createAdminClient(); } catch {
    return { status: "error", message: "Secure plan recording is unavailable; no plan was submitted." };
  }
  const { data: claimData, error: claimError } = await supabase.rpc(
    "claim_own_learning_subscription_plan_provisioning", { p_plan_id: planId },
  );
  const claim = firstRow(claimData);
  if (claimError || !claim) {
    return { status: "error", message: "We couldn’t reserve this draft. No plan was submitted." };
  }

  const claimState = claim.provisioning_state;
  if (claimState === "recorded") {
    revalidatePath("/dashboard/instructor/subscriptions");
    return { status: "success", message: "The private preview is already prepared. No duplicate plan was created." };
  }
  if (claimState === "in_progress") {
    return { status: "notice", message: "This plan is already being processed. Wait for it to refresh; do not submit it again." };
  }
  if (claimState === "needs_reconciliation") {
    revalidatePath("/dashboard/instructor/subscriptions");
    return { status: "notice", message: "The setup result is uncertain. Do not retry; an administrator must review it first." };
  }
  if (claimState !== "claimed") {
    return { status: "error", message: "This draft cannot be submitted for private preview setup." };
  }

  const amountValue = claim.amount_minor;
  const amountMinor = typeof amountValue === "number" ? amountValue
    : typeof amountValue === "string" && /^\d+$/.test(amountValue) ? Number(amountValue) : NaN;
  if (typeof claim.plan_name !== "string" || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    await admin.rpc("finish_own_learning_subscription_plan_provisioning", {
      p_plan_id: planId, p_instructor_id: user.id, p_outcome: "ambiguous",
    });
    revalidatePath("/dashboard/instructor/subscriptions");
    return { status: "notice", message: "The saved draft needs review before setup can continue. Do not retry." };
  }

  let createdPlan;
  try {
    createdPlan = await createPaystackTestSubscriptionPlan({
      name: claim.plan_name,
      description: typeof claim.plan_description === "string" ? claim.plan_description : null,
      amountMinor,
    });
  } catch (error) {
    const outcome = error instanceof PaystackTestPlanCreateError && error.disposition === "rejected"
      ? "provider_rejected"
      : "ambiguous";
    const { error: finishError } = await admin.rpc("finish_own_learning_subscription_plan_provisioning", {
      p_plan_id: planId, p_instructor_id: user.id, p_outcome: outcome,
    });
    if (finishError) console.error("subscription.test_plan_failure_record_failed", { planId, code: finishError.code });
    if (outcome === "provider_rejected" && !finishError) {
      revalidatePath("/dashboard/instructor/subscriptions");
      return { status: "error", message: "The preview setup was rejected. No plan was created; you can safely try again." };
    }
    if (!finishError) revalidatePath("/dashboard/instructor/subscriptions");
    return { status: "notice", message: "Setup confirmation is uncertain. Do not retry; an administrator must review it first." };
  }

  const { data: recorded, error: recordError } = await admin.rpc(
    "record_own_learning_subscription_plan_provisioning",
    { p_plan_id: planId, p_instructor_id: user.id, p_paystack_plan_code: createdPlan.planCode },
  );
  if (recordError || recorded !== "recorded") {
    const { data: finalState, error: finishError } = await admin.rpc("finish_own_learning_subscription_plan_provisioning", {
      p_plan_id: planId, p_instructor_id: user.id, p_outcome: "ambiguous",
    });
    if (!finishError && finalState === "recorded") {
      revalidatePath("/dashboard/instructor/subscriptions");
      return { status: "success", message: "The private preview plan was recorded. This does not start a learner subscription or charge anyone." };
    }
    if (recordError) console.error("subscription.test_plan_record_failed", { planId, code: recordError.code, reconciliationRecorded: !finishError });
    if (!finishError) revalidatePath("/dashboard/instructor/subscriptions");
    return { status: "notice", message: "The plan may have been created, but Growvelt could not confirm the record. Do not retry; an administrator must review it first." };
  }

  revalidatePath("/dashboard/instructor/subscriptions");
  return { status: "success", message: "Private preview plan created and recorded. This does not start a learner subscription or charge anyone." };
}
