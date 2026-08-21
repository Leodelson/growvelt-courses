create or replace function public.get_learning_course_for_review (
  p_course_id bigint
)
  returns table (
    course_id               bigint,
    course_title            text,
    summary                 text,
    description             text,
    category                text,
    level                   text,
    is_free                 boolean,
    price_amount            numeric,
    price_currency          text,
    course_status           text,
    submitted_at            timestamp with time zone,
    reviewed_at             timestamp with time zone,
    reviewed_by             uuid,
    review_note             text,
    instructor_id           uuid,
    instructor_name         text,
    instructor_email        text,
    declaration_version     text,
    rights_basis            text,
    declaration_accepted_at timestamp with time zone,
    module_id               bigint,
    module_title            text,
    module_position         integer,
    lesson_id               bigint,
    lesson_title            text,
    lesson_type             text,
    lesson_content          text,
    video_provider          text,
    video_reference         text,
    video_visibility        text,
    duration_seconds        integer,
    is_preview              boolean,
    lesson_position         integer
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

  return query
  select course.id,
         course.title,
         course.summary,
         course.description,
         course.category,
         course.level,
         course.is_free,
         course.price_amount,
         course.price_currency,
         course.status,
         course.submitted_at,
         course.reviewed_at,
         course.reviewed_by,
         course.review_note,
         course.instructor_id,
         profile.full_name,
         auth_user.email::text,
         declaration.declaration_version,
         declaration.rights_basis,
         declaration.accepted_at,
         module.id,
         module.title,
         module.position,
         lesson.id,
         lesson.title,
         lesson.lesson_type,
         lesson.content,
         lesson.video_provider,
         lesson.video_reference,
         lesson.video_visibility,
         lesson.duration_seconds,
         lesson.is_preview,
         lesson.position
  from public.learning_courses as course
  left join public.profiles as profile on profile.id = course.instructor_id
  left join auth.users as auth_user on auth_user.id = course.instructor_id
  left join lateral (
    select declaration_row.declaration_version, declaration_row.rights_basis, declaration_row.accepted_at
    from public.course_rights_declarations as declaration_row
    where declaration_row.course_id = course.id
      and declaration_row.instructor_id = course.instructor_id
      and declaration_row.declaration_version = '2026-08-v1'
      and course.submitted_at is not null
      and declaration_row.accepted_at <= course.submitted_at
    order by declaration_row.accepted_at desc, declaration_row.id desc
    limit 1
  ) as declaration on true
  left join public.course_modules as module on module.course_id = course.id
  left join public.lessons as lesson on lesson.course_id = course.id and lesson.module_id = module.id
  where course.id = p_course_id
    and course.status = 'pending_review'
  order by module.position, module.id, lesson.position, lesson.id;
end;
$function$;

grant execute on function "public"."get_learning_course_for_review"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."get_learning_course_for_review"(bigint) from public;
