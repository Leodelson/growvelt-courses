-- Phase 4: recover an initial Test Mode subscription charge when Paystack's
-- signed webhook is delayed or unavailable. The server must first verify the
-- transaction directly with Paystack; API evidence is recorded distinctly
-- from webhook-signature evidence and uses the same guarded event processor.

begin;

alter table public.learning_subscription_provider_events
  add column verification_source text not null default 'webhook'
    check (verification_source in ('webhook', 'provider_api'));

-- Keep the webhook processor's existing financial checks, while allowing it
-- to accept an event only when it is either HMAC-verified or explicitly
-- recorded as Paystack API-verified by the service-only reconciliation RPC.
do $migration$
declare
  function_definition text;
  original_guard constant text := 'if not event_row.signature_valid or event_row.payment_domain <> ''test'' then';
  verified_guard constant text := 'if (not event_row.signature_valid and event_row.verification_source <> ''provider_api'') or event_row.payment_domain <> ''test'' then';
begin
  select pg_get_functiondef('public.process_learning_subscription_provider_event(bigint,jsonb)'::regprocedure)
  into function_definition;
  if function_definition is null or strpos(function_definition, original_guard) = 0 then
    raise exception 'Subscription event processor safety guard changed; review this migration before applying';
  end if;
  execute replace(function_definition, original_guard, verified_guard);
end;
$migration$;

create or replace function public.reconcile_own_learning_test_subscription_payment(
  p_learner_id uuid,
  p_reference text,
  p_subscription_id uuid,
  p_invoice_id uuid,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_requested_amount_minor bigint,
  p_fees_minor bigint,
  p_payload_digest text,
  p_verified_payload jsonb
)
returns table(outcome text, event_id bigint)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  invoice_row public.learning_subscription_invoices%rowtype;
  subscription_row public.learning_subscriptions%rowtype;
  event_row public.learning_subscription_provider_events%rowtype;
  verified_transaction jsonb;
  event_key bigint;
  process_outcome text;
  finalize_outcome text;
