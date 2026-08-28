create or replace function public.process_paystack_test_dispute_event (
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
declare event_row public.learning_payment_provider_events%rowtype; case_row public.learning_payment_cases%rowtype; normalized text; result_row record; ledger_result bigint;
begin
  select * into event_row from public.learning_payment_provider_events where id=p_event_id for update;
  if not found or event_row.provider<>'paystack' or event_row.event_type not like 'charge.dispute.%' then raise exception 'Dispute event not found' using errcode='P0002'; end if;
  if event_row.processing_status='processed' then return query select 'already_processed',event_row.order_id,null::bigint; return; end if;
  select * into case_row from public.learning_payment_cases where id=event_row.payment_case_id and case_type='chargeback' for update;
  if not found then update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='No matching dispute case',recovery_status='manual_review' where id=p_event_id; return query select 'unknown_dispute',event_row.order_id,null::bigint; return; end if;
  if event_row.event_type='charge.dispute.remind' then
    normalized:='action_required';
    update public.learning_payment_cases set status=case when status in('opened','under_review') then 'action_required' else status end,reminded_at=now(),action_required_at=coalesce(action_required_at,now()),response_deadline_at=coalesce((event_row.payload->>'due_at')::timestamptz,response_deadline_at),provider_status=coalesce(event_row.payload->>'status',provider_status) where id=case_row.id;
  elsif event_row.event_type='charge.dispute.resolve' then
    if event_row.payload->>'resolution'='merchant-accepted' then
      select * into result_row from public.finalize_paystack_test_chargeback(case_row.id,p_event_id,event_row.verification_source,null);
      ledger_result:=result_row.ledger_transaction_id;
      normalized:='lost';
    elsif event_row.payload->>'resolution'='declined' then
      normalized:='won';
      update public.learning_payment_cases set status='won',provider_status='resolved',provider_resolution='declined',provider_resolved_at=now(),resolved_at=now(),last_verified_at=now() where id=case_row.id;
      insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,metadata) values(case_row.id,'dispute.won','won',event_row.verification_source,p_event_id,event_row.payload);
    else
      normalized:='under_review';
      update public.learning_payment_cases set status=case when status='action_required' then 'under_review' else status end,provider_status=coalesce(event_row.payload->>'status',provider_status),provider_resolution=event_row.payload->>'resolution' where id=case_row.id;
    end if;
  else
    normalized:=case when event_row.payload->>'status'='awaiting-merchant-feedback' then 'action_required' else 'under_review' end;
    update public.learning_payment_cases set status=case when status='opened' then normalized else status end,provider_status=coalesce(event_row.payload->>'status',provider_status) where id=case_row.id;
  end if;
  if event_row.event_type<>'charge.dispute.resolve' or normalized not in('won','lost') then
    insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,metadata) values(case_row.id,event_row.event_type,normalized,event_row.verification_source,p_event_id,event_row.payload);
  end if;
  update public.learning_payment_provider_events set processing_status='processed',processed_at=now(),processing_attempts=processing_attempts+1,last_attempted_at=now(),processing_error=null,recovery_status='resolved' where id=p_event_id;
  return query select normalized,event_row.order_id,ledger_result;
exception when others then
  update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_attempts=processing_attempts+1,last_attempted_at=now(),processing_error=left(sqlerrm,2000),recovery_status='manual_review' where id=p_event_id;
  raise;
end;$function$;

grant execute on function "public"."process_paystack_test_dispute_event"(bigint) to "postgres", "service_role";

revoke all on function "public"."process_paystack_test_dispute_event"(bigint) from public;
