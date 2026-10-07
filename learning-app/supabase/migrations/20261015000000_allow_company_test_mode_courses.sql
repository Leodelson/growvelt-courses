-- Permit explicitly designated personal paid courses to be reviewed and sold
-- only through company Test Mode checkout. This does not enable learner checkout
-- or live payments and keeps these courses out of every public discovery path.
begin;

alter table public.learning_courses
  add column if not exists company_test_mode_only boolean not null default false;

comment on column public.learning_courses.company_test_mode_only is
  'When true, this personal course is restricted to company purchases in Paystack Test Mode and is never publicly discoverable or eligible for live checkout.';

drop policy if exists "Published courses are public" on public.learning_courses;
create policy "Published courses are public" on public.learning_courses
  for select to anon, authenticated
  using (
    status = 'published'
    and company_test_mode_only = false
    and not public.is_paystack_test_fixture_course(id)
  );
drop policy if exists "Published course modules are public" on public.course_modules;
create policy "Published course modules are public" on public.course_modules
  for select to anon, authenticated using (exists (
    select 1 from public.learning_courses course
    where course.id = course_modules.course_id and course.status = 'published'
      and course.company_test_mode_only = false
      and not public.is_paystack_test_fixture_course(course.id)
  ));
drop policy if exists "Published course preview lessons are public" on public.lessons;
create policy "Published course preview lessons are public" on public.lessons
  for select to anon, authenticated using (is_preview = true and exists (
    select 1 from public.learning_courses course
    where course.id = lessons.course_id and course.status = 'published'
      and course.company_test_mode_only = false
      and not public.is_paystack_test_fixture_course(course.id)
  ));

create or replace function public.get_own_learning_course_company_test_mode(p_course_id bigint)
returns boolean
language plpgsql stable security definer set search_path to '' as $function$
declare test_mode_only boolean;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  select course.company_test_mode_only into test_mode_only
  from public.learning_courses course
  where course.id = p_course_id and course.instructor_id = auth.uid();
  if not found then raise exception 'Course not found' using errcode = 'P0002'; end if;
  return test_mode_only;
end;
$function$;

create or replace function public.set_own_learning_course_company_test_mode(p_course_id bigint, p_test_mode_only boolean)
returns boolean
language plpgsql security definer set search_path to '' as $function$
declare course_is_free boolean; course_price numeric; course_currency text; limited_free boolean; organization_key bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if p_test_mode_only is null then raise exception 'Choose a valid company test-mode setting' using errcode = '22023'; end if;

  select course.is_free, course.price_amount, course.price_currency, course.is_limited_time_free, course.organization_id
    into course_is_free, course_price, course_currency, limited_free, organization_key
  from public.learning_courses course
  where course.id = p_course_id
    and course.instructor_id = auth.uid()
    and course.status = 'draft'
  for update;
  if not found then raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002'; end if;
  if organization_key is not null then
    raise exception 'Company Test Mode is available only for personal instructor courses' using errcode = '22023';
  end if;
  if p_test_mode_only and (
    course_is_free is not false
    or course_price is null or course_price <= 0 or course_price > 10000000
    or coalesce(course_currency, '') <> 'NGN'
    or coalesce(limited_free, false)
  ) then
    raise exception 'Company Test Mode requires a paid NGN personal course draft' using errcode = '22023';
  end if;

  update public.learning_courses course
  set company_test_mode_only = p_test_mode_only, updated_at = now()
  where course.id = p_course_id and course.instructor_id = auth.uid() and course.status = 'draft';
  return p_test_mode_only;
end;
$function$;

create or replace function public.get_learning_course_test_mode_for_review(p_course_id bigint)
returns boolean
language plpgsql stable security definer set search_path to '' as $function$
declare test_mode_only boolean;
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;
  select course.company_test_mode_only into test_mode_only
  from public.learning_courses course
  where course.id = p_course_id and course.status = 'pending_review';
  if not found then raise exception 'Submitted course not found' using errcode = 'P0002'; end if;
  return test_mode_only;
end;
$function$;

