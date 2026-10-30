-- A full provider refund can include a charge passed on to the learner.
-- Keep the course's commercial reversal at its original price, and account
-- separately for any additional amount actually returned to the learner.
begin;

alter table public.learning_payment_cases
  add column provider_refunded_amount_minor bigint
  check (provider_refunded_amount_minor is null or provider_refunded_amount_minor > 0);

-- Called only after the server receives a complete, empty provider refund
-- listing for this exact transaction. It never initiates another refund.
create or replace function public.close_unsubmitted_paystack_live_refund_case(p_case_id bigint,p_operator_id uuid)
returns text language plpgsql security definer set search_path to '' as $function$
declare case_row record;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active')
 then raise exception 'Active administrator required' using errcode='42501'; end if;
 select c.*,o.status order_status into case_row from public.learning_payment_cases c
 join public.learning_orders o on o.id=c.order_id
 where c.id=p_case_id and c.case_type='refund' and exists(
   select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live'
 ) for update of c,o;
 if not found or case_row.status<>'needs_attention' or case_row.provider_case_id is not null
   or case_row.order_status<>'paid' or case_row.updated_at>now()-interval '1 hour'
   or exists(select 1 from public.learning_payment_provider_events e where e.payment_case_id=p_case_id and e.event_type like 'refund.%')
 then raise exception 'Refund case cannot be closed without manual review' using errcode='22023'; end if;
 update public.learning_payment_cases set status='failed',provider_status='failed',
   failure_code='provider_refund_not_found',resolved_at=now(),last_verified_at=now()
 where id=p_case_id;
 insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,operator_id,note)
 values(p_case_id,'refund.provider_attempt_not_found','failed','provider_api',p_operator_id,
   'Complete provider listing contained no refund attempt for this transaction; no learner refund occurred.');
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
 values(p_operator_id,'admin_operator','refund.provider_attempt_not_found','payment_case',p_case_id::text,
   jsonb_build_object('order_id',case_row.order_id,'payment_attempt_id',case_row.payment_attempt_id));
 return 'ready_for_new_refund';
end;$function$;

