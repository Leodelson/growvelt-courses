begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333391';
  member_id uuid := '33333333-3333-4333-8333-333333333392';
  admin_id uuid := '33333333-3333-4333-8333-333333333393';
  organization_key bigint;
  changed boolean := false;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase2b2-owner@example.test',now(),now()),
    (member_id,'authenticated','authenticated','phase2b2-member@example.test',now(),now()),
    (admin_id,'authenticated','authenticated','phase2b2-admin@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase2b2-owner@example.test','Phase 2B2 Owner','complete'),
    (member_id,'phase2b2-member@example.test','Phase 2B2 Member','complete'),
    (admin_id,'phase2b2-admin@example.test','Phase 2B2 Admin','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (owner_id,'instructor','active'),(member_id,'instructor','active'),(admin_id,'admin','active') on conflict(user_id,capability) do update set status='active',revoked_at=null,revoked_by=null,reason=null;
  insert into public.instructor_profiles(user_id,approval_status) values(owner_id,'approved'),(member_id,'approved') on conflict(user_id) do update set approval_status='approved';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select result.organization_id into organization_key from public.create_own_learning_provider_organization('Phase 2B2 Profile Academy','phase2b2-profile-academy') as result;

  begin
    perform public.update_own_learning_provider_organization_profile(organization_key,'Practical technology training for teams','This provider offers hands-on programs that help learners build confident, practical technology skills for meaningful work and measurable growth.','profiles@example.test','https://example.test','https://www.linkedin.com/company/example','https://www.instagram.com/example');
    raise exception 'Unverified provider profile update unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;

  perform public.submit_own_learning_provider_organization_verification(organization_key,'Phase 2B2 Profile Academy Ltd','verification@example.test','https://example.test','I am authorized to represent this training provider and confirm these details are accurate.');
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  perform public.review_learning_provider_organization_verification(organization_key,'verified','Details reviewed and approved.');

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.update_own_learning_provider_organization_profile(organization_key,'Practical technology training for teams','This provider offers hands-on programs that help learners build confident, practical technology skills for meaningful work and measurable growth.','profiles@example.test','https://example.test','https://www.linkedin.com/company/example','https://www.instagram.com/example');
  if not exists(select 1 from public.list_own_learning_provider_organization_profiles() where organization_id=organization_key and headline='Practical technology training for teams') then raise exception 'Owner could not read saved provider profile'; end if;
  if not exists(select 1 from public.get_public_learning_provider_organization_profile('phase2b2-profile-academy') where name='Phase 2B2 Profile Academy') then raise exception 'Verified provider profile was not public'; end if;

  perform set_config('request.jwt.claim.sub',member_id::text,true);
  begin
    perform public.update_own_learning_provider_organization_profile(organization_key,'Practical technology training for teams','This provider offers hands-on programs that help learners build confident, practical technology skills for meaningful work and measurable growth.','profiles@example.test','https://example.test',null,null);
    raise exception 'Non-owner provider profile update unexpectedly succeeded';
  exception when sqlstate '42501' then null;
  end;

  begin
    update public.learning_provider_organization_profile_events set event_type='profile.updated' where organization_id=organization_key;
    changed := true;
  exception when sqlstate '42501' then null;
  end;
  if changed then raise exception 'Provider profile event mutation unexpectedly succeeded'; end if;
end $test$;

rollback;