create or replace function public.submit_learning_course_for_review(
  p_course_id bigint,
  p_declaration_version text,
  p_rights_basis text
)
returns table(course_id bigint, submission_status text, submitted_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare
  course_key bigint;
  submitted_time timestamptz;
  normalized_version text := btrim(p_declaration_version);
  normalized_basis text := lower(btrim(p_rights_basis));
  course_is_free boolean;
  course_price numeric;
  course_currency text;
  course_limited_free boolean;
  course_test_mode_only boolean;
  course_organization_id bigint;
begin
  if auth.uid() is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if normalized_version is distinct from '2026-08-v1'
    or normalized_basis is null
    or normalized_basis not in ('original', 'licensed', 'authorized') then
    raise exception 'A current course-rights declaration is required' using errcode = '22023';
  end if;

  select course.id into course_key
  from public.learning_courses course
  where course.id = p_course_id and course.instructor_id = auth.uid() and course.status = 'draft';
  if course_key is null then raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(course_key);

  select course.id, course.is_free, course.price_amount, course.price_currency,
         course.is_limited_time_free, course.company_test_mode_only, course.organization_id
    into course_key, course_is_free, course_price, course_currency,
         course_limited_free, course_test_mode_only, course_organization_id
  from public.learning_courses course
  where course.id = course_key and course.instructor_id = auth.uid() and course.status = 'draft'
  for update;
  if course_key is null then raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002'; end if;

  if not exists (
    select 1 from public.learning_courses course
    where course.id = course_key
      and char_length(btrim(course.title)) between 3 and 160
      and char_length(btrim(course.summary)) between 10 and 320
      and char_length(btrim(course.description)) between 40 and 10000
      and course.category in ('Data Analytics', 'Business', 'Data Science', 'Business Intelligence', 'Programming', 'Web Development', 'Cybersecurity', 'Digital Marketing', 'Creative Skills', 'Digital Skills', 'Productivity')
      and course.level in ('Beginner', 'Intermediate', 'Beginner to intermediate', 'Beginner to job-ready')
  ) then raise exception 'Complete the required course metadata before submitting' using errcode = '22023'; end if;

  if course_is_free is true then
    if coalesce(course_price, 0) <> 0 or coalesce(course_currency, 'NGN') <> 'NGN' or coalesce(course_limited_free, false)
      or course_test_mode_only then
      raise exception 'Free courses must have zero NGN price and cannot use the company test-mode setting' using errcode = '22023';
    end if;
  elsif course_is_free is false then
    if not course_test_mode_only or course_organization_id is not null
      or course_price is null or course_price <= 0 or course_price > 10000000
      or coalesce(course_currency, '') <> 'NGN' or coalesce(course_limited_free, false)
      or public.is_paystack_test_fixture_course(course_key) then
      raise exception 'Paid courses can be submitted only as personal Company Test Mode-only drafts' using errcode = '22023';
    end if;
  else
    raise exception 'Course access settings are incomplete' using errcode = '22023';
  end if;

  if not exists (select 1 from public.course_modules module where module.course_id = course_key)
    or not exists (select 1 from public.lessons lesson where lesson.course_id = course_key) then
    raise exception 'Add at least one module and one lesson before submitting' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.course_modules module
    where module.course_id = course_key and (module.title is null or char_length(btrim(module.title)) not between 2 and 160)
  ) then raise exception 'Complete every module title before submitting' using errcode = '22023'; end if;
  if exists (
    select 1
    from public.lessons lesson
    left join public.course_modules module on module.id = lesson.module_id and module.course_id = lesson.course_id
    where lesson.course_id = course_key and (
      module.id is null
      or char_length(btrim(lesson.title)) not between 2 and 160
      or lesson.lesson_type not in ('video', 'text', 'quiz')
      or (lesson.lesson_type = 'video' and (
        lesson.content is not null or lesson.video_provider is distinct from 'youtube'
        or lesson.video_reference is null or lesson.video_reference !~ '^[A-Za-z0-9_-]{11}$'
        or lesson.video_visibility not in ('public', 'unlisted')
        or lesson.duration_seconds not between 1 and 86400
        or lesson.video_url is not null or lesson.duration_minutes is not null
      ))
      or (lesson.lesson_type = 'text' and (
        lesson.content is null or char_length(btrim(lesson.content)) not between 1 and 20000
        or lesson.video_provider is not null or lesson.video_reference is not null
        or lesson.video_visibility is not null or lesson.duration_seconds is not null
        or lesson.video_url is not null or lesson.duration_minutes is not null
      ))
    )
  ) then raise exception 'Complete every lesson with valid text, YouTube video, or quiz details before submitting' using errcode = '22023'; end if;

  insert into public.course_rights_declarations(course_id, instructor_id, declaration_version, rights_basis)
  values (course_key, auth.uid(), normalized_version, normalized_basis);
  update public.learning_courses course
  set status = 'pending_review', submitted_at = now(), reviewed_at = null, reviewed_by = null, review_note = null, updated_at = now()
  where course.id = course_key and course.instructor_id = auth.uid() and course.status = 'draft'
  returning course.submitted_at into submitted_time;
  if not found then raise exception 'Draft course not found or is no longer editable' using errcode = 'P0002'; end if;
  return query select course_key, 'pending_review'::text, submitted_time;
