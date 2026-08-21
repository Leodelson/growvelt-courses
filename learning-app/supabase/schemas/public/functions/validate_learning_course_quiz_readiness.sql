create or replace function public.validate_learning_course_quiz_readiness()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if old.status = 'draft' and new.status = 'pending_review' and exists (
    select 1
    from public.lessons as lesson_row
    left join public.quiz_lessons as quiz_row on quiz_row.lesson_id = lesson_row.id
    left join public.quiz_questions as question_row on question_row.quiz_id = quiz_row.id
    left join public.quiz_options as option_row on option_row.question_id = question_row.id
    where lesson_row.course_id = new.id
      and lesson_row.lesson_type = 'quiz'
    group by lesson_row.id, quiz_row.id, quiz_row.passing_percentage, question_row.id
    having quiz_row.id is null
      or quiz_row.passing_percentage not between 1 and 100
      or question_row.id is null
      or count(option_row.id) not between 2 and 6
      or count(option_row.id) filter (where option_row.is_correct) <> 1
  ) then
    raise exception 'Quiz assessment is incomplete and cannot be submitted for review' using errcode = '22023';
  end if;
  return new;
end;
$function$;

grant execute on function "public"."validate_learning_course_quiz_readiness"() to "postgres", "service_role";

revoke all on function "public"."validate_learning_course_quiz_readiness"() from public;
