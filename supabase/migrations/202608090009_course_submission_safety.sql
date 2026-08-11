-- Growvelt Learning Phase 2A-C: secure Instructor course submission.
--
-- Forward-only. This migration adds draft -> pending_review submission only.
-- It intentionally does not add Admin moderation, publishing, entitlements, or
-- private video delivery. Public/unlisted YouTube references are not a safe
-- paid-content delivery mechanism, so this MVP permits submission of free
-- courses only.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
     or to_regclass('public.course_modules') is null
     or to_regclass('public.lessons') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Course submission aborted: expected Learning tables are missing';
  end if;

  if exists (
    select 1 from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('learning_courses', 'course_modules', 'lessons')
      and not relation.relrowsecurity
  ) then
    raise exception 'Course submission aborted: RLS must remain enabled on Learning course tables';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name in ('submitted_at', 'reviewed_at', 'reviewed_by', 'review_note')
  ) or to_regclass('public.course_rights_declarations') is not null
     or to_regprocedure('public.submit_learning_course_for_review(bigint,text,text)') is not null then
    raise exception 'Course submission aborted: expected Phase 2A-B baseline or clean Phase 2A-C state is missing';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'instructor_id' and data_type = 'uuid')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'status' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'is_free' and data_type = 'boolean')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_amount' and data_type = 'numeric')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_currency' and data_type = 'text') then
    raise exception 'Course submission aborted: learning_courses is not the expected authoring shape';
  end if;

  if not exists (select 1 from pg_constraint as constraint_row where constraint_row.conrelid = 'public.learning_courses'::regclass and constraint_row.contype = 'c' and pg_get_constraintdef(constraint_row.oid) like '%draft%pending_review%published%archived%') then
    raise exception 'Course submission aborted: expected course lifecycle is missing';
  end if;

  if not exists (select 1 from pg_constraint as constraint_row where constraint_row.conrelid = 'public.course_modules'::regclass and constraint_row.contype = 'f' and constraint_row.confrelid = 'public.learning_courses'::regclass and constraint_row.confdeltype = 'c')
     or not exists (select 1 from pg_constraint as constraint_row where constraint_row.conrelid = 'public.lessons'::regclass and constraint_row.contype = 'f' and constraint_row.confrelid = 'public.course_modules'::regclass and constraint_row.confdeltype = 'c') then
    raise exception 'Course submission aborted: expected curriculum cascade relationships are missing';
  end if;

  if to_regprocedure('public.is_approved_growvelt_instructor()') is null
     or not exists (select 1 from pg_proc as routine where routine.oid = 'public.is_approved_growvelt_instructor()'::regprocedure and routine.prosecdef)
     or has_function_privilege('anon', 'public.is_approved_growvelt_instructor()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.is_approved_growvelt_instructor()', 'EXECUTE') then
    raise exception 'Course submission aborted: approved Instructor helper does not match the hardened baseline';
  end if;

  if to_regprocedure('public.get_own_instructor_course(bigint)') is null
     or to_regprocedure('public.get_own_instructor_curriculum(bigint)') is null
     or to_regprocedure('public.create_instructor_course_draft(text,text,text,text,text,boolean,numeric,text)') is null
     or to_regprocedure('public.update_instructor_course_draft(bigint,text,text,text,text,text,boolean,numeric,text)') is null then
    raise exception 'Course submission aborted: required Phase 2A authoring RPCs are missing';
  end if;

  if exists (
    select 1 from pg_proc as routine
    where routine.oid in (
      'public.get_own_instructor_course(bigint)'::regprocedure,
      'public.get_own_instructor_curriculum(bigint)'::regprocedure,
      'public.create_instructor_course_draft(text,text,text,text,text,boolean,numeric,text)'::regprocedure,
      'public.update_instructor_course_draft(bigint,text,text,text,text,text,boolean,numeric,text)'::regprocedure
    ) and not routine.prosecdef
  ) then
    raise exception 'Course submission aborted: required authoring RPCs must remain SECURITY DEFINER';
  end if;

  if has_table_privilege('public', 'public.learning_courses', 'INSERT')
     or has_table_privilege('public', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('public', 'public.learning_courses', 'DELETE')
     or has_table_privilege('authenticated', 'public.learning_courses', 'INSERT')
     or has_table_privilege('authenticated', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('authenticated', 'public.learning_courses', 'DELETE')
     or has_table_privilege('anon', 'public.learning_courses', 'INSERT')
     or has_table_privilege('anon', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('anon', 'public.learning_courses', 'DELETE') then
    raise exception 'Course submission aborted: direct browser course mutation privilege unexpectedly exists';
  end if;

  if exists (
    select 1
    from pg_attribute as attribute
    where attribute.attrelid = 'public.learning_courses'::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and (
        has_column_privilege('public', 'public.learning_courses', attribute.attname, 'INSERT')
        or has_column_privilege('public', 'public.learning_courses', attribute.attname, 'UPDATE')
        or has_column_privilege('anon', 'public.learning_courses', attribute.attname, 'INSERT')
        or has_column_privilege('anon', 'public.learning_courses', attribute.attname, 'UPDATE')
        or has_column_privilege('authenticated', 'public.learning_courses', attribute.attname, 'INSERT')
        or has_column_privilege('authenticated', 'public.learning_courses', attribute.attname, 'UPDATE')
      )
  ) then
    raise exception 'Course submission aborted: direct browser course column-mutation privilege unexpectedly exists';
  end if;

  if not has_table_privilege('anon', 'public.learning_courses', 'SELECT')
     or not has_table_privilege('authenticated', 'public.learning_courses', 'SELECT') then
    raise exception 'Course submission aborted: expected browser course reads are missing; inspect grants before privacy hardening';
  end if;
end;
$$;

alter table public.learning_courses
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles(id) on delete set null,
  add column review_note text,
  add constraint learning_courses_review_note_length_check
    check (review_note is null or char_length(review_note) <= 2000);

create table public.course_rights_declarations (
  id bigint generated by default as identity primary key,
  course_id bigint not null references public.learning_courses(id) on delete restrict,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  declaration_version text not null check (declaration_version = '2026-08-v1'),
  rights_basis text not null check (rights_basis in ('original', 'licensed', 'authorized')),
  accepted_at timestamptz not null default now()
);

alter table public.course_rights_declarations enable row level security;

-- Declarations and review notes are operational records. Browser roles receive
-- no direct table access; the submission RPC below is the sole write path.
revoke all on table public.course_rights_declarations from public, anon, authenticated;
grant select, insert, update, delete on table public.course_rights_declarations to service_role;
grant usage, select on sequence public.course_rights_declarations_id_seq to service_role;

create index course_rights_declarations_course_accepted_idx
  on public.course_rights_declarations (course_id, accepted_at desc);

-- RLS controls rows, not columns. Replace browser table-level course SELECT
-- with every pre-existing course field except Admin-internal review metadata.
-- Existing public published-course RLS remains the row-level boundary.
do $$
declare
  safe_columns text;
begin
  select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum)
    into safe_columns
  from pg_attribute as attribute
  where attribute.attrelid = 'public.learning_courses'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped
    and attribute.attname not in ('reviewed_by', 'review_note');

  if safe_columns is null then
    raise exception 'Course submission aborted: could not derive safe course read columns';
  end if;

  revoke select on table public.learning_courses from public, anon, authenticated;
  execute format('revoke select (%1$s) on table public.learning_courses from public, anon, authenticated', safe_columns);
  execute format('grant select (%1$s) on table public.learning_courses to anon, authenticated', safe_columns);

  if has_column_privilege('public', 'public.learning_courses', 'reviewed_by', 'SELECT')
     or has_column_privilege('anon', 'public.learning_courses', 'reviewed_by', 'SELECT')
     or has_column_privilege('authenticated', 'public.learning_courses', 'reviewed_by', 'SELECT')
     or has_column_privilege('public', 'public.learning_courses', 'review_note', 'SELECT')
     or has_column_privilege('anon', 'public.learning_courses', 'review_note', 'SELECT')
     or has_column_privilege('authenticated', 'public.learning_courses', 'review_note', 'SELECT') then
    raise exception 'Course submission aborted: browser read access to internal review metadata remains';
  end if;

  if not has_table_privilege('service_role', 'public.learning_courses', 'SELECT') then
    raise exception 'Course submission aborted: service_role must retain operational course reads';
  end if;
end;
$$;

create function public.submit_learning_course_for_review(
  p_course_id bigint,
  p_declaration_version text,
  p_rights_basis text
)
returns table (
  course_id bigint,
  submission_status text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  course_key bigint;
  submitted_time timestamptz;
  normalized_version text := btrim(p_declaration_version);
  normalized_basis text := lower(btrim(p_rights_basis));
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if normalized_version is distinct from '2026-08-v1'
     or normalized_basis is null
     or normalized_basis not in ('original', 'licensed', 'authorized') then
    raise exception 'A current course-rights declaration is required' using errcode = '22023';
  end if;

  select course.id into course_key
  from public.learning_courses as course
  where course.id = p_course_id
    and course.instructor_id = auth.uid()
    and course.status = 'draft';

  if course_key is null then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  -- Curriculum mutations and submission share this lock, preventing a partial
  -- snapshot from being submitted while an ordering mutation is in flight.
  perform pg_advisory_xact_lock(course_key);

  select course.id into course_key
  from public.learning_courses as course
  where course.id = course_key
    and course.instructor_id = auth.uid()
    and course.status = 'draft'
  for update;

  if course_key is null then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.learning_courses as course
    where course.id = course_key
      and char_length(btrim(course.title)) between 3 and 160
      and char_length(btrim(course.summary)) between 10 and 320
      and char_length(btrim(course.description)) between 40 and 10000
      and course.category in ('Data Analytics', 'Business', 'Data Science', 'Business Intelligence', 'Programming', 'Web Development', 'Cybersecurity', 'Digital Marketing', 'Creative Skills', 'Digital Skills', 'Productivity')
      and course.level in ('Beginner', 'Intermediate', 'Beginner to intermediate', 'Beginner to job-ready')
  ) then
    raise exception 'Complete the required course metadata before submitting' using errcode = '22023';
  end if;

  -- Paid delivery is deferred until Growvelt has secure entitlement and private
  -- delivery. A public or unlisted YouTube reference is not paid protection.
  if not exists (
    select 1 from public.learning_courses as course
    where course.id = course_key
      and course.is_free = true
      and coalesce(course.price_amount, 0) = 0
      and coalesce(course.price_currency, 'NGN') = 'NGN'
      and coalesce(course.is_limited_time_free, false) = false
  ) then
    raise exception 'Only free courses can be submitted while secure paid delivery is unavailable' using errcode = '22023';
  end if;

  if not exists (select 1 from public.course_modules as module where module.course_id = course_key)
     or not exists (select 1 from public.lessons as lesson where lesson.course_id = course_key) then
    raise exception 'Add at least one module and one lesson before submitting' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.course_modules as module
    where module.course_id = course_key
      and (module.title is null or char_length(btrim(module.title)) not between 2 and 160)
  ) then
    raise exception 'Complete every module title before submitting' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.lessons as lesson
    left join public.course_modules as module on module.id = lesson.module_id and module.course_id = lesson.course_id
    where lesson.course_id = course_key
      and (
        module.id is null
        or char_length(btrim(lesson.title)) not between 2 and 160
        or lesson.lesson_type not in ('video', 'text')
        or (
          lesson.lesson_type = 'video' and (
            lesson.content is not null
            or lesson.video_provider is distinct from 'youtube'
            or lesson.video_reference is null
            or lesson.video_reference !~ '^[A-Za-z0-9_-]{11}$'
            or lesson.video_visibility not in ('public', 'unlisted')
            or lesson.duration_seconds not between 1 and 86400
            or lesson.video_url is not null
            or lesson.duration_minutes is not null
          )
        )
        or (
          lesson.lesson_type = 'text' and (
            lesson.content is null
            or char_length(btrim(lesson.content)) not between 1 and 20000
            or lesson.video_provider is not null
            or lesson.video_reference is not null
            or lesson.video_visibility is not null
            or lesson.duration_seconds is not null
            or lesson.video_url is not null
            or lesson.duration_minutes is not null
          )
        )
      )
  ) then
    raise exception 'Complete every lesson with valid text or YouTube video details before submitting' using errcode = '22023';
  end if;

  insert into public.course_rights_declarations (
    course_id, instructor_id, declaration_version, rights_basis
  ) values (
    course_key, auth.uid(), normalized_version, normalized_basis
  );

  update public.learning_courses as course
  set status = 'pending_review',
      submitted_at = now(),
      reviewed_at = null,
      reviewed_by = null,
      review_note = null,
      updated_at = now()
  where course.id = course_key
    and course.instructor_id = auth.uid()
    and course.status = 'draft'
  returning course.submitted_at into submitted_time;

  if not found then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  return query select course_key, 'pending_review'::text, submitted_time;
end;
$$;

revoke execute on function public.submit_learning_course_for_review(bigint, text, text) from public, anon, authenticated;
grant execute on function public.submit_learning_course_for_review(bigint, text, text) to authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.submit_learning_course_for_review(bigint,text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.submit_learning_course_for_review(bigint,text,text)', 'EXECUTE') then
    raise exception 'Course submission aborted: submission RPC execution grants are not hardened';
  end if;

  if has_table_privilege('public', 'public.learning_courses', 'INSERT')
     or has_table_privilege('public', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('public', 'public.learning_courses', 'DELETE')
     or has_table_privilege('anon', 'public.learning_courses', 'INSERT')
     or has_table_privilege('anon', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('anon', 'public.learning_courses', 'DELETE')
     or has_table_privilege('authenticated', 'public.learning_courses', 'INSERT')
     or has_table_privilege('authenticated', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('authenticated', 'public.learning_courses', 'DELETE') then
    raise exception 'Course submission aborted: browser direct course mutation privilege remains after hardening';
  end if;
end;
$$;

commit;