end;
$function$;

create or replace function public.review_learning_course(p_course_id bigint, p_decision text, p_review_note text default null)
returns table(course_id bigint, review_status text, reviewed_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare
  course_key bigint;
  reviewed_time timestamptz;
  course_submitted_at timestamptz;
  course_instructor_id uuid;
  course_is_free boolean;
  course_price_amount numeric;
  course_price_currency text;
  course_is_limited_time_free boolean;
  course_test_mode_only boolean;
  course_organization_id bigint;
  declaration_key bigint;
  normalized_decision text := lower(btrim(p_decision));
  normalized_note text := nullif(btrim(p_review_note), '');
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then raise exception 'Learning Admin capability required' using errcode = '42501'; end if;
  if normalized_decision not in ('published', 'returned') then raise exception 'Unsupported course-review decision' using errcode = '22023'; end if;
  if normalized_note is not null and char_length(normalized_note) > 2000 then raise exception 'Review note is too long' using errcode = '22023'; end if;
  if normalized_decision = 'returned' and (normalized_note is null or char_length(normalized_note) < 2) then raise exception 'A review note is required when returning a course for changes' using errcode = '22023'; end if;

  select course.id into course_key from public.learning_courses course where course.id = p_course_id and course.status = 'pending_review';
  if course_key is null then raise exception 'Submitted course not found or already finalized' using errcode = 'P0002'; end if;
  select course.id, course.submitted_at, course.instructor_id, course.is_free, course.price_amount,
         course.price_currency, course.is_limited_time_free, course.company_test_mode_only, course.organization_id
    into course_key, course_submitted_at, course_instructor_id, course_is_free, course_price_amount,
         course_price_currency, course_is_limited_time_free, course_test_mode_only, course_organization_id
  from public.learning_courses course where course.id = course_key and course.status = 'pending_review' for update;
  if course_key is null then raise exception 'Submitted course not found or already finalized' using errcode = 'P0002'; end if;

  if normalized_decision = 'published' then
    select declaration.id into declaration_key from public.course_rights_declarations declaration
    where declaration.course_id = course_key and declaration.instructor_id = course_instructor_id
      and declaration.declaration_version = '2026-08-v1'
      and course_submitted_at is not null and declaration.accepted_at <= course_submitted_at
    order by declaration.accepted_at desc, declaration.id desc limit 1;
    if course_submitted_at is null or declaration_key is null
      or (course_is_free is true and (coalesce(course_price_amount, 0) <> 0
        or coalesce(course_price_currency, 'NGN') <> 'NGN' or coalesce(course_is_limited_time_free, false)
        or course_test_mode_only))
      or (course_is_free is false and (not course_test_mode_only or course_organization_id is not null
        or course_price_amount is null or course_price_amount <= 0 or course_price_amount > 10000000
        or coalesce(course_price_currency, '') <> 'NGN' or coalesce(course_is_limited_time_free, false)
        or public.is_paystack_test_fixture_course(course_key)))
      or course_is_free is null then
      raise exception 'Course cannot be published because it does not satisfy the secure submission prerequisites' using errcode = '22023';
    end if;
  end if;

  update public.learning_courses course
  set status = case when normalized_decision = 'published' then 'published' else 'draft' end,
      published_at = case when normalized_decision = 'published' then now() else null end,
      reviewed_at = now(), reviewed_by = auth.uid(), review_note = normalized_note, updated_at = now()
  where course.id = course_key and course.status = 'pending_review'
  returning course.reviewed_at into reviewed_time;
  if not found then raise exception 'Submitted course not found or already finalized' using errcode = 'P0002'; end if;
  return query select course_key, case when normalized_decision = 'published' then 'published'::text else 'draft'::text end, reviewed_time;
end;
$function$;

drop function if exists public.get_published_learning_course_by_slug(text);
create function public.get_published_learning_course_by_slug(p_slug text)
returns table(course_id bigint, slug text, course_title text, summary text, description text, category text, level text,
  is_free boolean, price_amount numeric, price_currency text, instructor_name text, provider_name text, provider_slug text,
  provider_verified boolean, published_at timestamptz, module_id bigint, module_title text, module_position integer,
  lesson_id bigint, lesson_title text, lesson_type text, is_preview boolean, preview_text_content text,
  preview_video_provider text, preview_video_reference text, preview_video_visibility text,
  preview_duration_seconds integer, lesson_position integer)
language plpgsql stable security definer set search_path to '' as $function$
declare normalized_slug text := lower(btrim(p_slug));
begin
  if normalized_slug is null or normalized_slug = '' or char_length(normalized_slug) > 220 then raise exception 'Invalid published course reference' using errcode = '22023'; end if;
  return query
  select course.id, course.slug, course.title, course.summary, course.description, course.category, course.level,
    course.is_free, course.price_amount, course.price_currency, profile.full_name,
    case when verification.status = 'verified' then organization.name end,
    case when verification.status = 'verified' then organization.slug end,
    coalesce(verification.status = 'verified', false), course.published_at,
    module.id, module.title, module.position, lesson.id, lesson.title, lesson.lesson_type, lesson.is_preview,
    case when lesson.is_preview then lesson.content end,
    case when lesson.is_preview then lesson.video_provider end,
    case when lesson.is_preview then lesson.video_reference end,
    case when lesson.is_preview then lesson.video_visibility end,
    case when lesson.is_preview then lesson.duration_seconds end, lesson.position
  from public.learning_courses course
  left join public.profiles profile on profile.id = course.instructor_id
  left join public.learning_provider_organizations organization on organization.id = course.organization_id and organization.status = 'active'
  left join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id
  left join public.course_modules module on module.course_id = course.id
  left join public.lessons lesson on lesson.course_id = course.id and lesson.module_id = module.id
  where course.slug = normalized_slug and course.status = 'published' and course.company_test_mode_only = false
    and (not exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = course.id)
      or exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = course.id
        and fixture.status = 'active' and fixture.expires_at > now() and fixture.tester_id = auth.uid()))
  order by module.position nulls last, module.id, lesson.position nulls last, lesson.id;
