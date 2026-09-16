begin;

-- Every local financial fixture created below is rolled back. This test never
-- depends on a caller-controlled clock: maturation is represented by a paid_at
-- timestamp already more than fourteen calendar days in the past.
create function pg_temp.phase1c1_create_paid_order(p_course_id bigint,p_paid_at timestamptz,p_learner_id uuid default null)
returns bigint language plpgsql as $function$
declare course_row record; order_key bigint; capture_key bigint;
begin
  select id,instructor_id,title into course_row from public.learning_courses where id=p_course_id;
  insert into public.learning_orders(learner_id,course_id,instructor_id,course_title_snapshot,gross_amount_minor,currency,status,commercial_terms_version,paid_at)
  values(p_learner_id,course_row.id,course_row.instructor_id,course_row.title,10000,'NGN','paid','growvelt-commercial-v1',p_paid_at)
  returning id into order_key;
  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description)
  values(order_key,'payment_capture','NGN','Phase 1C1 rollback-only capture fixture') returning id into capture_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency) values
    (capture_key,1,'asset.paystack_receivable',10000,'NGN'),
    (capture_key,2,'liability.marketplace_sales_unallocated',-10000,'NGN');
  return order_key;
end;$function$;

create function pg_temp.phase1c1_grant_access(p_order_id bigint,p_learner_id uuid,p_course_id bigint)
returns void language plpgsql as $function$
declare enrollment_key bigint;
begin
  insert into public.enrollments(learner_id,course_id,status) values(p_learner_id,p_course_id,'active') returning id into enrollment_key;
  insert into public.learning_course_entitlements(learner_id,course_id,order_id,enrollment_id,status)
  values(p_learner_id,p_course_id,p_order_id,enrollment_key,'active');
end;$function$;

do $test$
declare
  course_row record;
  early_order bigint; matured_order bigint; protected_order bigint; held_refund_order bigint;
  available_refund_order bigint; partial_chargeback_order bigint; mismatch_order bigint; premature_order bigint;
  partial_refund_order bigint; final_refund_order bigint; final_chargeback_order bigint;
  allocation_key bigint; earning_row record; refund_case bigint; available_case bigint; protected_case bigint;
  partial_case bigint; mismatch_case bigint; premature_case bigint; partial_refund_case bigint;
  final_refund_case bigint; final_chargeback_case bigint; refund_event_id bigint; chargeback_event_id bigint;
  reversal_key bigint; protected_reference text;
  blocked boolean; definition text;
