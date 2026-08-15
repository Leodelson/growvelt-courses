begin;

do $$
begin
  if (
    select count(*)
    from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('learning_courses', 'instructor_profiles', 'profiles')
      and relation_row.relkind = 'r'
  ) <> 3 then
    raise exception 'Operational discovery aborted: required Learning relations are missing';
  end if;

  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('learning_courses', 'instructor_profiles', 'profiles')
      and relation_row.relkind = 'r'
      and not relation_row.relrowsecurity
  ) then
    raise exception 'Operational discovery aborted: expected Learning RLS baseline is missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('learning_courses', 'id'),
        ('learning_courses', 'instructor_id'),
        ('learning_courses', 'title'),
        ('learning_courses', 'summary'),
        ('learning_courses', 'category'),
        ('learning_courses', 'level'),
        ('learning_courses', 'is_free'),
        ('learning_courses', 'price_amount'),
        ('learning_courses', 'price_currency'),
        ('learning_courses', 'status'),
        ('learning_courses', 'submitted_at'),
        ('learning_courses', 'updated_at'),
        ('instructor_profiles', 'user_id'),
        ('instructor_profiles', 'approval_status'),
        ('instructor_profiles', 'expertise'),
        ('instructor_profiles', 'created_at'),
        ('profiles', 'id'),
        ('profiles', 'full_name')
    ) as expected_column(relation_name, column_name)
    left join information_schema.columns as column_row
      on column_row.table_schema = 'public'
      and column_row.table_name = expected_column.relation_name
      and column_row.column_name = expected_column.column_name
    where column_row.column_name is null
  ) then
    raise exception 'Operational discovery aborted: required Learning columns are missing';
  end if;

  if exists (
    select 1
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname in (
        'search_own_instructor_courses',
        'search_pending_learning_courses',
        'search_pending_instructor_applications'
      )
  ) then
    raise exception 'Operational discovery aborted: partial Phase 2D-H function state exists';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.oid = 'public.is_approved_growvelt_instructor()'::regprocedure
      and procedure_row.prosecdef
  ) or not exists (
    select 1
    from pg_proc as procedure_row
    join pg_namespace as namespace_row on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.oid = 'public.is_growvelt_learning_admin()'::regprocedure
      and procedure_row.prosecdef
  ) then
    raise exception 'Operational discovery aborted: expected capability baseline is missing';
  end if;
end;
$$;

