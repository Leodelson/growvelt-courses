-- Growvelt Learning Phase 2B-B: secure free-course enrollment and own-access reads.

begin;

do $$
begin
  if to_regclass('public.enrollments') is null
     or to_regclass('public.learning_courses') is null
     or to_regclass('public.course_modules') is null
     or to_regclass('public.lessons') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Course enrollment aborted: expected Learning relations are missing';
  end if;
  if exists (select 1 from pg_class as relation_row join pg_namespace as namespace_row on namespace_row.oid = relation_row.relnamespace where namespace_row.nspname = 'public' and relation_row.relname in ('enrollments', 'learning_courses', 'course_modules', 'lessons', 'profiles') and not relation_row.relrowsecurity) then
    raise exception 'Course enrollment aborted: RLS must remain enabled on Learning relations';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'learner_id' and data_type = 'uuid')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'course_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'status' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'enrolled_at' and data_type = 'timestamp with time zone')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'enrollments' and column_name = 'completed_at' and data_type = 'timestamp with time zone' and is_nullable = 'YES')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'instructor_id' and data_type = 'uuid')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'slug' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'title' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'summary' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'description' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'category' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'level' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'is_free' and data_type = 'boolean')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_amount' and data_type = 'numeric')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'price_currency' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'is_limited_time_free' and data_type = 'boolean')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_courses' and column_name = 'status' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'course_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'title' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'position' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'course_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'module_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'title' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'lesson_type' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'is_preview' and data_type = 'boolean')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'position' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name' and data_type = 'text') then
    raise exception 'Course enrollment aborted: expected enrollment shape is missing';
  end if;
  if not exists (
    select 1
    from pg_constraint as constraint_row
    join pg_index as index_row on index_row.indexrelid = constraint_row.conindid
    where constraint_row.conrelid = 'public.enrollments'::regclass
      and constraint_row.contype = 'u'
      and index_row.indisunique
      and index_row.indnkeyatts = 2
      and index_row.indnatts = 2
      and index_row.indpred is null
      and index_row.indexprs is null
      and (
        select array_agg(attribute.attname::text order by key_column.ordinality)
        from unnest(index_row.indkey) with ordinality as key_column(attnum, ordinality)
        join pg_attribute as attribute
          on attribute.attrelid = index_row.indrelid
         and attribute.attnum = key_column.attnum
        where key_column.ordinality <= index_row.indnkeyatts
      ) = array['learner_id', 'course_id']::text[]
  ) then
    raise exception 'Course enrollment aborted: enrollment uniqueness is missing';
  end if;
  if not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.enrollments'::regclass
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) ilike '%status%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%active%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%completed%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%cancelled%'
  ) then
    raise exception 'Course enrollment aborted: expected active/completed/cancelled enrollment lifecycle is missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'enrollments' and policyname = 'Learners can read own enrollments')
     or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'enrollments' and policyname = 'Learners can create own enrollments') then
    raise exception 'Course enrollment aborted: expected hardened enrollment policies are missing';
  end if;
  if to_regprocedure('public.enroll_in_free_learning_course(bigint)') is null
     or not exists (
       select 1
       from pg_proc as routine_row
       where routine_row.oid = 'public.enroll_in_free_learning_course(bigint)'::regprocedure
         and routine_row.prosecdef
         and pg_get_function_result(routine_row.oid) = 'TABLE(enrollment_id bigint, enrollment_status text)'
         and routine_row.proconfig is not null
         and exists (
           select 1
           from unnest(routine_row.proconfig) as config_row(setting)
           where config_row.setting in ('search_path=', 'search_path=""')
         )
     )
     or has_function_privilege('public', 'public.enroll_in_free_learning_course(bigint)', 'EXECUTE')
     or has_function_privilege('anon', 'public.enroll_in_free_learning_course(bigint)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.enroll_in_free_learning_course(bigint)', 'EXECUTE') then
    raise exception 'Course enrollment aborted: free enrollment RPC is not hardened';
  end if;
  if has_table_privilege('public', 'public.enrollments', 'INSERT')
     or has_table_privilege('anon', 'public.enrollments', 'INSERT')
     or has_table_privilege('authenticated', 'public.enrollments', 'INSERT')
     or has_table_privilege('public', 'public.enrollments', 'DELETE')
     or has_table_privilege('anon', 'public.enrollments', 'DELETE')
     or has_table_privilege('authenticated', 'public.enrollments', 'DELETE')
     or exists (
       select 1
       from pg_attribute as attribute_row
       where attribute_row.attrelid = 'public.enrollments'::regclass
         and attribute_row.attnum > 0
         and not attribute_row.attisdropped
         and (
           has_column_privilege('public', 'public.enrollments', attribute_row.attname::text, 'INSERT')
           or has_column_privilege('anon', 'public.enrollments', attribute_row.attname::text, 'INSERT')
           or has_column_privilege('authenticated', 'public.enrollments', attribute_row.attname::text, 'INSERT')
         )
     ) then
    raise exception 'Course enrollment aborted: unexpected browser enrollment INSERT or DELETE grant exists';
  end if;
  if has_table_privilege('public', 'public.enrollments', 'UPDATE')
     or has_table_privilege('anon', 'public.enrollments', 'UPDATE')
     or has_table_privilege('authenticated', 'public.enrollments', 'UPDATE')
     or exists (
       select 1
       from pg_attribute as attribute_row
       where attribute_row.attrelid = 'public.enrollments'::regclass
         and attribute_row.attnum > 0
         and not attribute_row.attisdropped
         and (
           has_column_privilege('public', 'public.enrollments', attribute_row.attname::text, 'UPDATE')
           or has_column_privilege('anon', 'public.enrollments', attribute_row.attname::text, 'UPDATE')
           or has_column_privilege('authenticated', 'public.enrollments', attribute_row.attname::text, 'UPDATE')
         )
     ) then
    raise notice 'Course enrollment: removing reviewed legacy browser UPDATE grants from public.enrollments';
  end if;
  if to_regprocedure('public.get_own_learning_enrollment_state(bigint)') is not null or to_regprocedure('public.list_own_learning_enrollments(integer,integer)') is not null or to_regprocedure('public.get_own_enrolled_learning_course_by_slug(text)') is not null then
    raise exception 'Course enrollment aborted: expected clean Phase 2B-B RPC state is missing';
  end if;
