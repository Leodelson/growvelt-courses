"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActionSubmitButton } from "@/app/components/action-submit-button";
import { provisionOwnTestSubscriptionPlan, type SubscriptionPlanProvisionActionState } from "@/app/dashboard/instructor/subscriptions/actions";
import styles from "./subscription-plans.module.css";

const initialState: SubscriptionPlanProvisionActionState = { status: "idle", message: "" };

export function ProvisionSubscriptionTestPlanButton({ planId, label }: { planId: string; label: string }) {
  const [state, formAction] = useActionState(provisionOwnTestSubscriptionPlan, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" || state.status === "notice") router.refresh();
  }, [router, state.status]);

  return <div className={styles.provisionBox}>
    <form action={formAction}>
      <input type="hidden" name="plan_id" value={planId} />
      <ActionSubmitButton label={label} pendingLabel="Preparing preview…" />
    </form>
    <p>This prepares plan details for a private preview. It does not charge learners or enable subscription checkout.</p>
    {state.message && <p className={`${styles.feedback} ${state.status === "error" ? styles.error : state.status === "success" ? styles.success : styles.notice}`} role="status">{state.message}</p>}
  </div>;
}
