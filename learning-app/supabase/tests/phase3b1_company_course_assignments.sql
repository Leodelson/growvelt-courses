begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333701';
  employee_id uuid := '33333333-3333-4333-8333-333333333702';
  outsider_id uuid := '33333333-3333-4333-8333-333333333703';
  workspace_key bigint;
  invitation_key bigint;
  course_key bigint;
  paid_course_key bigint;
  assignment_key bigint;
  access_state text;
  blocked boolean := false;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase3b1-owner@example.test',now(),now()),
    (employee_id,'authenticated','authenticated','phase3b1-employee@example.test',now(),now()),
    (outsider_id,'authenticated','authenticated','phase3b1-outsider@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase3b1-owner@example.test','Phase 3B1 Owner','complete'),
    (employee_id,'phase3b1-employee@example.test','Phase 3B1 Employee','complete'),
    (outsider_id,'phase3b1-outsider@example.test','Phase 3B1 Outsider','complete') on conflict(id) do nothing;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select workspace_id into workspace_key from public.create_own_learning_company_workspace('Phase 3B1 Test Company','phase3b1-test-company');
  select invitation_id into invitation_key from public.create_learning_company_invitation(workspace_key,'phase3b1-employee@example.test','member');
  perform set_config('request.jwt.claim.sub',employee_id::text,true);
  perform public.respond_to_learning_company_invitation(invitation_key,'accepted');
  perform set_config('request.jwt.claim.sub',owner_id::text,true);

  insert into public.learning_courses(instructor_id,title,slug,is_free,is_limited_time_free,status,published_at) values
    (owner_id,'Phase 3B1 Free Course','phase3b1-free-course',true,false,'published',now()) returning id into course_key;
  insert into public.learning_courses(instructor_id,title,slug,is_free,is_limited_time_free,status,published_at) values
    (owner_id,'Phase 3B1 Paid Course','phase3b1-paid-course',false,false,'published',now()) returning id into paid_course_key;
  select result.assignment_id, result.access_state into assignment_key, access_state from public.assign_learning_company_course(workspace_key,course_key,employee_id) result;
  if assignment_key is null or access_state <> 'assigned' or not exists(select 1 from public.enrollments where learner_id=employee_id and course_id=course_key and status='active') then raise exception 'Company free-course assignment did not create learner access'; end if;
  if not exists(select 1 from public.list_own_learning_company_course_assignments(workspace_key) where assignment_id=assignment_key and progress_percent=0) then raise exception 'Company manager could not read assignment progress'; end if;

  perform set_config('request.jwt.claim.sub',employee_id::text,true);
  if not exists(select 1 from public.list_own_learning_company_assigned_courses() where assignment_id=assignment_key and course_id=course_key) then raise exception 'Employee could not read their company assignment'; end if;
  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  begin perform public.assign_learning_company_course(workspace_key,course_key,employee_id); exception when sqlstate '42501' then blocked:=true; end;
  if not blocked then raise exception 'Outsider assigned a company course'; end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  begin perform public.assign_learning_company_course(workspace_key,paid_course_key,employee_id); raise exception 'Paid course was assigned before company billing'; exception when sqlstate '22023' then null; end;
end $test$;

do $security$
begin
  if has_table_privilege('authenticated','public.learning_company_course_assignments','select') then raise exception 'Browser role can directly read company assignments'; end if;
end $security$;

rollback;
