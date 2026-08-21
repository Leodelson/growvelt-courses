create or replace function public.move_instructor_course_lesson (
  p_lesson_id bigint,
  p_direction text
)
  returns table (
    lesson_id       bigint,
    lesson_position integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare course_key bigint; module_key bigint; current_position integer; neighbor_id bigint; neighbor_position integer;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode='42501'; end if;
  if p_direction is null or p_direction not in ('up','down') then raise exception 'Unsupported move direction' using errcode='22023'; end if;
  select course.id into course_key from public.lessons as lesson join public.learning_courses as course on course.id = lesson.course_id where lesson.id = p_lesson_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  select lesson.course_id,lesson.module_id,lesson.position into course_key,module_key,current_position from public.lessons as lesson join public.learning_courses as course on course.id=lesson.course_id where lesson.id=p_lesson_id and course.instructor_id=auth.uid() and course.status='draft' for update of lesson;
  if not found then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  if p_direction='up' then select lesson.id,lesson.position into neighbor_id,neighbor_position from public.lessons as lesson where lesson.course_id=course_key and lesson.module_id=module_key and lesson.position<current_position order by lesson.position desc limit 1 for update; else select lesson.id,lesson.position into neighbor_id,neighbor_position from public.lessons as lesson where lesson.course_id=course_key and lesson.module_id=module_key and lesson.position>current_position order by lesson.position limit 1 for update; end if;
  if neighbor_id is null then return query select p_lesson_id as lesson_id, current_position as lesson_position; return; end if;
  if exists (select 1 from public.lessons where course_id = course_key and module_id = module_key and position = -2147483648) then
    raise exception 'Curriculum authoring cannot safely reorder this course' using errcode = '55000';
  end if;
  update public.lessons set position=-2147483648 where id=p_lesson_id;
  update public.lessons set position=current_position where id=neighbor_id;
  update public.lessons set position=neighbor_position where id=p_lesson_id;
  return query select p_lesson_id as lesson_id, neighbor_position as lesson_position;
end;
$function$;

grant execute on function "public"."move_instructor_course_lesson"(bigint, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."move_instructor_course_lesson"(bigint, text) from public;
