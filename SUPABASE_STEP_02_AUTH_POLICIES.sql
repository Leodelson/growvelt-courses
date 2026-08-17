-- Growvelt Learning - Step 02 Auth Policies
-- Run this in Supabase SQL Editor after Step 01 learning platform tables exist.
-- This file is separated from the main schema so you can safely track what belongs to this step.
--
-- Purpose:
-- 1. Let signed-in instructors read their own instructor profile.
-- 2. Let signed-in instructors create their own pending instructor profile.
-- 3. Let signed-in instructors update their own instructor profile while it is still pending.
--
-- If you already ran these exact policies, this script will skip them.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'instructor_profiles'
      and policyname = 'Instructor profiles are readable by owner'
  ) then
    create policy "Instructor profiles are readable by owner"
    on public.instructor_profiles
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'instructor_profiles'
      and policyname = 'Instructor profiles are created by owner'
  ) then
    create policy "Instructor profiles are created by owner"
    on public.instructor_profiles
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'instructor_profiles'
      and policyname = 'Instructor profiles are updated by owner while pending'
  ) then
    create policy "Instructor profiles are updated by owner while pending"
    on public.instructor_profiles
    for update
    to authenticated
    using (auth.uid() = user_id and approval_status = 'pending')
    with check (auth.uid() = user_id);
  end if;
end $$;
