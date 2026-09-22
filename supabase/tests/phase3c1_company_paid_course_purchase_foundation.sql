begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333801';
  employee_one_id uuid := '33333333-3333-4333-8333-333333333802';
  employee_two_id uuid := '33333333-3333-4333-8333-333333333803';
  outsider_id uuid := '33333333-3333-4333-8333-333333333804';
  workspace_key bigint;
  first_invitation bigint;
  second_invitation bigint;
  paid_course_key bigint;
  purchase_key bigint;
  blocked boolean := false;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase3c1-owner@example.test',now(),now()),
    (employee_one_id,'authenticated','authenticated','phase3c1-employee-one@example.test',now(),now()),
    (employee_two_id,'authenticated','authenticated','phase3c1-employee-two@example.test',now(),now()),
    (outsider_id,'authenticated','authenticated','phase3c1-outsider@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase3c1-owner@example.test','Phase 3C1 Owner','complete'),
    (employee_one_id,'phase3c1-employee-one@example.test','Phase 3C1 Employee One','complete'),
    (employee_two_id,'phase3c1-employee-two@example.test','Phase 3C1 Employee Two','complete'),
    (outsider_id,'phase3c1-outsider@example.test','Phase 3C1 Outsider','complete') on conflict(id) do nothing;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select workspace_id into workspace_key from public.create_own_learning_company_workspace('Phase 3C1 Test Company','phase3c1-test-company');
  select invitation_id into first_invitation from public.create_learning_company_invitation(workspace_key,'phase3c1-employee-one@example.test','member');
  select invitation_id into second_invitation from public.create_learning_company_invitation(workspace_key,'phase3c1-employee-two@example.test','member');
  perform set_config('request.jwt.claim.sub',employee_one_id::text,true); perform public.respond_to_learning_company_invitation(first_invitation,'accepted');
  perform set_config('request.jwt.claim.sub',employee_two_id::text,true); perform public.respond_to_learning_company_invitation(second_invitation,'accepted');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);

  insert into public.learning_courses(instructor_id,title,slug,is_free,is_limited_time_free,price_amount,price_currency,status,published_at)
  values(owner_id,'Phase 3C1 Paid Course','phase3c1-paid-course',false,false,12500,'NGN','published',now()) returning id into paid_course_key;
  if not exists(select 1 from public.list_own_learning_company_paid_courses(workspace_key) where course_id=paid_course_key) then raise exception 'Manager could not list published paid catalog courses'; end if;
  select result.purchase_id into purchase_key from public.prepare_learning_company_paid_course_purchase(workspace_key,paid_course_key,array[employee_one_id,employee_two_id]) result;
  if purchase_key is null or not exists(select 1 from public.learning_company_paid_course_purchases where id=purchase_key and seat_count=2 and unit_amount_minor=1250000 and total_amount_minor=2500000 and status='checkout_ready') then raise exception 'Paid company purchase did not snapshot the expected price and seats'; end if;
  if (select count(*) from public.learning_company_paid_course_purchase_seats where purchase_id=purchase_key)<>2 then raise exception 'Purchase seats were not retained'; end if;
  if exists(select 1 from public.enrollments where learner_id in(employee_one_id,employee_two_id) and course_id=paid_course_key) then raise exception 'Preparing checkout granted paid course access'; end if;
  if not exists(select 1 from public.list_own_learning_company_paid_course_purchases(workspace_key) where purchase_id=purchase_key and total_amount_minor=2500000) then raise exception 'Manager could not read their prepared purchase'; end if;
  begin perform public.prepare_learning_company_paid_course_purchase(workspace_key,paid_course_key,array[employee_one_id]); exception when sqlstate '23505' then blocked:=true; end;
  if not blocked then raise exception 'Duplicate employee course purchase was accepted'; end if;
  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  blocked := false;
  begin perform public.prepare_learning_company_paid_course_purchase(workspace_key,paid_course_key,array[employee_one_id]); exception when sqlstate '42501' then blocked:=true; end;
  if not blocked then raise exception 'Outsider prepared a company purchase'; end if;
end $test$;

do $security$
begin
  if has_table_privilege('authenticated','public.learning_company_paid_course_purchases','select') or has_table_privilege('authenticated','public.learning_company_paid_course_purchase_seats','select') then raise exception 'Browser role can directly read company purchase records'; end if;
end $security$;

rollback;
