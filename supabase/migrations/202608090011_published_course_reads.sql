-- Growvelt Learning Phase 2B-A: narrow learner-facing published course reads.
-- Forward-only. Preserves existing published RLS policies and exposes no review metadata.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
     or to_regclass('public.course_modules') is null
     or to_regclass('public.lessons') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Published course reads aborted: expected Learning relations are missing';
  end if;

  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('learning_courses', 'course_modules', 'lessons', 'profiles')
      and not relation_row.relrowsecurity
  ) then
    raise exception 'Published course reads aborted: RLS must remain enabled on Learning relations';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'instructor_id' and data_type = 'uuid')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'slug' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'title' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'summary' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'description' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'category' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'level' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'status' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'is_free' and data_type = 'boolean')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_amount' and data_type = 'numeric')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_currency' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'published_at' and data_type = 'timestamp with time zone')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'course_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'title' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'position' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'course_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'module_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'title' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'lesson_type' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'content' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'is_preview' and data_type = 'boolean')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'position' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'video_provider' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'video_reference' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'video_visibility' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'duration_seconds' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name' and data_type = 'text') then
    raise exception 'Published course reads aborted: expected published-course shape is missing';
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'learning_courses' and policyname = 'Published courses are public')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'course_modules' and policyname = 'Published course modules are public')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lessons' and policyname = 'Published course preview lessons are public') then
    raise exception 'Published course reads aborted: expected published reader policies are missing';
  end if;

  if has_column_privilege('public', 'public.learning_courses', 'reviewed_by', 'SELECT')
     or has_column_privilege('anon', 'public.learning_courses', 'reviewed_by', 'SELECT')
     or has_column_privilege('authenticated', 'public.learning_courses', 'reviewed_by', 'SELECT')
     or has_column_privilege('public', 'public.learning_courses', 'review_note', 'SELECT')
     or has_column_privilege('anon', 'public.learning_courses', 'review_note', 'SELECT')
     or has_column_privilege('authenticated', 'public.learning_courses', 'review_note', 'SELECT') then
    raise exception 'Published course reads aborted: internal course review metadata is browser-readable';
  end if;

  if to_regprocedure('public.list_published_learning_courses(integer,integer)') is not null
     or to_regprocedure('public.get_published_learning_course_by_slug(text)') is not null then
    raise exception 'Published course reads aborted: expected clean Phase 2B-A RPC state is missing';
  end if;
end;
$$;

create function public.list_published_learning_courses(
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  course_id bigint,
  slug text,
  title text,
  summary text,
  category text,
  level text,
  is_free boolean,
  price_amount numeric,
  price_currency text,
  instructor_name text,
  published_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 36 or p_offset < 0 then
    raise exception 'Invalid published-course pagination' using errcode = '22023';
  end if;

  return query
  select course_row.id,
         course_row.slug,
         course_row.title,
         course_row.summary,
         course_row.category,
         course_row.level,
         course_row.is_free,
         course_row.price_amount,
         course_row.price_currency,
         profile_row.full_name,
         course_row.published_at
  from public.learning_courses as course_row
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  where course_row.status = 'published'
  order by course_row.published_at desc nulls last, course_row.id desc
  limit p_limit offset p_offset;
end;
$$;

create function public.get_published_learning_course_by_slug(p_slug text)
returns table (
  course_id bigint,
  slug text,
  course_title text,
  summary text,
  description text,
  category text,
  level text,
  is_free boolean,
  price_amount numeric,
  price_currency text,
  instructor_name text,
  published_at timestamptz,
  module_id bigint,
  module_title text,
  module_position integer,
  lesson_id bigint,
  lesson_title text,
  lesson_type text,
  is_preview boolean,
  preview_text_content text,
  preview_video_provider text,
  preview_video_reference text,
  preview_video_visibility text,
  preview_duration_seconds integer,
  lesson_position integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  normalized_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then
    raise exception 'Invalid published course reference' using errcode = '22023';
  end if;

  return query
  select course_row.id,
         course_row.slug,
         course_row.title,
         course_row.summary,
         course_row.description,
         course_row.category,
         course_row.level,
         course_row.is_free,
         course_row.price_amount,
         course_row.price_currency,
         profile_row.full_name,
         course_row.published_at,
         module_row.id,
         module_row.title,
         module_row.position,
         lesson_row.id,
         lesson_row.title,
         lesson_row.lesson_type,
         lesson_row.is_preview,
         case when lesson_row.is_preview then lesson_row.content else null::text end,
         case when lesson_row.is_preview then lesson_row.video_provider else null::text end,
         case when lesson_row.is_preview then lesson_row.video_reference else null::text end,
         case when lesson_row.is_preview then lesson_row.video_visibility else null::text end,
         case when lesson_row.is_preview then lesson_row.duration_seconds else null::integer end,
         lesson_row.position
  from public.learning_courses as course_row
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  left join public.course_modules as module_row on module_row.course_id = course_row.id
  left join public.lessons as lesson_row on lesson_row.course_id = course_row.id and lesson_row.module_id = module_row.id
  where course_row.slug = normalized_slug
    and course_row.status = 'published'
  order by module_row.position nulls last, module_row.id, lesson_row.position nulls last, lesson_row.id;
end;
$$;

revoke execute on function public.list_published_learning_courses(integer, integer), public.get_published_learning_course_by_slug(text) from public, anon, authenticated;
grant execute on function public.list_published_learning_courses(integer, integer), public.get_published_learning_course_by_slug(text) to authenticated;

do $$
begin
  if has_function_privilege('public', 'public.list_published_learning_courses(integer,integer)', 'EXECUTE')
     or has_function_privilege('public', 'public.get_published_learning_course_by_slug(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_published_learning_courses(integer,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_published_learning_course_by_slug(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_published_learning_courses(integer,integer)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_published_learning_course_by_slug(text)', 'EXECUTE')
     or not exists (select 1 from pg_proc as routine_row where routine_row.oid = 'public.list_published_learning_courses(integer,integer)'::regprocedure and routine_row.prosecdef)
     or not exists (select 1 from pg_proc as routine_row where routine_row.oid = 'public.get_published_learning_course_by_slug(text)'::regprocedure and routine_row.prosecdef) then
    raise exception 'Published course reads aborted: RPC execution grants or security-definer state are not hardened';
  end if;
end;
$$;

commit;
