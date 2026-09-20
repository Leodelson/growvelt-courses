begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333331';
  organization_key bigint;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at)
  values(owner_id,'authenticated','authenticated','phase2a1-owner@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status)
  values(owner_id,'phase2a1-owner@example.test','Phase 2A1 Owner','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status)
  values(owner_id,'instructor','active') on conflict(user_id,capability) do update set status='active',revoked_at=null,revoked_by=null,reason=null;
  insert into public.instructor_profiles(user_id,approval_status)
  values(owner_id,'approved') on conflict(user_id) do update set approval_status='approved';
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select organization_id into organization_key from public.create_own_learning_provider_organization('Phase 2A1 Test Academy','phase2a1-test-academy');
  if organization_key is null
    or not exists(select 1 from public.learning_provider_organization_memberships where organization_id=organization_key and user_id=owner_id and role='owner' and status='active')
    or not exists(select 1 from public.learning_provider_organization_membership_events where organization_id=organization_key and user_id=owner_id and event_type='membership.created') then
    raise exception 'Organization owner membership was not created atomically';
  end if;
  begin
    perform public.create_own_learning_provider_organization('A second test academy','phase2a1-second-test-academy');
    raise exception 'Second provider workspace unexpectedly succeeded';
  exception when sqlstate 'P0001' then
    -- Expected: a provider owner keeps one provider workspace and invites its team.
    null;
  end;
end $test$;

do $security$
begin
  if has_table_privilege('authenticated','public.learning_provider_organizations','select')
    or has_table_privilege('authenticated','public.learning_provider_organization_memberships','select')
    or has_table_privilege('authenticated','public.learning_provider_organization_membership_events','select') then
    raise exception 'Browser role can directly read organization provider tables';
  end if;
end $security$;

rollback;
