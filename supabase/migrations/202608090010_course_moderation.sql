-- Growvelt Learning Phase 2A-D: secure Admin course moderation.
-- Forward-only. Replaces legacy browser Admin course policies with narrow,
-- capability-checked reader and moderation RPCs.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
     or to_regclass('public.course_modules') is null
     or to_regclass('public.lessons') is null
     or to_regclass('public.course_rights_declarations') is null
     or to_regclass('public.profiles') is null
     or to_regclass('auth.users') is null then
    raise exception 'Course moderation aborted: expected Learning and Auth relations are missing';
  end if;

  if exists (
    select 1 from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('learning_courses', 'course_modules', 'lessons', 'course_rights_declarations')
      and not relation.relrowsecurity
  ) then
    raise exception 'Course moderation aborted: RLS must remain enabled on Learning course relations';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'submitted_at' and data_type = 'timestamp with time zone')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'reviewed_at' and data_type = 'timestamp with time zone')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'reviewed_by' and data_type = 'uuid')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'review_note' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'instructor_id' and data_type = 'uuid')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'is_free' and data_type = 'boolean')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_amount' and data_type = 'numeric')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_currency' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'is_limited_time_free' and data_type = 'boolean') then
    raise exception 'Course moderation aborted: Phase 2A-C review metadata is missing';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_rights_declarations' and column_name = 'course_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_rights_declarations' and column_name = 'instructor_id' and data_type = 'uuid')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_rights_declarations' and column_name = 'declaration_version' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_rights_declarations' and column_name = 'accepted_at' and data_type = 'timestamp with time zone') then
    raise exception 'Course moderation aborted: expected rights declaration shape is missing';
  end if;

  if not exists (select 1 from pg_constraint as constraint_row where constraint_row.conrelid = 'public.learning_courses'::regclass and constraint_row.contype = 'c' and pg_get_constraintdef(constraint_row.oid) like '%draft%pending_review%published%archived%') then
    raise exception 'Course moderation aborted: expected course lifecycle is missing';
  end if;

  if to_regprocedure('public.is_growvelt_learning_admin()') is null
     or not exists (select 1 from pg_proc as routine where routine.oid = 'public.is_growvelt_learning_admin()'::regprocedure and routine.prosecdef)
     or has_function_privilege('anon', 'public.is_growvelt_learning_admin()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.is_growvelt_learning_admin()', 'EXECUTE') then
    raise exception 'Course moderation aborted: hardened Admin helper is missing or has unexpected grants';
  end if;

  if to_regprocedure('public.submit_learning_course_for_review(bigint,text,text)') is null
     or not exists (select 1 from pg_proc as routine where routine.oid = 'public.submit_learning_course_for_review(bigint,text,text)'::regprocedure and routine.prosecdef) then
    raise exception 'Course moderation aborted: hardened course-submission RPC is missing';
  end if;

  if to_regprocedure('public.list_pending_learning_courses(integer,integer)') is not null
     or to_regprocedure('public.get_learning_course_for_review(bigint)') is not null
     or to_regprocedure('public.review_learning_course(bigint,text,text)') is not null then
    raise exception 'Course moderation aborted: expected clean Phase 2A-D RPC state is missing';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_courses' and policyname = 'Admins can read all learning courses')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_courses' and policyname = 'Admins can approve learning courses') then
    raise exception 'Course moderation aborted: expected legacy Admin course policies are missing';
  end if;

  if has_table_privilege('public', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('anon', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('authenticated', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('public', 'public.course_rights_declarations', 'SELECT')
     or has_table_privilege('anon', 'public.course_rights_declarations', 'SELECT')
     or has_table_privilege('authenticated', 'public.course_rights_declarations', 'SELECT') then
    raise exception 'Course moderation aborted: unexpected browser table grant exists';
  end if;
end;
$$;

drop policy "Admins can read all learning courses" on public.learning_courses;
drop policy "Admins can approve learning courses" on public.learning_courses;

create function public.list_pending_learning_courses(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  course_id bigint,
  course_title text,
  instructor_name text,
  instructor_email text,
  category text,
  level text,
  is_free boolean,
  price_amount numeric,
  price_currency text,
  submitted_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 50 or p_offset < 0 then
    raise exception 'Invalid course-review pagination' using errcode = '22023';
  end if;

  return query
  select course.id,
         course.title,
         profile.full_name,
         auth_user.email::text,
         course.category,
         course.level,
         course.is_free,
         course.price_amount,
         course.price_currency,
         course.submitted_at
  from public.learning_courses as course
  left join public.profiles as profile on profile.id = course.instructor_id
  left join auth.users as auth_user on auth_user.id = course.instructor_id
  where course.status = 'pending_review'
  order by course.submitted_at desc nulls last, course.id desc
  limit p_limit offset p_offset;
end;
$$;

create function public.get_learning_course_for_review(p_course_id bigint)
returns table (
  course_id bigint,
  course_title text,
  summary text,
  description text,
  category text,
  level text,
  is_free boolean,
  price_amount numeric,
  price_currency text,
  course_status text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text,
  instructor_id uuid,
  instructor_name text,
  instructor_email text,
  declaration_version text,
  rights_basis text,
  declaration_accepted_at timestamptz,
  module_id bigint,
  module_title text,
  module_position integer,
  lesson_id bigint,
  lesson_title text,
  lesson_type text,
  lesson_content text,
  video_provider text,
  video_reference text,
  video_visibility text,
  duration_seconds integer,
  is_preview boolean,
  lesson_position integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;

  return query
  select course.id,
         course.title,
         course.summary,
         course.description,
         course.category,
         course.level,
         course.is_free,
         course.price_amount,
         course.price_currency,
         course.status,
         course.submitted_at,
         course.reviewed_at,
         course.reviewed_by,
         course.review_note,
         course.instructor_id,
         profile.full_name,
         auth_user.email::text,
         declaration.declaration_version,
         declaration.rights_basis,
         declaration.accepted_at,
         module.id,
         module.title,
         module.position,
         lesson.id,
         lesson.title,
         lesson.lesson_type,
         lesson.content,
         lesson.video_provider,
         lesson.video_reference,
         lesson.video_visibility,
         lesson.duration_seconds,
         lesson.is_preview,
         lesson.position
  from public.learning_courses as course
  left join public.profiles as profile on profile.id = course.instructor_id
  left join auth.users as auth_user on auth_user.id = course.instructor_id
  left join lateral (
    select declaration_row.declaration_version, declaration_row.rights_basis, declaration_row.accepted_at
    from public.course_rights_declarations as declaration_row
    where declaration_row.course_id = course.id
      and declaration_row.instructor_id = course.instructor_id
      and declaration_row.declaration_version = '2026-08-v1'
      and course.submitted_at is not null
      and declaration_row.accepted_at <= course.submitted_at
    order by declaration_row.accepted_at desc, declaration_row.id desc
    limit 1
  ) as declaration on true
  left join public.course_modules as module on module.course_id = course.id
  left join public.lessons as lesson on lesson.course_id = course.id and lesson.module_id = module.id
  where course.id = p_course_id
    and course.status = 'pending_review'
  order by module.position, module.id, lesson.position, lesson.id;
end;
$$;

create function public.review_learning_course(
  p_course_id bigint,
  p_decision text,
  p_review_note text default null
)
returns table (
  course_id bigint,
  review_status text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  course_key bigint;
  reviewed_time timestamptz;
  course_submitted_at timestamptz;
  course_instructor_id uuid;
  course_is_free boolean;
  course_price_amount numeric;
  course_price_currency text;
  course_is_limited_time_free boolean;
  declaration_key bigint;
  normalized_decision text := lower(btrim(p_decision));
  normalized_note text := nullif(btrim(p_review_note), '');
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;
  if normalized_decision not in ('published', 'returned') then
    raise exception 'Unsupported course-review decision' using errcode = '22023';
  end if;
  if normalized_note is not null and char_length(normalized_note) > 2000 then
    raise exception 'Review note is too long' using errcode = '22023';
  end if;
  if normalized_decision = 'returned' and (normalized_note is null or char_length(normalized_note) < 2) then
    raise exception 'A review note is required when returning a course for changes' using errcode = '22023';
  end if;

  select course.id into course_key
  from public.learning_courses as course
  where course.id = p_course_id and course.status = 'pending_review';
  if course_key is null then
    raise exception 'Submitted course not found or already finalized' using errcode = 'P0002';
  end if;

  select course.id,
         course.submitted_at,
         course.instructor_id,
         course.is_free,
         course.price_amount,
         course.price_currency,
         course.is_limited_time_free
    into course_key,
         course_submitted_at,
         course_instructor_id,
         course_is_free,
         course_price_amount,
         course_price_currency,
         course_is_limited_time_free
  from public.learning_courses as course
  where course.id = course_key and course.status = 'pending_review'
  for update;
  if course_key is null then
    raise exception 'Submitted course not found or already finalized' using errcode = 'P0002';
  end if;

  if normalized_decision = 'published' then
    select declaration_row.id into declaration_key
    from public.course_rights_declarations as declaration_row
    where declaration_row.course_id = course_key
      and declaration_row.instructor_id = course_instructor_id
      and declaration_row.declaration_version = '2026-08-v1'
      and course_submitted_at is not null
      and declaration_row.accepted_at <= course_submitted_at
    order by declaration_row.accepted_at desc, declaration_row.id desc
    limit 1;

    if course_submitted_at is null
       or course_is_free is not true
       or coalesce(course_price_amount, 0) <> 0
       or coalesce(course_price_currency, 'NGN') <> 'NGN'
       or coalesce(course_is_limited_time_free, false)
       or declaration_key is null then
      raise exception 'Course cannot be published because it does not satisfy the secure submission prerequisites' using errcode = '22023';
    end if;
  end if;

  update public.learning_courses as course
  set status = case when normalized_decision = 'published' then 'published' else 'draft' end,
      published_at = case when normalized_decision = 'published' then now() else null end,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      review_note = normalized_note,
      updated_at = now()
  where course.id = course_key and course.status = 'pending_review'
  returning course.reviewed_at into reviewed_time;

  if not found then
    raise exception 'Submitted course not found or already finalized' using errcode = 'P0002';
  end if;

  return query select course_key, case when normalized_decision = 'published' then 'published'::text else 'draft'::text end, reviewed_time;
end;
$$;

revoke execute on function public.list_pending_learning_courses(integer, integer), public.get_learning_course_for_review(bigint), public.review_learning_course(bigint, text, text) from public, anon, authenticated;
grant execute on function public.list_pending_learning_courses(integer, integer), public.get_learning_course_for_review(bigint), public.review_learning_course(bigint, text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_courses' and policyname in ('Admins can read all learning courses', 'Admins can approve learning courses')) then
    raise exception 'Course moderation aborted: legacy Admin course policy remains after replacement';
  end if;
  if has_function_privilege('public', 'public.list_pending_learning_courses(integer,integer)', 'EXECUTE')
     or has_function_privilege('public', 'public.get_learning_course_for_review(bigint)', 'EXECUTE')
     or has_function_privilege('public', 'public.review_learning_course(bigint,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_pending_learning_courses(integer,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_learning_course_for_review(bigint)', 'EXECUTE')
     or has_function_privilege('anon', 'public.review_learning_course(bigint,text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_pending_learning_courses(integer,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_learning_course_for_review(bigint)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.review_learning_course(bigint,text,text)', 'EXECUTE') then
    raise exception 'Course moderation aborted: Admin RPC execution grants are not hardened';
  end if;
end;
$$;

commit;
