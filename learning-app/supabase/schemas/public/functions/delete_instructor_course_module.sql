create or replace function public.delete_instructor_course_module (
  p_module_id bigint
)
  returns table (
    deleted_module_id    bigint,
    deleted_lesson_count integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare child_count integer; course_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  select course.id into course_key from public.course_modules as module join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  if not exists (select 1 from public.course_modules as module join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft') then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  select count(*) into child_count from public.lessons as lesson join public.course_modules as module on module.id = lesson.module_id join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft';
  delete from public.course_modules as module using public.learning_courses as course where module.id = p_module_id and course.id = module.course_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if not found then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  return query select p_module_id, child_count;
end;
$function$;

grant execute on function "public"."delete_instructor_course_module"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."delete_instructor_course_module"(bigint) from public;
