-- Phase 4: serialize subscription plan provisioning before contacting Paystack.
-- A timed-out/uncertain provider request is parked for reconciliation rather
-- than retried, because Paystack plan creation has no application idempotency key.

begin;

create table public.learning_subscription_plan_provisioning (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique,
  instructor_id uuid not null,
  state text not null default 'claimed'
    constraint learning_subscription_plan_provisioning_allowed_state_check
    check (state in ('claimed','recorded','needs_reconciliation','failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  paystack_plan_code text,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_code text check (failure_code is null or failure_code in (
    'provider_rejected','provider_response_unconfirmed','database_confirmation_failed'
  )),
  constraint learning_subscription_plan_provisioning_plan_fkey
    foreign key (plan_id, instructor_id)
    references public.learning_subscription_plans(id, instructor_id) on delete restrict,
  constraint learning_subscription_plan_provisioning_code_check check (
    paystack_plan_code is null or paystack_plan_code ~ '^PLN_[A-Za-z0-9]{8,100}$'
  ),
  constraint learning_subscription_plan_provisioning_state_check check (
    (state = 'claimed' and completed_at is null and failure_code is null and paystack_plan_code is null)
    or (state = 'recorded' and completed_at is not null and failure_code is null and paystack_plan_code is not null)
    or (state = 'needs_reconciliation' and completed_at is not null and failure_code is not null and paystack_plan_code is null)
    or (state = 'failed' and completed_at is not null and failure_code = 'provider_rejected' and paystack_plan_code is null)
  )
);

create unique index learning_subscription_plan_provisioning_provider_code_key
  on public.learning_subscription_plan_provisioning(paystack_plan_code)
  where paystack_plan_code is not null;
create index learning_subscription_plan_provisioning_state_idx
  on public.learning_subscription_plan_provisioning(state, claimed_at);

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

  select count(*)::integer into eligible_count
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
    and not coalesce(course.company_test_mode_only, false)
    and not public.is_paystack_test_fixture_course(course.id)
    and public.resolve_learning_commercial_terms_version(course.id, actor_id) = plan_row.commercial_terms_version;
  if eligible_count = 0 or eligible_count <> (
    select count(*)::integer from public.learning_subscription_plan_courses item where item.plan_id = p_plan_id
  ) then
    raise exception 'Plan courses or commercial terms are no longer eligible' using errcode = '23514';
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

