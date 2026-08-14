-- Growvelt Learning Phase 2D-G: secure Admin quiz-structure review.
-- Forward-only. This adds one narrow Admin-authorized read and preserves the
-- assessment table lockdown established by migration 020.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
     or to_regclass('public.lessons') is null
     or to_regclass('public.quiz_lessons') is null
     or to_regclass('public.quiz_questions') is null
     or to_regclass('public.quiz_options') is null then
    raise exception 'Admin quiz review aborted: expected Learning relations are missing';
  end if;

  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('learning_courses', 'lessons', 'quiz_lessons', 'quiz_questions', 'quiz_options')
      and not relation_row.relrowsecurity
  ) then
    raise exception 'Admin quiz review aborted: Learning RLS must remain enabled';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'status' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'course_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'lesson_type' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_lessons' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_lessons' and column_name = 'lesson_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_lessons' and column_name = 'instructions' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_lessons' and column_name = 'passing_percentage' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_questions' and column_name = 'question_text' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_questions' and column_name = 'position' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_options' and column_name = 'option_text' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_options' and column_name = 'position' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_options' and column_name = 'is_correct' and data_type = 'boolean') then
    raise exception 'Admin quiz review aborted: expected assessment shape is missing';
  end if;

  if to_regprocedure('public.is_growvelt_learning_admin()') is null
     or not exists (
       select 1
       from pg_proc as procedure_row
       where procedure_row.oid = 'public.is_growvelt_learning_admin()'::regprocedure
         and procedure_row.prosecdef
         and procedure_row.prorettype = 'boolean'::regtype
         and exists (
           select 1
           from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
           where split_part(setting_row.setting_value, '=', 1) = 'search_path'
             and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
         )
     )
     or has_function_privilege('public', 'public.is_growvelt_learning_admin()'::regprocedure, 'EXECUTE')
     or has_function_privilege('anon', 'public.is_growvelt_learning_admin()'::regprocedure, 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.is_growvelt_learning_admin()'::regprocedure, 'EXECUTE') then
    raise exception 'Admin quiz review aborted: expected hardened Admin authorization function is missing';
  end if;

  if to_regprocedure('public.get_learning_course_quiz_for_review(bigint)') is not null then
    raise exception 'Admin quiz review aborted: partial Phase 2D-G RPC state exists';
  end if;

  if exists (
    select 1
    from unnest(array['quiz_lessons', 'quiz_questions', 'quiz_options']) as table_row(table_name)
    where has_table_privilege('anon', format('public.%I', table_row.table_name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', table_row.table_name), 'SELECT')
  )
     or has_column_privilege('anon', 'public.quiz_options', 'is_correct', 'SELECT')
     or has_column_privilege('authenticated', 'public.quiz_options', 'is_correct', 'SELECT') then
    raise exception 'Admin quiz review aborted: assessment answers are browser-readable';
  end if;
end;
$$;

create function public.get_learning_course_quiz_for_review(p_course_id bigint)
returns table (
  course_id bigint,
  lesson_id bigint,
  quiz_id bigint,
  instructions text,
  passing_percentage integer,
  question_id bigint,
  question_text text,
  question_position integer,
  option_id bigint,
  option_text text,
  option_position integer,
  is_correct boolean
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;

  if p_course_id is null or p_course_id < 1 then
    raise exception 'Invalid course review reference' using errcode = '22023';
  end if;

  return query
  select
    course_row.id,
    lesson_row.id,
    quiz_row.id,
    quiz_row.instructions,
    quiz_row.passing_percentage,
    question_row.id,
    question_row.question_text,
    question_row.position,
    option_row.id,
    option_row.option_text,
    option_row.position,
    option_row.is_correct
  from public.learning_courses as course_row
  join public.lessons as lesson_row
    on lesson_row.course_id = course_row.id
   and lesson_row.lesson_type = 'quiz'
  join public.quiz_lessons as quiz_row
    on quiz_row.lesson_id = lesson_row.id
   and quiz_row.course_id = course_row.id
  join public.quiz_questions as question_row on question_row.quiz_id = quiz_row.id
  join public.quiz_options as option_row on option_row.question_id = question_row.id
  where course_row.id = p_course_id
    and course_row.status = 'pending_review'
  order by lesson_row.id, question_row.position, question_row.id, option_row.position, option_row.id;
end;
$$;

revoke execute on function public.get_learning_course_quiz_for_review(bigint) from public, anon, authenticated;
grant execute on function public.get_learning_course_quiz_for_review(bigint) to authenticated;

do $$
declare
  mismatch_row record;
begin
  for mismatch_row in
    with expected_outputs(output_position, output_name, output_type) as (
      values
        (1, 'course_id'::text, 'bigint'::regtype::oid),
        (2, 'lesson_id'::text, 'bigint'::regtype::oid),
        (3, 'quiz_id'::text, 'bigint'::regtype::oid),
        (4, 'instructions'::text, 'text'::regtype::oid),
        (5, 'passing_percentage'::text, 'integer'::regtype::oid),
        (6, 'question_id'::text, 'bigint'::regtype::oid),
        (7, 'question_text'::text, 'text'::regtype::oid),
        (8, 'question_position'::text, 'integer'::regtype::oid),
        (9, 'option_id'::text, 'bigint'::regtype::oid),
        (10, 'option_text'::text, 'text'::regtype::oid),
        (11, 'option_position'::text, 'integer'::regtype::oid),
        (12, 'is_correct'::text, 'boolean'::regtype::oid)
    ), actual_outputs as (
      select
        row_number() over (order by argument_row.ordinality)::integer as output_position,
        argument_row.argument_name::text as output_name,
        argument_row.argument_type as output_type,
        argument_row.argument_mode as output_mode
      from pg_proc as procedure_row
      cross join lateral unnest(procedure_row.proallargtypes, procedure_row.proargmodes, procedure_row.proargnames)
        with ordinality as argument_row(argument_type, argument_mode, argument_name, ordinality)
      where procedure_row.oid = 'public.get_learning_course_quiz_for_review(bigint)'::regprocedure
        and argument_row.argument_mode in ('t'::"char", 'o'::"char")
    )
    select
      coalesce(expected_outputs.output_position, actual_outputs.output_position) as output_position,
      expected_outputs.output_name as expected_name,
      expected_outputs.output_type as expected_type,
      actual_outputs.output_name as actual_name,
      actual_outputs.output_type as actual_type,
      actual_outputs.output_mode as actual_mode
    from expected_outputs
    full join actual_outputs using (output_position)
    where expected_outputs.output_position is null
       or actual_outputs.output_position is null
       or expected_outputs.output_name is distinct from actual_outputs.output_name
       or expected_outputs.output_type is distinct from actual_outputs.output_type
    order by coalesce(expected_outputs.output_position, actual_outputs.output_position)
    limit 1
  loop
    raise exception 'Admin quiz review aborted: return contract mismatch at position %, expected % (%), actual % (%) mode %',
      mismatch_row.output_position,
      coalesce(mismatch_row.expected_name, '<none>'),
      coalesce(mismatch_row.expected_type::regtype::text, '<none>'),
      coalesce(mismatch_row.actual_name, '<none>'),
      coalesce(mismatch_row.actual_type::regtype::text, '<none>'),
      coalesce(mismatch_row.actual_mode::text, '<none>');
  end loop;

  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.get_learning_course_quiz_for_review(bigint)'::regprocedure
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  )
     or has_function_privilege('public', 'public.get_learning_course_quiz_for_review(bigint)'::regprocedure, 'EXECUTE')
     or has_function_privilege('anon', 'public.get_learning_course_quiz_for_review(bigint)'::regprocedure, 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_learning_course_quiz_for_review(bigint)'::regprocedure, 'EXECUTE') then
    raise exception 'Admin quiz review aborted: RPC security or grants are unexpected';
  end if;

  if exists (
    select 1
    from unnest(array['quiz_lessons', 'quiz_questions', 'quiz_options', 'quiz_attempts', 'quiz_attempt_answers']) as table_row(table_name)
    where has_table_privilege('anon', format('public.%I', table_row.table_name), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', table_row.table_name), 'SELECT')
  )
     or has_column_privilege('anon', 'public.quiz_options', 'is_correct', 'SELECT')
     or has_column_privilege('authenticated', 'public.quiz_options', 'is_correct', 'SELECT') then
    raise exception 'Admin quiz review aborted: assessment lockdown changed unexpectedly';
  end if;
end;
$$;

commit;
