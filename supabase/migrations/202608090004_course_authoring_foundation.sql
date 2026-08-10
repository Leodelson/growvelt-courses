-- Growvelt Learning Phase 2A-A: secure Instructor-owned course draft metadata.
--
-- Forward-only. Review and execute once through the approved production
-- Supabase workflow. This migration intentionally excludes curriculum,
-- lessons, video, submission, publishing, and payments.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
     or to_regclass('public.instructor_profiles') is null
     or to_regclass('public.account_capabilities') is null then
    raise exception 'Course authoring foundation aborted: expected Learning tables are missing';
  end if;

  if not exists (
    select 1
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'learning_courses'
      and pg_class.relrowsecurity
  ) then
    raise exception 'Course authoring foundation aborted: RLS must be enabled on public.learning_courses';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name = 'id' and data_type = 'bigint'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name = 'instructor_id' and data_type = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name = 'slug' and data_type = 'text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name = 'is_free' and data_type = 'boolean'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name = 'price_amount' and data_type = 'numeric'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name = 'price_currency' and data_type = 'text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name = 'status' and data_type = 'text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'learning_courses'
      and column_name = 'updated_at' and data_type = 'timestamp with time zone'
  ) then
    raise exception 'Course authoring foundation aborted: learning_courses is not the expected hardened shape';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.learning_courses'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%UNIQUE (slug)%'
  ) then
    raise exception 'Course authoring foundation aborted: learning_courses must retain UNIQUE (slug)';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.learning_courses'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%draft%pending_review%published%archived%'
  ) then
    raise exception 'Course authoring foundation aborted: expected learning_courses status lifecycle is missing';
  end if;

  if to_regprocedure('public.is_approved_growvelt_instructor()') is null then
    raise exception 'Course authoring foundation aborted: approved Instructor helper is missing';
  end if;

  if not exists (
    select 1 from pg_proc
    where oid = 'public.is_approved_growvelt_instructor()'::regprocedure
      and prosecdef
  ) then
    raise exception 'Course authoring foundation aborted: approved Instructor helper must be SECURITY DEFINER';
  end if;

  if has_function_privilege('anon', 'public.is_approved_growvelt_instructor()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.is_approved_growvelt_instructor()', 'EXECUTE') then
    raise exception 'Course authoring foundation aborted: approved Instructor helper execution grants do not match the hardened baseline';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'learning_courses'
      and policyname = 'Published courses are public'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'learning_courses'
      and policyname = 'Instructors can read own submitted courses'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'learning_courses'
      and policyname = 'Approved instructors can submit courses for review'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'learning_courses'
      and policyname = 'Approved instructors can update own unpublished courses'
  ) then
    raise exception 'Course authoring foundation aborted: expected legacy course policies are missing; inspect live policy state first';
  end if;

  if not has_table_privilege('authenticated', 'public.learning_courses', 'INSERT')
     or not has_table_privilege('authenticated', 'public.learning_courses', 'UPDATE') then
    raise exception 'Course authoring foundation aborted: expected legacy browser mutation grants are missing; inspect live grants before replacement';
  end if;

  -- The expected baseline is broad table-level authenticated mutation access
  -- with no explicit column ACLs. Inspect, but do not silently preserve, any
  -- unexpected browser column grants: the replacement below revokes all of
  -- them explicitly.
  if exists (
    select 1
    from (
      select attribute.attname, attribute.attacl
      from pg_attribute as attribute
      where attribute.attrelid = 'public.learning_courses'::regclass
        and attribute.attnum > 0
        and not attribute.attisdropped
        and attribute.attacl is not null
    ) as attribute
    cross join lateral aclexplode(attribute.attacl) as column_acl
    left join pg_roles as grantee on grantee.oid = column_acl.grantee
    where column_acl.privilege_type in ('INSERT', 'UPDATE')
      and (column_acl.grantee = 0 or grantee.rolname in ('anon', 'authenticated'))
  ) then
    raise notice 'Course authoring foundation: explicit browser column mutation grants found and will be revoked';
  else
    raise notice 'Course authoring foundation: expected baseline has no explicit browser column mutation grants';
  end if;

  if to_regprocedure('public.create_instructor_course_draft(text,text,text,text,text,boolean,numeric,text)') is not null
     or to_regprocedure('public.update_instructor_course_draft(bigint,text,text,text,text,text,boolean,numeric,text)') is not null
     or to_regprocedure('public.list_own_instructor_courses(integer,integer)') is not null
     or to_regprocedure('public.get_own_instructor_course(bigint)') is not null then
    raise exception 'Course authoring foundation aborted: one or more Phase 2A-A RPCs already exist; inspect partial state first';
  end if;
end
$$;

-- Existing browser mutation policies permit an approved Instructor to submit
-- directly into pending_review and edit while a course is under review. Draft
-- creation and editing now happen only through the narrow RPCs below.
drop policy "Instructors can read own submitted courses" on public.learning_courses;
drop policy "Approved instructors can submit courses for review" on public.learning_courses;
drop policy "Approved instructors can update own unpublished courses" on public.learning_courses;

