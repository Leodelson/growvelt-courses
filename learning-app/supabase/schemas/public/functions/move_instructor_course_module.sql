create or replace function public.move_instructor_course_module (
  p_module_id bigint,
  p_direction text
)
  returns table (
    module_id       bigint,
    module_position integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare course_key bigint; current_position integer; neighbor_id bigint; neighbor_position integer;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if p_direction is null or p_direction not in ('up','down') then raise exception 'Unsupported move direction' using errcode = '22023'; end if;
  select course.id into course_key from public.course_modules as module join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  select module.course_id, module.position into course_key, current_position from public.course_modules as module join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft' for update of module;
  if not found then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  if p_direction = 'up' then select module.id, module.position into neighbor_id, neighbor_position from public.course_modules as module where module.course_id = course_key and module.position < current_position order by module.position desc limit 1 for update; else select module.id, module.position into neighbor_id, neighbor_position from public.course_modules as module where module.course_id = course_key and module.position > current_position order by module.position limit 1 for update; end if;
  if neighbor_id is null then return query select p_module_id as module_id, current_position as module_position; return; end if;
  if exists (select 1 from public.course_modules where course_id = course_key and position = -2147483648) then
    raise exception 'Curriculum authoring cannot safely reorder this course' using errcode = '55000';
  end if;
  update public.course_modules set position = -2147483648 where id = p_module_id;
  update public.course_modules set position = current_position where id = neighbor_id;
  update public.course_modules set position = neighbor_position where id = p_module_id;
  return query select p_module_id as module_id, neighbor_position as module_position;
end;
$function$;

grant execute on function "public"."move_instructor_course_module"(bigint, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."move_instructor_course_module"(bigint, text) from public;
