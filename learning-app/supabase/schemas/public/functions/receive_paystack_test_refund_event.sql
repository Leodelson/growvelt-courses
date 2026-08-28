create or replace function public.receive_paystack_test_refund_event(
 p_provider_event_id text,p_payload_digest text,p_transaction_reference text,p_provider_case_id text,
 p_provider_status text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb
) returns table(outcome text,event_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare case_row record; existing record; event_key bigint; normalized text;
begin
 normalized:=replace(lower(trim(p_provider_status)),'_','-');
 if p_domain<>'test' or p_currency<>'NGN' or p_amount_minor<=0 or p_payload_digest!~'^[a-f0-9]{64}$'
   or normalized not in('pending','processing','needs-attention','failed','processed')
 then raise exception 'Invalid Paystack test refund event' using errcode='22023'; end if;
 select * into existing from public.learning_payment_provider_events where provider='paystack' and provider_event_id=p_provider_event_id for update;
 if found then
   if existing.payload_digest<>p_payload_digest then return query select 'duplicate_payload_mismatch',existing.id; else return query select case when existing.processing_status='processed' then 'already_processed' else 'already_received' end,existing.id; end if; return;
 end if;
 select c.id,c.order_id,c.payment_attempt_id into case_row from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 where c.case_type='refund' and (c.provider_case_id=p_provider_case_id or (o.order_reference=p_transaction_reference and c.status in('submitting','pending','processing','needs_attention'))) order by c.id desc limit 1;
 if not found then
   insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,processing_status,recovery_status)
   values('paystack',p_provider_event_id,'refund.'||normalized,p_payload_digest,p_payload,true,'failed','manual_review') returning id into event_key;
   update public.learning_payment_provider_events set processed_at=now(),processing_error='No matching refund case' where id=event_key;
   return query select 'unknown_refund',event_key;
   return;
 end if;
 insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,processing_status,order_id,payment_attempt_id,payment_case_id,recovery_status)
 values('paystack',p_provider_event_id,'refund.'||normalized,p_payload_digest,p_payload,true,'received',case_row.order_id,case_row.payment_attempt_id,case_row.id,'none') returning id into event_key;
 return query select 'received',event_key;
end;$function$;
revoke all on function public.receive_paystack_test_refund_event(text,text,text,text,text,bigint,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.receive_paystack_test_refund_event(text,text,text,text,text,bigint,text,text,jsonb) to postgres, service_role;
