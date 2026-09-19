begin;

do $test$
declare applicant_id uuid := '44444444-4444-4444-8444-444444444441';
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at)
  values(applicant_id,'authenticated','authenticated','application-read@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status)
  values(applicant_id,'application-read@example.test','Application Read Test','complete') on conflict(id) do nothing;
  insert into public.instructor_profiles(user_id,headline,bio,expertise,country,years_experience,teaching_experience,motivation,approval_status)
  values(applicant_id,'Application reader','A test application used to prove secure self-service status reads.',array['Testing'],'Nigeria',2,'Test teaching experience','Test motivation','pending') on conflict(user_id) do nothing;

  perform set_config('request.jwt.claim.sub',applicant_id::text,true);
  if not exists(select 1 from public.get_own_instructor_application() application where application.approval_status='pending' and application.headline='Application reader') then
    raise exception 'Applicant could not read their own Instructor application';
  end if;

  perform set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444442',true);
  if exists(select 1 from public.get_own_instructor_application()) then
    raise exception 'A different user could read another applicant Instructor application';
  end if;
end $test$;

do $security$
begin
  if has_function_privilege('anon','public.get_own_instructor_application()','execute') then
    raise exception 'Anonymous users can read Instructor applications';
  end if;
end $security$;

rollback;
