begin;

create function pg_temp.phase1c2_create_paid_order(p_course_id bigint,p_instructor_id uuid,p_status text,p_paid_at timestamptz)
returns bigint language plpgsql as $function$
declare order_key bigint; capture_key bigint;
begin
  insert into public.learning_orders(instructor_id,course_id,course_title_snapshot,gross_amount_minor,currency,status,commercial_terms_version,paid_at)
  values(p_instructor_id,p_course_id,'Phase 1C2A earnings course',10000,'NGN',p_status,'growvelt-commercial-v1',p_paid_at)
  returning id into order_key;
  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description)
  values(order_key,'payment_capture','NGN','Phase 1C2A rollback-only capture') returning id into capture_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency) values
    (capture_key,1,'asset.paystack_receivable',10000,'NGN'),(capture_key,2,'liability.marketplace_sales_unallocated',-10000,'NGN');
  return order_key;
end;$function$;

do $setup$
declare first_course bigint; second_course bigint; first_order bigint; second_order bigint; first_allocation bigint; second_allocation bigint;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    ('22222222-2222-4222-8222-222222222221','authenticated','authenticated','phase1c2a-owner@example.test',now(),now()),
    ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','phase1c2a-other@example.test',now(),now()),
    ('22222222-2222-4222-8222-222222222223','authenticated','authenticated','phase1c2a-learner@example.test',now(),now()),
    ('22222222-2222-4222-8222-222222222224','authenticated','authenticated','phase1c2a-admin@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    ('22222222-2222-4222-8222-222222222221','phase1c2a-owner@example.test','Phase 1C2A Owner','complete'),
    ('22222222-2222-4222-8222-222222222222','phase1c2a-other@example.test','Phase 1C2A Other','complete'),
    ('22222222-2222-4222-8222-222222222223','phase1c2a-learner@example.test','Phase 1C2A Learner','complete'),
    ('22222222-2222-4222-8222-222222222224','phase1c2a-admin@example.test','Phase 1C2A Admin','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    ('22222222-2222-4222-8222-222222222221','instructor','active'),
    ('22222222-2222-4222-8222-222222222222','instructor','active'),
    ('22222222-2222-4222-8222-222222222224','admin','active') on conflict(user_id,capability) do nothing;
  insert into public.instructor_profiles(user_id,approval_status) values
    ('22222222-2222-4222-8222-222222222221','approved'),
    ('22222222-2222-4222-8222-222222222222','approved') on conflict(user_id) do nothing;
  insert into public.learning_courses(instructor_id,title,slug,price_amount,price_currency,is_free,is_limited_time_free,status) values
    ('22222222-2222-4222-8222-222222222221','Phase 1C2A owner course','phase1c2a-owner-course',100,'NGN',false,false,'draft'),
    ('22222222-2222-4222-8222-222222222222','Phase 1C2A other course','phase1c2a-other-course',100,'NGN',false,false,'draft') on conflict(slug) do nothing;
  select id into first_course from public.learning_courses where slug='phase1c2a-owner-course';
  select id into second_course from public.learning_courses where slug='phase1c2a-other-course';
  first_order:=pg_temp.phase1c2_create_paid_order(first_course,'22222222-2222-4222-8222-222222222221','paid',now()-interval '1 day');
  second_order:=pg_temp.phase1c2_create_paid_order(second_course,'22222222-2222-4222-8222-222222222222','paid',now()-interval '15 days');
  first_allocation:=public.allocate_learning_order_commercial_terms(first_order,null);
  second_allocation:=public.allocate_learning_order_commercial_terms(second_order,null);
  perform public.release_matured_learning_instructor_earnings(100,null);
  if not exists(select 1 from public.learning_instructor_earnings where allocation_id=first_allocation and status='held')
    or not exists(select 1 from public.learning_instructor_earnings where allocation_id=second_allocation and status='available') then
    raise exception 'Phase 1C2A fixture earnings were not created with expected held and available status';
  end if;
end $setup$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222221',true);
do $owner$
declare row_count integer; held_total bigint; available_total bigint; terms text;
begin
  select count(*),coalesce(sum(instructor_gross_minor) filter(where earning_status='held'),0),coalesce(sum(instructor_gross_minor) filter(where earning_status='available'),0),min(commercial_terms_version)
  into row_count,held_total,available_total,terms from public.get_own_learning_instructor_earnings();
  if row_count<>1 or held_total<>7500 or available_total<>0 or terms<>'growvelt-commercial-v1' then raise exception 'Instructor earnings reader did not return only authoritative own earning'; end if;
  if not exists(select 1 from public.list_own_learning_instructor_earning_events() where event_type='earning.held') then raise exception 'Instructor immutable earning history was not exposed'; end if;
  if has_table_privilege('authenticated','public.learning_instructor_earnings','select') or has_function_privilege('authenticated','public.list_learning_commercial_operations(uuid,integer)','execute') then raise exception 'Browser financial-table or admin commercial access is exposed'; end if;
end $owner$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $other_instructor$
begin
  if (select count(*) from public.get_own_learning_instructor_earnings())<>1 then raise exception 'Other instructor ownership scope failed'; end if;
  if exists(select 1 from public.get_own_learning_instructor_earnings() where course_title='Phase 1C2A owner course') then raise exception 'Instructor crossed ownership boundary'; end if;
end $other_instructor$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222223',true);
do $learner$
declare blocked boolean:=false;
begin
  begin perform public.get_own_learning_instructor_earnings(); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Non-instructor read instructor earnings'; end if;
end $learner$;

reset role;
do $admin$
declare rows_count integer; issue_count bigint;
begin
  select count(*),coalesce(sum(reconciliation_issue_count),0) into rows_count,issue_count from public.list_learning_commercial_operations('22222222-2222-4222-8222-222222222224',100);
  if rows_count<>2 or issue_count<>0 then raise exception 'Admin commercial review did not match authoritative data'; end if;
  begin perform public.list_learning_commercial_operations('22222222-2222-4222-8222-222222222223',100); raise exception 'Non-admin commercial review was accepted'; exception when insufficient_privilege then null; end;
end $admin$;

rollback;
