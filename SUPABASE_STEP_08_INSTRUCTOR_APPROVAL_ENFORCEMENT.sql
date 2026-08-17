-- Growvelt Learning - Step 08 ONLY
-- Instructor Approval Enforcement
--
-- Run ONLY this file now.
-- Do not join it with Step 01, Step 02, Step 03, Step 04, Step 05, Step 06, or Step 07.
--
-- What this does:
-- 1. Allows admins to approve or reject instructor applications.
-- 2. Removes the old Step 05 course submission policies.
-- 3. Adds stricter policies so only approved instructors can submit courses.

create or replace function public.is_growvelt_learning_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_type = 'admin'
  );
$$;

create or replace function public.is_approved_growvelt_instructor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_type = 'instructor'
  )
  and exists (
    select 1
    from public.instructor_profiles
    where instructor_profiles.user_id = auth.uid()
      and instructor_profiles.approval_status = 'approved'
  );
$$;

drop policy if exists "Admins can approve instructor applications"
on public.instructor_profiles;

create policy "Admins can approve instructor applications"
on public.instructor_profiles
for update
to authenticated
using (public.is_growvelt_learning_admin())
with check (public.is_growvelt_learning_admin());

drop policy if exists "Instructors can submit courses for review"
on public.learning_courses;

drop policy if exists "Approved instructors can submit courses for review"
on public.learning_courses;

create policy "Approved instructors can submit courses for review"
on public.learning_courses
for insert
to authenticated
with check (
  auth.uid() = instructor_id
  and status in ('draft', 'pending_review')
  and (
    public.is_growvelt_learning_admin()
    or public.is_approved_growvelt_instructor()
  )
);

drop policy if exists "Instructors can update own unpublished courses"
on public.learning_courses;

drop policy if exists "Approved instructors can update own unpublished courses"
on public.learning_courses;

create policy "Approved instructors can update own unpublished courses"
on public.learning_courses
for update
to authenticated
using (
  auth.uid() = instructor_id
  and status in ('draft', 'pending_review')
  and (
    public.is_growvelt_learning_admin()
    or public.is_approved_growvelt_instructor()
  )
)
with check (
  auth.uid() = instructor_id
  and status in ('draft', 'pending_review')
  and (
    public.is_growvelt_learning_admin()
    or public.is_approved_growvelt_instructor()
  )
);
