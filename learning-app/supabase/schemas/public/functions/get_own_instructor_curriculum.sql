create or replace function public.get_own_instructor_curriculum (
  p_course_id bigint
)
  returns table (
    module_id        bigint,
    module_title     text,
    module_position  integer,
    lesson_id        bigint,
    lesson_title     text,
    lesson_type      text,
    lesson_content   text,
    video_provider   text,
    video_reference  text,
    video_visibility text,
    duration_seconds integer,
    is_preview       boolean,
    lesson_position  integer
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if not exists (select 1 from public.learning_courses as course where course.id = p_course_id and course.instructor_id = auth.uid()) then raise exception 'Course not found' using errcode = 'P0002'; end if;
  return query select module.id, module.title, module.position, lesson.id, lesson.title, lesson.lesson_type, lesson.content, lesson.video_provider, lesson.video_reference, lesson.video_visibility, lesson.duration_seconds, lesson.is_preview, lesson.position
    from public.course_modules as module left join public.lessons as lesson on lesson.module_id = module.id and lesson.course_id = p_course_id
    where module.course_id = p_course_id order by module.position, module.id, lesson.position, lesson.id;
end;
$function$;

grant execute on function "public"."get_own_instructor_curriculum"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_instructor_curriculum"(bigint) from public;
