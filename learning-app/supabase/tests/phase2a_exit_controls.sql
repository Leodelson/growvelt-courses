begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333361';
  invitee_id uuid := '33333333-3333-4333-8333-333333333362';
  outsider_id uuid := '33333333-3333-4333-8333-333333333363';
  organization_key bigint; declined_invitation_key bigint; accepted_invitation_key bigint; membership_key bigint; blocked boolean := false;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase2a-exit-owner@example.test',now(),now()),
    (invitee_id,'authenticated','authenticated','phase2a-exit-invitee@example.test',now(),now()),
    (outsider_id,'authenticated','authenticated','phase2a-exit-outsider@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase2a-exit-owner@example.test','Phase 2A Exit Owner','complete'),
    (invitee_id,'phase2a-exit-invitee@example.test','Phase 2A Exit Invitee','complete'),
    (outsider_id,'phase2a-exit-outsider@example.test','Phase 2A Exit Outsider','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (owner_id,'instructor','active'),(invitee_id,'instructor','active'),(outsider_id,'instructor','active') on conflict(user_id,capability) do update set status='active',revoked_at=null,revoked_by=null,reason=null;
  insert into public.instructor_profiles(user_id,approval_status) values
    (owner_id,'approved'),(invitee_id,'approved'),(outsider_id,'approved') on conflict(user_id) do update set approval_status='approved';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select organization_id into organization_key from public.create_own_learning_provider_organization('Phase 2A Exit Academy','phase2a-exit-academy');
  select invitation_id into declined_invitation_key from public.create_learning_provider_organization_invitation(organization_key,'phase2a-exit-invitee@example.test','instructor');

  perform set_config('request.jwt.claim.sub',invitee_id::text,true);
  perform public.decline_own_learning_provider_organization_invitation(declined_invitation_key);
  if not exists(select 1 from public.learning_provider_organization_invitations where id=declined_invitation_key and status='cancelled' and responded_at is not null)
    or not exists(select 1 from public.learning_provider_organization_invitation_events where invitation_id=declined_invitation_key and event_type='invitation.cancelled' and metadata->>'source'='invitee.declined') then
    raise exception 'Invitee decline was not durably recorded';
  end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select invitation_id into accepted_invitation_key from public.create_learning_provider_organization_invitation(organization_key,'phase2a-exit-invitee@example.test','instructor');
  perform set_config('request.jwt.claim.sub',invitee_id::text,true);
  select membership_id into membership_key from public.accept_own_learning_provider_organization_invitation(accepted_invitation_key);
  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  begin perform public.revoke_own_learning_provider_organization_member(organization_key,invitee_id,null); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Non-owner revoked an organization member'; end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.revoke_own_learning_provider_organization_member(organization_key,invitee_id,'Test removal');
  if not exists(select 1 from public.learning_provider_organization_memberships where id=membership_key and status='revoked' and ended_at is not null and end_reason='Test removal')
    or not exists(select 1 from public.learning_provider_organization_membership_events where membership_id=membership_key and event_type='membership.revoked') then
    raise exception 'Owner member revocation was not durably recorded';
  end if;
  blocked:=false;
  begin perform public.revoke_own_learning_provider_organization_member(organization_key,owner_id,null); exception when invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'Organization owner could be removed'; end if;

  select invitation_id into accepted_invitation_key from public.create_learning_provider_organization_invitation(organization_key,'phase2a-exit-outsider@example.test','instructor');
  perform public.cancel_own_learning_provider_organization_invitation(organization_key,accepted_invitation_key);
  if not exists(select 1 from public.learning_provider_organization_invitations where id=accepted_invitation_key and status='cancelled' and responded_at is not null)
    or not exists(select 1 from public.learning_provider_organization_invitation_events where invitation_id=accepted_invitation_key and event_type='invitation.cancelled' and metadata->>'source'='owner.cancelled') then
    raise exception 'Owner invitation cancellation was not durably recorded';
  end if;
end $test$;

rollback;
