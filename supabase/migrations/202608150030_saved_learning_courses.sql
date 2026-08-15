-- Phase 2D-K: private, owner-scoped saved Learning courses.
-- Forward-only. Browser clients use the narrow RPC boundaries below rather
-- than direct table access.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
    or to_regclass('public.profiles') is null then
    raise exception 'Saved Learning courses aborted: required Learning relations are missing';
  end if;

  if exists (
    select 1
    from pg_class as relation_row
    join pg_namespace as namespace_row
      on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname in ('learning_courses', 'profiles')
      and not relation_row.relrowsecurity
  ) then
    raise exception 'Saved Learning courses aborted: Learning RLS baseline is missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('learning_courses', 'id', 'bigint'),
        ('learning_courses', 'slug', 'text'),
        ('learning_courses', 'title', 'text'),
        ('learning_courses', 'summary', 'text'),
        ('learning_courses', 'category', 'text'),
        ('learning_courses', 'level', 'text'),
        ('learning_courses', 'is_free', 'boolean'),
        ('learning_courses', 'price_amount', 'numeric'),
        ('learning_courses', 'price_currency', 'text'),
        ('learning_courses', 'instructor_id', 'uuid'),
        ('learning_courses', 'status', 'text'),
        ('profiles', 'id', 'uuid'),
        ('profiles', 'full_name', 'text')
    ) as expected_column(relation_name, column_name, data_type)
    left join information_schema.columns as column_row
      on column_row.table_schema = 'public'
      and column_row.table_name = expected_column.relation_name
      and column_row.column_name = expected_column.column_name
      and column_row.data_type = expected_column.data_type
    where column_row.column_name is null
  ) then
    raise exception 'Saved Learning courses aborted: required column baseline is missing';
  end if;

  if to_regclass('public.learning_course_saves') is not null
    or to_regprocedure('public.toggle_own_learning_course_save(bigint)') is not null
    or to_regprocedure('public.get_own_saved_learning_course_ids()') is not null
    or to_regprocedure('public.list_own_saved_learning_courses(integer,integer)') is not null then
    raise exception 'Saved Learning courses aborted: partial saved-course state already exists';
  end if;
end;
$$;

