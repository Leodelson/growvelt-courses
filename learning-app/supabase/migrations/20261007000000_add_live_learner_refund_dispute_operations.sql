-- Phase 1B3: Live-domain learner refund and dispute operations.
-- Additive only: Test behavior remains unchanged, Live operations stay behind server-side flags.
begin;

create or replace function public.request_paystack_live_full_refund(
  p_order_reference text,p_operator_id uuid,p_idempotency_key uuid,p_confirmation text,p_reason_code text,p_operator_note text
) returns table(case_id bigint,case_reference uuid,amount_minor bigint,currency text,status text,provider_transaction_id text)
language plpgsql security definer set search_path to '' as $function$
declare order_row record; case_row public.learning_payment_cases%rowtype; normalized_note text; normalized_reason text;
begin
  if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active')
  then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_confirmation is distinct from p_order_reference then raise exception 'Exact order-reference confirmation required' using errcode='22023'; end if;
  if p_idempotency_key is null then raise exception 'Refund idempotency key required' using errcode='22023'; end if;
  normalized_reason:=lower(trim(coalesce(p_reason_code,''))); normalized_note:=trim(coalesce(p_operator_note,''));
  if normalized_reason !~ '^[a-z][a-z0-9_]{1,60}$' or char_length(normalized_note) not between 3 and 2000
  then raise exception 'Refund reason and operator note required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('refund:'||p_order_reference,0));
  select o.*,a.id attempt_id,a.provider_transaction_id into order_row from public.learning_orders o
  join public.learning_payment_attempts a on a.order_id=o.id and a.provider='paystack' and a.status='succeeded' and a.paystack_domain='live'
  where o.order_reference=p_order_reference order by a.id desc limit 1 for update of o,a;
  if not found then raise exception 'Paid Paystack order not found' using errcode='P0002'; end if;
  select c.* into case_row from public.learning_payment_cases c where c.idempotency_key=p_idempotency_key;
  if found then
    if case_row.order_id<>order_row.id or case_row.case_type<>'refund' or case_row.payment_attempt_id<>order_row.attempt_id then raise exception 'Refund idempotency conflict' using errcode='23505'; end if;
    return query select case_row.id,case_row.case_reference,case_row.amount_minor,case_row.currency,case_row.status,case_row.provider_transaction_id; return;
  end if;
  if order_row.status<>'paid' then raise exception 'Order is not eligible for a full refund' using errcode='22023'; end if;
  if exists(select 1 from public.learning_payment_cases c where c.order_id=order_row.id and c.case_type='refund' and c.status in ('requested','submitting','pending','processing','needs_attention','processed','succeeded'))
  then raise exception 'A refund already exists for this order' using errcode='23505'; end if;
  insert into public.learning_payment_cases(order_id,payment_attempt_id,case_type,status,amount_minor,currency,reason,initiated_by,
    provider,idempotency_key,provider_transaction_id,requested_amount_minor,reason_code,operator_note,requested_at)
  values(order_row.id,order_row.attempt_id,'refund','requested',order_row.gross_amount_minor,order_row.currency,normalized_note,p_operator_id,
    'paystack',p_idempotency_key,order_row.provider_transaction_id,order_row.gross_amount_minor,normalized_reason,normalized_note,now()) returning * into case_row;
  insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,operator_id,note)
  values(case_row.id,'refund.requested','requested','operator',p_operator_id,normalized_note);
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','refund.requested','payment_case',case_row.id::text,jsonb_build_object('order_id',order_row.id,'amount_minor',order_row.gross_amount_minor,'currency',order_row.currency,'reason_code',normalized_reason));
  return query select case_row.id,case_row.case_reference,case_row.amount_minor,case_row.currency,case_row.status,case_row.provider_transaction_id;
end;$function$;

