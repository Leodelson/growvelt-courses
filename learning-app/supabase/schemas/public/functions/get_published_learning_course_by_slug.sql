create or replace function public.get_published_learning_course_by_slug (
  p_slug text
)
  returns table (
    course_id                bigint,
    slug                     text,
    course_title             text,
    summary                  text,
    description              text,
    category                 text,
    level                    text,
    is_free                  boolean,
    price_amount             numeric,
    price_currency           text,
    instructor_name          text,
    published_at             timestamp with time zone,
    module_id                bigint,
    module_title             text,
    module_position          integer,
    lesson_id                bigint,
    lesson_title             text,
    lesson_type              text,
    is_preview               boolean,
    preview_text_content     text,
    preview_video_provider   text,
    preview_video_reference  text,
    preview_video_visibility text,
    preview_duration_seconds integer,
    lesson_position          integer
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare normalized_slug text:=lower(btrim(p_slug));
begin
  if normalized_slug is null or normalized_slug='' or char_length(normalized_slug)>220 then raise exception 'Invalid published course reference' using errcode='22023'; end if;
  return query select c.id,c.slug,c.title,c.summary,c.description,c.category,c.level,c.is_free,c.price_amount,c.price_currency,p.full_name,c.published_at,
    m.id,m.title,m.position,l.id,l.title,l.lesson_type,l.is_preview,case when l.is_preview then l.content end,case when l.is_preview then l.video_provider end,
    case when l.is_preview then l.video_reference end,case when l.is_preview then l.video_visibility end,case when l.is_preview then l.duration_seconds end,l.position
  from public.learning_courses c left join public.profiles p on p.id=c.instructor_id left join public.course_modules m on m.course_id=c.id
  left join public.lessons l on l.course_id=c.id and l.module_id=m.id
  where c.slug=normalized_slug and c.status='published' and (
    not exists(select 1 from public.learning_paystack_test_fixtures f where f.course_id=c.id)
    or exists(select 1 from public.learning_paystack_test_fixtures f where f.course_id=c.id and f.status='active' and f.expires_at>now() and f.tester_id=auth.uid()))
  order by m.position nulls last,m.id,l.position nulls last,l.id;
end;$function$;

grant execute on function "public"."get_published_learning_course_by_slug"(text) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "public"."get_published_learning_course_by_slug"(text) from public;
