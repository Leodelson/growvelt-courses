-- Phase 2A: auditable invitation cancellation, invitation decline, and member revocation.
-- These actions only affect organization access. They never delete historical records or courses.
begin;

create or replace function public.cancel_own_learning_provider_organization_invitation(p_organization_id bigint,p_invitation_id bigint)
returns table(invitation_id bigint, status text)
language plpgsql security definer set search_path to '' as $function$
declare invitation public.learning_provider_organization_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into invitation from public.learning_provider_organization_invitations where id=p_invitation_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Organization invitation not found' using errcode='P0002'; end if;
  if not exists(
    select 1 from public.learning_provider_organization_memberships membership
    join public.learning_provider_organizations organization on organization.id=membership.organization_id
    where membership.organization_id=invitation.organization_id and membership.user_id=auth.uid()
      and membership.role='owner' and membership.status='active' and organization.status='active'
  ) then raise exception 'Active organization owner required' using errcode='42501'; end if;
  if invitation.status <> 'pending' then raise exception 'Only pending invitations can be cancelled' using errcode='P0001'; end if;
  update public.learning_provider_organization_invitations set status='cancelled',responded_at=now() where id=invitation.id;
  insert into public.learning_provider_organization_invitation_events(invitation_id,organization_id,event_type,actor_user_id,metadata)
  values(invitation.id,invitation.organization_id,'invitation.cancelled',auth.uid(),jsonb_build_object('source','owner.cancelled'));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(auth.uid(),'organization_owner','provider_organization.invitation_cancelled','learning_provider_organization_invitation',invitation.id::text,jsonb_build_object('organization_id',invitation.organization_id));
  return query select invitation.id,'cancelled'::text;
end;$function$;

create or replace function public.decline_own_learning_provider_organization_invitation(p_invitation_id bigint)
returns table(invitation_id bigint, status text)
language plpgsql security definer set search_path to '' as $function$
declare invitation public.learning_provider_organization_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into invitation from public.learning_provider_organization_invitations where id=p_invitation_id and invited_user_id=auth.uid() for update;
  if not found then raise exception 'Organization invitation not found' using errcode='P0002'; end if;
  if invitation.status <> 'pending' or invitation.expires_at <= now() then raise exception 'Organization invitation is not active' using errcode='22023'; end if;
  update public.learning_provider_organization_invitations set status='cancelled',responded_at=now() where id=invitation.id;
  insert into public.learning_provider_organization_invitation_events(invitation_id,organization_id,event_type,actor_user_id,metadata)
  values(invitation.id,invitation.organization_id,'invitation.cancelled',auth.uid(),jsonb_build_object('source','invitee.declined'));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(auth.uid(),'instructor','provider_organization.invitation_declined','learning_provider_organization_invitation',invitation.id::text,jsonb_build_object('organization_id',invitation.organization_id));
  return query select invitation.id,'cancelled'::text;
end;$function$;

create or replace function public.revoke_own_learning_provider_organization_member(p_organization_id bigint,p_member_user_id uuid,p_reason text default null)
returns table(membership_id bigint, status text)
language plpgsql security definer set search_path to '' as $function$
declare membership public.learning_provider_organization_memberships%rowtype; normalized_reason text:=nullif(btrim(p_reason),'');
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_organization_id is null or p_member_user_id is null then raise exception 'Organization member is required' using errcode='22023'; end if;
  if normalized_reason is not null and char_length(normalized_reason)>500 then raise exception 'Removal reason is too long' using errcode='22023'; end if;
  if not exists(
    select 1 from public.learning_provider_organization_memberships owner_membership
    join public.learning_provider_organizations organization on organization.id=owner_membership.organization_id
    where owner_membership.organization_id=p_organization_id and owner_membership.user_id=auth.uid()
      and owner_membership.role='owner' and owner_membership.status='active' and organization.status='active'
  ) then raise exception 'Active organization owner required' using errcode='42501'; end if;
  select * into membership from public.learning_provider_organization_memberships as member_record
  where member_record.organization_id=p_organization_id and member_record.user_id=p_member_user_id and member_record.status='active' for update;
  if not found then raise exception 'Active organization member not found' using errcode='P0002'; end if;
  if membership.role='owner' then raise exception 'The organization owner cannot be removed' using errcode='22023'; end if;
  update public.learning_provider_organization_memberships set status='revoked',ended_at=now(),end_reason=coalesce(normalized_reason,'Removed by organization owner') where id=membership.id;
  insert into public.learning_provider_organization_membership_events(membership_id,organization_id,user_id,event_type,actor_user_id,metadata)
  values(membership.id,membership.organization_id,membership.user_id,'membership.revoked',auth.uid(),jsonb_build_object('reason',coalesce(normalized_reason,'Removed by organization owner')));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(auth.uid(),'organization_owner','provider_organization.member_revoked','learning_provider_organization_membership',membership.id::text,jsonb_build_object('organization_id',membership.organization_id,'member_user_id',membership.user_id));
  return query select membership.id,'revoked'::text;
end;$function$;

revoke all on function public.cancel_own_learning_provider_organization_invitation(bigint,bigint),public.decline_own_learning_provider_organization_invitation(bigint),public.revoke_own_learning_provider_organization_member(bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_own_learning_provider_organization_invitation(bigint,bigint),public.decline_own_learning_provider_organization_invitation(bigint),public.revoke_own_learning_provider_organization_member(bigint,uuid,text) to authenticated,postgres,service_role;

commit;
