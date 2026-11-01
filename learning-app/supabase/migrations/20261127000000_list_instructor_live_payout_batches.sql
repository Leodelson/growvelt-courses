-- Read-only administrative projections for batch review and reconciliation.
-- These functions do not reserve earnings, create batches, or contact a provider.
begin;

create function public.list_learning_instructor_live_payout_batch_candidates(
  p_operator_id uuid,p_limit integer default 500
) returns table(
  earning_id bigint,instructor_id uuid,instructor_name text,instructor_email text,
  payout_profile_id bigint,bank_name text,account_name text,account_last4 text,
  order_reference text,course_title text,amount_minor bigint,currency text,
  available_at timestamptz,eligible_total_minor bigint,eligible_earning_count bigint
)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or not exists(select 1 from public.account_capabilities c
    where c.user_id=p_operator_id and c.capability='admin' and c.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  return query with eligible as (
    select e.id earning_key,e.instructor_id instructor_key,
      instructor.full_name,instructor.email,profile.id profile_key,profile.bank_name,
      profile.account_name,profile.account_last4,o.order_reference,o.course_title_snapshot,
      e.gross_amount_minor,e.currency,e.available_at
    from public.learning_instructor_earnings e
    join public.learning_commercial_allocations a
      on a.id=e.allocation_id and a.instructor_id=e.instructor_id
    join public.learning_orders o on o.id=a.order_id
    join public.profiles instructor on instructor.id=e.instructor_id
    join public.learning_instructor_payout_profiles profile
      on profile.instructor_id=e.instructor_id and profile.provider='paystack'
      and profile.provider_domain='live' and profile.status='active' and profile.currency=e.currency
    where e.status='available' and e.recoverable_amount_minor=0
      and a.status='allocated' and o.status='paid'
      and e.currency='NGN' and a.currency=e.currency and o.currency=e.currency
      and not exists(select 1 from public.learning_instructor_earning_reservations r where r.earning_id=e.id)
      and not exists(select 1 from public.learning_instructor_payout_items i where i.earning_id=e.id)
      and not exists(select 1 from public.learning_instructor_payout_batch_members m where m.earning_id=e.id)
      and (select count(*) from public.learning_payment_attempts attempt
        where attempt.order_id=o.id and attempt.status='succeeded')=1
      and exists(select 1 from public.learning_payment_attempts attempt
        where attempt.order_id=o.id and attempt.status='succeeded' and attempt.provider='paystack'
          and attempt.paystack_domain='live' and attempt.amount_minor=o.gross_amount_minor
          and attempt.currency=o.currency)
      and not exists(select 1 from public.learning_payment_cases payment_case
        where payment_case.order_id=o.id and payment_case.status in
          ('requested','submitting','pending','processing','needs_attention','opened',
           'action_required','submitted','under_review','processed','succeeded','lost'))
  ), totals as (
    select e.instructor_key,e.profile_key,sum(e.gross_amount_minor)::bigint total_minor,
      count(*)::bigint earning_count
    from eligible e group by e.instructor_key,e.profile_key
    having sum(e.gross_amount_minor)>=100000
  )
  select e.earning_key,e.instructor_key,e.full_name,e.email,e.profile_key,e.bank_name,
    e.account_name,e.account_last4,e.order_reference,e.course_title_snapshot,
    e.gross_amount_minor,e.currency,e.available_at,t.total_minor,t.earning_count
  from eligible e join totals t on t.instructor_key=e.instructor_key and t.profile_key=e.profile_key
  order by t.total_minor desc,e.available_at,e.earning_key
  limit least(greatest(coalesce(p_limit,500),1),500);
end;$function$;

create function public.list_learning_instructor_live_payout_batches(
  p_operator_id uuid,p_limit integer default 100
) returns table(
  batch_id bigint,batch_reference text,instructor_id uuid,instructor_name text,instructor_email text,
  payout_profile_id bigint,bank_name text,account_name text,account_last4 text,
  amount_minor bigint,currency text,status text,member_count bigint,assembled_at timestamptz,
  attempt_id bigint,attempt_reference text,attempt_status text,provider_status text,
  provider_transfer_code text,attempted_at timestamptz
)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or not exists(select 1 from public.account_capabilities c
    where c.user_id=p_operator_id and c.capability='admin' and c.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  return query select b.id,b.batch_reference,b.instructor_id,instructor.full_name,instructor.email,
    profile.id,profile.bank_name,profile.account_name,profile.account_last4,b.amount_minor,b.currency,
    b.status,(select count(*) from public.learning_instructor_payout_batch_members m where m.batch_id=b.id),
    b.assembled_at,attempt.id,attempt.attempt_reference,attempt.status,attempt.provider_status,
    attempt.provider_transfer_code,attempt.initiated_at
  from public.learning_instructor_payout_batches b
  join public.profiles instructor on instructor.id=b.instructor_id
  join public.learning_instructor_payout_profiles profile on profile.id=b.payout_profile_id
  left join lateral (select a.* from public.learning_instructor_payout_batch_attempts a
    where a.batch_id=b.id order by a.attempt_number desc,a.id desc limit 1) attempt on true
  order by b.assembled_at desc,b.id desc
  limit least(greatest(coalesce(p_limit,100),1),200);
end;$function$;

create function public.get_learning_instructor_live_payout_batch_preflight(
  p_operator_id uuid,p_batch_id bigint
) returns table(amount_minor bigint,currency text)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or p_batch_id is null or p_batch_id<=0
    or not exists(select 1 from public.account_capabilities c
      where c.user_id=p_operator_id and c.capability='admin' and c.status='active') then
    raise exception 'Active administrator and valid batch required' using errcode='42501';
  end if;
  return query select b.amount_minor,b.currency
    from public.learning_instructor_payout_batches b
    join public.learning_instructor_payout_profiles profile on profile.id=b.payout_profile_id
    where b.id=p_batch_id and b.status in ('assembled','failed')
      and profile.instructor_id=b.instructor_id and profile.provider='paystack'
      and profile.provider_domain='live' and profile.status='active'
      and profile.currency=b.currency;
end;$function$;

revoke all on function public.list_learning_instructor_live_payout_batch_candidates(uuid,integer),
  public.list_learning_instructor_live_payout_batches(uuid,integer),
  public.get_learning_instructor_live_payout_batch_preflight(uuid,bigint) from public,anon,authenticated;
grant execute on function public.list_learning_instructor_live_payout_batch_candidates(uuid,integer),
  public.list_learning_instructor_live_payout_batches(uuid,integer),
  public.get_learning_instructor_live_payout_batch_preflight(uuid,bigint) to postgres,service_role;

commit;
