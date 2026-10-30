-- Run only against an isolated local database. Leaves no rows behind.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('26000000-0000-4000-a000-000000000001','authenticated','authenticated','learner@refund-fee.invalid','',now(),'{}','{"full_name":"Refund Learner"}',now(),now()),
('26000000-0000-4000-a000-000000000004','authenticated','authenticated','second-learner@refund-fee.invalid','',now(),'{}','{"full_name":"Second Learner"}',now(),now()),
('26000000-0000-4000-a000-000000000002','authenticated','authenticated','instructor@refund-fee.invalid','',now(),'{}','{"full_name":"Refund Instructor"}',now(),now()),
('26000000-0000-4000-a000-000000000003','authenticated','authenticated','admin@refund-fee.invalid','',now(),'{}','{"full_name":"Refund Admin"}',now(),now());
insert into public.account_capabilities(user_id,capability,status) values
('26000000-0000-4000-a000-000000000002','instructor','active'),
('26000000-0000-4000-a000-000000000003','admin','active');
insert into public.instructor_profiles(user_id,approval_status,headline,bio,expertise,country,reviewed_at,reviewed_by)
values('26000000-0000-4000-a000-000000000002','approved','Refund instructor','Local refund test',array['Testing'],'Nigeria',now(),'26000000-0000-4000-a000-000000000003');
insert into public.learning_courses(instructor_id,title,slug,summary,description,category,level,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('26000000-0000-4000-a000-000000000002','Fee Inclusive Refund Fixture','fee-inclusive-refund-fixture','Refund test','Local refund test course','Testing','Beginner',false,100,'NGN',false,'published',now()) returning id \gset course_
insert into public.course_modules(course_id,title,position) values(:course_id,'Refund history',1) returning id \gset module_
insert into public.lessons(course_id,module_id,title,lesson_type,content,position) values(:course_id,:module_id,'Historical lesson','text','Retained after refund',1);
insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
values('26000000-0000-4000-a000-000000000001',:course_id,'26000000-0000-4000-a000-000000000002','Fee Inclusive Refund Fixture','Refund Instructor',10000,'NGN','payment_pending','fee-inclusive-v1') returning id,order_reference \gset order_
select set_config('refund_fee.order_id',:order_id::text,true);
insert into public.learning_payment_attempts(order_id,provider,provider_reference,provider_transaction_id,amount_minor,currency,status,paystack_domain)
values(:order_id,'paystack',:'order_order_reference','260001',10000,'NGN','pending','live');
select * from public.finalize_paystack_live_charge('charge.success:260001',repeat('a',64),:'order_order_reference','260001',10000,'NGN','live',
 jsonb_build_object('transaction_id','260001','reference',:'order_order_reference','amount',10000,'requested_amount',10000,'charged_amount',10153,'fees',153,'currency','NGN','domain','live','status','success'));
create temporary table fee_case as select * from public.request_paystack_live_full_refund(
 :'order_order_reference','26000000-0000-4000-a000-000000000003','26000000-0000-4000-a000-000000000099',:'order_order_reference','customer_request','Approved local fee-inclusive refund test');
select public.mark_paystack_live_refund_submitting((select case_id from fee_case),'26000000-0000-4000-a000-000000000003');
select public.record_paystack_live_refund_submission((select case_id from fee_case),'260002','processed','fee-refund-260002','26000000-0000-4000-a000-000000000003');
select public.receive_paystack_live_verified_refund((select case_id from fee_case),'260002','processed','fee-refund-260002',10153,'NGN','live',
 jsonb_build_object('id',260002,'refund_reference','fee-refund-260002','transaction_reference',:'order_order_reference','amount',10153,'currency','NGN','domain','live','status','processed'),
 '26000000-0000-4000-a000-000000000003') as event_id \gset refund_
select * from public.recover_paystack_live_refund_event(:refund_event_id,'26000000-0000-4000-a000-000000000003');

do $checks$
declare refund_id bigint; fee_id bigint;
begin
 if not exists(select 1 from public.learning_payment_cases c where c.id=(select case_id from fee_case)
   and c.status='processed' and c.amount_minor=10000 and c.processed_amount_minor=10000 and c.provider_refunded_amount_minor=10153)
 then raise exception 'Course price and full provider refund were not recorded separately'; end if;
 select id into refund_id from public.learning_ledger_transactions where payment_case_id=(select case_id from fee_case) and transaction_type='refund';
 select id into fee_id from public.learning_ledger_transactions where payment_case_id=(select case_id from fee_case) and transaction_type='adjustment';
 if refund_id is null or fee_id is null then raise exception 'Refund or fee expense ledger missing'; end if;
 if (select sum(amount_minor) from public.learning_ledger_entries where transaction_id=refund_id)<>0
   or (select sum(amount_minor) from public.learning_ledger_entries where transaction_id=fee_id)<>0
 then raise exception 'Refund or fee ledger is unbalanced'; end if;
 if not exists(select 1 from public.learning_ledger_entries where transaction_id=fee_id and account_code='expense.refund_pass_through_charge' and amount_minor=153)
 then raise exception 'Extra charge expense not recorded'; end if;
 if not exists(select 1 from public.learning_orders where id=current_setting('refund_fee.order_id')::bigint and status='refunded')
   or not exists(select 1 from public.learning_course_entitlements where order_id=current_setting('refund_fee.order_id')::bigint and status='refunded')
 then raise exception 'Order or entitlement was not refunded'; end if;
end;$checks$;

-- A separate paid order exercises the audited stale-case release without
-- changing or deleting any payment, entitlement, or charge evidence.
insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
values('26000000-0000-4000-a000-000000000004',:course_id,'26000000-0000-4000-a000-000000000002','Fee Inclusive Refund Fixture','Refund Instructor',10000,'NGN','payment_pending','fee-inclusive-v1') returning id,order_reference \gset second_order_
select set_config('refund_fee.second_order_id',:second_order_id::text,true);
insert into public.learning_payment_attempts(order_id,provider,provider_reference,provider_transaction_id,amount_minor,currency,status,paystack_domain)
values(:second_order_id,'paystack',:'second_order_order_reference','260003',10000,'NGN','pending','live') returning id \gset second_attempt_
select * from public.finalize_paystack_live_charge('charge.success:260003',repeat('b',64),:'second_order_order_reference','260003',10000,'NGN','live',
 jsonb_build_object('transaction_id','260003','reference',:'second_order_order_reference','amount',10000,'requested_amount',10000,'charged_amount',10153,'fees',153,'currency','NGN','domain','live','status','success'));
insert into public.learning_payment_cases(order_id,payment_attempt_id,case_type,status,amount_minor,currency,reason,initiated_by,
 provider,idempotency_key,provider_transaction_id,requested_amount_minor,reason_code,operator_note,requested_at,provider_status,updated_at)
values(:second_order_id,:second_attempt_id,'refund','needs_attention',10000,'NGN','Local lost response fixture','26000000-0000-4000-a000-000000000003',
 'paystack','26000000-0000-4000-a000-000000000098','260003',10000,'customer_request','Local lost response fixture',now()-interval '2 hours','needs-attention',now()-interval '2 hours') returning id \gset stale_case_
select set_config('refund_fee.stale_case_id',:stale_case_id::text,true);
select public.close_unsubmitted_paystack_live_refund_case(:stale_case_id,'26000000-0000-4000-a000-000000000003');
do $closure$
begin
 if not exists(select 1 from public.learning_payment_cases where id=current_setting('refund_fee.stale_case_id')::bigint and status='failed' and failure_code='provider_refund_not_found')
 then raise exception 'Verified-absent refund case was not closed'; end if;
 if not exists(select 1 from public.learning_orders where id=current_setting('refund_fee.second_order_id')::bigint and status='paid')
   or not exists(select 1 from public.learning_course_entitlements where order_id=current_setting('refund_fee.second_order_id')::bigint and status='active')
 then raise exception 'Closing unsubmitted refund changed paid access'; end if;
end;$closure$;

rollback;
