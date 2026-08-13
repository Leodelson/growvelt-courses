-- Growvelt Learning Phase 2C-A1: secure quiz assessment foundation.
-- Forward-only. Quiz progress/completion integration is deliberately deferred to A2.

begin;

do $$
declare
  baseline_function regprocedure;
begin
  if to_regclass('public.learning_courses') is null
    or to_regclass('public.course_modules') is null
    or to_regclass('public.lessons') is null
    or to_regclass('public.enrollments') is null
    or to_regclass('public.lesson_progress') is null
    or to_regclass('public.profiles') is null then
    raise exception 'Quiz assessment aborted: expected Learning relations are missing';
  end if;
  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('learning_courses', 'course_modules', 'lessons', 'enrollments', 'lesson_progress', 'profiles')
      and not relation_row.relrowsecurity
  ) then
    raise exception 'Quiz assessment aborted: RLS must remain enabled on Learning relations';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'instructor_id' and data_type = 'uuid')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'status' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'course_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'module_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'lesson_type' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'learner_id' and data_type = 'uuid')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'course_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'status' and data_type = 'text')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'enrollment_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'lesson_id' and data_type = 'bigint')
    or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'id' and data_type = 'uuid') then
    raise exception 'Quiz assessment aborted: expected Learning column shape is missing';
  end if;
  if not exists (
    select 1 from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.lessons'::regclass
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) ilike '%quiz%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%project%'
  ) then
    raise exception 'Quiz assessment aborted: expected legacy lesson-type lifecycle is missing';
  end if;
  if not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.learning_courses'::regclass
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) ilike '%draft%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%pending_review%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%published%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%archived%'
  ) or not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.enrollments'::regclass
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) ilike '%active%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%completed%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%cancelled%'
  ) then
    raise exception 'Quiz assessment aborted: expected course or enrollment lifecycle is missing';
  end if;
  foreach baseline_function in array array[
    'public.is_approved_growvelt_instructor()'::regprocedure,
    'public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure
  ] loop
    if not exists (
      select 1 from pg_proc as procedure_row
      where procedure_row.oid = baseline_function
        and procedure_row.prosecdef
        and exists (
          select 1
          from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
          where split_part(setting_row.setting_value, '=', 1) = 'search_path'
            and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
        )
    ) or has_function_privilege('public', baseline_function, 'EXECUTE')
      or has_function_privilege('anon', baseline_function, 'EXECUTE')
      or not has_function_privilege('authenticated', baseline_function, 'EXECUTE') then
      raise exception 'Quiz assessment aborted: hardened baseline function % is missing', baseline_function;
    end if;
  end loop;
  if pg_get_function_result('public.is_approved_growvelt_instructor()'::regprocedure) <> 'boolean'
    or regexp_replace(
      pg_get_function_result('public.get_own_enrolled_lesson_snapshot(text,bigint)'::regprocedure),
      '\s+',
      '',
      'g'
    ) <> 'TABLE(course_idbigint,course_slugtext,course_titletext,enrollment_idbigint,module_idbigint,module_titletext,module_positioninteger,lesson_idbigint,lesson_titletext,lesson_typetext,lesson_positioninteger,is_previewboolean,is_currentboolean,is_completedboolean,current_text_contenttext,current_video_providertext,current_video_referencetext,current_video_visibilitytext,current_duration_secondsinteger,previous_lesson_idbigint,next_lesson_idbigint)' then
    raise exception 'Quiz assessment aborted: expected baseline RPC result contract is missing';
  end if;
  if to_regclass('public.quiz_lessons') is not null
    or to_regclass('public.quiz_questions') is not null
    or to_regclass('public.quiz_options') is not null
    or to_regclass('public.quiz_attempts') is not null
    or to_regclass('public.quiz_attempt_answers') is not null
    or to_regprocedure('public.get_own_enrolled_quiz_snapshot(text,bigint)') is not null
    or to_regprocedure('public.submit_own_quiz_attempt(text,bigint,jsonb)') is not null
    or to_regprocedure('public.upsert_instructor_quiz_configuration(bigint,text,integer)') is not null
    or to_regprocedure('public.upsert_instructor_quiz_question(bigint,bigint,text,jsonb)') is not null
    or to_regprocedure('public.delete_instructor_quiz_question(bigint,bigint)') is not null
    or to_regprocedure('public.move_instructor_quiz_question(bigint,bigint,text)') is not null
    or to_regprocedure('public.get_own_instructor_quiz_authoring(bigint)') is not null
    or to_regclass('public.lessons_id_course_id_key') is not null
    or to_regclass('public.enrollments_id_learner_course_id_key') is not null then
    raise exception 'Quiz assessment aborted: expected clean Phase 2C-A1 state is missing';
  end if;
end;
$$;

-- These composite keys make an assessment's stored course/enrollment context
-- relationally verifiable, rather than relying only on the submission RPC.
create unique index lessons_id_course_id_key
  on public.lessons (id, course_id);

create unique index enrollments_id_learner_course_id_key
  on public.enrollments (id, learner_id, course_id);

