-- Growvelt Learning: authorization hardening.
--
-- Forward-only. Review and execute once through the production Supabase SQL
-- migration workflow. This file is intentionally guarded: do not apply it to
-- an unknown or partially migrated schema.

begin;

do $$
declare
  required_tables text[] := array[
    'profiles', 'instructor_profiles', 'learning_courses', 'enrollments',
    'lesson_progress', 'course_reviews', 'course_registrations'
  ];
  item text;
  expected_policy record;
begin
  foreach item in array required_tables loop
    if to_regclass('public.' || item) is null then
      raise exception 'Learning authorization hardening aborted: public.% is required', item;
    end if;

    if not exists (
      select 1
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = item
        and pg_class.relrowsecurity
    ) then
      raise exception 'Learning authorization hardening aborted: RLS must be enabled on public.%', item;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'account_type' and data_type = 'text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'instructor_profiles'
      and column_name = 'approval_status' and data_type = 'text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name = 'is_free' and data_type = 'boolean'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'enrollments'
      and column_name = 'learner_id' and udt_name = 'uuid'
  ) then
    raise exception 'Learning authorization hardening aborted: one or more expected critical columns/types are missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.enrollments'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%UNIQUE (learner_id, course_id)%'
  ) then
    raise exception 'Learning authorization hardening aborted: enrollments must retain UNIQUE (learner_id, course_id)';
  end if;

  if to_regprocedure('public.is_growvelt_learning_admin()') is null
     or to_regprocedure('public.is_approved_growvelt_instructor()') is null then
    raise exception 'Learning authorization hardening aborted: expected existing authorization helper functions are missing';
  end if;

  for expected_policy in
    select * from (values
      ('profiles', 'Profiles are created by owner'),
      ('profiles', 'Profiles are updated by owner'),
      ('instructor_profiles', 'Instructor profiles are created by owner'),
      ('instructor_profiles', 'Instructor profiles are updated by owner while pending'),
      ('instructor_profiles', 'Admins can approve instructor applications'),
      ('enrollments', 'Learners can create own enrollments'),
      ('course_reviews', 'Learners can create own reviews'),
      ('learning_courses', 'Approved instructors can submit courses for review'),
      ('learning_courses', 'Approved instructors can update own unpublished courses'),
      ('learning_courses', 'Admins can read all learning courses'),
      ('learning_courses', 'Admins can approve learning courses'),
      ('instructor_profiles', 'Admins can read instructor applications'),
      ('course_registrations', 'Admins can read course registrations')
    ) as expected(table_name, policy_name)
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = expected_policy.table_name
        and policyname = expected_policy.policy_name
    ) then
      raise exception 'Learning authorization hardening aborted: expected policy "%" on public.% is missing; inspect live policy state first', expected_policy.policy_name, expected_policy.table_name;
    end if;
  end loop;

  if to_regclass('public.account_capabilities') is not null then
    raise exception 'Learning authorization hardening aborted: public.account_capabilities already exists; do not apply this migration to a partial state';
  end if;
end
$$;