end;
$function$;

drop function if exists public.list_published_learning_courses(integer, integer);
create function public.list_published_learning_courses(p_limit integer default 24, p_offset integer default 0)
returns table(course_id bigint, slug text, title text, summary text, category text, level text, is_free boolean,
  price_amount numeric, price_currency text, instructor_name text, provider_name text, provider_slug text,
  provider_verified boolean, published_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_limit not between 1 and 36 or p_offset < 0 then raise exception 'Invalid published-course pagination' using errcode = '22023'; end if;
  return query select course.id, course.slug, course.title, course.summary, course.category, course.level,
    course.is_free, course.price_amount, course.price_currency, profile.full_name,
    case when verification.status = 'verified' then organization.name end,
    case when verification.status = 'verified' then organization.slug end,
    coalesce(verification.status = 'verified', false), course.published_at
  from public.learning_courses course left join public.profiles profile on profile.id = course.instructor_id
  left join public.learning_provider_organizations organization on organization.id = course.organization_id and organization.status = 'active'
  left join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id
  where course.status = 'published' and course.company_test_mode_only = false
    and not exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = course.id)
  order by course.published_at desc nulls last, course.id desc limit p_limit offset p_offset;
end;
$function$;

drop function if exists public.search_public_published_learning_courses(text, text, text, boolean, text, integer, integer);
create function public.search_public_published_learning_courses(p_query text default null, p_category text default null,
  p_level text default null, p_is_free boolean default null, p_sort text default 'newest', p_limit integer default 12, p_offset integer default 0)
returns table(course_id bigint, slug text, title text, summary text, category text, level text, is_free boolean,
  price_amount numeric, price_currency text, instructor_name text, provider_name text, provider_slug text,
  provider_verified boolean, published_at timestamptz, total_courses integer)
