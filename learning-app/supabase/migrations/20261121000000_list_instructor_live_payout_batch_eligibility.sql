-- Read-only planning projection for the proposed NGN 1,000 ordinary payout
-- threshold. This function never reserves earnings or authorizes a transfer.
begin;

create or replace function public.list_learning_instructor_live_payout_batch_eligibility(
  p_operator_id uuid,
  p_limit integer default 100
)
returns table(
  instructor_id uuid,
  currency text,
  eligible_amount_minor bigint,
  eligible_earning_count bigint,
  has_live_profile boolean,
  meets_ordinary_minimum boolean
)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or not exists (
    select 1 from public.account_capabilities c
    where c.user_id = p_operator_id and c.capability = 'admin' and c.status = 'active'
  ) then
    raise exception 'Active administrator required' using errcode = '42501';
  end if;
  return query with eligible as (
    select e.instructor_id, e.currency, e.id, e.gross_amount_minor
    from public.learning_instructor_earnings e
    join public.learning_commercial_allocations a
      on a.id = e.allocation_id and a.instructor_id = e.instructor_id
    join public.learning_orders o on o.id = a.order_id
    where e.status = 'available'
      and e.recoverable_amount_minor = 0
      and a.status = 'allocated'
      and o.status = 'paid'
      and e.currency = 'NGN' and a.currency = e.currency and o.currency = e.currency
      -- A released reservation can still exist after a failed transfer. Do not
      -- count it until its recovery path has been explicitly reconciled.
      and not exists (
        select 1 from public.learning_instructor_earning_reservations r
        where r.earning_id = e.id
      )
      and (select count(*) from public.learning_payment_attempts attempt
        where attempt.order_id = o.id and attempt.status = 'succeeded') = 1
      and exists (
        select 1 from public.learning_payment_attempts attempt
        where attempt.order_id = o.id and attempt.status = 'succeeded'
          and attempt.provider = 'paystack' and attempt.paystack_domain = 'live'
          and attempt.amount_minor = o.gross_amount_minor
          and attempt.currency = o.currency
      )
      and not exists (
        select 1 from public.learning_payment_cases payment_case
        where payment_case.order_id = o.id and payment_case.status in
          ('requested','submitting','pending','processing','needs_attention',
           'opened','action_required','submitted','under_review',
           'processed','succeeded','lost')
      )
  ), totals as (
    select e.instructor_id, e.currency,
      sum(e.gross_amount_minor)::bigint as eligible_amount_minor,
      count(*)::bigint as eligible_earning_count
    from eligible e
    group by e.instructor_id, e.currency
  )
  select t.instructor_id, t.currency, t.eligible_amount_minor,
    t.eligible_earning_count,
    exists (
      select 1 from public.learning_instructor_payout_profiles profile
      where profile.instructor_id = t.instructor_id
        and profile.provider = 'paystack' and profile.provider_domain = 'live'
        and profile.status = 'active' and profile.currency = t.currency
    ) as has_live_profile,
    t.eligible_amount_minor >= 100000 as meets_ordinary_minimum
  from totals t
  order by t.eligible_amount_minor desc, t.instructor_id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$function$;

revoke all on function public.list_learning_instructor_live_payout_batch_eligibility(uuid,integer)
  from public, anon, authenticated;
grant execute on function public.list_learning_instructor_live_payout_batch_eligibility(uuid,integer)
  to postgres, service_role;

commit;
