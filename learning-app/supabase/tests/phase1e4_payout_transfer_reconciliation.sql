begin;

do $test$
declare definition text;
begin
  if has_table_privilege('authenticated','public.learning_instructor_payout_provider_events','select')
    or has_table_privilege('authenticated','public.learning_instructor_payout_settlements','insert')
    or has_function_privilege('authenticated','public.process_learning_instructor_payout_provider_event(bigint)','execute') then
    raise exception 'Browser role can access privileged payout reconciliation state';
  end if;
  if has_function_privilege('authenticated','public.reprocess_learning_instructor_payout_provider_event(bigint,uuid)','execute') then
    raise exception 'Browser role can reprocess payout provider events';
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.learning_instructor_payout_settlements'::regclass and contype='u') then
    raise exception 'Payout settlement uniqueness is missing';
  end if;
  select pg_get_functiondef('public.receive_paystack_test_transfer_provider_event(text,text,text,text,text,text,text,bigint,text,uuid)'::regprocedure) into definition;
  if definition not like '%provider_webhook%' or definition not like '%provider_api%' or definition not like '%provider_event_id%' then
    raise exception 'Durable transfer event receipt lacks provenance or idempotency';
  end if;
  select pg_get_functiondef('public.process_learning_instructor_payout_provider_event(bigint)'::regprocedure) into definition;
  if definition not like '%for update%' or definition not like '%share row exclusive%' or definition not like '%instructor_payout_settlement%' or definition not like '%settled_payout_reversed_requires_controlled_resolution%' or definition not like '%resolve_learning_instructor_payout_findings%' then
    raise exception 'Payout finalization lost locking, settlement, or reversal safeguards';
  end if;
  if definition not like '%status=''paid''%' or definition not like '%status=''available'',reserved_at=null%' or definition not like '%ev.provider_status=''pending''%' then
    raise exception 'Success settlement or safe failed-reservation release is missing';
  end if;
end $test$;

-- Rollback-only lifecycle fixtures.  They exercise the authoritative E4
-- processor with deterministic local rows; no provider request is made.
create function pg_temp.phase1e4_submitting_item(p_suffix text,p_admin uuid,p_instructor uuid,p_course_id bigint)
returns table(payout_item_id bigint,payout_item_reference text,earning_id bigint,reservation_id bigint,order_id bigint,amount_minor bigint)
language plpgsql as $function$
declare allocation_key bigint; earning_key bigint; reservation_key bigint; item_key bigint; reference_key text; order_key bigint; capture_key bigint;
begin
  insert into public.learning_orders(instructor_id,course_id,course_title_snapshot,gross_amount_minor,currency,status,commercial_terms_version,paid_at)
  values(p_instructor,p_course_id,'Phase 1E4 fixture '||p_suffix,10000,'NGN','paid','growvelt-commercial-v1',now()-interval '15 days') returning id into order_key;
  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description)
  values(order_key,'payment_capture','NGN','Phase 1E4 rollback-only fixture') returning id into capture_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency) values
    (capture_key,1,'asset.paystack_receivable',10000,'NGN'),
    (capture_key,2,'liability.marketplace_sales_unallocated',-10000,'NGN');
  allocation_key:=public.allocate_learning_order_commercial_terms(order_key,null);
  perform public.release_matured_learning_instructor_earnings(100,null);
  select id into earning_key from public.learning_instructor_earnings where allocation_id=allocation_key and status='available';
  select reserved.reservation_id into reservation_key from public.reserve_learning_instructor_earning(earning_key,p_instructor,'phase1e4:reserve:'||p_suffix,p_admin) reserved;
  select item.payout_item_id,item.payout_item_reference into item_key,reference_key from public.approve_learning_instructor_payout_item(reservation_key,'phase1e4:approve:'||p_suffix,p_admin) item;
  perform public.begin_learning_instructor_test_transfer(item_key,p_admin);
  return query select item_key,reference_key,earning_key,reservation_key,order_key,7500::bigint;
end;$function$;