language plpgsql stable security definer set search_path to '' as $function$
declare q text := nullif(lower(btrim(p_query)), ''); cat text := nullif(lower(btrim(p_category)), '');
  lvl text := nullif(lower(btrim(p_level)), ''); sort_key text := lower(btrim(coalesce(p_sort, 'newest')));
begin
  if (q is not null and char_length(q) > 120) or (cat is not null and char_length(cat) > 100)
    or (lvl is not null and char_length(lvl) > 100) then raise exception 'Invalid catalog filter' using errcode = '22023'; end if;
  if sort_key not in ('newest', 'title_asc', 'title_desc') or p_limit not between 1 and 24 or p_offset < 0 then
    raise exception 'Invalid catalog pagination or sort' using errcode = '22023'; end if;
  return query
  select course.id, course.slug, course.title, course.summary, course.category, course.level, course.is_free,
    course.price_amount, course.price_currency, profile.full_name,
    case when verification.status = 'verified' then organization.name end,
    case when verification.status = 'verified' then organization.slug end,
    coalesce(verification.status = 'verified', false), course.published_at, count(*) over()::integer
  from public.learning_courses course left join public.profiles profile on profile.id = course.instructor_id
  left join public.learning_provider_organizations organization on organization.id = course.organization_id and organization.status = 'active'
  left join public.learning_provider_organization_verifications verification on verification.organization_id = organization.id
  where course.status = 'published' and course.company_test_mode_only = false
    and not exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = course.id)
    and (q is null or position(q in lower(concat_ws(' ', course.title, course.summary, course.category, course.level, organization.name))) > 0)
    and (cat is null or lower(course.category) = cat) and (lvl is null or lower(course.level) = lvl)
    and (p_is_free is null or course.is_free = p_is_free)
  order by case when sort_key = 'title_asc' then lower(course.title) end asc nulls last,
    case when sort_key = 'title_desc' then lower(course.title) end desc nulls last,
    case when sort_key = 'newest' then course.published_at end desc nulls last,
    course.id desc limit p_limit offset p_offset;
end;
$function$;

revoke all on function public.get_published_learning_course_by_slug(text),
  public.list_published_learning_courses(integer, integer),
  public.search_public_published_learning_courses(text, text, text, boolean, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_published_learning_course_by_slug(text),
  public.list_published_learning_courses(integer, integer),
  public.search_public_published_learning_courses(text, text, text, boolean, text, integer, integer)
  to anon, authenticated, postgres, service_role;

create or replace function public.list_public_learning_provider_courses(p_provider_slug text, p_limit integer default 12)
returns table(course_id bigint, slug text, title text, summary text, category text, level text, is_free boolean,
  price_amount numeric, price_currency text, instructor_name text, published_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
declare normalized_slug text := lower(btrim(p_provider_slug));
begin
  if normalized_slug is null or normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or p_limit not between 1 and 24 then return; end if;
  return query
  select course.id, course.slug, course.title, course.summary, course.category, course.level, course.is_free,
    course.price_amount, course.price_currency, instructor.full_name, course.published_at
  from public.learning_provider_organizations organization
  join public.learning_provider_organization_verifications verification
    on verification.organization_id = organization.id and verification.status = 'verified'
  join public.learning_courses course on course.organization_id = organization.id and course.status = 'published'
  left join public.profiles instructor on instructor.id = course.instructor_id
  where organization.slug = normalized_slug and organization.status = 'active'
    and course.company_test_mode_only = false
    and not exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = course.id)
  order by course.published_at desc nulls last, course.id desc limit p_limit;
end;
$function$;

create or replace function public.can_read_learning_course_video_cover(p_object_name text)
returns boolean
language plpgsql stable security definer set search_path to '' as $function$
declare course_identifier text; expected_path text;
begin
  if p_object_name is null or p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-9][0-9]*/course-video-cover$' then return false; end if;
  course_identifier := split_part(p_object_name, '/', 2);
  expected_path := coalesce(auth.uid()::text, '') || '/' || course_identifier || '/course-video-cover';
  return exists (
    select 1 from public.learning_courses course
    where course.id::text = course_identifier
      and (
        (course.status = 'published' and course.course_video_cover_storage_path = p_object_name
          and (course.company_test_mode_only = false or (auth.uid() is not null and (
            course.instructor_id = auth.uid() or public.is_growvelt_learning_admin()
            or exists(select 1 from public.enrollments enrollment where enrollment.course_id = course.id
              and enrollment.learner_id = auth.uid() and enrollment.status in ('active', 'completed'))
          ))))
        or (auth.uid() is not null and course.instructor_id = auth.uid() and course.status = 'draft'
          and public.is_approved_growvelt_instructor() and p_object_name = expected_path)
        or (auth.uid() is not null and course.status = 'pending_review'
          and course.course_video_cover_storage_path = p_object_name and public.is_growvelt_learning_admin())
      )
  );
