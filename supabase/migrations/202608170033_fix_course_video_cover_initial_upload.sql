-- Phase 2D: repair the initial private course-video-cover upsert authorization.
-- Forward-only. Review and execute manually in Supabase; this migration is
-- intentionally not run by the application.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
    or to_regclass('storage.objects') is null then
    raise exception 'Course video cover repair aborted: required relations are missing';
  end if;

  if not exists (
    select 1
    from pg_attribute as attribute_row
    where attribute_row.attrelid = 'public.learning_courses'::regclass
      and attribute_row.attname = 'course_video_cover_storage_path'
      and not attribute_row.attisdropped
  ) then
    raise exception 'Course video cover repair aborted: course-video-cover baseline column is missing';
  end if;

  if not exists (
    select 1
    from storage.buckets as bucket_row
    where bucket_row.id = 'learning-course-video-covers'
      and not bucket_row.public
      and bucket_row.file_size_limit = 1048576
      and bucket_row.allowed_mime_types = array['image/jpeg', 'image/webp']::text[]
  ) then
    raise exception 'Course video cover repair aborted: course-video-cover bucket baseline is unexpected';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.can_read_learning_course_video_cover(text)'::regprocedure
      and procedure_row.prorettype = 'boolean'::regtype
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  ) then
    raise exception 'Course video cover repair aborted: read helper baseline is unexpected';
  end if;

  if not exists (
    select 1
    from pg_policy as policy_row
    where policy_row.polrelid = 'storage.objects'::regclass
      and policy_row.polname = 'learning_course_video_cover_select'
      and policy_row.polcmd = 'r'
  ) then
    raise exception 'Course video cover repair aborted: storage select policy baseline is missing';
  end if;
end;
$$;

create or replace function public.can_read_learning_course_video_cover(p_object_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
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
      )
  );
end;
$$;

revoke all on function public.can_read_learning_course_video_cover(text) from public, anon, authenticated;
grant execute on function public.can_read_learning_course_video_cover(text) to anon, authenticated;

do $$
declare
  helper_function_row pg_proc%rowtype;
begin
  select procedure_row.*
  into helper_function_row
  from pg_proc as procedure_row
  where procedure_row.oid = 'public.can_read_learning_course_video_cover(text)'::regprocedure;

  if helper_function_row.oid is null
    or helper_function_row.prorettype <> 'boolean'::regtype
    or not helper_function_row.prosecdef
    or not exists (
      select 1
      from unnest(coalesce(helper_function_row.proconfig, array[]::text[])) as setting_row(setting_value)
      where split_part(setting_row.setting_value, '=', 1) = 'search_path'
        and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
    ) then
    raise exception 'Course video cover repair aborted: read helper security configuration is unexpected';
  end if;

  if has_function_privilege('public', 'public.can_read_learning_course_video_cover(text)', 'EXECUTE')
    or not has_function_privilege('anon', 'public.can_read_learning_course_video_cover(text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.can_read_learning_course_video_cover(text)', 'EXECUTE') then
    raise exception 'Course video cover repair aborted: read helper grants are unexpected';
  end if;

  if not exists (
    select 1
    from pg_policy as policy_row
    where policy_row.polrelid = 'storage.objects'::regclass
      and policy_row.polname = 'learning_course_video_cover_select'
      and policy_row.polcmd = 'r'
  ) then
    raise exception 'Course video cover repair aborted: storage select policy is missing';
  end if;
end;
$$;

commit;
