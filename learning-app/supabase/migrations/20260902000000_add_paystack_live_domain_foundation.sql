-- Phase 1B3B: additive live-domain readiness. Existing records retain their
-- legacy implicit test domain; no historical financial row is rewritten.

alter table public.learning_payment_attempts add column paystack_domain text;
alter table public.learning_payment_attempts add constraint learning_payment_attempts_paystack_domain_check
  check (paystack_domain is null or paystack_domain in ('test','live'));

drop index public.learning_payment_attempts_provider_transaction_key;
create unique index learning_payment_attempts_provider_domain_transaction_key
  on public.learning_payment_attempts(provider,coalesce(paystack_domain,'test'),provider_transaction_id)
  where provider_transaction_id is not null;

create or replace function public.protect_learning_payment_attempt_domain()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op='UPDATE' and old.paystack_domain is distinct from new.paystack_domain then
    raise exception 'Paystack payment domain is immutable' using errcode='42501';
  end if;
  return new;
end;$function$;

create trigger protect_learning_payment_attempt_domain
before update of paystack_domain on public.learning_payment_attempts
for each row execute function public.protect_learning_payment_attempt_domain();

create or replace function public.validate_learning_provider_event_links()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare expected_domain text;
begin
  if new.order_id is not null and new.payment_attempt_id is not null and not exists (
    select 1 from public.learning_payment_attempts where id=new.payment_attempt_id and order_id=new.order_id
  ) then raise exception 'Provider event attempt does not belong to its order' using errcode='22023'; end if;
  if new.payment_case_id is not null and not exists (
    select 1 from public.learning_payment_cases c where c.id=new.payment_case_id and (new.order_id is null or c.order_id=new.order_id) and (new.payment_attempt_id is null or c.payment_attempt_id=new.payment_attempt_id)
  ) then raise exception 'Provider event case does not belong to its order or attempt' using errcode='22023'; end if;
  if new.payment_attempt_id is not null and new.payload ? 'domain' then
    select coalesce(paystack_domain,'test') into expected_domain from public.learning_payment_attempts where id=new.payment_attempt_id;
    if expected_domain is distinct from new.payload->>'domain' then raise exception 'Provider event domain does not match payment attempt' using errcode='22023'; end if;
  end if;
  return new;
end;$function$;

drop trigger if exists validate_learning_provider_event_links on public.learning_payment_provider_events;
create trigger validate_learning_provider_event_links
before insert or update of order_id,payment_attempt_id,payment_case_id,payload on public.learning_payment_provider_events
for each row execute function public.validate_learning_provider_event_links();

create or replace function public.initialize_paystack_live_learning_order(p_learner_id uuid,p_course_id bigint)
returns table(order_id bigint,order_reference text,payment_attempt_id bigint,amount_minor bigint,currency text)
language plpgsql security definer set search_path to '' as $function$
declare course_row record; order_key bigint; order_ref text; attempt_key bigint; amount_key bigint;
begin
  if p_learner_id is null or p_course_id is null then raise exception 'Learner and course are required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_learner_id::text||':'||p_course_id::text,0));
  select c.id,c.instructor_id,c.title,c.price_amount,c.price_currency,c.is_free,c.is_limited_time_free,c.status,p.full_name instructor_name into course_row
  from public.learning_courses c join public.profiles p on p.id=c.instructor_id where c.id=p_course_id;
  if not found or course_row.status<>'published' then raise exception 'Course is not available for purchase' using errcode='22023'; end if;
  if not exists(select 1 from public.account_capabilities where user_id=course_row.instructor_id and capability='instructor' and status='active')
    or not exists(select 1 from public.instructor_profiles where user_id=course_row.instructor_id and approval_status='approved')
    or not exists(select 1 from public.course_rights_declarations d where d.course_id=course_row.id and d.instructor_id=course_row.instructor_id and d.rights_basis in ('original','licensed','authorized'))
  then raise exception 'Course commercial publication prerequisites are not met' using errcode='22023'; end if;
  if course_row.is_free or course_row.is_limited_time_free or course_row.price_amount is null or course_row.price_amount<=0 or course_row.price_currency<>'NGN' or scale(course_row.price_amount)>2
  then raise exception 'Course does not have an eligible paid NGN price' using errcode='22023'; end if;
  if exists(select 1 from public.enrollments where learner_id=p_learner_id and course_id=p_course_id and status in ('active','completed'))
    or exists(select 1 from public.learning_course_entitlements where learner_id=p_learner_id and course_id=p_course_id and status='active')
    or exists(select 1 from public.learning_orders where learner_id=p_learner_id and course_id=p_course_id and status in ('created','payment_pending','paid','partially_refunded'))
  then raise exception 'Learner already has course access or a purchase in progress' using errcode='23505'; end if;
  amount_key:=round(course_row.price_amount*100)::bigint;
  insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
  values(p_learner_id,p_course_id,course_row.instructor_id,course_row.title,course_row.instructor_name,amount_key,'NGN','created','phase1b3-live-v1') returning id,public.learning_orders.order_reference into order_key,order_ref;
  insert into public.learning_payment_attempts(order_id,provider,provider_reference,amount_minor,currency,status,paystack_domain)
  values(order_key,'paystack',order_ref,amount_key,'NGN','initialized','live') returning id into attempt_key;
  return query select order_key,order_ref,attempt_key,amount_key,'NGN'::text;
