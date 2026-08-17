-- Growvelt Learning - Step 05 Instructor Course Submissions
-- Run this in Supabase SQL Editor before testing instructor course submission.
-- This file is separate so you can track exactly what belongs to instructor submissions.
--
-- Purpose:
-- 1. Let instructors read courses they submitted.
-- 2. Let instructors submit courses with status draft or pending_review.
-- 3. Let instructors update their own draft or pending_review courses.
--
-- Published courses are still controlled by admin approval later.
-- If you already ran these exact policies, this script will skip them.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'learning_courses'
      and policyname = 'Instructors can read own submitted courses'
  ) then
    create policy "Instructors can read own submitted courses"
    on public.learning_courses
    for select
    to authenticated
    using (auth.uid() = instructor_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'learning_courses'
      and policyname = 'Instructors can submit courses for review'
  ) then
    create policy "Instructors can submit courses for review"
    on public.learning_courses
    for insert
    to authenticated
    with check (
      auth.uid() = instructor_id
      and status in ('draft', 'pending_review')
      and exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.account_type in ('instructor', 'admin')
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
      and policyname = 'Instructors can update own unpublished courses'
  ) then
    create policy "Instructors can update own unpublished courses"
    on public.learning_courses
    for update
    to authenticated
    using (
      auth.uid() = instructor_id
      and status in ('draft', 'pending_review')
    )
    with check (
      auth.uid() = instructor_id
      and status in ('draft', 'pending_review')
      and exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and profiles.account_type in ('instructor', 'admin')
      )
    );
  end if;
end $$;
