create or replace function public.add_instructor_course_module (
  p_course_id bigint,
  p_title     text
)
  returns table (
    module_id       bigint,
    title           text,
    module_position integer
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare normalized_title text := btrim(p_title); next_position integer; created_id bigint; course_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if normalized_title is null or char_length(normalized_title) not between 2 and 160 then raise exception 'Module title must be between 2 and 160 characters' using errcode = '22023'; end if;
  select course.id into course_key from public.learning_courses as course where course.id = p_course_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  if not exists (select 1 from public.learning_courses as course where course.id = course_key and course.instructor_id = auth.uid() and course.status = 'draft') then raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002'; end if;
  select coalesce(max(module.position), 0) + 1 into next_position from public.course_modules as module where module.course_id = course_key;
  insert into public.course_modules (course_id, title, position) values (course_key, normalized_title, next_position) returning id into created_id;
  return query select created_id as module_id, normalized_title as title, next_position as module_position;
end;
$function$;

grant execute on function "public"."add_instructor_course_module"(bigint, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."add_instructor_course_module"(bigint, text) from public;