do $lifecycle$
declare
  admin_id uuid:='88888888-8888-4888-8888-888888888881';
  instructor_id uuid:='88888888-8888-4888-8888-888888888882';
  course_id bigint; fixture record; event_id bigint; settlement_count bigint; ledger_count bigint; finding_count bigint; duplicate_outcome text; duplicate_findings bigint;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (admin_id,'authenticated','authenticated','phase1e4-admin@example.test',now(),now()),
    (instructor_id,'authenticated','authenticated','phase1e4-instructor@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (admin_id,'phase1e4-admin@example.test','Phase 1E4 Admin','complete'),
    (instructor_id,'phase1e4-instructor@example.test','Phase 1E4 Instructor','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (admin_id,'admin','active'),(instructor_id,'instructor','active') on conflict(user_id,capability) do nothing;
  insert into public.instructor_profiles(user_id,approval_status) values(instructor_id,'approved') on conflict(user_id) do nothing;
  insert into public.learning_courses(instructor_id,title,slug,price_amount,price_currency,is_free,is_limited_time_free,status)
  values(instructor_id,'Phase 1E4 payout reconciliation course','phase1e4-payout-reconciliation-course',100,'NGN',false,false,'draft') on conflict(slug) do nothing;
  select id into course_id from public.learning_courses where slug='phase1e4-payout-reconciliation-course';
  perform public.create_learning_instructor_paystack_test_payout_profile(instructor_id,'RCP_phase1e4test','910004','058','Test Bank','Phase 1E4 Instructor','0004',instructor_id);

  -- Success settles exactly once.  A repeated receipt is retained idempotently
  -- and a provider-API observation cannot duplicate the economics.
  select * into fixture from pg_temp.phase1e4_submitting_item('success',admin_id,instructor_id,course_id);
  select provider_event_id into event_id from public.receive_paystack_test_transfer_provider_event('provider_webhook','phase1e4-success-event',repeat('a',64),fixture.payout_item_reference,'900001','TRF_phase1e4success','succeeded',fixture.amount_minor,'NGN',null);
  if not exists(select 1 from public.learning_instructor_payout_provider_events where id=event_id)
    or exists(select 1 from public.learning_instructor_payout_settlements where payout_item_id=fixture.payout_item_id) then raise exception 'Receipt was not retained before payout processing'; end if;
  perform public.process_learning_instructor_payout_provider_event(event_id);
  perform public.process_learning_instructor_payout_provider_event(event_id);
  if not exists(select 1 from public.learning_instructor_payout_items where id=fixture.payout_item_id and status='succeeded')
    or not exists(select 1 from public.learning_instructor_earnings where id=fixture.earning_id and status='paid') then raise exception 'Success did not settle the authoritative reserved earning'; end if;
  select count(*) into settlement_count from public.learning_instructor_payout_settlements where payout_item_id=fixture.payout_item_id;
  select count(*) into ledger_count from public.learning_ledger_transactions where order_id=fixture.order_id and transaction_type='instructor_payout_settlement';
  if settlement_count<>1 or ledger_count<>1 or (select coalesce(sum(amount_minor),0) from public.learning_ledger_entries where transaction_id=(select ledger_transaction_id from public.learning_instructor_payout_settlements where payout_item_id=fixture.payout_item_id))<>0
    or (select count(*) from public.learning_instructor_earning_events where earning_id=fixture.earning_id and event_type='earning.paid')<>1 then raise exception 'Success created duplicate or unbalanced payout settlement'; end if;
  select provider_event_id into event_id from public.receive_paystack_test_transfer_provider_event('provider_api','provider-api:'||fixture.payout_item_reference||':succeeded:900001',repeat('b',64),fixture.payout_item_reference,'900001','TRF_phase1e4success','succeeded',fixture.amount_minor,'NGN',admin_id);
  perform public.process_learning_instructor_payout_provider_event(event_id);
  if (select count(*) from public.learning_instructor_payout_settlements where payout_item_id=fixture.payout_item_id)<>1 then raise exception 'Webhook/API convergence duplicated settlement'; end if;
  select outcome into duplicate_outcome from public.receive_paystack_test_transfer_provider_event('provider_webhook','phase1e4-success-event',repeat('2',64),fixture.payout_item_reference,'900001','TRF_phase1e4success','succeeded',fixture.amount_minor+1,'NGN',null) limit 1;
  select count(*) into duplicate_findings from public.learning_instructor_payout_reconciliation_findings where payout_item_id=fixture.payout_item_id and finding_type='provider_outcome_conflict';
  if duplicate_outcome<>'duplicate_conflict' or duplicate_findings<>1 then raise exception 'Conflicting duplicate receipt was not retained without changing settlement (outcome %, findings %)',duplicate_outcome,duplicate_findings; end if;

  -- A normal failed transfer releases only an unprotected reservation and
  -- never creates a settlement.
  select * into fixture from pg_temp.phase1e4_submitting_item('failed',admin_id,instructor_id,course_id);
  select provider_event_id into event_id from public.receive_paystack_test_transfer_provider_event('provider_webhook','phase1e4-failed-event',repeat('c',64),fixture.payout_item_reference,'900002','TRF_phase1e4failed','failed',fixture.amount_minor,'NGN',null);
  perform public.process_learning_instructor_payout_provider_event(event_id);
  perform public.process_learning_instructor_payout_provider_event(event_id);
  if not exists(select 1 from public.learning_instructor_earnings where id=fixture.earning_id and status='available')
    or exists(select 1 from public.learning_instructor_payout_settlements where payout_item_id=fixture.payout_item_id)
    or (select count(*) from public.learning_instructor_earning_events where earning_id=fixture.earning_id and event_type='earning.payout_reservation_released')<>1 then raise exception 'Failed transfer did not release exactly once without settlement'; end if;

  -- Deferred protected failure remains receipt-backed, then the same receipt
  -- is safely reprocessed after the fixture protection reaches a final state.
  select * into fixture from pg_temp.phase1e4_submitting_item('protected-failure',admin_id,instructor_id,course_id);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(fixture.order_id,'refund','processing',10000,'NGN','paystack','phase1e4-protected-refund','processing');
  select provider_event_id into event_id from public.receive_paystack_test_transfer_provider_event('provider_webhook','phase1e4-protected-failed-event',repeat('d',64),fixture.payout_item_reference,'900003','TRF_phase1e4protected','failed',fixture.amount_minor,'NGN',null);
  perform public.process_learning_instructor_payout_provider_event(event_id);
  if not exists(select 1 from public.learning_instructor_earnings where id=fixture.earning_id and status='reserved') then raise exception 'Protected failed transfer released reserved earning'; end if;
  perform public.reprocess_learning_instructor_payout_provider_event(event_id,admin_id);
  if (select count(*) from public.learning_instructor_earning_events where earning_id=fixture.earning_id and event_type='earning.payout_reservation_released')<>0 then raise exception 'Protected receipt reprocess mutated earning'; end if;
  update public.learning_payment_cases set status='failed',resolved_at=now() where provider_case_id='phase1e4-protected-refund';
  perform public.reprocess_learning_instructor_payout_provider_event(event_id,admin_id);
  perform public.reprocess_learning_instructor_payout_provider_event(event_id,admin_id);
  if not exists(select 1 from public.learning_instructor_earnings where id=fixture.earning_id and status='available')
    or (select count(*) from public.learning_instructor_earning_events where earning_id=fixture.earning_id and event_type='earning.payout_reservation_released')<>1 then raise exception 'Deferred failed receipt did not release exactly once after protection cleared'; end if;

  -- Reversal before settlement retains the reservation; reversal after a
  -- settlement retains immutable economics and opens exactly one finding.
  select * into fixture from pg_temp.phase1e4_submitting_item('reversed-before',admin_id,instructor_id,course_id);
  select provider_event_id into event_id from public.receive_paystack_test_transfer_provider_event('provider_webhook','phase1e4-reversed-before-event',repeat('e',64),fixture.payout_item_reference,'900004','TRF_phase1e4before','reversed',fixture.amount_minor,'NGN',null);
  perform public.process_learning_instructor_payout_provider_event(event_id);
  if not exists(select 1 from public.learning_instructor_payout_items where id=fixture.payout_item_id and status='reversed')
    or not exists(select 1 from public.learning_instructor_earnings where id=fixture.earning_id and status='reserved')
    or exists(select 1 from public.learning_instructor_payout_settlements where payout_item_id=fixture.payout_item_id) then raise exception 'Pre-settlement reversal changed protected financial state'; end if;

  select * into fixture from pg_temp.phase1e4_submitting_item('reversed-after',admin_id,instructor_id,course_id);
  select provider_event_id into event_id from public.receive_paystack_test_transfer_provider_event('provider_webhook','phase1e4-reversed-after-success',repeat('f',64),fixture.payout_item_reference,'900005','TRF_phase1e4after','succeeded',fixture.amount_minor,'NGN',null);
  perform public.process_learning_instructor_payout_provider_event(event_id);
  select provider_event_id into event_id from public.receive_paystack_test_transfer_provider_event('provider_webhook','phase1e4-reversed-after-event',repeat('1',64),fixture.payout_item_reference,'900005','TRF_phase1e4after','reversed',fixture.amount_minor,'NGN',null);
  perform public.process_learning_instructor_payout_provider_event(event_id);
  perform public.process_learning_instructor_payout_provider_event(event_id);
  select count(*) into finding_count from public.learning_instructor_payout_reconciliation_findings where payout_item_id=fixture.payout_item_id and finding_type='settled_payout_reversed_requires_controlled_resolution';
  if finding_count<>1 or not exists(select 1 from public.learning_instructor_payout_items where id=fixture.payout_item_id and status='reversed')
    or (select count(*) from public.learning_instructor_payout_settlements where payout_item_id=fixture.payout_item_id)<>1
    or exists(select 1 from public.learning_instructor_earnings where id=fixture.earning_id and status='recoverable') then raise exception 'Post-settlement reversal was not retained for controlled resolution'; end if;
end $lifecycle$;

-- The role checks execute against the same database privileges used by the
-- browser. True multi-session contention requires the dedicated external
-- runner; the settlement/reservation unique keys and FOR UPDATE locks are
-- asserted by the executable lifecycle above and by the application suite.
set local role authenticated;
do $browser$
begin
  begin perform public.process_learning_instructor_payout_provider_event(1); raise exception 'Browser finalized a payout'; exception when insufficient_privilege then null; end;
  begin perform public.reprocess_learning_instructor_payout_provider_event(1,'88888888-8888-4888-8888-888888888881'); raise exception 'Browser reprocessed a receipt'; exception when insufficient_privilege then null; end;
  begin insert into public.learning_instructor_payout_provider_events(provenance,provider_event_id,payout_item_reference,provider_transfer_id,provider_status,amount_minor,currency) values('provider_webhook','browser-phase1e4','lpi-reservation-browser','1','failed',1,'NGN'); raise exception 'Browser inserted provider receipt'; exception when insufficient_privilege then null; end;
end $browser$;
reset role;

rollback;
