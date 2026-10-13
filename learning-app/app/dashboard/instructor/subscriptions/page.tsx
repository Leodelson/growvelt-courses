import { notFound, redirect } from "next/navigation";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnInstructorSubscriptionPlanData } from "@/app/lib/instructor/subscription-plans";
import { areLearningSubscriptionPlansEnabled, canProvisionTestSubscriptionPlans } from "@/app/lib/subscriptions/feature";
import { SubscriptionPlanForm } from "@/app/components/instructor/subscription-plan-form";
import { ProvisionSubscriptionTestPlanButton } from "@/app/components/instructor/provision-subscription-test-plan-button";
import styles from "@/app/components/instructor/subscription-plans.module.css";

export const metadata = { title: "Instructor subscriptions" };

const formatPrice = (amountMinor: number) => new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", minimumFractionDigits: 2,
}).format(Number(amountMinor) / 100);

export default async function InstructorSubscriptionPlansPage() {
  if (!areLearningSubscriptionPlansEnabled()) notFound();
  if (!await isApprovedInstructor()) redirect("/teach/application");

  const { available, courses, plans, provisioning } = await getOwnInstructorSubscriptionPlanData();
  const canCreateTestPlans = canProvisionTestSubscriptionPlans();
  const provisionByPlanId = new Map(provisioning.map((entry) => [entry.plan_id, entry]));

  return <section className="instructor-earnings-page section-shell">
    <header className="instructor-earnings-hero">
      <p className="eyebrow">Instructor subscriptions · Test Mode preparation</p>
      <h1>Build a monthly plan for your courses.</h1>
      <p>Plans begin as private drafts. Subscription checkout, recurring Paystack charges, and learner access are not enabled by this screen.</p>
    </header>

    {!available ? <section className={styles.unavailable} role="status">
      <p className="eyebrow">Setup not available yet</p>
      <h2>The subscription database foundation is not ready in this environment.</h2>
      <p>No plan was created. The reviewed subscription migrations must be applied before enabling this screen.</p>
    </section> : <>
      <SubscriptionPlanForm courses={courses} />
      <section className={styles.planSection} aria-labelledby="subscription-plan-list-title">
        <header className={styles.panelHeader}>
          <p className="eyebrow">Your plans</p>
          <h2 id="subscription-plan-list-title">Your subscription plans</h2>
          <p>Only you can view your plans. Saving a draft does not contact Paystack; Test Mode setup creates provider plan metadata only and does not change learner access or purchase records.</p>
        </header>
        {plans.length ? <div className={styles.planList}>{plans.map((plan) => {
          const provision = provisionByPlanId.get(plan.plan_id);
          const provisionState = provision?.provisioning_state ?? "not_started";
          const statusLabel = provisionState === "recorded" ? "Test plan ready"
            : provisionState === "needs_reconciliation" ? "Review required"
              : provisionState === "claimed" ? "Setup in progress"
                : provisionState === "failed" ? "Test plan request rejected"
                  : plan.status.replace("_", " ");
          return <article className={styles.planCard} key={plan.plan_id}>
          <div className={styles.planHeading}><div><span className={styles.status}>{statusLabel}</span><h3>{plan.name}</h3></div><strong>{formatPrice(plan.amount_minor)}<small> / month</small></strong></div>
          {plan.description && <p>{plan.description}</p>}
          <ul aria-label="Included courses">{plan.course_titles.map((title, index) => <li key={`${plan.plan_id}-${plan.course_ids[index]}`}>{title}</li>)}</ul>
          {canCreateTestPlans && plan.status === "draft" && ["not_started", "failed"].includes(provisionState)
            && <ProvisionSubscriptionTestPlanButton planId={plan.plan_id} label={provisionState === "failed" ? "Retry Test Mode plan setup" : "Create Test Mode plan"} />}
          {provisionState === "needs_reconciliation" && <p className={styles.notice} role="status">Do not retry this plan. Paystack may have created it; admin reconciliation is required before another attempt.</p>}
          {provisionState === "claimed" && <>
            <p className={styles.notice} role="status">Setup is already in progress. Do not submit it again while the request is being processed.</p>
            {canCreateTestPlans && <ProvisionSubscriptionTestPlanButton planId={plan.plan_id} label="Check setup status" />}
          </>}
        </article>})}</div> : <div className={styles.emptyPlans}><h3>No subscription plans yet</h3><p>Create a draft above when your eligible course list is ready.</p></div>}
      </section>
    </>}
  </section>;
}
