-- Phase 4: start Test Mode subscriptions through a durable, idempotent checkout.
-- This is additive and does not enable the feature or contact Paystack.

begin;

create table public.learning_subscription_checkout_attempts (
  request_id uuid primary key,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.learning_subscription_plans(id) on delete restrict,
  subscription_id uuid not null,
  invoice_id uuid not null,
  state text not null check (state in ('initializing','ready','retryable','needs_reconciliation')),
  authorization_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_subscription_checkout_attempt_subscription_fkey
    foreign key (subscription_id) references public.learning_subscriptions(id) on delete restrict,
  constraint learning_subscription_checkout_attempt_invoice_fkey
    foreign key (invoice_id, subscription_id)
    references public.learning_subscription_invoices(id, subscription_id) on delete restrict,
  constraint learning_subscription_checkout_attempt_state_check check (
    (state = 'ready' and authorization_url ~ '^https://checkout[.]paystack[.]com/[A-Za-z0-9_-]+$')
    or (state <> 'ready' and authorization_url is null)
  )
);

create index learning_subscription_checkout_attempt_subscription_idx
  on public.learning_subscription_checkout_attempts(subscription_id, created_at desc, request_id);
alter table public.learning_subscription_checkout_attempts enable row level security;
revoke all on public.learning_subscription_checkout_attempts from public, anon, authenticated, service_role;

create or replace function public.list_public_test_learning_subscription_plans_for_course(p_course_id bigint)
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
  where plan.status = 'active' and plan.payment_domain = 'test'
    and plan.currency = 'NGN' and plan.billing_interval = 'monthly'
    and plan.paystack_plan_code ~ '^PLN_[A-Za-z0-9]{8,100}$'
    and item.plan_id = plan.id
    and exists (
      select 1 from public.learning_subscription_plan_courses selected
      where selected.plan_id = plan.id and selected.course_id = p_course_id
    )
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
    join public.learning_courses eligible on eligible.id = expected.course_id
    where expected.plan_id = plan.id
      and eligible.instructor_id = plan.instructor_id
      and eligible.organization_id is null and eligible.status = 'published'
      and not eligible.is_free and not coalesce(eligible.is_limited_time_free, false)
      and eligible.price_currency = 'NGN' and eligible.price_amount > 0
      and not coalesce(eligible.company_test_mode_only, false)
      and not public.is_paystack_test_fixture_course(eligible.id)
  )
  order by plan.created_at desc, plan.id desc;
$function$;

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
  attempt_id uuid;
  eligible_count integer;
  plan_course_count integer;
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

  select count(*)::integer into plan_course_count
  from public.learning_subscription_plan_courses item where item.plan_id = p_plan_id;
  select count(*)::integer into eligible_count
  from public.learning_subscription_plan_courses item
  join public.learning_courses course on course.id = item.course_id
  where item.plan_id = p_plan_id and item.instructor_id = plan_row.instructor_id
    and course.instructor_id = plan_row.instructor_id and course.organization_id is null
    and course.status = 'published' and not course.is_free
    and not coalesce(course.is_limited_time_free, false)
    and course.price_currency = 'NGN' and course.price_amount > 0
    and not coalesce(course.company_test_mode_only, false)
    and not public.is_paystack_test_fixture_course(course.id)
    and public.resolve_learning_commercial_terms_version(course.id, plan_row.instructor_id) = plan_row.commercial_terms_version;
  if plan_course_count < 1 or eligible_count <> plan_course_count then
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

