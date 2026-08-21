create or replace function public.upsert_instructor_quiz_configuration (
  p_lesson_id          bigint,
  p_instructions       text,
  p_passing_percentage integer
)
  returns table (
    quiz_id            bigint,
    instructions       text,
    passing_percentage integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."upsert_instructor_quiz_configuration"(bigint, text, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."upsert_instructor_quiz_configuration"(bigint, text, integer) from public;