create or replace function public.finalize_paystack_live_full_refund(
  p_case_id bigint,p_provider_event_id bigint,p_provenance text,p_operator_id uuid default null
) returns table(outcome text,order_id bigint,ledger_transaction_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare case_row record; entitlement_row record; provider_amount_minor bigint; charged_min bigint; charged_max bigint; fee_minor bigint; ledger_key bigint; fee_ledger_key bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('refund-case:'||p_case_id::text,0));
 select c.*,o.order_reference,o.status order_status,o.gross_amount_minor,o.learner_id,o.course_id into case_row
 from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 where c.id=p_case_id and c.case_type='refund' and exists(
   select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live'
 ) for update of c,o;
 if not found then raise exception 'Refund case not found' using errcode='P0002'; end if;
 select id into ledger_key from public.learning_ledger_transactions where payment_case_id=p_case_id and transaction_type='refund';
 if ledger_key is not null then return query select 'already_processed',case_row.order_id,ledger_key; return; end if;
 if case_row.provider_status<>'processed' or case_row.amount_minor<>case_row.gross_amount_minor
 then raise exception 'Authoritative processed full refund required' using errcode='22023'; end if;

 select nullif(ev.payload->>'amount','')::bigint into provider_amount_minor
 from public.learning_payment_provider_events ev
 where ev.id=p_provider_event_id and ev.payment_case_id=p_case_id and ev.event_type='refund.processed'
   and ev.payload->>'domain'='live' and ev.payment_attempt_id=case_row.payment_attempt_id
   and (ev.signature_valid or ev.verification_source='provider_api') for share;
 if provider_amount_minor is null or provider_amount_minor<case_row.gross_amount_minor
 then raise exception 'Authoritative processed refund is less than the course price' using errcode='22023'; end if;

 -- Only the authenticated, processed charge for this exact payment attempt can
 -- authorize a fee-inclusive amount. An absent or conflicting charge is manual review.
 select min((ev.payload->>'charged_amount')::bigint),max((ev.payload->>'charged_amount')::bigint)
 into charged_min,charged_max
 from public.learning_payment_provider_events ev
 where ev.order_id=case_row.order_id and ev.payment_attempt_id=case_row.payment_attempt_id
   and ev.provider='paystack' and ev.event_type='charge.success' and ev.processing_status='processed'
   and ev.payload->>'domain'='live' and coalesce(ev.payload->>'charged_amount','')~'^\d+$'
   and (ev.signature_valid or ev.verification_source='provider_api');
 if charged_min is null or charged_min<>charged_max or provider_amount_minor<>charged_min
 then raise exception 'Authoritative full provider refund does not match the verified charge' using errcode='22023'; end if;
 if case_row.order_status<>'paid' then raise exception 'Order is not refundable' using errcode='22023'; end if;
 fee_minor:=provider_amount_minor-case_row.gross_amount_minor;

 update public.learning_payment_cases set status='processed',processed_amount_minor=case_row.gross_amount_minor,
   provider_refunded_amount_minor=provider_amount_minor,processed_at=coalesce(processed_at,now()),
   resolved_at=coalesce(resolved_at,now()),last_verified_at=now() where id=p_case_id;
 perform public.reverse_learning_order_commercial_allocation(case_row.order_id,p_case_id,'processed Paystack full refund',p_operator_id);
 insert into public.learning_ledger_transactions(order_id,payment_case_id,transaction_type,currency,description,created_by)
 values(case_row.order_id,p_case_id,'refund',case_row.currency,'Processed Paystack full course refund',p_operator_id) returning id into ledger_key;
 insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference)
 values(ledger_key,1,'liability.marketplace_sales_unallocated',case_row.gross_amount_minor,case_row.currency,'payment_case',case_row.case_reference::text),
       (ledger_key,2,'asset.paystack_receivable',-case_row.gross_amount_minor,case_row.currency,'payment_provider',coalesce(case_row.provider_case_id,case_row.provider_case_reference));
 if fee_minor>0 then
   insert into public.learning_ledger_transactions(order_id,payment_case_id,transaction_type,currency,description,created_by)
   values(case_row.order_id,p_case_id,'adjustment',case_row.currency,'Learner pass-through charge returned in full refund',p_operator_id) returning id into fee_ledger_key;
   insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference)
   values(fee_ledger_key,1,'expense.refund_pass_through_charge',fee_minor,case_row.currency,'payment_case',case_row.case_reference::text),
         (fee_ledger_key,2,'asset.paystack_receivable',-fee_minor,case_row.currency,'payment_provider',coalesce(case_row.provider_case_id,case_row.provider_case_reference));
 end if;
 update public.learning_orders set status='refunded' where id=case_row.order_id;
 update public.learning_course_entitlements e set status='refunded',revoked_at=now(),revocation_reason='Full Paystack refund processed'
 where e.order_id=case_row.order_id and e.status='active' returning e.id,e.enrollment_id into entitlement_row;
 if not found then raise exception 'Active entitlement not found' using errcode='P0002'; end if;
 update public.enrollments set status='cancelled' where id=entitlement_row.enrollment_id
   and learner_id=case_row.learner_id and course_id=case_row.course_id and status in('active','completed');
 if not found then raise exception 'Active or completed enrollment not found' using errcode='P0002'; end if;
 insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,operator_id,metadata)
 values(p_case_id,'refund.processed','processed',p_provenance,p_provider_event_id,p_operator_id,
   jsonb_build_object('ledger_transaction_id',ledger_key,'provider_refunded_amount_minor',provider_amount_minor,'additional_charge_minor',fee_minor,'fee_ledger_transaction_id',fee_ledger_key));
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
 values(p_operator_id,case when p_operator_id is null then 'payment_system' else 'admin_operator' end,
   'refund.processed','payment_case',p_case_id::text,
   jsonb_build_object('order_id',case_row.order_id,'ledger_transaction_id',ledger_key,'course_price_minor',case_row.gross_amount_minor,'provider_refunded_amount_minor',provider_amount_minor,'additional_charge_minor',fee_minor));
 return query select 'refunded',case_row.order_id,ledger_key;