create or replace function public.finish_own_learning_test_subscription_checkout(
  p_request_id uuid,
  p_outcome text,
  p_authorization_url text default null
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  attempt_row public.learning_subscription_checkout_attempts%rowtype;
begin
  if p_request_id is null or p_outcome not in ('ready','rejected','ambiguous') then
    raise exception 'Subscription checkout result is invalid' using errcode = '22023';
  end if;
  select * into attempt_row from public.learning_subscription_checkout_attempts attempt
  where attempt.request_id = p_request_id for update;
  if not found then raise exception 'Subscription checkout reservation is unavailable' using errcode = 'P0002'; end if;

  if p_outcome = 'ready' then
    if p_authorization_url is null or p_authorization_url !~ '^https://checkout[.]paystack[.]com/[A-Za-z0-9_-]+$' then
      raise exception 'Paystack checkout URL is invalid' using errcode = '22023';
    end if;
    if attempt_row.state = 'ready' then
      if attempt_row.authorization_url <> p_authorization_url then
        raise exception 'Subscription checkout URL cannot be replaced' using errcode = '23514';
      end if;
      return 'ready';
    end if;
    if attempt_row.state <> 'initializing' then
      raise exception 'Subscription checkout is no longer initializing' using errcode = '23514';
    end if;
    update public.learning_subscription_checkout_attempts attempt
    set state = 'ready', authorization_url = p_authorization_url, updated_at = now()
    where attempt.request_id = p_request_id;
    update public.learning_subscription_invoices invoice
    set status = 'payment_pending'
    where invoice.id = attempt_row.invoice_id and invoice.status = 'created';
    return 'ready';
  end if;

  if attempt_row.state <> 'initializing' then return attempt_row.state; end if;
  update public.learning_subscription_checkout_attempts attempt
  set state = case when p_outcome = 'rejected' then 'retryable' else 'needs_reconciliation' end,
      authorization_url = null, updated_at = now()
  where attempt.request_id = p_request_id
  returning state into p_outcome;
  return p_outcome;
end;
$function$;

create or replace function public.get_own_learning_subscription_payment_status(p_reference text)
returns table(invoice_status text, plan_name text, paid_through timestamptz, subscription_status text, access_active boolean, course_titles text[])
language sql
stable
security definer
set search_path to ''
as $function$
  select invoice.status, invoice.plan_name_snapshot, invoice.paid_through, subscription.status,
    invoice.status = 'paid' and subscription.status in ('active','non_renewing','attention','cancelled','completed')
      and now() >= invoice.billing_period_starts_at and now() < invoice.paid_through,
    coalesce(array_agg(item.course_title_snapshot order by item.course_title_snapshot), '{}'::text[])
  from public.learning_subscription_invoices invoice
  join public.learning_subscriptions subscription on subscription.id = invoice.subscription_id
  left join public.learning_subscription_invoice_courses item on item.invoice_id = invoice.id
  where auth.uid() is not null and subscription.learner_id = auth.uid()
    and subscription.payment_domain = 'test' and invoice.payment_domain = 'test'
    and invoice.provider_reference = p_reference
  group by invoice.id, subscription.id;
$function$;

create or replace function public.finalize_learning_test_subscription_initial_period(
  p_subscription_id uuid,
  p_invoice_id uuid,
  p_provider_transaction_id text,
  p_paid_at timestamptz
)
returns table(outcome text, billing_period_starts_at timestamptz, paid_through timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  invoice_row public.learning_subscription_invoices%rowtype;
  subscription_row public.learning_subscriptions%rowtype;
  resolved_paid_at timestamptz;
  resolved_paid_through timestamptz;
  renewal_month timestamptz;
  renewal_day integer;
begin
  if p_subscription_id is null or p_invoice_id is null
     or p_provider_transaction_id is null
     or p_provider_transaction_id !~ '^[1-9][0-9]{0,39}$' then
    raise exception 'Initial subscription payment identity is invalid' using errcode = '22023';
  end if;
  select * into subscription_row from public.learning_subscriptions subscription
  where subscription.id = p_subscription_id and subscription.payment_domain = 'test'
  for update;
  if not found then raise exception 'Test subscription was not found' using errcode = '23503'; end if;
  select * into invoice_row from public.learning_subscription_invoices invoice
  where invoice.id = p_invoice_id and invoice.subscription_id = p_subscription_id
    and invoice.payment_domain = 'test'
  for update;
  if not found or invoice_row.status <> 'paid'
     or invoice_row.provider_invoice_code is not null
     or invoice_row.provider_transaction_id <> p_provider_transaction_id
     or invoice_row.paid_at is null then
    raise exception 'Verified initial payment does not match its local invoice' using errcode = '23514';
  end if;
  resolved_paid_at := coalesce(p_paid_at, invoice_row.paid_at);
  if abs(extract(epoch from (invoice_row.paid_at - resolved_paid_at))) > 1 then
    raise exception 'Verified initial payment time does not match its local invoice' using errcode = '23514';
  end if;

  -- Paystack bills monthly on the original day through day 28; dates 29–31
  -- are moved to day 28 for subsequent months. Preserve the UTC time of charge.
  renewal_month := date_trunc('month', resolved_paid_at) + interval '1 month';
  renewal_day := least(extract(day from resolved_paid_at)::integer, 28);
  resolved_paid_through := renewal_month + make_interval(days => renewal_day - 1)
    + (resolved_paid_at - date_trunc('day', resolved_paid_at));

  if exists (
    select 1 from public.learning_subscription_invoices other_invoice
    where other_invoice.subscription_id = p_subscription_id
      and other_invoice.id <> p_invoice_id
      and other_invoice.billing_period_starts_at = resolved_paid_at
  ) then
    raise exception 'Initial subscription period conflicts with an existing invoice' using errcode = '23505';
  end if;

  update public.learning_subscription_invoices invoice
  set billing_period_starts_at = resolved_paid_at, paid_through = resolved_paid_through
  where invoice.id = p_invoice_id;
  update public.learning_subscriptions subscription
  set current_period_starts_at = case when subscription.paid_through is null or subscription.paid_through <= resolved_paid_through
        then resolved_paid_at else subscription.current_period_starts_at end,
      paid_through = case when subscription.paid_through is null or subscription.paid_through <= resolved_paid_through
        then resolved_paid_through else subscription.paid_through end,
      updated_at = now()
  where subscription.id = p_subscription_id;

  return query select 'finalized'::text, resolved_paid_at, resolved_paid_through;
end;
$function$;

create or replace function public.prevent_learning_subscription_checkout_attempt_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Subscription checkout history cannot be deleted' using errcode = '42501';
  end if;
  if old.request_id <> new.request_id or old.learner_id <> new.learner_id
     or old.plan_id <> new.plan_id or old.subscription_id <> new.subscription_id
     or old.invoice_id <> new.invoice_id or old.created_at <> new.created_at
     or (old.state = 'ready' and (new.state <> 'ready' or new.authorization_url <> old.authorization_url))
     or (old.state = 'needs_reconciliation' and new.state <> 'needs_reconciliation') then
    raise exception 'Subscription checkout history cannot be replaced or reopened' using errcode = '42501';
  end if;
  return new;
end;
$function$;

create trigger prevent_learning_subscription_checkout_attempt_mutation
before update or delete on public.learning_subscription_checkout_attempts
for each row execute function public.prevent_learning_subscription_checkout_attempt_mutation();

revoke all on function public.list_public_test_learning_subscription_plans_for_course(bigint),
  public.begin_own_learning_test_subscription_checkout(uuid,uuid,uuid),
  public.finish_own_learning_test_subscription_checkout(uuid,text,text),
  public.get_own_learning_subscription_payment_status(text),
  public.finalize_learning_test_subscription_initial_period(uuid,uuid,text,timestamptz),
  public.prevent_learning_subscription_checkout_attempt_mutation()
from public, anon, authenticated, service_role;
grant execute on function public.list_public_test_learning_subscription_plans_for_course(bigint)
  to authenticated, postgres;
grant execute on function public.begin_own_learning_test_subscription_checkout(uuid,uuid,uuid),
  public.finish_own_learning_test_subscription_checkout(uuid,text,text)
  to service_role, postgres;
grant execute on function public.get_own_learning_subscription_payment_status(text)
  to authenticated, postgres;
grant execute on function public.finalize_learning_test_subscription_initial_period(uuid,uuid,text,timestamptz)
  to service_role, postgres;

commit;
