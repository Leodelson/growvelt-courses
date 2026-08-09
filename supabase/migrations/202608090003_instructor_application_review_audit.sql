-- Growvelt Learning Phase 1C-B: current Instructor application review metadata.
-- Forward-only. This migration deliberately does not create a historical audit
-- event log; reviewed_by/review_note describe only the latest final decision.

begin;

do $$
begin
  if to_regclass('public.instructor_profiles') is null
     or to_regclass('public.account_capabilities') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Instructor review audit aborted: expected Learning tables are missing';
  end if;

  if not exists (
    select 1 from pg_class join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public' and pg_class.relname = 'instructor_profiles' and pg_class.relrowsecurity
  ) then
    raise exception 'Instructor review audit aborted: RLS must be enabled on public.instructor_profiles';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'user_id' and data_type = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'approval_status' and data_type = 'text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'reviewed_at' and data_type = 'timestamp with time zone'
  ) then
    raise exception 'Instructor review audit aborted: instructor_profiles is not the expected hardened shape';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name in ('reviewed_by', 'review_note')
  ) then
    raise exception 'Instructor review audit aborted: review metadata already exists; inspect the partial state first';
  end if;

  if to_regprocedure('public.is_growvelt_learning_admin()') is null
     or to_regprocedure('public.is_approved_growvelt_instructor()') is null
     or to_regprocedure('public.review_instructor_application(uuid,text)') is null then
    raise exception 'Instructor review audit aborted: expected hardened authorization functions are missing';
  end if;

  if to_regprocedure('public.review_instructor_application(uuid,text,text)') is not null then
    raise exception 'Instructor review audit aborted: the new review function signature already exists';
  end if;

  if to_regprocedure('public.list_pending_instructor_applications()') is not null
     or to_regprocedure('public.get_instructor_application_for_review(uuid)') is not null then
    raise exception 'Instructor review audit aborted: Admin application read functions already exist';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.review_instructor_application(uuid,text)'::regprocedure
      and prosecdef
      and pg_get_function_result(oid) = 'TABLE(user_id uuid, approval_status text, instructor_capability_status text)'
  ) then
    raise exception 'Instructor review audit aborted: legacy review RPC must be SECURITY DEFINER with the expected result shape';
  end if;

  if has_function_privilege('public', 'public.review_instructor_application(uuid,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.review_instructor_application(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.review_instructor_application(uuid,text)', 'EXECUTE') then
    raise exception 'Instructor review audit aborted: legacy review RPC execution grants do not match the hardened baseline';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'instructor_profiles'
      and policyname = 'Admins can read instructor applications'
  ) then
    raise exception 'Instructor review audit aborted: expected Admin read policy is missing';
  end if;

  if has_column_privilege('authenticated', 'public.instructor_profiles', 'approval_status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.instructor_profiles', 'reviewed_at', 'UPDATE')
     or has_table_privilege('authenticated', 'public.account_capabilities', 'INSERT')
     or has_table_privilege('authenticated', 'public.account_capabilities', 'UPDATE') then
    raise exception 'Instructor review audit aborted: browser mutation grants are broader than the hardened baseline';
  end if;

  -- RLS filters rows, not columns. Phase 1A left the known broad authenticated
  -- SELECT grant in place, which must exist now so this migration can replace
  -- it with applicant-safe column grants before internal fields are added.
  if not has_table_privilege('authenticated', 'public.instructor_profiles', 'SELECT')
     or not has_column_privilege('authenticated', 'public.instructor_profiles', 'user_id', 'SELECT')
     or not has_column_privilege('authenticated', 'public.instructor_profiles', 'approval_status', 'SELECT')
     or not has_column_privilege('authenticated', 'public.instructor_profiles', 'reviewed_at', 'SELECT') then
    raise exception 'Instructor review audit aborted: expected authenticated SELECT baseline is missing; inspect grants before changing column visibility';
  end if;
end
$$;

alter table public.instructor_profiles
  add column reviewed_by uuid references public.profiles(id) on delete set null,
  add column review_note text,
  add constraint instructor_profiles_review_note_length_check
    check (review_note is null or char_length(review_note) <= 2000);

-- RLS filters rows but does not mask columns. Replace the inherited broad
-- browser SELECT grant with only the applicant-safe application fields. The
-- Admin-only SECURITY DEFINER readers below are the sole browser-reachable
-- path to reviewed_by/review_note.
revoke select on table public.instructor_profiles from public, anon, authenticated;
grant select (id, user_id, headline, bio, expertise, approval_status, reviewed_at, created_at, updated_at)
  on table public.instructor_profiles to authenticated;

