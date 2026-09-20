begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333381';
  admin_id uuid := '33333333-3333-4333-8333-333333333382';
  organization_key bigint;
  verification_status text;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase2b-owner@example.test',now(),now()),
    (admin_id,'authenticated','authenticated','phase2b-admin@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase2b-owner@example.test','Phase 2B Owner','complete'),
    (admin_id,'phase2b-admin@example.test','Phase 2B Admin','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (owner_id,'instructor','active'),(admin_id,'admin','active') on conflict(user_id,capability) do update set status='active',revoked_at=null,revoked_by=null,reason=null;
  insert into public.instructor_profiles(user_id,approval_status) values(owner_id,'approved') on conflict(user_id) do update set approval_status='approved';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select result.organization_id into organization_key from public.create_own_learning_provider_organization('Phase 2B Verification Academy','phase2b-verification-academy') as result;
  perform public.submit_own_learning_provider_organization_verification(organization_key,'Phase 2B Verification Academy Ltd','verification@example.test','https://example.test','I am authorized to represent this training provider and confirm these details are accurate.');
  select status into verification_status from public.learning_provider_organization_verifications where organization_id=organization_key;
  if verification_status <> 'pending' then raise exception 'Provider verification was not submitted'; end if;

  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  if not exists(select 1 from public.list_pending_learning_provider_organization_verifications() where organization_id=organization_key) then raise exception 'Admin could not read pending provider verification'; end if;
  perform public.review_learning_provider_organization_verification(organization_key,'verified','Details reviewed and approved.');

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  if not exists(select 1 from public.list_own_learning_provider_organization_verifications() where organization_id=organization_key and status='verified') then raise exception 'Owner could not read verified provider status'; end if;
end $test$;

rollback;
