-- Safely recover a learner's own successful Paystack payment when webhook
-- processing is delayed or a fee-inclusive charged total differs from price.
-- The caller is service_role only; the server verifies the Paystack API result
-- and supplies the authenticated learner ID. No checkout or funds are created.

create or replace function public.reconcile_own_paystack_learning_payment(
  p_learner_id uuid,
  p_reference text,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_requested_amount_minor bigint,
  p_fees_minor bigint,
  p_currency text,
  p_domain text,
  p_payload jsonb
) returns table(outcome text, event_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare
  attempt_row record;
  existing_event record;
  event_key bigint;
  event_reference text;
  event_digest text;
  result_row record;
begin
  if p_learner_id is null or p_reference is null or p_reference !~ '^GL-[A-F0-9]{32}$'
    or p_provider_transaction_id is null or p_provider_transaction_id !~ '^\d+$'
    or p_domain is null or p_domain not in ('test','live') or p_currency is null or p_currency <> 'NGN'
    or p_amount_minor is null or p_requested_amount_minor is null
    or p_amount_minor <= 0 or p_requested_amount_minor <= 0
    or p_requested_amount_minor > p_amount_minor
    or (p_fees_minor is not null and p_fees_minor < 0)
    or (p_amount_minor > p_requested_amount_minor
      and (p_fees_minor is null or p_amount_minor - p_requested_amount_minor <> p_fees_minor))
    or p_payload is null or p_payload->>'status' <> 'success'
    or p_payload->>'reference' is distinct from p_reference
    or p_payload->>'transaction_id' is distinct from p_provider_transaction_id
    or p_payload->>'currency' is distinct from p_currency
    or p_payload->>'domain' is distinct from p_domain
    or coalesce(p_payload->>'amount','') !~ '^\d+$'
    or (p_payload->>'amount')::bigint <> p_requested_amount_minor
  then raise exception 'Paystack verification is invalid or inconclusive' using errcode='22023'; end if;

  event_reference := case when p_domain = 'live' then 'paystack:live:' else 'paystack:' end || p_reference;
  perform pg_advisory_xact_lock(hashtextextended(event_reference,0));

  select a.id attempt_id,a.order_id,a.amount_minor attempt_amount_minor,a.currency attempt_currency,
    coalesce(a.paystack_domain,'test') attempt_domain,o.learner_id,o.course_id,o.status order_status,
    o.gross_amount_minor
  into attempt_row
  from public.learning_payment_attempts a
  join public.learning_orders o on o.id=a.order_id
  where a.provider='paystack' and a.provider_reference=p_reference
    and o.learner_id=p_learner_id
  for update of a,o;
  if not found then return query select 'payment_not_found'::text,null::bigint; return; end if;

  if attempt_row.attempt_domain <> p_domain then return query select 'payment_domain_mismatch'::text,null::bigint; return; end if;
  if attempt_row.attempt_amount_minor <> p_requested_amount_minor
    or attempt_row.gross_amount_minor <> p_requested_amount_minor
    or attempt_row.attempt_currency <> p_currency
  then return query select 'amount_mismatch'::text,null::bigint; return; end if;
  if attempt_row.order_status in ('paid','partially_refunded','refunded','chargeback') then
    return query select 'already_paid'::text,null::bigint; return;
  end if;
  if attempt_row.order_status not in ('created','payment_pending') then
    return query select 'order_not_payable'::text,null::bigint; return;
  end if;

  event_reference := 'transaction.verify:learner:' || p_domain || ':' || p_provider_transaction_id;
  event_digest := encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
  select id,payload_digest,processing_status into existing_event
  from public.learning_payment_provider_events
  where provider='paystack' and provider_event_id=event_reference
  for update;
  if found then
    if existing_event.payload_digest <> event_digest then
      return query select 'duplicate_payload_mismatch'::text,existing_event.id; return;
    end if;
    if existing_event.processing_status='processed' then
      return query select 'already_processed'::text,existing_event.id; return;
    end if;
    event_key:=existing_event.id;
    update public.learning_payment_provider_events
    set payload=p_payload,processing_status='received',processed_at=null,processing_error=null,
      order_id=attempt_row.order_id,payment_attempt_id=attempt_row.attempt_id,
      signature_valid=false,verification_source='provider_api',recovery_status='none',next_retry_at=null
    where id=event_key;
  else
    insert into public.learning_payment_provider_events(
      provider,provider_event_id,event_type,payload_digest,payload,signature_valid,
      verification_source,processing_status,order_id,payment_attempt_id,recovery_status
    ) values (
      'paystack',event_reference,'charge.success',event_digest,p_payload,false,
      'provider_api','received',attempt_row.order_id,attempt_row.attempt_id,'none'
    ) returning id into event_key;
  end if;

  if p_domain='test' then
    select * into result_row from public.process_paystack_test_charge_event(event_key);
  else
    select * into result_row from public.process_paystack_live_charge_event(event_key);
  end if;
  return query select result_row.outcome,event_key;
end;
$function$;

revoke all on function public.reconcile_own_paystack_learning_payment(uuid,text,text,bigint,bigint,bigint,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.reconcile_own_paystack_learning_payment(uuid,text,text,bigint,bigint,bigint,text,text,jsonb) to postgres,service_role;

comment on function public.reconcile_own_paystack_learning_payment(uuid,text,text,bigint,bigint,bigint,text,text,jsonb)
is 'Reconciles a Paystack-verified successful learner payment only for its authenticated owner; stores the requested course price in the ledger and retains the fee-inclusive charge in provider evidence.';
