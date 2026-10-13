-- Phase 4: private, Test Mode-only subscription records.
-- This migration adds storage and invariants only. It does not change checkout,
-- course access, earnings, refunds, or Paystack configuration.

begin;

create table public.learning_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 3 and 100),
  description text check (description is null or char_length(description) <= 1000),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  billing_interval text not null default 'monthly' check (billing_interval = 'monthly'),
  commercial_terms_version text not null references public.learning_commercial_terms(version) on delete restrict,
  payment_domain text not null default 'test' check (payment_domain = 'test'),
  paystack_plan_code text,
  status text not null default 'draft' check (status in ('draft','active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  constraint learning_subscription_plans_id_instructor_key unique (id, instructor_id),
  constraint learning_subscription_plans_provider_code_check check (
    paystack_plan_code is null or char_length(btrim(paystack_plan_code)) between 4 and 100
  ),
  constraint learning_subscription_plans_disabled_check check (
    (status <> 'disabled' and disabled_at is null)
    or (status = 'disabled' and disabled_at is not null)
  )
);

create unique index learning_subscription_plans_paystack_code_key
  on public.learning_subscription_plans(paystack_plan_code)
  where paystack_plan_code is not null;
create index learning_subscription_plans_instructor_status_idx
  on public.learning_subscription_plans(instructor_id, status, created_at desc);

create table public.learning_subscription_plan_courses (
  plan_id uuid not null,
  instructor_id uuid not null,
  course_id bigint not null references public.learning_courses(id) on delete restrict,
  added_at timestamptz not null default now(),
  primary key (plan_id, course_id),
  constraint learning_subscription_plan_courses_plan_fkey
    foreign key (plan_id, instructor_id)
    references public.learning_subscription_plans(id, instructor_id) on delete restrict
);

create index learning_subscription_plan_courses_course_idx
  on public.learning_subscription_plan_courses(course_id, plan_id);

create table public.learning_subscriptions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.learning_subscription_plans(id) on delete restrict,
  learner_id uuid not null references public.profiles(id) on delete restrict,
  payment_domain text not null default 'test' check (payment_domain = 'test'),
  paystack_customer_code text,
  paystack_subscription_code text,
  status text not null default 'pending'
    check (status in ('pending','active','non_renewing','attention','cancelled','completed','expired')),
  current_period_starts_at timestamptz,
  paid_through timestamptz,
  cancel_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_subscriptions_period_check check (
    (current_period_starts_at is null and paid_through is null)
    or (current_period_starts_at is not null and paid_through is not null and paid_through > current_period_starts_at)
  ),
  constraint learning_subscriptions_paid_state_check check (
    (status = 'pending' and current_period_starts_at is null and paid_through is null)
    or (status <> 'pending' and current_period_starts_at is not null and paid_through is not null)
  ),
  constraint learning_subscriptions_cancel_timestamp_check check (
    (status not in ('non_renewing','cancelled') or cancel_requested_at is not null)
  )
);

create unique index learning_subscriptions_paystack_code_key
  on public.learning_subscriptions(paystack_subscription_code)
  where paystack_subscription_code is not null;
create index learning_subscriptions_learner_status_idx
  on public.learning_subscriptions(learner_id, status, paid_through desc);
create index learning_subscriptions_plan_status_idx
  on public.learning_subscriptions(plan_id, status, created_at desc);

