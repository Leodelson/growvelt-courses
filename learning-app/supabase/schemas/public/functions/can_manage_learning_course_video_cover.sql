create or replace function public.can_manage_learning_course_video_cover (
  p_object_name text
)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  course_identifier text;
  expected_path text;
begin
  if auth.uid() is null
    or p_object_name is null
    or p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-9][0-9]*/course-video-cover$' then
    return false;
  end if;

  course_identifier := split_part(p_object_name, '/', 2);
  expected_path := auth.uid()::text || '/' || course_identifier::text || '/course-video-cover';

  return p_object_name = expected_path
    and public.is_approved_growvelt_instructor()
    and exists (
      select 1
      from public.learning_courses as course_row
      where course_row.id::text = course_identifier
        and course_row.instructor_id = auth.uid()
        and course_row.status = 'draft'
    );
end;
$function$;

grant execute on function "public"."can_manage_learning_course_video_cover"(text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."can_manage_learning_course_video_cover"(text) from public;
