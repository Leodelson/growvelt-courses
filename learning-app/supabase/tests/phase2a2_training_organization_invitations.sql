begin;

do $test$
declare
  owner_id uuid := '33333333-3333-4333-8333-333333333341';
  invitee_id uuid := '33333333-3333-4333-8333-333333333342';
  outsider_id uuid := '33333333-3333-4333-8333-333333333343';
  organization_key bigint; invitation_key bigint; membership_key bigint; blocked boolean := false;
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (owner_id,'authenticated','authenticated','phase2a2-owner@example.test',now(),now()),
    (invitee_id,'authenticated','authenticated','phase2a2-invitee@example.test',now(),now()),
    (outsider_id,'authenticated','authenticated','phase2a2-outsider@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (owner_id,'phase2a2-owner@example.test','Phase 2A2 Owner','complete'),
    (invitee_id,'phase2a2-invitee@example.test','Phase 2A2 Invitee','complete'),
    (outsider_id,'phase2a2-outsider@example.test','Phase 2A2 Outsider','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (owner_id,'instructor','active'),(invitee_id,'instructor','active'),(outsider_id,'instructor','active') on conflict(user_id,capability) do update set status='active',revoked_at=null,revoked_by=null,reason=null;
  insert into public.instructor_profiles(user_id,approval_status) values
    (owner_id,'approved'),(invitee_id,'approved'),(outsider_id,'approved') on conflict(user_id) do update set approval_status='approved';

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  select organization_id into organization_key from public.create_own_learning_provider_organization('Phase 2A2 Test Academy','phase2a2-test-academy');
  select invitation_id into invitation_key from public.create_learning_provider_organization_invitation(organization_key,'phase2a2-invitee@example.test','instructor');
  if invitation_key is null or not exists(select 1 from public.learning_provider_organization_invitations where id=invitation_key and status='pending' and invited_user_id=invitee_id) then raise exception 'Owner invitation was not created'; end if;

  perform set_config('request.jwt.claim.sub',outsider_id::text,true);
  begin
    perform public.create_learning_provider_organization_invitation(organization_key,'phase2a2-invitee@example.test','admin');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Non-owner created an organization invitation'; end if;

  perform set_config('request.jwt.claim.sub',invitee_id::text,true);
  select membership_id into membership_key from public.accept_own_learning_provider_organization_invitation(invitation_key);
  if membership_key is null or not exists(select 1 from public.learning_provider_organization_memberships where id=membership_key and organization_id=organization_key and user_id=invitee_id and role='instructor' and status='active')
    or not exists(select 1 from public.learning_provider_organization_invitation_events where invitation_id=invitation_key and event_type='invitation.accepted')
    or not exists(select 1 from public.learning_provider_organization_membership_events where membership_id=membership_key and event_type='membership.created') then
    raise exception 'Invitation acceptance did not create a complete auditable membership';
  end if;
  if (select count(*) from public.accept_own_learning_provider_organization_invitation(invitation_key)) <> 1 then raise exception 'Repeated invitation acceptance was not idempotent'; end if;
  blocked:=false;
  begin update public.learning_provider_organization_invitations set role='admin' where id=invitation_key; exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Accepted invitation role was mutable'; end if;
end $test$;

do $security$
begin
  if has_table_privilege('authenticated','public.learning_provider_organization_invitations','select')
    or has_table_privilege('authenticated','public.learning_provider_organization_invitation_events','select') then
    raise exception 'Browser role can directly read organization invitations';
  end if;
end $security$;

rollback;