create table public.learning_subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.learning_subscriptions(id) on delete restrict,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  plan_name_snapshot text not null check (char_length(btrim(plan_name_snapshot)) between 3 and 100),
  billing_period_starts_at timestamptz not null,
  paid_through timestamptz not null,
  provider_reference text not null unique check (provider_reference ~ '^GS-[A-F0-9]{32}$'),
  payment_domain text not null default 'test' check (payment_domain = 'test'),
  amount_minor bigint not null check (amount_minor > 0),
  platform_share_minor bigint not null check (platform_share_minor >= 0),
  seller_share_minor bigint not null check (seller_share_minor >= 0),
  fees_minor bigint check (fees_minor is null or fees_minor >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  commercial_terms_version text not null references public.learning_commercial_terms(version) on delete restrict,
  provider_transaction_id text,
  status text not null default 'created'
    check (status in ('created','payment_pending','paid','failed','partially_refunded','refunded','chargeback')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  terminal_at timestamptz,
  constraint learning_subscription_invoices_split_check check (
    amount_minor = platform_share_minor + seller_share_minor
  ),
  constraint learning_subscription_invoices_period_check check (paid_through > billing_period_starts_at),
  constraint learning_subscription_invoices_transaction_check check (
    provider_transaction_id is null or provider_transaction_id ~ '^[1-9][0-9]{0,39}$'
  ),
  constraint learning_subscription_invoices_status_timestamp_check check (
    (status in ('created','payment_pending') and paid_at is null and terminal_at is null)
    or (status = 'paid' and paid_at is not null and terminal_at is null)
    or (status = 'failed' and paid_at is null and terminal_at is not null)
    or (status in ('partially_refunded','refunded','chargeback') and paid_at is not null and terminal_at is not null)
  ),
  constraint learning_subscription_invoices_id_subscription_key unique (id, subscription_id),
  constraint learning_subscription_invoices_period_key unique (subscription_id, billing_period_starts_at)
);

create unique index learning_subscription_invoices_transaction_key
  on public.learning_subscription_invoices(provider_transaction_id)
  where provider_transaction_id is not null;
create index learning_subscription_invoices_instructor_created_idx
  on public.learning_subscription_invoices(instructor_id, created_at desc, id desc);

create table public.learning_subscription_invoice_courses (
  invoice_id uuid not null references public.learning_subscription_invoices(id) on delete restrict,
  course_id bigint not null references public.learning_courses(id) on delete restrict,
  course_title_snapshot text not null check (char_length(btrim(course_title_snapshot)) between 1 and 200),
  primary key (invoice_id, course_id)
);

create table public.learning_subscription_provider_events (
  id bigint generated by default as identity primary key,
  provider_event_id text not null unique check (char_length(btrim(provider_event_id)) between 1 and 160),
  event_type text not null check (event_type ~ '^[a-zA-Z0-9_.:-]{2,100}$'),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  sanitized_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(sanitized_payload) = 'object'),
  signature_valid boolean not null,
  payment_domain text not null default 'test' check (payment_domain = 'test'),
  subscription_id uuid not null,
  invoice_id uuid,
  processing_status text not null default 'received'
    check (processing_status in ('received','processed','ignored','failed')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text check (processing_error is null or char_length(processing_error) <= 2000),
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  constraint learning_subscription_provider_events_subscription_fkey
    foreign key (subscription_id) references public.learning_subscriptions(id) on delete restrict,
  constraint learning_subscription_provider_events_invoice_fkey
    foreign key (invoice_id, subscription_id)
    references public.learning_subscription_invoices(id, subscription_id) on delete restrict,
  constraint learning_subscription_provider_events_processing_check check (
    (processing_status = 'received' and processed_at is null)
    or (processing_status <> 'received' and processed_at is not null)
  )
);

create index learning_subscription_provider_events_status_idx
  on public.learning_subscription_provider_events(processing_status, received_at, id);
create index learning_subscription_provider_events_subscription_idx
  on public.learning_subscription_provider_events(subscription_id, received_at desc, id desc);

create or replace function public.validate_learning_subscription_plan_course()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare plan_row record;
begin
  select plan.instructor_id, plan.status
  into plan_row
  from public.learning_subscription_plans plan
  where plan.id = case when tg_op = 'DELETE' then old.plan_id else new.plan_id end
  for update;

  if not found or plan_row.status <> 'draft' then
    raise exception 'Subscription plan courses can only change while the plan is a draft' using errcode = '23514';
  end if;

  if tg_op <> 'DELETE' and (
    new.instructor_id <> plan_row.instructor_id
    or not exists (
      select 1 from public.learning_courses course
      where course.id = new.course_id
        and course.instructor_id = plan_row.instructor_id
        and course.organization_id is null
        and course.status = 'published'
        and not course.is_free
        and not coalesce(course.is_limited_time_free, false)
        and course.price_currency = 'NGN'
        and course.price_amount > 0
        and not coalesce(course.company_test_mode_only, false)
        and not public.is_paystack_test_fixture_course(course.id)
    )
  ) then
    raise exception 'Only the instructor’s published public paid NGN courses can be added to a subscription plan' using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

create trigger validate_learning_subscription_plan_course
  before insert or update or delete on public.learning_subscription_plan_courses
  for each row execute function public.validate_learning_subscription_plan_course();

create or replace function public.validate_learning_subscription_plan()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare terms_row public.learning_commercial_terms%rowtype;
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
          or coalesce(course.company_test_mode_only, false)
          or public.is_paystack_test_fixture_course(course.id)
          or public.resolve_learning_commercial_terms_version(course.id, course.instructor_id)
             is distinct from new.commercial_terms_version
        )
    ) then
      raise exception 'Subscription plan courses or commercial terms are no longer eligible' using errcode = '23514';
    end if;
  end if;

  if old.status is distinct from new.status then
    new.updated_at := now();
    if new.status = 'disabled' and new.disabled_at is null then new.disabled_at := now(); end if;
  end if;
  return new;
end;
$function$;

create trigger validate_learning_subscription_plan
  before insert or update on public.learning_subscription_plans
  for each row execute function public.validate_learning_subscription_plan();

create or replace function public.prevent_learning_subscription_history_delete()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  raise exception 'Subscription financial history cannot be deleted' using errcode = '42501';
end;
$function$;

create trigger prevent_learning_subscription_delete
  before delete on public.learning_subscriptions
  for each row execute function public.prevent_learning_subscription_history_delete();
create trigger prevent_learning_subscription_invoice_delete
  before delete on public.learning_subscription_invoices
  for each row execute function public.prevent_learning_subscription_history_delete();
create trigger prevent_learning_subscription_event_delete
  before delete on public.learning_subscription_provider_events
  for each row execute function public.prevent_learning_subscription_history_delete();

alter table public.learning_subscription_plans enable row level security;
alter table public.learning_subscription_plan_courses enable row level security;
alter table public.learning_subscriptions enable row level security;
alter table public.learning_subscription_invoices enable row level security;
alter table public.learning_subscription_invoice_courses enable row level security;
alter table public.learning_subscription_provider_events enable row level security;

revoke all on public.learning_subscription_plans,
  public.learning_subscription_plan_courses,
  public.learning_subscriptions,
  public.learning_subscription_invoices,
  public.learning_subscription_invoice_courses,
  public.learning_subscription_provider_events
from public, anon, authenticated, service_role;

revoke all on function public.validate_learning_subscription_plan_course(),
  public.validate_learning_subscription_plan(),
  public.prevent_learning_subscription_history_delete()
from public, anon, authenticated, service_role;

commit;
