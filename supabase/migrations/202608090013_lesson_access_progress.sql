-- Growvelt Learning Phase 2B-C: enrolled lesson access and idempotent completion.
-- Forward-only. No player, entitlement, or browser-writable progress table access.

begin;

do $$
begin
  if to_regclass('public.enrollments') is null or to_regclass('public.lesson_progress') is null or to_regclass('public.learning_courses') is null or to_regclass('public.course_modules') is null or to_regclass('public.lessons') is null then
    raise exception 'Lesson access aborted: expected Learning relations are missing';
  end if;
  if exists (select 1 from pg_class as relation_row join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace where namespace_row.nspname = 'public' and relation_row.relname in ('enrollments', 'lesson_progress', 'learning_courses', 'course_modules', 'lessons') and not relation_row.relrowsecurity) then
    raise exception 'Lesson access aborted: RLS must remain enabled';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'enrollment_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'lesson_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'completed_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'progress_percent' and data_type = 'integer')
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and ((column_name = 'id' and data_type = 'bigint') or (column_name = 'learner_id' and data_type = 'uuid') or (column_name = 'course_id' and data_type = 'bigint') or (column_name = 'status' and data_type = 'text'))) <> 4
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and ((column_name = 'id' and data_type = 'bigint') or (column_name = 'slug' and data_type = 'text') or (column_name = 'title' and data_type = 'text') or (column_name = 'status' and data_type = 'text'))) <> 4
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and ((column_name = 'id' and data_type = 'bigint') or (column_name = 'course_id' and data_type = 'bigint') or (column_name = 'title' and data_type = 'text') or (column_name = 'position' and data_type = 'integer'))) <> 4
     or (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and ((column_name = 'id' and data_type = 'bigint') or (column_name = 'course_id' and data_type = 'bigint') or (column_name = 'module_id' and data_type = 'bigint') or (column_name = 'title' and data_type = 'text') or (column_name = 'lesson_type' and data_type = 'text') or (column_name = 'content' and data_type = 'text') or (column_name = 'is_preview' and data_type = 'boolean') or (column_name = 'position' and data_type = 'integer') or (column_name = 'video_provider' and data_type = 'text') or (column_name = 'video_reference' and data_type = 'text') or (column_name = 'video_visibility' and data_type = 'text') or (column_name = 'duration_seconds' and data_type = 'integer'))) <> 12 then
    raise exception 'Lesson access aborted: expected lesson/progress shape is missing';
  end if;
  if not exists (
    select 1 from pg_constraint as constraint_row join pg_index as index_row on index_row.indexrelid = constraint_row.conindid
    where constraint_row.conrelid = 'public.lesson_progress'::regclass and constraint_row.contype = 'u' and index_row.indisunique and index_row.indnkeyatts = 2 and index_row.indnatts = 2
      and (select array_agg(attribute_row.attname::text order by key_column.ordinality) from unnest(index_row.indkey) with ordinality as key_column(attnum, ordinality) join pg_attribute as attribute_row on attribute_row.attrelid = index_row.indrelid and attribute_row.attnum = key_column.attnum where key_column.ordinality <= index_row.indnkeyatts) = array['enrollment_id', 'lesson_id']::text[]
  ) then
    raise exception 'Lesson access aborted: lesson progress uniqueness is missing';
  end if;
  if not exists (
    select 1 from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.lesson_progress'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.enrollments'::regclass
      and constraint_row.confdeltype = 'c'
      and (select array_agg(attribute_row.attname::text order by key_column.ordinality) from unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality) join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.conrelid and attribute_row.attnum = key_column.attnum) = array['enrollment_id']::text[]
      and (select array_agg(attribute_row.attname::text order by key_column.ordinality) from unnest(constraint_row.confkey) with ordinality as key_column(attnum, ordinality) join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.confrelid and attribute_row.attnum = key_column.attnum) = array['id']::text[]
  ) or not exists (
    select 1 from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.lesson_progress'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.lessons'::regclass
      and constraint_row.confdeltype = 'c'
      and (select array_agg(attribute_row.attname::text order by key_column.ordinality) from unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality) join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.conrelid and attribute_row.attnum = key_column.attnum) = array['lesson_id']::text[]
      and (select array_agg(attribute_row.attname::text order by key_column.ordinality) from unnest(constraint_row.confkey) with ordinality as key_column(attnum, ordinality) join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.confrelid and attribute_row.attnum = key_column.attnum) = array['id']::text[]
  ) then
    raise exception 'Lesson access aborted: lesson progress foreign-key cascade baseline is missing';
  end if;
  if not exists (select 1 from pg_constraint as constraint_row where constraint_row.conrelid = 'public.lesson_progress'::regclass and constraint_row.contype = 'c' and pg_get_constraintdef(constraint_row.oid) ilike '%progress_percent%' and pg_get_constraintdef(constraint_row.oid) ilike '%0%' and pg_get_constraintdef(constraint_row.oid) ilike '%100%') then
    raise exception 'Lesson access aborted: progress_percent must permit the 0-100 completion model';
  end if;
  if to_regprocedure('public.get_own_enrolled_lesson_snapshot(text,bigint)') is not null or to_regprocedure('public.complete_own_enrolled_lesson(bigint,bigint)') is not null then
    raise exception 'Lesson access aborted: expected clean Phase 2B-C RPC state is missing';
  end if;
