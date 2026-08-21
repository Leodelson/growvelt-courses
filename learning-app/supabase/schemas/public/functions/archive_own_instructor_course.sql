create or replace function public.archive_own_instructor_course (
  p_course_id bigint
)
  returns table (
    course_id  bigint,
    status     text,
    updated_at timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  changed_at timestamptz;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if p_course_id is null or p_course_id <= 0 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;

  update public.learning_courses as course_row
  set status = 'archived', updated_at = now()
  where course_row.id = p_course_id
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'published'
  returning course_row.updated_at into changed_at;

  if not found then
    raise exception 'Published course not found or is no longer available to archive' using errcode = 'P0002';
  end if;

  return query select p_course_id, 'archived'::text, changed_at;
end;
$function$;

grant execute on function "public"."archive_own_instructor_course"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."archive_own_instructor_course"(bigint) from public;
