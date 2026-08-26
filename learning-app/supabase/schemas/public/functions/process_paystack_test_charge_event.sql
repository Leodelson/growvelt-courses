create or replace function public.process_paystack_test_charge_event(p_event_id bigint)
returns table(outcome text,order_id bigint,enrollment_id bigint) language plpgsql security definer set search_path to '' as $function$
declare event_row public.learning_payment_provider_events%rowtype; result_row record;
begin
 select * into event_row from public.learning_payment_provider_events where id=p_event_id and provider='paystack' for update;
 if not found then raise exception 'Provider event not found' using errcode='P0002'; end if;
 if event_row.event_type<>'charge.success' or (not event_row.signature_valid and event_row.verification_source<>'provider_api') then raise exception 'Provider event is not eligible for charge processing' using errcode='22023'; end if;
 update public.learning_payment_provider_events set processing_attempts=processing_attempts+1,last_attempted_at=now(),next_retry_at=null where id=p_event_id;
 select * into result_row from public.finalize_paystack_test_charge(event_row.provider_event_id,event_row.payload_digest,event_row.payload->>'reference',event_row.payload->>'transaction_id',(event_row.payload->>'amount')::bigint,event_row.payload->>'currency',event_row.payload->>'domain',event_row.payload);
 update public.learning_payment_provider_events set recovery_status=case when result_row.outcome in('paid_and_enrolled','already_processed','already_paid') then 'resolved' when result_row.outcome in('unknown_reference','amount_mismatch','duplicate_payload_mismatch','detached_order','order_not_payable') then 'manual_review' else 'retryable' end,next_retry_at=case when result_row.outcome in('paid_and_enrolled','already_processed','already_paid') then null else now()+interval '5 minutes' end where id=p_event_id;
 return query select result_row.outcome,result_row.order_id,result_row.enrollment_id;
end;$function$;
revoke all on function public.process_paystack_test_charge_event(bigint) from public,anon,authenticated;
grant execute on function public.process_paystack_test_charge_event(bigint) to postgres,service_role;
