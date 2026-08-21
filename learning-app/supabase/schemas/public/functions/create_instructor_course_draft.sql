create or replace function public.create_instructor_course_draft (
  p_title          text,
  p_summary        text,
  p_description    text,
  p_category       text,
  p_level          text,
  p_is_free        boolean,
  p_price_amount   numeric,
  p_price_currency text    default 'NGN'::text
)
  returns table (
    course_id bigint,
    slug      text,
    status    text
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  normalized_title text := btrim(p_title);
  normalized_summary text := btrim(p_summary);
  normalized_description text := btrim(p_description);
  normalized_category text := btrim(p_category);
  normalized_level text := btrim(p_level);
  normalized_currency text := upper(btrim(coalesce(p_price_currency, '')));
  normalized_price numeric;
  slug_base text;
  candidate_slug text;
  attempt integer := 2;
  created_course_id bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if normalized_title is null
     or normalized_summary is null
     or normalized_description is null
     or char_length(normalized_title) not between 3 and 160
     or char_length(normalized_summary) not between 10 and 320
     or char_length(normalized_description) not between 40 and 10000 then
    raise exception 'Course metadata does not meet the required length limits' using errcode = '22023';
  end if;

  if normalized_category is null or normalized_category not in (
    'Data Analytics', 'Business', 'Data Science', 'Business Intelligence',
    'Programming', 'Web Development', 'Cybersecurity', 'Digital Marketing',
    'Creative Skills', 'Digital Skills', 'Productivity'
  ) then
    raise exception 'Choose a supported course category' using errcode = '22023';
  end if;

  if normalized_level is null or normalized_level not in ('Beginner', 'Intermediate', 'Beginner to intermediate', 'Beginner to job-ready') then
    raise exception 'Choose a supported course level' using errcode = '22023';
  end if;

  if p_is_free is null or normalized_currency <> 'NGN' then
    raise exception 'Course drafts support NGN pricing only' using errcode = '22023';
  elsif p_is_free then
    normalized_price := 0;
  elsif p_price_amount is null
        or p_price_amount <= 0
        or p_price_amount > 10000000
        or scale(p_price_amount) > 2 then
    raise exception 'Paid drafts require a valid NGN price' using errcode = '22023';
  else
    normalized_price := p_price_amount;
  end if;

  slug_base := trim(both '-' from regexp_replace(lower(normalized_title), '[^a-z0-9]+', '-', 'g'));
  if slug_base is null or slug_base = '' then
    raise exception 'Course title cannot produce a safe slug' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(slug_base));
  candidate_slug := slug_base;
  while exists (select 1 from public.learning_courses as course where course.slug = candidate_slug) loop
    candidate_slug := slug_base || '-' || attempt;
    attempt := attempt + 1;
  end loop;

  insert into public.learning_courses (
    instructor_id, title, slug, summary, description, category, level,
    price_amount, price_currency, is_free, is_limited_time_free, status
  ) values (
    auth.uid(), normalized_title, candidate_slug, normalized_summary,
    normalized_description, normalized_category, normalized_level,
    normalized_price, 'NGN', p_is_free, false, 'draft'
  )
  returning id into created_course_id;

  return query
  select created_course_id, candidate_slug, 'draft'::text;
end;
$function$;

grant execute on function "public"."create_instructor_course_draft"(text, text, text, text, text, boolean, numeric, text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."create_instructor_course_draft"(text, text, text, text, text, boolean, numeric, text) from public;
