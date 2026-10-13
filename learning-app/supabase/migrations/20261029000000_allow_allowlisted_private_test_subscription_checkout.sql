-- Private Company Test Mode courses can use the learner subscription checkout
-- only through the server-side allowlisted test route. The public plan listing
-- remains unchanged and continues to exclude these courses.

begin;

create or replace function public.get_company_test_learning_subscription_plan_for_checkout(p_plan_id uuid)
returns table(
  plan_id uuid,
  name text,
  description text,
  amount_minor bigint,
  currency text,
  billing_interval text,
  instructor_name text,
  course_ids bigint[],
  course_titles text[]
)
language sql
stable
security definer
set search_path to ''
as $function$
  select plan.id, plan.name, plan.description, plan.amount_minor, plan.currency,
    plan.billing_interval, coalesce(nullif(btrim(profile.full_name), ''), 'Growvelt Instructor'),
    array_agg(item.course_id order by item.course_id),
    array_agg(course.title order by item.course_id)
  from public.learning_subscription_plans plan
  join public.profiles profile on profile.id = plan.instructor_id
  join public.learning_subscription_plan_courses item on item.plan_id = plan.id
  join public.learning_courses course on course.id = item.course_id
  where plan.id = p_plan_id
    and plan.status = 'active' and plan.payment_domain = 'test'
    and plan.currency = 'NGN' and plan.billing_interval = 'monthly'
    and plan.paystack_plan_code ~ '^PLN_[A-Za-z0-9]{8,100}$'
    and course.instructor_id = plan.instructor_id
    and item.instructor_id = plan.instructor_id
    and course.organization_id is null
    and course.status = 'published'
    and not course.is_free
    and not coalesce(course.is_limited_time_free, false)
    and course.price_currency = 'NGN' and course.price_amount > 0
    and coalesce(course.company_test_mode_only, false)
    and not public.is_paystack_test_fixture_course(course.id)
    and public.resolve_learning_commercial_terms_version(course.id, plan.instructor_id) = plan.commercial_terms_version
    and exists (
      select 1 from public.learning_commercial_terms terms
      where terms.version = plan.commercial_terms_version and terms.active
        and terms.effective_at <= now() and terms.retired_at is null
        and ((terms.scope_type = 'platform' and terms.instructor_id is null)
          or (terms.scope_type = 'instructor' and terms.instructor_id = plan.instructor_id))
    )
  group by plan.id, profile.full_name
  having count(*) = (
    select count(*) from public.learning_subscription_plan_courses expected
    where expected.plan_id = plan.id
  )
  and count(distinct coalesce(course.company_test_mode_only, false)) = 1
  order by plan.created_at desc, plan.id desc;
$function$;