end;
$$;

-- PostgreSQL column grants are independent of table grants. Remove any
-- surviving browser INSERT/UPDATE grants without affecting own-row SELECT.
do $$
declare
  enrollment_columns text;
begin
  select string_agg(format('%I', attribute_row.attname), ', ' order by attribute_row.attnum)
  into enrollment_columns
  from pg_attribute as attribute_row
  where attribute_row.attrelid = 'public.enrollments'::regclass
    and attribute_row.attnum > 0
    and not attribute_row.attisdropped;

  if enrollment_columns is null then
    raise exception 'Course enrollment aborted: enrollment columns could not be inspected';
  end if;

  revoke insert, update, delete on table public.enrollments from public, anon, authenticated;
  execute format(
    'revoke insert (%1$s), update (%1$s) on table public.enrollments from public, anon, authenticated',
    enrollment_columns
  );
end;
$$;

create or replace function public.enroll_in_free_learning_course(p_course_id bigint)
returns table (enrollment_id bigint, enrollment_status text)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform 1
  from public.learning_courses as course_row
  where course_row.id = p_course_id
    and course_row.status = 'published'
    and course_row.is_free = true
    and coalesce(course_row.price_amount, 0) = 0
    and coalesce(course_row.price_currency, 'NGN') = 'NGN'
    and coalesce(course_row.is_limited_time_free, false) = false
  for share;
  if not found then
    raise exception 'This course is not currently available for free enrollment' using errcode = '22023';
  end if;
  -- enrolled_at intentionally records the first enrollment. Re-activations
  -- retain that timestamp, so My Learning orders by first enrollment.
  insert into public.enrollments (learner_id, course_id, status) values (auth.uid(), p_course_id, 'active')
  on conflict (learner_id, course_id) do update set status = 'active', completed_at = null where enrollments.status in ('cancelled', 'completed');
  return query select enrollment_row.id, enrollment_row.status from public.enrollments as enrollment_row where enrollment_row.learner_id = auth.uid() and enrollment_row.course_id = p_course_id;
end;
$$;

create function public.get_own_learning_enrollment_state(p_course_id bigint)
returns table (is_enrolled boolean, enrollment_status text, enrolled_at timestamptz)
language plpgsql security definer stable set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return query select coalesce(enrollment_row.status = 'active', false), enrollment_row.status, enrollment_row.enrolled_at
  from public.learning_courses as course_row
  left join public.enrollments as enrollment_row on enrollment_row.course_id = course_row.id and enrollment_row.learner_id = auth.uid()
  where course_row.id = p_course_id and course_row.status = 'published';
end;
$$;

create function public.list_own_learning_enrollments(p_limit integer default 24, p_offset integer default 0)
returns table (course_id bigint, slug text, title text, summary text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamptz)
language plpgsql security definer stable set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_limit not between 1 and 36 or p_offset < 0 then raise exception 'Invalid enrollment pagination' using errcode = '22023'; end if;
  return query select course_row.id, course_row.slug, course_row.title, course_row.summary, course_row.category, course_row.level, course_row.is_free, profile_row.full_name, enrollment_row.enrolled_at
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  where enrollment_row.learner_id = auth.uid() and enrollment_row.status = 'active'
  order by enrollment_row.enrolled_at desc, enrollment_row.id desc limit p_limit offset p_offset;
end;
$$;

