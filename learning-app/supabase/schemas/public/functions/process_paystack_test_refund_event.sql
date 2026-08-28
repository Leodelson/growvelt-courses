create or replace function public.process_paystack_test_refund_event (
  p_event_id bigint
)
  returns table (
    outcome               text,
    order_id              bigint,
    ledger_transaction_id bigint
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare event_row record; case_row record; normalized text; result_row record; result_outcome text; result_order_id bigint; result_ledger_id bigint;
begin
 select * into event_row from public.learning_payment_provider_events where id=p_event_id and provider='paystack' for update;
 if not found or event_row.event_type not like 'refund.%' or (not event_row.signature_valid and event_row.verification_source<>'provider_api') then raise exception 'Refund event is not processable' using errcode='22023'; end if;
 if event_row.processing_status='processed' then select c.order_id into case_row from public.learning_payment_cases c where c.id=event_row.payment_case_id; return query select 'already_processed',case_row.order_id,null::bigint; return; end if;
 if event_row.payment_case_id is null then update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='No matching refund case',recovery_status='manual_review' where id=p_event_id; return query select 'unknown_refund',null::bigint,null::bigint; return; end if;
 normalized:=replace(event_row.event_type,'refund.','');
 update public.learning_payment_provider_events set processing_attempts=processing_attempts+1,last_attempted_at=now() where id=p_event_id;
 update public.learning_payment_cases set provider_case_id=coalesce(provider_case_id,event_row.payload->>'refund_id'),provider_case_reference=coalesce(provider_case_reference,event_row.payload->>'refund_reference'),
   provider_status=normalized,last_verified_at=now(),status=case normalized when 'needs-attention' then 'needs_attention' else normalized end,
   action_required_at=case when normalized='needs-attention' then now() else action_required_at end,
   failed_at=case when normalized='failed' then now() else failed_at end,
   failure_code=case when normalized='failed' then 'provider_failed' else failure_code end,
   resolved_at=case when normalized='failed' then now() else resolved_at end
 where id=event_row.payment_case_id and status in('submitting','pending','processing','needs_attention');
 insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,metadata)
 values(event_row.payment_case_id,event_row.event_type,replace(normalized,'-','_'),event_row.verification_source,p_event_id,event_row.payload);
 if normalized='processed' then
   select * into result_row from public.finalize_paystack_test_full_refund(event_row.payment_case_id,p_event_id,event_row.verification_source,null);
   result_outcome:=result_row.outcome; result_order_id:=result_row.order_id; result_ledger_id:=result_row.ledger_transaction_id;
 else result_outcome:=replace(normalized,'-','_'); result_order_id:=event_row.order_id; result_ledger_id:=null; end if;
 update public.learning_payment_provider_events set processing_status='processed',processed_at=now(),processing_error=null,recovery_status='resolved' where id=p_event_id;
 return query select result_outcome,result_order_id,result_ledger_id;
end;$function$;

grant execute on function "public"."process_paystack_test_refund_event"(bigint) to "postgres", "service_role";

revoke all on function "public"."process_paystack_test_refund_event"(bigint) from public;
