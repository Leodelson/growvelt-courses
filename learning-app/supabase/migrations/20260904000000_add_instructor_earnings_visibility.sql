-- Phase 1C2A: read-only instructor earnings visibility and admin commercial review.
-- No financial state, payout, recipient, transfer, withholding, or historical order is changed.

begin;

create or replace function public.get_own_learning_instructor_earnings()
returns table(
  earning_id bigint,
  allocation_id bigint,
  order_id bigint,
  order_reference text,
  course_id bigint,
  course_title text,
  order_paid_at timestamptz,
  gross_amount_minor bigint,
  platform_commission_minor bigint,
  instructor_gross_minor bigint,
  currency text,
  earning_status text,
  available_at timestamptz,
  released_at timestamptz,
  reversed_at timestamptz,
  recoverable_amount_minor bigint,
  hold_reason text,
  commercial_terms_version text,
  allocated_at timestamptz
)
language plpgsql stable security definer set search_path to '' as $function$
declare actor_id uuid:=auth.uid();
begin
  if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not exists(
    select 1 from public.account_capabilities capability
    join public.instructor_profiles instructor_profile on instructor_profile.user_id=capability.user_id
    where capability.user_id=actor_id and capability.capability='instructor' and capability.status='active'
      and instructor_profile.approval_status='approved'
  ) then raise exception 'Approved instructor required' using errcode='42501'; end if;

  return query
  select earning.id,allocation.id,learning_order.id,learning_order.order_reference,allocation.course_id,
    coalesce(course.title,learning_order.course_title_snapshot),learning_order.paid_at,
    allocation.gross_amount_minor,allocation.platform_commission_minor,allocation.instructor_gross_minor,
    earning.currency,earning.status,earning.available_at,earning.released_at,earning.reversed_at,
    earning.recoverable_amount_minor,earning.hold_reason,allocation.commercial_terms_version,allocation.allocated_at
  from public.learning_instructor_earnings earning
  join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
  join public.learning_orders learning_order on learning_order.id=allocation.order_id
  left join public.learning_courses course on course.id=allocation.course_id
  where earning.instructor_id=actor_id
  order by allocation.allocated_at desc,earning.id desc;
end;$function$;

create or replace function public.list_own_learning_instructor_earning_events()
returns table(
  event_id bigint,
  earning_id bigint,
  event_type text,
  from_status text,
  to_status text,
  occurred_at timestamptz
)
language plpgsql stable security definer set search_path to '' as $function$
declare actor_id uuid:=auth.uid();
begin
  if actor_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not exists(
    select 1 from public.account_capabilities capability
    join public.instructor_profiles instructor_profile on instructor_profile.user_id=capability.user_id
    where capability.user_id=actor_id and capability.capability='instructor' and capability.status='active'
      and instructor_profile.approval_status='approved'
  ) then raise exception 'Approved instructor required' using errcode='42501'; end if;

  return query
  select event.id,event.earning_id,event.event_type,event.from_status,event.to_status,event.occurred_at
  from public.learning_instructor_earning_events event
  join public.learning_instructor_earnings earning on earning.id=event.earning_id
  where earning.instructor_id=actor_id
  order by event.occurred_at desc,event.id desc;
end;$function$;

create or replace function public.list_learning_commercial_operations(p_operator_id uuid,p_limit integer default 100)
returns table(
  earning_id bigint,
  instructor_id uuid,
  instructor_name text,
  instructor_email text,
  order_id bigint,
  order_reference text,
  course_id bigint,
  course_title text,
  gross_amount_minor bigint,
  platform_commission_minor bigint,
  instructor_gross_minor bigint,
  currency text,
  earning_status text,
  available_at timestamptz,
  released_at timestamptz,
  reversed_at timestamptz,
  recoverable_amount_minor bigint,
  commercial_terms_version text,
  allocation_status text,
  reversal_case_id bigint,
  reconciliation_issue_count bigint,
  reconciliation_details text[]
)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or not exists(
    select 1 from public.account_capabilities capability
    where capability.user_id=p_operator_id and capability.capability='admin' and capability.status='active'
  ) then raise exception 'Active administrator required' using errcode='42501'; end if;

  return query
  select earning.id,earning.instructor_id,profile.full_name,profile.email,learning_order.id,learning_order.order_reference,
    allocation.course_id,coalesce(course.title,learning_order.course_title_snapshot),allocation.gross_amount_minor,
    allocation.platform_commission_minor,allocation.instructor_gross_minor,earning.currency,earning.status,
    earning.available_at,earning.released_at,earning.reversed_at,earning.recoverable_amount_minor,
    allocation.commercial_terms_version,allocation.status,allocation.reversed_by_case_id,
    coalesce(reconciliation.issue_count,0),coalesce(reconciliation.details,array[]::text[])
  from public.learning_instructor_earnings earning
  join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
  join public.learning_orders learning_order on learning_order.id=allocation.order_id
  join public.profiles profile on profile.id=earning.instructor_id
  left join public.learning_courses course on course.id=allocation.course_id
  left join lateral (
    select count(*)::bigint as issue_count,
      coalesce(array_agg(result.issue_type||': '||result.detail order by result.issue_type),array[]::text[]) as details
    from public.reconcile_learning_commercial_allocations() result
    where result.order_reference=learning_order.order_reference
  ) reconciliation on true
  order by allocation.allocated_at desc,earning.id desc
  limit least(greatest(coalesce(p_limit,100),1),200);
end;$function$;

revoke all on function public.get_own_learning_instructor_earnings(),public.list_own_learning_instructor_earning_events(),public.list_learning_commercial_operations(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_own_learning_instructor_earnings(),public.list_own_learning_instructor_earning_events() to authenticated,postgres,service_role;
grant execute on function public.list_learning_commercial_operations(uuid,integer) to postgres,service_role;

commit;