create function public.get_own_enrolled_learning_course_by_slug(p_slug text)
returns table (course_id bigint, slug text, course_title text, summary text, description text, category text, level text, is_free boolean, instructor_name text, enrolled_at timestamptz, module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, is_preview boolean)
language plpgsql security definer stable set search_path = ''
as $$
declare normalized_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then raise exception 'Invalid enrolled course reference' using errcode = '22023'; end if;
  return query select course_row.id, course_row.slug, course_row.title, course_row.summary, course_row.description, course_row.category, course_row.level, course_row.is_free, profile_row.full_name, enrollment_row.enrolled_at, module_row.id, module_row.title, module_row.position, lesson_row.id, lesson_row.title, lesson_row.lesson_type, lesson_row.is_preview
  from public.enrollments as enrollment_row
  join public.learning_courses as course_row on course_row.id = enrollment_row.course_id and course_row.status = 'published'
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  left join public.course_modules as module_row on module_row.course_id = course_row.id
  left join public.lessons as lesson_row on lesson_row.course_id = course_row.id and lesson_row.module_id = module_row.id
  where enrollment_row.learner_id = auth.uid() and enrollment_row.status = 'active' and course_row.slug = normalized_slug
  order by module_row.position nulls last, module_row.id, lesson_row.position nulls last, lesson_row.id;
end;
$$;

revoke execute on function public.enroll_in_free_learning_course(bigint), public.get_own_learning_enrollment_state(bigint), public.list_own_learning_enrollments(integer, integer), public.get_own_enrolled_learning_course_by_slug(text) from public, anon, authenticated;
grant execute on function public.enroll_in_free_learning_course(bigint), public.get_own_learning_enrollment_state(bigint), public.list_own_learning_enrollments(integer, integer), public.get_own_enrolled_learning_course_by_slug(text) to authenticated;

do $$ begin
  if has_table_privilege('public', 'public.enrollments', 'INSERT') or has_table_privilege('anon', 'public.enrollments', 'INSERT') or has_table_privilege('authenticated', 'public.enrollments', 'INSERT') or has_table_privilege('public', 'public.enrollments', 'UPDATE') or has_table_privilege('anon', 'public.enrollments', 'UPDATE') or has_table_privilege('authenticated', 'public.enrollments', 'UPDATE') or has_table_privilege('public', 'public.enrollments', 'DELETE') or has_table_privilege('anon', 'public.enrollments', 'DELETE') or has_table_privilege('authenticated', 'public.enrollments', 'DELETE') or not has_table_privilege('authenticated', 'public.enrollments', 'SELECT') or not has_table_privilege('service_role', 'public.enrollments', 'SELECT') or not has_table_privilege('service_role', 'public.enrollments', 'INSERT') or not has_table_privilege('service_role', 'public.enrollments', 'UPDATE') or not has_table_privilege('service_role', 'public.enrollments', 'DELETE') or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'enrollments' and policyname = 'Learners can read own enrollments' and cmd = 'SELECT') or exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'enrollments' and cmd in ('INSERT', 'UPDATE', 'ALL')) or exists (
    select 1
    from pg_attribute as attribute_row
    where attribute_row.attrelid = 'public.enrollments'::regclass
      and attribute_row.attnum > 0
      and not attribute_row.attisdropped
      and (
        has_column_privilege('public', 'public.enrollments', attribute_row.attname::text, 'INSERT')
        or has_column_privilege('anon', 'public.enrollments', attribute_row.attname::text, 'INSERT')
        or has_column_privilege('authenticated', 'public.enrollments', attribute_row.attname::text, 'INSERT')
        or has_column_privilege('public', 'public.enrollments', attribute_row.attname::text, 'UPDATE')
        or has_column_privilege('anon', 'public.enrollments', attribute_row.attname::text, 'UPDATE')
        or has_column_privilege('authenticated', 'public.enrollments', attribute_row.attname::text, 'UPDATE')
      )
  ) or has_function_privilege('public', 'public.enroll_in_free_learning_course(bigint)', 'EXECUTE') or has_function_privilege('anon', 'public.enroll_in_free_learning_course(bigint)', 'EXECUTE') or has_function_privilege('public', 'public.get_own_learning_enrollment_state(bigint)', 'EXECUTE') or has_function_privilege('anon', 'public.get_own_learning_enrollment_state(bigint)', 'EXECUTE') or has_function_privilege('public', 'public.list_own_learning_enrollments(integer,integer)', 'EXECUTE') or has_function_privilege('anon', 'public.list_own_learning_enrollments(integer,integer)', 'EXECUTE') or has_function_privilege('public', 'public.get_own_enrolled_learning_course_by_slug(text)', 'EXECUTE') or has_function_privilege('anon', 'public.get_own_enrolled_learning_course_by_slug(text)', 'EXECUTE') or not has_function_privilege('authenticated', 'public.enroll_in_free_learning_course(bigint)', 'EXECUTE') or not has_function_privilege('authenticated', 'public.get_own_learning_enrollment_state(bigint)', 'EXECUTE') or not has_function_privilege('authenticated', 'public.list_own_learning_enrollments(integer,integer)', 'EXECUTE') or not has_function_privilege('authenticated', 'public.get_own_enrolled_learning_course_by_slug(text)', 'EXECUTE') then
    raise exception 'Course enrollment aborted: RPC execution grants are not hardened';
  end if;
end; $$;

commit;
