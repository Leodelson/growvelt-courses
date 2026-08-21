create or replace function public.list_own_instructor_courses (
  p_limit  integer default 20,
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
    updated_at     timestamp with time zone
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."list_own_instructor_courses"(integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_own_instructor_courses"(integer, integer) from public;
