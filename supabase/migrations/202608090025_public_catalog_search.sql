-- Growvelt Learning Phase 2D-C: public, query-driven published course catalog.
-- Forward-only. This adds a narrow anonymous read boundary; it does not grant
-- table access or expose course review, curriculum, learner, or assessment data.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Public catalog search aborted: expected Learning relations are missing';
  end if;

  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('learning_courses', 'profiles')
      and not relation_row.relrowsecurity
  ) then
    raise exception 'Public catalog search aborted: Learning RLS must remain enabled';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'instructor_id' and data_type = 'uuid')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'slug' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'title' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'summary' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'category' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'level' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'status' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'is_free' and data_type = 'boolean')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_amount' and data_type = 'numeric')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_currency' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'published_at' and data_type = 'timestamp with time zone')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name' and data_type = 'text') then
    raise exception 'Public catalog search aborted: expected course shape is missing';
  end if;

  if has_column_privilege('public', 'public.learning_courses', 'reviewed_by', 'SELECT')
     or has_column_privilege('anon', 'public.learning_courses', 'reviewed_by', 'SELECT')
     or has_column_privilege('authenticated', 'public.learning_courses', 'reviewed_by', 'SELECT')
     or has_column_privilege('public', 'public.learning_courses', 'review_note', 'SELECT')
     or has_column_privilege('anon', 'public.learning_courses', 'review_note', 'SELECT')
     or has_column_privilege('authenticated', 'public.learning_courses', 'review_note', 'SELECT') then
    raise exception 'Public catalog search aborted: internal course review metadata is browser-readable';
  end if;

  if to_regprocedure('public.search_public_published_learning_courses(text,text,text,boolean,text,integer,integer)') is not null then
    raise exception 'Public catalog search aborted: expected clean Phase 2D-C RPC state is missing';
  end if;
end;
$$;

create function public.search_public_published_learning_courses(
  p_query text default null,
  p_category text default null,
  p_level text default null,
  p_is_free boolean default null,
  p_sort text default 'newest',
  p_limit integer default 12,
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
  published_at timestamptz,
  total_courses integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  normalized_query text := nullif(lower(btrim(p_query)), '');
  normalized_category text := nullif(lower(btrim(p_category)), '');
  normalized_level text := nullif(lower(btrim(p_level)), '');
  normalized_sort text := lower(btrim(coalesce(p_sort, 'newest')));
begin
  if normalized_query is not null and char_length(normalized_query) > 120 then
    raise exception 'Invalid catalog search query' using errcode = '22023';
  end if;
  if normalized_category is not null and char_length(normalized_category) > 100 then
    raise exception 'Invalid catalog category filter' using errcode = '22023';
  end if;
  if normalized_level is not null and char_length(normalized_level) > 100 then
    raise exception 'Invalid catalog level filter' using errcode = '22023';
  end if;
  if normalized_sort not in ('newest', 'title_asc', 'title_desc') then
    raise exception 'Invalid catalog sort' using errcode = '22023';
  end if;
  if p_limit not between 1 and 24 or p_offset < 0 then
    raise exception 'Invalid catalog pagination' using errcode = '22023';
  end if;

  return query
  select
    course_row.id,
    course_row.slug,
    course_row.title,
    course_row.summary,
    course_row.category,
    course_row.level,
    course_row.is_free,
    course_row.price_amount,
    course_row.price_currency,
    profile_row.full_name,
    course_row.published_at,
    count(*) over ()::integer
  from public.learning_courses as course_row
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  where course_row.status = 'published'
    and (normalized_query is null or position(normalized_query in lower(concat_ws(' ', course_row.title, course_row.summary, course_row.category, course_row.level))) > 0)
    and (normalized_category is null or lower(course_row.category) = normalized_category)
    and (normalized_level is null or lower(course_row.level) = normalized_level)
    and (p_is_free is null or course_row.is_free = p_is_free)
  order by
    case when normalized_sort = 'title_asc' then lower(course_row.title) end asc nulls last,
    case when normalized_sort = 'title_desc' then lower(course_row.title) end desc nulls last,
    case when normalized_sort = 'newest' then course_row.published_at end desc nulls last,
    course_row.id desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke execute on function public.search_public_published_learning_courses(text, text, text, boolean, text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_public_published_learning_courses(text, text, text, boolean, text, integer, integer) to anon, authenticated;

do $$
declare
  mismatch_row record;
begin
  for mismatch_row in
    with expected_outputs(output_position, output_name, output_type) as (
      values
        (1, 'course_id'::text, 'bigint'::regtype::oid),
        (2, 'slug'::text, 'text'::regtype::oid),
        (3, 'title'::text, 'text'::regtype::oid),
        (4, 'summary'::text, 'text'::regtype::oid),
        (5, 'category'::text, 'text'::regtype::oid),
        (6, 'level'::text, 'text'::regtype::oid),
        (7, 'is_free'::text, 'boolean'::regtype::oid),
        (8, 'price_amount'::text, 'numeric'::regtype::oid),
        (9, 'price_currency'::text, 'text'::regtype::oid),
        (10, 'instructor_name'::text, 'text'::regtype::oid),
        (11, 'published_at'::text, 'timestamptz'::regtype::oid),
        (12, 'total_courses'::text, 'integer'::regtype::oid)
    ), actual_outputs as (
      select
        row_number() over (order by argument_row.ordinality)::integer as output_position,
        argument_row.argument_name::text as output_name,
        argument_row.argument_type as output_type,
        argument_row.argument_mode as output_mode
      from pg_proc as procedure_row
      cross join lateral unnest(procedure_row.proallargtypes, procedure_row.proargmodes, procedure_row.proargnames)
        with ordinality as argument_row(argument_type, argument_mode, argument_name, ordinality)
      where procedure_row.oid = 'public.search_public_published_learning_courses(text,text,text,boolean,text,integer,integer)'::regprocedure
        and argument_row.argument_mode in ('t'::"char", 'o'::"char")
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
      or expected_outputs.output_name <> actual_outputs.output_name
      or expected_outputs.output_type <> actual_outputs.output_type
    order by output_position
    limit 1
  loop
    raise exception 'Public catalog search aborted: return contract mismatch'
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

  if not exists (
    select 1
    from pg_proc as procedure_row
    where procedure_row.oid = 'public.search_public_published_learning_courses(text,text,text,boolean,text,integer,integer)'::regprocedure
      and procedure_row.prosecdef
      and exists (
        select 1
        from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
      and not has_function_privilege('public', procedure_row.oid, 'EXECUTE')
      and has_function_privilege('anon', procedure_row.oid, 'EXECUTE')
      and has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE')
  ) then
    raise exception 'Public catalog search aborted: RPC security or execution grants are unexpected';
  end if;
end;
$$;

commit;
