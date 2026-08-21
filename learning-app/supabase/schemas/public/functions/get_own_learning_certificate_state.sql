create or replace function public.get_own_learning_certificate_state (
  p_course_id bigint
)
  returns table (
    is_eligible        boolean,
    certificate_code   text,
    certificate_status text
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$ declare eligible_count integer; done_count integer; begin if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if; select count(lesson_row.id)::integer,count(lesson_row.id) filter(where case when lesson_row.lesson_type in ('text','video') then coalesce(progress_row.completed_at is not null and progress_row.progress_percent=100,false) when lesson_row.lesson_type='quiz' then exists(select 1 from public.quiz_lessons as quiz_row join public.quiz_attempts as attempt_row on attempt_row.quiz_id=quiz_row.id where quiz_row.lesson_id=lesson_row.id and attempt_row.enrollment_id=enrollment_row.id and attempt_row.passed) else false end)::integer into eligible_count,done_count from public.enrollments as enrollment_row join public.learning_courses as course_row on course_row.id=enrollment_row.course_id and course_row.status='published' join public.course_modules as module_row on module_row.course_id=course_row.id join public.lessons as lesson_row on lesson_row.course_id=course_row.id and lesson_row.module_id=module_row.id and lesson_row.lesson_type in ('text','video','quiz') left join public.lesson_progress as progress_row on progress_row.enrollment_id=enrollment_row.id and progress_row.lesson_id=lesson_row.id where enrollment_row.learner_id=auth.uid() and enrollment_row.course_id=p_course_id and enrollment_row.status='completed' and enrollment_row.completed_at is not null; return query select coalesce(eligible_count,0)>0 and eligible_count=done_count,certificate_row.certificate_code,certificate_row.status from (select 1) as state_row left join public.certificates as certificate_row on certificate_row.learner_id=auth.uid() and certificate_row.course_id=p_course_id; end; $function$;

grant execute on function "public"."get_own_learning_certificate_state"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_learning_certificate_state"(bigint) from public;
