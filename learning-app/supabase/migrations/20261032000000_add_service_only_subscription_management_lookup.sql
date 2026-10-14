-- Expose only the minimum subscription and plan fields needed by the
-- server-side Paystack management-link route. The underlying subscription
-- tables intentionally revoke direct access from service_role as well as
-- browser roles, so this narrowly scoped RPC is the safe lookup boundary.

begin;

create or replace function public.get_own_learning_subscription_management_details(
  p_learner_id uuid,
  p_subscription_id uuid
)
returns table(
  subscription_code text,
  payment_domain text,
  subscription_status text,
  plan_code text,
  amount_minor bigint,
  currency text,
  billing_interval text
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    subscription.paystack_subscription_code,
    subscription.payment_domain,
    subscription.status,
    plan.paystack_plan_code,
    plan.amount_minor,
    plan.currency,
    plan.billing_interval
  from public.learning_subscriptions subscription
  join public.learning_subscription_plans plan on plan.id = subscription.plan_id
  where p_learner_id is not null
    and p_subscription_id is not null
    and subscription.id = p_subscription_id
    and subscription.learner_id = p_learner_id;
$function$;

revoke all on function public.get_own_learning_subscription_management_details(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_own_learning_subscription_management_details(uuid, uuid)
  to service_role, postgres;

commit;
