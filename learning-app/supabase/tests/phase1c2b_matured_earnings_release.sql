begin;

create function pg_temp.phase1c2b_paid_order(p_course_id bigint,p_paid_at timestamptz)
returns bigint language plpgsql as $function$
declare order_key bigint; capture_key bigint; course_row record;
begin
  select instructor_id,title into course_row from public.learning_courses where id=p_course_id;
  insert into public.learning_orders(instructor_id,course_id,course_title_snapshot,gross_amount_minor,currency,status,commercial_terms_version,paid_at)
  values(course_row.instructor_id,p_course_id,course_row.title,10000,'NGN','paid','growvelt-commercial-v1',p_paid_at) returning id into order_key;
  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description)
  values(order_key,'payment_capture','NGN','Phase 1C2B rollback-only release fixture') returning id into capture_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency) values
    (capture_key,1,'asset.paystack_receivable',10000,'NGN'),
    (capture_key,2,'liability.marketplace_sales_unallocated',-10000,'NGN');
  return order_key;
end;$function$;

do $test$
declare course_id bigint; order_id bigint; allocation_key bigint; run_id bigint; released integer; i integer;
  protected_refund bigint; protected_dispute bigint; protected_chargeback bigint; protected_reference text;
  admin_id uuid:='33333333-3333-4333-8333-333333333331'; instructor_id uuid:='33333333-3333-4333-8333-333333333332';
  blocked boolean; release_definition text;
