-- A provider workspace is the single home for one provider's team, profile,
-- branding, verification, and organization-owned courses. An account can own
-- one active workspace; invite colleagues into that workspace instead of
-- creating duplicate provider profiles.

create or replace function public.create_own_learning_provider_organization(p_name text,p_slug text)
returns table(organization_id bigint,name text,slug text,status text,created_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare
  organization_key bigint;
  normalized_name text := btrim(p_name);
  normalized_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Active approved instructor required' using errcode = '42501'; end if;
  if normalized_name is null or char_length(normalized_name) not between 2 and 160 or normalized_slug is null or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(normalized_slug) not between 3 and 100 then raise exception 'Invalid training organization identity' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('learning-provider-owner:' || auth.uid()::text, 0));
  if exists (
    select 1
    from public.learning_provider_organization_memberships membership
    join public.learning_provider_organizations organization on organization.id = membership.organization_id
    where membership.user_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
      and organization.status = 'active'
  ) then
    raise exception 'This account already owns an active provider workspace' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('learning-provider-organization:' || normalized_slug, 0));
  insert into public.learning_provider_organizations(name,slug,created_by) values(normalized_name,normalized_slug,auth.uid()) returning id into organization_key;
  insert into public.learning_provider_organization_memberships(organization_id,user_id,role,granted_by) values(organization_key,auth.uid(),'owner',auth.uid());
  insert into public.learning_provider_organization_membership_events(membership_id,organization_id,user_id,event_type,actor_user_id,metadata)
  select membership.id,organization_key,auth.uid(),'membership.created',auth.uid(),jsonb_build_object('role','owner','source','organization.create') from public.learning_provider_organization_memberships membership where membership.organization_id=organization_key and membership.user_id=auth.uid() and membership.status='active';
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(auth.uid(),'instructor','provider_organization.created','learning_provider_organization',organization_key::text,jsonb_build_object('slug',normalized_slug));
  return query select organization.id,organization.name,organization.slug,organization.status,organization.created_at from public.learning_provider_organizations organization where organization.id=organization_key;
end;
$function$;

revoke all on function public.create_own_learning_provider_organization(text,text) from public,anon,authenticated;
grant execute on function public.create_own_learning_provider_organization(text,text) to authenticated,postgres,service_role;