create table public.quiz_lessons (
  id bigint generated by default as identity primary key,
  lesson_id bigint not null unique,
  course_id bigint not null,
  instructions text null,
  passing_percentage integer not null default 70 check (passing_percentage between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_lessons_lesson_course_fkey
    foreign key (lesson_id, course_id)
    references public.lessons (id, course_id)
    on delete cascade,
  constraint quiz_lessons_id_course_key unique (id, course_id)
);

create table public.quiz_questions (
  id bigint generated by default as identity primary key,
  quiz_id bigint not null references public.quiz_lessons(id) on delete cascade,
  question_text text not null check (char_length(btrim(question_text)) between 2 and 2000),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_questions_quiz_position_key unique (quiz_id, position),
  constraint quiz_questions_id_quiz_key unique (id, quiz_id)
);

create table public.quiz_options (
  id bigint generated by default as identity primary key,
  question_id bigint not null references public.quiz_questions(id) on delete cascade,
  option_text text not null check (char_length(btrim(option_text)) between 1 and 500),
  position integer not null check (position > 0),
  is_correct boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_options_question_position_key unique (question_id, position),
  constraint quiz_options_id_question_key unique (id, question_id)
);

create table public.quiz_attempts (
  id bigint generated by default as identity primary key,
  quiz_id bigint not null,
  enrollment_id bigint not null,
  learner_id uuid not null,
  course_id bigint not null,
  submitted_at timestamptz not null default now(),
  correct_answer_count integer not null check (correct_answer_count >= 0),
  total_question_count integer not null check (total_question_count > 0),
  score_percentage integer not null check (score_percentage between 0 and 100),
  passed boolean not null,
  constraint quiz_attempts_counts_valid check (correct_answer_count <= total_question_count),
  constraint quiz_attempts_id_quiz_key unique (id, quiz_id),
  constraint quiz_attempts_quiz_course_fkey
    foreign key (quiz_id, course_id)
    references public.quiz_lessons (id, course_id)
    on delete restrict,
  constraint quiz_attempts_enrollment_identity_fkey
    foreign key (enrollment_id, learner_id, course_id)
    references public.enrollments (id, learner_id, course_id)
    on delete restrict
);

create table public.quiz_attempt_answers (
  id bigint generated by default as identity primary key,
  attempt_id bigint not null,
  quiz_id bigint not null,
  question_id bigint not null,
  selected_option_id bigint not null,
  created_at timestamptz not null default now(),
  constraint quiz_attempt_answers_attempt_question_key unique (attempt_id, question_id),
  constraint quiz_attempt_answers_attempt_quiz_fkey foreign key (attempt_id, quiz_id) references public.quiz_attempts(id, quiz_id) on delete cascade,
  constraint quiz_attempt_answers_question_quiz_fkey foreign key (question_id, quiz_id) references public.quiz_questions(id, quiz_id) on delete restrict,
  constraint quiz_attempt_answers_option_question_fkey foreign key (selected_option_id, question_id) references public.quiz_options(id, question_id) on delete restrict
);

create index quiz_attempts_learner_quiz_submitted_idx
  on public.quiz_attempts (learner_id, enrollment_id, quiz_id, submitted_at desc, id desc);

alter table public.quiz_lessons enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_attempt_answers enable row level security;

revoke all on table public.quiz_lessons, public.quiz_questions, public.quiz_options, public.quiz_attempts, public.quiz_attempt_answers from public, anon, authenticated;

-- PostgreSQL column privileges survive table-level revokes.  Assessment data,
-- particularly quiz_options.is_correct, is browser-inaccessible except through
-- the narrowly scoped SECURITY DEFINER functions below.
do $$
declare
  assessment_table text;
  column_list text;
  identity_sequence text;
begin
  foreach assessment_table in array array['quiz_lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers'] loop
    select string_agg(format('%I', column_row.column_name), ', ' order by column_row.ordinal_position)
    into column_list
    from information_schema.columns as column_row
    where column_row.table_schema = 'public'
      and column_row.table_name = assessment_table;
    execute format('revoke select (%s), insert (%s), update (%s) on public.%I from public, anon, authenticated', column_list, column_list, column_list, assessment_table);
  end loop;
  foreach assessment_table in array array['quiz_lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers'] loop
    identity_sequence := pg_get_serial_sequence(format('public.%I', assessment_table), 'id');
    if identity_sequence is null then
      raise exception 'Quiz assessment aborted: expected assessment identity sequence is missing for %', assessment_table;
    end if;
    execute format('revoke all on sequence %s from public, anon, authenticated', identity_sequence);
  end loop;
end;
$$;

create function public.get_own_enrolled_quiz_snapshot(p_slug text, p_lesson_id bigint)
returns table (
  course_id bigint,
  course_slug text,
  lesson_id bigint,
  lesson_title text,
  quiz_id bigint,
  instructions text,
  passing_percentage integer,
  question_id bigint,
  question_text text,
  question_position integer,
  option_id bigint,
  option_text text,
  option_position integer,
  latest_attempt_submitted_at timestamptz,
  latest_attempt_score_percentage integer,
  latest_attempt_passed boolean,
  attempt_count integer
)
language plpgsql security definer stable set search_path = ''
as $$
declare normalized_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;
  return query
  with enrolled_quiz as (
    select course_row.id as source_course_id,
           course_row.slug as source_course_slug,
           lesson_row.id as source_lesson_id,
           lesson_row.title as source_lesson_title,
           quiz_row.id as source_quiz_id,
           quiz_row.instructions as source_instructions,
           quiz_row.passing_percentage as source_passing_percentage,
           enrollment_row.id as source_enrollment_id
    from public.enrollments as enrollment_row
    join public.learning_courses as course_row
      on course_row.id = enrollment_row.course_id
     and course_row.status = 'published'
    join public.lessons as lesson_row
      on lesson_row.id = p_lesson_id
     and lesson_row.course_id = course_row.id
     and lesson_row.lesson_type = 'quiz'
    join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
    where enrollment_row.learner_id = auth.uid()
      and enrollment_row.status in ('active', 'completed')
      and course_row.slug = normalized_slug
  ), attempt_summary as (
    select attempt_row.submitted_at,
           attempt_row.score_percentage,
           attempt_row.passed,
      row_number() over (order by attempt_row.submitted_at desc, attempt_row.id desc) as attempt_rank,
      count(*) over ()::integer as attempt_count
    from enrolled_quiz
    join public.quiz_attempts as attempt_row
      on attempt_row.quiz_id = enrolled_quiz.source_quiz_id
     and attempt_row.enrollment_id = enrolled_quiz.source_enrollment_id
     and attempt_row.learner_id = auth.uid()
  )
  select enrolled_quiz.source_course_id,
         enrolled_quiz.source_course_slug,
         enrolled_quiz.source_lesson_id,
         enrolled_quiz.source_lesson_title,
         enrolled_quiz.source_quiz_id,
         enrolled_quiz.source_instructions,
         enrolled_quiz.source_passing_percentage,
         question_row.id,
         question_row.question_text,
         question_row.position,
         option_row.id,
         option_row.option_text,
         option_row.position,
         latest_attempt.submitted_at,
         latest_attempt.score_percentage,
         latest_attempt.passed,
         coalesce(latest_attempt.attempt_count, 0)
  from enrolled_quiz
  join public.quiz_questions as question_row on question_row.quiz_id = enrolled_quiz.source_quiz_id
  join public.quiz_options as option_row on option_row.question_id = question_row.id
  left join attempt_summary as latest_attempt on latest_attempt.attempt_rank = 1
  order by question_row.position, question_row.id, option_row.position, option_row.id;
end;
$$;

create function public.submit_own_quiz_attempt(p_slug text, p_lesson_id bigint, p_answers jsonb)
returns table (attempt_id bigint, submitted_at timestamptz, score_percentage integer, passed boolean, correct_answer_count integer, total_question_count integer)
language plpgsql security definer set search_path = ''
as $$
declare
  normalized_slug text := lower(btrim(p_slug));
  own_enrollment_id bigint;
  own_course_id bigint;
  quiz_key bigint;
  passing_mark integer;
  question_total integer;
  submitted_total integer;
  distinct_questions integer;
  correct_total integer;
  calculated_score integer;
  created_attempt_id bigint;
  created_submitted_at timestamptz;
  calculated_passed boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;
  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Quiz answers must be an array' using errcode = '22023';
  end if;

  select enrollment_row.id,
         course_row.id,
         quiz_row.id,
         quiz_row.passing_percentage
  into own_enrollment_id, own_course_id, quiz_key, passing_mark
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row
    on course_row.id = enrollment_row.course_id
   and course_row.status = 'published'
  join public.lessons as lesson_row
    on lesson_row.id = p_lesson_id
   and lesson_row.course_id = course_row.id
   and lesson_row.lesson_type = 'quiz'
  join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where enrollment_row.learner_id = auth.uid()
    and enrollment_row.status in ('active', 'completed')
    and course_row.slug = normalized_slug
  for update of enrollment_row, course_row, lesson_row, quiz_row;
  if quiz_key is null then
    raise exception 'This quiz is not available to this account' using errcode = '42501';
  end if;

  with submitted_answers as (
    select
      case
        when jsonb_typeof(answer_item.value) = 'object'
          and (answer_item.value ->> 'question_id') ~ '^[1-9][0-9]*$'
          then (answer_item.value ->> 'question_id')::bigint
        else null
      end as question_id,
      case
        when jsonb_typeof(answer_item.value) = 'object'
          and (answer_item.value ->> 'option_id') ~ '^[1-9][0-9]*$'
          then (answer_item.value ->> 'option_id')::bigint
        else null
      end as option_id
    from jsonb_array_elements(p_answers) as answer_item(value)
  )
  select count(*)::integer, count(distinct submitted_answers.question_id)::integer
  into submitted_total, distinct_questions
  from submitted_answers;

  select count(question_row.id)::integer into question_total
  from public.quiz_questions as question_row
  where question_row.quiz_id = quiz_key;
  if question_total < 1 then
    raise exception 'This quiz is not ready for submission' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.quiz_questions as question_row
    left join public.quiz_options as option_row on option_row.question_id = question_row.id
    where question_row.quiz_id = quiz_key
    group by question_row.id
    having count(option_row.id) not between 2 and 6
      or count(option_row.id) filter (where option_row.is_correct) <> 1
  ) then
    raise exception 'This quiz is not ready for submission' using errcode = '22023';
  end if;
  if submitted_total <> question_total or distinct_questions <> question_total then
    raise exception 'Answer every quiz question exactly once' using errcode = '22023';
  end if;

  if exists (
    with submitted_answers as (
      select
        case
          when jsonb_typeof(answer_item.value) = 'object'
            and (answer_item.value ->> 'question_id') ~ '^[1-9][0-9]*$'
            then (answer_item.value ->> 'question_id')::bigint
          else null
        end as question_id,
        case
          when jsonb_typeof(answer_item.value) = 'object'
            and (answer_item.value ->> 'option_id') ~ '^[1-9][0-9]*$'
            then (answer_item.value ->> 'option_id')::bigint
          else null
        end as option_id
      from jsonb_array_elements(p_answers) as answer_item(value)
    )
    select 1
    from submitted_answers
    left join public.quiz_questions as question_row
      on question_row.id = submitted_answers.question_id
     and question_row.quiz_id = quiz_key
    left join public.quiz_options as option_row
      on option_row.id = submitted_answers.option_id
     and option_row.question_id = question_row.id
    where submitted_answers.question_id is null
      or submitted_answers.option_id is null
      or question_row.id is null
      or option_row.id is null
  ) then
    raise exception 'Quiz answers do not match this assessment' using errcode = '22023';
  end if;

  with submitted_answers as (
    select (answer_item.value ->> 'question_id')::bigint as question_id, (answer_item.value ->> 'option_id')::bigint as option_id
    from jsonb_array_elements(p_answers) as answer_item(value)
  )
  select count(*) filter (where option_row.is_correct)::integer into correct_total
  from submitted_answers
  join public.quiz_options as option_row
    on option_row.id = submitted_answers.option_id
   and option_row.question_id = submitted_answers.question_id;

  calculated_score := floor((correct_total::numeric * 100) / question_total)::integer;
  calculated_passed := calculated_score >= passing_mark;
  insert into public.quiz_attempts (
    quiz_id,
    enrollment_id,
    learner_id,
    course_id,
    correct_answer_count,
    total_question_count,
    score_percentage,
    passed
  )
  values (quiz_key, own_enrollment_id, auth.uid(), own_course_id, correct_total, question_total, calculated_score, calculated_passed)
  returning id, submitted_at into created_attempt_id, created_submitted_at;

  insert into public.quiz_attempt_answers (attempt_id, quiz_id, question_id, selected_option_id)
  select created_attempt_id, quiz_key, (answer_item.value ->> 'question_id')::bigint, (answer_item.value ->> 'option_id')::bigint
  from jsonb_array_elements(p_answers) as answer_item(value);

  return query
  select created_attempt_id,
         created_submitted_at,
         calculated_score,
         calculated_passed,
         correct_total,
         question_total;
