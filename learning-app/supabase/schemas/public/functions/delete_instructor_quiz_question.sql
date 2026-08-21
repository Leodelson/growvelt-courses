create or replace function public.delete_instructor_quiz_question (
  p_lesson_id   bigint,
  p_question_id bigint
)
  returns table (
    deleted_question_id bigint
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."delete_instructor_quiz_question"(bigint, bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."delete_instructor_quiz_question"(bigint, bigint) from public;
