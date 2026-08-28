create or replace function public.receive_paystack_test_dispute_event (
  p_provider_event_id     text,
  p_payload_digest        text,
  p_event_type            text,
  p_transaction_reference text,
  p_provider_case_id      text,
  p_provider_status       text,
  p_resolution            text,
  p_amount_minor          bigint,
  p_currency              text,
  p_domain                text,
  p_category              text,
  p_reason                text,
  p_deadline              timestamp with time zone,
  p_payload               jsonb
)
  returns table (
    outcome  text,
    event_id bigint,
    case_id  bigint
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare order_row record; case_row public.learning_payment_cases%rowtype; event_row public.learning_payment_provider_events%rowtype; normalized_status text;
begin
  if p_event_type not in ('charge.dispute.create','charge.dispute.remind','charge.dispute.resolve') or p_domain<>'test'
    or p_currency<>'NGN' or p_amount_minor<=0 or p_provider_case_id!~'^\d+$'
  then raise exception 'Invalid Paystack dispute event' using errcode='22023'; end if;
  select o.*,a.id attempt_id into order_row from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id
  where o.order_reference=p_transaction_reference and a.provider='paystack' and a.status='succeeded';
  if not found or order_row.status not in ('paid','partially_refunded') or order_row.currency<>p_currency
    or p_amount_minor>order_row.gross_amount_minor
  then raise exception 'Dispute does not match an eligible paid order' using errcode='22023'; end if;
  select * into case_row from public.learning_payment_cases where provider='paystack' and provider_case_id=p_provider_case_id;
  if found and (case_row.order_id<>order_row.id or case_row.amount_minor<>p_amount_minor or case_row.currency<>p_currency)
  then raise exception 'Dispute identity mismatch' using errcode='22023'; end if;
  if not found then
    normalized_status:=case when p_provider_status='awaiting-merchant-feedback' then 'action_required' else 'under_review' end;
    insert into public.learning_payment_cases(order_id,payment_attempt_id,case_type,status,amount_minor,currency,provider,provider_status,
      provider_case_id,provider_transaction_id,dispute_category,dispute_reason,response_deadline_at,provider_resolution,opened_at,action_required_at)
    values(order_row.id,order_row.attempt_id,'chargeback',normalized_status,p_amount_minor,p_currency,'paystack',p_provider_status,
      p_provider_case_id,(select provider_transaction_id from public.learning_payment_attempts where id=order_row.attempt_id),left(p_category,120),left(p_reason,1000),p_deadline,left(p_resolution,120),now(),case when normalized_status='action_required' then now() end)
    returning * into case_row;
    insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,metadata)
    values(case_row.id,'dispute.opened',normalized_status,'webhook',jsonb_build_object('provider_status',p_provider_status,'deadline',p_deadline));
  end if;
  select * into event_row from public.learning_payment_provider_events where provider='paystack' and provider_event_id=p_provider_event_id;
  if found then
    if event_row.payload_digest<>p_payload_digest then return query select 'duplicate_payload_mismatch',event_row.id,case_row.id; else return query select 'duplicate',event_row.id,case_row.id; end if;
    return;
  end if;
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,processing_status,
    order_id,payment_attempt_id,payment_case_id,verification_source,recovery_status)
  values('paystack',p_provider_event_id,p_event_type,p_payload_digest,p_payload,true,'received',order_row.id,order_row.attempt_id,case_row.id,'webhook','none')
  returning id into event_id;
  return query select 'received',event_id,case_row.id;
end;$function$;

grant execute
  on function "public"."receive_paystack_test_dispute_event"(text, text, text, text, text, text, text, bigint, text, text, text, text, timestamp with time zone, jsonb)
  to "postgres", "service_role";

revoke all
  on function "public"."receive_paystack_test_dispute_event"(text, text, text, text, text, text, text, bigint, text, text, text, text, timestamp with time zone, jsonb)
  from public;