end;
$$;

create function public.upsert_instructor_quiz_configuration(p_lesson_id bigint, p_instructions text, p_passing_percentage integer)
returns table (quiz_id bigint, instructions text, passing_percentage integer)
language plpgsql security definer set search_path = ''
as $$
declare
  course_key bigint;
  quiz_key bigint;
  normalized_instructions text := nullif(btrim(p_instructions), '');
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if p_passing_percentage is null or p_passing_percentage not between 1 and 100 then
    raise exception 'Passing percentage must be between 1 and 100' using errcode = '22023';
  end if;
  if normalized_instructions is not null and char_length(normalized_instructions) > 5000 then
    raise exception 'Quiz instructions are too long' using errcode = '22023';
  end if;

  select course_row.id
  into course_key
  from public.lessons as lesson_row
  join public.learning_courses as course_row on course_row.id = lesson_row.course_id
  where lesson_row.id = p_lesson_id
    and lesson_row.lesson_type = 'quiz'
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft';
  if course_key is null then
    raise exception 'Draft quiz lesson not found or is no longer editable' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(course_key);
  if not exists (
    select 1
    from public.lessons as lesson_row
    join public.learning_courses as course_row on course_row.id = lesson_row.course_id
    where lesson_row.id = p_lesson_id
      and lesson_row.lesson_type = 'quiz'
      and course_row.id = course_key
      and course_row.instructor_id = auth.uid()
      and course_row.status = 'draft'
  ) then
    raise exception 'Draft quiz lesson not found or is no longer editable' using errcode = 'P0002';
  end if;
  insert into public.quiz_lessons as quiz_row (lesson_id, course_id, instructions, passing_percentage)
  values (p_lesson_id, course_key, normalized_instructions, p_passing_percentage)
  on conflict (lesson_id) do update
    set instructions = excluded.instructions,
        passing_percentage = excluded.passing_percentage,
        updated_at = now()
  returning quiz_row.id into quiz_key;
  return query
  select quiz_key, normalized_instructions, p_passing_percentage;