create table public.account_capabilities (
  user_id uuid not null references public.profiles(id) on delete cascade,
  capability text not null check (capability in ('instructor', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'revoked')),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  reason text,
  primary key (user_id, capability),
  constraint account_capabilities_status_lifecycle_check check (
    (status = 'active' and revoked_at is null and revoked_by is null and reason is null)
    or (status = 'suspended' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

alter table public.account_capabilities enable row level security;

-- No browser role can read or mutate capability rows directly. Authorization
-- uses the narrowly scoped helpers below; service_role/postgres remain able to
-- perform controlled operational bootstrap and recovery.
revoke all on table public.account_capabilities from public, anon, authenticated;

create or replace function public.has_growvelt_learning_capability(p_capability text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_capabilities as capability
    where capability.user_id = auth.uid()
      and capability.capability = p_capability
      and capability.status = 'active'
  );
$$;

create or replace function public.is_growvelt_learning_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.has_growvelt_learning_capability('admin');
$$;

create or replace function public.is_approved_growvelt_instructor()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.has_growvelt_learning_capability('instructor')
    and exists (
      select 1
      from public.instructor_profiles as instructor_profile
      where instructor_profile.user_id = auth.uid()
        and instructor_profile.approval_status = 'approved'
    );
$$;

revoke execute on function public.has_growvelt_learning_capability(text) from public, anon, authenticated;
revoke execute on function public.is_growvelt_learning_admin() from public, anon, authenticated;
revoke execute on function public.is_approved_growvelt_instructor() from public, anon, authenticated;
grant execute on function public.has_growvelt_learning_capability(text) to authenticated;
grant execute on function public.is_growvelt_learning_admin() to authenticated;
grant execute on function public.is_approved_growvelt_instructor() to authenticated;

-- Keep account_type as legacy/display state only. Column grants, rather than
-- RLS alone, prevent browser clients from supplying or changing it.
drop policy "Profiles are created by owner" on public.profiles;
create policy "Profiles are created by owner"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id and account_type = 'learner');

revoke insert, update on table public.profiles from public, anon, authenticated;
revoke delete, truncate on table public.profiles from public, anon, authenticated;
grant insert (id, full_name, email, avatar_url, onboarding_status)
  on table public.profiles to authenticated;
grant update (full_name, avatar_url, onboarding_status)
  on table public.profiles to authenticated;

-- An application is always created as pending. The owner may only amend the
-- non-administrative application fields while the application remains pending.
drop policy "Instructor profiles are created by owner" on public.instructor_profiles;
drop policy "Instructor profiles are updated by owner while pending" on public.instructor_profiles;
create policy "Instructor profiles are created by owner"
on public.instructor_profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and approval_status = 'pending'
  and reviewed_at is null
);
create policy "Instructor profiles are updated by owner while pending"
on public.instructor_profiles
for update
to authenticated
using (auth.uid() = user_id and approval_status = 'pending')
with check (
  auth.uid() = user_id
  and approval_status = 'pending'
  and reviewed_at is null
);

revoke insert, update on table public.instructor_profiles from public, anon, authenticated;
revoke delete, truncate on table public.instructor_profiles from public, anon, authenticated;
grant insert (user_id, headline, bio, expertise)
  on table public.instructor_profiles to authenticated;
grant update (headline, bio, expertise)
  on table public.instructor_profiles to authenticated;

-- Preserve read access for legitimate Admins, but move state transitions into
-- the narrow RPC below so browser users cannot edit review fields directly.
drop policy "Admins can approve instructor applications" on public.instructor_profiles;
drop policy if exists "Admins can read instructor applications" on public.instructor_profiles;
create policy "Admins can read instructor applications"
on public.instructor_profiles
for select
to authenticated
using (public.is_growvelt_learning_admin());

create or replace function public.review_instructor_application(
  p_application_user_id uuid,
  p_decision text
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
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Admin capability required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Unsupported instructor application decision' using errcode = '22023';
  end if;

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

revoke execute on function public.review_instructor_application(uuid, text) from public, anon, authenticated;
grant execute on function public.review_instructor_application(uuid, text) to authenticated;

-- The former direct insert allowed a browser to create access for paid courses.
drop policy "Learners can create own enrollments" on public.enrollments;
revoke insert on table public.enrollments from public, anon, authenticated;
revoke delete, truncate on table public.enrollments from public, anon, authenticated;

create or replace function public.enroll_in_free_learning_course(p_course_id bigint)
returns table (
  enrollment_id bigint,
  enrollment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.learning_courses as course
    where course.id = p_course_id
      and course.status = 'published'
      and course.is_free = true
  ) then
    raise exception 'This course is not currently available for free enrollment' using errcode = '22023';
  end if;

  insert into public.enrollments (learner_id, course_id, status)
  values (auth.uid(), p_course_id, 'active')
  on conflict (learner_id, course_id) do update
  set status = 'active',
      completed_at = null
  where enrollments.status = 'cancelled';

  return query
  select enrollment.id, enrollment.status
  from public.enrollments as enrollment
  where enrollment.learner_id = auth.uid()
    and enrollment.course_id = p_course_id;
end;
$$;

revoke execute on function public.enroll_in_free_learning_course(bigint) from public, anon, authenticated;
grant execute on function public.enroll_in_free_learning_course(bigint) to authenticated;

-- Reviews are deferred. Existing published-review reads remain intact, but a
-- browser cannot publish a review until enrollment/moderation rules exist.
drop policy "Learners can create own reviews" on public.course_reviews;
revoke insert on table public.course_reviews from public, anon, authenticated;
revoke delete, truncate on table public.course_reviews from public, anon, authenticated;

-- These existing policies previously read profiles.account_type directly.
-- Recreate them against the rewritten capability helper while preserving their
-- existing course ownership/status restrictions.
drop policy if exists "Admins can read all learning courses" on public.learning_courses;
create policy "Admins can read all learning courses"
on public.learning_courses
for select
to authenticated
using (public.is_growvelt_learning_admin());

drop policy if exists "Admins can approve learning courses" on public.learning_courses;
create policy "Admins can approve learning courses"
on public.learning_courses
for update
to authenticated
using (public.is_growvelt_learning_admin())
with check (public.is_growvelt_learning_admin());

drop policy if exists "Admins can read course registrations" on public.course_registrations;
create policy "Admins can read course registrations"
on public.course_registrations
for select
to authenticated
using (public.is_growvelt_learning_admin());

-- "Approved instructors can submit/update" policies already call the two
-- helpers above. Replacing those helpers removes account_type from their
-- authorization path without changing course lifecycle rules.

commit;
