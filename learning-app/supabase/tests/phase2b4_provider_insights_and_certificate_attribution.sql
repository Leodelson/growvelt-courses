begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333501';
  member_id uuid := '33333333-3333-4333-8333-333333333502';
  learner_id uuid := '33333333-3333-4333-8333-333333333503';
  organization_key bigint;
  course_key bigint;
  insight_row record;
  verification_row record;
  blocked boolean := false;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase2b4-owner@example.test',now(),now()),
    (member_id,'authenticated','authenticated','phase2b4-member@example.test',now(),now()),
    (learner_id,'authenticated','authenticated','phase2b4-learner@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase2b4-owner@example.test','Phase 2B4 Owner','complete'),
    (member_id,'phase2b4-member@example.test','Phase 2B4 Member','complete'),
    (learner_id,'phase2b4-learner@example.test','Phase 2B4 Learner','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (owner_id,'instructor','active'),(member_id,'instructor','active') on conflict(user_id,capability) do update set status='active',revoked_at=null,revoked_by=null,reason=null;
  insert into public.instructor_profiles(user_id,approval_status) values(owner_id,'approved'),(member_id,'approved') on conflict(user_id) do update set approval_status='approved';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select result.organization_id into organization_key from public.create_own_learning_provider_organization('Phase 2B4 Reporting Academy','phase2b4-reporting-academy') result;
  insert into public.learning_provider_organization_memberships(organization_id,user_id,role,granted_by)
  values(organization_key,member_id,'instructor',owner_id);
  select course_id into course_key from public.create_learning_organization_course_draft(
    organization_key,'Provider reporting course','A concise course summary','This organization course has sufficient detail to validate aggregate provider reporting without exposing private learner or instructor records.','Business','Beginner',true,0,'NGN'
  );
  update public.learning_courses set status='published',published_at=now() where id=course_key;
  insert into public.enrollments(learner_id,course_id,status,enrolled_at,completed_at) values(learner_id,course_key,'completed',now()-interval '2 days',now()-interval '1 day');
  insert into public.certificates(learner_id,course_id,certificate_code,learner_name,course_title,instructor_name,completed_at,status,provider_organization_id,provider_name,provider_slug,provider_was_verified)
  values(learner_id,course_key,'A2B4C2D4E2F4A2B4C2D4E2F4A2B4C2D4','Phase 2B4 Learner','Provider reporting course','Phase 2B4 Owner',now()-interval '1 day','issued',organization_key,'Phase 2B4 Reporting Academy','phase2b4-reporting-academy',false);

  select * into insight_row from public.get_own_learning_provider_organization_insights(organization_key) where course_id=course_key;
  if insight_row.enrolled_learner_count <> 1 or insight_row.completed_learner_count <> 1 or insight_row.issued_certificate_count <> 1 or insight_row.gross_sales_minor <> 0 then
    raise exception 'Provider insight aggregates were unexpected';
  end if;
  select * into verification_row from public.verify_learning_certificate('A2B4C2D4E2F4A2B4C2D4E2F4A2B4C2D4');
  if verification_row.provider_name <> 'Phase 2B4 Reporting Academy' or verification_row.provider_slug <> 'phase2b4-reporting-academy' then
    raise exception 'Certificate provider attribution was unavailable to public verification';
  end if;

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  begin
    perform public.get_own_learning_provider_organization_insights(organization_key);
  exception when sqlstate '42501' then blocked := true;
  end;
  if not blocked then raise exception 'Non-owner could read provider reporting'; end if;
end $test$;

do $security$
begin
  if has_function_privilege('anon','public.get_own_learning_provider_organization_insights(bigint)','execute') then
    raise exception 'Anonymous role can read provider reporting';
  end if;
end $security$;

rollback;