create or replace function public.mark_paystack_live_refund_submitting(p_case_id bigint,p_operator_id uuid)
returns text language plpgsql security definer set search_path to '' as $function$
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 update public.learning_payment_cases set status='submitting' where id=p_case_id and case_type='refund' and status='requested' and exists(select 1 from public.learning_payment_cases c join public.learning_payment_attempts a on a.id=c.payment_attempt_id where c.id=p_case_id and a.paystack_domain='live');
 if not found then return 'already_submitted'; end if;
 insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,operator_id) values(p_case_id,'refund.submitting','submitting','operator',p_operator_id);
 return 'submitting';
end;$function$;

create or replace function public.record_paystack_live_refund_submission(
 p_case_id bigint,p_provider_case_id text,p_provider_status text,p_provider_reference text,p_operator_id uuid
) returns text language plpgsql security definer set search_path to '' as $function$
declare normalized text;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 normalized:=replace(lower(trim(p_provider_status)),'-','_');
 if normalized not in('pending','processing','needs_attention','failed','processed') then raise exception 'Unsupported refund provider status' using errcode='22023'; end if;
 update public.learning_payment_cases set provider_case_id=p_provider_case_id,provider_case_reference=p_provider_reference,
   provider_status=replace(normalized,'_','-'),provider_submitted_at=coalesce(provider_submitted_at,now()),last_verified_at=now(),
   status=case when normalized='processed' then 'pending' else normalized end,
   failed_at=case when normalized='failed' then now() else null end,
   failure_code=case when normalized='failed' then 'provider_failed' else null end,
   resolved_at=case when normalized='failed' then now() else null end
 where id=p_case_id and case_type='refund' and status in('submitting','pending','processing','needs_attention') and exists(select 1 from public.learning_payment_cases c join public.learning_payment_attempts a on a.id=c.payment_attempt_id where c.id=p_case_id and a.paystack_domain='live');
 if not found then return 'already_resolved'; end if;
 insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,operator_id,metadata)
 values(p_case_id,'refund.provider_submitted',normalized,'provider_api',p_operator_id,jsonb_build_object('provider_case_id',p_provider_case_id,'provider_reference',p_provider_reference));
 return normalized;
end;$function$;

