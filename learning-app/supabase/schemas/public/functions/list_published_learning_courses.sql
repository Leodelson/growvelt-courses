create or replace function public.list_published_learning_courses (
  p_limit  integer default 24,
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
    published_at    timestamp with time zone
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_limit not between 1 and 36 or p_offset<0 then raise exception 'Invalid published-course pagination' using errcode='22023'; end if;
  return query select c.id,c.slug,c.title,c.summary,c.category,c.level,c.is_free,c.price_amount,c.price_currency,p.full_name,c.published_at
  from public.learning_courses c left join public.profiles p on p.id=c.instructor_id
  where c.status='published' and not exists(select 1 from public.learning_paystack_test_fixtures f where f.course_id=c.id)
  order by c.published_at desc nulls last,c.id desc limit p_limit offset p_offset;
end;$function$;

grant execute on function "public"."list_published_learning_courses"(integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_published_learning_courses"(integer, integer) from public;
