-- Growvelt Learning: expand the secure Instructor application record without
-- changing its pending/approved/rejected lifecycle or capability model.

begin;

do $$
begin
  if to_regclass('public.instructor_profiles') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.account_capabilities') is null then
    raise exception 'Instructor onboarding fields aborted: expected Learning tables are missing';
  end if;

  if not exists (
    select 1
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'instructor_profiles'
      and relation.relrowsecurity
  ) then
    raise exception 'Instructor onboarding fields aborted: RLS must be enabled on public.instructor_profiles';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'user_id' and data_type = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'headline' and data_type = 'text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'bio' and data_type = 'text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'expertise' and data_type = 'ARRAY'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'approval_status' and data_type = 'text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'reviewed_at' and data_type = 'timestamp with time zone'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name in ('reviewed_by', 'review_note')
  ) then
    raise exception 'Instructor onboarding fields aborted: instructor_profiles is not the expected hardened shape';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name in ('country', 'phone', 'years_experience', 'teaching_experience', 'motivation', 'portfolio_url')
  ) then
    raise exception 'Instructor onboarding fields aborted: one or more new application columns already exist; inspect the partial state first';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'instructor_profiles'
      and policyname = 'Instructor profiles are created by owner'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'instructor_profiles'
      and policyname = 'Instructor profiles are updated by owner while pending'
  ) then
    raise exception 'Instructor onboarding fields aborted: expected applicant policies are missing';
  end if;

  if to_regprocedure('public.review_instructor_application(uuid,text,text)') is null
     or to_regprocedure('public.list_pending_instructor_applications()') is null
     or to_regprocedure('public.get_instructor_application_for_review(uuid)') is null then
    raise exception 'Instructor onboarding fields aborted: expected review functions are missing';
  end if;

  if not exists (
    select 1 from pg_proc as routine
    where routine.oid = 'public.review_instructor_application(uuid,text,text)'::regprocedure
      and routine.prosecdef
      and pg_get_function_result(routine.oid) = 'TABLE(user_id uuid, approval_status text, instructor_capability_status text)'
  ) or not exists (
    select 1 from pg_proc as routine
    where routine.oid = 'public.list_pending_instructor_applications()'::regprocedure
      and routine.prosecdef
      and pg_get_function_result(routine.oid) = 'TABLE(user_id uuid, headline text, bio text, expertise text[], approval_status text, created_at timestamp with time zone, reviewed_at timestamp with time zone, reviewed_by uuid, review_note text)'
  ) or not exists (
    select 1 from pg_proc as routine
    where routine.oid = 'public.get_instructor_application_for_review(uuid)'::regprocedure
      and routine.prosecdef
      and pg_get_function_result(routine.oid) = 'TABLE(user_id uuid, headline text, bio text, expertise text[], approval_status text, created_at timestamp with time zone, reviewed_at timestamp with time zone, reviewed_by uuid, review_note text)'
  ) then
    raise exception 'Instructor onboarding fields aborted: expected SECURITY DEFINER review functions are not in place';
  end if;

  -- The replacement Admin-only readers are owned by the migration executor.
  -- They may read only auth.users.email, so fail before any mutation if that
  -- owner cannot access the authoritative Auth identity relation.
  if to_regclass('auth.users') is null
     or not has_table_privilege(current_user, 'auth.users', 'SELECT') then
    raise exception 'Instructor onboarding fields aborted: function owner must be able to read auth.users for current account email';
  end if;

  if not has_column_privilege('authenticated', 'public.instructor_profiles', 'headline', 'INSERT')
     or not has_column_privilege('authenticated', 'public.instructor_profiles', 'bio', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.instructor_profiles', 'expertise', 'SELECT')
     or has_column_privilege('authenticated', 'public.instructor_profiles', 'approval_status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.instructor_profiles', 'reviewed_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.instructor_profiles', 'reviewed_by', 'SELECT')
     or has_column_privilege('authenticated', 'public.instructor_profiles', 'review_note', 'SELECT') then
    raise exception 'Instructor onboarding fields aborted: applicant column grants do not match the hardened baseline';
  end if;
end;
$$;

alter table public.instructor_profiles
  add column country text,
  add column phone text,
  add column years_experience smallint,
  add column teaching_experience text,
  add column motivation text,
  add column portfolio_url text,
  add constraint instructor_profiles_country_length_check
    check (country is null or char_length(btrim(country)) between 2 and 100),
  add constraint instructor_profiles_phone_length_check
    check (phone is null or char_length(btrim(phone)) between 3 and 32),
  add constraint instructor_profiles_years_experience_check
    check (years_experience is null or years_experience between 0 and 60),
  add constraint instructor_profiles_teaching_experience_length_check
    check (teaching_experience is null or char_length(teaching_experience) <= 1500),
  add constraint instructor_profiles_motivation_length_check
    check (motivation is null or char_length(motivation) <= 1500),
  add constraint instructor_profiles_portfolio_url_check
    check (
      portfolio_url is null
      or (
        char_length(portfolio_url) <= 500
        and portfolio_url ~ '^https?://[^[:space:]]+$'
      )
    );

-- Existing applications remain readable in their current state. New applicant
-- writes must include a country, while browser roles remain unable to set any
-- approval or review metadata.
drop policy "Instructor profiles are created by owner" on public.instructor_profiles;
create policy "Instructor profiles are created by owner"
on public.instructor_profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and approval_status = 'pending'
  and reviewed_at is null
  and country is not null
  and char_length(btrim(country)) between 2 and 100
  and headline is not null
  and char_length(btrim(headline)) between 2 and 160
  and coalesce(array_length(expertise, 1), 0) between 1 and 12
  and years_experience between 0 and 60
  and teaching_experience is not null
  and char_length(btrim(teaching_experience)) between 2 and 1500
  and bio is not null
  and char_length(btrim(bio)) between 2 and 2000
  and motivation is not null
  and char_length(btrim(motivation)) between 2 and 1500
);

