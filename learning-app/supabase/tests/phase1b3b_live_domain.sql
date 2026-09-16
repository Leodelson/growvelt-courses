-- Phase 1B3B live-domain isolation. Runs only in the isolated local database.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('16000000-0000-4000-a000-000000000001','authenticated','authenticated','learner@phase1b3b.invalid','',now(),'{}','{"full_name":"Live learner"}',now(),now()),
('16000000-0000-4000-a000-000000000004','authenticated','authenticated','test-learner@phase1b3b.invalid','',now(),'{}','{"full_name":"Test learner"}',now(),now()),
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
  if has_function_privilege('authenticated','public.initialize_paystack_live_learning_order(uuid,bigint)','execute') or has_function_privilege('anon','public.receive_paystack_live_charge_event(text,text,text,text,bigint,text,text,jsonb)','execute') then raise exception 'Browser roles can invoke live financial mutation'; end if;
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
