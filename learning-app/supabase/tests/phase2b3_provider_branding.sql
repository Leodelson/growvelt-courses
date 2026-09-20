begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333401';
  member_id uuid := '33333333-3333-4333-8333-333333333402';
  admin_id uuid := '33333333-3333-4333-8333-333333333403';
  organization_key bigint;
  course_key bigint;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase2b3-owner@example.test',now(),now()),
    (member_id,'authenticated','authenticated','phase2b3-member@example.test',now(),now()),
    (admin_id,'authenticated','authenticated','phase2b3-admin@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase2b3-owner@example.test','Phase 2B3 Owner','complete'),
    (member_id,'phase2b3-member@example.test','Phase 2B3 Member','complete'),
    (admin_id,'phase2b3-admin@example.test','Phase 2B3 Admin','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (owner_id,'instructor','active'),(member_id,'instructor','active'),(admin_id,'admin','active') on conflict(user_id,capability) do update set status='active',revoked_at=null,revoked_by=null,reason=null;
  insert into public.instructor_profiles(user_id,approval_status) values(owner_id,'approved'),(member_id,'approved') on conflict(user_id) do update set approval_status='approved';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select result.organization_id into organization_key from public.create_own_learning_provider_organization('Phase 2B3 Branding Academy','phase2b3-branding-academy') as result;
  perform public.update_own_learning_provider_organization_profile(organization_key,'Practical technology training for growing teams','This provider offers hands-on learning programs that help ambitious learners build practical technology skills, apply knowledge confidently, and make meaningful progress in their careers.','branding@example.test','https://example.test',null,null);
  perform public.update_own_learning_provider_organization_profile_media(organization_key,'logo',organization_key::text || '/logos/11111111-1111-4111-8111-111111111111.png');
  perform public.update_own_learning_provider_organization_profile_media(organization_key,'cover',organization_key::text || '/covers/22222222-2222-4222-8222-222222222222.webp');
  if not exists(select 1 from public.get_own_learning_provider_organization_profile_branding(organization_key) where logo_storage_path like '%/logos/%' and cover_storage_path like '%/covers/%') then raise exception 'Owner could not read the private provider branding draft'; end if;
  if exists(select 1 from public.get_public_learning_provider_organization_profile_branding('phase2b3-branding-academy')) then raise exception 'Unverified provider branding was public'; end if;

  perform public.submit_own_learning_provider_organization_verification(organization_key,'Phase 2B3 Branding Academy Ltd','verification@example.test','https://example.test','I am authorized to represent this training provider and confirm these details are accurate.');
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform public.review_learning_provider_organization_verification(organization_key,'verified','Provider details reviewed and approved.');
  if not exists(select 1 from public.get_public_learning_provider_organization_profile_branding('phase2b3-branding-academy') where name='Phase 2B3 Branding Academy' and logo_storage_path like '%/logos/%' and cover_storage_path like '%/covers/%') then raise exception 'Verified provider branding was not public'; end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select course_id into course_key from public.create_learning_organization_course_draft(organization_key,'Verified provider course','A concise course summary','This verified provider course has enough detailed content to confirm its public provider attribution in the test fixture.','Business','Beginner',true,0,'NGN');
  update public.learning_courses set status = 'published', published_at = now() where id = course_key;
  if not exists(select 1 from public.list_public_learning_provider_courses('phase2b3-branding-academy',12) where course_id = course_key) then raise exception 'Verified provider course was not available from the public provider listing'; end if;

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  begin
    perform public.update_own_learning_provider_organization_profile_media(organization_key,'logo',organization_key::text || '/logos/33333333-3333-4333-8333-333333333333.png');
    raise exception 'Non-owner changed provider branding';
  exception when sqlstate '42501' then null;
  end;
end $test$;

rollback;