create function public.search_own_instructor_courses(
  p_query text default null,
  p_status text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  course_id bigint,
  title text,
  summary text,
  category text,
  level text,
  is_free boolean,
  price_amount numeric,
  price_currency text,
  status text,
  updated_at timestamptz,
  total_courses integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  normalized_query text := nullif(lower(btrim(p_query)), '');
  normalized_status text := nullif(lower(btrim(p_status)), '');
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if normalized_query is not null and length(normalized_query) > 120 then
    raise exception 'Search query is too long' using errcode = '22023';
  end if;

  if normalized_status is not null and normalized_status not in ('draft', 'pending_review', 'published', 'archived') then
    raise exception 'Invalid course status filter' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 48 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid course list pagination' using errcode = '22023';
  end if;

  return query
  select
    course_row.id,
    course_row.title,
    course_row.summary,
    course_row.category,
    course_row.level,
    course_row.is_free,
    course_row.price_amount,
    course_row.price_currency,
    course_row.status,
    course_row.updated_at,
    count(*) over ()::integer
  from public.learning_courses as course_row
  where course_row.instructor_id = auth.uid()
    and (normalized_status is null or course_row.status = normalized_status)
    and (
      normalized_query is null
      or strpos(lower(concat_ws(' ', course_row.title, course_row.summary, course_row.category, course_row.level)), normalized_query) > 0
    )
  order by course_row.updated_at desc, course_row.id desc
  limit p_limit offset p_offset;
end;
$$;

create function public.search_pending_learning_courses(
  p_query text default null,
  p_category text default null,
  p_level text default null,
  p_limit integer default 12,
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
  submitted_at timestamptz,
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
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;

  if (normalized_query is not null and length(normalized_query) > 120)
    or (normalized_category is not null and length(normalized_category) > 100)
    or (normalized_level is not null and length(normalized_level) > 100) then
    raise exception 'Invalid course-review filter' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 48 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid course-review pagination' using errcode = '22023';
  end if;

  return query
  select
    course_row.id,
    course_row.title,
    profile_row.full_name,
    auth_user.email::text,
    course_row.category,
    course_row.level,
    course_row.is_free,
    course_row.price_amount,
    course_row.price_currency,
    course_row.submitted_at,
    count(*) over ()::integer
  from public.learning_courses as course_row
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  left join auth.users as auth_user on auth_user.id = course_row.instructor_id
  where course_row.status = 'pending_review'
    and (normalized_category is null or lower(coalesce(course_row.category, '')) = normalized_category)
    and (normalized_level is null or lower(coalesce(course_row.level, '')) = normalized_level)
    and (
      normalized_query is null
      or strpos(lower(concat_ws(' ', course_row.title, course_row.category, course_row.level, profile_row.full_name, auth_user.email)), normalized_query) > 0
    )
  order by course_row.submitted_at desc nulls last, course_row.id desc
  limit p_limit offset p_offset;
end;
$$;

create function public.search_pending_instructor_applications(
  p_query text default null,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  country text,
  phone text,
  headline text,
  bio text,
  expertise text[],
  years_experience smallint,
  teaching_experience text,
  motivation text,
  portfolio_url text,
  approval_status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  total_applications integer
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  normalized_query text := nullif(lower(btrim(p_query)), '');
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;

  if normalized_query is not null and length(normalized_query) > 120 then
    raise exception 'Search query is too long' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 48 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid Instructor-review pagination' using errcode = '22023';
  end if;

  return query
  select
    application_row.user_id,
    profile_row.full_name,
    auth_user.email::text,
    application_row.country,
    application_row.phone,
    application_row.headline,
    application_row.bio,
    application_row.expertise,
    application_row.years_experience,
    application_row.teaching_experience,
    application_row.motivation,
    application_row.portfolio_url,
    application_row.approval_status,
    application_row.created_at,
    application_row.reviewed_at,
    application_row.review_note,
    count(*) over ()::integer
  from public.instructor_profiles as application_row
  join public.profiles as profile_row on profile_row.id = application_row.user_id
  join auth.users as auth_user on auth_user.id = application_row.user_id
  where application_row.approval_status = 'pending'
    and (
      normalized_query is null
      or strpos(lower(concat_ws(' ', profile_row.full_name, auth_user.email, application_row.country, application_row.headline, application_row.expertise::text)), normalized_query) > 0
    )
  order by application_row.created_at desc, application_row.user_id
  limit p_limit offset p_offset;
end;
$$;

revoke execute on function public.search_own_instructor_courses(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.search_pending_learning_courses(text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.search_pending_instructor_applications(text, integer, integer) from public, anon, authenticated;
grant execute on function public.search_own_instructor_courses(text, text, integer, integer) to authenticated;
grant execute on function public.search_pending_learning_courses(text, text, text, integer, integer) to authenticated;
grant execute on function public.search_pending_instructor_applications(text, integer, integer) to authenticated;

do $$
declare
  procedure_name regprocedure;
begin
  foreach procedure_name in array array[
    'public.search_own_instructor_courses(text,text,integer,integer)'::regprocedure,
    'public.search_pending_learning_courses(text,text,text,integer,integer)'::regprocedure,
    'public.search_pending_instructor_applications(text,integer,integer)'::regprocedure
  ] loop
    if not exists (
      select 1
      from pg_proc as procedure_row
      where procedure_row.oid = procedure_name
        and procedure_row.prosecdef
        and exists (
          select 1
          from unnest(coalesce(procedure_row.proconfig, array[]::text[])) as setting_row(setting_value)
          where split_part(setting_row.setting_value, '=', 1) = 'search_path'
            and btrim(split_part(setting_row.setting_value, '=', 2), '"') = ''
        )
        and has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE')
        and not has_function_privilege('public', procedure_row.oid, 'EXECUTE')
        and not has_function_privilege('anon', procedure_row.oid, 'EXECUTE')
    ) then
      raise exception 'Operational discovery aborted: function security/grant verification failed for %', procedure_name::text;
    end if;
  end loop;
end;
$$;

commit;
