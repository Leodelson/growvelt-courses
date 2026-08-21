create or replace function public.get_own_or_published_learning_course_video_cover (
  p_course_id bigint
)
  returns table (
    course_video_cover_storage_path text,
    is_published                    boolean
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if p_course_id is null or p_course_id <= 0 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;

  return query
  select
    course_row.course_video_cover_storage_path,
    course_row.status = 'published'
  from public.learning_courses as course_row
  where course_row.id = p_course_id
    and course_row.course_video_cover_storage_path is not null
    and (
      course_row.status = 'published'
      or (auth.uid() is not null and course_row.instructor_id = auth.uid())
      or (
        auth.uid() is not null
        and course_row.status = 'pending_review'
        and public.is_growvelt_learning_admin()
      )
    );
end;
$function$;

grant execute on function "public"."get_own_or_published_learning_course_video_cover"(bigint) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_or_published_learning_course_video_cover"(bigint) from public;
