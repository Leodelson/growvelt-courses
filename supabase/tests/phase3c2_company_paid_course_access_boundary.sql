begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333901';
  employee_one_id uuid := '33333333-3333-4333-8333-333333333902';
  employee_two_id uuid := '33333333-3333-4333-8333-333333333903';
  outsider_id uuid := '33333333-3333-4333-8333-333333333904';
  workspace_key bigint; invitation_one bigint; invitation_two bigint; course_key bigint; purchase_key bigint; attempt_key bigint; payment_reference text; granted_count integer; blocked boolean := false;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase3c2-owner@example.test',now(),now()),
    (employee_one_id,'authenticated','authenticated','phase3c2-employee-one@example.test',now(),now()),
    (employee_two_id,'authenticated','authenticated','phase3c2-employee-two@example.test',now(),now()),
    (outsider_id,'authenticated','authenticated','phase3c2-outsider@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase3c2-owner@example.test','Phase 3C2 Owner','complete'),
    (employee_one_id,'phase3c2-employee-one@example.test','Phase 3C2 Employee One','complete'),
    (employee_two_id,'phase3c2-employee-two@example.test','Phase 3C2 Employee Two','complete'),
    (outsider_id,'phase3c2-outsider@example.test','Phase 3C2 Outsider','complete') on conflict(id) do nothing;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select workspace_id into workspace_key from public.create_own_learning_company_workspace('Phase 3C2 Test Company','phase3c2-test-company');
  select invitation_id into invitation_one from public.create_learning_company_invitation(workspace_key,'phase3c2-employee-one@example.test','member');
  select invitation_id into invitation_two from public.create_learning_company_invitation(workspace_key,'phase3c2-employee-two@example.test','member');
  perform set_config('request.jwt.claim.sub',employee_one_id::text,true); perform public.respond_to_learning_company_invitation(invitation_one,'accepted');
  perform set_config('request.jwt.claim.sub',employee_two_id::text,true); perform public.respond_to_learning_company_invitation(invitation_two,'accepted');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  insert into public.learning_courses(instructor_id,title,slug,is_free,is_limited_time_free,price_amount,price_currency,status,published_at)
  values(owner_id,'Phase 3C2 Paid Course','phase3c2-paid-course',false,false,7500,'NGN','published',now()) returning id into course_key;
  select result.purchase_id into purchase_key from public.prepare_learning_company_paid_course_purchase(workspace_key,course_key,array[employee_one_id,employee_two_id]) result;
  select result.attempt_id,result.provider_reference into attempt_key,payment_reference from public.start_learning_company_paid_course_checkout(purchase_key) result;
  if attempt_key is null or payment_reference !~ '^CP-[A-F0-9]{32}$' or not exists(select 1 from public.learning_company_paid_course_purchases where id=purchase_key and status='checkout_pending') then raise exception 'Checkout lifecycle did not create a protected pending attempt'; end if;
  if (select count(*) from public.learning_company_paid_course_purchase_attempts where id=attempt_key and amount_minor=1500000 and status='initialized') <> 1 then raise exception 'Checkout attempt did not retain the locked amount'; end if;
  if exists(select 1 from public.enrollments where learner_id in(employee_one_id,employee_two_id) and course_id=course_key) then raise exception 'Starting checkout granted paid course access'; end if;
  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  begin perform public.start_learning_company_paid_course_checkout(purchase_key); exception when sqlstate '42501' then blocked := true; end;
  if not blocked then raise exception 'Outsider started a company checkout'; end if;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select result.granted_seat_count into granted_count from public.finalize_learning_company_paid_course_purchase_by_reference(payment_reference,'phase3c2-provider-transaction',1500000,'NGN','test') result;
  if granted_count <> 2 or not exists(select 1 from public.learning_company_paid_course_purchases where id=purchase_key and status='paid' and paid_at is not null) then raise exception 'Trusted finalization did not complete the company purchase'; end if;
  if (select count(*) from public.enrollments where learner_id in(employee_one_id,employee_two_id) and course_id=course_key and status='active') <> 2 then raise exception 'Paid purchase did not grant employee enrollments'; end if;
  if (select count(*) from public.learning_company_course_assignments where workspace_id=workspace_key and course_id=course_key and assigned_user_id in(employee_one_id,employee_two_id) and status='active') <> 2 then raise exception 'Paid purchase did not create private company assignments'; end if;
  select result.granted_seat_count into granted_count from public.finalize_learning_company_paid_course_purchase_by_reference(payment_reference,'phase3c2-provider-transaction',1500000,'NGN','test') result;
  if granted_count <> 2 then raise exception 'Finalization was not idempotent'; end if;
end $test$;

do $security$
begin
  if has_table_privilege('authenticated','public.learning_company_paid_course_purchase_attempts','select') then raise exception 'Browser role can directly read company payment attempts'; end if;
  if has_function_privilege('authenticated','public.grant_paid_learning_company_purchase_access(bigint)','execute') or has_function_privilege('authenticated','public.finalize_learning_company_paid_course_purchase(bigint,text,text)','execute') then raise exception 'Browser role can finalize or grant company paid access'; end if;
end $security$;

rollback;
