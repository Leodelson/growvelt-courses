-- Phase 1B3B live-domain isolation. Runs only in the isolated local database.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('16000000-0000-4000-a000-000000000001','authenticated','authenticated','learner@phase1b3b.invalid','',now(),'{}','{"full_name":"Live learner"}',now(),now()),
('16000000-0000-4000-a000-000000000004','authenticated','authenticated','test-learner@phase1b3b.invalid','',now(),'{}','{"full_name":"Test learner"}',now(),now()),
('16000000-0000-4000-a000-000000000005','authenticated','authenticated','refund-learner@phase1b3b.invalid','',now(),'{}','{"full_name":"Live refund learner"}',now(),now()),
('16000000-0000-4000-a000-000000000002','authenticated','authenticated','instructor@phase1b3b.invalid','',now(),'{}','{"full_name":"Live instructor"}',now(),now()),
('16000000-0000-4000-a000-000000000003','authenticated','authenticated','admin@phase1b3b.invalid','',now(),'{}','{"full_name":"Live admin"}',now(),now());
insert into public.account_capabilities(user_id,capability,status) values
('16000000-0000-4000-a000-000000000002','instructor','active'),
('16000000-0000-4000-a000-000000000003','admin','active');
insert into public.instructor_profiles(user_id,approval_status,headline,bio,expertise,country,reviewed_at,reviewed_by)
values('16000000-0000-4000-a000-000000000002','approved','Live instructor','Local live-domain test',array['Testing'],'Nigeria',now(),'16000000-0000-4000-a000-000000000003');
insert into public.learning_courses(instructor_id,title,slug,summary,description,category,level,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('16000000-0000-4000-a000-000000000002','[TEST] Phase 1B3B live domain','phase1b3b-live-domain','Test','Test','Testing','Beginner',false,100,'NGN',false,'published',now()) returning id \gset live_course_
insert into public.course_rights_declarations(course_id,instructor_id,declaration_version,rights_basis)
values(:live_course_id,'16000000-0000-4000-a000-000000000002','2026-08-v1','original');

select * from public.initialize_paystack_live_learning_order('16000000-0000-4000-a000-000000000001',:live_course_id) \gset live_
select public.mark_paystack_live_learning_attempt_pending(:'live_order_reference');
select set_config('phase1b3b.live_order_id',:live_order_id::text,true);
select set_config('phase1b3b.live_reference',:'live_order_reference',true);

-- A test-domain finalizer cannot attach to or mutate a live attempt.
do $test$
declare blocked boolean:=false;
begin
  begin
    perform * from public.finalize_paystack_test_charge('charge.success:160001',repeat('a',64),current_setting('phase1b3b.live_reference'),'160001',10000,'NGN','test',jsonb_build_object('transaction_id','160001','reference',current_setting('phase1b3b.live_reference'),'amount',10000,'currency','NGN','domain','test','status','success'));
  exception when others then blocked:=true;
  end;
  if not blocked then raise exception 'Test event was allowed to target a live attempt'; end if;
  if not exists(select 1 from public.learning_orders where id=current_setting('phase1b3b.live_order_id')::bigint and status='payment_pending') then raise exception 'Cross-domain test event changed live order'; end if;
end $test$;

select * from public.receive_paystack_live_charge_event('charge.success:live:160001',repeat('b',64),:'live_order_reference','160001',10000,'NGN','live',jsonb_build_object('transaction_id','160001','reference',:'live_order_reference','amount',10000,'currency','NGN','domain','live','status','success')) \gset live_receipt_
select * from public.process_paystack_live_charge_event(:live_receipt_event_id);
select * from public.process_paystack_live_charge_event(:live_receipt_event_id);
do $test$
declare live_order bigint:=current_setting('phase1b3b.live_order_id')::bigint;
begin
  if not exists(select 1 from public.learning_orders where id=live_order and status='paid') then raise exception 'Live success did not pay order'; end if;
  if not exists(select 1 from public.learning_payment_attempts where order_id=live_order and paystack_domain='live' and status='succeeded') then raise exception 'Live attempt did not retain live domain'; end if;
  if (select count(*) from public.learning_ledger_transactions where order_id=live_order and transaction_type='payment_capture')<>1 then raise exception 'Live capture ledger is not exactly once'; end if;
  if (select count(*) from public.learning_ledger_entries e join public.learning_ledger_transactions t on t.id=e.transaction_id where t.order_id=live_order and t.transaction_type='payment_capture')<>2 then raise exception 'Live capture ledger is not balanced pair'; end if;
  if not exists(select 1 from public.learning_course_entitlements where order_id=live_order and status='active') then raise exception 'Live success lacked entitlement'; end if;
  if not exists(select 1 from public.enrollments e join public.learning_course_entitlements x on x.enrollment_id=e.id where x.order_id=live_order and e.status='active') then raise exception 'Live success lacked enrollment'; end if;
  if has_function_privilege('authenticated','public.initialize_paystack_live_learning_order(uuid,bigint)','execute') or has_function_privilege('anon','public.receive_paystack_live_charge_event(text,text,text,text,bigint,text,text,jsonb)','execute') or has_function_privilege('authenticated','public.fail_paystack_live_learning_attempt(text,text,text)','execute') then raise exception 'Browser roles can invoke live financial mutation'; end if;
end $test$;

-- Live disputes are isolated and create the same audited chargeback/access
-- reversal as Test, but only from a matching Live provider event.
select * from public.receive_paystack_live_dispute_event(
  'charge.dispute.create:live:960001',repeat('d',64),'charge.dispute.create',:'live_order_reference','960001',
  'awaiting-merchant-feedback',null,10000,'NGN','live','chargeback','[TEST] local live dispute',now()+interval '7 days',
  jsonb_build_object('dispute_id','960001','transaction_reference',:'live_order_reference','amount',10000,'currency','NGN','domain','live','status','awaiting-merchant-feedback','resolution',null,'due_at',now()+interval '7 days')) \gset live_dispute_open_
select * from public.process_paystack_live_dispute_event(:live_dispute_open_event_id);
select * from public.receive_paystack_live_dispute_event(
  'charge.dispute.resolve:live:960001:merchant-accepted',repeat('e',64),'charge.dispute.resolve',:'live_order_reference','960001',
  'resolved','merchant-accepted',10000,'NGN','live','chargeback','[TEST] local live dispute resolved',null,
  jsonb_build_object('dispute_id','960001','transaction_reference',:'live_order_reference','amount',10000,'currency','NGN','domain','live','status','resolved','resolution','merchant-accepted')) \gset live_dispute_resolved_
select * from public.process_paystack_live_dispute_event(:live_dispute_resolved_event_id);
do $test$
begin
  if not exists(select 1 from public.learning_orders where id=current_setting('phase1b3b.live_order_id')::bigint and status='chargeback') then raise exception 'Live dispute loss did not mark order chargeback'; end if;
  if not exists(select 1 from public.learning_payment_cases c join public.learning_payment_attempts a on a.id=c.payment_attempt_id where c.order_id=current_setting('phase1b3b.live_order_id')::bigint and c.case_type='chargeback' and c.status='lost' and a.paystack_domain='live') then raise exception 'Live dispute case was not domain-bound'; end if;
  if (select count(*) from public.learning_ledger_transactions where order_id=current_setting('phase1b3b.live_order_id')::bigint and transaction_type='chargeback')<>1 then raise exception 'Live dispute reversal was not exactly once'; end if;
  if exists(select 1 from public.learning_course_entitlements where order_id=current_setting('phase1b3b.live_order_id')::bigint and status='active') then raise exception 'Live dispute retained active entitlement'; end if;
end $test$;

-- Live full refund initiation, provider verification and recovery are bound to
-- the Live attempt and reverse only after an authoritative processed result.
select * from public.initialize_paystack_live_learning_order('16000000-0000-4000-a000-000000000005',:live_course_id) \gset live_refund_order_
select public.mark_paystack_live_learning_attempt_pending(:'live_refund_order_order_reference');
select * from public.receive_paystack_live_charge_event('charge.success:live:160002',repeat('f',64),:'live_refund_order_order_reference','160002',10000,'NGN','live',jsonb_build_object('transaction_id','160002','reference',:'live_refund_order_order_reference','amount',10000,'currency','NGN','domain','live','status','success')) \gset live_refund_charge_
select * from public.process_paystack_live_charge_event(:live_refund_charge_event_id);
select * from public.request_paystack_live_full_refund(:'live_refund_order_order_reference','16000000-0000-4000-a000-000000000003','16000000-0000-4000-a000-000000000050',:'live_refund_order_order_reference','customer_request','[TEST] local live full refund') \gset live_refund_case_
select public.mark_paystack_live_refund_submitting(:live_refund_case_case_id,'16000000-0000-4000-a000-000000000003');
select public.record_paystack_live_refund_submission(:live_refund_case_case_id,'970001','pending','refund-live-970001','16000000-0000-4000-a000-000000000003');
select public.receive_paystack_live_verified_refund(:live_refund_case_case_id,'970001','processed','refund-live-970001',10000,'NGN','live',
  jsonb_build_object('id',970001,'transaction',jsonb_build_object('id',160002,'reference',:'live_refund_order_order_reference'),'transaction_reference',:'live_refund_order_order_reference','amount',10000,'currency','NGN','domain','live','status','processed','refund_reference','refund-live-970001'),
  '16000000-0000-4000-a000-000000000003') as event_id \gset live_refund_verified_
select * from public.recover_paystack_live_refund_event(:live_refund_verified_event_id,'16000000-0000-4000-a000-000000000003');
select set_config('phase1b3b.live_refund_order_id',:live_refund_order_order_id::text,true);
do $test$
begin
  if not exists(select 1 from public.learning_orders where id=current_setting('phase1b3b.live_refund_order_id')::bigint and status='refunded') then raise exception 'Live refund did not update order'; end if;
  if (select count(*) from public.learning_ledger_transactions where order_id=current_setting('phase1b3b.live_refund_order_id')::bigint and transaction_type='refund')<>1 then raise exception 'Live refund ledger was not exactly once'; end if;
  if (select count(*) from public.learning_ledger_entries e join public.learning_ledger_transactions t on t.id=e.transaction_id where t.order_id=current_setting('phase1b3b.live_refund_order_id')::bigint and t.transaction_type='refund')<>2 then raise exception 'Live refund ledger is not balanced pair'; end if;
  if not exists(select 1 from public.learning_course_entitlements where order_id=current_setting('phase1b3b.live_refund_order_id')::bigint and status='refunded') then raise exception 'Live refund did not revoke entitlement'; end if;
  if has_function_privilege('authenticated','public.request_paystack_live_full_refund(text,uuid,uuid,text,text,text)','execute') or has_function_privilege('anon','public.process_paystack_live_refund_event(bigint)','execute') then raise exception 'Browser roles can invoke live refund mutation'; end if;
end $test$;

-- Initialization failures only close a matching Live attempt and order.
select * from public.initialize_paystack_live_learning_order('16000000-0000-4000-a000-000000000004',:live_course_id) \gset failed_
select public.mark_paystack_live_learning_attempt_pending(:'failed_order_reference');
select public.fail_paystack_live_learning_attempt(:'failed_order_reference','provider_unavailable','[TEST] local initialization failure');
select set_config('phase1b3b.failed_reference', :'failed_order_reference', true);
do $test$
begin
  if not exists(select 1 from public.learning_orders where order_reference=current_setting('phase1b3b.failed_reference') and status='cancelled') then raise exception 'Failed live initialization did not cancel its pending order'; end if;
  if not exists(select 1 from public.learning_payment_attempts where provider_reference=current_setting('phase1b3b.failed_reference') and paystack_domain='live' and status='failed' and failure_code='provider_unavailable') then raise exception 'Failed live initialization did not fail its live attempt'; end if;
end $test$;

-- Even a direct Live initializer call cannot charge the Test-only fixture.
insert into public.learning_paystack_test_fixtures(course_id,tester_id,expires_at,activated_by)
values(:live_course_id,'16000000-0000-4000-a000-000000000004',now()+interval '1 day','16000000-0000-4000-a000-000000000003');
select set_config('phase1b3b.fixture_course_id', :'live_course_id', true);
do $test$
declare blocked boolean:=false;
begin
  begin
    perform * from public.initialize_paystack_live_learning_order('16000000-0000-4000-a000-000000000001',current_setting('phase1b3b.fixture_course_id')::bigint);
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Live initializer accepted the controlled Test Mode fixture'; end if;
end $test$;

-- A live event for a test attempt remains detached and cannot finalize it.
insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
values('16000000-0000-4000-a000-000000000004',:live_course_id,'16000000-0000-4000-a000-000000000002','[TEST] Phase 1B3B live domain','Live instructor',10000,'NGN','payment_pending','phase1b3b-test-v1') returning id,order_reference \gset test_
insert into public.learning_payment_attempts(order_id,provider,provider_reference,amount_minor,currency,status,paystack_domain)
values(:test_id,'paystack',:'test_order_reference',10000,'NGN','pending','test');
select set_config('phase1b3b.test_order_id',:test_id::text,true);
select * from public.receive_paystack_live_charge_event('charge.success:live:160002',repeat('c',64),:'test_order_reference','160002',10000,'NGN','live',jsonb_build_object('transaction_id','160002','reference',:'test_order_reference','amount',10000,'currency','NGN','domain','live','status','success')) \gset detached_
select * from public.process_paystack_live_charge_event(:detached_event_id);
do $test$
begin
  if not exists(select 1 from public.learning_orders where id=current_setting('phase1b3b.test_order_id')::bigint and status='payment_pending') then raise exception 'Live event finalized test order'; end if;
  if exists(select 1 from public.learning_ledger_transactions where order_id=current_setting('phase1b3b.test_order_id')::bigint) then raise exception 'Live event wrote ledger for test order'; end if;
end $test$;

rollback;
