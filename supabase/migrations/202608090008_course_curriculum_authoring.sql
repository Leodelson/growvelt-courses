-- Growvelt Learning Phase 2A-B: secure draft-course curriculum authoring.
-- Forward-only. This migration intentionally excludes submission, moderation,
-- publishing, payments, enrollment, learner playback, and Storage.

begin;

do $$
begin
  if to_regclass('public.learning_courses') is null
     or to_regclass('public.course_modules') is null
     or to_regclass('public.lessons') is null then
    raise exception 'Curriculum authoring aborted: expected Learning tables are missing';
  end if;

  if not exists (
    select 1
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('learning_courses', 'course_modules', 'lessons')
      and relation.relrowsecurity
    having count(*) = 3
  ) then
    raise exception 'Curriculum authoring aborted: RLS must be enabled on Learning course tables';
  end if;

  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'course_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'title' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'course_modules' and column_name = 'position' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'course_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'module_id' and data_type = 'bigint')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'lesson_type' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'content' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'video_url' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'duration_minutes' and data_type = 'integer')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'is_preview' and data_type = 'boolean')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name = 'position' and data_type = 'integer') then
    raise exception 'Curriculum authoring aborted: curriculum tables are not the expected baseline shape';
  end if;

  if to_regclass('public.course_modules_course_position_key') is null
     or not exists (
       select 1
       from pg_index as index_row
       where index_row.indexrelid = 'public.course_modules_course_position_key'::regclass
         and index_row.indrelid = 'public.course_modules'::regclass
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
         ) = array['course_id', 'position']::text[]
     )
     or to_regclass('public.lessons_course_position_key') is null
     or not exists (
       select 1
       from pg_index as index_row
       where index_row.indexrelid = 'public.lessons_course_position_key'::regclass
         and index_row.indrelid = 'public.lessons'::regclass
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
         ) = array['course_id', 'position']::text[]
     )
     or to_regclass('public.lessons_course_module_position_key') is not null
     or to_regclass('public.course_modules_id_course_id_key') is not null
     or exists (select 1 from pg_constraint where conrelid = 'public.lessons'::regclass and conname = 'lessons_module_course_fkey')
     or exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lessons' and column_name in ('video_provider', 'video_reference', 'video_visibility', 'duration_seconds')) then
    raise exception 'Curriculum authoring aborted: expected legacy ordering indexes or clean replacement names are missing';
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.course_modules'::regclass and contype = 'f' and confrelid = 'public.learning_courses'::regclass and confdeltype = 'c')
     or not exists (select 1 from pg_constraint where conrelid = 'public.lessons'::regclass and contype = 'f' and confrelid = 'public.learning_courses'::regclass and confdeltype = 'c')
     or not exists (
       select 1 from pg_constraint as constraint_row
       where constraint_row.conrelid = 'public.lessons'::regclass
         and constraint_row.contype = 'f'
         and constraint_row.confrelid = 'public.course_modules'::regclass
         and constraint_row.confdeltype = 'c'
         and (
           select array_agg(attribute.attname::text order by key_column.ordinality)
           from unnest(constraint_row.conkey) with ordinality as key_column(attnum, ordinality)
           join pg_attribute as attribute
             on attribute.attrelid = constraint_row.conrelid
            and attribute.attnum = key_column.attnum
         ) = array['module_id']::text[]
         and (
           select array_agg(attribute.attname::text order by key_column.ordinality)
           from unnest(constraint_row.confkey) with ordinality as key_column(attnum, ordinality)
           join pg_attribute as attribute
             on attribute.attrelid = constraint_row.confrelid
            and attribute.attnum = key_column.attnum
         ) = array['id']::text[]
     ) then
    raise exception 'Curriculum authoring aborted: expected curriculum ownership foreign keys are missing';
  end if;

  if exists (select 1 from public.lessons where module_id is null)
     or exists (
       select 1
       from public.lessons as lesson
       join public.course_modules as module on module.id = lesson.module_id
       where lesson.course_id <> module.course_id
     ) then
    raise exception 'Curriculum authoring aborted: every existing lesson must belong to a module in the same course before module-local ordering can be enforced';
  end if;

  if exists (select 1 from public.course_modules where position < 0)
     or exists (select 1 from public.lessons where position < 0) then
    raise exception 'Curriculum authoring aborted: existing curriculum positions must be non-negative';
  end if;

  if not exists (
    select 1 from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.lessons'::regclass
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) like '%lesson_type%'
      and pg_get_constraintdef(constraint_row.oid) like '%video%'
      and pg_get_constraintdef(constraint_row.oid) like '%text%'
  ) then
    raise exception 'Curriculum authoring aborted: expected lesson type constraint is missing';
  end if;

  if not exists (select 1 from pg_policy where polrelid = 'public.course_modules'::regclass and polname = 'Published course modules are public')
     or not exists (select 1 from pg_policy where polrelid = 'public.lessons'::regclass and polname = 'Published course preview lessons are public') then
    raise exception 'Curriculum authoring aborted: expected published curriculum reader policies are missing';
  end if;

  if to_regprocedure('public.is_approved_growvelt_instructor()') is null
     or not exists (select 1 from pg_proc where oid = 'public.is_approved_growvelt_instructor()'::regprocedure and prosecdef)
     or has_function_privilege('anon', 'public.is_approved_growvelt_instructor()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.is_approved_growvelt_instructor()', 'EXECUTE') then
    raise exception 'Curriculum authoring aborted: approved Instructor helper does not match the hardened baseline';
  end if;

  if to_regprocedure('public.get_own_instructor_course(bigint)') is null
     or to_regprocedure('public.get_own_instructor_curriculum(bigint)') is not null
     or to_regprocedure('public.add_instructor_course_module(bigint,text)') is not null
     or to_regprocedure('public.update_instructor_course_module(bigint,text)') is not null
     or to_regprocedure('public.delete_instructor_course_module(bigint)') is not null
     or to_regprocedure('public.move_instructor_course_module(bigint,text)') is not null
     or to_regprocedure('public.add_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean)') is not null
     or to_regprocedure('public.update_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean)') is not null
     or to_regprocedure('public.delete_instructor_course_lesson(bigint)') is not null
     or to_regprocedure('public.move_instructor_course_lesson(bigint,text)') is not null then
    raise exception 'Curriculum authoring aborted: expected Phase 2A-A baseline or clean Phase 2A-B RPC state is missing';
  end if;
