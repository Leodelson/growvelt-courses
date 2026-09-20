begin;

do $test$
declare
  organization_owner_id uuid := '33333333-3333-4333-8333-333333333371';
  organization_id bigint;
  deletion_outcome text;
  direct_deletion_blocked boolean := false;
begin
  insert into auth.users(id, aud, role, email, created_at, updated_at)
  values (organization_owner_id, 'authenticated', 'authenticated', 'phase2a-deletion-owner@example.test', now(), now())
  on conflict (id) do nothing;

  insert into public.profiles(id, email, full_name, onboarding_status)
  values (organization_owner_id, 'phase2a-deletion-owner@example.test', 'Phase 2A Deletion Owner', 'complete')
  on conflict (id) do nothing;

  insert into public.account_capabilities(user_id, capability, status)
  values (organization_owner_id, 'instructor', 'active')
  on conflict (user_id, capability) do update set status = 'active', revoked_at = null, revoked_by = null, reason = null;

  insert into public.instructor_profiles(user_id, approval_status)
  values (organization_owner_id, 'approved')
  on conflict (user_id) do update set approval_status = 'approved';

  perform set_config('request.jwt.claim.sub', organization_owner_id::text, true);
  select result.organization_id
  into organization_id
  from public.create_own_learning_provider_organization('Phase 2A Deletion Test Academy', 'phase2a-deletion-test-academy') as result;

  select outcome
  into deletion_outcome
  from public.request_own_learning_account_deletion('remove_public_verification');

  if deletion_outcome <> 'organization_offboarding_required' then
    raise exception 'Organization owner deletion preflight returned %', deletion_outcome;
  end if;

  begin
    delete from public.profiles where id = organization_owner_id;
  exception when insufficient_privilege then
    direct_deletion_blocked := true;
  end;

  if not direct_deletion_blocked then
    raise exception 'Organization record protection did not block direct profile deletion';
  end if;
end $test$;

rollback;
