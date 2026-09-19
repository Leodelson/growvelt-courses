begin;

do $test$
declare
  member_id uuid := '33333333-3333-4333-8333-333333333351';
  outsider_id uuid := '33333333-3333-4333-8333-333333333352';
  organization_key bigint;
  course_key bigint;
  blocked boolean := false;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (member_id,'authenticated','authenticated','phase2a3-member@example.test',now(),now()),
    (outsider_id,'authenticated','authenticated','phase2a3-outsider@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (member_id,'phase2a3-member@example.test','Phase 2A3 Member','complete'),
    (outsider_id,'phase2a3-outsider@example.test','Phase 2A3 Outsider','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (member_id,'instructor','active'),(outsider_id,'instructor','active') on conflict(user_id,capability) do update set status='active',revoked_at=null,revoked_by=null,reason=null;
  insert into public.instructor_profiles(user_id,approval_status) values
    (member_id,'approved'),(outsider_id,'approved') on conflict(user_id) do update set approval_status='approved';

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  select organization_id into organization_key from public.create_own_learning_provider_organization('Phase 2A3 Academy','phase2a3-academy');
  select course_id into course_key from public.create_learning_organization_course_draft(
    organization_key,'Organization course draft','A concise course summary','This organization course draft has enough descriptive detail for the test fixture.','Business','Beginner',true,0,'NGN'
  );
  if course_key is null or not exists (
    select 1 from public.learning_courses course
    where course.id=course_key and course.organization_id=organization_key and course.instructor_id=member_id and course.status='draft'
  ) then
    raise exception 'Organization course draft was not attributed to its active member and organization';
  end if;
  if not exists(select 1 from public.learning_audit_events where entity_type='learning_course' and entity_id=course_key::text and action='provider_organization.course_draft_created') then
    raise exception 'Organization course attribution was not audited';
  end if;

  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  begin
    perform public.create_learning_organization_course_draft(organization_key,'Unauthorized course','A concise course summary','This organization course draft has enough descriptive detail for the test fixture.','Business','Beginner',true,0,'NGN');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Non-member created an organization course'; end if;

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  blocked := false;
  begin
    update public.learning_courses set organization_id=null where id=course_key;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'Course organization attribution was mutable'; end if;
end $test$;

do $security$
begin
  if has_function_privilege('authenticated','public.prevent_learning_course_organization_attribution_mutation()','execute') then
    raise exception 'Browser role can invoke organization attribution trigger function';
  end if;
end $security$;

rollback;
