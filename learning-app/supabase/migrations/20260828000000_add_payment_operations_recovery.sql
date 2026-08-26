-- Phase 1B1: durable Paystack event intake, recovery metadata, stale-checkout handling, and reconciliation.
-- Forward-only and additive. Existing Phase 1A financial and access records are not rewritten.

alter table public.learning_payment_provider_events
  add column processing_attempts integer not null default 0 check (processing_attempts >= 0),
  add column last_attempted_at timestamptz,
  add column next_retry_at timestamptz,
  add column verification_source text not null default 'webhook'
    check (verification_source in ('webhook','provider_api')),
  add column recovery_status text not null default 'none'
    check (recovery_status in ('none','retryable','manual_review','resolved'));

create index learning_payment_provider_events_recovery_idx
  on public.learning_payment_provider_events (recovery_status, next_retry_at, received_at, id)
  where processing_status in ('received','failed');

create or replace function public.receive_paystack_test_charge_event(
  p_provider_event_id text, p_payload_digest text, p_reference text,
  p_provider_transaction_id text, p_amount_minor bigint, p_currency text,
  p_domain text, p_payload jsonb
) returns table(outcome text, event_id bigint)
language plpgsql security definer set search_path to '' as $function$
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

create or replace function public.process_paystack_test_charge_event(p_event_id bigint)
returns table(outcome text, order_id bigint, enrollment_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare event_row public.learning_payment_provider_events%rowtype; result_row record;
begin
  select * into event_row from public.learning_payment_provider_events where id=p_event_id and provider='paystack' for update;
  if not found then raise exception 'Provider event not found' using errcode='P0002'; end if;
  if event_row.event_type <> 'charge.success' or (not event_row.signature_valid and event_row.verification_source <> 'provider_api') then
    raise exception 'Provider event is not eligible for charge processing' using errcode='22023';
  end if;

  update public.learning_payment_provider_events
  set processing_attempts=processing_attempts+1,last_attempted_at=now(),next_retry_at=null
  where id=p_event_id;

  select * into result_row from public.finalize_paystack_test_charge(
    event_row.provider_event_id,event_row.payload_digest,event_row.payload->>'reference',
    event_row.payload->>'transaction_id',(event_row.payload->>'amount')::bigint,
    event_row.payload->>'currency',event_row.payload->>'domain',event_row.payload
  );

  update public.learning_payment_provider_events set recovery_status=
    case when result_row.outcome in ('paid_and_enrolled','already_processed','already_paid') then 'resolved'
         when result_row.outcome in ('unknown_reference','amount_mismatch','duplicate_payload_mismatch','detached_order','order_not_payable') then 'manual_review'
         else 'retryable' end,
    next_retry_at=case when result_row.outcome in ('paid_and_enrolled','already_processed','already_paid') then null else now()+interval '5 minutes' end
  where id=p_event_id;
  return query select result_row.outcome,result_row.order_id,result_row.enrollment_id;
end;$function$;

create or replace function public.receive_paystack_test_verified_transaction(
  p_reference text,p_provider_transaction_id text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb,p_operator_id uuid
) returns bigint language plpgsql security definer set search_path to '' as $function$
declare event_key bigint; attempt_row record; digest text;
begin
  if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_domain<>'test' or p_currency<>'NGN' or p_amount_minor<=0 or p_payload->>'status'<>'success' then raise exception 'Provider verification is not a successful test payment' using errcode='22023'; end if;
  select a.id payment_attempt_id,a.order_id into attempt_row from public.learning_payment_attempts a where a.provider='paystack' and a.provider_reference=p_reference;
  if not found then raise exception 'Payment attempt not found' using errcode='P0002'; end if;
  digest:=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,verification_source,processing_status,order_id,payment_attempt_id,recovery_status)
  values('paystack','transaction.verify:'||p_provider_transaction_id,'charge.success',digest,p_payload,false,'provider_api','received',attempt_row.order_id,attempt_row.payment_attempt_id,'none')
  on conflict(provider,provider_event_id) do update set received_at=public.learning_payment_provider_events.received_at
  returning id into event_key;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(p_operator_id,'admin_operator','payment_provider_event.verified_via_api','payment_provider_event',event_key::text,jsonb_build_object('reference',p_reference));
  return event_key;