end;
$$;

create function public.upsert_instructor_quiz_question(p_lesson_id bigint, p_question_id bigint default null, p_question_text text default null, p_options jsonb default '[]'::jsonb)
returns table (question_id bigint, question_position integer)
language plpgsql security definer set search_path = ''
as $$
declare
  course_key bigint;
  quiz_key bigint;
  question_key bigint;
  next_position integer;
  normalized_question text := btrim(p_question_text);
  option_total integer;
  correct_total integer;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if normalized_question is null or char_length(normalized_question) not between 2 and 2000 then
    raise exception 'Quiz question must be between 2 and 2000 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(p_options) <> 'array' then
    raise exception 'Quiz options must be an array' using errcode = '22023';
  end if;

  with option_rows as (
    select answer_item.value
    from jsonb_array_elements(p_options) as answer_item(value)
  )
  select count(*)::integer,
    count(*) filter (
      where case
        when jsonb_typeof(option_rows.value -> 'is_correct') = 'boolean'
          then (option_rows.value ->> 'is_correct')::boolean
        else false
      end
    )::integer
  into option_total, correct_total
  from option_rows;
  if option_total not between 2 and 6 or correct_total <> 1 then
    raise exception 'Each question needs 2 to 6 options and exactly one correct option' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_options) as answer_item(value)
    where jsonb_typeof(answer_item.value) <> 'object'
      or jsonb_typeof(answer_item.value -> 'is_correct') <> 'boolean'
      or char_length(btrim(coalesce(answer_item.value ->> 'option_text', ''))) not between 1 and 500
  ) then
    raise exception 'Each quiz option needs valid text and a correct-answer flag' using errcode = '22023';
  end if;

  select course_row.id, quiz_row.id
  into course_key, quiz_key
  from public.lessons as lesson_row
  join public.learning_courses as course_row on course_row.id = lesson_row.course_id
  join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where lesson_row.id = p_lesson_id
    and lesson_row.lesson_type = 'quiz'
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft';
  if quiz_key is null then
    raise exception 'Draft quiz configuration not found or is no longer editable' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(course_key);
  select quiz_row.id into quiz_key
  from public.lessons as lesson_row
  join public.learning_courses as course_row on course_row.id = lesson_row.course_id
  join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where lesson_row.id = p_lesson_id and lesson_row.lesson_type = 'quiz'
    and course_row.id = course_key and course_row.instructor_id = auth.uid() and course_row.status = 'draft';
  if quiz_key is null then
    raise exception 'Draft quiz configuration not found or is no longer editable' using errcode = 'P0002';
  end if;

  if p_question_id is null then
    select coalesce(max(question_row.position), 0) + 1
    into next_position
    from public.quiz_questions as question_row
    where question_row.quiz_id = quiz_key;
    insert into public.quiz_questions (quiz_id, question_text, position)
    values (quiz_key, normalized_question, next_position)
    returning id into question_key;
  else
    select question_row.id
    into question_key
    from public.quiz_questions as question_row
    where question_row.id = p_question_id
      and question_row.quiz_id = quiz_key
    for update;
    if question_key is null then
      raise exception 'Quiz question not found' using errcode = 'P0002';
    end if;
    update public.quiz_questions as question_row
    set question_text = normalized_question,
        updated_at = now()
    where question_row.id = question_key
      and question_row.quiz_id = quiz_key;
    delete from public.quiz_options as option_row where option_row.question_id = question_key;
  end if;

  insert into public.quiz_options (question_id, option_text, position, is_correct)
  select question_key,
         btrim(answer_item.value ->> 'option_text'),
         answer_item.ordinality::integer,
         (answer_item.value ->> 'is_correct')::boolean
  from jsonb_array_elements(p_options) with ordinality as answer_item(value, ordinality);

  return query
  select question_key, question_row.position
  from public.quiz_questions as question_row
  where question_row.id = question_key;
