create or replace function public.finalize_paystack_test_charge(p_provider_event_id text,p_payload_digest text,p_reference text,p_provider_transaction_id text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb)
returns table(outcome text,order_id bigint,enrollment_id bigint) language plpgsql security definer set search_path to '' as $function$
declare attempt_row record; event_row record; event_key bigint; enrollment_key bigint; ledger_key bigint;
begin
 if p_domain<>'test' or p_currency<>'NGN' or p_amount_minor<=0 or p_payload_digest!~'^[a-f0-9]{64}$' or p_provider_event_id is null or p_provider_transaction_id is null
 then raise exception 'Invalid Paystack test event' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('paystack:'||p_reference,0));
 select a.id attempt_id,a.order_id,a.amount_minor,a.currency,a.status attempt_status,o.learner_id,o.course_id,o.status order_status,o.gross_amount_minor into attempt_row
 from public.learning_payment_attempts a join public.learning_orders o on o.id=a.order_id where a.provider='paystack' and a.provider_reference=p_reference for update of a,o;
 if not found then
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,processing_status,processed_at,processing_error)
  values('paystack',p_provider_event_id,'charge.success',p_payload_digest,p_payload,true,'ignored',now(),'No matching Growvelt Learning payment attempt') on conflict(provider,provider_event_id) do nothing;
  return query select 'unknown_reference'::text,null::bigint,null::bigint; return;
 end if;
 select * into event_row from public.learning_payment_provider_events where provider='paystack' and provider_event_id=p_provider_event_id for update;
 if found then
  if event_row.payload_digest<>p_payload_digest then return query select 'duplicate_payload_mismatch'::text,attempt_row.order_id,null::bigint; return; end if;
  if event_row.processing_status='processed' then select e.enrollment_id into enrollment_key from public.learning_course_entitlements e where e.order_id=attempt_row.order_id; return query select 'already_processed'::text,attempt_row.order_id,enrollment_key; return; end if;
  event_key:=event_row.id; update public.learning_payment_provider_events set processing_status='received',processed_at=null,processing_error=null,order_id=attempt_row.order_id,payment_attempt_id=attempt_row.attempt_id where id=event_key;
 else
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,order_id,payment_attempt_id)
  values('paystack',p_provider_event_id,'charge.success',p_payload_digest,p_payload,true,attempt_row.order_id,attempt_row.attempt_id) returning id into event_key;
 end if;
 if attempt_row.amount_minor<>p_amount_minor or attempt_row.gross_amount_minor<>p_amount_minor or attempt_row.currency<>p_currency then
  update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='Verified provider amount or currency did not match the order' where id=event_key;
  return query select 'amount_mismatch'::text,attempt_row.order_id,null::bigint; return;
 end if;
 if attempt_row.learner_id is null or attempt_row.course_id is null then
  update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='Order identity was detached before finalization' where id=event_key;
  return query select 'detached_order'::text,attempt_row.order_id,null::bigint; return;
 end if;
 if attempt_row.order_status in('paid','partially_refunded','refunded','chargeback') then
  update public.learning_payment_provider_events set processing_status='processed',processed_at=now() where id=event_key;
  select e.enrollment_id into enrollment_key from public.learning_course_entitlements e where e.order_id=attempt_row.order_id;
  return query select 'already_paid'::text,attempt_row.order_id,enrollment_key; return;
 end if;
 if attempt_row.order_status='created' then update public.learning_orders set status='payment_pending' where id=attempt_row.order_id; end if;
 if attempt_row.order_status not in('created','payment_pending') then update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='Order is not payable' where id=event_key; return query select 'order_not_payable'::text,attempt_row.order_id,null::bigint; return; end if;
 update public.learning_payment_attempts set status='succeeded',verified_at=now(),failed_at=null,failure_code=null,failure_message=null,provider_transaction_id=p_provider_transaction_id where id=attempt_row.attempt_id;
 update public.learning_orders set status='paid',paid_at=now(),cancelled_at=null where id=attempt_row.order_id;
 insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description) values(attempt_row.order_id,'payment_capture','NGN','Verified Paystack test-mode course payment') returning id into ledger_key;
 insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference)
 values(ledger_key,1,'asset.paystack_receivable',p_amount_minor,'NGN','payment_provider',p_provider_transaction_id),(ledger_key,2,'liability.marketplace_sales_unallocated',-p_amount_minor,'NGN','learning_order',p_reference);
 insert into public.enrollments(learner_id,course_id,status) values(attempt_row.learner_id,attempt_row.course_id,'active') on conflict(learner_id,course_id) do update set status='active',completed_at=null returning id into enrollment_key;
 insert into public.learning_course_entitlements(learner_id,course_id,order_id,enrollment_id,status) values(attempt_row.learner_id,attempt_row.course_id,attempt_row.order_id,enrollment_key,'active');
 update public.learning_payment_provider_events set processing_status='processed',processed_at=now(),processing_error=null where id=event_key;
 return query select 'paid_and_enrolled'::text,attempt_row.order_id,enrollment_key;
end;$function$;
revoke all on function public.finalize_paystack_test_charge(text,text,text,text,bigint,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_paystack_test_charge(text,text,text,text,bigint,text,text,jsonb) to postgres,service_role;