end;
$$;

-- Ordering invariant: module positions are unique within a course; lesson
-- positions are unique within a module. Deletes retain gaps deliberately;
-- append and neighbour-based moves remain deterministic under the course lock.
create unique index course_modules_id_course_id_key
  on public.course_modules (id, course_id);

alter table public.lessons
  alter column module_id set not null,
  add constraint lessons_module_course_fkey
    foreign key (module_id, course_id)
    references public.course_modules (id, course_id)
    on delete cascade;

drop index public.lessons_course_position_key;

create unique index lessons_course_module_position_key
  on public.lessons (course_id, module_id, position);

alter table public.lessons
  add column video_provider text,
  add column video_reference text,
  add column video_visibility text,
  add column duration_seconds integer,
  add constraint lessons_video_provider_check check (video_provider is null or video_provider in ('youtube')),
  add constraint lessons_video_visibility_check check (video_visibility is null or video_visibility in ('public', 'unlisted', 'private')),
  add constraint lessons_duration_seconds_check check (duration_seconds is null or duration_seconds between 1 and 86400),
  add constraint lessons_video_reference_check check (video_reference is null or video_reference ~ '^[A-Za-z0-9_-]{11}$'),
  add constraint lessons_video_reference_pair_check check ((video_provider is null and video_reference is null) or (video_provider is not null and video_reference is not null));

-- Browser roles retain read access through existing RLS policies, but all
-- curriculum mutation is now exclusively through the narrow RPCs below.
do $$
declare
  target_table text;
  columns_list text;
