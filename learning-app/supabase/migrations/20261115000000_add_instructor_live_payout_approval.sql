-- Admin approval only: a Live payout item may be recorded, but this migration
-- neither initiates a transfer nor accepts a Live transfer outcome.
begin;

alter table public.learning_instructor_payout_items
  drop constraint learning_instructor_payout_items_provider_domain_check;
alter table public.learning_instructor_payout_items
  add constraint learning_instructor_payout_items_provider_domain_check
  check (provider_domain in ('test','live'));

-- The existing Sandbox writer predates Live payout items. Its first transition
-- must explicitly reject a Live item before a Test transfer can be attempted.
do $guard$
declare definition text;
begin
  select pg_get_functiondef('public.begin_learning_instructor_test_transfer(bigint,uuid)'::regprocedure) into definition;
  if position('if item.provider_domain<>''test'' or item.status<>''approved'' then' in definition)>0 then return; end if;
  if position('if item.status<>''approved'' then' in definition)=0 then
    raise exception 'Unexpected Sandbox transfer writer definition; review required';
  end if;
  definition:=replace(definition,
    'if item.status<>''approved'' then',
    'if item.provider_domain<>''test'' or item.status<>''approved'' then');
  execute definition;
end $guard$;

create or replace function public.approve_learning_instructor_live_payout_item(
  p_reservation_id bigint, p_idempotency_key text, p_actor_user_id uuid
)
returns table(payout_item_id bigint,payout_item_reference text,status text,amount_minor bigint,currency text)
language plpgsql security definer set search_path to '' as $function$
declare reservation_row public.learning_instructor_earning_reservations%rowtype;
        earning_row public.learning_instructor_earnings%rowtype;
        allocation_row public.learning_commercial_allocations%rowtype;
        order_row public.learning_orders%rowtype;
        profile_row public.learning_instructor_payout_profiles%rowtype;
        existing_row public.learning_instructor_payout_items%rowtype;
        item_id bigint;
        succeeded_count bigint;
        live_matching_count bigint;
        item_reference text;