begin
  if not exists(select 1 from public.learning_commercial_terms where version='growvelt-commercial-v1' and scope_type='platform' and commission_basis_points=2500 and instructor_share_basis_points=7500 and earnings_hold_days=14 and reserve_basis_points is null and active) then
    raise exception 'Growvelt Commercial Terms v1 are missing or incorrect';
  end if;
  if to_regprocedure('public.release_matured_learning_instructor_earnings(timestamptz,integer,uuid)') is not null then
    raise exception 'Legacy caller-controlled earnings-release function remains';
  end if;
  if has_table_privilege('anon','public.learning_commercial_allocations','select') or has_table_privilege('authenticated','public.learning_instructor_earnings','select') then
    raise exception 'Browser role has commercial financial-table access';
  end if;
  if has_function_privilege('authenticated','public.allocate_learning_order_commercial_terms(bigint,uuid)','execute')
    or has_function_privilege('anon','public.release_matured_learning_instructor_earnings(integer,uuid)','execute')
    or has_function_privilege('authenticated','public.reverse_learning_order_commercial_allocation(bigint,bigint,text,uuid)','execute') then
    raise exception 'Browser role can mutate commercial earnings';
  end if;

  insert into auth.users(id,aud,role,email,created_at,updated_at)
  values('11111111-1111-4111-8111-111111111111','authenticated','authenticated','phase1c1-instructor@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status)
  values('11111111-1111-4111-8111-111111111111','phase1c1-instructor@example.test','Phase 1C1 Instructor','complete') on conflict(id) do nothing;
  insert into auth.users(id,aud,role,email,created_at,updated_at)
  values('11111111-1111-4111-8111-111111111112','authenticated','authenticated','phase1c1-learner@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status)
  values('11111111-1111-4111-8111-111111111112','phase1c1-learner@example.test','Phase 1C1 Learner','complete') on conflict(id) do nothing;
  insert into auth.users(id,aud,role,email,created_at,updated_at)
  values('11111111-1111-4111-8111-111111111113','authenticated','authenticated','phase1c1-chargeback@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status)
  values('11111111-1111-4111-8111-111111111113','phase1c1-chargeback@example.test','Phase 1C1 Chargeback Learner','complete') on conflict(id) do nothing;
  insert into public.learning_courses(instructor_id,title,slug,price_amount,price_currency,is_free,is_limited_time_free,status)
  values('11111111-1111-4111-8111-111111111111','Phase 1C1 local commercial test','phase1c1-local-commercial-test',100,'NGN',false,false,'draft') on conflict(slug) do nothing;
  select id,title into course_row from public.learning_courses where slug='phase1c1-local-commercial-test';
  if not found then raise exception 'Phase 1C1 local course fixture was not created'; end if;

  early_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '1 day');
  allocation_key:=public.allocate_learning_order_commercial_terms(early_order,null);
  if public.release_matured_learning_instructor_earnings(100,null)<>0 then raise exception 'Earnings released before the actual 14-day hold elapsed'; end if;
  if not exists(select 1 from public.learning_instructor_earnings where allocation_id=allocation_key and status='held') then raise exception 'Early earning is not held'; end if;

  matured_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '15 days');
  allocation_key:=public.allocate_learning_order_commercial_terms(matured_order,null);
  if public.release_matured_learning_instructor_earnings(100,null)<>1 then raise exception 'Genuinely matured earning was not released'; end if;
  select * into earning_row from public.learning_instructor_earnings where allocation_id=allocation_key;
  if earning_row.status<>'available' or earning_row.gross_amount_minor<>7500 or earning_row.available_at>now() then raise exception 'Matured earning availability or approved 25/75 allocation is incorrect'; end if;
  if not exists(select 1 from public.learning_commercial_allocations where id=allocation_key and gross_amount_minor=10000 and platform_commission_minor=2500 and instructor_gross_minor=7500) then raise exception 'Approved 25/75 split is not retained'; end if;

  protected_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '15 days');
  allocation_key:=public.allocate_learning_order_commercial_terms(protected_order,null);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(protected_order,'refund','processing',10000,'NGN','paystack','900000010','processing') returning id into protected_case;
  if public.release_matured_learning_instructor_earnings(100,null)<>0 then raise exception 'Active refund protection did not block earnings release'; end if;
  select order_reference into protected_reference from public.learning_orders where id=protected_order;
  if exists(select 1 from public.reconcile_learning_commercial_allocations() r where r.order_reference=protected_reference and r.issue_type='matured_held_earning') then raise exception 'Protected hold was reported as a reconciliation failure'; end if;

  held_refund_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '1 day');
  allocation_key:=public.allocate_learning_order_commercial_terms(held_refund_order,null);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(held_refund_order,'refund','processed',10000,'NGN','paystack','900000011','processed') returning id into refund_case;
  update public.learning_payment_cases set processed_amount_minor=10000,processed_at=now(),resolved_at=now() where id=refund_case;
  reversal_key:=public.reverse_learning_order_commercial_allocation(held_refund_order,refund_case,'rollback-only held refund',null);
  if public.reverse_learning_order_commercial_allocation(held_refund_order,refund_case,'duplicate rollback-only held refund',null)<>reversal_key then raise exception 'Held refund reversal is not idempotent'; end if;
  if not exists(select 1 from public.learning_instructor_earnings e join public.learning_commercial_allocations a on a.id=e.allocation_id where a.order_id=held_refund_order and e.status='reversed') then raise exception 'Held earning was not reversed'; end if;

  available_refund_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '15 days');
  allocation_key:=public.allocate_learning_order_commercial_terms(available_refund_order,null);
  if public.release_matured_learning_instructor_earnings(100,null)<>1 then raise exception 'Available-refund fixture did not mature'; end if;
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(available_refund_order,'refund','processed',10000,'NGN','paystack','900000012','processed') returning id into available_case;
  update public.learning_payment_cases set processed_amount_minor=10000,processed_at=now(),resolved_at=now() where id=available_case;
  reversal_key:=public.reverse_learning_order_commercial_allocation(available_refund_order,available_case,'rollback-only available refund',null);
  if not exists(select 1 from public.learning_instructor_earnings e join public.learning_commercial_allocations a on a.id=e.allocation_id where a.order_id=available_refund_order and e.status='reversed') then raise exception 'Available earning was not reversed'; end if;
  if (select count(*) from public.learning_ledger_transactions where order_id=available_refund_order and transaction_type='instructor_earnings_reversal')<>1 then raise exception 'Duplicate available-earning reversal exists'; end if;

  partial_chargeback_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '1 day');
  allocation_key:=public.allocate_learning_order_commercial_terms(partial_chargeback_order,null);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status,provider_resolution)
  values(partial_chargeback_order,'chargeback','lost',3000,'NGN','paystack','900000013','resolved','merchant-accepted') returning id into partial_case;
  blocked:=false; begin perform public.reverse_learning_order_commercial_allocation(partial_chargeback_order,partial_case,'rollback-only partial chargeback',null); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Partial chargeback commercial reversal was accepted'; end if;
  if not exists(select 1 from public.learning_commercial_allocations where id=allocation_key and status='allocated') or not exists(select 1 from public.learning_instructor_earnings where allocation_id=allocation_key and status='held') or exists(select 1 from public.learning_ledger_transactions where order_id=partial_chargeback_order and transaction_type='instructor_earnings_reversal') then raise exception 'Partial chargeback altered commercial financial history'; end if;

  mismatch_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '1 day');
  perform public.allocate_learning_order_commercial_terms(mismatch_order,null);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(mismatch_order,'refund','processed',10000,'NGN','paystack','900000014','processed') returning id into mismatch_case;
  blocked:=false; begin perform public.reverse_learning_order_commercial_allocation(partial_chargeback_order,mismatch_case,'rollback-only mismatched case',null); exception when others then blocked:=true; end;
  if not blocked then raise exception 'Mismatched payment case was accepted'; end if;
  premature_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '1 day');
  allocation_key:=public.allocate_learning_order_commercial_terms(premature_order,null);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(premature_order,'refund','processing',10000,'NGN','paystack','900000015','processing') returning id into premature_case;
  blocked:=false; begin perform public.reverse_learning_order_commercial_allocation(premature_order,premature_case,'rollback-only premature case',null); exception when others then blocked:=true; end;
  if not blocked or exists(select 1 from public.learning_ledger_transactions where order_id=premature_order and transaction_type='instructor_earnings_reversal') then raise exception 'Premature case altered commercial allocation'; end if;

  -- A processed partial refund is equally unable to reverse the full 25/75
  -- allocation. The order's authoritative gross is the only permitted amount.
  partial_refund_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '1 day');
  allocation_key:=public.allocate_learning_order_commercial_terms(partial_refund_order,null);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,processed_amount_minor,currency,provider,provider_case_id,provider_status,processed_at,resolved_at)
  values(partial_refund_order,'refund','processed',3000,3000,'NGN','paystack','900000016','processed',now(),now()) returning id into partial_refund_case;
  blocked:=false; begin perform public.reverse_learning_order_commercial_allocation(partial_refund_order,partial_refund_case,'rollback-only partial refund',null); exception when others then blocked:=true; end;
  if not blocked or exists(select 1 from public.learning_ledger_transactions where order_id=partial_refund_order and transaction_type='instructor_earnings_reversal') then raise exception 'Partial refund altered commercial allocation'; end if;

  -- Exercise the actual authoritative refund finalizer through a signed-event
  -- style provider event, then replay it to prove observable exactly-once state.
  final_refund_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '1 day','11111111-1111-4111-8111-111111111112');
  perform public.allocate_learning_order_commercial_terms(final_refund_order,null);
  perform pg_temp.phase1c1_grant_access(final_refund_order,'11111111-1111-4111-8111-111111111112',course_row.id);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(final_refund_order,'refund','processing',10000,'NGN','paystack','900000017','processing') returning id into final_refund_case;
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,processing_status,order_id,payment_case_id)
  values('paystack','refund.processed:900000017','refund.processed',repeat('e',64),jsonb_build_object('amount',10000,'currency','NGN','domain','test','status','processed'),true,'received',final_refund_order,final_refund_case) returning id into refund_event_id;
  if (select outcome from public.process_paystack_test_refund_event(refund_event_id))<>'refunded' then raise exception 'Authoritative refund finalizer did not process'; end if;
  if (select outcome from public.process_paystack_test_refund_event(refund_event_id))<>'already_processed' then raise exception 'Refund finalizer replay was not idempotent'; end if;
  if not exists(select 1 from public.learning_orders where id=final_refund_order and status='refunded')
    or not exists(select 1 from public.learning_commercial_allocations where order_id=final_refund_order and status='reversed')
    or not exists(select 1 from public.learning_instructor_earnings e join public.learning_commercial_allocations a on a.id=e.allocation_id where a.order_id=final_refund_order and e.status='reversed')
    or (select count(*) from public.learning_ledger_transactions where order_id=final_refund_order and transaction_type='instructor_earnings_reversal')<>1 then
    raise exception 'Authoritative refund finalizer did not create exactly one commercial reversal';
  end if;

  -- Exercise the authoritative lost/merchant-accepted chargeback finalizer.
  final_chargeback_order:=pg_temp.phase1c1_create_paid_order(course_row.id,now()-interval '1 day','11111111-1111-4111-8111-111111111113');
  perform public.allocate_learning_order_commercial_terms(final_chargeback_order,null);
  perform pg_temp.phase1c1_grant_access(final_chargeback_order,'11111111-1111-4111-8111-111111111113',course_row.id);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(final_chargeback_order,'chargeback','opened',10000,'NGN','paystack','900000018','awaiting-merchant-feedback') returning id into final_chargeback_case;
  insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,processing_status,order_id,payment_case_id)
  values('paystack','charge.dispute.resolve:900000018', 'charge.dispute.resolve',repeat('f',64),jsonb_build_object('resolution','merchant-accepted','status','resolved','amount',10000,'currency','NGN','domain','test'),true,'received',final_chargeback_order,final_chargeback_case) returning id into chargeback_event_id;
  if (select outcome from public.process_paystack_test_dispute_event(chargeback_event_id))<>'lost' then raise exception 'Authoritative lost chargeback finalizer did not process'; end if;
  if (select outcome from public.process_paystack_test_dispute_event(chargeback_event_id))<>'already_processed' then raise exception 'Chargeback finalizer replay was not idempotent'; end if;
  if not exists(select 1 from public.learning_orders where id=final_chargeback_order and status='chargeback')
    or not exists(select 1 from public.learning_commercial_allocations where order_id=final_chargeback_order and status='reversed')
    or not exists(select 1 from public.learning_instructor_earnings e join public.learning_commercial_allocations a on a.id=e.allocation_id where a.order_id=final_chargeback_order and e.status='reversed')
    or (select count(*) from public.learning_ledger_transactions where order_id=final_chargeback_order and transaction_type='instructor_earnings_reversal')<>1 then
    raise exception 'Authoritative lost chargeback did not create exactly one commercial reversal';
  end if;

  if exists(select 1 from public.learning_ledger_transactions t where t.order_id in (early_order,matured_order,protected_order,held_refund_order,available_refund_order,partial_chargeback_order,mismatch_order,premature_order,partial_refund_order,final_refund_order,final_chargeback_order) and not exists(select 1 from public.learning_ledger_entries e where e.transaction_id=t.id group by e.transaction_id having count(*)>=2 and sum(e.amount_minor)=0)) then raise exception 'Commercial ledger transaction is not balanced'; end if;
  begin update public.learning_commercial_terms set commission_basis_points=2400 where version='growvelt-commercial-v1'; raise exception 'Commercial terms mutation was accepted'; exception when insufficient_privilege then null; end;
  select pg_get_functiondef('public.finalize_paystack_test_charge(text,text,text,text,bigint,text,text,jsonb)'::regprocedure) into definition;
  if definition not like '%coalesce(a.paystack_domain,''test'')=''test''%' then raise exception 'Test finalizer no longer protects the Paystack domain boundary'; end if;
end $test$;

rollback;
