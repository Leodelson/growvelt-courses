begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_anonymous)
values
('13000000-0000-4000-a000-000000000001','authenticated','authenticated','learner@phase1b1.invalid','',now(),'{}','{"full_name":"Recovery Learner"}',now(),now(),false),
('13000000-0000-4000-a000-000000000002','authenticated','authenticated','instructor@phase1b1.invalid','',now(),'{}','{"full_name":"Recovery Instructor"}',now(),now(),false),
('13000000-0000-4000-a000-000000000003','authenticated','authenticated','admin@phase1b1.invalid','',now(),'{}','{"full_name":"Recovery Admin"}',now(),now(),false);
insert into public.account_capabilities(user_id,capability,status) values
('13000000-0000-4000-a000-000000000002','instructor','active'),('13000000-0000-4000-a000-000000000003','admin','active');
insert into public.instructor_profiles(user_id,approval_status,headline,bio,expertise,country,reviewed_at,reviewed_by)
values('13000000-0000-4000-a000-000000000002','approved','Test instructor','Test instructor bio',array['Testing'],'Nigeria',now(),'13000000-0000-4000-a000-000000000003');
insert into public.learning_courses(instructor_id,title,slug,summary,description,category,level,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('13000000-0000-4000-a000-000000000002','[TEST] Phase 1B1 Recovery','phase1b1-payment-recovery','Recovery test','Recovery test course','Testing','Beginner',false,100,'NGN',false,'published',now()) returning id \gset phase1b1_

insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
values('13000000-0000-4000-a000-000000000001',:phase1b1_id,'13000000-0000-4000-a000-000000000002','[TEST] Phase 1B1 Recovery','Recovery Instructor',10000,'NGN','created','phase1b1-test-v1') returning id,order_reference \gset order_
insert into public.learning_payment_attempts(order_id,provider,provider_reference,amount_minor,currency,status) values(:order_id,'paystack',:'order_order_reference',10000,'NGN','initialized');
select public.mark_paystack_test_learning_attempt_pending(:'order_order_reference');
create temporary table phase1b1_order as select :order_id::bigint order_id,:'order_order_reference'::text order_reference;

create temporary table phase1b1_receipt as select * from public.receive_paystack_test_charge_event(
 'charge.success:130001',repeat('a',64),(select order_reference from phase1b1_order),'130001',10000,'NGN','test',
 jsonb_build_object('transaction_id','130001','reference',(select order_reference from phase1b1_order),'amount',10000,'currency','NGN','domain','test','status','success')
);
create temporary table phase1b1_processed as select * from public.process_paystack_test_charge_event((select event_id from phase1b1_receipt));

do $assertions$
begin
 if (select outcome from phase1b1_processed)<>'paid_and_enrolled' then raise exception 'Durable event did not finalize'; end if;
 if not exists(select 1 from public.learning_payment_provider_events where id=(select event_id from phase1b1_receipt) and processing_status='processed' and recovery_status='resolved' and processing_attempts=1) then raise exception 'Recovery metadata was not captured'; end if;
 if (select outcome from public.receive_paystack_test_charge_event('charge.success:130001',repeat('a',64),(select order_reference from phase1b1_order),'130001',10000,'NGN','test','{}'))<>'already_processed' then raise exception 'Duplicate receipt was not idempotent'; end if;
 if exists(select 1 from public.reconcile_paystack_test_learning_payments() where order_reference=(select order_reference from phase1b1_order)) then raise exception 'Healthy recovered order failed reconciliation'; end if;
 if has_function_privilege('authenticated','public.process_paystack_test_charge_event(bigint)','EXECUTE') or has_function_privilege('authenticated','public.list_learning_payment_operations(uuid,text,integer)','EXECUTE') then raise exception 'Browser role can execute service-only operations'; end if;
 if (select count(*) from public.list_learning_payment_operations('13000000-0000-4000-a000-000000000003',null,50) where order_reference=(select order_reference from phase1b1_order))<>1 then raise exception 'Admin payment lookup failed'; end if;
end;$assertions$;

-- Verify API recovery without a webhook event.
insert into public.learning_courses(instructor_id,title,slug,summary,description,category,level,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('13000000-0000-4000-a000-000000000002','[TEST] Phase 1B1 Verify','phase1b1-provider-verify','Provider verification','Provider verification test','Testing','Beginner',false,100,'NGN',false,'published',now()) returning id \gset verify_
insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,instructor_name_snapshot,gross_amount_minor,currency,status,commercial_terms_version)
values('13000000-0000-4000-a000-000000000001',:verify_id,'13000000-0000-4000-a000-000000000002','[TEST] Phase 1B1 Verify','Recovery Instructor',10000,'NGN','created','phase1b1-test-v1') returning id,order_reference \gset verify_order_
insert into public.learning_payment_attempts(order_id,provider,provider_reference,amount_minor,currency,status) values(:verify_order_id,'paystack',:'verify_order_order_reference',10000,'NGN','initialized');
select public.mark_paystack_test_learning_attempt_pending(:'verify_order_order_reference');
create temporary table verify_order as select :verify_order_id::bigint order_id,:'verify_order_order_reference'::text order_reference;
select public.receive_paystack_test_verified_transaction((select order_reference from verify_order),'130002',10000,'NGN','test',jsonb_build_object('transaction_id','130002','reference',(select order_reference from verify_order),'amount',10000,'currency','NGN','domain','test','status','success'),'13000000-0000-4000-a000-000000000003') as event_id \gset verified_
select * from public.recover_paystack_test_charge_event(:verified_event_id,'13000000-0000-4000-a000-000000000003');
select set_config('phase1b1.verified_event_id',:verified_event_id::text,true);
do $verified$
begin
 if not exists(select 1 from public.learning_payment_provider_events where id=current_setting('phase1b1.verified_event_id')::bigint and verification_source='provider_api' and not signature_valid and processing_status='processed') then raise exception 'Provider API recovery provenance is incorrect'; end if;
 if not exists(select 1 from public.learning_audit_events where action in('payment_provider_event.verified_via_api','payment_provider_event.reprocessed') and actor_user_id='13000000-0000-4000-a000-000000000003') then raise exception 'Recovery audit trail is missing'; end if;
end;$verified$;

rollback;
