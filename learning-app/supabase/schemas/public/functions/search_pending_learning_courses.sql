create or replace function public.search_pending_learning_courses (
  p_query    text    default null::text,
  p_category text    default null::text,
  p_level    text    default null::text,
  p_limit    integer default 12,
  p_offset   integer default 0
)
  returns table (
    course_id        bigint,
    course_title     text,
    instructor_name  text,
    instructor_email text,
    category         text,
    level            text,
    is_free          boolean,
    price_amount     numeric,
    price_currency   text,
    submitted_at     timestamp with time zone,
    total_courses    integer
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."search_pending_learning_courses"(text, text, text, integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."search_pending_learning_courses"(text, text, text, integer, integer) from public;
