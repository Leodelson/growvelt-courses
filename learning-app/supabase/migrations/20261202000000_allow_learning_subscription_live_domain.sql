-- Add an isolated Live payment domain for Learning subscriptions.
-- Existing records and default behavior remain Test Mode; this migration does
-- not enable checkout, create provider plans, or process payment events.

begin;

alter table public.learning_subscription_plans
  drop constraint learning_subscription_plans_payment_domain_check,
  add constraint learning_subscription_plans_payment_domain_check
    check (payment_domain in ('test', 'live')),
  add constraint learning_subscription_plans_id_domain_key
    unique (id, payment_domain);

alter table public.learning_subscriptions
  drop constraint learning_subscriptions_payment_domain_check,
  add constraint learning_subscriptions_payment_domain_check
    check (payment_domain in ('test', 'live')),
  add constraint learning_subscriptions_id_domain_key
    unique (id, payment_domain),
  add constraint learning_subscriptions_plan_domain_fkey
    foreign key (plan_id, payment_domain)
    references public.learning_subscription_plans(id, payment_domain) on delete restrict;

alter table public.learning_subscription_invoices
  drop constraint learning_subscription_invoices_payment_domain_check,
  add constraint learning_subscription_invoices_payment_domain_check
    check (payment_domain in ('test', 'live')),
  add constraint learning_subscription_invoices_id_subscription_domain_key
    unique (id, subscription_id, payment_domain),
  add constraint learning_subscription_invoices_subscription_domain_fkey
    foreign key (subscription_id, payment_domain)
    references public.learning_subscriptions(id, payment_domain) on delete restrict;

alter table public.learning_subscription_provider_events
  drop constraint learning_subscription_provider_events_payment_domain_check,
  drop constraint learning_subscription_provider_events_provider_event_id_key,
  add constraint learning_subscription_provider_events_payment_domain_check
    check (payment_domain in ('test', 'live')),
  add constraint learning_subscription_provider_events_domain_event_key
    unique (payment_domain, provider_event_id),
  add constraint learning_subscription_provider_events_subscription_domain_fkey
    foreign key (subscription_id, payment_domain)
    references public.learning_subscriptions(id, payment_domain) on delete restrict,
  add constraint learning_subscription_provider_events_invoice_domain_fkey
    foreign key (invoice_id, subscription_id, payment_domain)
    references public.learning_subscription_invoices(id, subscription_id, payment_domain) on delete restrict;

alter table public.learning_subscription_checkout_attempts
  add column payment_domain text not null default 'test'
    check (payment_domain in ('test', 'live')),
  add constraint learning_subscription_checkout_attempt_plan_domain_fkey
    foreign key (plan_id, payment_domain)
    references public.learning_subscription_plans(id, payment_domain) on delete restrict,
  add constraint learning_subscription_checkout_attempt_subscription_domain_fkey
    foreign key (subscription_id, payment_domain)
    references public.learning_subscriptions(id, payment_domain) on delete restrict,
  add constraint learning_subscription_checkout_attempt_invoice_domain_fkey
    foreign key (invoice_id, subscription_id, payment_domain)
    references public.learning_subscription_invoices(id, subscription_id, payment_domain) on delete restrict;

drop index public.learning_subscription_plans_paystack_code_key;
create unique index learning_subscription_plans_paystack_code_domain_key
  on public.learning_subscription_plans(payment_domain, paystack_plan_code)
  where paystack_plan_code is not null;

drop index public.learning_subscriptions_paystack_code_key;
create unique index learning_subscriptions_paystack_code_domain_key
  on public.learning_subscriptions(payment_domain, paystack_subscription_code)
  where paystack_subscription_code is not null;

drop index public.learning_subscription_invoices_transaction_key;
create unique index learning_subscription_invoices_transaction_domain_key
  on public.learning_subscription_invoices(payment_domain, provider_transaction_id)
  where provider_transaction_id is not null;

drop index public.learning_subscription_invoices_provider_invoice_code_key;
create unique index learning_subscription_invoices_provider_invoice_domain_key
  on public.learning_subscription_invoices(payment_domain, provider_invoice_code)
  where provider_invoice_code is not null;

drop index public.learning_subscription_invoices_provider_transaction_reference_key;
create unique index learning_subscription_invoices_provider_reference_domain_key
  on public.learning_subscription_invoices(payment_domain, provider_transaction_reference)
  where provider_transaction_reference is not null;

create index learning_subscription_checkout_attempt_domain_state_idx
  on public.learning_subscription_checkout_attempts(payment_domain, state, updated_at desc);

comment on column public.learning_subscription_checkout_attempts.payment_domain is
  'Provider domain reserved by this idempotent attempt. Existing rows default to Test Mode; Live checkout remains separately gated.';

commit;
