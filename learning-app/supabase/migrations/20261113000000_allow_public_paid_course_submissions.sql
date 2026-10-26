-- Allow valid personal paid courses to enter review and become publicly
-- discoverable after approval. Company-owned paid courses remain unsupported,
-- and company_test_mode_only continues to keep a course out of public discovery.
begin;

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
    if course_organization_id is not null then
      raise exception 'Paid courses must be personal instructor courses' using errcode = '22023';
    end if;
    if course_price is null or course_price <= 0 or course_price > 10000000
      or coalesce(course_currency, '') <> 'NGN' or coalesce(course_limited_free, false)
      or public.is_paystack_test_fixture_course(course_key) then
      raise exception 'Paid courses must use a valid NGN price and cannot be limited-time-free or payment fixtures' using errcode = '22023';
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
      or (course_is_free is false and (course_test_mode_only is null or course_organization_id is not null
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

-- Enforce the private company-sandbox boundary inside the live order function,
-- even when a caller bypasses the public course catalog and submits a course ID.
create or replace function public.initialize_paystack_live_learning_order(p_learner_id uuid, p_course_id bigint)
returns table (order_id bigint, order_reference text, payment_attempt_id bigint, amount_minor bigint, currency text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  course_row record;
  order_key bigint;
  order_ref text;
  attempt_key bigint;
  amount_key bigint;
  terms_version text;
begin
  if p_learner_id is null or p_course_id is null then
    raise exception 'Learner and course are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('paystack:live:' || p_learner_id::text || ':' || p_course_id::text, 0));
  if not exists (select 1 from public.profiles where id = p_learner_id) then
    raise exception 'Learner profile was not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.learning_paystack_test_fixtures where course_id = p_course_id) then
    raise exception 'Controlled Test Mode courses cannot be purchased with Live payments' using errcode = '42501';
  end if;

  select c.id, c.instructor_id, c.title, c.price_amount, c.price_currency, c.is_free,
         c.is_limited_time_free, c.status, c.company_test_mode_only, p.full_name as instructor_name
    into course_row
  from public.learning_courses c
  left join public.profiles p on p.id = c.instructor_id
  where c.id = p_course_id;
  if not found or course_row.status <> 'published' then
    raise exception 'Course is not available for purchase' using errcode = '22023';
  end if;
  if course_row.company_test_mode_only is distinct from false then
    raise exception 'Company Sandbox Mode-only courses cannot be purchased with Live payments' using errcode = '42501';
  end if;
  if course_row.is_free or course_row.is_limited_time_free or course_row.price_amount is null
    or course_row.price_amount <= 0 or course_row.price_currency <> 'NGN' or scale(course_row.price_amount) > 2
  then
    raise exception 'Course does not have an eligible paid NGN price' using errcode = '22023';
  end if;
  if exists (select 1 from public.enrollments where learner_id = p_learner_id and course_id = p_course_id and status in ('active', 'completed'))
    or exists (select 1 from public.learning_course_entitlements where learner_id = p_learner_id and course_id = p_course_id and status = 'active')
    or exists (select 1 from public.learning_orders where learner_id = p_learner_id and course_id = p_course_id and status in ('created', 'payment_pending', 'paid', 'partially_refunded'))
  then
    raise exception 'Learner already has course access or a purchase in progress' using errcode = '23505';
  end if;

  amount_key := round(course_row.price_amount * 100)::bigint;
  terms_version := public.resolve_learning_commercial_terms_version(course_row.id, course_row.instructor_id);
  insert into public.learning_orders (
    learner_id, course_id, instructor_id, course_title_snapshot, instructor_name_snapshot,
    gross_amount_minor, currency, status, commercial_terms_version
  ) values (
    p_learner_id, p_course_id, course_row.instructor_id, course_row.title, course_row.instructor_name,
    amount_key, 'NGN', 'created', terms_version
  ) returning id, learning_orders.order_reference into order_key, order_ref;
  insert into public.learning_payment_attempts (order_id, provider, provider_reference, amount_minor, currency, status, paystack_domain)
  values (order_key, 'paystack', order_ref, amount_key, 'NGN', 'initialized', 'live')
  returning id into attempt_key;
  return query select order_key, order_ref, attempt_key, amount_key, 'NGN'::text;
end;
$function$;

revoke all on function public.initialize_paystack_live_learning_order(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.initialize_paystack_live_learning_order(uuid, bigint)
  to postgres, service_role;

commit;
