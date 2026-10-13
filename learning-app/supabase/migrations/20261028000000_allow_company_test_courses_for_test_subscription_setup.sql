-- Allow Company Test Mode-only courses to be used when preparing a private
-- Test Mode subscription plan. These courses remain excluded from the public
-- plan projection and learner checkout; payment_domain is constrained to test.

begin;

create or replace function public.validate_learning_subscription_plan_course()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  plan_row record;
  course_row record;
begin
  select plan.instructor_id, plan.status, plan.payment_domain
  into plan_row
  from public.learning_subscription_plans plan
  where plan.id = case when tg_op = 'DELETE' then old.plan_id else new.plan_id end
  for update;

  if not found or plan_row.status <> 'draft' then
    raise exception 'Subscription plan courses can only change while the plan is a draft' using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' then
    select course.* into course_row
    from public.learning_courses course
    where course.id = new.course_id;

    if not found
       or new.instructor_id <> plan_row.instructor_id
       or course_row.instructor_id is distinct from plan_row.instructor_id
       or course_row.organization_id is not null
       or course_row.status <> 'published'
       or course_row.is_free
       or coalesce(course_row.is_limited_time_free, false)
       or course_row.price_currency is distinct from 'NGN'
       or course_row.price_amount is null
       or course_row.price_amount <= 0
       or (coalesce(course_row.company_test_mode_only, false) and plan_row.payment_domain <> 'test')
       or public.is_paystack_test_fixture_course(course_row.id) then
      raise exception 'Only your published paid NGN courses can be added to a Test Mode subscription plan' using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.learning_subscription_plan_courses selected
      join public.learning_courses existing_course on existing_course.id = selected.course_id
      where selected.plan_id = new.plan_id
        and selected.course_id <> new.course_id
        and coalesce(existing_course.company_test_mode_only, false)
          is distinct from coalesce(course_row.company_test_mode_only, false)
    ) then
      raise exception 'Keep Company Test Mode-only courses in a separate Test Mode plan' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create or replace function public.validate_learning_subscription_plan()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  terms_row public.learning_commercial_terms%rowtype;
begin
  select * into terms_row
  from public.learning_commercial_terms terms
  where terms.version = new.commercial_terms_version
    and (
      (terms.scope_type = 'platform' and terms.instructor_id is null)
      or (terms.scope_type = 'instructor' and terms.instructor_id = new.instructor_id)
    );

  if not found then
    raise exception 'Subscription plan requires platform or matching instructor commercial terms' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and (
    old.instructor_id is distinct from new.instructor_id
    or old.amount_minor is distinct from new.amount_minor
    or old.currency is distinct from new.currency
    or old.billing_interval is distinct from new.billing_interval
    or old.commercial_terms_version is distinct from new.commercial_terms_version
    or old.payment_domain is distinct from new.payment_domain
  ) then
    raise exception 'Subscription plan identity and commercial terms are immutable; create a new plan' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.paystack_plan_code is not null
    and old.paystack_plan_code is distinct from new.paystack_plan_code then
    raise exception 'Paystack plan code is immutable once recorded' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and (
    (old.status = 'active' and new.status not in ('active','disabled'))
    or (old.status = 'disabled' and new.status <> 'disabled')
  ) then
    raise exception 'Subscription plan cannot be reactivated or returned to draft' using errcode = '42501';
  end if;

  if new.status = 'active' then
    if not terms_row.active or terms_row.effective_at > now() or terms_row.retired_at is not null then
      raise exception 'Subscription plan commercial terms are not currently active' using errcode = '23514';
    end if;
    if not exists (select 1 from public.learning_subscription_plan_courses item where item.plan_id = new.id) then
      raise exception 'A subscription plan must include at least one eligible course' using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.learning_subscription_plan_courses item
      join public.learning_courses course on course.id = item.course_id
      where item.plan_id = new.id
        and (
          course.status <> 'published'
          or course.is_free
          or coalesce(course.is_limited_time_free, false)
          or course.price_currency <> 'NGN'
          or course.price_amount <= 0
          or (coalesce(course.company_test_mode_only, false) and new.payment_domain <> 'test')
          or public.is_paystack_test_fixture_course(course.id)
          or public.resolve_learning_commercial_terms_version(course.id, course.instructor_id)
             is distinct from new.commercial_terms_version
        )
    ) then
      raise exception 'Subscription plan courses or commercial terms are no longer eligible' using errcode = '23514';
    end if;
    if (
      select count(distinct coalesce(course.company_test_mode_only, false))
      from public.learning_subscription_plan_courses item
      join public.learning_courses course on course.id = item.course_id
      where item.plan_id = new.id
    ) <> 1 then
      raise exception 'Keep Company Test Mode-only courses in a separate Test Mode plan' using errcode = '23514';
    end if;
  end if;

  if old.status is distinct from new.status then
    new.updated_at := now();
    if new.status = 'disabled' and new.disabled_at is null then new.disabled_at := now(); end if;
  end if;
  return new;