end;
$$;

-- Legacy browser progress writes are removed; learner reads remain available.
drop policy if exists "Learners can manage own lesson progress" on public.lesson_progress;
drop policy if exists "Learners can read own lesson progress" on public.lesson_progress;
create policy "Learners can read own lesson progress"
on public.lesson_progress
for select
to authenticated
using (exists (select 1 from public.enrollments as enrollment_row where enrollment_row.id = lesson_progress.enrollment_id and enrollment_row.learner_id = auth.uid()));
revoke insert, update, delete, truncate on table public.lesson_progress from public, anon, authenticated;

do $$
declare progress_columns text;
begin
  select string_agg(format('%I', attribute_row.attname), ', ' order by attribute_row.attnum) into progress_columns
  from pg_attribute as attribute_row
  where attribute_row.attrelid = 'public.lesson_progress'::regclass and attribute_row.attnum > 0 and not attribute_row.attisdropped;
  if progress_columns is null then raise exception 'Lesson access aborted: progress columns could not be inspected'; end if;
  execute format('revoke insert (%1$s), update (%1$s) on table public.lesson_progress from public, anon, authenticated', progress_columns);
end;
$$;

create function public.get_own_enrolled_lesson_snapshot(p_slug text, p_lesson_id bigint)
returns table (course_id bigint, course_slug text, course_title text, enrollment_id bigint, module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, lesson_position integer, is_preview boolean, is_current boolean, is_completed boolean, current_text_content text, current_video_provider text, current_video_reference text, current_video_visibility text, current_duration_seconds integer, previous_lesson_id bigint, next_lesson_id bigint)
language plpgsql security definer stable set search_path = ''
as $$
declare normalized_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then raise exception 'Invalid course reference' using errcode = '22023'; end if;
  return query
  with enrolled_course as (
    select course_row.id, course_row.slug, course_row.title, enrollment_row.id as enrollment_id
    from public.enrollments as enrollment_row
    join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
    where enrollment_row.learner_id = auth.uid() and enrollment_row.status = 'active' and course_row.slug = normalized_slug
  ), ordered_lessons as (
    select enrolled_course.id as course_id, enrolled_course.slug, enrolled_course.title as course_title, enrolled_course.enrollment_id, module_row.id as module_id, module_row.title as module_title, module_row.position as module_position, lesson_row.id as current_lesson_id, lesson_row.title as current_lesson_title, lesson_row.lesson_type as current_lesson_type, lesson_row.position as lesson_position, lesson_row.is_preview, lesson_row.content, lesson_row.video_provider, lesson_row.video_reference, lesson_row.video_visibility, lesson_row.duration_seconds, progress_row.completed_at,
      lag(lesson_row.id) over (order by module_row.position, module_row.id, lesson_row.position, lesson_row.id) as previous_id,
      lead(lesson_row.id) over (order by module_row.position, module_row.id, lesson_row.position, lesson_row.id) as next_id
    from enrolled_course
    join public.course_modules as module_row on module_row.course_id = enrolled_course.id
    join public.lessons as lesson_row on lesson_row.course_id = enrolled_course.id and lesson_row.module_id = module_row.id
    left join public.lesson_progress as progress_row on progress_row.enrollment_id = enrolled_course.enrollment_id and progress_row.lesson_id = lesson_row.id
  )
  select ordered_lessons.course_id, ordered_lessons.slug, ordered_lessons.course_title, ordered_lessons.enrollment_id, ordered_lessons.module_id, ordered_lessons.module_title, ordered_lessons.module_position, ordered_lessons.current_lesson_id, ordered_lessons.current_lesson_title, ordered_lessons.current_lesson_type, ordered_lessons.lesson_position, ordered_lessons.is_preview, ordered_lessons.current_lesson_id = p_lesson_id, coalesce(ordered_lessons.completed_at is not null, false), case when ordered_lessons.current_lesson_id = p_lesson_id and ordered_lessons.current_lesson_type = 'text' then ordered_lessons.content else null end, case when ordered_lessons.current_lesson_id = p_lesson_id and ordered_lessons.current_lesson_type = 'video' then ordered_lessons.video_provider else null end, case when ordered_lessons.current_lesson_id = p_lesson_id and ordered_lessons.current_lesson_type = 'video' then ordered_lessons.video_reference else null end, case when ordered_lessons.current_lesson_id = p_lesson_id and ordered_lessons.current_lesson_type = 'video' then ordered_lessons.video_visibility else null end, case when ordered_lessons.current_lesson_id = p_lesson_id and ordered_lessons.current_lesson_type = 'video' then ordered_lessons.duration_seconds else null end, case when ordered_lessons.current_lesson_id = p_lesson_id then ordered_lessons.previous_id else null end, case when ordered_lessons.current_lesson_id = p_lesson_id then ordered_lessons.next_id else null end
  from ordered_lessons
  where exists (select 1 from ordered_lessons as target_row where target_row.current_lesson_id = p_lesson_id)
  order by ordered_lessons.module_position, ordered_lessons.module_id, ordered_lessons.lesson_position, ordered_lessons.current_lesson_id;