-- Defence in depth: browser roles continue to receive no direct review-field
-- mutation grants. Owner RLS remains limited to pending safe application fields.
revoke update (approval_status, reviewed_at, reviewed_by, review_note)
  on table public.instructor_profiles from public, anon, authenticated;

create function public.list_pending_instructor_applications()
returns table (
  user_id uuid,
  headline text,
  bio text,
  expertise text[],
  approval_status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Admin capability required' using errcode = '42501';
  end if;

  return query
  select instructor_profile.user_id,
         instructor_profile.headline,
         instructor_profile.bio,
         instructor_profile.expertise,
         instructor_profile.approval_status,
         instructor_profile.created_at,
         instructor_profile.reviewed_at,
         instructor_profile.reviewed_by,
         instructor_profile.review_note
  from public.instructor_profiles as instructor_profile
  where instructor_profile.approval_status = 'pending'
  order by instructor_profile.created_at desc;
end;
$$;

create function public.get_instructor_application_for_review(p_application_user_id uuid)
returns table (
  user_id uuid,
  headline text,
  bio text,
  expertise text[],
  approval_status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Admin capability required' using errcode = '42501';
  end if;

  return query
  select instructor_profile.user_id,
         instructor_profile.headline,
         instructor_profile.bio,
         instructor_profile.expertise,
         instructor_profile.approval_status,
         instructor_profile.created_at,
         instructor_profile.reviewed_at,
         instructor_profile.reviewed_by,
         instructor_profile.review_note
  from public.instructor_profiles as instructor_profile
  where instructor_profile.user_id = p_application_user_id;
end;
$$;

revoke execute on function public.list_pending_instructor_applications() from public, anon, authenticated;
revoke execute on function public.get_instructor_application_for_review(uuid) from public, anon, authenticated;
grant execute on function public.list_pending_instructor_applications() to authenticated;
grant execute on function public.get_instructor_application_for_review(uuid) to authenticated;

drop function public.review_instructor_application(uuid, text);

create function public.review_instructor_application(
  p_application_user_id uuid,
  p_decision text,
  p_review_note text default null
)
returns table (
  user_id uuid,
  approval_status text,
  instructor_capability_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  normalized_review_note text;
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Admin capability required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Unsupported instructor application decision' using errcode = '22023';
  end if;

  if p_review_note is not null and char_length(p_review_note) > 2000 then
    raise exception 'Review note is too long' using errcode = '22001';
  end if;
  normalized_review_note := nullif(btrim(p_review_note), '');

  select instructor_profile.approval_status
    into current_status
  from public.instructor_profiles as instructor_profile
  where instructor_profile.user_id = p_application_user_id
  for update;

  if not found then
    raise exception 'Instructor application not found' using errcode = 'P0002';
  end if;

  if current_status <> 'pending' then
    raise exception 'Only pending instructor applications can be reviewed' using errcode = 'P0001';
  end if;

  update public.instructor_profiles
  set approval_status = p_decision,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      review_note = normalized_review_note,
      updated_at = now()
  where instructor_profiles.user_id = p_application_user_id;

  if p_decision = 'approved' then
    insert into public.account_capabilities (
      user_id, capability, status, granted_at, granted_by, revoked_at, revoked_by, reason
    ) values (
      p_application_user_id, 'instructor', 'active', now(), auth.uid(), null, null, null
    )
    on conflict (user_id, capability) do update
      set status = 'active',
          granted_at = excluded.granted_at,
          granted_by = excluded.granted_by,
          revoked_at = null,
          revoked_by = null,
          reason = null;
  else
    update public.account_capabilities
    set status = 'revoked',
        revoked_at = now(),
        revoked_by = auth.uid(),
        reason = 'Instructor application rejected'
    where account_capabilities.user_id = p_application_user_id
      and account_capabilities.capability = 'instructor'
      and account_capabilities.status <> 'revoked';
  end if;

  return query
  select instructor_profile.user_id,
         instructor_profile.approval_status,
         coalesce(capability.status, 'none')
  from public.instructor_profiles as instructor_profile
  left join public.account_capabilities as capability
    on capability.user_id = instructor_profile.user_id
   and capability.capability = 'instructor'
  where instructor_profile.user_id = p_application_user_id;
end;
$$;

revoke execute on function public.review_instructor_application(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_instructor_application(uuid, text, text) to authenticated;

commit;
