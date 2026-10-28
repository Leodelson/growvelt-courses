import { notFound } from "next/navigation";
import { SubscriptionPlanPurchase, type PublicTestSubscriptionPlan } from "@/app/components/learning/subscription-plan-purchase";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { createClient } from "@/app/lib/supabase/server";
import { canStartTestSubscriptionCheckout, canUsePrivateTestSubscriptionCheckout } from "@/app/lib/subscriptions/feature";

export const metadata = { title: "Private subscription preview" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PrivateTestSubscriptionPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  if (!UUID_PATTERN.test(planId) || !canStartTestSubscriptionCheckout()) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !canUsePrivateTestSubscriptionCheckout(user.email)) notFound();

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    notFound();
  }
  const { data, error } = await admin.rpc("get_company_test_learning_subscription_plan_for_checkout", {
    p_plan_id: planId,
  });
  if (error) {
    console.error("subscription.private_test_plan_page_lookup_failed", { learnerId: user.id, code: error.code });
    notFound();
  }
  const plan = (data as PublicTestSubscriptionPlan[] | null)?.[0];
  if (!plan || plan.plan_id !== planId) notFound();

  return <section className="published-course-page section-shell">
    <header className="published-course-hero">
      <p className="eyebrow">Private learner preview</p>
      <h1>Subscription plan preview</h1>
      <p className="published-course-summary">This private offer is available only to an approved learner. It does not appear in Explore and cannot start a real subscription purchase.</p>
    </header>
    <div className="published-course-layout">
      <article className="published-course-content">
        <p className="eyebrow">Included courses</p>
        <h2>{plan.name}</h2>
        {plan.description ? <p>{plan.description}</p> : null}
        <ul>{plan.course_titles.map((title, index) => <li key={String(index) + title}>{title}</li>)}</ul>
      </article>
      <aside className="published-course-aside">
        <SubscriptionPlanPurchase plan={plan} privateTestCheckout />
      </aside>
    </div>
  </section>;
}
