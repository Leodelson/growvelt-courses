create or replace function public.receive_paystack_test_verified_dispute (
  p_case_id         bigint,
  p_provider_status text,
  p_resolution      text,
  p_amount_minor    bigint,
  p_currency        text,
  p_domain          text,
  p_category        text,
  p_reason          text,
  p_deadline        timestamp with time zone,
  p_payload         jsonb,
  p_operator_id     uuid
)
  returns bigint
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare case_row record; event_key bigint; event_name text;
begin
  if not public.is_learning_admin(p_operator_id) then raise exception 'Administrator access required' using errcode='42501'; end if;
  select c.*,o.order_reference into case_row from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
  where c.id=p_case_id and c.case_type='chargeback';
  if not found or p_domain<>'test' or p_currency<>case_row.currency or p_amount_minor<>case_row.amount_minor
  then raise exception 'Verified dispute does not match its case' using errcode='22023'; end if;
  event_name:=case when p_provider_status='resolved' then 'charge.dispute.resolve' when p_provider_status='awaiting-merchant-feedback' then 'charge.dispute.remind' else 'charge.dispute.create' end;
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,verification_source,processing_status,order_id,payment_attempt_id,payment_case_id,recovery_status)
  values('paystack','provider_api:dispute:'||case_row.provider_case_id||':'||coalesce(p_provider_status,'unknown')||':'||coalesce(p_resolution,'none'),event_name,
    encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex'),p_payload,false,'provider_api','received',case_row.order_id,case_row.payment_attempt_id,case_row.id,'retryable')
  on conflict(provider,provider_event_id) do update set last_attempted_at=now()
  returning id into event_key;
  update public.learning_payment_cases set last_verified_at=now(),provider_status=p_provider_status,provider_resolution=coalesce(p_resolution,provider_resolution),dispute_category=coalesce(left(p_category,120),dispute_category),dispute_reason=coalesce(left(p_reason,1000),dispute_reason),response_deadline_at=coalesce(p_deadline,response_deadline_at) where id=p_case_id;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','dispute.verified_via_api','payment_case',p_case_id::text,jsonb_build_object('provider_status',p_provider_status,'event_id',event_key));
  return event_key;
end;$function$;

grant execute
  on function "public"."receive_paystack_test_verified_dispute"(bigint, text, text, bigint, text, text, text, text, timestamp with time zone, jsonb, uuid)
  to "postgres", "service_role";

revoke all on function "public"."receive_paystack_test_verified_dispute"(bigint, text, text, bigint, text, text, text, text, timestamp with time zone, jsonb, uuid) from public;