begin
  if p_learner_id is null or p_reference is null or p_reference !~ '^GS-[A-F0-9]{32}$'
     or p_subscription_id is null or p_invoice_id is null
     or p_provider_transaction_id is null or p_provider_transaction_id !~ '^[1-9][0-9]{0,39}$'
     or p_amount_minor is null or p_requested_amount_minor is null
     or p_amount_minor <= 0 or p_requested_amount_minor <= 0
     or p_requested_amount_minor > p_amount_minor
     or (p_amount_minor > p_requested_amount_minor
       and (p_fees_minor is null or p_fees_minor < 0
         or p_amount_minor - p_requested_amount_minor <> p_fees_minor))
     or (p_fees_minor is not null and p_fees_minor < 0)
     or p_payload_digest is null or p_payload_digest !~ '^[a-f0-9]{64}$'
     or p_verified_payload is null or jsonb_typeof(p_verified_payload) <> 'object'
     or p_verified_payload ->> 'status' is distinct from 'success'
     or p_verified_payload ->> 'reference' is distinct from p_reference
     or p_verified_payload ->> 'transaction_id' is distinct from p_provider_transaction_id
     or p_verified_payload ->> 'domain' is distinct from 'test'
     or p_verified_payload ->> 'currency' is distinct from 'NGN'
     or p_verified_payload ->> 'requested_amount_minor' is distinct from p_requested_amount_minor::text
     or p_verified_payload ->> 'amount_minor' is distinct from p_requested_amount_minor::text
     or p_verified_payload ->> 'charged_amount_minor' is distinct from p_amount_minor::text
     or p_verified_payload ->> 'fees_minor' is distinct from p_fees_minor::text
     or lower(p_verified_payload -> 'metadata' ->> 'subscription_id') is distinct from p_subscription_id::text
     or lower(p_verified_payload -> 'metadata' ->> 'invoice_id') is distinct from p_invoice_id::text then
    raise exception 'Paystack Test subscription verification is invalid or inconclusive' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('paystack:subscription:test:' || p_reference, 0));

  select * into invoice_row
  from public.learning_subscription_invoices invoice
  where invoice.id = p_invoice_id and invoice.provider_reference = p_reference
    and invoice.payment_domain = 'test'
  for update;
  if not found then
    return query select 'payment_not_found'::text, null::bigint;
    return;
  end if;

  select * into subscription_row
  from public.learning_subscriptions subscription
  where subscription.id = invoice_row.subscription_id
    and subscription.id = p_subscription_id
    and subscription.learner_id = p_learner_id
    and subscription.payment_domain = 'test'
  for update;
  if not found then
    return query select 'payment_not_found'::text, null::bigint;
    return;
  end if;

  if invoice_row.amount_minor <> p_requested_amount_minor or invoice_row.currency <> 'NGN' then
    return query select 'amount_mismatch'::text, null::bigint;
    return;
  end if;

  if invoice_row.status = 'paid' then
    if invoice_row.provider_transaction_id = p_provider_transaction_id
       and invoice_row.provider_transaction_reference = p_reference then
      return query select 'already_paid'::text, null::bigint;
      return;
    end if;
    raise exception 'Subscription invoice already has a different financial outcome' using errcode = '23514';
  end if;
  if invoice_row.status not in ('created', 'payment_pending', 'failed') then
    return query select 'invoice_not_payable'::text, null::bigint;
    return;
  end if;

  select * into event_row
  from public.learning_subscription_provider_events event
  where event.provider_event_id = 'transaction.verify:subscription:test:' || p_provider_transaction_id
  for update;
  if found then
    if event_row.payload_digest <> p_payload_digest or event_row.subscription_id <> p_subscription_id
       or event_row.invoice_id is distinct from p_invoice_id
       or event_row.verification_source <> 'provider_api' then
      raise exception 'Paystack subscription verification conflicts with previously recorded evidence' using errcode = '23514';
    end if;
    if event_row.processing_status in ('processed', 'ignored') then
      return query select 'already_processed'::text, event_row.id;
      return;
    end if;
    event_key := event_row.id;
  else
    insert into public.learning_subscription_provider_events(
      provider_event_id, event_type, payload_digest, sanitized_payload,
      signature_valid, verification_source, payment_domain,
      subscription_id, invoice_id
    ) values (
      'transaction.verify:subscription:test:' || p_provider_transaction_id,
      'charge.success', p_payload_digest, p_verified_payload,
      false, 'provider_api', 'test', p_subscription_id, p_invoice_id
    ) returning id into event_key;
  end if;

  verified_transaction := jsonb_build_object(
    'reference', p_reference,
    'transaction_id', p_provider_transaction_id,
    'requested_amount_minor', p_requested_amount_minor,
    'status', 'success', 'domain', 'test', 'currency', 'NGN',
    'paid_at', p_verified_payload -> 'paid_at'
  );
  select processed.outcome into process_outcome
  from public.process_learning_subscription_provider_event(event_key, verified_transaction) processed;

  select finalized.outcome into finalize_outcome
  from public.finalize_learning_test_subscription_initial_period(
    p_subscription_id, p_invoice_id, p_provider_transaction_id,
    nullif(p_verified_payload ->> 'paid_at', '')::timestamptz
  ) finalized;

  if finalize_outcome is null then
    raise exception 'Verified initial subscription payment period could not be finalized' using errcode = '23514';
  end if;
  return query select coalesce(process_outcome, 'processed')::text, event_key;
end;
$function$;

revoke all on function public.reconcile_own_learning_test_subscription_payment(
  uuid,text,uuid,uuid,text,bigint,bigint,bigint,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_own_learning_test_subscription_payment(
  uuid,text,uuid,uuid,text,bigint,bigint,bigint,text,jsonb
) to service_role, postgres;

comment on function public.reconcile_own_learning_test_subscription_payment(
  uuid,text,uuid,uuid,text,bigint,bigint,bigint,text,jsonb
) is 'Reconciles a learner-owned Test Mode subscription invoice only from server-verified Paystack API evidence; stores provider_api provenance separately from signed webhooks and never starts a charge.';

commit;