begin
  if p_reservation_id is null or p_actor_user_id is null or p_idempotency_key is null
    or p_idempotency_key !~ '^payout-live-approval:[0-9]+$'
    or p_idempotency_key <> 'payout-live-approval:'||p_reservation_id::text then
    raise exception 'Valid Live payout approval identity is required' using errcode='22023';
  end if;
  if not exists(select 1 from public.account_capabilities capability
    where capability.user_id=p_actor_user_id and capability.capability='admin' and capability.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('learning-payout-item:'||p_reservation_id::text,0));
  select * into existing_row from public.learning_instructor_payout_items item
    where item.idempotency_key=p_idempotency_key for update;
  if found then
    if existing_row.reservation_id<>p_reservation_id or existing_row.provider_domain<>'live' then
      raise exception 'Live payout approval idempotency conflict' using errcode='23505';
    end if;
    return query select existing_row.id,existing_row.payout_item_reference,existing_row.status,
      existing_row.amount_minor,existing_row.currency;
    return;
  end if;
  select * into reservation_row from public.learning_instructor_earning_reservations reservation
    where reservation.id=p_reservation_id for update;
  if not found or reservation_row.status<>'reserved' or reservation_row.future_payout_item_reference is not null then
    raise exception 'Unlinked reserved earning is required' using errcode='22023';
  end if;
  if exists(select 1 from public.learning_instructor_payout_items item
    where item.reservation_id=reservation_row.id) then
    raise exception 'Reservation already belongs to a payout item' using errcode='23505';
  end if;
  select * into earning_row from public.learning_instructor_earnings earning
    where earning.id=reservation_row.earning_id for update;
  select * into allocation_row from public.learning_commercial_allocations allocation
    where allocation.id=reservation_row.allocation_id for update;
  select * into order_row from public.learning_orders learning_order
    where learning_order.id=allocation_row.order_id for update;
  if earning_row.id is null or allocation_row.id is null or order_row.id is null
    or earning_row.status<>'reserved' or earning_row.allocation_id<>allocation_row.id
    or earning_row.instructor_id<>reservation_row.instructor_id
    or allocation_row.instructor_id<>reservation_row.instructor_id
    or earning_row.gross_amount_minor<>reservation_row.amount_minor
    or allocation_row.instructor_gross_minor<>reservation_row.amount_minor
    or earning_row.currency<>reservation_row.currency or allocation_row.currency<>reservation_row.currency
    or allocation_row.status<>'allocated' or order_row.status<>'paid'
    or order_row.gross_amount_minor<>allocation_row.gross_amount_minor
    or order_row.currency<>reservation_row.currency then
    raise exception 'Reservation financial identity is no longer eligible' using errcode='22023';
  end if;
  perform public.assert_learning_approved_instructor(reservation_row.instructor_id);
  select count(*),count(*) filter (where attempt.provider='paystack' and attempt.paystack_domain='live'
    and attempt.amount_minor=order_row.gross_amount_minor and attempt.currency=order_row.currency)
    into succeeded_count,live_matching_count
    from public.learning_payment_attempts attempt
    where attempt.order_id=order_row.id and attempt.status='succeeded';
  if succeeded_count<>1 or live_matching_count<>1 then
    raise exception 'Exactly one matching successful Live payment is required' using errcode='22023';
  end if;
  select * into profile_row from public.learning_instructor_payout_profiles profile
    where profile.instructor_id=reservation_row.instructor_id and profile.provider='paystack'
      and profile.provider_domain='live' and profile.status='active' for update;
  if not found or profile_row.currency<>reservation_row.currency then
    raise exception 'Active Live payout destination is required' using errcode='22023';
  end if;
  lock table public.learning_payment_cases in share row exclusive mode;
  if exists(select 1 from public.learning_payment_cases payment_case
    where payment_case.order_id=order_row.id and payment_case.status in
      ('requested','submitting','pending','processing','needs_attention','opened','action_required','submitted','under_review')) then
    raise exception 'Active financial protection prevents payout approval' using errcode='22023';
  end if;
  item_reference:='lpi-live-reservation-'||reservation_row.id::text;
  insert into public.learning_instructor_payout_items(
    payout_item_reference,idempotency_key,reservation_id,earning_id,allocation_id,instructor_id,
    payout_profile_id,provider_domain,recipient_code,provider_recipient_id,amount_minor,currency,approved_by
  ) values (
    item_reference,p_idempotency_key,reservation_row.id,reservation_row.earning_id,reservation_row.allocation_id,
    reservation_row.instructor_id,profile_row.id,'live',profile_row.recipient_code,
    profile_row.provider_recipient_id,reservation_row.amount_minor,reservation_row.currency,p_actor_user_id
  ) returning id into item_id;
  update public.learning_instructor_earning_reservations
    set future_payout_item_reference=item_reference
    where id=reservation_row.id and future_payout_item_reference is null;
  if not found then raise exception 'Reservation is already linked to a payout item' using errcode='23505'; end if;
  insert into public.learning_instructor_payout_item_events(payout_item_id,event_type,to_status,provenance,actor_user_id,metadata)
    values(item_id,'payout_item.approved','approved','admin',p_actor_user_id,
      jsonb_build_object('reservation_reference',reservation_row.reservation_reference,'provider_domain','live'));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    values(p_actor_user_id,'admin_operator','instructor_payout_item.approved','learning_instructor_payout_item',item_id::text,
      jsonb_build_object('reservation_id',reservation_row.id,'provider_domain','live'));
  return query select item_id,item_reference,'approved',reservation_row.amount_minor,reservation_row.currency;
end;$function$;

revoke all on function public.approve_learning_instructor_live_payout_item(bigint,text,uuid)
  from public,anon,authenticated;
grant execute on function public.approve_learning_instructor_live_payout_item(bigint,text,uuid)
  to postgres,service_role;
commit;
