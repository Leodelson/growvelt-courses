-- Phase 2D: allow an authorized Learning Admin to inspect a pending-review
-- course video cover through the existing signed-cover endpoint.
-- Forward-only. Review and execute manually in Supabase; this migration is
-- intentionally not run by the application.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
    or to_regclass('storage.objects') is null then
    raise exception 'Admin course-video-cover review aborted: required relations are missing';
  end if;

  if not exists (
    select 1
    from pg_attribute as attribute_row
    where attribute_row.attrelid = 'public.learning_courses'::regclass
      and attribute_row.attname = 'course_video_cover_storage_path'
      and not attribute_row.attisdropped
  ) then
    raise exception 'Admin course-video-cover review aborted: course-video-cover column baseline is missing';
  end if;

  if not exists (
    select 1
    from storage.buckets as bucket_row
    where bucket_row.id = 'learning-course-video-covers'
      and not bucket_row.public
      and bucket_row.file_size_limit = 1048576
      and bucket_row.allowed_mime_types = array['image/jpeg', 'image/webp']::text[]
  ) then
    raise exception 'Admin course-video-cover review aborted: private bucket baseline is unexpected';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.is_growvelt_learning_admin()'::regprocedure
      and procedure_row.prorettype = 'boolean'::regtype
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  ) then
    raise exception 'Admin course-video-cover review aborted: hardened Learning Admin authorization is missing';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.can_read_learning_course_video_cover(text)'::regprocedure
      and procedure_row.prorettype = 'boolean'::regtype
      and procedure_row.prosecdef
  )
    or not exists (
      select 1
      from pg_proc as procedure_row
      where procedure_row.oid = 'public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure
        and procedure_row.prosecdef
    ) then
    raise exception 'Admin course-video-cover review aborted: cover read-function baseline is unexpected';
  end if;

  if not exists (
    select 1
    from pg_policy as policy_row
    where policy_row.polrelid = 'storage.objects'::regclass
      and policy_row.polname = 'learning_course_video_cover_select'
      and policy_row.polcmd = 'r'
  ) then
    raise exception 'Admin course-video-cover review aborted: private storage select policy is missing';
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
        or (
          auth.uid() is not null
          and course_row.status = 'pending_review'
          and course_row.course_video_cover_storage_path = p_object_name
          and public.is_growvelt_learning_admin()
        )
      )
  );
end;
$$;

create or replace function public.get_own_or_published_learning_course_video_cover(p_course_id bigint)
returns table (
  course_video_cover_storage_path text,
  is_published boolean
)
language plpgsql
security definer
stable
set search_path = ''
as $$
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
$$;

revoke all on function public.can_read_learning_course_video_cover(text) from public, anon, authenticated;
grant execute on function public.can_read_learning_course_video_cover(text) to anon, authenticated;

revoke execute on function public.get_own_or_published_learning_course_video_cover(bigint) from public, anon, authenticated;
grant execute on function public.get_own_or_published_learning_course_video_cover(bigint) to anon, authenticated;

do $$
declare
  mismatch_row record;
begin
  for mismatch_row in
    with expected_outputs(output_position, output_name, output_type) as (
      values
        (1, 'course_video_cover_storage_path'::text, 'text'::regtype::oid),
        (2, 'is_published'::text, 'boolean'::regtype::oid)
    ), actual_outputs as (
      select
        row_number() over (order by argument_row.ordinality)::integer as output_position,
        argument_row.output_name::text,
        argument_row.output_type,
        argument_row.output_mode
      from pg_proc as procedure_row
      cross join lateral unnest(procedure_row.proallargtypes, procedure_row.proargmodes, procedure_row.proargnames)
        with ordinality as argument_row(output_type, output_mode, output_name, ordinality)
      where procedure_row.oid = 'public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure
        and argument_row.output_mode in ('t'::"char", 'o'::"char")
    )
    select
      coalesce(expected_outputs.output_position, actual_outputs.output_position) as output_position,
      expected_outputs.output_name as expected_name,
      expected_outputs.output_type as expected_type,
      actual_outputs.output_name as actual_name,
      actual_outputs.output_type as actual_type,
      actual_outputs.output_mode as actual_mode
    from expected_outputs
    full join actual_outputs using (output_position)
    where expected_outputs.output_position is null
      or actual_outputs.output_position is null
      or expected_outputs.output_name is distinct from actual_outputs.output_name
      or expected_outputs.output_type is distinct from actual_outputs.output_type
    order by coalesce(expected_outputs.output_position, actual_outputs.output_position)
    limit 1
  loop
    raise exception 'Admin course-video-cover review aborted: cover read return contract mismatch at position %, expected % (%), actual % (%) mode %',
      mismatch_row.output_position,
      coalesce(mismatch_row.expected_name, '<none>'),
      coalesce(mismatch_row.expected_type::regtype::text, '<none>'),
      coalesce(mismatch_row.actual_name, '<none>'),
      coalesce(mismatch_row.actual_type::regtype::text, '<none>'),
      coalesce(mismatch_row.actual_mode::text, '<none>');
  end loop;

  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid in (
      'public.can_read_learning_course_video_cover(text)'::regprocedure,
      'public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure
    )
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
    having count(*) = 2
  ) then
    raise exception 'Admin course-video-cover review aborted: cover read-function security configuration is unexpected';
  end if;

  if exists (
    select 1
    from pg_proc as procedure_row
    cross join lateral aclexplode(
      coalesce(procedure_row.proacl, acldefault('f', procedure_row.proowner))
    ) as acl_row
    where procedure_row.oid in (
      'public.can_read_learning_course_video_cover(text)'::regprocedure,
      'public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure
    )
      and acl_row.grantee = 0
      and acl_row.privilege_type = 'EXECUTE'
  )
    or not exists (
      select 1
      from pg_proc as procedure_row
      cross join lateral aclexplode(
        coalesce(procedure_row.proacl, acldefault('f', procedure_row.proowner))
      ) as acl_row
      where procedure_row.oid = 'public.can_read_learning_course_video_cover(text)'::regprocedure
        and acl_row.grantee = 'anon'::regrole::oid
        and acl_row.privilege_type = 'EXECUTE'
    )
    or not exists (
      select 1
      from pg_proc as procedure_row
      cross join lateral aclexplode(
        coalesce(procedure_row.proacl, acldefault('f', procedure_row.proowner))
      ) as acl_row
      where procedure_row.oid = 'public.can_read_learning_course_video_cover(text)'::regprocedure
        and acl_row.grantee = 'authenticated'::regrole::oid
        and acl_row.privilege_type = 'EXECUTE'
    )
    or not exists (
      select 1
      from pg_proc as procedure_row
      cross join lateral aclexplode(
        coalesce(procedure_row.proacl, acldefault('f', procedure_row.proowner))
      ) as acl_row
      where procedure_row.oid = 'public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure
        and acl_row.grantee = 'anon'::regrole::oid
        and acl_row.privilege_type = 'EXECUTE'
    )
    or not exists (
      select 1
      from pg_proc as procedure_row
      cross join lateral aclexplode(
        coalesce(procedure_row.proacl, acldefault('f', procedure_row.proowner))
      ) as acl_row
      where procedure_row.oid = 'public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure
        and acl_row.grantee = 'authenticated'::regrole::oid
        and acl_row.privilege_type = 'EXECUTE'
    ) then
    raise exception 'Admin course-video-cover review aborted: cover read-function grants are unexpected';
  end if;

end;
$$;

commit;
