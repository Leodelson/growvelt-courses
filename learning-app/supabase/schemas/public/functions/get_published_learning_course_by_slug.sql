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
declare
  normalized_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then
    raise exception 'Invalid published course reference' using errcode = '22023';
  end if;

  return query
  select course_row.id,
         course_row.slug,
         course_row.title,
         course_row.summary,
         course_row.description,
         course_row.category,
         course_row.level,
         course_row.is_free,
         course_row.price_amount,
         course_row.price_currency,
         profile_row.full_name,
         course_row.published_at,
         module_row.id,
         module_row.title,
         module_row.position,
         lesson_row.id,
         lesson_row.title,
         lesson_row.lesson_type,
         lesson_row.is_preview,
         case when lesson_row.is_preview then lesson_row.content else null::text end,
         case when lesson_row.is_preview then lesson_row.video_provider else null::text end,
         case when lesson_row.is_preview then lesson_row.video_reference else null::text end,
         case when lesson_row.is_preview then lesson_row.video_visibility else null::text end,
         case when lesson_row.is_preview then lesson_row.duration_seconds else null::integer end,
         lesson_row.position
  from public.learning_courses as course_row
  left join public.profiles as profile_row on profile_row.id = course_row.instructor_id
  left join public.course_modules as module_row on module_row.course_id = course_row.id
  left join public.lessons as lesson_row on lesson_row.course_id = course_row.id and lesson_row.module_id = module_row.id
  where course_row.slug = normalized_slug
    and course_row.status = 'published'
  order by module_row.position nulls last, module_row.id, lesson_row.position nulls last, lesson_row.id;
end;
$function$;

grant execute on function "public"."get_published_learning_course_by_slug"(text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_published_learning_course_by_slug"(text) from public;
