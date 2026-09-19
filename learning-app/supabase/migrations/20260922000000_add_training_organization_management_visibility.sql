-- Phase 2A4: owner/member-visible organization management information.
-- Read-only views only: no membership, invitation, course, commercial, or payout state changes.
begin;

create or replace function public.list_own_learning_provider_organization_members(p_organization_id bigint)
returns table(member_id uuid,full_name text,email text,role text,status text,granted_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_organization_id is null or not exists(
    select 1 from public.learning_provider_organization_memberships membership
    where membership.organization_id=p_organization_id and membership.user_id=auth.uid() and membership.status='active'
  ) then raise exception 'Active organization membership required' using errcode='42501'; end if;
  return query
    select membership.user_id,profile.full_name,profile.email,membership.role,membership.status,membership.granted_at
    from public.learning_provider_organization_memberships membership
    join public.profiles profile on profile.id=membership.user_id
    where membership.organization_id=p_organization_id
    order by case membership.status when 'active' then 0 else 1 end,case membership.role when 'owner' then 0 when 'admin' then 1 else 2 end,membership.granted_at,membership.id;
end;$function$;

create or replace function public.list_own_learning_provider_organization_invitations_as_owner(p_organization_id bigint)
returns table(invitation_id bigint,invited_email text,role text,status text,created_at timestamptz,expires_at timestamptz,responded_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_organization_id is null or not exists(
    select 1 from public.learning_provider_organization_memberships membership
    join public.learning_provider_organizations organization on organization.id=membership.organization_id
    where membership.organization_id=p_organization_id and membership.user_id=auth.uid() and membership.role='owner' and membership.status='active' and organization.status='active'
  ) then raise exception 'Active organization owner required' using errcode='42501'; end if;
  return query
    select invitation.id,invitation.invited_email,invitation.role,
      case when invitation.status='pending' and invitation.expires_at<=now() then 'expired' else invitation.status end,
      invitation.created_at,invitation.expires_at,invitation.responded_at
    from public.learning_provider_organization_invitations invitation
    where invitation.organization_id=p_organization_id
    order by case when invitation.status='pending' and invitation.expires_at>now() then 0 else 1 end,invitation.created_at desc,invitation.id desc;
end;$function$;

create or replace function public.list_own_learning_provider_organization_courses(p_organization_id bigint)
returns table(course_id bigint,title text,slug text,status text,instructor_name text,updated_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_organization_id is null or not exists(
    select 1 from public.learning_provider_organization_memberships membership
    where membership.organization_id=p_organization_id and membership.user_id=auth.uid() and membership.status='active'
  ) then raise exception 'Active organization membership required' using errcode='42501'; end if;
  return query
    select course.id,course.title,course.slug,course.status,coalesce(profile.full_name,profile.email,'Instructor'),course.updated_at
    from public.learning_courses course
    join public.profiles profile on profile.id=course.instructor_id
    where course.organization_id=p_organization_id
    order by course.updated_at desc,course.id desc;
end;$function$;

revoke all on function public.list_own_learning_provider_organization_members(bigint),public.list_own_learning_provider_organization_invitations_as_owner(bigint),public.list_own_learning_provider_organization_courses(bigint) from public,anon;
grant execute on function public.list_own_learning_provider_organization_members(bigint),public.list_own_learning_provider_organization_invitations_as_owner(bigint),public.list_own_learning_provider_organization_courses(bigint) to authenticated,postgres,service_role;

commit;