begin
  foreach target_table in array array['course_modules', 'lessons'] loop
    execute format('revoke insert, update, delete on table public.%I from public, anon, authenticated', target_table);
    select string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum)
      into columns_list
    from pg_attribute as attribute
    where attribute.attrelid = format('public.%I', target_table)::regclass
      and attribute.attnum > 0 and not attribute.attisdropped;
    execute format('revoke insert (%1$s), update (%1$s) on table public.%2$I from public, anon, authenticated', columns_list, target_table);
    if exists (
         select 1
         from pg_class as relation
         cross join lateral aclexplode(relation.relacl) as table_acl
         where relation.oid = format('public.%I', target_table)::regclass
           and relation.relacl is not null
           and table_acl.grantee = 0
           and table_acl.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
       )
       or has_table_privilege('anon', format('public.%I', target_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', target_table), 'INSERT')
       or has_table_privilege('anon', format('public.%I', target_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', target_table), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', target_table), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', target_table), 'DELETE') then
      raise exception 'Curriculum authoring aborted: browser mutation grant remains on public.%', target_table;
    end if;
    if exists (
      select 1
      from pg_attribute as attribute
      where attribute.attrelid = format('public.%I', target_table)::regclass
        and attribute.attnum > 0
        and not attribute.attisdropped
        and (
          exists (
            select 1
            from pg_attribute as public_attribute
            cross join lateral aclexplode(public_attribute.attacl) as column_acl
            where public_attribute.attrelid = format('public.%I', target_table)::regclass
              and public_attribute.attnum = attribute.attnum
              and public_attribute.attacl is not null
              and column_acl.grantee = 0
              and column_acl.privilege_type in ('INSERT', 'UPDATE')
          )
          or has_column_privilege('anon', format('public.%I', target_table), attribute.attname, 'INSERT')
          or has_column_privilege('authenticated', format('public.%I', target_table), attribute.attname, 'INSERT')
          or has_column_privilege('anon', format('public.%I', target_table), attribute.attname, 'UPDATE')
          or has_column_privilege('authenticated', format('public.%I', target_table), attribute.attname, 'UPDATE')
        )
    ) then
      raise exception 'Curriculum authoring aborted: browser column mutation grant remains on public.%', target_table;
    end if;
  end loop;
end;
$$;

create or replace function public.get_own_instructor_curriculum(p_course_id bigint)
returns table (module_id bigint, module_title text, module_position integer, lesson_id bigint, lesson_title text, lesson_type text, lesson_content text, video_provider text, video_reference text, video_visibility text, duration_seconds integer, is_preview boolean, lesson_position integer)
language plpgsql security definer stable set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if not exists (select 1 from public.learning_courses as course where course.id = p_course_id and course.instructor_id = auth.uid()) then raise exception 'Course not found' using errcode = 'P0002'; end if;
  return query select module.id, module.title, module.position, lesson.id, lesson.title, lesson.lesson_type, lesson.content, lesson.video_provider, lesson.video_reference, lesson.video_visibility, lesson.duration_seconds, lesson.is_preview, lesson.position
    from public.course_modules as module left join public.lessons as lesson on lesson.module_id = module.id and lesson.course_id = p_course_id
    where module.course_id = p_course_id order by module.position, module.id, lesson.position, lesson.id;
end;
$$;

create function public.add_instructor_course_module(p_course_id bigint, p_title text)
returns table (module_id bigint, title text, module_position integer)
language plpgsql security definer set search_path = '' as $$
declare normalized_title text := btrim(p_title); next_position integer; created_id bigint; course_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if normalized_title is null or char_length(normalized_title) not between 2 and 160 then raise exception 'Module title must be between 2 and 160 characters' using errcode = '22023'; end if;
  select course.id into course_key from public.learning_courses as course where course.id = p_course_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  if not exists (select 1 from public.learning_courses as course where course.id = course_key and course.instructor_id = auth.uid() and course.status = 'draft') then raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002'; end if;
  select coalesce(max(module.position), 0) + 1 into next_position from public.course_modules as module where module.course_id = course_key;
  insert into public.course_modules (course_id, title, position) values (course_key, normalized_title, next_position) returning id into created_id;
  return query select created_id as module_id, normalized_title as title, next_position as module_position;
end;
$$;

create function public.update_instructor_course_module(p_module_id bigint, p_title text)
returns table (module_id bigint, title text)
language plpgsql security definer set search_path = '' as $$
declare normalized_title text := btrim(p_title);
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if normalized_title is null or char_length(normalized_title) not between 2 and 160 then raise exception 'Module title must be between 2 and 160 characters' using errcode = '22023'; end if;
  update public.course_modules as module set title = normalized_title from public.learning_courses as course where module.id = p_module_id and course.id = module.course_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if not found then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  return query select p_module_id, normalized_title;
end;
$$;

create function public.delete_instructor_course_module(p_module_id bigint)
returns table (deleted_module_id bigint, deleted_lesson_count integer)
language plpgsql security definer set search_path = '' as $$
declare child_count integer; course_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  select course.id into course_key from public.course_modules as module join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  if not exists (select 1 from public.course_modules as module join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft') then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  select count(*) into child_count from public.lessons as lesson join public.course_modules as module on module.id = lesson.module_id join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft';
  delete from public.course_modules as module using public.learning_courses as course where module.id = p_module_id and course.id = module.course_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if not found then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  return query select p_module_id, child_count;
end;
$$;

create function public.move_instructor_course_module(p_module_id bigint, p_direction text)
returns table (module_id bigint, module_position integer)
language plpgsql security definer set search_path = '' as $$
declare course_key bigint; current_position integer; neighbor_id bigint; neighbor_position integer;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if p_direction is null or p_direction not in ('up','down') then raise exception 'Unsupported move direction' using errcode = '22023'; end if;
  select course.id into course_key from public.course_modules as module join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  select module.course_id, module.position into course_key, current_position from public.course_modules as module join public.learning_courses as course on course.id = module.course_id where module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft' for update of module;
  if not found then raise exception 'Draft module not found or is no longer editable' using errcode = 'P0002'; end if;
  if p_direction = 'up' then select module.id, module.position into neighbor_id, neighbor_position from public.course_modules as module where module.course_id = course_key and module.position < current_position order by module.position desc limit 1 for update; else select module.id, module.position into neighbor_id, neighbor_position from public.course_modules as module where module.course_id = course_key and module.position > current_position order by module.position limit 1 for update; end if;
  if neighbor_id is null then return query select p_module_id as module_id, current_position as module_position; return; end if;
  if exists (select 1 from public.course_modules where course_id = course_key and position = -2147483648) then
    raise exception 'Curriculum authoring cannot safely reorder this course' using errcode = '55000';
  end if;
  update public.course_modules set position = -2147483648 where id = p_module_id;
  update public.course_modules set position = current_position where id = neighbor_id;
  update public.course_modules set position = neighbor_position where id = p_module_id;
  return query select p_module_id as module_id, neighbor_position as module_position;
end;
$$;

create function public.add_instructor_course_lesson(p_course_id bigint, p_module_id bigint, p_title text, p_lesson_type text, p_content text, p_video_provider text, p_video_reference text, p_video_visibility text, p_duration_seconds integer, p_is_preview boolean)
returns table (lesson_id bigint, lesson_position integer)
language plpgsql security definer set search_path = '' as $$
declare normalized_title text := btrim(p_title); normalized_content text := nullif(btrim(p_content), ''); next_position integer; created_id bigint; course_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if normalized_title is null or char_length(normalized_title) not between 2 and 160 or p_lesson_type is null or p_lesson_type not in ('video','text') then raise exception 'Lesson title or type is invalid' using errcode = '22023'; end if;
  select course.id into course_key from public.learning_courses as course join public.course_modules as module on module.course_id = course.id where course.id = p_course_id and module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft course or module not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  if not exists (select 1 from public.learning_courses as course join public.course_modules as module on module.course_id = course.id where course.id = course_key and module.id = p_module_id and course.instructor_id = auth.uid() and course.status = 'draft') then raise exception 'Draft course or module not found' using errcode = 'P0002'; end if;
  if p_lesson_type = 'video' and (p_video_provider is distinct from 'youtube' or p_video_reference is null or p_video_reference !~ '^[A-Za-z0-9_-]{11}$' or p_video_visibility is null or p_video_visibility not in ('public', 'unlisted') or p_duration_seconds is null or p_duration_seconds not between 1 and 86400) then raise exception 'Video lessons require a valid YouTube reference, visibility, and duration' using errcode = '22023'; end if;
  if p_lesson_type = 'text' and (normalized_content is null or char_length(normalized_content) not between 1 and 20000) then raise exception 'Text lessons require plain lesson content' using errcode = '22023'; end if;
  select coalesce(max(lesson.position), 0) + 1 into next_position from public.lessons as lesson where lesson.course_id = course_key and lesson.module_id = p_module_id;
  insert into public.lessons (course_id,module_id,title,lesson_type,content,video_url,video_provider,video_reference,video_visibility,duration_seconds,duration_minutes,is_preview,position) values (course_key,p_module_id,normalized_title,p_lesson_type,case when p_lesson_type='text' then normalized_content else null end,null,case when p_lesson_type='video' then 'youtube' else null end,case when p_lesson_type='video' then p_video_reference else null end,case when p_lesson_type='video' then p_video_visibility else null end,case when p_lesson_type='video' then p_duration_seconds else null end,null,coalesce(p_is_preview,false),next_position) returning id into created_id;
  return query select created_id as lesson_id, next_position as lesson_position;
end;
$$;

create function public.update_instructor_course_lesson(p_lesson_id bigint, p_module_id bigint, p_title text, p_lesson_type text, p_content text, p_video_provider text, p_video_reference text, p_video_visibility text, p_duration_seconds integer, p_is_preview boolean)
returns table (lesson_id bigint)
language plpgsql security definer set search_path = '' as $$
declare course_key bigint; current_module_id bigint; current_position integer; next_position integer; normalized_title text := btrim(p_title); normalized_content text := nullif(btrim(p_content), '');
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  if normalized_title is null or char_length(normalized_title) not between 2 and 160 or p_lesson_type is null or p_lesson_type not in ('video','text') then raise exception 'Lesson title or type is invalid' using errcode = '22023'; end if;
  select course.id into course_key from public.lessons as lesson join public.learning_courses as course on course.id = lesson.course_id join public.course_modules as destination_module on destination_module.id = p_module_id and destination_module.course_id = course.id where lesson.id = p_lesson_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft lesson or module not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  select lesson.course_id, lesson.module_id, lesson.position into course_key, current_module_id, current_position from public.lessons as lesson join public.learning_courses as course on course.id=lesson.course_id where lesson.id=p_lesson_id and course.instructor_id=auth.uid() and course.status='draft' for update of lesson;
  if not found or not exists (select 1 from public.course_modules as module where module.id=p_module_id and module.course_id=course_key) then raise exception 'Draft lesson or module not found' using errcode = 'P0002'; end if;
  if p_lesson_type='video' and (p_video_provider is distinct from 'youtube' or p_video_reference is null or p_video_reference !~ '^[A-Za-z0-9_-]{11}$' or p_video_visibility is null or p_video_visibility not in ('public', 'unlisted') or p_duration_seconds is null or p_duration_seconds not between 1 and 86400) then raise exception 'Video lessons require a valid YouTube reference, visibility, and duration' using errcode='22023'; end if;
  if p_lesson_type='text' and (normalized_content is null or char_length(normalized_content) not between 1 and 20000) then raise exception 'Text lessons require plain lesson content' using errcode='22023'; end if;
  if current_module_id is distinct from p_module_id then
    select coalesce(max(lesson.position), 0) + 1 into next_position from public.lessons as lesson where lesson.course_id = course_key and lesson.module_id = p_module_id;
  else
    next_position := current_position;
  end if;
  update public.lessons set module_id=p_module_id,title=normalized_title,lesson_type=p_lesson_type,content=case when p_lesson_type='text' then normalized_content else null end,video_url=null,video_provider=case when p_lesson_type='video' then 'youtube' else null end,video_reference=case when p_lesson_type='video' then p_video_reference else null end,video_visibility=case when p_lesson_type='video' then p_video_visibility else null end,duration_seconds=case when p_lesson_type='video' then p_duration_seconds else null end,duration_minutes=null,is_preview=coalesce(p_is_preview,false),position=next_position,updated_at=now() where id=p_lesson_id;
  return query select p_lesson_id;
end;
$$;

create function public.delete_instructor_course_lesson(p_lesson_id bigint)
returns table (deleted_lesson_id bigint)
language plpgsql security definer set search_path = '' as $$
declare course_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode = '42501'; end if;
  select course.id into course_key from public.lessons as lesson join public.learning_courses as course on course.id = lesson.course_id where lesson.id = p_lesson_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  if not exists (select 1 from public.lessons as lesson join public.learning_courses as course on course.id = lesson.course_id where lesson.id = p_lesson_id and course.id = course_key and course.instructor_id = auth.uid() and course.status = 'draft') then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  delete from public.lessons as lesson using public.learning_courses as course where lesson.id=p_lesson_id and course.id=lesson.course_id and course.instructor_id=auth.uid() and course.status='draft';
  if not found then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  return query select p_lesson_id;
end;
$$;

create function public.move_instructor_course_lesson(p_lesson_id bigint, p_direction text)
returns table (lesson_id bigint, lesson_position integer)
language plpgsql security definer set search_path = '' as $$
declare course_key bigint; module_key bigint; current_position integer; neighbor_id bigint; neighbor_position integer;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then raise exception 'Approved Instructor capability required' using errcode='42501'; end if;
  if p_direction is null or p_direction not in ('up','down') then raise exception 'Unsupported move direction' using errcode='22023'; end if;
  select course.id into course_key from public.lessons as lesson join public.learning_courses as course on course.id = lesson.course_id where lesson.id = p_lesson_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(course_key);
  select lesson.course_id,lesson.module_id,lesson.position into course_key,module_key,current_position from public.lessons as lesson join public.learning_courses as course on course.id=lesson.course_id where lesson.id=p_lesson_id and course.instructor_id=auth.uid() and course.status='draft' for update of lesson;
  if not found then raise exception 'Draft lesson not found or is no longer editable' using errcode='P0002'; end if;
  if p_direction='up' then select lesson.id,lesson.position into neighbor_id,neighbor_position from public.lessons as lesson where lesson.course_id=course_key and lesson.module_id=module_key and lesson.position<current_position order by lesson.position desc limit 1 for update; else select lesson.id,lesson.position into neighbor_id,neighbor_position from public.lessons as lesson where lesson.course_id=course_key and lesson.module_id=module_key and lesson.position>current_position order by lesson.position limit 1 for update; end if;
  if neighbor_id is null then return query select p_lesson_id as lesson_id, current_position as lesson_position; return; end if;
  if exists (select 1 from public.lessons where course_id = course_key and module_id = module_key and position = -2147483648) then
    raise exception 'Curriculum authoring cannot safely reorder this course' using errcode = '55000';
  end if;
  update public.lessons set position=-2147483648 where id=p_lesson_id;
  update public.lessons set position=current_position where id=neighbor_id;
  update public.lessons set position=neighbor_position where id=p_lesson_id;
  return query select p_lesson_id as lesson_id, neighbor_position as lesson_position;
end;
$$;

revoke execute on function public.get_own_instructor_curriculum(bigint), public.add_instructor_course_module(bigint,text), public.update_instructor_course_module(bigint,text), public.delete_instructor_course_module(bigint), public.move_instructor_course_module(bigint,text), public.add_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean), public.update_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean), public.delete_instructor_course_lesson(bigint), public.move_instructor_course_lesson(bigint,text) from public, anon, authenticated;
grant execute on function public.get_own_instructor_curriculum(bigint), public.add_instructor_course_module(bigint,text), public.update_instructor_course_module(bigint,text), public.delete_instructor_course_module(bigint), public.move_instructor_course_module(bigint,text), public.add_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean), public.update_instructor_course_lesson(bigint,bigint,text,text,text,text,text,text,integer,boolean), public.delete_instructor_course_lesson(bigint), public.move_instructor_course_lesson(bigint,text) to authenticated;

commit;
