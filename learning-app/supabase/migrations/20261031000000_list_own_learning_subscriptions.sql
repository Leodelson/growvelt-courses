-- Give learners a private status view for their own recurring plans.
-- Provider subscription codes remain server-side; this projection exposes only
-- whether a verified Test Mode management link can be requested.

begin;

create or replace function public.list_own_learning_subscriptions()
returns table(
  subscription_id uuid,
  plan_name text,
  amount_minor bigint,
  currency text,
  subscription_status text,
  paid_through timestamptz,
  cancel_requested_at timestamptz,
  course_titles text[],
  provider_management_available boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    subscription.id,
    coalesce(paid_snapshot.plan_name_snapshot, plan.name),
    coalesce(paid_snapshot.amount_minor, plan.amount_minor),
    plan.currency,
    subscription.status,
    subscription.paid_through,
    subscription.cancel_requested_at,
    coalesce(array_agg(course.title order by course.title) filter (where course.title is not null), '{}'::text[]),
    subscription.payment_domain = 'test'
      and subscription.paystack_subscription_code is not null
      and subscription.status in ('active', 'attention')
  from public.learning_subscriptions subscription
  join public.learning_subscription_plans plan on plan.id = subscription.plan_id
  left join lateral (
    select invoice.plan_name_snapshot, invoice.amount_minor
    from public.learning_subscription_invoices invoice
    where invoice.subscription_id = subscription.id and invoice.status = 'paid'
    order by invoice.billing_period_starts_at desc, invoice.created_at desc
    limit 1
  ) paid_snapshot on true
  left join public.learning_subscription_plan_courses plan_course on plan_course.plan_id = plan.id
  left join public.learning_courses course on course.id = plan_course.course_id
  where auth.uid() is not null and subscription.learner_id = auth.uid()
  group by subscription.id, plan.name, plan.amount_minor, plan.currency,
    paid_snapshot.plan_name_snapshot, paid_snapshot.amount_minor
  order by subscription.created_at desc, subscription.id desc;
$function$;

revoke all on function public.list_own_learning_subscriptions()
  from public, anon, service_role;
grant execute on function public.list_own_learning_subscriptions()
  to authenticated;

commit;
