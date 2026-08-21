create or replace function public.submit_learning_course_for_review (
  p_course_id           bigint,
  p_declaration_version text,
  p_rights_basis        text
)
  returns table (
    course_id         bigint,
    submission_status text,
    submitted_at      timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  course_key bigint;
  submitted_time timestamptz;
  normalized_version text := btrim(p_declaration_version);
  normalized_basis text := lower(btrim(p_rights_basis));
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if normalized_version is distinct from '2026-08-v1'
    or normalized_basis is null
    or normalized_basis not in ('original', 'licensed', 'authorized') then
    raise exception 'A current course-rights declaration is required' using errcode = '22023';
  end if;

  select course_row.id
  into course_key
  from public.learning_courses as course_row
  where course_row.id = p_course_id
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft';

  if course_key is null then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(course_key);

  select course_row.id
  into course_key
  from public.learning_courses as course_row
  where course_row.id = course_key
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft'
  for update;

  if course_key is null then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.learning_courses as course_row
    where course_row.id = course_key
      and char_length(btrim(course_row.title)) between 3 and 160
      and char_length(btrim(course_row.summary)) between 10 and 320
      and char_length(btrim(course_row.description)) between 40 and 10000
      and course_row.category in ('Data Analytics', 'Business', 'Data Science', 'Business Intelligence', 'Programming', 'Web Development', 'Cybersecurity', 'Digital Marketing', 'Creative Skills', 'Digital Skills', 'Productivity')
      and course_row.level in ('Beginner', 'Intermediate', 'Beginner to intermediate', 'Beginner to job-ready')
  ) then
    raise exception 'Complete the required course metadata before submitting' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.learning_courses as course_row
    where course_row.id = course_key
      and course_row.is_free = true
      and coalesce(course_row.price_amount, 0) = 0
      and coalesce(course_row.price_currency, 'NGN') = 'NGN'
      and coalesce(course_row.is_limited_time_free, false) = false
  ) then
    raise exception 'Only free courses can be submitted while secure paid delivery is unavailable' using errcode = '22023';
  end if;

  if not exists (select 1 from public.course_modules as module_row where module_row.course_id = course_key)
    or not exists (select 1 from public.lessons as lesson_row where lesson_row.course_id = course_key) then
    raise exception 'Add at least one module and one lesson before submitting' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.course_modules as module_row
    where module_row.course_id = course_key
      and (module_row.title is null or char_length(btrim(module_row.title)) not between 2 and 160)
  ) then
    raise exception 'Complete every module title before submitting' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.lessons as lesson_row
    left join public.course_modules as module_row
      on module_row.id = lesson_row.module_id
      and module_row.course_id = lesson_row.course_id
    where lesson_row.course_id = course_key
      and (
        module_row.id is null
        or char_length(btrim(lesson_row.title)) not between 2 and 160
        or lesson_row.lesson_type not in ('video', 'text', 'quiz')
        or (
          lesson_row.lesson_type = 'video'
          and (
            lesson_row.content is not null
            or lesson_row.video_provider is distinct from 'youtube'
            or lesson_row.video_reference is null
            or lesson_row.video_reference !~ '^[A-Za-z0-9_-]{11}$'
            or lesson_row.video_visibility not in ('public', 'unlisted')
            or lesson_row.duration_seconds not between 1 and 86400
            or lesson_row.video_url is not null
            or lesson_row.duration_minutes is not null
          )
        )
        or (
          lesson_row.lesson_type = 'text'
          and (
            lesson_row.content is null
            or char_length(btrim(lesson_row.content)) not between 1 and 20000
            or lesson_row.video_provider is not null
            or lesson_row.video_reference is not null
            or lesson_row.video_visibility is not null
            or lesson_row.duration_seconds is not null
            or lesson_row.video_url is not null
            or lesson_row.duration_minutes is not null
          )
        )
      )
  ) then
    raise exception 'Complete every lesson with valid text, YouTube video, or quiz details before submitting' using errcode = '22023';
  end if;

  insert into public.course_rights_declarations (
    course_id,
    instructor_id,
    declaration_version,
    rights_basis
  ) values (
    course_key,
    auth.uid(),
    normalized_version,
    normalized_basis
  );

  update public.learning_courses as course_row
  set status = 'pending_review',
      submitted_at = now(),
      reviewed_at = null,
      reviewed_by = null,
      review_note = null,
      updated_at = now()
  where course_row.id = course_key
    and course_row.instructor_id = auth.uid()
    and course_row.status = 'draft'
  returning course_row.submitted_at into submitted_time;

  if not found then
    raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002';
  end if;

  return query
  select course_key, 'pending_review'::text, submitted_time;
end;
$function$;

grant execute on function "public"."submit_learning_course_for_review"(bigint, text, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."submit_learning_course_for_review"(bigint, text, text) from public;
