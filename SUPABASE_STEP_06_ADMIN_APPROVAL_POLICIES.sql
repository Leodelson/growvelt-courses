-- Growvelt Learning - Step 06 Admin Approval Policies
-- Run this in Supabase SQL Editor before testing admin approval.
-- This file is separate so you can track exactly what belongs to admin approvals.
--
-- Purpose:
-- 1. Let admin users read pending and submitted courses.
-- 2. Let admin users approve/reject courses by updating status.
-- 3. Let admin users read instructor applications.
-- 4. Let admin users read course registration counts.
--
-- If you already ran these exact policies, this script will skip them.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'learning_courses'
      and policyname = 'Admins can read all learning courses'
  ) then
    create policy "Admins can read all learning courses"
    on public.learning_courses
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.account_type = 'admin'
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'learning_courses'
      and policyname = 'Admins can approve learning courses'
  ) then
    create policy "Admins can approve learning courses"
    on public.learning_courses
    for update
    to authenticated
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.account_type = 'admin'
      )
    )
    with check (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.account_type = 'admin'
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'instructor_profiles'
      and policyname = 'Admins can read instructor applications'
  ) then
    create policy "Admins can read instructor applications"
    on public.instructor_profiles
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.account_type = 'admin'
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'course_registrations'
      and policyname = 'Admins can read course registrations'
  ) then
    create policy "Admins can read course registrations"
    on public.course_registrations
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.account_type = 'admin'
      )
    );
  end if;
end $$;
