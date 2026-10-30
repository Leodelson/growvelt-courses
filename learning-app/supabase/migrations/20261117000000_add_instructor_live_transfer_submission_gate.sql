-- Live transfer submission gate. A provider response is not a payout settlement.
-- The corresponding application feature flag remains disabled by default.
begin;

create or replace function public.begin_learning_instructor_live_transfer(p_payout_item_id bigint,p_actor_user_id uuid)
returns table(payout_item_id bigint,payout_item_reference text,recipient_code text,amount_minor bigint,currency text)
language plpgsql security definer set search_path to '' as $function$
declare item public.learning_instructor_payout_items%rowtype;
        profile public.learning_instructor_payout_profiles%rowtype;
        earning public.learning_instructor_earnings%rowtype;
        allocation public.learning_commercial_allocations%rowtype;
        learning_order public.learning_orders%rowtype;
        succeeded_count bigint; live_count bigint;
begin
  if p_payout_item_id is null or p_actor_user_id is null or not exists(
    select 1 from public.account_capabilities capability where capability.user_id=p_actor_user_id
      and capability.capability='admin' and capability.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  select * into item from public.learning_instructor_payout_items payout_item where payout_item.id=p_payout_item_id for update;
  if not found or item.provider_domain<>'live' or item.status<>'approved' or item.provider_transfer_id is not null
    or item.payout_item_reference<>('lpi-live-reservation-'||item.reservation_id::text) then
    raise exception 'Approved Live payout item required' using errcode='22023';
  end if;
  select * into profile from public.learning_instructor_payout_profiles payout_profile where payout_profile.id=item.payout_profile_id for update;
  if not found or profile.status<>'active' or profile.provider_domain<>'live' or profile.provider<>'paystack'
    or profile.instructor_id<>item.instructor_id or profile.recipient_code<>item.recipient_code
    or profile.provider_recipient_id<>item.provider_recipient_id or profile.currency<>item.currency then
    raise exception 'Live payout destination changed' using errcode='22023';
  end if;
  select * into earning from public.learning_instructor_earnings e where e.id=item.earning_id for update;
  select * into allocation from public.learning_commercial_allocations a where a.id=item.allocation_id for update;
  select * into learning_order from public.learning_orders o where o.id=allocation.order_id for update;
  if earning.id is null or allocation.id is null or learning_order.id is null
    or earning.status<>'reserved' or earning.instructor_id<>item.instructor_id
    or earning.gross_amount_minor<>item.amount_minor or earning.currency<>item.currency
    or allocation.status<>'allocated' or allocation.instructor_id<>item.instructor_id
    or allocation.instructor_gross_minor<>item.amount_minor or allocation.currency<>item.currency
    or learning_order.status<>'paid' or learning_order.currency<>item.currency then
    raise exception 'Live payout is no longer financially eligible' using errcode='22023';
  end if;
  select count(*),count(*) filter (where attempt.provider='paystack' and attempt.paystack_domain='live'
    and attempt.amount_minor=learning_order.gross_amount_minor and attempt.currency=learning_order.currency)
    into succeeded_count,live_count from public.learning_payment_attempts attempt
    where attempt.order_id=learning_order.id and attempt.status='succeeded';
  if succeeded_count<>1 or live_count<>1 then
    raise exception 'Exactly one matching successful Live payment is required' using errcode='22023';
  end if;
  lock table public.learning_payment_cases in share row exclusive mode;
  if exists(select 1 from public.learning_payment_cases payment_case where payment_case.order_id=learning_order.id
    and payment_case.status in ('requested','submitting','pending','processing','needs_attention','opened','action_required','submitted','under_review')) then
    raise exception 'Active financial protection prevents Live transfer' using errcode='22023';
  end if;
  update public.learning_instructor_payout_items set status='submitting',initiated_by=p_actor_user_id,initiated_at=now()
    where id=item.id;
  insert into public.learning_instructor_payout_item_events(payout_item_id,event_type,from_status,to_status,provenance,actor_user_id)
    values(item.id,'payout_item.submitting','approved','submitting','admin',p_actor_user_id);
  return query select item.id,item.payout_item_reference,item.recipient_code,item.amount_minor,item.currency;
end;$function$;

create or replace function public.record_learning_instructor_live_transfer_submission(
  p_payout_item_id bigint,p_transfer_id text,p_transfer_code text,p_provider_status text,p_actor_user_id uuid)
returns void language plpgsql security definer set search_path to '' as $function$
declare item public.learning_instructor_payout_items%rowtype;
begin
  if p_actor_user_id is null or not exists(select 1 from public.account_capabilities capability
    where capability.user_id=p_actor_user_id and capability.capability='admin' and capability.status='active')
    or p_transfer_id is null or p_transfer_id !~ '^[0-9]+$'
    or p_transfer_code is null or p_transfer_code !~ '^TRF_[A-Za-z0-9]+$'
    or p_provider_status not in ('otp','pending') then
    raise exception 'Valid administrator and Live transfer identity required' using errcode='42501';
  end if;
  select * into item from public.learning_instructor_payout_items payout_item where payout_item.id=p_payout_item_id for update;
  if not found or item.provider_domain<>'live' or item.status<>'submitting' or item.provider_transfer_id is not null then
    raise exception 'Submitting Live payout item required' using errcode='22023';
  end if;
  update public.learning_instructor_payout_items set status='pending',provider_transfer_id=p_transfer_id,
    provider_transfer_code=p_transfer_code,provider_status=p_provider_status,provider_received_at=now() where id=item.id;
  insert into public.learning_instructor_payout_item_events(payout_item_id,event_type,from_status,to_status,provenance,actor_user_id,metadata)
    values(item.id,'payout_item.pending','submitting','pending','provider_api',p_actor_user_id,
      jsonb_build_object('provider_transfer_id',p_transfer_id,'provider_status',p_provider_status));
end;$function$;

create or replace function public.mark_learning_instructor_live_transfer_recovery_required(p_payout_item_id bigint,p_actor_user_id uuid)
returns void language plpgsql security definer set search_path to '' as $function$
declare item public.learning_instructor_payout_items%rowtype;
begin
  if p_actor_user_id is null or not exists(select 1 from public.account_capabilities capability
    where capability.user_id=p_actor_user_id and capability.capability='admin' and capability.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  select * into item from public.learning_instructor_payout_items payout_item where payout_item.id=p_payout_item_id for update;
  if not found or item.provider_domain<>'live' or item.status<>'submitting' or item.provider_transfer_id is not null then
    raise exception 'Unconfirmed Live transfer required' using errcode='22023';
  end if;
  update public.learning_instructor_payout_items set status='recovery_required',failure_code='provider_submission_unknown' where id=item.id;
  insert into public.learning_instructor_payout_item_events(payout_item_id,event_type,from_status,to_status,provenance,actor_user_id)
    values(item.id,'payout_item.recovery_required','submitting','recovery_required','system',p_actor_user_id);
end;$function$;

create or replace function public.get_learning_instructor_live_transfer_for_recovery(p_payout_item_id bigint,p_actor_user_id uuid)
returns table(payout_item_id bigint,payout_item_reference text,amount_minor bigint,currency text,status text,
  provider_transfer_id text,provider_transfer_code text,provider_status text)
language plpgsql stable security definer set search_path to '' as $function$
declare item public.learning_instructor_payout_items%rowtype;
begin
  if p_actor_user_id is null or not exists(select 1 from public.account_capabilities capability
    where capability.user_id=p_actor_user_id and capability.capability='admin' and capability.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  select * into item from public.learning_instructor_payout_items payout_item where payout_item.id=p_payout_item_id;
  if not found or item.provider_domain<>'live' or item.status not in ('submitting','pending','recovery_required','financially_blocked') then
    raise exception 'Live transfer recovery is not available' using errcode='22023';
  end if;
  return query select item.id,item.payout_item_reference,item.amount_minor,item.currency,item.status,
    item.provider_transfer_id,item.provider_transfer_code,item.provider_status;
end;$function$;

revoke all on function public.begin_learning_instructor_live_transfer(bigint,uuid),
  public.record_learning_instructor_live_transfer_submission(bigint,text,text,text,uuid),
  public.mark_learning_instructor_live_transfer_recovery_required(bigint,uuid),
  public.get_learning_instructor_live_transfer_for_recovery(bigint,uuid) from public,anon,authenticated;
grant execute on function public.begin_learning_instructor_live_transfer(bigint,uuid),
  public.record_learning_instructor_live_transfer_submission(bigint,text,text,text,uuid),
  public.mark_learning_instructor_live_transfer_recovery_required(bigint,uuid),
  public.get_learning_instructor_live_transfer_for_recovery(bigint,uuid) to postgres,service_role;
commit;
