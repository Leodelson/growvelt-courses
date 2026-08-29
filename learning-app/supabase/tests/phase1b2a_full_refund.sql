-- Phase 1B2A full-refund regression suite. Isolated local database only.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('14000000-0000-4000-a000-000000000001','authenticated','authenticated','learner@phase1b2a.invalid','',now(),'{}','{"full_name":"Refund Learner"}',now(),now()),
('14000000-0000-4000-a000-000000000002','authenticated','authenticated','instructor@phase1b2a.invalid','',now(),'{}','{"full_name":"Refund Instructor"}',now(),now()),
('14000000-0000-4000-a000-000000000003','authenticated','authenticated','admin@phase1b2a.invalid','',now(),'{}','{"full_name":"Refund Admin"}',now(),now());
insert into public.account_capabilities(user_id,capability,status) values
('14000000-0000-4000-a000-000000000002','instructor','active'),('14000000-0000-4000-a000-000000000003','admin','active');
insert into public.instructor_profiles(user_id,approval_status,headline,bio,expertise,country,reviewed_at,reviewed_by)
values('14000000-0000-4000-a000-000000000002','approved','Refund instructor','Local refund test',array['Testing'],'Nigeria',now(),'14000000-0000-4000-a000-000000000003');
insert into public.learning_courses(instructor_id,title,slug,summary,description,category,level,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('14000000-0000-4000-a000-000000000002','[TEST] Phase 1B2A Refund','phase1b2a-full-refund','Refund test','Local refund test course','Testing','Beginner',false,100,'NGN',false,'published',now()) returning id \gset refund_course_
insert into public.course_modules(course_id,title,position) values(:refund_course_id,'Refund history',1) returning id \gset refund_module_
insert into public.lessons(course_id,module_id,title,lesson_type,content,position) values(:refund_course_id,:refund_module_id,'Historical lesson','text','Retained after refund',1) returning id \gset refund_lesson_

insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
values('14000000-0000-4000-a000-000000000001',:refund_course_id,'14000000-0000-4000-a000-000000000002','[TEST] Phase 1B2A Refund','Refund Instructor',10000,'NGN','payment_pending','phase1b2a-test-v1') returning id,order_reference \gset refund_order_
insert into public.learning_payment_attempts(order_id,provider,provider_reference,provider_transaction_id,amount_minor,currency,status,verified_at)
values(:refund_order_id,'paystack',:'refund_order_order_reference','140001',10000,'NGN','pending',null);
select * from public.finalize_paystack_test_charge('charge.success:140001',repeat('a',64),:'refund_order_order_reference','140001',10000,'NGN','test',jsonb_build_object('transaction_id','140001','reference',:'refund_order_order_reference','amount',10000,'currency','NGN','domain','test','status','success'));
select id as enrollment_id from public.enrollments where learner_id='14000000-0000-4000-a000-000000000001' and course_id=:refund_course_id \gset refund_enrollment_
insert into public.lesson_progress(enrollment_id,lesson_id,completed_at,progress_percent) values(:refund_enrollment_enrollment_id,:refund_lesson_id,now(),100);
select set_config('phase1b2a.order_id',:refund_order_id::text,true);
select set_config('phase1b2a.order_reference',:'refund_order_order_reference',true);
select set_config('phase1b2a.enrollment_id',:refund_enrollment_enrollment_id::text,true);
select set_config('phase1b2a.lesson_id',:refund_lesson_id::text,true);

create temporary table refund_failed as select * from public.request_paystack_test_full_refund(
  :'refund_order_order_reference','14000000-0000-4000-a000-000000000003','14000000-0000-4000-a000-000000000097',:'refund_order_order_reference','exceptional_admin_refund','Deterministic local provider failure test'
);
select public.mark_paystack_test_refund_submitting((select case_id from refund_failed),'14000000-0000-4000-a000-000000000003');
select public.record_paystack_test_refund_submission((select case_id from refund_failed),null,'failed',null,'14000000-0000-4000-a000-000000000003');
do $failed$
begin
 if not exists(select 1 from public.learning_payment_cases where id=(select case_id from refund_failed) and status='failed' and resolved_at is not null) then raise exception 'Failed refund lifecycle was not retained'; end if;
 if exists(select 1 from public.learning_ledger_transactions where order_id=current_setting('phase1b2a.order_id')::bigint and transaction_type='refund') then raise exception 'Failed refund posted a reversal'; end if;
 if not exists(select 1 from public.learning_course_entitlements where order_id=current_setting('phase1b2a.order_id')::bigint and status='active') then raise exception 'Failed refund revoked access'; end if;
end;$failed$;

create temporary table refund_requested as select * from public.request_paystack_test_full_refund(
  :'refund_order_order_reference','14000000-0000-4000-a000-000000000003','14000000-0000-4000-a000-000000000099',:'refund_order_order_reference','exceptional_admin_refund','Approved local full-refund test'
);
do $request_idempotency$
declare repeated_id bigint;
begin
 select case_id into repeated_id from public.request_paystack_test_full_refund(
   current_setting('phase1b2a.order_reference'),'14000000-0000-4000-a000-000000000003','14000000-0000-4000-a000-000000000099',current_setting('phase1b2a.order_reference'),'exceptional_admin_refund','Approved local full-refund test'
 );
 if repeated_id<>(select case_id from refund_requested) then raise exception 'Refund request idempotency failed'; end if;
end;$request_idempotency$;
select public.mark_paystack_test_refund_submitting((select case_id from refund_requested),'14000000-0000-4000-a000-000000000003');
select public.record_paystack_test_refund_submission((select case_id from refund_requested),'740001','pending','refund-local-740001','14000000-0000-4000-a000-000000000003');
select * from public.get_learning_refund_case_for_recovery('14000000-0000-4000-a000-000000000003',(select case_id from refund_requested));
select * from public.receive_paystack_test_refund_event('refund.pending:'||:'refund_order_order_reference'||':10000',repeat('c',64),:'refund_order_order_reference',null,'pending',10000,'NGN','test',
 jsonb_build_object('refund_id',null,'refund_reference',null,'transaction_reference',:'refund_order_order_reference','amount',10000,'currency','NGN','domain','test','status','pending')) \gset refund_pending_
select * from public.process_paystack_test_refund_event(:refund_pending_event_id);

do $pending$
begin
 if not exists(select 1 from public.learning_payment_cases where id=(select case_id from refund_requested) and status='pending' and amount_minor=10000 and requested_amount_minor=10000) then raise exception 'Pending full refund case missing'; end if;
 if exists(select 1 from public.learning_ledger_transactions where order_id=current_setting('phase1b2a.order_id')::bigint and transaction_type='refund') then raise exception 'Pending refund posted a reversal'; end if;
 if not exists(select 1 from public.learning_course_entitlements where order_id=current_setting('phase1b2a.order_id')::bigint and status='active') then raise exception 'Pending refund revoked access prematurely'; end if;
 if not exists(select 1 from public.enrollments where id=current_setting('phase1b2a.enrollment_id')::bigint and status='active') then raise exception 'Pending refund cancelled enrollment prematurely'; end if;
end;$pending$;

select public.receive_paystack_test_verified_refund((select case_id from refund_requested),'740001','processed','refund-local-740001',10000,'NGN','test',
 jsonb_build_object('id',740001,'refund_reference','refund-local-740001','transaction_reference',:'refund_order_order_reference','amount',10000,'currency','NGN','domain','test','status','processed'),
 '14000000-0000-4000-a000-000000000003') as event_id \gset refund_verified_
select * from public.recover_paystack_test_refund_event(:refund_verified_event_id,'14000000-0000-4000-a000-000000000003');

do $processed$
declare ledger_id bigint;
begin
 if not exists(select 1 from public.learning_orders where id=current_setting('phase1b2a.order_id')::bigint and status='refunded') then raise exception 'Order was not refunded'; end if;
 if not exists(select 1 from public.learning_payment_cases where id=(select case_id from refund_requested) and status='processed' and processed_amount_minor=10000) then raise exception 'Refund case was not processed'; end if;
 select id into ledger_id from public.learning_ledger_transactions where payment_case_id=(select case_id from refund_requested) and transaction_type='refund';
 if ledger_id is null or (select count(*) from public.learning_ledger_entries where transaction_id=ledger_id)<>2 or (select sum(amount_minor) from public.learning_ledger_entries where transaction_id=ledger_id)<>0 then raise exception 'Refund reversal is not exactly balanced'; end if;
 if not exists(select 1 from public.learning_ledger_entries where transaction_id=ledger_id and account_code='liability.marketplace_sales_unallocated' and amount_minor=10000) then raise exception 'Unallocated sale was not reversed'; end if;
 if not exists(select 1 from public.learning_ledger_entries where transaction_id=ledger_id and account_code='asset.paystack_receivable' and amount_minor=-10000) then raise exception 'Provider receivable was not reversed'; end if;
 if not exists(select 1 from public.learning_course_entitlements where order_id=current_setting('phase1b2a.order_id')::bigint and status='refunded' and revoked_at is not null) then raise exception 'Entitlement was not refunded'; end if;
 if not exists(select 1 from public.enrollments where id=current_setting('phase1b2a.enrollment_id')::bigint and status='cancelled') then raise exception 'Enrollment was not cancelled'; end if;
 if not exists(select 1 from public.lesson_progress where enrollment_id=current_setting('phase1b2a.enrollment_id')::bigint and lesson_id=current_setting('phase1b2a.lesson_id')::bigint and progress_percent=100) then raise exception 'Lesson history was deleted'; end if;
 if (select count(*) from public.learning_ledger_transactions where order_id=current_setting('phase1b2a.order_id')::bigint and transaction_type='payment_capture')<>1 then raise exception 'Original capture changed'; end if;
 if (select count(*) from public.learning_payment_case_events where payment_case_id=(select case_id from refund_requested))<4 then raise exception 'Refund timeline is incomplete'; end if;
end;$processed$;

-- Delayed signed webhook after provider-API recovery must not duplicate the reversal or access rows.
select * from public.receive_paystack_test_refund_event('refund.processed:740001',repeat('b',64),:'refund_order_order_reference','740001','processed',10000,'NGN','test',
 jsonb_build_object('refund_id','740001','refund_reference','refund-local-740001','transaction_reference',:'refund_order_order_reference','amount',10000,'currency','NGN','domain','test','status','processed')) \gset delayed_
select * from public.process_paystack_test_refund_event(:delayed_event_id);

do $idempotency$
declare blocked boolean:=false;
begin
 if (select count(*) from public.learning_ledger_transactions where order_id=current_setting('phase1b2a.order_id')::bigint and transaction_type='refund')<>1 then raise exception 'Delayed webhook duplicated refund ledger'; end if;
 if (select count(*) from public.learning_course_entitlements where order_id=current_setting('phase1b2a.order_id')::bigint)<>1 then raise exception 'Delayed webhook duplicated entitlement'; end if;
 if (select count(*) from public.enrollments where id=current_setting('phase1b2a.enrollment_id')::bigint)<>1 then raise exception 'Delayed webhook duplicated enrollment'; end if;
 begin
   perform public.request_paystack_test_full_refund(current_setting('phase1b2a.order_reference'),'14000000-0000-4000-a000-000000000003','14000000-0000-4000-a000-000000000098',current_setting('phase1b2a.order_reference'),'exceptional_admin_refund','Second refund must fail');
 exception when others then blocked:=true;
 end;
 if not blocked then raise exception 'Second full refund was accepted'; end if;
 if exists(select 1 from public.reconcile_paystack_test_refunds() where order_reference=current_setting('phase1b2a.order_reference')) then raise exception 'Healthy processed refund failed reconciliation'; end if;
end;$idempotency$;

set local role authenticated;
select set_config('request.jwt.claim.sub','14000000-0000-4000-a000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $browser_denial$
begin
 if has_function_privilege('authenticated','public.request_paystack_test_full_refund(text,uuid,uuid,text,text,text)','EXECUTE')
   or has_function_privilege('authenticated','public.finalize_paystack_test_full_refund(bigint,bigint,text,uuid)','EXECUTE')
   or has_function_privilege('authenticated','public.recover_paystack_test_refund_event(bigint,uuid)','EXECUTE')
   or has_function_privilege('authenticated','public.get_learning_refund_case_for_recovery(uuid,bigint)','EXECUTE')
 then raise exception 'Browser role can mutate refunds'; end if;
end;$browser_denial$;
reset role;

do $admin_denial$
declare blocked boolean:=false;
begin
 begin perform public.list_learning_refund_cases('14000000-0000-4000-a000-000000000001',null); exception when insufficient_privilege then blocked:=true; end;
 if not blocked then raise exception 'Learner accessed administrator refund cases'; end if;
end;$admin_denial$;

rollback;
