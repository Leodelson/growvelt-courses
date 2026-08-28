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
declare q text:=nullif(lower(btrim(p_query)),''); cat text:=nullif(lower(btrim(p_category)),''); lvl text:=nullif(lower(btrim(p_level)),''); sort_key text:=lower(btrim(coalesce(p_sort,'newest')));
begin
  if q is not null and char_length(q)>120 or cat is not null and char_length(cat)>100 or lvl is not null and char_length(lvl)>100 then raise exception 'Invalid catalog filter' using errcode='22023'; end if;
  if sort_key not in ('newest','title_asc','title_desc') or p_limit not between 1 and 24 or p_offset<0 then raise exception 'Invalid catalog pagination or sort' using errcode='22023'; end if;
  return query select c.id,c.slug,c.title,c.summary,c.category,c.level,c.is_free,c.price_amount,c.price_currency,p.full_name,c.published_at,count(*) over()::integer
  from public.learning_courses c left join public.profiles p on p.id=c.instructor_id
  where c.status='published' and not exists(select 1 from public.learning_paystack_test_fixtures f where f.course_id=c.id)
    and (q is null or position(q in lower(concat_ws(' ',c.title,c.summary,c.category,c.level)))>0)
    and (cat is null or lower(c.category)=cat) and (lvl is null or lower(c.level)=lvl) and (p_is_free is null or c.is_free=p_is_free)
  order by case when sort_key='title_asc' then lower(c.title) end asc nulls last,case when sort_key='title_desc' then lower(c.title) end desc nulls last,
    case when sort_key='newest' then c.published_at end desc nulls last,c.id desc limit p_limit offset p_offset;
end;$function$;

grant execute
  on function "public"."search_public_published_learning_courses"(text, text, text, boolean, text, integer, integer)
  to "anon", "authenticated", "postgres", "service_role";

revoke all on function "public"."search_public_published_learning_courses"(text, text, text, boolean, text, integer, integer) from public;