-- Public published-course reads are intentionally preserved. These revokes
-- remove browser table mutation paths only; future Admin review will use its
-- own atomic RPC rather than restoring broad browser writes.
revoke insert, update, delete on table public.learning_courses from public, anon, authenticated;

-- PostgreSQL table and column privileges are independent. Revoke the same
-- browser operations from every existing course column so no inherited or
-- previously granted column ACL can bypass the table-level hardening.
do $$
declare
  course_columns text;
begin
  select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum)
    into course_columns
  from pg_attribute as attribute
  where attribute.attrelid = 'public.learning_courses'::regclass
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if course_columns is null then
    raise exception 'Course authoring foundation aborted: public.learning_courses has no writable columns';
  end if;

  execute format(
    'revoke insert (%1$s), update (%1$s) on table public.learning_courses from public, anon, authenticated',
    course_columns
  );

  if exists (
    select 1
    from pg_attribute as attribute
    where attribute.attrelid = 'public.learning_courses'::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and (
        has_column_privilege('public', 'public.learning_courses', attribute.attname, 'INSERT')
        or has_column_privilege('public', 'public.learning_courses', attribute.attname, 'UPDATE')
        or has_column_privilege('anon', 'public.learning_courses', attribute.attname, 'INSERT')
        or has_column_privilege('anon', 'public.learning_courses', attribute.attname, 'UPDATE')
        or has_column_privilege('authenticated', 'public.learning_courses', attribute.attname, 'INSERT')
        or has_column_privilege('authenticated', 'public.learning_courses', attribute.attname, 'UPDATE')
      )
  ) then
    raise exception 'Course authoring foundation aborted: browser column mutation privilege remains after revocation';
  end if;

  if has_table_privilege('public', 'public.learning_courses', 'INSERT')
     or has_table_privilege('public', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('anon', 'public.learning_courses', 'INSERT')
     or has_table_privilege('anon', 'public.learning_courses', 'UPDATE')
     or has_table_privilege('authenticated', 'public.learning_courses', 'INSERT')
     or has_table_privilege('authenticated', 'public.learning_courses', 'UPDATE') then
    raise exception 'Course authoring foundation aborted: browser table mutation privilege remains after revocation';
  end if;

  if not has_table_privilege('service_role', 'public.learning_courses', 'INSERT')
     or not has_table_privilege('service_role', 'public.learning_courses', 'UPDATE') then
    raise exception 'Course authoring foundation aborted: service_role must retain operational course-table access';
  end if;
end
$$;

create index if not exists learning_courses_instructor_updated_at_idx
  on public.learning_courses (instructor_id, updated_at desc);

create function public.create_instructor_course_draft(
  p_title text,
  p_summary text,
  p_description text,
  p_category text,
  p_level text,
  p_is_free boolean,
  p_price_amount numeric,
  p_price_currency text default 'NGN'
)
returns table (
  course_id bigint,
  slug text,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_title text := btrim(p_title);
  normalized_summary text := btrim(p_summary);
  normalized_description text := btrim(p_description);
  normalized_category text := btrim(p_category);
  normalized_level text := btrim(p_level);
  normalized_currency text := upper(btrim(coalesce(p_price_currency, '')));
  normalized_price numeric;
  slug_base text;
  candidate_slug text;
  attempt integer := 2;
  created_course_id bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if normalized_title is null
     or normalized_summary is null
     or normalized_description is null
     or char_length(normalized_title) not between 3 and 160
     or char_length(normalized_summary) not between 10 and 320
     or char_length(normalized_description) not between 40 and 10000 then
    raise exception 'Course metadata does not meet the required length limits' using errcode = '22023';
  end if;

  if normalized_category is null or normalized_category not in (
    'Data Analytics', 'Business', 'Data Science', 'Business Intelligence',
    'Programming', 'Web Development', 'Cybersecurity', 'Digital Marketing',
    'Creative Skills', 'Digital Skills', 'Productivity'
  ) then
    raise exception 'Choose a supported course category' using errcode = '22023';
  end if;

  if normalized_level is null or normalized_level not in ('Beginner', 'Intermediate', 'Beginner to intermediate', 'Beginner to job-ready') then
    raise exception 'Choose a supported course level' using errcode = '22023';
  end if;

  if p_is_free is null or normalized_currency <> 'NGN' then
    raise exception 'Course drafts support NGN pricing only' using errcode = '22023';
  elsif p_is_free then
    normalized_price := 0;
  elsif p_price_amount is null
        or p_price_amount <= 0
        or p_price_amount > 10000000
        or scale(p_price_amount) > 2 then
    raise exception 'Paid drafts require a valid NGN price' using errcode = '22023';
  else
    normalized_price := p_price_amount;
  end if;

  slug_base := trim(both '-' from regexp_replace(lower(normalized_title), '[^a-z0-9]+', '-', 'g'));
  if slug_base is null or slug_base = '' then
    raise exception 'Course title cannot produce a safe slug' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(slug_base));
  candidate_slug := slug_base;
  while exists (select 1 from public.learning_courses as course where course.slug = candidate_slug) loop
    candidate_slug := slug_base || '-' || attempt;
    attempt := attempt + 1;
  end loop;

  insert into public.learning_courses (
    instructor_id, title, slug, summary, description, category, level,
    price_amount, price_currency, is_free, is_limited_time_free, status
  ) values (
    auth.uid(), normalized_title, candidate_slug, normalized_summary,
    normalized_description, normalized_category, normalized_level,
    normalized_price, 'NGN', p_is_free, false, 'draft'
  )
  returning id into created_course_id;

  return query
  select created_course_id, candidate_slug, 'draft'::text;
end;
$$;

create function public.update_instructor_course_draft(
  p_course_id bigint,
  p_title text,
  p_summary text,
  p_description text,
  p_category text,
  p_level text,
  p_is_free boolean,
  p_price_amount numeric,
  p_price_currency text default 'NGN'
)
returns table (
  course_id bigint,
  updated_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_title text := btrim(p_title);
  normalized_summary text := btrim(p_summary);
  normalized_description text := btrim(p_description);
  normalized_category text := btrim(p_category);
  normalized_level text := btrim(p_level);
  normalized_currency text := upper(btrim(coalesce(p_price_currency, '')));
  normalized_price numeric;
  changed_at timestamptz;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if normalized_title is null
     or normalized_summary is null
     or normalized_description is null
     or char_length(normalized_title) not between 3 and 160
     or char_length(normalized_summary) not between 10 and 320
     or char_length(normalized_description) not between 40 and 10000 then
    raise exception 'Course metadata does not meet the required length limits' using errcode = '22023';
  end if;

  if normalized_category is null or normalized_category not in (
    'Data Analytics', 'Business', 'Data Science', 'Business Intelligence',
    'Programming', 'Web Development', 'Cybersecurity', 'Digital Marketing',
    'Creative Skills', 'Digital Skills', 'Productivity'
  ) then
    raise exception 'Choose a supported course category' using errcode = '22023';
  end if;

  if normalized_level is null or normalized_level not in ('Beginner', 'Intermediate', 'Beginner to intermediate', 'Beginner to job-ready') then
    raise exception 'Choose a supported course level' using errcode = '22023';
  end if;

  if p_is_free is null or normalized_currency <> 'NGN' then
    raise exception 'Course drafts support NGN pricing only' using errcode = '22023';
  elsif p_is_free then
    normalized_price := 0;
  elsif p_price_amount is null
        or p_price_amount <= 0
        or p_price_amount > 10000000
        or scale(p_price_amount) > 2 then
    raise exception 'Paid drafts require a valid NGN price' using errcode = '22023';
  else
    normalized_price := p_price_amount;
  end if;

  update public.learning_courses as course
  set title = normalized_title,
      summary = normalized_summary,
      description = normalized_description,
      category = normalized_category,
      level = normalized_level,
      is_free = p_is_free,
      price_amount = normalized_price,
      price_currency = 'NGN',
      is_limited_time_free = false,
      updated_at = now()
  where course.id = p_course_id
    and course.instructor_id = auth.uid()
    and course.status = 'draft'
  returning course.updated_at into changed_at;

  if not found then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  return query
  select p_course_id, changed_at, 'draft'::text;
end;
$$;

create function public.list_own_instructor_courses(
  p_limit integer default 20,
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
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if p_limit not between 1 and 50 or p_offset < 0 then
    raise exception 'Invalid course list pagination' using errcode = '22023';
  end if;

  return query
  select course.id,
         course.title,
         course.summary,
         course.category,
         course.level,
         course.is_free,
         course.price_amount,
         course.price_currency,
         course.status,
         course.updated_at
  from public.learning_courses as course
  where course.instructor_id = auth.uid()
  order by course.updated_at desc, course.id desc
  limit p_limit offset p_offset;
end;
$$;

create function public.get_own_instructor_course(p_course_id bigint)
returns table (
  course_id bigint,
  title text,
  slug text,
  summary text,
  description text,
  category text,
  level text,
  is_free boolean,
  price_amount numeric,
  price_currency text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  return query
  select course.id,
         course.title,
         course.slug,
         course.summary,
         course.description,
         course.category,
         course.level,
         course.is_free,
         course.price_amount,
         course.price_currency,
         course.status,
         course.created_at,
         course.updated_at
  from public.learning_courses as course
  where course.id = p_course_id
    and course.instructor_id = auth.uid();
end;
$$;

revoke execute on function public.create_instructor_course_draft(text, text, text, text, text, boolean, numeric, text) from public, anon, authenticated;
revoke execute on function public.update_instructor_course_draft(bigint, text, text, text, text, text, boolean, numeric, text) from public, anon, authenticated;
revoke execute on function public.list_own_instructor_courses(integer, integer) from public, anon, authenticated;
revoke execute on function public.get_own_instructor_course(bigint) from public, anon, authenticated;

grant execute on function public.create_instructor_course_draft(text, text, text, text, text, boolean, numeric, text) to authenticated;
grant execute on function public.update_instructor_course_draft(bigint, text, text, text, text, text, boolean, numeric, text) to authenticated;
grant execute on function public.list_own_instructor_courses(integer, integer) to authenticated;
grant execute on function public.get_own_instructor_course(bigint) to authenticated;

commit;
