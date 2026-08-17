-- Phase 2D: lightweight, private course-video-cover media foundation.
-- Forward-only. Review and execute manually in Supabase; this migration is
-- intentionally not run by the application.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null then
    raise exception 'Course video cover aborted: public.learning_courses is missing';
  end if;

  if not exists (
    select 1
    from pg_class as relation_row
    where relation_row.oid = 'public.learning_courses'::regclass
      and relation_row.relrowsecurity
  ) then
    raise exception 'Course video cover aborted: Learning course RLS is missing';
  end if;

  if exists (
    select 1
    from pg_attribute as attribute_row
    where attribute_row.attrelid = 'public.learning_courses'::regclass
      and attribute_row.attname = 'course_video_cover_storage_path'
      and not attribute_row.attisdropped
  ) then
    raise exception 'Course video cover aborted: course-video-cover column already exists';
  end if;

  if exists (
    select 1
    from storage.buckets as bucket_row
    where bucket_row.id = 'learning-course-video-covers'
  ) then
    raise exception 'Course video cover aborted: course-video-cover bucket already exists';
  end if;

  if to_regprocedure('public.set_own_instructor_course_video_cover(bigint,text)') is not null
    or to_regprocedure('public.get_own_or_published_learning_course_video_cover(bigint)') is not null
    or to_regprocedure('public.can_read_learning_course_video_cover(text)') is not null
    or to_regprocedure('public.can_manage_learning_course_video_cover(text)') is not null then
    raise exception 'Course video cover aborted: expected clean course-video-cover RPC state is missing';
  end if;

  if exists (
    select 1
    from pg_policy as policy_row
    where policy_row.polrelid = 'storage.objects'::regclass
      and policy_row.polname like 'learning_course_video_cover_%'
  ) then
    raise exception 'Course video cover aborted: course-video-cover storage policies already exist';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.is_approved_growvelt_instructor()'::regprocedure
      and procedure_row.prosecdef
      and procedure_row.prorettype = 'boolean'::regtype
      and exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
  )
    or has_function_privilege('anon', 'public.is_approved_growvelt_instructor()', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.is_approved_growvelt_instructor()', 'EXECUTE') then
    raise exception 'Course video cover aborted: approved Instructor baseline is unexpected';
  end if;
end;
$$;

alter table public.learning_courses
  add column course_video_cover_storage_path text
  constraint learning_courses_course_video_cover_storage_path_check check (
    course_video_cover_storage_path is null
    or course_video_cover_storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-9][0-9]*/course-video-cover$'
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learning-course-video-covers',
  'learning-course-video-covers',
  false,
  1048576,
  array['image/jpeg', 'image/webp']::text[]
);

create function public.can_read_learning_course_video_cover(p_object_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  course_identifier text;
begin
  if p_object_name is null
    or p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-9][0-9]*/course-video-cover$' then
    return false;
  end if;

  course_identifier := split_part(p_object_name, '/', 2);

  return exists (
    select 1
    from public.learning_courses as course_row
    where course_row.id::text = course_identifier
      and course_row.course_video_cover_storage_path = p_object_name
      and (
        course_row.status = 'published'
        or course_row.instructor_id = auth.uid()
      )
  );
end;
$$;

create function public.can_manage_learning_course_video_cover(p_object_name text)
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
$$;

create policy learning_course_video_cover_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'learning-course-video-covers'
  and public.can_read_learning_course_video_cover(name)
);

create policy learning_course_video_cover_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'learning-course-video-covers'
  and public.can_manage_learning_course_video_cover(name)
);

create policy learning_course_video_cover_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'learning-course-video-covers'
  and public.can_manage_learning_course_video_cover(name)
)
with check (
  bucket_id = 'learning-course-video-covers'
  and public.can_manage_learning_course_video_cover(name)
);

create policy learning_course_video_cover_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'learning-course-video-covers'
  and public.can_manage_learning_course_video_cover(name)
);

create function public.set_own_instructor_course_video_cover(
  p_course_id bigint,
  p_storage_path text
)
returns table (
  course_id bigint,
  course_video_cover_storage_path text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create function public.get_own_or_published_learning_course_video_cover(p_course_id bigint)
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
    );
end;
$$;

revoke all on function public.can_read_learning_course_video_cover(text) from public, anon, authenticated;
revoke all on function public.can_manage_learning_course_video_cover(text) from public, anon, authenticated;
grant execute on function public.can_read_learning_course_video_cover(text) to anon, authenticated;
grant execute on function public.can_manage_learning_course_video_cover(text) to authenticated;

revoke execute on function public.set_own_instructor_course_video_cover(bigint, text) from public, anon, authenticated;
revoke execute on function public.get_own_or_published_learning_course_video_cover(bigint) from public, anon, authenticated;
grant execute on function public.set_own_instructor_course_video_cover(bigint, text) to authenticated;
grant execute on function public.get_own_or_published_learning_course_video_cover(bigint) to anon, authenticated;

do $$
declare
  procedure_row record;
  mismatch_row record;
