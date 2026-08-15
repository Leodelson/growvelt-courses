-- Phase 2D-I: private, owner-scoped profile avatar and cover media.
-- This migration is intentionally forward-only and must be reviewed before execution.

begin;

do $$
declare
  profiles_relation regclass := to_regclass('public.profiles');
begin
  if profiles_relation is null then
    raise exception 'Learning profile media aborted: public.profiles is missing';
  end if;

  if not exists (
    select 1
    from pg_class relation_row
    where relation_row.oid = profiles_relation
      and relation_row.relrowsecurity
  ) then
    raise exception 'Learning profile media aborted: RLS is not enabled on public.profiles';
  end if;

  if exists (
    select 1
    from pg_attribute attribute_row
    where attribute_row.attrelid = profiles_relation
      and attribute_row.attname in ('avatar_storage_path', 'cover_storage_path')
      and not attribute_row.attisdropped
  ) then
    raise exception 'Learning profile media aborted: profile-media columns already exist';
  end if;

  if exists (
    select 1
    from storage.buckets bucket_row
    where bucket_row.id = 'learning-profile-media'
  ) then
    raise exception 'Learning profile media aborted: profile-media bucket already exists';
  end if;

  if exists (
    select 1
    from pg_policy policy_row
    where policy_row.polrelid = 'storage.objects'::regclass
      and policy_row.polname like 'learning_profile_media_%'
  ) then
    raise exception 'Learning profile media aborted: profile-media storage policies already exist';
  end if;
end;
$$;

alter table public.profiles
  add column avatar_storage_path text,
  add column cover_storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learning-profile-media',
  'learning-profile-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
);

create policy learning_profile_media_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'learning-profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy learning_profile_media_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'learning-profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy learning_profile_media_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'learning-profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'learning-profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy learning_profile_media_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'learning-profile-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

revoke update (avatar_storage_path, cover_storage_path) on table public.profiles from public, anon;
grant update (avatar_storage_path, cover_storage_path) on table public.profiles to authenticated;

do $$
declare
  profiles_relation regclass := 'public.profiles'::regclass;
begin
  if (
    select count(*)
    from pg_attribute attribute_row
    where attribute_row.attrelid = profiles_relation
      and attribute_row.attname in ('avatar_storage_path', 'cover_storage_path')
      and not attribute_row.attisdropped
  ) <> 2 then
    raise exception 'Learning profile media aborted: profile-media columns are missing after creation';
  end if;

  if not exists (
    select 1
    from storage.buckets bucket_row
    where bucket_row.id = 'learning-profile-media'
      and not bucket_row.public
      and bucket_row.file_size_limit = 5242880
      and bucket_row.allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  ) then
    raise exception 'Learning profile media aborted: private bucket configuration is unexpected';
  end if;

  if (
    select count(*)
    from pg_policy policy_row
    where policy_row.polrelid = 'storage.objects'::regclass
      and policy_row.polname in (
        'learning_profile_media_select_own',
        'learning_profile_media_insert_own',
        'learning_profile_media_update_own',
        'learning_profile_media_delete_own'
      )
  ) <> 4 then
    raise exception 'Learning profile media aborted: owner storage policies are incomplete';
  end if;

  if has_column_privilege('anon', profiles_relation, 'avatar_storage_path', 'UPDATE')
    or has_column_privilege('anon', profiles_relation, 'cover_storage_path', 'UPDATE')
    or not has_column_privilege('authenticated', profiles_relation, 'avatar_storage_path', 'UPDATE')
    or not has_column_privilege('authenticated', profiles_relation, 'cover_storage_path', 'UPDATE') then
    raise exception 'Learning profile media aborted: profile media update privileges are unexpected';
  end if;
end;
$$;

commit;