end;$function$;

create or replace function public.mark_paystack_live_learning_attempt_pending(p_order_reference text)
returns void language plpgsql security definer set search_path to '' as $function$
declare order_key bigint;
begin
  update public.learning_orders set status='payment_pending' where order_reference=p_order_reference and status='created' returning id into order_key;
  if order_key is null then raise exception 'Order cannot enter payment pending' using errcode='22023'; end if;
  update public.learning_payment_attempts set status='pending' where order_id=order_key and provider='paystack' and paystack_domain='live' and status='initialized';
  if not found then raise exception 'Live payment attempt cannot enter pending' using errcode='22023'; end if;
end;$function$;

create or replace function public.finalize_paystack_live_charge(p_provider_event_id text,p_payload_digest text,p_reference text,p_provider_transaction_id text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb)
returns table(outcome text,order_id bigint,enrollment_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare attempt_row record; event_row record; event_key bigint; enrollment_key bigint; ledger_key bigint;
begin
  if p_domain<>'live' or p_currency<>'NGN' or p_amount_minor<=0 or p_payload_digest !~ '^[a-f0-9]{64}$' or p_provider_event_id is null or p_provider_transaction_id is null then raise exception 'Invalid Paystack live event' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('paystack:live:'||p_reference,0));
  select a.id attempt_id,a.order_id,a.amount_minor,a.currency,o.learner_id,o.course_id,o.status order_status,o.gross_amount_minor into attempt_row
  from public.learning_payment_attempts a join public.learning_orders o on o.id=a.order_id where a.provider='paystack' and a.provider_reference=p_reference and a.paystack_domain='live' for update of a,o;
  if not found then
    insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,processing_status,processed_at,processing_error)
    values('paystack',p_provider_event_id,'charge.success',p_payload_digest,p_payload,true,'ignored',now(),'No matching Growvelt Learning live payment attempt') on conflict(provider,provider_event_id) do nothing;
    return query select 'unknown_reference'::text,null::bigint,null::bigint; return;
  end if;
  select * into event_row from public.learning_payment_provider_events where provider='paystack' and provider_event_id=p_provider_event_id for update;
  if found then
    if event_row.payload_digest<>p_payload_digest then return query select 'duplicate_payload_mismatch',attempt_row.order_id,null::bigint; return; end if;
    if event_row.processing_status='processed' then select e.enrollment_id into enrollment_key from public.learning_course_entitlements e where e.order_id=attempt_row.order_id; return query select 'already_processed',attempt_row.order_id,enrollment_key; return; end if;
    event_key:=event_row.id; update public.learning_payment_provider_events set processing_status='received',processed_at=null,processing_error=null,order_id=attempt_row.order_id,payment_attempt_id=attempt_row.attempt_id where id=event_key;
  else
    insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,order_id,payment_attempt_id)
    values('paystack',p_provider_event_id,'charge.success',p_payload_digest,p_payload,true,attempt_row.order_id,attempt_row.attempt_id) returning id into event_key;
  end if;
  if attempt_row.amount_minor<>p_amount_minor or attempt_row.gross_amount_minor<>p_amount_minor or attempt_row.currency<>p_currency then update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='Verified provider amount or currency did not match the order' where id=event_key; return query select 'amount_mismatch',attempt_row.order_id,null::bigint; return; end if;
  if attempt_row.learner_id is null or attempt_row.course_id is null then update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='Order identity was detached before finalization' where id=event_key; return query select 'detached_order',attempt_row.order_id,null::bigint; return; end if;
  if attempt_row.order_status in ('paid','partially_refunded','refunded','chargeback') then update public.learning_payment_provider_events set processing_status='processed',processed_at=now() where id=event_key; select e.enrollment_id into enrollment_key from public.learning_course_entitlements e where e.order_id=attempt_row.order_id; return query select 'already_paid',attempt_row.order_id,enrollment_key; return; end if;
  if attempt_row.order_status='created' then update public.learning_orders set status='payment_pending' where id=attempt_row.order_id; end if;
  if attempt_row.order_status not in ('created','payment_pending') then update public.learning_payment_provider_events set processing_status='failed',processed_at=now(),processing_error='Order is not payable' where id=event_key; return query select 'order_not_payable',attempt_row.order_id,null::bigint; return; end if;
  update public.learning_payment_attempts set status='succeeded',verified_at=now(),failed_at=null,failure_code=null,failure_message=null,provider_transaction_id=p_provider_transaction_id where id=attempt_row.attempt_id;
  update public.learning_orders set status='paid',paid_at=now(),cancelled_at=null where id=attempt_row.order_id;
  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description) values(attempt_row.order_id,'payment_capture','NGN','Verified Paystack live-mode course payment') returning id into ledger_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference) values(ledger_key,1,'asset.paystack_receivable',p_amount_minor,'NGN','payment_provider',p_provider_transaction_id),(ledger_key,2,'liability.marketplace_sales_unallocated',-p_amount_minor,'NGN','learning_order',p_reference);
  insert into public.enrollments(learner_id,course_id,status) values(attempt_row.learner_id,attempt_row.course_id,'active') on conflict(learner_id,course_id) do update set status='active',completed_at=null returning id into enrollment_key;
  insert into public.learning_course_entitlements(learner_id,course_id,order_id,enrollment_id,status) values(attempt_row.learner_id,attempt_row.course_id,attempt_row.order_id,enrollment_key,'active');
  update public.learning_payment_provider_events set processing_status='processed',processed_at=now(),processing_error=null where id=event_key;
  return query select 'paid_and_enrolled',attempt_row.order_id,enrollment_key;
