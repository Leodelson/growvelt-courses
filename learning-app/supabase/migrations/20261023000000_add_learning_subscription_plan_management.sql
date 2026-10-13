-- Phase 4: instructor-owned draft plan management.
-- Plan data remains private; creation is limited to approved instructors and
-- never creates a Paystack plan or starts checkout.

begin;

create or replace function public.create_own_learning_subscription_plan(
  p_name text,
  p_description text,
  p_amount_minor bigint,
  p_course_ids bigint[]
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := auth.uid();
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_description text := nullif(btrim(coalesce(p_description, '')), '');
  requested_count integer;
  eligible_count integer;
  terms_count integer;
  resolved_terms_version text;
  created_plan_id uuid;
begin
  if actor_id is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  if char_length(normalized_name) not between 3 and 100
     or (normalized_description is not null and char_length(normalized_description) > 1000)
     or p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Provide a valid plan name, description, and positive NGN price' using errcode = '22023';
  end if;

  if p_course_ids is null or cardinality(p_course_ids) not between 1 and 50 then
    raise exception 'Select between 1 and 50 courses for the plan' using errcode = '22023';
  end if;

  requested_count := cardinality(p_course_ids);
  if requested_count <> (select count(distinct course_id)::integer from unnest(p_course_ids) as selected(course_id))
     or exists (select 1 from unnest(p_course_ids) as selected(course_id) where course_id is null) then
    raise exception 'Selected course IDs must be unique and non-null' using errcode = '22023';
  end if;

  select count(*)::integer, count(distinct terms.version)::integer, min(terms.version)
  into eligible_count, terms_count, resolved_terms_version
  from unnest(p_course_ids) as selected(course_id)
  join public.learning_courses course on course.id = selected.course_id
  cross join lateral (
    select public.resolve_learning_commercial_terms_version(course.id, course.instructor_id) as version
  ) terms
  where course.instructor_id = actor_id
    and course.organization_id is null
    and course.status = 'published'
    and not course.is_free
    and not coalesce(course.is_limited_time_free, false)
    and course.price_currency = 'NGN'
    and course.price_amount > 0
    and not coalesce(course.company_test_mode_only, false)
    and not public.is_paystack_test_fixture_course(course.id);

  if eligible_count <> requested_count then
    raise exception 'Every selected course must be your published public paid NGN course' using errcode = '42501';
  end if;
  if terms_count <> 1 or resolved_terms_version is null then
    raise exception 'All courses in one plan must use the same active commercial terms' using errcode = '23514';
  end if;

  insert into public.learning_subscription_plans(
    instructor_id, name, description, amount_minor, commercial_terms_version, status
  ) values (
    actor_id, normalized_name, normalized_description, p_amount_minor, resolved_terms_version, 'draft'
  ) returning id into created_plan_id;

  insert into public.learning_subscription_plan_courses(plan_id, instructor_id, course_id)
  select created_plan_id, actor_id, selected.course_id
  from unnest(p_course_ids) as selected(course_id);

  insert into public.learning_audit_events(
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'instructor', 'subscription_plan.draft_created', 'learning_subscription_plan',
    created_plan_id::text,
    jsonb_build_object(
      'course_ids', to_jsonb(p_course_ids),
      'amount_minor', p_amount_minor,
      'currency', 'NGN',
      'billing_interval', 'monthly',
      'commercial_terms_version', resolved_terms_version,
      'payment_domain', 'test'
    )
  );

  return created_plan_id;
end;
$function$;

create or replace function public.list_own_learning_subscription_plans()
returns table(
  plan_id uuid,
  name text,
  description text,
  amount_minor bigint,
  currency text,
  billing_interval text,
  status text,
  course_ids bigint[],
  course_titles text[],
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  return query
  select plan.id,
    plan.name,
    plan.description,
    plan.amount_minor,
    plan.currency,
    plan.billing_interval,
    plan.status,
    coalesce(array_agg(item.course_id order by item.course_id) filter (where item.course_id is not null), '{}'::bigint[]),
    coalesce(array_agg(course.title order by item.course_id) filter (where item.course_id is not null), '{}'::text[]),
    plan.created_at,
    plan.updated_at
  from public.learning_subscription_plans plan
  left join public.learning_subscription_plan_courses item on item.plan_id = plan.id
  left join public.learning_courses course on course.id = item.course_id
  where plan.instructor_id = actor_id
  group by plan.id
  order by plan.created_at desc, plan.id desc;
end;
$function$;

create or replace function public.list_own_learning_subscription_plan_courses()
returns table(
  course_id bigint,
  title text,
  price_amount numeric,
  currency text,
  commercial_terms_version text
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  return query
  select course.id,
    course.title,
    course.price_amount,
    course.price_currency,
    public.resolve_learning_commercial_terms_version(course.id, course.instructor_id)
  from public.learning_courses course
  where course.instructor_id = actor_id
    and course.organization_id is null
    and course.status = 'published'
    and not course.is_free
    and not coalesce(course.is_limited_time_free, false)
    and course.price_currency = 'NGN'
    and course.price_amount > 0
    and not coalesce(course.company_test_mode_only, false)
    and not public.is_paystack_test_fixture_course(course.id)
  order by course.title, course.id;
end;
$function$;

revoke all on function public.create_own_learning_subscription_plan(text, text, bigint, bigint[])
  from public, anon;
revoke all on function public.list_own_learning_subscription_plans()
  from public, anon;
revoke all on function public.list_own_learning_subscription_plan_courses()
  from public, anon;
grant execute on function public.create_own_learning_subscription_plan(text, text, bigint, bigint[])
  to authenticated, postgres, service_role;
grant execute on function public.list_own_learning_subscription_plans()
  to authenticated, postgres, service_role;
grant execute on function public.list_own_learning_subscription_plan_courses()
  to authenticated, postgres, service_role;

commit;
