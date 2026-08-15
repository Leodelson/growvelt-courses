-- Phase 2D-J: Instructor-only Learning analytics aggregates.
-- Forward-only. This exposes course-level aggregates only; no learner roster,
-- answer data, or browser table access is introduced.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
    or to_regclass('public.enrollments') is null
    or to_regclass('public.quiz_lessons') is null
    or to_regclass('public.quiz_attempts') is null then
    raise exception 'Instructor analytics aborted: required Learning relations are missing';
  end if;

  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('learning_courses', 'enrollments', 'quiz_lessons', 'quiz_attempts')
      and not relation_row.relrowsecurity
  ) then
    raise exception 'Instructor analytics aborted: Learning RLS baseline is missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('learning_courses', 'id'),
        ('learning_courses', 'instructor_id'),
        ('learning_courses', 'title'),
        ('learning_courses', 'status'),
        ('enrollments', 'id'),
        ('enrollments', 'course_id'),
        ('enrollments', 'status'),
        ('enrollments', 'enrolled_at'),
        ('quiz_lessons', 'id'),
        ('quiz_lessons', 'course_id'),
        ('quiz_attempts', 'id'),
        ('quiz_attempts', 'course_id'),
        ('quiz_attempts', 'passed'),
        ('quiz_attempts', 'score_percentage')
    ) as expected_column(relation_name, column_name)
    left join information_schema.columns as column_row
      on column_row.table_schema = 'public'
      and column_row.table_name = expected_column.relation_name
      and column_row.column_name = expected_column.column_name
    where column_row.column_name is null
  ) then
    raise exception 'Instructor analytics aborted: required column baseline is missing';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.is_approved_growvelt_instructor()'::regprocedure
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  ) then
    raise exception 'Instructor analytics aborted: approved-Instructor capability baseline is unexpected';
  end if;

  if to_regprocedure('public.get_own_instructor_learning_analytics()') is not null then
    raise exception 'Instructor analytics aborted: partial analytics function state already exists';
  end if;
end;
$$;