end;$function$;

create or replace function public.receive_paystack_live_charge_event(p_provider_event_id text,p_payload_digest text,p_reference text,p_provider_transaction_id text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb)
returns table(outcome text,event_id bigint) language plpgsql security definer set search_path to '' as $function$
declare existing_event public.learning_payment_provider_events%rowtype; attempt_row record; event_key bigint;
begin
  if p_domain<>'live' or p_currency<>'NGN' or p_amount_minor<=0 or p_payload_digest !~ '^[a-f0-9]{64}$' or p_provider_event_id is null or p_provider_transaction_id is null or p_payload is null then raise exception 'Invalid Paystack live event' using errcode='22023'; end if;
  select * into existing_event from public.learning_payment_provider_events where provider='paystack' and provider_event_id=p_provider_event_id for update;
  if found then if existing_event.payload_digest<>p_payload_digest then return query select 'duplicate_payload_mismatch',existing_event.id; else return query select case when existing_event.processing_status='processed' then 'already_processed' else 'already_received' end,existing_event.id; end if; return; end if;
  select a.id payment_attempt_id,a.order_id into attempt_row from public.learning_payment_attempts a where a.provider='paystack' and a.provider_reference=p_reference and a.paystack_domain='live';
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,processing_status,order_id,payment_attempt_id,recovery_status) values('paystack',p_provider_event_id,'charge.success',p_payload_digest,p_payload,true,'received',attempt_row.order_id,attempt_row.payment_attempt_id,'none') returning id into event_key;
  return query select 'received',event_key;
end;$function$;

