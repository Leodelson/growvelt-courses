import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isApprovedInstructor } from "@/app/lib/instructor/authorization";
import { getOwnInstructorSubscriptionPlanData } from "@/app/lib/instructor/subscription-plans";
import { areLearningSubscriptionPlansEnabled, canProvisionTestSubscriptionPlans } from "@/app/lib/subscriptions/feature";
import { SubscriptionPlanForm } from "@/app/components/instructor/subscription-plan-form";
import { ProvisionSubscriptionTestPlanButton } from "@/app/components/instructor/provision-subscription-test-plan-button";
import { EmptyState } from "@/app/components/ui/empty-state";
import styles from "@/app/components/instructor/subscription-plans.module.css";

import { WorkbenchList } from "@/app/components/instructor/workbench-list";
import workbench from "@/app/components/instructor/workbench.module.css";

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

  return <section className={`instructor-earnings-page section-shell ${workbench.page}`}>
    <header className="instructor-earnings-hero">
      <p className="eyebrow">Instructor subscriptions · Private setup</p>
      <h1>Build a monthly plan for your courses.</h1>
      <p>Plans begin as private drafts. Monthly subscription checkout and learner access are not currently available.</p>
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
          <p>Only you can view your plans. Saving a draft or preparing its private preview does not charge learners or change course access.</p>
        </header>
        {plans.length ? <div className={styles.planList}><WorkbenchList metricLabel="Monthly price, highest first" statuses={{not_started:"Draft setup",recorded:"Preview ready",claimed:"Setup in progress",failed:"Preview setup failed",needs_reconciliation:"Review required",disabled:"Disabled"}} items={plans.map((plan) => {
          const provision = provisionByPlanId.get(plan.plan_id);
          const isCompanyTestModePlan = plan.course_ids.some((courseId) =>
            courses.find((course) => course.course_id === courseId)?.company_test_mode_only === true);
          const provisionState = provision?.provisioning_state ?? "not_started";
          const statusLabel = provisionState === "recorded" ? "Preview ready"
            : provisionState === "needs_reconciliation" ? "Review required"
              : provisionState === "claimed" ? "Setup in progress"
                : provisionState === "failed" ? "Preview setup failed"
                  : plan.status.replace("_", " ");
          return {id:plan.plan_id,title:plan.name,status:plan.status==="disabled"?"disabled":provisionState,keywords:plan.course_titles.join(" "),metric:plan.amount_minor,content:<article className={styles.planCard}>
          <div className={styles.planHeading}><div><span className={styles.status}>{statusLabel}</span><h3>{plan.name}</h3></div><strong>{formatPrice(plan.amount_minor)}<small> / month</small></strong></div>
          {plan.description && <p>{plan.description}</p>}
          <ul aria-label="Included courses">{plan.course_titles.map((title, index) => <li key={`${plan.plan_id}-${plan.course_ids[index]}`}>{title}</li>)}</ul>
          {isCompanyTestModePlan && <p className={styles.notice} role="note">This plan contains an organization-only course and remains private, outside public catalog and subscription listings.</p>}
          {isCompanyTestModePlan && provisionState === "recorded" && plan.status === "active" && <p className={styles.notice} role="note">
            Private subscription preview link (share only with the approved learner): <Link href={"/dashboard/test-subscriptions/" + plan.plan_id}>Open private preview</Link>
          </p>}
          {canCreateTestPlans && plan.status === "draft" && ["not_started", "failed"].includes(provisionState)
            && <ProvisionSubscriptionTestPlanButton planId={plan.plan_id} label={provisionState === "failed" ? "Retry preview setup" : "Prepare private preview"} />}
          {provisionState === "needs_reconciliation" && <p className={styles.notice} role="status">Do not retry this plan. A previous setup may have completed; administrator review is required before another attempt.</p>}
          {provisionState === "claimed" && <>
            <p className={styles.notice} role="status">Setup is already in progress. Do not submit it again while the request is being processed.</p>
            {canCreateTestPlans && <ProvisionSubscriptionTestPlanButton planId={plan.plan_id} label="Check setup status" />}
          </>}
        </article>};})} /></div> : <EmptyState titleId="subscription-plans-empty-title" headingLevel={3}
          icon="courses" title="No subscription plans yet"
          description="Create a draft above when your eligible course list is ready."
        />}
      </section>
    </>}
  </section>;
}