create or replace function public.receive_paystack_live_refund_event(
 p_provider_event_id text,p_payload_digest text,p_transaction_reference text,p_provider_case_id text,
 p_provider_status text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb
) returns table(outcome text,event_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare case_row record; existing record; event_key bigint; normalized text;
begin
 normalized:=replace(lower(trim(p_provider_status)),'_','-');
 if p_domain<>'live' or p_payload->>'domain'<>'live' or p_currency<>'NGN' or p_amount_minor<=0 or p_payload_digest!~'^[a-f0-9]{64}$'
   or normalized not in('pending','processing','needs-attention','failed','processed')
 then raise exception 'Invalid Paystack live refund event' using errcode='22023'; end if;
 select * into existing from public.learning_payment_provider_events where provider='paystack' and provider_event_id=p_provider_event_id for update;
 if found then
   if existing.payload_digest<>p_payload_digest then return query select 'duplicate_payload_mismatch',existing.id; else return query select case when existing.processing_status='processed' then 'already_processed' else 'already_received' end,existing.id; end if; return;
 end if;
 select c.id,c.order_id,c.payment_attempt_id into case_row from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 where c.case_type='refund' and exists(select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live') and (c.provider_case_id=p_provider_case_id or (o.order_reference=p_transaction_reference and c.status in('submitting','pending','processing','needs_attention'))) order by c.id desc limit 1;
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

create or replace function public.finalize_paystack_live_full_refund(p_case_id bigint,p_provider_event_id bigint,p_provenance text,p_operator_id uuid default null)
returns table(outcome text,order_id bigint,ledger_transaction_id bigint) language plpgsql security definer set search_path to '' as $function$
declare case_row record; entitlement_row record; provider_amount_minor bigint; ledger_key bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('refund-case:'||p_case_id::text,0));
 select c.*,o.order_reference,o.status order_status,o.gross_amount_minor,o.learner_id,o.course_id into case_row from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id where c.id=p_case_id and c.case_type='refund' and exists(select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live') for update of c,o;
 if not found then raise exception 'Refund case not found' using errcode='P0002'; end if;
 select id into ledger_key from public.learning_ledger_transactions where payment_case_id=p_case_id and transaction_type='refund';
 if ledger_key is not null then return query select 'already_processed',case_row.order_id,ledger_key; return; end if;
 if case_row.provider_status<>'processed' or case_row.amount_minor<>case_row.gross_amount_minor then raise exception 'Authoritative processed full refund required' using errcode='22023'; end if;
 select nullif(ev.payload->>'amount','')::bigint into provider_amount_minor
 from public.learning_payment_provider_events ev
 where ev.id=p_provider_event_id and ev.payment_case_id=p_case_id and ev.event_type='refund.processed' and ev.payload->>'domain'='live' and ev.payment_attempt_id=case_row.payment_attempt_id
   and (ev.signature_valid or ev.verification_source='provider_api') for share;
 if provider_amount_minor is null or provider_amount_minor<>case_row.gross_amount_minor then
   raise exception 'Authoritative processed refund amount does not match the order gross amount' using errcode='22023';
 end if;
 if case_row.order_status<>'paid' then raise exception 'Order is not refundable' using errcode='22023'; end if;
 update public.learning_payment_cases set status='processed',processed_amount_minor=provider_amount_minor,processed_at=coalesce(processed_at,now()),resolved_at=coalesce(resolved_at,now()),last_verified_at=now() where id=p_case_id;
 perform public.reverse_learning_order_commercial_allocation(case_row.order_id,p_case_id,'processed Paystack full refund',p_operator_id);
 insert into public.learning_ledger_transactions(order_id,payment_case_id,transaction_type,currency,description,created_by) values(case_row.order_id,p_case_id,'refund',case_row.currency,'Processed Paystack full course refund',p_operator_id) returning id into ledger_key;
 insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference) values(ledger_key,1,'liability.marketplace_sales_unallocated',case_row.amount_minor,case_row.currency,'payment_case',case_row.case_reference::text),(ledger_key,2,'asset.paystack_receivable',-case_row.amount_minor,case_row.currency,'payment_provider',coalesce(case_row.provider_case_id,case_row.provider_case_reference));
 update public.learning_orders set status='refunded' where id=case_row.order_id;
 update public.learning_course_entitlements e set status='refunded',revoked_at=now(),revocation_reason='Full Paystack refund processed' where e.order_id=case_row.order_id and e.status='active' returning e.id,e.enrollment_id into entitlement_row;
 if not found then raise exception 'Active entitlement not found' using errcode='P0002'; end if;
 update public.enrollments set status='cancelled' where id=entitlement_row.enrollment_id and learner_id=case_row.learner_id and course_id=case_row.course_id and status in('active','completed');
 if not found then raise exception 'Active or completed enrollment not found' using errcode='P0002'; end if;
 update public.learning_payment_cases set status='processed',processed_amount_minor=amount_minor,processed_at=now(),resolved_at=now(),last_verified_at=now() where id=p_case_id;
 insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,operator_id,metadata) values(p_case_id,'refund.processed','processed',p_provenance,p_provider_event_id,p_operator_id,jsonb_build_object('ledger_transaction_id',ledger_key));
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(p_operator_id,case when p_operator_id is null then 'payment_system' else 'admin_operator' end,'refund.processed','payment_case',p_case_id::text,jsonb_build_object('order_id',case_row.order_id,'ledger_transaction_id',ledger_key,'amount_minor',case_row.amount_minor));
 return query select 'refunded',case_row.order_id,ledger_key;
end;$function$;