end;
$function$;

create or replace function public.get_own_or_published_learning_course_video_cover(p_course_id bigint)
returns table(course_video_cover_storage_path text, is_published boolean)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_course_id is null or p_course_id <= 0 then raise exception 'Invalid course reference' using errcode = '22023'; end if;
  return query
  select course.course_video_cover_storage_path, course.status = 'published'
  from public.learning_courses course
  where course.id = p_course_id and course.course_video_cover_storage_path is not null
    and (
      (course.status = 'published' and (course.company_test_mode_only = false or (auth.uid() is not null and (
        course.instructor_id = auth.uid() or public.is_growvelt_learning_admin()
        or exists(select 1 from public.enrollments enrollment where enrollment.course_id = course.id
          and enrollment.learner_id = auth.uid() and enrollment.status in ('active', 'completed'))
      ))))
      or (auth.uid() is not null and course.instructor_id = auth.uid())
      or (auth.uid() is not null and course.status = 'pending_review' and public.is_growvelt_learning_admin())
    );
end;
$function$;

drop function if exists public.list_own_learning_company_paid_courses(bigint);
create function public.list_own_learning_company_paid_courses(p_workspace_id bigint)
returns table(course_id bigint, title text, summary text, category text, level text, price_amount numeric,
  currency text, instructor_name text, provider_name text, company_test_mode_only boolean)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null or p_workspace_id is null or not exists(
    select 1 from public.learning_company_workspaces workspace
    join public.learning_company_memberships manager on manager.workspace_id = workspace.id
    where workspace.id = p_workspace_id and workspace.status = 'active'
      and manager.user_id = auth.uid() and manager.status = 'active' and manager.role in ('owner', 'admin')
  ) then raise exception 'Active company manager required' using errcode = '42501'; end if;
  return query
  select course.id, course.title, course.summary, course.category, course.level, course.price_amount,
    course.price_currency, instructor.full_name, coalesce(provider.name, instructor.full_name, 'Growvelt instructor'),
    course.company_test_mode_only
  from public.learning_courses course
  left join public.profiles instructor on instructor.id = course.instructor_id
  left join public.learning_provider_organizations provider on provider.id = course.organization_id and provider.status = 'active'
  where course.status = 'published' and course.is_free = false and coalesce(course.is_limited_time_free, false) = false
    and course.price_amount is not null and course.price_amount > 0 and course.price_currency = 'NGN'
  order by course.published_at desc nulls last, course.id desc;
end;
$function$;

revoke all on function public.list_own_learning_company_paid_courses(bigint) from public, anon, authenticated;
grant execute on function public.list_own_learning_company_paid_courses(bigint) to authenticated, postgres, service_role;

create or replace function public.is_learning_company_purchase_test_only(p_purchase_id bigint)
returns boolean
language sql stable security definer set search_path to '' as $function$
  select course.company_test_mode_only
  from public.learning_company_paid_course_purchases purchase
  join public.learning_courses course on course.id = purchase.course_id
  where purchase.id = p_purchase_id;
$function$;

revoke all on function public.get_own_learning_course_company_test_mode(bigint),
  public.set_own_learning_course_company_test_mode(bigint, boolean),
  public.get_learning_course_test_mode_for_review(bigint),
  public.is_learning_company_purchase_test_only(bigint) from public, anon, authenticated;
grant execute on function public.get_own_learning_course_company_test_mode(bigint),
  public.set_own_learning_course_company_test_mode(bigint, boolean) to authenticated, postgres, service_role;
grant execute on function public.get_learning_course_test_mode_for_review(bigint) to authenticated, postgres, service_role;
grant execute on function public.is_learning_company_purchase_test_only(bigint) to postgres, service_role;

commit;