end;
$$;

create function public.delete_instructor_quiz_question(p_lesson_id bigint, p_question_id bigint)
returns table (deleted_question_id bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  course_key bigint;
  quiz_key bigint;
  question_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  select course_row.id, quiz_row.id
  into course_key, quiz_key
  from public.lessons as lesson_row
  join public.learning_courses as course_row on course_row.id = lesson_row.course_id
  join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where lesson_row.id = p_lesson_id
    and lesson_row.lesson_type = 'quiz'
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft';
  if quiz_key is null then
    raise exception 'Draft quiz configuration not found or is no longer editable' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(course_key);
  select quiz_row.id into quiz_key
  from public.lessons as lesson_row
  join public.learning_courses as course_row on course_row.id = lesson_row.course_id
  join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where lesson_row.id = p_lesson_id and lesson_row.lesson_type = 'quiz'
    and course_row.id = course_key and course_row.instructor_id = auth.uid() and course_row.status = 'draft';
  if quiz_key is null then
    raise exception 'Draft quiz configuration not found or is no longer editable' using errcode = 'P0002';
  end if;
  delete from public.quiz_questions as question_row
  where question_row.id = p_question_id
    and question_row.quiz_id = quiz_key
  returning question_row.id into question_key;
  if question_key is null then
    raise exception 'Quiz question not found' using errcode = 'P0002';
  end if;
  return query
  select question_key;
end;
$$;

create function public.move_instructor_quiz_question(p_lesson_id bigint, p_question_id bigint, p_direction text)
returns table (moved_question_id bigint, moved_question_position integer)
language plpgsql security definer set search_path = ''
as $$
declare
  course_key bigint;
  quiz_key bigint;
  source_position integer;
  target_id bigint;
  target_position integer;
  temporary_position integer;
  normalized_direction text := lower(btrim(p_direction));
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if normalized_direction not in ('up', 'down') then
    raise exception 'Move direction must be up or down' using errcode = '22023';
  end if;
  select course_row.id, quiz_row.id
  into course_key, quiz_key
  from public.lessons as lesson_row
  join public.learning_courses as course_row on course_row.id = lesson_row.course_id
  join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where lesson_row.id = p_lesson_id
    and lesson_row.lesson_type = 'quiz'
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft';
  if quiz_key is null then
    raise exception 'Draft quiz configuration not found or is no longer editable' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(course_key);
  select quiz_row.id into quiz_key
  from public.lessons as lesson_row
  join public.learning_courses as course_row on course_row.id = lesson_row.course_id
  join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
  where lesson_row.id = p_lesson_id and lesson_row.lesson_type = 'quiz'
    and course_row.id = course_key and course_row.instructor_id = auth.uid() and course_row.status = 'draft';
  if quiz_key is null then
    raise exception 'Draft quiz configuration not found or is no longer editable' using errcode = 'P0002';
  end if;
  select question_row.position
  into source_position
  from public.quiz_questions as question_row
  where question_row.id = p_question_id
    and question_row.quiz_id = quiz_key
  for update;
  if source_position is null then
    raise exception 'Quiz question not found' using errcode = 'P0002';
  end if;
  select question_row.id, question_row.position
  into target_id, target_position
  from public.quiz_questions as question_row
  where question_row.quiz_id = quiz_key
    and (
      (normalized_direction = 'up' and question_row.position < source_position)
      or (normalized_direction = 'down' and question_row.position > source_position)
    )
  order by
    case when normalized_direction = 'up' then question_row.position end desc,
    case when normalized_direction = 'down' then question_row.position end asc,
    question_row.id asc
  limit 1
  for update;

  if target_id is not null then
    -- The unique/check constraints remain valid throughout the swap. The
    -- course advisory lock serializes all question-order mutations.
    select coalesce(max(question_row.position), 0) + 1
    into temporary_position
    from public.quiz_questions as question_row
    where question_row.quiz_id = quiz_key;
    update public.quiz_questions as question_row
    set position = temporary_position
    where question_row.id = p_question_id
      and question_row.quiz_id = quiz_key;
    update public.quiz_questions as question_row
    set position = source_position
    where question_row.id = target_id
      and question_row.quiz_id = quiz_key;
    update public.quiz_questions as question_row
    set position = target_position
    where question_row.id = p_question_id
      and question_row.quiz_id = quiz_key;
    source_position := target_position;
  end if;
  return query
  select p_question_id, source_position;
end;
$$;

create function public.get_own_instructor_quiz_authoring(p_lesson_id bigint)
returns table (quiz_id bigint, instructions text, passing_percentage integer, question_id bigint, question_text text, question_position integer, option_id bigint, option_text text, option_position integer, is_correct boolean)
language plpgsql security definer stable set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.lessons as lesson_row
    join public.learning_courses as course_row on course_row.id = lesson_row.course_id
    where lesson_row.id = p_lesson_id
      and lesson_row.lesson_type = 'quiz'
      and course_row.instructor_id = auth.uid()
      and course_row.status = 'draft'
  ) then
    raise exception 'Draft quiz lesson not found or is no longer editable' using errcode = 'P0002';
  end if;
  return query
  select quiz_row.id,
         quiz_row.instructions,
         quiz_row.passing_percentage,
         question_row.id,
         question_row.question_text,
         question_row.position,
         option_row.id,
         option_row.option_text,
         option_row.position,
         option_row.is_correct
  from public.quiz_lessons as quiz_row
  left join public.quiz_questions as question_row on question_row.quiz_id = quiz_row.id
  left join public.quiz_options as option_row on option_row.question_id = question_row.id
  where quiz_row.lesson_id = p_lesson_id
  order by question_row.position, question_row.id, option_row.position, option_row.id;