end;
$function$;

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
  course_mode_count integer;
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

  select count(*)::integer, count(distinct terms.version)::integer, min(terms.version),
    count(distinct coalesce(course.company_test_mode_only, false))::integer
  into eligible_count, terms_count, resolved_terms_version, course_mode_count
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
    and not public.is_paystack_test_fixture_course(course.id);

  if eligible_count <> requested_count then
    raise exception 'Every selected course must be your published paid NGN course; Paystack test fixtures are not eligible' using errcode = '42501';
  end if;
  if course_mode_count <> 1 then
    raise exception 'Keep Company Test Mode-only courses in a separate Test Mode plan' using errcode = '23514';
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
      'company_test_mode_only_course_ids', (
        select coalesce(array_agg(course.id order by course.id), '{}'::bigint[])
        from public.learning_courses course
        where course.id = any(p_course_ids) and coalesce(course.company_test_mode_only, false)
      ),
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

drop function public.list_own_learning_subscription_plan_courses();
create function public.list_own_learning_subscription_plan_courses()
returns table(
  course_id bigint,
  title text,
  price_amount numeric,
  currency text,
  commercial_terms_version text,
  company_test_mode_only boolean
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
    public.resolve_learning_commercial_terms_version(course.id, course.instructor_id),
    coalesce(course.company_test_mode_only, false)
  from public.learning_courses course
  where course.instructor_id = actor_id
    and course.organization_id is null
    and course.status = 'published'
    and not course.is_free
    and not coalesce(course.is_limited_time_free, false)
    and course.price_currency = 'NGN'
    and course.price_amount > 0
    and not public.is_paystack_test_fixture_course(course.id)
  order by course.title, course.id;
end;
$function$;

create or replace function public.claim_own_learning_subscription_plan_provisioning(p_plan_id uuid)
returns table(
  provisioning_state text,
  provisioning_id uuid,
  plan_name text,
  plan_description text,
  amount_minor bigint,
  existing_plan_code text,
  attempt_count integer
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := auth.uid();
  plan_row public.learning_subscription_plans%rowtype;
  provisioning_row public.learning_subscription_plan_provisioning%rowtype;
  new_provisioning_id uuid;
  claim_acquired boolean := false;
  eligible_count integer;
  plan_course_count integer;
  course_mode_count integer;
begin
  if actor_id is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;

  select * into plan_row
  from public.learning_subscription_plans plan
  where plan.id = p_plan_id and plan.instructor_id = actor_id
  for update;
  if not found then raise exception 'Subscription plan is unavailable' using errcode = '42501'; end if;

  if plan_row.status = 'active' and plan_row.paystack_plan_code is not null then
    select * into provisioning_row
    from public.learning_subscription_plan_provisioning item
    where item.plan_id = p_plan_id and item.instructor_id = actor_id;
    if not found or provisioning_row.state <> 'recorded'
       or provisioning_row.paystack_plan_code <> plan_row.paystack_plan_code then
      raise exception 'Subscription plan provisioning needs reconciliation' using errcode = '23514';
    end if;
    return query select 'recorded', provisioning_row.id, plan_row.name, plan_row.description,
      plan_row.amount_minor, plan_row.paystack_plan_code, provisioning_row.attempt_count;
    return;
  end if;

  if plan_row.status <> 'draft' or plan_row.payment_domain <> 'test' or plan_row.paystack_plan_code is not null then
    raise exception 'Only an unprovisioned Test Mode draft can be submitted' using errcode = '23514';
  end if;

  select count(*)::integer, count(distinct coalesce(course.company_test_mode_only, false))::integer
  into eligible_count, course_mode_count
  from public.learning_subscription_plan_courses item
  join public.learning_courses course on course.id = item.course_id
  where item.plan_id = p_plan_id and item.instructor_id = actor_id
    and course.instructor_id = actor_id
    and course.organization_id is null
    and course.status = 'published'
    and not course.is_free
    and not coalesce(course.is_limited_time_free, false)
    and course.price_currency = 'NGN'
    and course.price_amount > 0
    and (not coalesce(course.company_test_mode_only, false) or plan_row.payment_domain = 'test')
    and not public.is_paystack_test_fixture_course(course.id)
    and public.resolve_learning_commercial_terms_version(course.id, actor_id) = plan_row.commercial_terms_version;
  select count(*)::integer into plan_course_count
  from public.learning_subscription_plan_courses item where item.plan_id = p_plan_id;

  if eligible_count = 0 or eligible_count <> plan_course_count or course_mode_count <> 1 then
    raise exception 'Plan courses or commercial terms are no longer eligible for Test Mode setup' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.learning_commercial_terms terms
    where terms.version = plan_row.commercial_terms_version
      and terms.active and terms.effective_at <= now() and terms.retired_at is null
      and ((terms.scope_type = 'platform' and terms.instructor_id is null)
        or (terms.scope_type = 'instructor' and terms.instructor_id = actor_id))
  ) then
    raise exception 'Subscription plan commercial terms are no longer active' using errcode = '23514';
  end if;

  insert into public.learning_subscription_plan_provisioning(plan_id, instructor_id)
  values (p_plan_id, actor_id)
  on conflict (plan_id) do nothing
  returning id into new_provisioning_id;
  claim_acquired := new_provisioning_id is not null;

  select * into provisioning_row
  from public.learning_subscription_plan_provisioning item
  where item.plan_id = p_plan_id and item.instructor_id = actor_id
  for update;

  if provisioning_row.state = 'claimed' and provisioning_row.claimed_at < now() - interval '5 minutes' then
    update public.learning_subscription_plan_provisioning item
    set state = 'needs_reconciliation', failure_code = 'provider_response_unconfirmed',
        completed_at = now(), updated_at = now()
    where item.plan_id = p_plan_id
    returning * into provisioning_row;
  elsif provisioning_row.state = 'failed' then
    update public.learning_subscription_plan_provisioning item
    set state = 'claimed', attempt_count = item.attempt_count + 1,
        claimed_at = now(), updated_at = now(), completed_at = null, failure_code = null
    where item.plan_id = p_plan_id
    returning * into provisioning_row;
    claim_acquired := true;
  end if;

  if provisioning_row.state = 'claimed' and claim_acquired then
    return query select 'claimed', provisioning_row.id, plan_row.name, plan_row.description,
      plan_row.amount_minor, null::text, provisioning_row.attempt_count;
  elsif provisioning_row.state = 'claimed' then
    return query select 'in_progress', provisioning_row.id, plan_row.name, plan_row.description,
      plan_row.amount_minor, null::text, provisioning_row.attempt_count;
  elsif provisioning_row.state = 'recorded' then
    return query select 'recorded', provisioning_row.id, plan_row.name, plan_row.description,
      plan_row.amount_minor, provisioning_row.paystack_plan_code, provisioning_row.attempt_count;
  else
    return query select provisioning_row.state, provisioning_row.id, plan_row.name, plan_row.description,
      plan_row.amount_minor, provisioning_row.paystack_plan_code, provisioning_row.attempt_count;
  end if;
end;
$function$;

revoke all on function public.list_own_learning_subscription_plan_courses()
  from public, anon;
grant execute on function public.list_own_learning_subscription_plan_courses()
  to authenticated, postgres, service_role;

commit;
