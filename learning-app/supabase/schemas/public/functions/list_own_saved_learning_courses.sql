create or replace function public.list_own_saved_learning_courses (
  p_limit  integer default 48,
  p_offset integer default 0
)
  returns table (
    course_id       bigint,
    slug            text,
    title           text,
    summary         text,
    category        text,
    level           text,
    is_free         boolean,
    price_amount    numeric,
    price_currency  text,
    instructor_name text,
    saved_at        timestamp with time zone
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."list_own_saved_learning_courses"(integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_own_saved_learning_courses"(integer, integer) from public;