end;
$$;

revoke execute on function public.get_own_enrolled_quiz_snapshot(text,bigint), public.submit_own_quiz_attempt(text,bigint,jsonb), public.upsert_instructor_quiz_configuration(bigint,text,integer), public.upsert_instructor_quiz_question(bigint,bigint,text,jsonb), public.delete_instructor_quiz_question(bigint,bigint), public.move_instructor_quiz_question(bigint,bigint,text), public.get_own_instructor_quiz_authoring(bigint) from public, anon, authenticated;
grant execute on function public.get_own_enrolled_quiz_snapshot(text,bigint), public.submit_own_quiz_attempt(text,bigint,jsonb), public.upsert_instructor_quiz_configuration(bigint,text,integer), public.upsert_instructor_quiz_question(bigint,bigint,text,jsonb), public.delete_instructor_quiz_question(bigint,bigint), public.move_instructor_quiz_question(bigint,bigint,text), public.get_own_instructor_quiz_authoring(bigint) to authenticated;

do $$
declare
  assessment_function regprocedure;
  mismatch_row record;
begin
  if exists (
    select 1 from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('quiz_lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers')
      and not relation_row.relrowsecurity
  ) then raise exception 'Quiz assessment aborted: assessment RLS is not enabled'; end if;
  if exists (
    select 1 from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public' and relation_row.relname in ('quiz_lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers')
      and (has_table_privilege('public', relation_row.oid, 'SELECT') or has_table_privilege('anon', relation_row.oid, 'SELECT') or has_table_privilege('authenticated', relation_row.oid, 'SELECT') or has_table_privilege('public', relation_row.oid, 'INSERT') or has_table_privilege('anon', relation_row.oid, 'INSERT') or has_table_privilege('authenticated', relation_row.oid, 'INSERT') or has_table_privilege('public', relation_row.oid, 'UPDATE') or has_table_privilege('anon', relation_row.oid, 'UPDATE') or has_table_privilege('authenticated', relation_row.oid, 'UPDATE') or has_table_privilege('public', relation_row.oid, 'DELETE') or has_table_privilege('anon', relation_row.oid, 'DELETE') or has_table_privilege('authenticated', relation_row.oid, 'DELETE') or has_table_privilege('public', relation_row.oid, 'TRUNCATE') or has_table_privilege('anon', relation_row.oid, 'TRUNCATE') or has_table_privilege('authenticated', relation_row.oid, 'TRUNCATE') or has_table_privilege('public', relation_row.oid, 'REFERENCES') or has_table_privilege('anon', relation_row.oid, 'REFERENCES') or has_table_privilege('authenticated', relation_row.oid, 'REFERENCES') or has_table_privilege('public', relation_row.oid, 'TRIGGER') or has_table_privilege('anon', relation_row.oid, 'TRIGGER') or has_table_privilege('authenticated', relation_row.oid, 'TRIGGER'))
  ) then raise exception 'Quiz assessment aborted: browser table access remains'; end if;
  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    join pg_attribute as attribute_row on attribute_row.attrelid = relation_row.oid and attribute_row.attnum > 0 and not attribute_row.attisdropped
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('quiz_lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers')
      and (has_column_privilege('public', relation_row.oid, attribute_row.attname::text, 'SELECT') or has_column_privilege('anon', relation_row.oid, attribute_row.attname::text, 'SELECT') or has_column_privilege('authenticated', relation_row.oid, attribute_row.attname::text, 'SELECT') or has_column_privilege('public', relation_row.oid, attribute_row.attname::text, 'INSERT') or has_column_privilege('anon', relation_row.oid, attribute_row.attname::text, 'INSERT') or has_column_privilege('authenticated', relation_row.oid, attribute_row.attname::text, 'INSERT') or has_column_privilege('public', relation_row.oid, attribute_row.attname::text, 'UPDATE') or has_column_privilege('anon', relation_row.oid, attribute_row.attname::text, 'UPDATE') or has_column_privilege('authenticated', relation_row.oid, attribute_row.attname::text, 'UPDATE'))
  ) then raise exception 'Quiz assessment aborted: browser assessment column access remains'; end if;
  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('quiz_lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers')
      and (not has_table_privilege('service_role', relation_row.oid, 'SELECT') or not has_table_privilege('service_role', relation_row.oid, 'INSERT') or not has_table_privilege('service_role', relation_row.oid, 'UPDATE') or not has_table_privilege('service_role', relation_row.oid, 'DELETE'))
  ) then raise exception 'Quiz assessment aborted: service_role operational access is missing'; end if;
  if exists (
    select 1
    from unnest(array['quiz_lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers']) as assessment_table(table_name)
    where not has_sequence_privilege('service_role', pg_get_serial_sequence(format('public.%I', assessment_table.table_name), 'id'), 'USAGE')
      or has_sequence_privilege('public', pg_get_serial_sequence(format('public.%I', assessment_table.table_name), 'id'), 'USAGE')
      or has_sequence_privilege('anon', pg_get_serial_sequence(format('public.%I', assessment_table.table_name), 'id'), 'USAGE')
      or has_sequence_privilege('authenticated', pg_get_serial_sequence(format('public.%I', assessment_table.table_name), 'id'), 'USAGE')
  ) then
    raise exception 'Quiz assessment aborted: assessment sequence privileges are not hardened';
  end if;
  if not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.quiz_lessons'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.lessons'::regclass
      and (
        select array_agg(attribute_row.attname::text order by key_column.ordinality)
        from unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.conrelid and attribute_row.attnum = key_column.attnum
      ) = array['lesson_id', 'course_id']::text[]
      and (
        select array_agg(attribute_row.attname::text order by key_column.ordinality)
        from unnest(constraint_row.confkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.confrelid and attribute_row.attnum = key_column.attnum
      ) = array['id', 'course_id']::text[]
  ) or not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.quiz_attempts'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.quiz_lessons'::regclass
      and (
        select array_agg(attribute_row.attname::text order by key_column.ordinality)
        from unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.conrelid and attribute_row.attnum = key_column.attnum
      ) = array['quiz_id', 'course_id']::text[]
      and (
        select array_agg(attribute_row.attname::text order by key_column.ordinality)
        from unnest(constraint_row.confkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.confrelid and attribute_row.attnum = key_column.attnum
      ) = array['id', 'course_id']::text[]
  ) or not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.quiz_attempts'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.enrollments'::regclass
      and (
        select array_agg(attribute_row.attname::text order by key_column.ordinality)
        from unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.conrelid and attribute_row.attnum = key_column.attnum
      ) = array['enrollment_id', 'learner_id', 'course_id']::text[]
      and (
        select array_agg(attribute_row.attname::text order by key_column.ordinality)
        from unnest(constraint_row.confkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute as attribute_row on attribute_row.attrelid = constraint_row.confrelid and attribute_row.attnum = key_column.attnum
      ) = array['id', 'learner_id', 'course_id']::text[]
  ) then
    raise exception 'Quiz assessment aborted: assessment relational integrity is missing';
  end if;
  foreach assessment_function in array array[
    'public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure,
    'public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure,
    'public.upsert_instructor_quiz_configuration(bigint,text,integer)'::regprocedure,
    'public.upsert_instructor_quiz_question(bigint,bigint,text,jsonb)'::regprocedure,
    'public.delete_instructor_quiz_question(bigint,bigint)'::regprocedure,
    'public.move_instructor_quiz_question(bigint,bigint,text)'::regprocedure,
    'public.get_own_instructor_quiz_authoring(bigint)'::regprocedure
  ] loop
    if not exists (select 1 from pg_proc as procedure_row where procedure_row.oid = assessment_function and procedure_row.prosecdef and exists (select 1 from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value) where split_part(setting_row.setting_value, '=', 1) = 'search_path' and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = '')) or has_function_privilege('public', assessment_function, 'EXECUTE') or has_function_privilege('anon', assessment_function, 'EXECUTE') or not has_function_privilege('authenticated', assessment_function, 'EXECUTE') then raise exception 'Quiz assessment aborted: RPC security or grants are not hardened for %', assessment_function; end if;
  end loop;
  -- RETURNS TABLE functions include input and output entries in pg_proc's
  -- argument arrays. Pair the three arrays by catalog sequence, keep only
  -- TABLE/OUT modes, then derive a fresh 1-based output position.
  foreach assessment_function in array array[
    'public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure,
    'public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure,
    'public.upsert_instructor_quiz_configuration(bigint,text,integer)'::regprocedure,
    'public.upsert_instructor_quiz_question(bigint,bigint,text,jsonb)'::regprocedure,
    'public.delete_instructor_quiz_question(bigint,bigint)'::regprocedure,
    'public.move_instructor_quiz_question(bigint,bigint,text)'::regprocedure,
    'public.get_own_instructor_quiz_authoring(bigint)'::regprocedure
  ] loop
    for mismatch_row in
      with expected_outputs(expected_function, output_position, output_name, output_type) as (
        values
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 1, 'course_id', 'bigint'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 2, 'course_slug', 'text'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 3, 'lesson_id', 'bigint'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 4, 'lesson_title', 'text'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 5, 'quiz_id', 'bigint'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 6, 'instructions', 'text'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 7, 'passing_percentage', 'integer'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 8, 'question_id', 'bigint'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 9, 'question_text', 'text'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 10, 'question_position', 'integer'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 11, 'option_id', 'bigint'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 12, 'option_text', 'text'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 13, 'option_position', 'integer'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 14, 'latest_attempt_submitted_at', 'timestamptz'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 15, 'latest_attempt_score_percentage', 'integer'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 16, 'latest_attempt_passed', 'boolean'::regtype::oid),
          ('public.get_own_enrolled_quiz_snapshot(text,bigint)'::regprocedure, 17, 'attempt_count', 'integer'::regtype::oid),
          ('public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure, 1, 'attempt_id', 'bigint'::regtype::oid),
          ('public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure, 2, 'submitted_at', 'timestamptz'::regtype::oid),
          ('public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure, 3, 'score_percentage', 'integer'::regtype::oid),
          ('public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure, 4, 'passed', 'boolean'::regtype::oid),
          ('public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure, 5, 'correct_answer_count', 'integer'::regtype::oid),
          ('public.submit_own_quiz_attempt(text,bigint,jsonb)'::regprocedure, 6, 'total_question_count', 'integer'::regtype::oid),
          ('public.upsert_instructor_quiz_configuration(bigint,text,integer)'::regprocedure, 1, 'quiz_id', 'bigint'::regtype::oid),
          ('public.upsert_instructor_quiz_configuration(bigint,text,integer)'::regprocedure, 2, 'instructions', 'text'::regtype::oid),
          ('public.upsert_instructor_quiz_configuration(bigint,text,integer)'::regprocedure, 3, 'passing_percentage', 'integer'::regtype::oid),
          ('public.upsert_instructor_quiz_question(bigint,bigint,text,jsonb)'::regprocedure, 1, 'question_id', 'bigint'::regtype::oid),
          ('public.upsert_instructor_quiz_question(bigint,bigint,text,jsonb)'::regprocedure, 2, 'question_position', 'integer'::regtype::oid),
          ('public.delete_instructor_quiz_question(bigint,bigint)'::regprocedure, 1, 'deleted_question_id', 'bigint'::regtype::oid),
          ('public.move_instructor_quiz_question(bigint,bigint,text)'::regprocedure, 1, 'moved_question_id', 'bigint'::regtype::oid),
          ('public.move_instructor_quiz_question(bigint,bigint,text)'::regprocedure, 2, 'moved_question_position', 'integer'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 1, 'quiz_id', 'bigint'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 2, 'instructions', 'text'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 3, 'passing_percentage', 'integer'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 4, 'question_id', 'bigint'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 5, 'question_text', 'text'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 6, 'question_position', 'integer'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 7, 'option_id', 'bigint'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 8, 'option_text', 'text'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 9, 'option_position', 'integer'::regtype::oid),
          ('public.get_own_instructor_quiz_authoring(bigint)'::regprocedure, 10, 'is_correct', 'boolean'::regtype::oid)
      ), actual_catalog_arguments as (
        select catalog_argument.argument_name::text as output_name,
               catalog_argument.argument_type as output_type,
               catalog_argument.argument_mode as output_mode,
               catalog_argument.ordinality as catalog_ordinality
        from pg_proc as procedure_row
        cross join lateral unnest(
          procedure_row.proallargtypes,
          procedure_row.proargmodes,
          procedure_row.proargnames
        ) with ordinality as catalog_argument(argument_type, argument_mode, argument_name, ordinality)
        where procedure_row.oid = assessment_function
          and catalog_argument.argument_mode in ('t'::"char", 'o'::"char")
      ), actual_outputs as (
        select actual_catalog_arguments.output_name,
               actual_catalog_arguments.output_type,
               actual_catalog_arguments.output_mode,
               row_number() over (order by actual_catalog_arguments.catalog_ordinality)::integer as output_position
        from actual_catalog_arguments
      )
      select coalesce(expected_outputs.output_position, actual_outputs.output_position) as output_position,
             expected_outputs.output_name as expected_name,
             expected_outputs.output_type as expected_type,
             actual_outputs.output_name as actual_name,
             actual_outputs.output_type as actual_type,
             actual_outputs.output_mode as actual_mode
      from expected_outputs
      full join actual_outputs on actual_outputs.output_position = expected_outputs.output_position
      where coalesce(expected_outputs.expected_function, assessment_function) = assessment_function
        and (
          expected_outputs.output_position is null
         or actual_outputs.output_position is null
         or expected_outputs.output_name <> actual_outputs.output_name
         or expected_outputs.output_type <> actual_outputs.output_type
        )
      order by coalesce(expected_outputs.output_position, actual_outputs.output_position)
      limit 1
    loop
      raise exception 'Quiz assessment aborted: return contract mismatch for %', assessment_function::text
        using detail = format(
          'expected position %s: %s %s; actual position %s: %s %s (catalog mode %s)',
          mismatch_row.output_position,
          coalesce(mismatch_row.expected_name, '<none>'),
          coalesce(format_type(mismatch_row.expected_type, null), '<none>'),
          mismatch_row.output_position,
          coalesce(mismatch_row.actual_name, '<none>'),
          coalesce(format_type(mismatch_row.actual_type, null), '<none>'),
          coalesce(mismatch_row.actual_mode::text, '<none>')
        );
    end loop;
  end loop;
end;
$$;

commit;