drop policy "Instructor profiles are updated by owner while pending" on public.instructor_profiles;
create policy "Instructor profiles are updated by owner while pending"
on public.instructor_profiles
for update
to authenticated
using (auth.uid() = user_id and approval_status = 'pending')
with check (
  auth.uid() = user_id
  and approval_status = 'pending'
  and reviewed_at is null
  and country is not null
  and char_length(btrim(country)) between 2 and 100
  and headline is not null
  and char_length(btrim(headline)) between 2 and 160
  and coalesce(array_length(expertise, 1), 0) between 1 and 12
  and years_experience between 0 and 60
  and teaching_experience is not null
  and char_length(btrim(teaching_experience)) between 2 and 1500
  and bio is not null
  and char_length(btrim(bio)) between 2 and 2000
  and motivation is not null
  and char_length(btrim(motivation)) between 2 and 1500
);

grant insert (user_id, headline, bio, expertise, country, phone, years_experience, teaching_experience, motivation, portfolio_url)
  on table public.instructor_profiles to authenticated;
grant update (headline, bio, expertise, country, phone, years_experience, teaching_experience, motivation, portfolio_url)
  on table public.instructor_profiles to authenticated;
grant select (country, phone, years_experience, teaching_experience, motivation, portfolio_url)
  on table public.instructor_profiles to authenticated;

revoke insert (approval_status, reviewed_at, reviewed_by, review_note)
  on table public.instructor_profiles from public, anon, authenticated;
revoke update (approval_status, reviewed_at, reviewed_by, review_note)
  on table public.instructor_profiles from public, anon, authenticated;
revoke select (reviewed_by, review_note)
  on table public.instructor_profiles from public, anon, authenticated;

-- These RPCs gain applicant-safe output columns. PostgreSQL does not permit
-- CREATE OR REPLACE to alter an existing function's OUT parameter shape, so
-- replace them atomically after the guards above confirm the known baseline.
drop function public.list_pending_instructor_applications();
drop function public.get_instructor_application_for_review(uuid);

create function public.list_pending_instructor_applications()
returns table (
  user_id uuid,
  full_name text,
  email text,
  country text,
  phone text,
  headline text,
  bio text,
  expertise text[],
  years_experience smallint,
  teaching_experience text,
  motivation text,
  portfolio_url text,
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
  select application.user_id,
         profile.full_name,
         auth_user.email,
         application.country,
         application.phone,
         application.headline,
         application.bio,
         application.expertise,
         application.years_experience,
         application.teaching_experience,
         application.motivation,
         application.portfolio_url,
         application.approval_status,
         application.created_at,
         application.reviewed_at,
         application.reviewed_by,
         application.review_note
  from public.instructor_profiles as application
  join public.profiles as profile on profile.id = application.user_id
  join auth.users as auth_user on auth_user.id = application.user_id
  where application.approval_status = 'pending'
  order by application.created_at desc;
end;
$$;

create function public.get_instructor_application_for_review(p_application_user_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  country text,
  phone text,
  headline text,
  bio text,
  expertise text[],
  years_experience smallint,
  teaching_experience text,
  motivation text,
  portfolio_url text,
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
  select application.user_id,
         profile.full_name,
         auth_user.email,
         application.country,
         application.phone,
         application.headline,
         application.bio,
         application.expertise,
         application.years_experience,
         application.teaching_experience,
         application.motivation,
         application.portfolio_url,
         application.approval_status,
         application.created_at,
         application.reviewed_at,
         application.reviewed_by,
         application.review_note
  from public.instructor_profiles as application
  join public.profiles as profile on profile.id = application.user_id
  join auth.users as auth_user on auth_user.id = application.user_id
  where application.user_id = p_application_user_id;
end;
$$;

revoke execute on function public.list_pending_instructor_applications() from public, anon, authenticated;
revoke execute on function public.get_instructor_application_for_review(uuid) from public, anon, authenticated;
grant execute on function public.list_pending_instructor_applications() to authenticated;
grant execute on function public.get_instructor_application_for_review(uuid) to authenticated;

commit;
