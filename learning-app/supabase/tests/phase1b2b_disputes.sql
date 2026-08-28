-- Phase 1B2B dispute/chargeback regression suite. Isolated local database only.
begin;
insert into auth.users(id,aud,role,email,encrypted_password,confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('15000000-0000-4000-a000-000000000001','authenticated','authenticated','learner@phase1b2b.invalid','',now(),'{}','{"full_name":"Dispute Learner"}',now(),now()),
('15000000-0000-4000-a000-000000000002','authenticated','authenticated','instructor@phase1b2b.invalid','',now(),'{}','{"full_name":"Dispute Instructor"}',now(),now()),
('15000000-0000-4000-a000-000000000003','authenticated','authenticated','admin@phase1b2b.invalid','',now(),'{}','{"full_name":"Dispute Admin"}',now(),now());
insert into public.account_capabilities(user_id,capability,status) values('15000000-0000-4000-a000-000000000002','instructor','active'),('15000000-0000-4000-a000-000000000003','admin','active');
insert into public.instructor_profiles(user_id,approval_status,headline,bio,expertise,country,reviewed_at,reviewed_by) values('15000000-0000-4000-a000-000000000002','approved','Dispute instructor','Local test',array['Testing'],'Nigeria',now(),'15000000-0000-4000-a000-000000000003');
insert into public.learning_courses(instructor_id,title,slug,summary,description,category,level,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('15000000-0000-4000-a000-000000000002','[TEST] Phase 1B2B Dispute','phase1b2b-dispute','Test','Test','Testing','Beginner',false,100,'NGN',false,'published',now()) returning id \gset dispute_course_
insert into public.course_modules(course_id,title,position) values(:dispute_course_id,'Dispute history',1) returning id \gset dispute_module_
insert into public.lessons(course_id,module_id,title,lesson_type,content,position) values(:dispute_course_id,:dispute_module_id,'Historical lesson','text','Must survive chargeback',1) returning id \gset dispute_lesson_

-- Two independently paid orders prove won and lost outcomes.
insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
values('15000000-0000-4000-a000-000000000001',:dispute_course_id,'15000000-0000-4000-a000-000000000002','[TEST] Phase 1B2B Dispute','Dispute Instructor',10000,'NGN','payment_pending','phase1b2b-test-v1') returning id,order_reference \gset won_order_
insert into public.learning_payment_attempts(order_id,provider,provider_reference,provider_transaction_id,amount_minor,currency,status) values(:won_order_id,'paystack',:'won_order_order_reference','150001',10000,'NGN','pending');
select * from public.finalize_paystack_test_charge('charge.success:150001',repeat('a',64),:'won_order_order_reference','150001',10000,'NGN','test',jsonb_build_object('transaction_id','150001','reference',:'won_order_order_reference','amount',10000,'currency','NGN','domain','test','status','success'));
select set_config('phase1b2b.won_order_id',:won_order_id::text,true);

select * from public.receive_paystack_test_dispute_event('charge.dispute.create:9001',repeat('b',64),'charge.dispute.create',:'won_order_order_reference','9001','awaiting-merchant-feedback',null,10000,'NGN','test','general','Customer claim',now()+interval '2 days',jsonb_build_object('dispute_id','9001','transaction_reference',:'won_order_order_reference','amount',10000,'currency','NGN','domain','test','status','awaiting-merchant-feedback','resolution',null,'due_at',now()+interval '2 days')) \gset won_create_
select * from public.process_paystack_test_dispute_event(:won_create_event_id);
select * from public.receive_paystack_test_dispute_event('charge.dispute.create:9001',repeat('b',64),'charge.dispute.create',:'won_order_order_reference','9001','awaiting-merchant-feedback',null,10000,'NGN','test','general','Customer claim',now()+interval '2 days',jsonb_build_object('dispute_id','9001','transaction_reference',:'won_order_order_reference','amount',10000,'currency','NGN','domain','test','status','awaiting-merchant-feedback','resolution',null,'due_at',now()+interval '2 days'));
select * from public.receive_paystack_test_dispute_event('charge.dispute.remind:9001',repeat('c',64),'charge.dispute.remind',:'won_order_order_reference','9001','awaiting-merchant-feedback',null,10000,'NGN','test','general','Reminder',now()+interval '12 hours',jsonb_build_object('dispute_id','9001','transaction_reference',:'won_order_order_reference','amount',10000,'currency','NGN','domain','test','status','awaiting-merchant-feedback','resolution',null,'due_at',now()+interval '12 hours')) \gset won_remind_
select * from public.process_paystack_test_dispute_event(:won_remind_event_id);
select * from public.receive_paystack_test_dispute_event('charge.dispute.resolve:9001',repeat('d',64),'charge.dispute.resolve',:'won_order_order_reference','9001','resolved','declined',10000,'NGN','test','general','Merchant prevailed',null,jsonb_build_object('dispute_id','9001','transaction_reference',:'won_order_order_reference','amount',10000,'currency','NGN','domain','test','status','resolved','resolution','declined')) \gset won_resolve_
select * from public.process_paystack_test_dispute_event(:won_resolve_event_id);

do $won$
begin
 if not exists(select 1 from public.learning_payment_cases where provider_case_id='9001' and status='won') then raise exception 'Won dispute not resolved'; end if;
 if exists(select 1 from public.learning_ledger_transactions where order_id=current_setting('phase1b2b.won_order_id')::bigint and transaction_type='chargeback') then raise exception 'Won dispute reversed money'; end if;
 if not exists(select 1 from public.learning_orders where id=current_setting('phase1b2b.won_order_id')::bigint and status='paid') then raise exception 'Won dispute changed paid order'; end if;
 if not exists(select 1 from public.learning_course_entitlements where order_id=current_setting('phase1b2b.won_order_id')::bigint and status='active') then raise exception 'Won dispute revoked access'; end if;
end;$won$;

-- A second learner avoids the unique learner/course entitlement relationship.
insert into auth.users(id,aud,role,email,encrypted_password,confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('15000000-0000-4000-a000-000000000004','authenticated','authenticated','learner2@phase1b2b.invalid','',now(),'{}','{"full_name":"Dispute Learner Two"}',now(),now());
insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
values('15000000-0000-4000-a000-000000000004',:dispute_course_id,'15000000-0000-4000-a000-000000000002','[TEST] Phase 1B2B Dispute','Dispute Instructor',10000,'NGN','payment_pending','phase1b2b-test-v1') returning id,order_reference \gset lost_order_
insert into public.learning_payment_attempts(order_id,provider,provider_reference,provider_transaction_id,amount_minor,currency,status) values(:lost_order_id,'paystack',:'lost_order_order_reference','150002',10000,'NGN','pending');
select * from public.finalize_paystack_test_charge('charge.success:150002',repeat('e',64),:'lost_order_order_reference','150002',10000,'NGN','test',jsonb_build_object('transaction_id','150002','reference',:'lost_order_order_reference','amount',10000,'currency','NGN','domain','test','status','success'));
select set_config('phase1b2b.lost_order_id',:lost_order_id::text,true);
select set_config('phase1b2b.won_order_reference',:'won_order_order_reference',true);
select set_config('phase1b2b.lost_order_reference',:'lost_order_order_reference',true);
select id as enrollment_id from public.enrollments where learner_id='15000000-0000-4000-a000-000000000004' and course_id=:dispute_course_id \gset lost_enrollment_
select set_config('phase1b2b.lost_enrollment_id',:lost_enrollment_enrollment_id::text,true);
insert into public.lesson_progress(enrollment_id,lesson_id,completed_at,progress_percent) values(:lost_enrollment_enrollment_id,:dispute_lesson_id,now(),100);
select set_config('phase1b2b.dispute_lesson_id',:dispute_lesson_id::text,true);
select * from public.receive_paystack_test_dispute_event('charge.dispute.create:9002',repeat('f',64),'charge.dispute.create',:'lost_order_order_reference','9002','awaiting-bank-feedback',null,10000,'NGN','test','general','Bank claim',null,jsonb_build_object('dispute_id','9002','transaction_reference',:'lost_order_order_reference','amount',10000,'currency','NGN','domain','test','status','awaiting-bank-feedback','resolution',null)) \gset lost_create_
select * from public.process_paystack_test_dispute_event(:lost_create_event_id);
select * from public.receive_paystack_test_dispute_event('charge.dispute.resolve:9002',repeat('1',64),'charge.dispute.resolve',:'lost_order_order_reference','9002','resolved','merchant-accepted',10000,'NGN','test','general','Merchant accepted',null,jsonb_build_object('dispute_id','9002','transaction_reference',:'lost_order_order_reference','amount',10000,'currency','NGN','domain','test','status','resolved','resolution','merchant-accepted')) \gset lost_resolve_
select * from public.process_paystack_test_dispute_event(:lost_resolve_event_id);
select * from public.process_paystack_test_dispute_event(:lost_resolve_event_id);

do $lost$
declare ledger_id bigint; blocked boolean:=false; refund_blocked boolean:=false;
begin
 if not exists(select 1 from public.learning_orders where id=current_setting('phase1b2b.lost_order_id')::bigint and status='chargeback') then raise exception 'Lost dispute did not mark order chargeback'; end if;
 if not exists(select 1 from public.learning_payment_cases where provider_case_id='9002' and status='lost') then raise exception 'Lost dispute case missing'; end if;
 select id into ledger_id from public.learning_ledger_transactions where order_id=current_setting('phase1b2b.lost_order_id')::bigint and transaction_type='chargeback';
 if ledger_id is null or (select count(*) from public.learning_ledger_entries where transaction_id=ledger_id)<>2 or (select sum(amount_minor) from public.learning_ledger_entries where transaction_id=ledger_id)<>0 then raise exception 'Chargeback ledger not exactly balanced'; end if;
 if not exists(select 1 from public.learning_course_entitlements where order_id=current_setting('phase1b2b.lost_order_id')::bigint and status='chargeback' and revoked_at is not null) then raise exception 'Lost dispute retained entitlement'; end if;
 if not exists(select 1 from public.enrollments where id=current_setting('phase1b2b.lost_enrollment_id')::bigint and status='cancelled') then raise exception 'Lost dispute retained enrollment'; end if;
 if not exists(select 1 from public.lesson_progress where enrollment_id=current_setting('phase1b2b.lost_enrollment_id')::bigint and lesson_id=current_setting('phase1b2b.dispute_lesson_id')::bigint and progress_percent=100) then raise exception 'Chargeback deleted learning history'; end if;
 if (select count(*) from public.learning_ledger_transactions where order_id=current_setting('phase1b2b.lost_order_id')::bigint and transaction_type='chargeback')<>1 then raise exception 'Duplicate chargeback ledger'; end if;
 begin perform public.finalize_paystack_test_chargeback((select id from public.learning_payment_cases where provider_case_id='9001'),null,'webhook',null); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Won dispute could be reversed'; end if;
 begin perform public.request_paystack_test_full_refund(current_setting('phase1b2b.lost_order_reference'),'15000000-0000-4000-a000-000000000003','15000000-0000-4000-a000-000000000099',current_setting('phase1b2b.lost_order_reference'),'exceptional_admin_refund','Must not refund a chargeback order'); exception when others then refund_blocked:=true; end;
 if not refund_blocked then raise exception 'Chargeback order accepted a second refund reversal'; end if;
 if exists(select 1 from public.reconcile_paystack_test_disputes() where order_reference in(current_setting('phase1b2b.won_order_reference'),current_setting('phase1b2b.lost_order_reference'))) then raise exception 'Healthy disputes failed reconciliation'; end if;
end;$lost$;

set local role authenticated;
do $grants$ begin
 if has_function_privilege('authenticated','public.receive_paystack_test_dispute_event(text,text,text,text,text,text,text,bigint,text,text,text,text,timestamptz,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.finalize_paystack_test_chargeback(bigint,bigint,text,uuid)','EXECUTE')
 or has_function_privilege('authenticated','public.receive_paystack_test_verified_dispute(bigint,text,text,bigint,text,text,text,text,timestamptz,jsonb,uuid)','EXECUTE')
 then raise exception 'Browser role can mutate disputes'; end if;
end;$grants$;
reset role;
rollback;
