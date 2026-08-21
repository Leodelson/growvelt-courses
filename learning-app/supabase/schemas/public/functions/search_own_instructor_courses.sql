create or replace function public.search_own_instructor_courses (
  p_query  text    default null::text,
  p_status text    default null::text,
  p_limit  integer default 12,
  p_offset integer default 0
)
  returns table (
    course_id      bigint,
    title          text,
    summary        text,
    category       text,
    level          text,
    is_free        boolean,
    price_amount   numeric,
    price_currency text,
    status         text,
    updated_at     timestamp with time zone,
    total_courses  integer
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."search_own_instructor_courses"(text, text, integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."search_own_instructor_courses"(text, text, integer, integer) from public;
