create or replace function public.can_read_learning_course_video_cover (
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
  if p_object_name is null
    or p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-9][0-9]*/course-video-cover$' then
    return false;
  end if;

  course_identifier := split_part(p_object_name, '/', 2);
  expected_path := coalesce(auth.uid()::text, '') || '/' || course_identifier || '/course-video-cover';

  return exists (
    select 1
    from public.learning_courses as course_row
    where course_row.id::text = course_identifier
      and (
        (
          course_row.status = 'published'
          and course_row.course_video_cover_storage_path = p_object_name
        )
        or (
          auth.uid() is not null
          and course_row.instructor_id = auth.uid()
          and course_row.status = 'draft'
          and public.is_approved_growvelt_instructor()
          and p_object_name = expected_path
        )
        or (
          auth.uid() is not null
          and course_row.status = 'pending_review'
          and course_row.course_video_cover_storage_path = p_object_name
          and public.is_growvelt_learning_admin()
        )
      )
  );
end;
$function$;

grant execute on function "public"."can_read_learning_course_video_cover"(text) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "public"."can_read_learning_course_video_cover"(text) from public;