end;$function$;

create or replace function public.recover_paystack_test_charge_event(p_event_id bigint,p_operator_id uuid)
returns table(outcome text,order_id bigint,enrollment_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare result_row record;
begin
  if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active')
  then raise exception 'Active administrator required' using errcode='42501'; end if;
  select * into result_row from public.process_paystack_test_charge_event(p_event_id);
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','payment_provider_event.reprocessed','payment_provider_event',p_event_id::text,jsonb_build_object('outcome',result_row.outcome));
  return query select result_row.outcome,result_row.order_id,result_row.enrollment_id;
end;$function$;

create or replace function public.abandon_verified_paystack_test_attempt(
  p_order_reference text,p_operator_id uuid,p_provider_status text,p_reason text
) returns text language plpgsql security definer set search_path to '' as $function$
declare order_row record;
begin
  if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active')
  then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_provider_status not in ('abandoned','failed') then raise exception 'A conclusive non-success provider status is required' using errcode='22023'; end if;
  select o.id,o.status,a.id attempt_id,a.status attempt_status,a.initialized_at into order_row
  from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id and a.provider='paystack'
  where o.order_reference=p_order_reference for update of o,a;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if order_row.status not in ('created','payment_pending') or order_row.attempt_status not in ('initialized','pending')
  then return 'already_resolved'; end if;
  if order_row.initialized_at > now()-interval '30 minutes' then raise exception 'Checkout is not stale' using errcode='22023'; end if;
  update public.learning_payment_attempts set status='abandoned',failure_code='provider_'||p_provider_status,
    failure_message=left(coalesce(nullif(trim(p_reason),''),'Verified abandoned Paystack checkout'),1000)
  where id=order_row.attempt_id;
  update public.learning_orders set status='cancelled',cancelled_at=now() where id=order_row.id;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','payment_attempt.abandoned','learning_order',order_row.id::text,jsonb_build_object('provider_status',p_provider_status,'reason',left(coalesce(p_reason,''),500)));
  return 'abandoned';
end;$function$;

create or replace function public.list_learning_payment_operations(p_operator_id uuid,p_query text default null,p_limit integer default 50)
returns table(order_id bigint,order_reference text,learner_email text,course_title text,amount_minor bigint,currency text,order_status text,
attempt_status text,provider_transaction_id text,latest_event_id bigint,event_status text,recovery_status text,created_at timestamptz,issue_count bigint)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active')
  then raise exception 'Active administrator required' using errcode='42501'; end if;
  return query
  select o.id,o.order_reference,p.email,o.course_title_snapshot,o.gross_amount_minor,o.currency,o.status,a.status,a.provider_transaction_id,
    ev.id,ev.processing_status,ev.recovery_status,o.created_at,
    (select count(*) from public.reconcile_paystack_test_learning_payments() r where r.order_reference=o.order_reference)
  from public.learning_orders o
  left join public.profiles p on p.id=o.learner_id
  left join lateral(select * from public.learning_payment_attempts x where x.order_id=o.id order by x.initialized_at desc,x.id desc limit 1) a on true
  left join lateral(select * from public.learning_payment_provider_events x where x.order_id=o.id order by x.received_at desc,x.id desc limit 1) ev on true
  where p_query is null or trim(p_query)='' or o.order_reference ilike '%'||trim(p_query)||'%' or coalesce(p.email,'') ilike '%'||trim(p_query)||'%' or o.course_title_snapshot ilike '%'||trim(p_query)||'%'
  order by o.created_at desc,o.id desc limit least(greatest(coalesce(p_limit,50),1),100);
end;$function$;

create or replace function public.reconcile_paystack_test_learning_payments()
returns table(issue_type text,order_reference text,detail text) language sql stable security definer set search_path to '' as $function$
 select 'paid_without_successful_attempt',o.order_reference,'Paid order has no successful Paystack attempt' from public.learning_orders o where o.status in('paid','partially_refunded','refunded','chargeback') and not exists(select 1 from public.learning_payment_attempts a where a.order_id=o.id and a.provider='paystack' and a.status='succeeded')
 union all select 'paid_without_capture_ledger',o.order_reference,'Paid order has no payment-capture ledger transaction' from public.learning_orders o where o.status in('paid','partially_refunded','refunded','chargeback') and not exists(select 1 from public.learning_ledger_transactions t where t.order_id=o.id and t.transaction_type='payment_capture')
 union all select 'paid_without_entitlement',o.order_reference,'Paid order has no active entitlement' from public.learning_orders o where o.status='paid' and not exists(select 1 from public.learning_course_entitlements e where e.order_id=o.id and e.status='active')
 union all select 'entitlement_without_enrollment',o.order_reference,'Active entitlement has no active or completed enrollment' from public.learning_orders o join public.learning_course_entitlements e on e.order_id=o.id and e.status='active' where not exists(select 1 from public.enrollments n where n.id=e.enrollment_id and n.learner_id=e.learner_id and n.course_id=e.course_id and n.status in('active','completed'))
 union all select 'successful_attempt_unpaid_order',o.order_reference,'Successful attempt belongs to an unpaid order' from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id where a.provider='paystack' and a.status='succeeded' and o.status not in('paid','partially_refunded','refunded','chargeback')
 union all select 'failed_provider_event',coalesce(o.order_reference,'unknown'),left(coalesce(ev.processing_error,'Provider event processing failed'),1000) from public.learning_payment_provider_events ev left join public.learning_orders o on o.id=ev.order_id where ev.provider='paystack' and ev.processing_status='failed'
 union all select 'stale_received_provider_event',coalesce(o.order_reference,'unknown'),'Verified provider event has remained unprocessed for more than five minutes' from public.learning_payment_provider_events ev left join public.learning_orders o on o.id=ev.order_id where ev.provider='paystack' and ev.processing_status='received' and ev.received_at<now()-interval '5 minutes'
 union all select 'stale_pending_attempt',o.order_reference,'Paystack checkout has remained pending for more than two hours' from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id where o.status='payment_pending' and a.provider='paystack' and a.status='pending' and a.initialized_at<now()-interval '2 hours'
 union all select 'capture_ledger_imbalance',o.order_reference,'Capture ledger is not balanced or has fewer than two entries' from public.learning_orders o join public.learning_ledger_transactions t on t.order_id=o.id and t.transaction_type='payment_capture' left join public.learning_ledger_entries e on e.transaction_id=t.id group by o.id,o.order_reference,t.id having count(e.id)<2 or coalesce(sum(e.amount_minor),0)<>0
 union all select 'duplicate_capture_ledger',o.order_reference,'Order has more than one payment-capture ledger transaction' from public.learning_orders o join public.learning_ledger_transactions t on t.order_id=o.id and t.transaction_type='payment_capture' group by o.id,o.order_reference having count(*)>1;
$function$;

revoke all on function public.receive_paystack_test_charge_event(text,text,text,text,bigint,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.process_paystack_test_charge_event(bigint) from public,anon,authenticated;
revoke all on function public.receive_paystack_test_verified_transaction(text,text,bigint,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.recover_paystack_test_charge_event(bigint,uuid) from public,anon,authenticated;
revoke all on function public.abandon_verified_paystack_test_attempt(text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.list_learning_payment_operations(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.receive_paystack_test_charge_event(text,text,text,text,bigint,text,text,jsonb) to postgres,service_role;
grant execute on function public.process_paystack_test_charge_event(bigint) to postgres,service_role;
grant execute on function public.receive_paystack_test_verified_transaction(text,text,bigint,text,text,jsonb,uuid) to postgres,service_role;
grant execute on function public.recover_paystack_test_charge_event(bigint,uuid) to postgres,service_role;
grant execute on function public.abandon_verified_paystack_test_attempt(text,uuid,text,text) to postgres,service_role;
grant execute on function public.list_learning_payment_operations(uuid,text,integer) to postgres,service_role;
