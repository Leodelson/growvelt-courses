-- Phase 2B3: show verified organization ownership on public course cards and
-- course pages. Individual instructor ownership and commercial controls stay
-- unchanged; this is public identity only.

drop function if exists public.get_published_learning_course_by_slug(text);
drop function if exists public.list_published_learning_courses(integer, integer);
drop function if exists public.search_public_published_learning_courses(text, text, text, boolean, text, integer, integer);

create function public.get_published_learning_course_by_slug(p_slug text)
returns table(course_id bigint,slug text,course_title text,summary text,description text,category text,level text,is_free boolean,price_amount numeric,price_currency text,instructor_name text,provider_name text,provider_slug text,provider_verified boolean,published_at timestamptz,module_id bigint,module_title text,module_position integer,lesson_id bigint,lesson_title text,lesson_type text,is_preview boolean,preview_text_content text,preview_video_provider text,preview_video_reference text,preview_video_visibility text,preview_duration_seconds integer,lesson_position integer)
language plpgsql stable security definer set search_path to '' as $function$
declare normalized_slug text := lower(btrim(p_slug));
begin
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then raise exception 'Invalid published course reference' using errcode = '22023'; end if;
  return query
  select c.id, c.slug, c.title, c.summary, c.description, c.category, c.level, c.is_free, c.price_amount, c.price_currency, instructor.full_name,
    case when verification.status = 'verified' then organization.name end,
    case when verification.status = 'verified' then organization.slug end,
    coalesce(verification.status = 'verified', false), c.published_at,
    module.id, module.title, module.position, lesson.id, lesson.title, lesson.lesson_type, lesson.is_preview,
    case when lesson.is_preview then lesson.content end, case when lesson.is_preview then lesson.video_provider end,
    case when lesson.is_preview then lesson.video_reference end, case when lesson.is_preview then lesson.video_visibility end,
    case when lesson.is_preview then lesson.duration_seconds end, lesson.position
  from public.learning_courses c
  left join public.profiles instructor on instructor.id = c.instructor_id
  left join public.learning_provider_organizations organization on organization.id = c.organization_id and organization.status = 'active'
  left join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id
  left join public.course_modules module on module.course_id = c.id
  left join public.lessons lesson on lesson.course_id = c.id and lesson.module_id = module.id
  where c.slug = normalized_slug and c.status = 'published' and (
    not exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = c.id)
    or exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = c.id and fixture.status = 'active' and fixture.expires_at > now() and fixture.tester_id = auth.uid())
  )
  order by module.position nulls last, module.id, lesson.position nulls last, lesson.id;
end;
$function$;

create function public.list_published_learning_courses(p_limit integer default 24, p_offset integer default 0)
returns table(course_id bigint,slug text,title text,summary text,category text,level text,is_free boolean,price_amount numeric,price_currency text,instructor_name text,provider_name text,provider_slug text,provider_verified boolean,published_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_limit not between 1 and 36 or p_offset < 0 then raise exception 'Invalid published-course pagination' using errcode = '22023'; end if;
  return query
  select c.id, c.slug, c.title, c.summary, c.category, c.level, c.is_free, c.price_amount, c.price_currency, instructor.full_name,
    case when verification.status = 'verified' then organization.name end, case when verification.status = 'verified' then organization.slug end, coalesce(verification.status = 'verified', false), c.published_at
  from public.learning_courses c
  left join public.profiles instructor on instructor.id = c.instructor_id
  left join public.learning_provider_organizations organization on organization.id = c.organization_id and organization.status = 'active'
  left join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id
  where c.status = 'published' and not exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = c.id)
  order by c.published_at desc nulls last, c.id desc limit p_limit offset p_offset;
end;
$function$;

create function public.search_public_published_learning_courses(p_query text default null,p_category text default null,p_level text default null,p_is_free boolean default null,p_sort text default 'newest',p_limit integer default 12,p_offset integer default 0)
returns table(course_id bigint,slug text,title text,summary text,category text,level text,is_free boolean,price_amount numeric,price_currency text,instructor_name text,provider_name text,provider_slug text,provider_verified boolean,published_at timestamptz,total_courses integer)
language plpgsql stable security definer set search_path to '' as $function$
declare q text := nullif(lower(btrim(p_query)), ''); cat text := nullif(lower(btrim(p_category)), ''); lvl text := nullif(lower(btrim(p_level)), ''); sort_key text := lower(btrim(coalesce(p_sort, 'newest')));
begin
  if (q is not null and char_length(q) > 120) or (cat is not null and char_length(cat) > 100) or (lvl is not null and char_length(lvl) > 100) then raise exception 'Invalid catalog filter' using errcode = '22023'; end if;
  if sort_key not in ('newest', 'title_asc', 'title_desc') or p_limit not between 1 and 24 or p_offset < 0 then raise exception 'Invalid catalog pagination or sort' using errcode = '22023'; end if;
  return query
  select c.id, c.slug, c.title, c.summary, c.category, c.level, c.is_free, c.price_amount, c.price_currency, instructor.full_name,
    case when verification.status = 'verified' then organization.name end, case when verification.status = 'verified' then organization.slug end, coalesce(verification.status = 'verified', false), c.published_at, count(*) over()::integer
  from public.learning_courses c
  left join public.profiles instructor on instructor.id = c.instructor_id
  left join public.learning_provider_organizations organization on organization.id = c.organization_id and organization.status = 'active'
  left join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id
  where c.status = 'published' and not exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = c.id)
    and (q is null or position(q in lower(concat_ws(' ', c.title, c.summary, c.category, c.level, organization.name))) > 0)
    and (cat is null or lower(c.category) = cat) and (lvl is null or lower(c.level) = lvl) and (p_is_free is null or c.is_free = p_is_free)
  order by case when sort_key = 'title_asc' then lower(c.title) end asc nulls last, case when sort_key = 'title_desc' then lower(c.title) end desc nulls last,
    case when sort_key = 'newest' then c.published_at end desc nulls last, c.id desc limit p_limit offset p_offset;
end;
$function$;

revoke all on function public.get_published_learning_course_by_slug(text), public.list_published_learning_courses(integer,integer), public.search_public_published_learning_courses(text,text,text,boolean,text,integer,integer) from public, anon, authenticated;
grant execute on function public.get_published_learning_course_by_slug(text), public.list_published_learning_courses(integer,integer), public.search_public_published_learning_courses(text,text,text,boolean,text,integer,integer) to anon, authenticated, postgres, service_role;
