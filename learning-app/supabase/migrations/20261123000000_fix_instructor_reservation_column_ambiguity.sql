-- Preserve the existing single-earning reservation behavior while qualifying
-- its earning-id lookup. The unqualified name also exists as an output
-- variable, and PostgreSQL's default PL/pgSQL conflict policy rejects it.
begin;

create or replace function public.reserve_learning_instructor_earning(
  p_earning_id bigint,
  p_instructor_id uuid,
  p_idempotency_key text,
  p_actor_user_id uuid
)
returns table(
  reservation_id bigint,
  reservation_reference text,
  earning_id bigint,
  instructor_id uuid,
  amount_minor bigint,
  currency text,
  status text,
  reserved_at timestamptz
)
language plpgsql security definer set search_path to '' as $function$
declare
  existing_row public.learning_instructor_earning_reservations%rowtype;
  earning_row public.learning_instructor_earnings%rowtype;
  allocation_row public.learning_commercial_allocations%rowtype;
  order_row public.learning_orders%rowtype;
  reservation_key bigint;
begin
  if p_earning_id is null or p_instructor_id is null or p_actor_user_id is null
    or p_idempotency_key is null or p_idempotency_key !~ '^[a-z][a-z0-9:_-]{2,120}$' then
    raise exception 'Valid reservation identity is required' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.account_capabilities capability
    where capability.user_id=p_actor_user_id and capability.capability='admin' and capability.status='active'
  ) then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  perform public.assert_learning_approved_instructor(p_instructor_id);

  select * into existing_row
  from public.learning_instructor_earning_reservations
  where idempotency_key=p_idempotency_key
  for update;
  if found then
    if existing_row.earning_id<>p_earning_id or existing_row.instructor_id<>p_instructor_id then
      raise exception 'Reservation idempotency conflict' using errcode='23505';
    end if;
    return query select existing_row.id,existing_row.reservation_reference,existing_row.earning_id,
      existing_row.instructor_id,existing_row.amount_minor,existing_row.currency,existing_row.status,existing_row.reserved_at;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('learning-earning-reservation:'||p_earning_id::text,0));
  select * into existing_row
  from public.learning_instructor_earning_reservations
  where idempotency_key=p_idempotency_key
  for update;
  if found then
    if existing_row.earning_id<>p_earning_id or existing_row.instructor_id<>p_instructor_id then
      raise exception 'Reservation idempotency conflict' using errcode='23505';
    end if;
    return query select existing_row.id,existing_row.reservation_reference,existing_row.earning_id,
      existing_row.instructor_id,existing_row.amount_minor,existing_row.currency,existing_row.status,existing_row.reserved_at;
    return;
  end if;

  select * into earning_row from public.learning_instructor_earnings where id=p_earning_id for update;
  if not found then raise exception 'Instructor earning not found' using errcode='P0002'; end if;
  if earning_row.instructor_id<>p_instructor_id then
    raise exception 'Instructor earning ownership mismatch' using errcode='42501';
  end if;
  if earning_row.status<>'available' then
    raise exception 'Only available instructor earnings may be reserved' using errcode='22023';
  end if;

  select * into allocation_row from public.learning_commercial_allocations where id=earning_row.allocation_id for update;
  if not found or allocation_row.instructor_id<>p_instructor_id or allocation_row.status<>'allocated'
    or allocation_row.instructor_gross_minor<>earning_row.gross_amount_minor or allocation_row.currency<>earning_row.currency then
    raise exception 'Commercial allocation does not match instructor earning' using errcode='22023';
  end if;
  select * into order_row from public.learning_orders where id=allocation_row.order_id for update;
  if not found or order_row.status<>'paid' then
    raise exception 'A paid order is required for earnings reservation' using errcode='22023';
  end if;

  lock table public.learning_payment_cases in share row exclusive mode;
  if exists(
    select 1 from public.learning_payment_cases payment_case
    where payment_case.order_id=order_row.id
      and payment_case.status in ('requested','submitting','pending','processing','needs_attention','opened','action_required','submitted','under_review')
  ) then
    raise exception 'Active financial protection prevents earnings reservation' using errcode='22023';
  end if;

  if exists(select 1 from public.learning_instructor_earning_reservations reservation
    where reservation.earning_id=earning_row.id) then
    raise exception 'Instructor earning is already reserved' using errcode='23505';
  end if;

  insert into public.learning_instructor_earning_reservations(
    reservation_reference,idempotency_key,earning_id,allocation_id,instructor_id,amount_minor,currency,status,source,actor_user_id
  ) values (
    'LER-'||earning_row.id::text,p_idempotency_key,earning_row.id,allocation_row.id,p_instructor_id,
    earning_row.gross_amount_minor,earning_row.currency,'reserved','admin_internal',p_actor_user_id
  ) returning id into reservation_key;

  update public.learning_instructor_earnings as earning
  set status='reserved',reserved_at=now(),hold_reason='Reserved for a future controlled payout'
  where earning.id=earning_row.id and earning.status='available';
  if not found then raise exception 'Instructor earning is no longer available' using errcode='40001'; end if;

  insert into public.learning_instructor_earning_events(earning_id,event_type,from_status,to_status,actor_user_id,metadata)
  values(earning_row.id,'earning.reserved','available','reserved',p_actor_user_id,
    jsonb_build_object('reservation_id',reservation_key,'reservation_reference','LER-'||earning_row.id::text,'source','admin_internal'));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_actor_user_id,'admin_operator','instructor_earning.reserved','learning_instructor_earning',earning_row.id::text,
    jsonb_build_object('reservation_id',reservation_key,'reservation_reference','LER-'||earning_row.id::text,'allocation_id',allocation_row.id));

  return query select reservation.id,reservation.reservation_reference,reservation.earning_id,reservation.instructor_id,
    reservation.amount_minor,reservation.currency,reservation.status,reservation.reserved_at
  from public.learning_instructor_earning_reservations reservation where reservation.id=reservation_key;
end;$function$;

revoke all on function public.reserve_learning_instructor_earning(bigint,uuid,text,uuid)
  from public,anon,authenticated;
grant execute on function public.reserve_learning_instructor_earning(bigint,uuid,text,uuid)
  to postgres,service_role;

commit;