create or replace function public.process_paystack_live_refund_event(p_event_id bigint)
returns table(outcome text,order_id bigint,ledger_transaction_id bigint) language plpgsql security definer set search_path to '' as $function$
declare event_row record; case_row record; normalized text; result_row record; result_outcome text; result_order_id bigint; result_ledger_id bigint;
begin
 select * into event_row from public.learning_payment_provider_events where id=p_event_id and provider='paystack' for update;
 if not found or event_row.event_type not like 'refund.%' or event_row.payload->>'domain'<>'live' or not exists(select 1 from public.learning_payment_attempts a where a.id=event_row.payment_attempt_id and a.paystack_domain='live') or (not event_row.signature_valid and event_row.verification_source<>'provider_api') then raise exception 'Refund event is not processable' using errcode='22023'; end if;
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
   select * into result_row from public.finalize_paystack_live_full_refund(event_row.payment_case_id,p_event_id,event_row.verification_source,null);
   result_outcome:=result_row.outcome; result_order_id:=result_row.order_id; result_ledger_id:=result_row.ledger_transaction_id;
 else result_outcome:=replace(normalized,'-','_'); result_order_id:=event_row.order_id; result_ledger_id:=null; end if;
 update public.learning_payment_provider_events set processing_status='processed',processed_at=now(),processing_error=null,recovery_status='resolved' where id=p_event_id;
 return query select result_outcome,result_order_id,result_ledger_id;
end;$function$;

create or replace function public.receive_paystack_live_verified_refund(
 p_case_id bigint,p_provider_case_id text,p_provider_status text,p_provider_reference text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb,p_operator_id uuid
) returns bigint language plpgsql security definer set search_path to '' as $function$
declare case_row record; event_key bigint; digest text; normalized text;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 normalized:=replace(lower(trim(p_provider_status)),'_','-');
 if p_domain<>'live' or p_currency<>'NGN' or p_payload->>'domain'<>'live' or normalized not in('pending','processing','needs-attention','failed','processed') then raise exception 'Invalid verified refund' using errcode='22023'; end if;
 select * into case_row from public.learning_payment_cases c where c.id=p_case_id and c.case_type='refund' and exists(select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live');
 if not found or case_row.amount_minor<>p_amount_minor then raise exception 'Verified refund does not match case' using errcode='22023'; end if;
 digest:=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
 insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,verification_source,processing_status,order_id,payment_attempt_id,payment_case_id,recovery_status)
 values('paystack','refund.verify:live:'||p_provider_case_id||':'||normalized,'refund.'||normalized,digest,p_payload,false,'provider_api','received',case_row.order_id,case_row.payment_attempt_id,p_case_id,'none')
 on conflict(provider,provider_event_id) do update set received_at=public.learning_payment_provider_events.received_at returning id into event_key;
 update public.learning_payment_cases set provider_case_id=coalesce(provider_case_id,p_provider_case_id),provider_case_reference=coalesce(provider_case_reference,p_provider_reference),last_verified_at=now() where id=p_case_id;
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(p_operator_id,'admin_operator','refund.verified_via_api','payment_case',p_case_id::text,jsonb_build_object('provider_status',normalized,'event_id',event_key));
 return event_key;
end;$function$;

create or replace function public.recover_paystack_live_refund_event(p_event_id bigint,p_operator_id uuid)
returns table(outcome text,order_id bigint,ledger_transaction_id bigint) language plpgsql security definer set search_path to '' as $function$
declare result_row record;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 select * into result_row from public.process_paystack_live_refund_event(p_event_id);
 return query select result_row.outcome,result_row.order_id,result_row.ledger_transaction_id;
end;$function$;