create or replace function public.process_paystack_live_charge_event(p_event_id bigint)
returns table(outcome text,order_id bigint,enrollment_id bigint) language plpgsql security definer set search_path to '' as $function$
declare event_row public.learning_payment_provider_events%rowtype; result_row record;
begin
  select * into event_row from public.learning_payment_provider_events where id=p_event_id and provider='paystack' for update;
  if not found or event_row.event_type<>'charge.success' or (not event_row.signature_valid and event_row.verification_source<>'provider_api') or event_row.payload->>'domain'<>'live' then raise exception 'Provider event is not eligible for live charge processing' using errcode='22023'; end if;
  update public.learning_payment_provider_events set processing_attempts=processing_attempts+1,last_attempted_at=now(),next_retry_at=null where id=p_event_id;
  select * into result_row from public.finalize_paystack_live_charge(event_row.provider_event_id,event_row.payload_digest,event_row.payload->>'reference',event_row.payload->>'transaction_id',(event_row.payload->>'amount')::bigint,event_row.payload->>'currency',event_row.payload->>'domain',event_row.payload);
  update public.learning_payment_provider_events set recovery_status=case when result_row.outcome in ('paid_and_enrolled','already_processed','already_paid') then 'resolved' when result_row.outcome in ('unknown_reference','amount_mismatch','duplicate_payload_mismatch','detached_order','order_not_payable') then 'manual_review' else 'retryable' end,next_retry_at=case when result_row.outcome in ('paid_and_enrolled','already_processed','already_paid') then null else now()+interval '5 minutes' end where id=p_event_id;
  return query select result_row.outcome,result_row.order_id,result_row.enrollment_id;
end;$function$;

create or replace function public.receive_paystack_live_verified_transaction(p_reference text,p_provider_transaction_id text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb,p_operator_id uuid)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare event_key bigint; attempt_row record; digest text;
begin
  if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_domain<>'live' or p_currency<>'NGN' or p_amount_minor<=0 or p_payload->>'status'<>'success' then raise exception 'Provider verification is not a successful live payment' using errcode='22023'; end if;
  select a.id payment_attempt_id,a.order_id into attempt_row from public.learning_payment_attempts a where a.provider='paystack' and a.provider_reference=p_reference and a.paystack_domain='live';
  if not found then raise exception 'Live payment attempt not found' using errcode='P0002'; end if;
  digest:=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,verification_source,processing_status,order_id,payment_attempt_id,recovery_status) values('paystack','transaction.verify:live:'||p_provider_transaction_id,'charge.success',digest,p_payload,false,'provider_api','received',attempt_row.order_id,attempt_row.payment_attempt_id,'none') on conflict(provider,provider_event_id) do update set received_at=public.learning_payment_provider_events.received_at returning id into event_key;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(p_operator_id,'admin_operator','payment_provider_event.verified_via_api','payment_provider_event',event_key::text,jsonb_build_object('reference',p_reference,'domain','live'));
  return event_key;
end;$function$;

create or replace function public.recover_paystack_live_charge_event(p_event_id bigint,p_operator_id uuid)
returns table(outcome text,order_id bigint,enrollment_id bigint) language plpgsql security definer set search_path to '' as $function$
declare result_row record;
begin
  if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
  select * into result_row from public.process_paystack_live_charge_event(p_event_id);
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(p_operator_id,'admin_operator','payment_provider_event.reprocessed','payment_provider_event',p_event_id::text,jsonb_build_object('outcome',result_row.outcome,'domain','live'));
  return query select result_row.outcome,result_row.order_id,result_row.enrollment_id;
end;$function$;

revoke all on function public.protect_learning_payment_attempt_domain(),public.initialize_paystack_live_learning_order(uuid,bigint),public.mark_paystack_live_learning_attempt_pending(text),public.finalize_paystack_live_charge(text,text,text,text,bigint,text,text,jsonb),public.receive_paystack_live_charge_event(text,text,text,text,bigint,text,text,jsonb),public.process_paystack_live_charge_event(bigint),public.receive_paystack_live_verified_transaction(text,text,bigint,text,text,jsonb,uuid),public.recover_paystack_live_charge_event(bigint,uuid) from public,anon,authenticated;
grant execute on function public.protect_learning_payment_attempt_domain(),public.initialize_paystack_live_learning_order(uuid,bigint),public.mark_paystack_live_learning_attempt_pending(text),public.finalize_paystack_live_charge(text,text,text,text,bigint,text,text,jsonb),public.receive_paystack_live_charge_event(text,text,text,text,bigint,text,text,jsonb),public.process_paystack_live_charge_event(bigint),public.receive_paystack_live_verified_transaction(text,text,bigint,text,text,jsonb,uuid),public.recover_paystack_live_charge_event(bigint,uuid) to postgres,service_role;
