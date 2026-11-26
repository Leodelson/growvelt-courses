-- Live transfer receipt and reconciliation only. No transfer initiation path.
-- Live processing reuses the existing exactly-once finalizer after enforcing
-- event/item domain equality; Test receipts retain their existing behavior.
begin;

alter table public.learning_instructor_payout_provider_events
  drop constraint learning_instructor_payout_provider_event_provider_domain_check;
alter table public.learning_instructor_payout_provider_events
  add constraint learning_instructor_payout_provider_event_provider_domain_check
  check (provider_domain in ('test','live'));

do $guard$
declare definition text;
begin
  select pg_get_functiondef('public.process_learning_instructor_payout_provider_event(bigint)'::regprocedure) into definition;
  if position('item.provider_domain<>ev.provider_domain' in definition)>0 then return; end if;
  if position('item.provider_domain<>''test''' in definition)=0
    or position('Authoritative Paystack Test instructor payout settlement' in definition)=0
    or position('Paid through an authoritative Paystack Test transfer' in definition)=0 then
    raise exception 'Unexpected payout finalizer definition; review required';
  end if;
  definition:=replace(definition,'item.provider_domain<>''test''','item.provider_domain<>ev.provider_domain');
  definition:=replace(definition,'Signed Test transfer event does not match a payout item','Signed transfer event does not match a payout item');
  definition:=replace(definition,'Authoritative Paystack Test instructor payout settlement','Authoritative Paystack instructor payout settlement');
  definition:=replace(definition,'Paid through an authoritative Paystack Test transfer','Paid through an authoritative Paystack transfer');
  execute definition;
end $guard$;

create or replace function public.receive_paystack_live_transfer_provider_event(
  p_provenance text,p_provider_event_id text,p_payload_digest text,p_reference text,
  p_transfer_id text,p_transfer_code text,p_status text,p_amount_minor bigint,
  p_currency text,p_actor_user_id uuid default null
)
returns table(outcome text,provider_event_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare event_id bigint;
        existing_row public.learning_instructor_payout_provider_events%rowtype;
        item_id bigint;
        event_identity text;
begin
  if p_provenance not in ('provider_webhook','provider_api')
    or p_provider_event_id is null or length(p_provider_event_id) not between 3 and 180
    or p_payload_digest is null or p_payload_digest !~ '^[a-f0-9]{64}$'
    or p_reference is null or p_reference !~ '^lpi-live-reservation-[0-9]+$'
    or p_transfer_id is null or p_transfer_id !~ '^[0-9]+$'
    or (p_transfer_code is not null and p_transfer_code !~ '^TRF_[A-Za-z0-9]+$')
    or p_status not in ('succeeded','failed','reversed','pending')
    or p_amount_minor is null or p_amount_minor<=0 or p_currency<>'NGN' then
    raise exception 'Invalid Paystack Live transfer provider event' using errcode='22023';
  end if;
  if p_provenance='provider_api' and (p_actor_user_id is null or not exists(
    select 1 from public.account_capabilities capability where capability.user_id=p_actor_user_id
      and capability.capability='admin' and capability.status='active')) then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  event_identity:='live:'||p_provider_event_id;
  insert into public.learning_instructor_payout_provider_events(
    provider_domain,provenance,provider_event_id,payload_digest,payout_item_reference,
    provider_transfer_id,provider_transfer_code,provider_status,amount_minor,currency
  ) values ('live',p_provenance,event_identity,p_payload_digest,p_reference,
    p_transfer_id,p_transfer_code,p_status,p_amount_minor,p_currency)
  on conflict on constraint learning_instructor_payout_provider_event_provider_event_id_key
    do nothing returning id into event_id;
  if event_id is null then
    select * into existing_row from public.learning_instructor_payout_provider_events event
      where event.provider_event_id=event_identity for update;
    if existing_row.provider_domain<>'live' or existing_row.payload_digest<>p_payload_digest
      or existing_row.payout_item_reference<>p_reference or existing_row.provider_transfer_id<>p_transfer_id
      or existing_row.provider_transfer_code is distinct from p_transfer_code
      or existing_row.provider_status<>p_status or existing_row.amount_minor<>p_amount_minor
      or existing_row.currency<>p_currency or existing_row.provenance<>p_provenance then
      select item.id into item_id from public.learning_instructor_payout_items item
        where item.payout_item_reference=existing_row.payout_item_reference;
      perform public.open_learning_instructor_payout_finding(
        'payout-live-event-duplicate-conflict:'||existing_row.id,item_id,existing_row.id,
        'provider_outcome_conflict','A duplicate Live transfer event ID contained conflicting normalized data');
      return query select 'duplicate_conflict',existing_row.id;
      return;
    end if;
    return query select 'already_received',existing_row.id;
    return;
  end if;
  return query select 'received',event_id;
end;$function$;

revoke all on function public.receive_paystack_live_transfer_provider_event(
  text,text,text,text,text,text,text,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.receive_paystack_live_transfer_provider_event(
  text,text,text,text,text,text,text,bigint,text,uuid) to postgres,service_role;
commit;
