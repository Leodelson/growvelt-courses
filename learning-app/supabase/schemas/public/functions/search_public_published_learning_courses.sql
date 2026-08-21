create or replace function public.search_public_published_learning_courses (
  p_query    text    default null::text,
  p_category text    default null::text,
  p_level    text    default null::text,
  p_is_free  boolean default null::boolean,
  p_sort     text    default 'newest'::text,
  p_limit    integer default 12,
  p_offset   integer default 0
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
    published_at    timestamp with time zone,
    total_courses   integer
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
  normalized_sort text := lower(btrim(coalesce(p_sort, 'newest')));
begin
  if normalized_query is not null and char_length(normalized_query) > 120 then
    raise exception 'Invalid catalog search query' using errcode = '22023';
  end if;
  if normalized_category is not null and char_length(normalized_category) > 100 then
    raise exception 'Invalid catalog category filter' using errcode = '22023';
  end if;
  if normalized_level is not null and char_length(normalized_level) > 100 then
    raise exception 'Invalid catalog level filter' using errcode = '22023';
  end if;
  if normalized_sort not in ('newest', 'title_asc', 'title_desc') then
    raise exception 'Invalid catalog sort' using errcode = '22023';
  end if;
  if p_limit not between 1 and 24 or p_offset < 0 then
    raise exception 'Invalid catalog pagination' using errcode = '22023';
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
    course_row.published_at,
    count(*) over ()::integer
  from public.learning_courses as course_row
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  where course_row.status = 'published'
    and (normalized_query is null or position(normalized_query in lower(concat_ws(' ', course_row.title, course_row.summary, course_row.category, course_row.level))) > 0)
    and (normalized_category is null or lower(course_row.category) = normalized_category)
    and (normalized_level is null or lower(course_row.level) = normalized_level)
    and (p_is_free is null or course_row.is_free = p_is_free)
  order by
    case when normalized_sort = 'title_asc' then lower(course_row.title) end asc nulls last,
    case when normalized_sort = 'title_desc' then lower(course_row.title) end desc nulls last,
    case when normalized_sort = 'newest' then course_row.published_at end desc nulls last,
    course_row.id desc
  limit p_limit
  offset p_offset;
end;
$function$;

grant execute
  on function "public"."search_public_published_learning_courses"(text, text, text, boolean, text, integer, integer)
  to "anon", "authenticated", "postgres", "service_role";

revoke all on function "public"."search_public_published_learning_courses"(text, text, text, boolean, text, integer, integer) from public;