create table public.learning_course_saves (
  learner_id uuid not null references public.profiles(id) on delete cascade,
  course_id bigint not null references public.learning_courses(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (learner_id, course_id)
);

alter table public.learning_course_saves enable row level security;

create index learning_course_saves_learner_saved_at_idx
  on public.learning_course_saves (learner_id, saved_at desc, course_id desc);

revoke all on table public.learning_course_saves from public, anon, authenticated;

create function public.toggle_own_learning_course_save(p_course_id bigint)
returns table (
  is_saved boolean,
  saved_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  save_timestamp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_course_id is null or p_course_id <= 0 then
    raise exception 'Invalid course reference' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(auth.uid()::text),
    (p_course_id % 2147483647)::integer
  );

  perform 1
  from public.learning_courses as course_row
  where course_row.id = p_course_id
    and course_row.status = 'published'
  for share;

  if not found then
    raise exception 'This course is not available to save' using errcode = '22023';
  end if;

  delete from public.learning_course_saves as save_row
  where save_row.learner_id = auth.uid()
    and save_row.course_id = p_course_id
  returning save_row.saved_at into save_timestamp;

  if found then
    return query select false, null::timestamptz;
    return;
  end if;

  insert into public.learning_course_saves (learner_id, course_id)
  values (auth.uid(), p_course_id)
  returning learning_course_saves.saved_at into save_timestamp;

  return query select true, save_timestamp;
end;
$$;

create function public.get_own_saved_learning_course_ids()
returns table (course_id bigint)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select save_row.course_id
  from public.learning_course_saves as save_row
  join public.learning_courses as course_row
    on course_row.id = save_row.course_id
    and course_row.status = 'published'
  where save_row.learner_id = auth.uid()
  order by save_row.saved_at desc, save_row.course_id desc;
end;
$$;

create function public.list_own_saved_learning_courses(
  p_limit integer default 48,
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
  saved_at timestamptz
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

  if p_limit not between 1 and 48 or p_offset < 0 then
    raise exception 'Invalid saved-course pagination' using errcode = '22023';
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
    save_row.saved_at
  from public.learning_course_saves as save_row
  join public.learning_courses as course_row
    on course_row.id = save_row.course_id
    and course_row.status = 'published'
  left join public.profiles as profile_row
    on profile_row.id = course_row.instructor_id
  where save_row.learner_id = auth.uid()
  order by save_row.saved_at desc, course_row.id desc
  limit p_limit
  offset p_offset;
end;
$$;

revoke execute on function public.toggle_own_learning_course_save(bigint), public.get_own_saved_learning_course_ids(), public.list_own_saved_learning_courses(integer, integer) from public, anon, authenticated;
grant execute on function public.toggle_own_learning_course_save(bigint), public.get_own_saved_learning_course_ids(), public.list_own_saved_learning_courses(integer, integer) to authenticated;

do $$
declare
  mismatch_row record;
  function_row record;
begin
  for mismatch_row in
    with expected_outputs(function_oid, output_position, output_name, output_type) as (
      values
        ('public.toggle_own_learning_course_save(bigint)'::regprocedure::oid, 1, 'is_saved'::text, 'boolean'::regtype::oid),
        ('public.toggle_own_learning_course_save(bigint)'::regprocedure::oid, 2, 'saved_at'::text, 'timestamptz'::regtype::oid),
        ('public.get_own_saved_learning_course_ids()'::regprocedure::oid, 1, 'course_id'::text, 'bigint'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 1, 'course_id'::text, 'bigint'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 2, 'slug'::text, 'text'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 3, 'title'::text, 'text'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 4, 'summary'::text, 'text'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 5, 'category'::text, 'text'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 6, 'level'::text, 'text'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 7, 'is_free'::text, 'boolean'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 8, 'price_amount'::text, 'numeric'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 9, 'price_currency'::text, 'text'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 10, 'instructor_name'::text, 'text'::regtype::oid),
        ('public.list_own_saved_learning_courses(integer,integer)'::regprocedure::oid, 11, 'saved_at'::text, 'timestamptz'::regtype::oid)
    ), actual_outputs as (
      select
        procedure_row.oid as function_oid,
        row_number() over (partition by procedure_row.oid order by argument_row.ordinality)::integer as output_position,
        argument_row.output_name::text,
        argument_row.output_type,
        argument_row.output_mode
      from pg_proc as procedure_row
      cross join lateral unnest(procedure_row.proallargtypes, procedure_row.proargmodes, procedure_row.proargnames)
        with ordinality as argument_row(output_type, output_mode, output_name, ordinality)
      where procedure_row.oid in (
        'public.toggle_own_learning_course_save(bigint)'::regprocedure,
        'public.get_own_saved_learning_course_ids()'::regprocedure,
        'public.list_own_saved_learning_courses(integer,integer)'::regprocedure
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
    raise exception 'Saved Learning courses aborted: return contract mismatch for %', mismatch_row.function_name
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

  for function_row in
    select procedure_row.*
    from pg_proc as procedure_row
    where procedure_row.oid in (
      'public.toggle_own_learning_course_save(bigint)'::regprocedure,
      'public.get_own_saved_learning_course_ids()'::regprocedure,
      'public.list_own_saved_learning_courses(integer,integer)'::regprocedure
    )
  loop
    if not function_row.prosecdef
      or not exists (
        select 1
        from unnest(coalesce(function_row.proconfig, array[]::text[])) as setting_row(setting_value)
        where split_part(setting_row.setting_value, '=', 1) = 'search_path'
          and replace(split_part(setting_row.setting_value, '=', 2), '"', '') = ''
      )
      or has_function_privilege('public', function_row.oid, 'EXECUTE')
      or has_function_privilege('anon', function_row.oid, 'EXECUTE')
      or not has_function_privilege('authenticated', function_row.oid, 'EXECUTE') then
      raise exception 'Saved Learning courses aborted: security or grants are unexpected for %', function_row.oid::regprocedure;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_class as relation_row
    where relation_row.oid = 'public.learning_course_saves'::regclass
      and relation_row.relrowsecurity
  )
    or has_table_privilege('public', 'public.learning_course_saves', 'SELECT')
    or has_table_privilege('anon', 'public.learning_course_saves', 'SELECT')
    or has_table_privilege('authenticated', 'public.learning_course_saves', 'SELECT')
    or has_table_privilege('public', 'public.learning_course_saves', 'INSERT')
    or has_table_privilege('anon', 'public.learning_course_saves', 'INSERT')
    or has_table_privilege('authenticated', 'public.learning_course_saves', 'INSERT')
    or has_table_privilege('public', 'public.learning_course_saves', 'UPDATE')
    or has_table_privilege('anon', 'public.learning_course_saves', 'UPDATE')
    or has_table_privilege('authenticated', 'public.learning_course_saves', 'UPDATE')
    or has_table_privilege('public', 'public.learning_course_saves', 'DELETE')
    or has_table_privilege('anon', 'public.learning_course_saves', 'DELETE')
    or has_table_privilege('authenticated', 'public.learning_course_saves', 'DELETE') then
    raise exception 'Saved Learning courses aborted: saved-course table browser access is unexpected';
  end if;
end;
$$;

commit;