end;
$$;

create function public.complete_own_enrolled_lesson(p_course_id bigint, p_lesson_id bigint)
returns table (completed_lesson_id bigint, completed_at timestamptz, progress_percent integer)
language plpgsql security definer set search_path = ''
as $$
declare own_enrollment_id bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select enrollment_row.id into own_enrollment_id from public.enrollments as enrollment_row join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published' join public.lessons as lesson_row on lesson_row.id = p_lesson_id and lesson_row.course_id = course_row.id where enrollment_row.learner_id = auth.uid() and enrollment_row.status = 'active' and course_row.id = p_course_id for update of enrollment_row, course_row, lesson_row;
  if own_enrollment_id is null then raise exception 'This lesson is not available to this account' using errcode = '42501'; end if;
  insert into public.lesson_progress (enrollment_id, lesson_id, completed_at, progress_percent) values (own_enrollment_id, p_lesson_id, now(), 100)
  on conflict (enrollment_id, lesson_id) do update set completed_at = coalesce(lesson_progress.completed_at, excluded.completed_at), progress_percent = 100;
  return query select progress_row.lesson_id, progress_row.completed_at, progress_row.progress_percent from public.lesson_progress as progress_row where progress_row.enrollment_id = own_enrollment_id and progress_row.lesson_id = p_lesson_id;
end;
$$;

revoke execute on function public.get_own_enrolled_lesson_snapshot(text, bigint), public.complete_own_enrolled_lesson(bigint, bigint) from public, anon, authenticated;
grant execute on function public.get_own_enrolled_lesson_snapshot(text, bigint), public.complete_own_enrolled_lesson(bigint, bigint) to authenticated;

do $$
begin
  if has_table_privilege('public', 'public.lesson_progress', 'INSERT') or has_table_privilege('anon', 'public.lesson_progress', 'INSERT') or has_table_privilege('authenticated', 'public.lesson_progress', 'INSERT') or has_table_privilege('public', 'public.lesson_progress', 'UPDATE') or has_table_privilege('anon', 'public.lesson_progress', 'UPDATE') or has_table_privilege('authenticated', 'public.lesson_progress', 'UPDATE') or has_table_privilege('public', 'public.lesson_progress', 'DELETE') or has_table_privilege('anon', 'public.lesson_progress', 'DELETE') or has_table_privilege('authenticated', 'public.lesson_progress', 'DELETE') or has_table_privilege('public', 'public.lesson_progress', 'TRUNCATE') or has_table_privilege('anon', 'public.lesson_progress', 'TRUNCATE') or has_table_privilege('authenticated', 'public.lesson_progress', 'TRUNCATE') or exists (select 1 from pg_attribute as attribute_row where attribute_row.attrelid = 'public.lesson_progress'::regclass and attribute_row.attnum > 0 and not attribute_row.attisdropped and (has_column_privilege('public', 'public.lesson_progress', attribute_row.attname::text, 'INSERT') or has_column_privilege('anon', 'public.lesson_progress', attribute_row.attname::text, 'INSERT') or has_column_privilege('authenticated', 'public.lesson_progress', attribute_row.attname::text, 'INSERT') or has_column_privilege('public', 'public.lesson_progress', attribute_row.attname::text, 'UPDATE') or has_column_privilege('anon', 'public.lesson_progress', attribute_row.attname::text, 'UPDATE') or has_column_privilege('authenticated', 'public.lesson_progress', attribute_row.attname::text, 'UPDATE'))) or not has_table_privilege('authenticated', 'public.lesson_progress', 'SELECT') or not has_table_privilege('service_role', 'public.lesson_progress', 'SELECT') or not has_table_privilege('service_role', 'public.lesson_progress', 'INSERT') or not has_table_privilege('service_role', 'public.lesson_progress', 'UPDATE') or not has_table_privilege('service_role', 'public.lesson_progress', 'DELETE') or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lesson_progress' and policyname = 'Learners can read own lesson progress' and cmd = 'SELECT') or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lesson_progress' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')) or not has_function_privilege('authenticated', 'public.get_own_enrolled_lesson_snapshot(text,bigint)', 'EXECUTE') or not has_function_privilege('authenticated', 'public.complete_own_enrolled_lesson(bigint,bigint)', 'EXECUTE') or has_function_privilege('public', 'public.get_own_enrolled_lesson_snapshot(text,bigint)', 'EXECUTE') or has_function_privilege('public', 'public.complete_own_enrolled_lesson(bigint,bigint)', 'EXECUTE') or has_function_privilege('anon', 'public.get_own_enrolled_lesson_snapshot(text,bigint)', 'EXECUTE') or has_function_privilege('anon', 'public.complete_own_enrolled_lesson(bigint,bigint)', 'EXECUTE') then
    raise exception 'Lesson access aborted: progress grants or RPC execution are not hardened';
  end if;
end;
$$;

commit;