end;$function$;

create or replace function public.receive_paystack_live_verified_refund(
 p_case_id bigint,p_provider_case_id text,p_provider_status text,p_provider_reference text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb,p_operator_id uuid
) returns bigint language plpgsql security definer set search_path to '' as $function$
declare case_row record; event_key bigint; digest text; normalized text; charged_min bigint; charged_max bigint;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active')
 then raise exception 'Active administrator required' using errcode='42501'; end if;
 normalized:=replace(lower(trim(p_provider_status)),'_','-');
 if p_domain<>'live' or p_currency<>'NGN' or p_payload->>'domain'<>'live'
   or normalized not in('pending','processing','needs-attention','failed','processed')
 then raise exception 'Invalid verified refund' using errcode='22023'; end if;
 select c.*,o.gross_amount_minor into case_row from public.learning_payment_cases c
 join public.learning_orders o on o.id=c.order_id
 where c.id=p_case_id and c.case_type='refund' and exists(
   select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live');
 if not found or case_row.amount_minor<>case_row.gross_amount_minor or p_amount_minor<case_row.gross_amount_minor
 then raise exception 'Verified refund does not match case' using errcode='22023'; end if;
 select min((ev.payload->>'charged_amount')::bigint),max((ev.payload->>'charged_amount')::bigint)
 into charged_min,charged_max from public.learning_payment_provider_events ev
 where ev.order_id=case_row.order_id and ev.payment_attempt_id=case_row.payment_attempt_id
   and ev.provider='paystack' and ev.event_type='charge.success' and ev.processing_status='processed'
   and ev.payload->>'domain'='live' and coalesce(ev.payload->>'charged_amount','')~'^\d+$'
   and (ev.signature_valid or ev.verification_source='provider_api');
 if charged_min is null or charged_min<>charged_max or p_amount_minor<>charged_min
 then raise exception 'Verified refund does not match the full charged amount' using errcode='22023'; end if;
 digest:=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
 insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,verification_source,processing_status,order_id,payment_attempt_id,payment_case_id,recovery_status)
 values('paystack','refund.verify:live:'||p_provider_case_id||':'||normalized,'refund.'||normalized,digest,p_payload,false,'provider_api','received',case_row.order_id,case_row.payment_attempt_id,p_case_id,'none')
 on conflict(provider,provider_event_id) do update set received_at=public.learning_payment_provider_events.received_at returning id into event_key;
 update public.learning_payment_cases set provider_case_id=coalesce(provider_case_id,p_provider_case_id),provider_case_reference=coalesce(provider_case_reference,p_provider_reference),last_verified_at=now() where id=p_case_id;
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
 values(p_operator_id,'admin_operator','refund.verified_via_api','payment_case',p_case_id::text,
   jsonb_build_object('provider_status',normalized,'event_id',event_key,'provider_refunded_amount_minor',p_amount_minor));
 return event_key;
end;$function$;

revoke all on function public.finalize_paystack_live_full_refund(bigint,bigint,text,uuid),
  public.receive_paystack_live_verified_refund(bigint,text,text,text,bigint,text,text,jsonb,uuid),
  public.close_unsubmitted_paystack_live_refund_case(bigint,uuid)
  from public,anon,authenticated;
grant execute on function public.finalize_paystack_live_full_refund(bigint,bigint,text,uuid),
  public.receive_paystack_live_verified_refund(bigint,text,text,text,bigint,text,text,jsonb,uuid),
  public.close_unsubmitted_paystack_live_refund_case(bigint,uuid)
  to postgres,service_role;

commit;
