create or replace function public.delete_own_instructor_draft (
  p_course_id bigint
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  course_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if p_course_id is null or p_course_id <= 0 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;

  select course_row.id into course_key
  from public.learning_courses as course_row
  where course_row.id = p_course_id
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft'
  for update;

  if course_key is null then
    raise exception 'Draft course not found or is no longer available to delete' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.enrollments as enrollment_row where enrollment_row.course_id = course_key) then
    raise exception 'Courses with learner activity cannot be deleted' using errcode = '22023';
  end if;

  delete from public.course_rights_declarations as declaration_row
  where declaration_row.course_id = course_key;
  delete from public.learning_courses as course_row where course_row.id = course_key;
end;
$function$;

grant execute on function "public"."delete_own_instructor_draft"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."delete_own_instructor_draft"(bigint) from public;
