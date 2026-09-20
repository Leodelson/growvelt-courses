-- Phase 2B3: provider profile branding. Owners can prepare a private profile
-- from day one; it is public only after Learning Admin verification.

alter table public.learning_provider_organization_profiles
  add column logo_storage_path text,
  add column cover_storage_path text;

-- A profile is a private draft until verification passes. This lets a new
-- owner prepare the complete organization presence in one place without
-- exposing it publicly before the Admin review.
create or replace function public.update_own_learning_provider_organization_profile(
  p_organization_id bigint,
  p_headline text,
  p_description text,
  p_contact_email text,
  p_website_url text,
  p_linkedin_url text,
  p_instagram_url text
)
returns table(organization_id bigint, updated_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare
  headline_value text := btrim(p_headline);
  description_value text := btrim(p_description);
  contact_email_value text := lower(btrim(p_contact_email));
  website_url_value text := nullif(btrim(p_website_url), '');
  linkedin_url_value text := nullif(btrim(p_linkedin_url), '');
  instagram_url_value text := nullif(btrim(p_instagram_url), '');
  profile_exists boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_organization_id is null or not exists (
    select 1
    from public.learning_provider_organization_memberships membership
    join public.learning_provider_organizations organization on organization.id = membership.organization_id
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
      and organization.status = 'active'
  ) then raise exception 'An active organization owner is required' using errcode = '42501'; end if;
  if headline_value is null or char_length(headline_value) not between 8 and 160
    or description_value is null or char_length(description_value) not between 80 and 2400
    or contact_email_value is null or contact_email_value !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or (website_url_value is not null and (char_length(website_url_value) > 400 or website_url_value !~* '^https?://'))
    or (linkedin_url_value is not null and (char_length(linkedin_url_value) > 400 or linkedin_url_value !~* '^https://([^/]+\.)?linkedin\.com/'))
    or (instagram_url_value is not null and (char_length(instagram_url_value) > 400 or instagram_url_value !~* '^https://([^/]+\.)?instagram\.com/'))
  then raise exception 'Invalid provider profile details' using errcode = '22023'; end if;
  select exists(select 1 from public.learning_provider_organization_profiles profile where profile.organization_id = p_organization_id) into profile_exists;
  insert into public.learning_provider_organization_profiles(organization_id, headline, description, contact_email, website_url, linkedin_url, instagram_url, updated_by, updated_at)
  values(p_organization_id, headline_value, description_value, contact_email_value, website_url_value, linkedin_url_value, instagram_url_value, auth.uid(), now())
  on conflict on constraint learning_provider_organization_profiles_pkey do update set headline = excluded.headline, description = excluded.description, contact_email = excluded.contact_email, website_url = excluded.website_url, linkedin_url = excluded.linkedin_url, instagram_url = excluded.instagram_url, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.learning_provider_organization_profile_events(organization_id, actor_user_id, event_type, metadata)
  values(p_organization_id, auth.uid(), case when profile_exists then 'profile.updated' else 'profile.created' end, jsonb_build_object('draft', not exists(select 1 from public.learning_provider_organization_verifications verification where verification.organization_id = p_organization_id and verification.status = 'verified')));
  insert into public.learning_audit_events(actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values(auth.uid(), 'organization_owner', 'provider_organization.profile_saved', 'learning_provider_organization', p_organization_id::text, jsonb_build_object('updated', profile_exists));
  return query select profile.organization_id, profile.updated_at from public.learning_provider_organization_profiles profile where profile.organization_id = p_organization_id;
end;
$function$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('learning-provider-media', 'learning-provider-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create or replace function public.can_manage_learning_provider_media(p_name text)
returns boolean
language plpgsql stable security definer set search_path to '' as $function$
declare
  path_parts text[] := regexp_match(p_name, '^([1-9][0-9]*)/(logos|covers)/[0-9a-f-]+\.(jpg|png|webp)$');
  organization_key bigint;
begin
  if auth.uid() is null or path_parts is null then return false; end if;
  organization_key := path_parts[1]::bigint;
  return exists (
    select 1
    from public.learning_provider_organization_memberships membership
    join public.learning_provider_organizations organization on organization.id = membership.organization_id
    join public.learning_provider_organization_profiles profile on profile.organization_id = organization.id
    where organization.id = organization_key
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
      and organization.status = 'active'
  );
end;
$function$;

create or replace function public.can_read_learning_provider_media(p_name text)
returns boolean
language plpgsql stable security definer set search_path to '' as $function$
begin
  return exists (
    select 1
    from public.learning_provider_organization_profiles profile
    join public.learning_provider_organizations organization on organization.id = profile.organization_id
    join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id
    where organization.status = 'active'
      and verification.status = 'verified'
      and (profile.logo_storage_path = p_name or profile.cover_storage_path = p_name)
  );
end;
$function$;

revoke all on function public.can_manage_learning_provider_media(text), public.can_read_learning_provider_media(text) from public, anon, authenticated;
grant execute on function public.can_manage_learning_provider_media(text) to authenticated, postgres, service_role;
grant execute on function public.can_read_learning_provider_media(text) to anon, authenticated, postgres, service_role;

create policy "learning_provider_media_select_public_profile" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'learning-provider-media' and public.can_read_learning_provider_media(name));

create policy "learning_provider_media_select_owner" on storage.objects
  for select to authenticated
  using (bucket_id = 'learning-provider-media' and public.can_manage_learning_provider_media(name));

create policy "learning_provider_media_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'learning-provider-media' and public.can_manage_learning_provider_media(name));

create policy "learning_provider_media_update_owner" on storage.objects
  for update to authenticated
  using (bucket_id = 'learning-provider-media' and public.can_manage_learning_provider_media(name))
  with check (bucket_id = 'learning-provider-media' and public.can_manage_learning_provider_media(name));

create policy "learning_provider_media_delete_owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'learning-provider-media' and public.can_manage_learning_provider_media(name));

create or replace function public.update_own_learning_provider_organization_profile_media(
  p_organization_id bigint,
  p_media_kind text,
  p_storage_path text
)
returns table(organization_id bigint, logo_storage_path text, cover_storage_path text, updated_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare
  storage_path_value text := btrim(p_storage_path);
  expected_pattern text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_media_kind not in ('logo', 'cover') then raise exception 'Invalid provider media type' using errcode = '22023'; end if;
  expected_pattern := '^' || p_organization_id::text || '/' || case when p_media_kind = 'logo' then 'logos' else 'covers' end || '/[0-9a-f-]+\.(jpg|png|webp)$';
  if p_organization_id is null or storage_path_value is null or storage_path_value !~ expected_pattern then raise exception 'Invalid provider media path' using errcode = '22023'; end if;
  if not exists (
    select 1
    from public.learning_provider_organization_memberships membership
    join public.learning_provider_organizations organization on organization.id = membership.organization_id
    join public.learning_provider_organization_profiles profile on profile.organization_id = organization.id
    where organization.id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
      and organization.status = 'active'
  ) then raise exception 'An active organization owner with a provider profile is required' using errcode = '42501'; end if;

  update public.learning_provider_organization_profiles as profile
  set logo_storage_path = case when p_media_kind = 'logo' then storage_path_value else profile.logo_storage_path end,
      cover_storage_path = case when p_media_kind = 'cover' then storage_path_value else profile.cover_storage_path end,
      updated_by = auth.uid(),
      updated_at = now()
  where profile.organization_id = p_organization_id;
  insert into public.learning_provider_organization_profile_events(organization_id, actor_user_id, event_type, metadata)
  values (p_organization_id, auth.uid(), 'profile.updated', jsonb_build_object('media_kind', p_media_kind));
  insert into public.learning_audit_events(actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'organization_owner', 'provider_organization.profile_media_saved', 'learning_provider_organization', p_organization_id::text, jsonb_build_object('media_kind', p_media_kind));
  return query select profile.organization_id, profile.logo_storage_path, profile.cover_storage_path, profile.updated_at from public.learning_provider_organization_profiles profile where profile.organization_id = p_organization_id;
end;
$function$;

create or replace function public.get_own_learning_provider_organization_profile_branding(p_organization_id bigint)
returns table(organization_id bigint, headline text, description text, contact_email text, website_url text, linkedin_url text, instagram_url text, logo_storage_path text, cover_storage_path text, updated_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return query
  select profile.organization_id, profile.headline, profile.description, profile.contact_email, profile.website_url, profile.linkedin_url, profile.instagram_url, profile.logo_storage_path, profile.cover_storage_path, profile.updated_at
  from public.learning_provider_organization_profiles profile
  join public.learning_provider_organization_memberships membership on membership.organization_id = profile.organization_id
  join public.learning_provider_organizations organization on organization.id = profile.organization_id
  where profile.organization_id = p_organization_id
    and membership.user_id = auth.uid()
    and membership.role = 'owner'
    and membership.status = 'active'
    and organization.status = 'active';
end;
$function$;

create or replace function public.get_public_learning_provider_organization_profile_branding(p_slug text)
returns table(name text, slug text, headline text, description text, contact_email text, website_url text, linkedin_url text, instagram_url text, logo_storage_path text, cover_storage_path text, updated_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
declare normalized_slug text := lower(btrim(p_slug));
begin
  if normalized_slug is null or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then return; end if;
  return query
  select organization.name, organization.slug, profile.headline, profile.description, profile.contact_email, profile.website_url, profile.linkedin_url, profile.instagram_url, profile.logo_storage_path, profile.cover_storage_path, profile.updated_at
  from public.learning_provider_organizations organization
  join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id and verification.status = 'verified'
  join public.learning_provider_organization_profiles profile on profile.organization_id = organization.id
  where organization.slug = normalized_slug and organization.status = 'active';
end;
$function$;

revoke all on function public.update_own_learning_provider_organization_profile_media(bigint,text,text), public.get_own_learning_provider_organization_profile_branding(bigint), public.get_public_learning_provider_organization_profile_branding(text) from public, anon, authenticated;
grant execute on function public.update_own_learning_provider_organization_profile_media(bigint,text,text), public.get_own_learning_provider_organization_profile_branding(bigint) to authenticated, postgres, service_role;
grant execute on function public.get_public_learning_provider_organization_profile_branding(text) to anon, authenticated, postgres, service_role;
