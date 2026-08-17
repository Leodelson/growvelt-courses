-- Growvelt Learning - Step 04 Progress Policies And Starter Lessons
-- Run this in Supabase SQL Editor after Step 03 has seeded learning_courses.
-- This file is separate so you can track exactly what belongs to progress tracking.
--
-- Purpose:
-- 1. Let enrolled learners read full lessons for courses they enrolled in.
-- 2. Let enrolled learners read lesson resources for those lessons.
-- 3. Add starter modules and lessons for every published course.
--
-- Safe to rerun:
-- Unique indexes prevent duplicate starter modules and lessons.

create unique index if not exists course_modules_course_position_key
on public.course_modules (course_id, position);

create unique index if not exists lessons_course_position_key
on public.lessons (course_id, position);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'lessons'
      and policyname = 'Enrolled learners can read course lessons'
  ) then
    create policy "Enrolled learners can read course lessons"
    on public.lessons
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.enrollments
        where enrollments.course_id = lessons.course_id
          and enrollments.learner_id = auth.uid()
          and enrollments.status in ('active', 'completed')
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
      and tablename = 'lesson_resources'
      and policyname = 'Enrolled learners can read lesson resources'
  ) then
    create policy "Enrolled learners can read lesson resources"
    on public.lesson_resources
    for select
    to authenticated
    using (
      exists (
        select 1
        from public.lessons
        join public.enrollments
          on enrollments.course_id = lessons.course_id
        where lessons.id = lesson_resources.lesson_id
          and enrollments.learner_id = auth.uid()
          and enrollments.status in ('active', 'completed')
      )
    );
  end if;
end $$;

insert into public.course_modules (course_id, title, position)
select
  learning_courses.id,
  module_seed.title,
  module_seed.position
from public.learning_courses
cross join (
  values
    (1, 'Foundation and learning goals'),
    (2, 'Tools, workflows, and guided practice'),
    (3, 'Project, proof, and next steps')
) as module_seed(position, title)
where learning_courses.status = 'published'
on conflict (course_id, position) do update
set title = excluded.title;

insert into public.lessons (
  course_id,
  module_id,
  title,
  lesson_type,
  content,
  duration_minutes,
  is_preview,
  position
)
select
  learning_courses.id,
  course_modules.id,
  lesson_seed.title,
  lesson_seed.lesson_type,
  lesson_seed.content,
  lesson_seed.duration_minutes,
  lesson_seed.is_preview,
  lesson_seed.position
from public.learning_courses
join (
  values
    (1, 1, 'Welcome and course outcome', 'text', 'Understand what this course covers, what you will build, and how to use your learning dashboard.', 8, true),
    (2, 1, 'Skill roadmap and learning setup', 'text', 'Set your learning goal, prepare your workspace, and understand the practical projects ahead.', 12, true),
    (3, 2, 'Core practical lesson', 'text', 'Work through the main skill concepts with guided examples and instructor notes.', 24, false),
    (4, 2, 'Hands-on practice task', 'project', 'Apply what you learned with a practical task that can become proof of skill.', 35, false),
    (5, 3, 'Portfolio project checkpoint', 'project', 'Package your work into a clear portfolio checkpoint for review and improvement.', 40, false),
    (6, 3, 'Certificate readiness and jobs link', 'text', 'Review your progress, prepare for certificate completion, and connect your skill to Growvelt Jobs.', 15, false)
) as lesson_seed(position, module_position, title, lesson_type, content, duration_minutes, is_preview)
  on true
join public.course_modules
  on course_modules.course_id = learning_courses.id
  and course_modules.position = lesson_seed.module_position
where learning_courses.status = 'published'
on conflict (course_id, position) do update
set
  module_id = excluded.module_id,
  title = excluded.title,
  lesson_type = excluded.lesson_type,
  content = excluded.content,
  duration_minutes = excluded.duration_minutes,
  is_preview = excluded.is_preview,
  updated_at = now();