create or replace function public.get_learning_live_refund_case_for_recovery(p_operator_id uuid,p_case_id bigint)
returns table(order_reference text,provider_case_id text,provider_transaction_id text)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active')
 then raise exception 'Active administrator required' using errcode='42501'; end if;
 return query
 select o.order_reference,c.provider_case_id,c.provider_transaction_id
 from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 where c.id=p_case_id and c.case_type='refund' and exists(select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live') and c.status in('pending','processing','needs_attention')
   and c.provider_case_id is not null and c.provider_transaction_id is not null;
end;$function$;

create or replace function public.get_learning_test_refund_case_for_recovery(p_operator_id uuid,p_case_id bigint)
returns table(order_reference text,provider_case_id text,provider_transaction_id text)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active')
 then raise exception 'Active administrator required' using errcode='42501'; end if;
 return query
 select o.order_reference,c.provider_case_id,c.provider_transaction_id
 from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 join public.learning_payment_attempts a on a.id=c.payment_attempt_id
 where c.id=p_case_id and c.case_type='refund' and coalesce(a.paystack_domain,'test')='test'
   and c.status in('pending','processing','needs_attention') and c.provider_case_id is not null and c.provider_transaction_id is not null;
end;$function$;

create or replace function public.receive_paystack_live_dispute_event(
  p_provider_event_id text,p_payload_digest text,p_event_type text,p_transaction_reference text,p_provider_case_id text,
  p_provider_status text,p_resolution text,p_amount_minor bigint,p_currency text,p_domain text,p_category text,
  p_reason text,p_deadline timestamptz,p_payload jsonb)
returns table(outcome text,event_id bigint,case_id bigint) language plpgsql security definer set search_path to '' as $function$
declare order_row record; case_row public.learning_payment_cases%rowtype; event_row public.learning_payment_provider_events%rowtype; normalized_status text;
begin
  if p_event_type not in ('charge.dispute.create','charge.dispute.remind','charge.dispute.resolve') or p_domain<>'live' or p_payload->>'domain'<>'live'
    or p_currency<>'NGN' or p_amount_minor<=0 or p_provider_case_id!~'^\d+$'
  then raise exception 'Invalid Paystack dispute event' using errcode='22023'; end if;
  select o.*,a.id attempt_id into order_row from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id
  where o.order_reference=p_transaction_reference and a.provider='paystack' and a.status='succeeded' and a.paystack_domain='live';
  if not found or order_row.status not in ('paid','partially_refunded') or order_row.currency<>p_currency
    or p_amount_minor>order_row.gross_amount_minor
  then raise exception 'Dispute does not match an eligible paid order' using errcode='22023'; end if;
  select * into case_row from public.learning_payment_cases c where c.provider='paystack' and c.provider_case_id=p_provider_case_id
    and exists(select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live');
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

create or replace function public.finalize_paystack_live_chargeback(p_case_id bigint,p_provider_event_id bigint,p_provenance text,p_operator_id uuid)
returns table(outcome text,order_id bigint,ledger_transaction_id bigint) language plpgsql security definer set search_path to '' as $function$
declare case_row record; ledger_key bigint; entitlement_row record; reversed_minor bigint;
begin
  if p_provenance not in ('webhook','provider_api') then raise exception 'Invalid chargeback provenance' using errcode='22023'; end if;
  select c.*,o.status order_status,o.gross_amount_minor into case_row from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id where c.id=p_case_id and c.case_type='chargeback' and exists(select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live') for update of c,o;
  if not found then raise exception 'Live dispute case not found' using errcode='P0002'; end if;
  select id into ledger_key from public.learning_ledger_transactions where payment_case_id=p_case_id and transaction_type='chargeback';
  if found then return query select 'already_finalized',case_row.order_id,ledger_key; return; end if;
  if not exists(select 1 from public.learning_payment_provider_events ev where ev.id=p_provider_event_id and ev.payment_case_id=p_case_id and ev.event_type='charge.dispute.resolve' and ev.payload->>'domain'='live' and ev.payload->>'resolution'='merchant-accepted' and (ev.signature_valid or ev.verification_source='provider_api')) then raise exception 'Authoritative live dispute loss required' using errcode='22023'; end if;
  if case_row.status='won' then raise exception 'Won dispute cannot create a chargeback' using errcode='22023'; end if;
  select coalesce(sum(abs(e.amount_minor))/2,0) into reversed_minor from public.learning_ledger_transactions t join public.learning_ledger_entries e on e.transaction_id=t.id where t.order_id=case_row.order_id and t.transaction_type in ('refund','chargeback');
  if case_row.order_status<>'paid' or reversed_minor+case_row.amount_minor>case_row.gross_amount_minor then raise exception 'Chargeback exceeds remaining paid balance' using errcode='22023'; end if;
  -- Set the authoritative provider outcome before the commercial reversal. If
  -- the reversal rejects a partial chargeback, this transaction rolls back and
  -- the signed/provider event remains available for explicit operator review.
  update public.learning_payment_cases set status='lost',provider_status='resolved',provider_resolution='merchant-accepted',provider_resolved_at=now(),resolved_at=now(),last_verified_at=now() where id=p_case_id;
  perform public.reverse_learning_order_commercial_allocation(case_row.order_id,p_case_id,'Paystack dispute financial loss',p_operator_id);
  insert into public.learning_ledger_transactions(order_id,payment_case_id,transaction_type,currency,description,created_by) values(case_row.order_id,p_case_id,'chargeback',case_row.currency,'Paystack dispute financial loss',p_operator_id) returning id into ledger_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference) values(ledger_key,1,'liability.marketplace_sales_unallocated',case_row.amount_minor,case_row.currency,'payment_case',case_row.case_reference::text),(ledger_key,2,'asset.paystack_receivable',-case_row.amount_minor,case_row.currency,'paystack_dispute',case_row.provider_case_id);
  update public.learning_orders set status='chargeback',updated_at=now() where id=case_row.order_id;
  update public.learning_course_entitlements e set status='chargeback',revoked_at=now(),revocation_reason='Paystack dispute resolved against Growvelt' where e.order_id=case_row.order_id and e.status='active' returning e.id,e.enrollment_id into entitlement_row;
  if entitlement_row.enrollment_id is not null then update public.enrollments set status='cancelled' where id=entitlement_row.enrollment_id and status in('active','completed'); end if;
  update public.learning_payment_cases set status='lost',processed_amount_minor=amount_minor,processed_at=now(),resolved_at=now(),provider_resolved_at=now(),last_verified_at=now() where id=p_case_id;
  insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,provider_event_id,operator_id,metadata) values(p_case_id,'dispute.lost','lost',p_provenance,p_provider_event_id,p_operator_id,jsonb_build_object('ledger_transaction_id',ledger_key));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(p_operator_id,case when p_operator_id is null then 'payment_system' else 'admin_operator' end,'chargeback.finalized','payment_case',p_case_id::text,jsonb_build_object('order_id',case_row.order_id,'ledger_transaction_id',ledger_key,'amount_minor',case_row.amount_minor));
  return query select 'chargeback_finalized',case_row.order_id,ledger_key;
end;$function$;

create or replace function public.process_paystack_live_dispute_event(p_event_id bigint)
returns table(outcome text,order_id bigint,ledger_transaction_id bigint) language plpgsql security definer set search_path to '' as $function$
declare event_row public.learning_payment_provider_events%rowtype; case_row public.learning_payment_cases%rowtype; normalized text; result_row record; ledger_result bigint;
begin
  select * into event_row from public.learning_payment_provider_events where id=p_event_id for update;
  if not found or event_row.provider<>'paystack' or event_row.event_type not like 'charge.dispute.%' or event_row.payload->>'domain'<>'live' or not exists(select 1 from public.learning_payment_attempts a where a.id=event_row.payment_attempt_id and a.paystack_domain='live') then raise exception 'Dispute event not found' using errcode='P0002'; end if;
  if event_row.processing_status='processed' then return query select 'already_processed',event_row.order_id,null::bigint; return; end if;
  select * into case_row from public.learning_payment_cases where id=event_row.payment_case_id and case_type='chargeback' for update;
  if not found then update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='No matching dispute case',recovery_status='manual_review' where id=p_event_id; return query select 'unknown_dispute',event_row.order_id,null::bigint; return; end if;
  if event_row.event_type='charge.dispute.remind' then
    normalized:='action_required';
    update public.learning_payment_cases set status=case when status in('opened','under_review') then 'action_required' else status end,reminded_at=now(),action_required_at=coalesce(action_required_at,now()),response_deadline_at=coalesce((event_row.payload->>'due_at')::timestamptz,response_deadline_at),provider_status=coalesce(event_row.payload->>'status',provider_status) where id=case_row.id;
  elsif event_row.event_type='charge.dispute.resolve' then
    if event_row.payload->>'resolution'='merchant-accepted' then
      select * into result_row from public.finalize_paystack_live_chargeback(case_row.id,p_event_id,event_row.verification_source,null);
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

create or replace function public.receive_paystack_live_verified_dispute(
  p_case_id bigint,p_provider_status text,p_resolution text,p_amount_minor bigint,p_currency text,p_domain text,
  p_category text,p_reason text,p_deadline timestamptz,p_payload jsonb,p_operator_id uuid)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare case_row record; event_key bigint; event_name text;
begin
  if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Administrator access required' using errcode='42501'; end if;
  select c.*,o.order_reference into case_row from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
  where c.id=p_case_id and c.case_type='chargeback';
  if not found or p_domain<>'live' or p_payload->>'domain'<>'live' or not exists(select 1 from public.learning_payment_attempts a where a.id=case_row.payment_attempt_id and a.paystack_domain='live') or p_currency<>case_row.currency or p_amount_minor<>case_row.amount_minor
  then raise exception 'Verified dispute does not match its case' using errcode='22023'; end if;
  event_name:=case when p_provider_status='resolved' then 'charge.dispute.resolve' when p_provider_status='awaiting-merchant-feedback' then 'charge.dispute.remind' else 'charge.dispute.create' end;
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,verification_source,processing_status,order_id,payment_attempt_id,payment_case_id,recovery_status)
  values('paystack','provider_api:live:dispute:'||case_row.provider_case_id||':'||coalesce(p_provider_status,'unknown')||':'||coalesce(p_resolution,'none'),event_name,
    encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex'),p_payload,false,'provider_api','received',case_row.order_id,case_row.payment_attempt_id,case_row.id,'retryable')
  on conflict(provider,provider_event_id) do update set last_attempted_at=now()
  returning id into event_key;
  update public.learning_payment_cases set last_verified_at=now(),provider_status=p_provider_status,provider_resolution=coalesce(p_resolution,provider_resolution),dispute_category=coalesce(left(p_category,120),dispute_category),dispute_reason=coalesce(left(p_reason,1000),dispute_reason),response_deadline_at=coalesce(p_deadline,response_deadline_at) where id=p_case_id;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','dispute.verified_via_api','payment_case',p_case_id::text,jsonb_build_object('provider_status',p_provider_status,'event_id',event_key));
  return event_key;
end;$function$;

create or replace function public.get_learning_live_dispute_case_for_recovery(p_operator_id uuid,p_case_id bigint)
returns table(case_id bigint,provider_case_id text,order_reference text,amount_minor bigint,currency text)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select c.id,c.provider_case_id,o.order_reference,c.amount_minor,c.currency from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 where c.id=p_case_id and c.case_type='chargeback' and exists(select 1 from public.learning_payment_attempts a where a.id=c.payment_attempt_id and a.paystack_domain='live') and c.status in('opened','action_required','submitted','under_review') and c.provider_case_id is not null;
end;$function$;

create or replace function public.get_learning_test_dispute_case_for_recovery(p_operator_id uuid,p_case_id bigint)
returns table(case_id bigint,provider_case_id text,order_reference text,amount_minor bigint,currency text)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select c.id,c.provider_case_id,o.order_reference,c.amount_minor,c.currency
 from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 join public.learning_payment_attempts a on a.id=c.payment_attempt_id
 where c.id=p_case_id and c.case_type='chargeback' and coalesce(a.paystack_domain,'test')='test'
   and c.status in('opened','action_required','submitted','under_review') and c.provider_case_id is not null;
end;$function$;

create or replace function public.recover_paystack_live_refund_event(p_event_id bigint,p_operator_id uuid)
returns table(outcome text,order_id bigint,ledger_transaction_id bigint) language plpgsql security definer set search_path to '' as $function$
declare result_row record;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 select * into result_row from public.process_paystack_live_refund_event(p_event_id);
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
 values(p_operator_id,'admin_operator','refund.live_event.reprocessed','payment_provider_event',p_event_id::text,jsonb_build_object('outcome',result_row.outcome,'domain','live'));
 return query select result_row.outcome,result_row.order_id,result_row.ledger_transaction_id;
end;$function$;

create or replace function public.recover_paystack_live_dispute_event(p_event_id bigint,p_operator_id uuid)
returns table(outcome text,order_id bigint,ledger_transaction_id bigint) language plpgsql security definer set search_path to '' as $function$
declare result_row record;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 select * into result_row from public.process_paystack_live_dispute_event(p_event_id);
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
 values(p_operator_id,'admin_operator','dispute.live_event.reprocessed','payment_provider_event',p_event_id::text,jsonb_build_object('outcome',result_row.outcome,'domain','live'));
 return query select result_row.outcome,result_row.order_id,result_row.ledger_transaction_id;
end;$function$;

-- The names retain their original Test-mode prefix for compatibility, but no
-- Test RPC has gained Live authority; every Live operation has a separate RPC.
revoke all on function
  public.request_paystack_live_full_refund(text,uuid,uuid,text,text,text),
  public.mark_paystack_live_refund_submitting(bigint,uuid),
  public.record_paystack_live_refund_submission(bigint,text,text,text,uuid),
  public.receive_paystack_live_refund_event(text,text,text,text,text,bigint,text,text,jsonb),
  public.finalize_paystack_live_full_refund(bigint,bigint,text,uuid),
  public.process_paystack_live_refund_event(bigint),
  public.receive_paystack_live_verified_refund(bigint,text,text,text,bigint,text,text,jsonb,uuid),
  public.recover_paystack_live_refund_event(bigint,uuid),
  public.get_learning_live_refund_case_for_recovery(uuid,bigint),
  public.get_learning_test_refund_case_for_recovery(uuid,bigint),
  public.receive_paystack_live_dispute_event(text,text,text,text,text,text,text,bigint,text,text,text,text,timestamptz,jsonb),
  public.finalize_paystack_live_chargeback(bigint,bigint,text,uuid),
  public.process_paystack_live_dispute_event(bigint),
  public.receive_paystack_live_verified_dispute(bigint,text,text,bigint,text,text,text,text,timestamptz,jsonb,uuid),
  public.recover_paystack_live_dispute_event(bigint,uuid),
  public.get_learning_live_dispute_case_for_recovery(uuid,bigint),
  public.get_learning_test_dispute_case_for_recovery(uuid,bigint)
from public,anon,authenticated;

grant execute on function
  public.request_paystack_live_full_refund(text,uuid,uuid,text,text,text),
  public.mark_paystack_live_refund_submitting(bigint,uuid),
  public.record_paystack_live_refund_submission(bigint,text,text,text,uuid),
  public.receive_paystack_live_refund_event(text,text,text,text,text,bigint,text,text,jsonb),
  public.finalize_paystack_live_full_refund(bigint,bigint,text,uuid),
  public.process_paystack_live_refund_event(bigint),
  public.receive_paystack_live_verified_refund(bigint,text,text,text,bigint,text,text,jsonb,uuid),
  public.recover_paystack_live_refund_event(bigint,uuid),
  public.get_learning_live_refund_case_for_recovery(uuid,bigint),
  public.get_learning_test_refund_case_for_recovery(uuid,bigint),
  public.receive_paystack_live_dispute_event(text,text,text,text,text,text,text,bigint,text,text,text,text,timestamptz,jsonb),
  public.finalize_paystack_live_chargeback(bigint,bigint,text,uuid),
  public.process_paystack_live_dispute_event(bigint),
  public.receive_paystack_live_verified_dispute(bigint,text,text,bigint,text,text,text,text,timestamptz,jsonb,uuid),
  public.recover_paystack_live_dispute_event(bigint,uuid),
  public.get_learning_live_dispute_case_for_recovery(uuid,bigint),
  public.get_learning_test_dispute_case_for_recovery(uuid,bigint)
to postgres,service_role;

commit;