begin
  if has_table_privilege('authenticated','public.learning_instructor_earnings_release_runs','select')
    or has_function_privilege('authenticated','public.execute_learning_instructor_earnings_release_run(bigint)','execute')
    or has_function_privilege('anon','public.start_learning_instructor_earnings_release_run(text,uuid)','execute') then
    raise exception 'Browser role can access release-run financial operations';
  end if;

  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (admin_id,'authenticated','authenticated','phase1c2b-admin@example.test',now(),now()),
    (instructor_id,'authenticated','authenticated','phase1c2b-instructor@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (admin_id,'phase1c2b-admin@example.test','Phase 1C2B Admin','complete'),
    (instructor_id,'phase1c2b-instructor@example.test','Phase 1C2B Instructor','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (admin_id,'admin','active'),(instructor_id,'instructor','active') on conflict(user_id,capability) do nothing;
  insert into public.instructor_profiles(user_id,approval_status) values(instructor_id,'approved') on conflict(user_id) do nothing;
  insert into public.learning_courses(instructor_id,title,slug,price_amount,price_currency,is_free,is_limited_time_free,status)
  values(instructor_id,'Phase 1C2B release course','phase1c2b-release-course',100,'NGN',false,false,'draft') on conflict(slug) do nothing;
  select id into course_id from public.learning_courses where slug='phase1c2b-release-course';

  -- Database time, not a caller's timestamp, keeps an early earning held.
  order_id:=pg_temp.phase1c2b_paid_order(course_id,now()-interval '1 day');
  allocation_key:=public.allocate_learning_order_commercial_terms(order_id,null);
  run_id:=public.start_learning_instructor_earnings_release_run('scheduler',null);
  if public.execute_learning_instructor_earnings_release_run(run_id)<>0 then raise exception 'Early earning released before 14 calendar days'; end if;
  if not exists(select 1 from public.learning_instructor_earnings earning where earning.allocation_id=allocation_key and earning.status='held') then raise exception 'Early earning did not remain held'; end if;

  -- The operational wrapper's fixed 100-row batch leaves work for the next run.
  for i in 1..101 loop
    order_id:=pg_temp.phase1c2b_paid_order(course_id,now()-interval '15 days');
    perform public.allocate_learning_order_commercial_terms(order_id,null);
  end loop;
  run_id:=public.start_learning_instructor_earnings_release_run('scheduler',null);
  released:=public.execute_learning_instructor_earnings_release_run(run_id);
  if released<>100 or not exists(select 1 from public.learning_instructor_earnings_release_runs where id=run_id and status='succeeded' and released_count=100) then raise exception 'Bounded scheduler batch was not audited correctly'; end if;
  run_id:=public.start_learning_instructor_earnings_release_run('scheduler',null);
  if public.execute_learning_instructor_earnings_release_run(run_id)<>1 then raise exception 'Subsequent scheduler run did not process remaining earning'; end if;
  run_id:=public.start_learning_instructor_earnings_release_run('scheduler',null);
  if public.execute_learning_instructor_earnings_release_run(run_id)<>0 then raise exception 'Duplicate scheduler invocation created a duplicate release'; end if;

  protected_refund:=pg_temp.phase1c2b_paid_order(course_id,now()-interval '15 days'); perform public.allocate_learning_order_commercial_terms(protected_refund,null);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(protected_refund,'refund','processing',10000,'NGN','paystack','phase1c2b-refund','processing');
  protected_dispute:=pg_temp.phase1c2b_paid_order(course_id,now()-interval '15 days'); perform public.allocate_learning_order_commercial_terms(protected_dispute,null);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(protected_dispute,'chargeback','opened',10000,'NGN','paystack','phase1c2b-dispute','awaiting-merchant-feedback');
  protected_chargeback:=pg_temp.phase1c2b_paid_order(course_id,now()-interval '15 days'); perform public.allocate_learning_order_commercial_terms(protected_chargeback,null);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(protected_chargeback,'chargeback','action_required',10000,'NGN','paystack','phase1c2b-chargeback','awaiting-merchant-feedback');
  run_id:=public.start_learning_instructor_earnings_release_run('scheduler',null);
  if public.execute_learning_instructor_earnings_release_run(run_id)<>0 then raise exception 'Active financial protection did not block a mature release'; end if;
  if exists(select 1 from public.learning_instructor_earnings e join public.learning_commercial_allocations a on a.id=e.allocation_id where a.order_id in (protected_refund,protected_dispute,protected_chargeback) and e.status<>'held') then raise exception 'Protected mature earning was released'; end if;
  select order_reference into protected_reference from public.learning_orders where id=protected_refund;
  if exists(select 1 from public.reconcile_learning_commercial_allocations() r where r.order_reference=protected_reference and r.issue_type='matured_held_earning') then raise exception 'Expected protected hold was a reconciliation failure'; end if;

  order_id:=pg_temp.phase1c2b_paid_order(course_id,now()-interval '15 days'); allocation_key:=public.allocate_learning_order_commercial_terms(order_id,null);
  if not exists(select 1 from public.reconcile_learning_commercial_allocations() r join public.learning_orders o on o.order_reference=r.order_reference where o.id=order_id and r.issue_type='matured_held_earning') then raise exception 'Unprotected overdue earning is absent from reconciliation'; end if;
  run_id:=public.start_learning_instructor_earnings_release_run('admin_recovery',admin_id);
  released:=public.execute_learning_instructor_earnings_release_run(run_id);
  if released<>1 or not exists(select 1 from public.learning_instructor_earnings_release_runs where id=run_id and invocation_source='admin_recovery' and actor_user_id=admin_id and status='succeeded') then raise exception 'Active-admin recovery release was not recorded (released=%)',released; end if;

  blocked:=false; begin perform public.start_learning_instructor_earnings_release_run('admin_recovery',instructor_id); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Non-admin started an administrator release run'; end if;
  blocked:=false; begin perform public.start_learning_instructor_earnings_release_run('scheduler',admin_id); exception when invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'Scheduler run accepted a caller actor'; end if;
  run_id:=public.start_learning_instructor_earnings_release_run('scheduler',null);
  perform public.fail_learning_instructor_earnings_release_run(run_id,'release_execution_failed');
  if not exists(select 1 from public.learning_instructor_earnings_release_runs where id=run_id and status='failed' and failure_code='release_execution_failed') then raise exception 'Failed run audit was not retained'; end if;

  select pg_get_functiondef('public.release_matured_learning_instructor_earnings(integer,uuid)'::regprocedure) into release_definition;
  if release_definition not like '%for update of e skip locked%' or release_definition not like '%available_at<=now()%' then raise exception 'Authoritative release locking or database-time protection changed'; end if;
end $test$;

rollback;
