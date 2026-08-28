create or replace function public.receive_paystack_test_charge_event (
  p_provider_event_id       text,
  p_payload_digest          text,
  p_reference               text,
  p_provider_transaction_id text,
  p_amount_minor            bigint,
  p_currency                text,
  p_domain                  text,
  p_payload                 jsonb
)
  returns table (
    outcome  text,
    event_id bigint
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare existing_event public.learning_payment_provider_events%rowtype; attempt_row record; event_key bigint;
begin
  if p_domain <> 'test' or p_currency <> 'NGN' or p_amount_minor <= 0
    or p_payload_digest !~ '^[a-f0-9]{64}$' or p_provider_event_id is null
    or p_provider_transaction_id is null or p_payload is null
  then raise exception 'Invalid Paystack test event' using errcode='22023'; end if;

  select * into existing_event from public.learning_payment_provider_events
  where provider='paystack' and provider_event_id=p_provider_event_id for update;
  if found then
    if existing_event.payload_digest <> p_payload_digest then
      return query select 'duplicate_payload_mismatch'::text, existing_event.id; return;
    end if;
    return query select case when existing_event.processing_status='processed' then 'already_processed' else 'already_received' end, existing_event.id;
    return;
  end if;

  select a.id payment_attempt_id, a.order_id into attempt_row
  from public.learning_payment_attempts a
  where a.provider='paystack' and a.provider_reference=p_reference;

  insert into public.learning_payment_provider_events(
    provider,provider_event_id,event_type,payload_digest,payload,signature_valid,
    processing_status,order_id,payment_attempt_id,recovery_status
  ) values (
    'paystack',p_provider_event_id,'charge.success',p_payload_digest,p_payload,true,
    'received',attempt_row.order_id,attempt_row.payment_attempt_id,'none'
  ) returning id into event_key;
  return query select 'received'::text,event_key;
end;$function$;

grant execute on function "public"."receive_paystack_test_charge_event"(text, text, text, text, bigint, text, text, jsonb) to "postgres", "service_role";

revoke all on function "public"."receive_paystack_test_charge_event"(text, text, text, text, bigint, text, text, jsonb) from public;