create function public.get_own_instructor_learning_analytics()
returns table (
  course_id bigint,
  course_title text,
  course_status text,
  enrolled_learner_count integer,
  active_learner_count integer,
  completed_learner_count integer,
  completion_rate integer,
  quiz_count integer,
  quiz_attempt_count integer,
  quiz_passed_attempt_count integer,
  quiz_attempt_pass_rate integer,
  average_quiz_score integer,
  last_enrolled_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  return query
  with own_courses as (
    select
      course_row.id as source_course_id,
      course_row.title as source_course_title,
      course_row.status as source_course_status
    from public.learning_courses as course_row
    where course_row.instructor_id = auth.uid()
  ),
  enrollment_metrics as (
    select
      enrollment_row.course_id as source_course_id,
      count(*) filter (where enrollment_row.status in ('active', 'completed'))::integer as source_enrolled_learner_count,
      count(*) filter (where enrollment_row.status = 'active')::integer as source_active_learner_count,
      count(*) filter (where enrollment_row.status = 'completed')::integer as source_completed_learner_count,
      max(enrollment_row.enrolled_at) filter (where enrollment_row.status in ('active', 'completed')) as source_last_enrolled_at
    from public.enrollments as enrollment_row
    join own_courses as course_row
      on course_row.source_course_id = enrollment_row.course_id
    group by enrollment_row.course_id
  ),
  quiz_metrics as (
    select
      attempt_row.course_id as source_course_id,
      count(*)::integer as source_quiz_attempt_count,
      count(*) filter (where attempt_row.passed)::integer as source_quiz_passed_attempt_count,
      coalesce(round(avg(attempt_row.score_percentage))::integer, 0) as source_average_quiz_score
    from public.quiz_attempts as attempt_row
    join own_courses as course_row
      on course_row.source_course_id = attempt_row.course_id
    group by attempt_row.course_id
  ),
  quiz_totals as (
    select
      quiz_row.course_id as source_course_id,
      count(*)::integer as source_quiz_count
    from public.quiz_lessons as quiz_row
    join own_courses as course_row
      on course_row.source_course_id = quiz_row.course_id
    group by quiz_row.course_id
  )
  select
    course_row.source_course_id,
    course_row.source_course_title,
    course_row.source_course_status,
    coalesce(enrollment_row.source_enrolled_learner_count, 0),
    coalesce(enrollment_row.source_active_learner_count, 0),
    coalesce(enrollment_row.source_completed_learner_count, 0),
    case
      when coalesce(enrollment_row.source_enrolled_learner_count, 0) = 0 then 0
      else round(
        (coalesce(enrollment_row.source_completed_learner_count, 0)::numeric
          / enrollment_row.source_enrolled_learner_count::numeric) * 100
      )::integer
    end,
    coalesce(quiz_total_row.source_quiz_count, 0),
    coalesce(quiz_row.source_quiz_attempt_count, 0),
    coalesce(quiz_row.source_quiz_passed_attempt_count, 0),
    case
      when coalesce(quiz_row.source_quiz_attempt_count, 0) = 0 then 0
      else round(
        (quiz_row.source_quiz_passed_attempt_count::numeric
          / quiz_row.source_quiz_attempt_count::numeric) * 100
      )::integer
    end,
    coalesce(quiz_row.source_average_quiz_score, 0),
    enrollment_row.source_last_enrolled_at
  from own_courses as course_row
  left join enrollment_metrics as enrollment_row
    on enrollment_row.source_course_id = course_row.source_course_id
  left join quiz_metrics as quiz_row
    on quiz_row.source_course_id = course_row.source_course_id
  left join quiz_totals as quiz_total_row
    on quiz_total_row.source_course_id = course_row.source_course_id
  order by course_row.source_course_title asc, course_row.source_course_id asc;
end;
$$;

revoke execute on function public.get_own_instructor_learning_analytics() from public, anon, authenticated;
grant execute on function public.get_own_instructor_learning_analytics() to authenticated;

do $$
declare
  analytics_function regprocedure := 'public.get_own_instructor_learning_analytics()'::regprocedure;
  mismatch record;
begin
  select
    expected_output.output_position,
    expected_output.output_name as expected_name,
    expected_output.output_type::regtype::text as expected_type,
    actual_output.output_name as actual_name,
    actual_output.output_type::regtype::text as actual_type,
    actual_output.output_mode as actual_mode
  into mismatch
  from (
    values
      (1, 'course_id'::text, 'bigint'::regtype::oid),
      (2, 'course_title'::text, 'text'::regtype::oid),
      (3, 'course_status'::text, 'text'::regtype::oid),
      (4, 'enrolled_learner_count'::text, 'integer'::regtype::oid),
      (5, 'active_learner_count'::text, 'integer'::regtype::oid),
      (6, 'completed_learner_count'::text, 'integer'::regtype::oid),
      (7, 'completion_rate'::text, 'integer'::regtype::oid),
      (8, 'quiz_count'::text, 'integer'::regtype::oid),
      (9, 'quiz_attempt_count'::text, 'integer'::regtype::oid),
      (10, 'quiz_passed_attempt_count'::text, 'integer'::regtype::oid),
      (11, 'quiz_attempt_pass_rate'::text, 'integer'::regtype::oid),
      (12, 'average_quiz_score'::text, 'integer'::regtype::oid),
      (13, 'last_enrolled_at'::text, 'timestamptz'::regtype::oid)
  ) as expected_output(output_position, output_name, output_type)
  full join (
    select
      row_number() over (order by argument_row.ordinality)::integer as output_position,
      argument_row.output_name,
      argument_row.output_type,
      argument_row.output_mode
    from pg_proc as procedure_row
    cross join lateral unnest(
      procedure_row.proallargtypes,
      procedure_row.proargmodes,
      procedure_row.proargnames
    ) with ordinality as argument_row(output_type, output_mode, output_name, ordinality)
    where procedure_row.oid = analytics_function
      and argument_row.output_mode in ('t', 'o')
  ) as actual_output
    on actual_output.output_position = expected_output.output_position
  where actual_output.output_position is null
    or expected_output.output_position is null
    or actual_output.output_name is distinct from expected_output.output_name
    or actual_output.output_type is distinct from expected_output.output_type
  order by coalesce(expected_output.output_position, actual_output.output_position)
  limit 1;

  if found then
    raise exception 'Instructor analytics aborted: return contract mismatch at position %, expected % %, actual % % (mode %)',
      mismatch.output_position,
      coalesce(mismatch.expected_name, '<none>'),
      coalesce(mismatch.expected_type, '<none>'),
      coalesce(mismatch.actual_name, '<none>'),
      coalesce(mismatch.actual_type, '<none>'),
      coalesce(mismatch.actual_mode::text, '<none>');
  end if;

  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = analytics_function
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  )
    or has_function_privilege('public', analytics_function, 'EXECUTE')
    or has_function_privilege('anon', analytics_function, 'EXECUTE')
    or not has_function_privilege('authenticated', analytics_function, 'EXECUTE') then
    raise exception 'Instructor analytics aborted: analytics function security or grants are unexpected';
  end if;

  if exists (
    select 1
    from unnest(array['quiz_lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers']) as table_row(table_name)
    where has_table_privilege('public', format('public.%I', table_row.table_name), 'SELECT')
       or has_table_privilege('anon', format('public.%I', table_row.table_name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', table_row.table_name), 'SELECT')
  )
    or has_column_privilege('public', 'public.quiz_options', 'is_correct', 'SELECT')
    or has_column_privilege('anon', 'public.quiz_options', 'is_correct', 'SELECT')
    or has_column_privilege('authenticated', 'public.quiz_options', 'is_correct', 'SELECT') then
    raise exception 'Instructor analytics aborted: assessment table or answer-key browser access is unexpected';
  end if;
end;
$$;

commit;
