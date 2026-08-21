create or replace function public.list_pending_learning_courses (
  p_limit  integer default 20,
  p_offset integer default 0
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
    submitted_at     timestamp with time zone
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;
  if p_limit not between 1 and 50 or p_offset < 0 then
    raise exception 'Invalid course-review pagination' using errcode = '22023';
  end if;

  return query
  select course.id,
         course.title,
         profile.full_name,
         auth_user.email::text,
         course.category,
         course.level,
         course.is_free,
         course.price_amount,
         course.price_currency,
         course.submitted_at
  from public.learning_courses as course
  left join public.profiles as profile on profile.id = course.instructor_id
  left join auth.users as auth_user on auth_user.id = course.instructor_id
  where course.status = 'pending_review'
  order by course.submitted_at desc nulls last, course.id desc
  limit p_limit offset p_offset;
end;
$function$;

grant execute on function "public"."list_pending_learning_courses"(integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_pending_learning_courses"(integer, integer) from public;