begin
  for mismatch_row in
    with expected_outputs(function_oid, output_position, output_name, output_type) as (
      values
        ('public.set_own_instructor_course_video_cover(bigint,text)'::regprocedure::oid, 1, 'course_id'::text, 'bigint'::regtype::oid),
        ('public.set_own_instructor_course_video_cover(bigint,text)'::regprocedure::oid, 2, 'course_video_cover_storage_path'::text, 'text'::regtype::oid),
        ('public.set_own_instructor_course_video_cover(bigint,text)'::regprocedure::oid, 3, 'updated_at'::text, 'timestamptz'::regtype::oid),
        ('public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure::oid, 1, 'course_video_cover_storage_path'::text, 'text'::regtype::oid),
        ('public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure::oid, 2, 'is_published'::text, 'boolean'::regtype::oid)
    ), actual_outputs as (
      select
        function_row.oid as function_oid,
        row_number() over (partition by function_row.oid order by argument_row.ordinality)::integer as output_position,
        argument_row.output_name::text,
        argument_row.output_type,
        argument_row.output_mode
      from pg_proc as function_row
      cross join lateral unnest(function_row.proallargtypes, function_row.proargmodes, function_row.proargnames)
        with ordinality as argument_row(output_type, output_mode, output_name, ordinality)
      where function_row.oid in (
        'public.set_own_instructor_course_video_cover(bigint,text)'::regprocedure,
        'public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure
      )
        and argument_row.output_mode in ('t'::"char", 'o'::"char")
    )
    select
      coalesce(expected_outputs.function_oid, actual_outputs.function_oid)::regprocedure as function_name,
      coalesce(expected_outputs.output_position, actual_outputs.output_position) as output_position,
      expected_outputs.output_name as expected_name,
      expected_outputs.output_type as expected_type,
      actual_outputs.output_name as actual_name,
      actual_outputs.output_type as actual_type,
      actual_outputs.output_mode as actual_mode
    from expected_outputs
    full join actual_outputs
      on actual_outputs.function_oid = expected_outputs.function_oid
      and actual_outputs.output_position = expected_outputs.output_position
    where expected_outputs.output_position is null
      or actual_outputs.output_position is null
      or expected_outputs.output_name is distinct from actual_outputs.output_name
      or expected_outputs.output_type is distinct from actual_outputs.output_type
    order by
      coalesce(expected_outputs.function_oid, actual_outputs.function_oid)::regprocedure::text,
      coalesce(expected_outputs.output_position, actual_outputs.output_position)
    limit 1
  loop
    raise exception 'Course video cover aborted: return contract mismatch for %', mismatch_row.function_name
      using detail = format(
        'position %s: expected %s %s; actual %s %s (mode %s)',
        mismatch_row.output_position,
        coalesce(mismatch_row.expected_name, '<none>'),
        coalesce(format_type(mismatch_row.expected_type, null), '<none>'),
        coalesce(mismatch_row.actual_name, '<none>'),
        coalesce(format_type(mismatch_row.actual_type, null), '<none>'),
        coalesce(mismatch_row.actual_mode::text, '<none>')
      );
  end loop;

  for procedure_row in
    select routine_row.*
    from pg_proc as routine_row
    where routine_row.oid in (
      'public.can_read_learning_course_video_cover(text)'::regprocedure,
      'public.can_manage_learning_course_video_cover(text)'::regprocedure,
      'public.set_own_instructor_course_video_cover(bigint,text)'::regprocedure,
      'public.get_own_or_published_learning_course_video_cover(bigint)'::regprocedure
    )
  loop
    if not procedure_row.prosecdef
      or not exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      ) then
      raise exception 'Course video cover aborted: security configuration is unexpected for %', procedure_row.oid::regprocedure;
    end if;
  end loop;

  if (
    select count(*)
    from pg_proc as helper_function_row
    where helper_function_row.oid in (
      'public.can_read_learning_course_video_cover(text)'::regprocedure,
      'public.can_manage_learning_course_video_cover(text)'::regprocedure
    )
      and helper_function_row.prorettype = 'boolean'::regtype
  ) <> 2 then
    raise exception 'Course video cover aborted: storage helper contract is unexpected';
  end if;

  if not exists (
    select 1
    from storage.buckets as bucket_row
    where bucket_row.id = 'learning-course-video-covers'
      and not bucket_row.public
      and bucket_row.file_size_limit = 1048576
      and bucket_row.allowed_mime_types = array['image/jpeg', 'image/webp']::text[]
  ) then
    raise exception 'Course video cover aborted: bucket configuration is unexpected';
  end if;

  if (
    select count(*)
    from pg_policy as policy_row
    where policy_row.polrelid = 'storage.objects'::regclass
      and policy_row.polname in (
        'learning_course_video_cover_select',
        'learning_course_video_cover_insert',
        'learning_course_video_cover_update',
        'learning_course_video_cover_delete'
      )
  ) <> 4 then
    raise exception 'Course video cover aborted: storage policies are incomplete';
  end if;

  if has_function_privilege('public', 'public.set_own_instructor_course_video_cover(bigint,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.set_own_instructor_course_video_cover(bigint,text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.set_own_instructor_course_video_cover(bigint,text)', 'EXECUTE')
    or has_function_privilege('public', 'public.get_own_or_published_learning_course_video_cover(bigint)', 'EXECUTE')
    or not has_function_privilege('anon', 'public.get_own_or_published_learning_course_video_cover(bigint)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.get_own_or_published_learning_course_video_cover(bigint)', 'EXECUTE') then
    raise exception 'Course video cover aborted: browser RPC grants are unexpected';
  end if;

  if has_function_privilege('public', 'public.can_read_learning_course_video_cover(text)', 'EXECUTE')
    or not has_function_privilege('anon', 'public.can_read_learning_course_video_cover(text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.can_read_learning_course_video_cover(text)', 'EXECUTE')
    or has_function_privilege('public', 'public.can_manage_learning_course_video_cover(text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.can_manage_learning_course_video_cover(text)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.can_manage_learning_course_video_cover(text)', 'EXECUTE') then
    raise exception 'Course video cover aborted: storage helper grants are unexpected';
  end if;
end;
$$;

commit;
