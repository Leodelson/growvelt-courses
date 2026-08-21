create or replace function public.get_own_instructor_course (
  p_course_id bigint
)
  returns table (
    course_id      bigint,
    title          text,
    slug           text,
    summary        text,
    description    text,
    category       text,
    level          text,
    is_free        boolean,
    price_amount   numeric,
    price_currency text,
    status         text,
    created_at     timestamp with time zone,
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
$function$;

grant execute on function "public"."get_own_instructor_course"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_own_instructor_course"(bigint) from public;
