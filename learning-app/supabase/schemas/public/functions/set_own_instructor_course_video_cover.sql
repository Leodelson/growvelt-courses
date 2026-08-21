create or replace function public.set_own_instructor_course_video_cover (
  p_course_id    bigint,
  p_storage_path text
)
  returns table (
    course_id                       bigint,
    course_video_cover_storage_path text,
    updated_at                      timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  expected_path text;
  changed_at timestamptz;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if p_course_id is null or p_course_id <= 0 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;

  expected_path := auth.uid()::text || '/' || p_course_id::text || '/course-video-cover';
  if p_storage_path is distinct from expected_path then
    raise exception 'Invalid course video cover reference' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(auth.uid()::text),
    (p_course_id % 2147483647)::integer
  );

  update public.learning_courses as course_row
  set course_video_cover_storage_path = expected_path,
      updated_at = now()
  where course_row.id = p_course_id
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft'
  returning course_row.updated_at into changed_at;

  if not found then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  return query
  select p_course_id, expected_path, changed_at;
end;
$function$;

grant execute on function "public"."set_own_instructor_course_video_cover"(bigint, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."set_own_instructor_course_video_cover"(bigint, text) from public;
