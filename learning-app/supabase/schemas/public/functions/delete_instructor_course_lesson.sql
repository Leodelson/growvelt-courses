create or replace function public.delete_instructor_course_lesson (
  p_lesson_id bigint
)
  returns table (
    deleted_lesson_id bigint
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare course_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  select course.id into course_key from public.lessons as lesson join public.learning_courses as course on course.id = lesson.course_id where lesson.id = p_lesson_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  if not exists (select 1 from public.lessons as lesson join public.learning_courses as course on course.id = lesson.course_id where lesson.id = p_lesson_id and course.id = course_key and course.instructor_id = auth.uid() and course.status = 'draft') then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  delete from public.lessons as lesson using public.learning_courses as course where lesson.id=p_lesson_id and course.id=lesson.course_id and course.instructor_id=auth.uid() and course.status='draft';
  if not found then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  return query select p_lesson_id;
end;
$function$;

grant execute on function "public"."delete_instructor_course_lesson"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."delete_instructor_course_lesson"(bigint) from public;