create or replace function public.record_own_learning_subscription_plan_provisioning(
  p_plan_id uuid,
  p_instructor_id uuid,
  p_paystack_plan_code text
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := p_instructor_id;
  plan_row public.learning_subscription_plans%rowtype;
  provisioning_row public.learning_subscription_plan_provisioning%rowtype;
begin
  if actor_id is null or not exists (
    select 1 from public.account_capabilities capability
    join public.instructor_profiles instructor on instructor.user_id = capability.user_id
    where capability.user_id = actor_id and capability.capability = 'instructor'
      and capability.status = 'active' and instructor.approval_status = 'approved'
  ) then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if p_paystack_plan_code is null or p_paystack_plan_code !~ '^PLN_[A-Za-z0-9]{8,100}$' then
    raise exception 'Paystack plan code is invalid' using errcode = '22023';
  end if;

  select * into plan_row from public.learning_subscription_plans plan
  where plan.id = p_plan_id and plan.instructor_id = actor_id for update;
  if not found then raise exception 'Subscription plan is unavailable' using errcode = '42501'; end if;
  select * into provisioning_row from public.learning_subscription_plan_provisioning item
  where item.plan_id = p_plan_id and item.instructor_id = actor_id for update;
  if not found then raise exception 'Subscription plan provisioning claim is unavailable' using errcode = '42501'; end if;

  if provisioning_row.state = 'recorded' then
    if provisioning_row.paystack_plan_code <> p_paystack_plan_code
       or plan_row.paystack_plan_code <> p_paystack_plan_code then
      raise exception 'Recorded Paystack plan code cannot be replaced' using errcode = '42501';
    end if;
    return 'recorded';
  end if;
  if provisioning_row.state <> 'claimed' then
    raise exception 'Subscription plan provisioning is not in a recordable state' using errcode = '23514';
  end if;
  if plan_row.status <> 'draft' or plan_row.payment_domain <> 'test' or plan_row.paystack_plan_code is not null then
    raise exception 'Subscription plan is no longer eligible for provisioning' using errcode = '23514';
  end if;

  update public.learning_subscription_plans plan
  set paystack_plan_code = p_paystack_plan_code, status = 'active'
  where plan.id = p_plan_id;
  update public.learning_subscription_plan_provisioning item
  set state = 'recorded', paystack_plan_code = p_paystack_plan_code,
      completed_at = now(), updated_at = now(), failure_code = null
  where item.plan_id = p_plan_id;
  insert into public.learning_audit_events(
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'instructor', 'subscription_plan.test_provider_plan_recorded',
    'learning_subscription_plan', p_plan_id::text,
    jsonb_build_object('payment_domain','test','billing_interval','monthly','amount_minor',plan_row.amount_minor)
  );
  return 'recorded';
end;
$function$;

create or replace function public.finish_own_learning_subscription_plan_provisioning(
  p_plan_id uuid,
  p_instructor_id uuid,
  p_outcome text
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  actor_id uuid := p_instructor_id;
  provisioning_row public.learning_subscription_plan_provisioning%rowtype;
  next_state text;
  next_failure_code text;
begin
  if actor_id is null or not exists (
    select 1 from public.account_capabilities capability
    join public.instructor_profiles instructor on instructor.user_id = capability.user_id
    where capability.user_id = actor_id and capability.capability = 'instructor'
      and capability.status = 'active' and instructor.approval_status = 'approved'
  ) then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  if p_outcome is null or p_outcome not in ('provider_rejected','ambiguous') then
    raise exception 'Provisioning outcome is invalid' using errcode = '22023';
  end if;

  select * into provisioning_row from public.learning_subscription_plan_provisioning item
  where item.plan_id = p_plan_id and item.instructor_id = actor_id for update;
  if not found then raise exception 'Subscription plan provisioning claim is unavailable' using errcode = '42501'; end if;
  if provisioning_row.state <> 'claimed' then return provisioning_row.state; end if;

  next_state := case when p_outcome = 'provider_rejected' then 'failed' else 'needs_reconciliation' end;
  next_failure_code := case when p_outcome = 'provider_rejected' then 'provider_rejected' else 'provider_response_unconfirmed' end;
  update public.learning_subscription_plan_provisioning item
  set state = next_state, failure_code = next_failure_code, completed_at = now(), updated_at = now()
  where item.plan_id = p_plan_id;
  insert into public.learning_audit_events(
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    actor_id, 'instructor', 'subscription_plan.test_provider_plan_' || next_state,
    'learning_subscription_plan', p_plan_id::text,
    jsonb_build_object('payment_domain','test','failure_code',next_failure_code)
  );
  return next_state;
end;
$function$;

create or replace function public.list_own_learning_subscription_plan_provisioning()
returns table(plan_id uuid, provisioning_state text, attempt_count integer)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.is_approved_growvelt_instructor() then
    raise exception 'Approved Instructor capability required' using errcode = '42501';
  end if;
  return query
  select item.plan_id, item.state, item.attempt_count
  from public.learning_subscription_plan_provisioning item
  where item.instructor_id = actor_id;
end;
$function$;

create or replace function public.prevent_learning_subscription_plan_provisioning_delete()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  raise exception 'Subscription plan provisioning history cannot be deleted' using errcode = '42501';
end;
$function$;
create trigger prevent_learning_subscription_plan_provisioning_delete
  before delete on public.learning_subscription_plan_provisioning
  for each row execute function public.prevent_learning_subscription_plan_provisioning_delete();

alter table public.learning_subscription_plan_provisioning enable row level security;
revoke all on public.learning_subscription_plan_provisioning from public, anon, authenticated, service_role;
revoke all on function public.claim_own_learning_subscription_plan_provisioning(uuid),
  public.record_own_learning_subscription_plan_provisioning(uuid,uuid,text),
  public.finish_own_learning_subscription_plan_provisioning(uuid,uuid,text),
  public.list_own_learning_subscription_plan_provisioning(),
  public.prevent_learning_subscription_plan_provisioning_delete()
from public, anon, authenticated, service_role;
grant execute on function public.claim_own_learning_subscription_plan_provisioning(uuid),
  public.list_own_learning_subscription_plan_provisioning()
to authenticated, postgres;
grant execute on function public.record_own_learning_subscription_plan_provisioning(uuid,uuid,text),
  public.finish_own_learning_subscription_plan_provisioning(uuid,uuid,text)
to postgres, service_role;

commit;
