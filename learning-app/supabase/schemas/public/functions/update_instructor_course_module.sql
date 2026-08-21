create or replace function public.update_instructor_course_module (
  p_module_id bigint,
  p_title     text
)
  returns table (
    module_id bigint,
    title     text
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare normalized_title text := btrim(p_title);
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if normalized_title is null or char_length(normalized_title) not between 2 and 160 then raise exception 'Module title must be between 2 and 160 characters' using errcode = '22023'; end if;
  update public.course_modules as module set title = normalized_title from public.learning_courses as course where module.id = p_module_id and course.id = module.course_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if not found then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  return query select p_module_id, normalized_title;
end;
$function$;

grant execute on function "public"."update_instructor_course_module"(bigint, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."update_instructor_course_module"(bigint, text) from public;