revoke all on function public.get_company_test_learning_subscription_plan_for_checkout(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_company_test_learning_subscription_plan_for_checkout(uuid)
  to service_role, postgres;

-- Preserve the existing reservation/idempotency state machine. The only
-- eligibility change is to permit a plan's uniformly private test courses;
-- payment_domain remains strictly Test Mode and fixture courses stay blocked.
create or replace function public.begin_own_learning_test_subscription_checkout(
  p_learner_id uuid,
  p_plan_id uuid,
  p_request_id uuid
)
returns table(
  outcome text,
  subscription_id uuid,
  invoice_id uuid,
  reference text,
  amount_minor bigint,
  plan_code text,
  authorization_url text
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  attempt_row public.learning_subscription_checkout_attempts%rowtype;
  plan_row public.learning_subscription_plans%rowtype;
  subscription_row public.learning_subscriptions%rowtype;
  invoice_row public.learning_subscription_invoices%rowtype;
  latest_attempt public.learning_subscription_checkout_attempts%rowtype;
  terms_row public.learning_commercial_terms%rowtype;
  eligible_count integer;
  plan_course_count integer;
  course_mode_count integer;
  platform_share bigint;
  resolved_subscription_id uuid;
  resolved_invoice_id uuid;
  resolved_outcome text;
begin
  if p_learner_id is null or p_plan_id is null or p_request_id is null
     or not exists (select 1 from public.profiles profile where profile.id = p_learner_id) then
    raise exception 'Subscription checkout request is invalid' using errcode = '22023';
  end if;

  select * into attempt_row
  from public.learning_subscription_checkout_attempts attempt
  where attempt.request_id = p_request_id
  for update;
  if found then
    if attempt_row.learner_id <> p_learner_id or attempt_row.plan_id <> p_plan_id then
      raise exception 'Subscription checkout request does not match its reservation' using errcode = '42501';
    end if;
    if attempt_row.state = 'retryable' then
      update public.learning_subscription_checkout_attempts attempt
      set state = 'initializing', updated_at = now()
      where attempt.request_id = p_request_id
      returning * into attempt_row;
      resolved_outcome := 'initialize';
    else
      resolved_outcome := case attempt_row.state
        when 'ready' then 'ready'
        when 'needs_reconciliation' then 'needs_reconciliation'
        else 'in_progress' end;
    end if;
    select invoice.provider_reference, invoice.amount_minor
    into reference, amount_minor
    from public.learning_subscription_invoices invoice
    where invoice.id = attempt_row.invoice_id;
    select plan.paystack_plan_code into plan_code
    from public.learning_subscription_plans plan where plan.id = p_plan_id;
    return query select resolved_outcome, attempt_row.subscription_id, attempt_row.invoice_id,
      reference, amount_minor, plan_code, attempt_row.authorization_url;
    return;
  end if;

  select * into plan_row
  from public.learning_subscription_plans plan
  where plan.id = p_plan_id
  for update;
  if not found or plan_row.status <> 'active' or plan_row.payment_domain <> 'test'
     or plan_row.currency <> 'NGN' or plan_row.billing_interval <> 'monthly'
     or plan_row.paystack_plan_code is null
     or plan_row.paystack_plan_code !~ '^PLN_[A-Za-z0-9]{8,100}$' then
    raise exception 'This Test Mode subscription plan is not available' using errcode = '42501';
  end if;

  select count(*)::integer,
    count(distinct coalesce(course.company_test_mode_only, false))::integer
  into plan_course_count, course_mode_count
  from public.learning_subscription_plan_courses item
  join public.learning_courses course on course.id = item.course_id
  where item.plan_id = p_plan_id;
  select count(*)::integer into eligible_count
  from public.learning_subscription_plan_courses item
  join public.learning_courses course on course.id = item.course_id
  where item.plan_id = p_plan_id and item.instructor_id = plan_row.instructor_id
    and course.instructor_id = plan_row.instructor_id and course.organization_id is null
    and course.status = 'published' and not course.is_free
    and not coalesce(course.is_limited_time_free, false)
    and course.price_currency = 'NGN' and course.price_amount > 0
    and not public.is_paystack_test_fixture_course(course.id)
    and public.resolve_learning_commercial_terms_version(course.id, plan_row.instructor_id) = plan_row.commercial_terms_version;
  if plan_course_count < 1 or eligible_count <> plan_course_count or course_mode_count <> 1 then
    raise exception 'Subscription plan courses are no longer eligible' using errcode = '23514';
  end if;

  select * into terms_row from public.learning_commercial_terms terms
  where terms.version = plan_row.commercial_terms_version and terms.active
    and terms.effective_at <= now() and terms.retired_at is null
    and ((terms.scope_type = 'platform' and terms.instructor_id is null)
      or (terms.scope_type = 'instructor' and terms.instructor_id = plan_row.instructor_id));
  if not found then raise exception 'Subscription commercial terms are no longer active' using errcode = '23514'; end if;

  select * into subscription_row
  from public.learning_subscriptions subscription
  where subscription.plan_id = p_plan_id and subscription.learner_id = p_learner_id
    and (subscription.status = 'pending'
      or (subscription.status in ('active','non_renewing','attention','cancelled','completed')
        and subscription.paid_through > now()))
  order by subscription.created_at desc, subscription.id desc
  limit 1 for update;

  if found then
    resolved_subscription_id := subscription_row.id;
    if subscription_row.status <> 'pending' then
      return query select 'already_subscribed', subscription_row.id, null::uuid, null::text,
        plan_row.amount_minor, plan_row.paystack_plan_code, null::text;
      return;
    end if;

    select * into invoice_row
    from public.learning_subscription_invoices invoice
    where invoice.subscription_id = subscription_row.id
      and invoice.status in ('created','payment_pending')
    order by invoice.created_at desc, invoice.id desc
    limit 1 for update;
    if not found then
      return query select 'needs_reconciliation', subscription_row.id, null::uuid, null::text,
        plan_row.amount_minor, plan_row.paystack_plan_code, null::text;
      return;
    end if;
    resolved_invoice_id := invoice_row.id;

    select * into latest_attempt
    from public.learning_subscription_checkout_attempts attempt
    where attempt.subscription_id = resolved_subscription_id
    order by case when attempt.state = 'retryable' then 1 else 0 end,
      attempt.created_at desc, attempt.request_id desc
    limit 1 for update;
    if not found then
      resolved_outcome := 'needs_reconciliation';
    elsif latest_attempt.state = 'ready' then
      return query select 'ready', resolved_subscription_id, resolved_invoice_id,
        invoice_row.provider_reference, invoice_row.amount_minor, plan_row.paystack_plan_code,
        latest_attempt.authorization_url;
      return;
    elsif latest_attempt.state = 'needs_reconciliation' then
      resolved_outcome := 'needs_reconciliation';
    elsif latest_attempt.state = 'initializing' and latest_attempt.updated_at < now() - interval '5 minutes' then
      update public.learning_subscription_checkout_attempts attempt
      set state = 'needs_reconciliation', updated_at = now()
      where attempt.request_id = latest_attempt.request_id;
      resolved_outcome := 'needs_reconciliation';
    elsif latest_attempt.state = 'initializing' then
      resolved_outcome := 'in_progress';
    else
      insert into public.learning_subscription_checkout_attempts(
        request_id, learner_id, plan_id, subscription_id, invoice_id, state
      ) values (p_request_id, p_learner_id, p_plan_id, resolved_subscription_id, resolved_invoice_id, 'initializing');
      resolved_outcome := 'initialize';
    end if;

    if resolved_outcome = 'initialize' then
      insert into public.learning_audit_events(
        actor_user_id, actor_role, action, entity_type, entity_id, metadata
      ) values (p_learner_id, 'learner', 'subscription.checkout_initialization_claimed',
        'learning_subscription', resolved_subscription_id::text,
        jsonb_build_object('payment_domain','test','plan_id',p_plan_id));
    end if;
    return query select resolved_outcome, resolved_subscription_id, resolved_invoice_id,
      invoice_row.provider_reference, invoice_row.amount_minor, plan_row.paystack_plan_code, null::text;
    return;
  end if;

  insert into public.learning_subscriptions(plan_id, learner_id, payment_domain, status)
  values (p_plan_id, p_learner_id, 'test', 'pending')
  returning id into resolved_subscription_id;

  platform_share := round(plan_row.amount_minor * terms_row.commission_basis_points / 10000.0)::bigint;
  insert into public.learning_subscription_invoices(
    subscription_id, instructor_id, plan_name_snapshot, billing_period_starts_at, paid_through,
    provider_reference, amount_minor, platform_share_minor, seller_share_minor,
    currency, commercial_terms_version, status
  ) values (
    resolved_subscription_id, plan_row.instructor_id, plan_row.name, now(), now() + interval '1 month',
    'GS-' || upper(replace(gen_random_uuid()::text, '-', '')), plan_row.amount_minor,
    platform_share, plan_row.amount_minor - platform_share,
    'NGN', plan_row.commercial_terms_version, 'created'
  ) returning id into resolved_invoice_id;

  insert into public.learning_subscription_invoice_courses(invoice_id, course_id, course_title_snapshot)
  select resolved_invoice_id, item.course_id, course.title
  from public.learning_subscription_plan_courses item
  join public.learning_courses course on course.id = item.course_id
  where item.plan_id = p_plan_id;
  if not exists (select 1 from public.learning_subscription_invoice_courses item where item.invoice_id = resolved_invoice_id) then
    raise exception 'Subscription invoice course snapshot is unavailable' using errcode = '23514';
  end if;

  insert into public.learning_subscription_checkout_attempts(
    request_id, learner_id, plan_id, subscription_id, invoice_id, state
  ) values (p_request_id, p_learner_id, p_plan_id, resolved_subscription_id, resolved_invoice_id, 'initializing');
  insert into public.learning_audit_events(
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (p_learner_id, 'learner', 'subscription.checkout_initialization_claimed',
    'learning_subscription', resolved_subscription_id::text,
    jsonb_build_object('payment_domain','test','plan_id',p_plan_id,'invoice_id',resolved_invoice_id));

  return query select 'initialize', resolved_subscription_id, resolved_invoice_id,
    (select invoice.provider_reference from public.learning_subscription_invoices invoice where invoice.id = resolved_invoice_id),
    plan_row.amount_minor, plan_row.paystack_plan_code, null::text;
end;
$function$;

commit;
