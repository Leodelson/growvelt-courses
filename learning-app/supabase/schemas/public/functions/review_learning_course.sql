create or replace function public.review_learning_course (
  p_course_id   bigint,
  p_decision    text,
  p_review_note text   default null::text
)
  returns table (
    course_id     bigint,
    review_status text,
    reviewed_at   timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."review_learning_course"(bigint, text, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."review_learning_course"(bigint, text, text) from public;
