-- Phase 4: retain and process Test Mode subscription events atomically.
-- The existing one-time purchase webhook is intentionally not changed here.

begin;

alter table public.learning_subscription_invoices
  add column provider_invoice_code text,
  add column provider_transaction_reference text;

alter table public.learning_subscription_invoices
  add constraint learning_subscription_invoices_provider_invoice_code_check
    check (provider_invoice_code is null or provider_invoice_code ~ '^INV_[A-Za-z0-9]{8,100}$'),
  add constraint learning_subscription_invoices_provider_transaction_reference_check
    check (provider_transaction_reference is null or char_length(btrim(provider_transaction_reference)) between 1 and 100);

create unique index learning_subscription_invoices_provider_invoice_code_key
  on public.learning_subscription_invoices(provider_invoice_code)
  where provider_invoice_code is not null;
create unique index learning_subscription_invoices_provider_transaction_reference_key
  on public.learning_subscription_invoices(provider_transaction_reference)
  where provider_transaction_reference is not null;

create or replace function public.receive_learning_subscription_provider_event(
  p_provider_event_id text,
  p_event_type text,
  p_payload_digest text,
  p_sanitized_payload jsonb,
  p_subscription_id uuid,
  p_invoice_id uuid,
  p_payment_domain text
)
returns table(event_id bigint, outcome text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  existing_row public.learning_subscription_provider_events%rowtype;
  resolved_invoice_id uuid := p_invoice_id;
  inserted_id bigint;
begin
  if p_payment_domain is distinct from 'test' then
    raise exception 'Subscription provider events are restricted to Test Mode' using errcode = '22023';
  end if;
  if p_provider_event_id is null or char_length(btrim(p_provider_event_id)) not between 1 and 160
     or p_event_type is null or p_event_type !~ '^[a-zA-Z0-9_.:-]{2,100}$'
     or p_payload_digest is null or p_payload_digest !~ '^[a-f0-9]{64}$'
     or p_sanitized_payload is null or jsonb_typeof(p_sanitized_payload) <> 'object'
     or p_subscription_id is null then
    raise exception 'Subscription provider event receipt is invalid' using errcode = '22023';
  end if;
  if not exists (select 1 from public.learning_subscriptions subscription where subscription.id = p_subscription_id) then
    raise exception 'Subscription provider event has no matching subscription' using errcode = '23503';
  end if;

  if resolved_invoice_id is null then
    select invoice.id into resolved_invoice_id
    from public.learning_subscription_invoices invoice
    where invoice.subscription_id = p_subscription_id
      and (
        (p_sanitized_payload ? 'invoice_code' and invoice.provider_invoice_code = p_sanitized_payload ->> 'invoice_code')
        or (p_sanitized_payload ? 'reference' and invoice.provider_reference = p_sanitized_payload ->> 'reference')
      )
    order by invoice.created_at desc, invoice.id desc
    limit 1;
  end if;

  if resolved_invoice_id is not null and not exists (
    select 1 from public.learning_subscription_invoices invoice
    where invoice.id = resolved_invoice_id and invoice.subscription_id = p_subscription_id
  ) then
    raise exception 'Subscription provider event invoice does not match its subscription' using errcode = '23503';
  end if;

  select * into existing_row
  from public.learning_subscription_provider_events event
  where event.provider_event_id = p_provider_event_id
  for update;

  if found then
    if existing_row.payload_digest <> p_payload_digest
       or existing_row.event_type <> p_event_type
       or existing_row.subscription_id <> p_subscription_id
       or (existing_row.invoice_id is not null and resolved_invoice_id is not null
           and existing_row.invoice_id <> resolved_invoice_id) then
      return query select existing_row.id, 'duplicate_conflict'::text;
      return;
    end if;

    if existing_row.invoice_id is null and resolved_invoice_id is not null then
      update public.learning_subscription_provider_events event
      set invoice_id = resolved_invoice_id
      where event.id = existing_row.id;
    end if;
    return query select existing_row.id, 'duplicate'::text;
    return;
  end if;

  insert into public.learning_subscription_provider_events(
    provider_event_id, event_type, payload_digest, sanitized_payload,
    signature_valid, payment_domain, subscription_id, invoice_id
  ) values (
    p_provider_event_id, p_event_type, p_payload_digest, p_sanitized_payload,
    true, 'test', p_subscription_id, resolved_invoice_id
  ) returning id into inserted_id;

  return query select inserted_id, 'received'::text;
end;
$function$;

create or replace function public.process_learning_subscription_provider_event(
  p_event_id bigint,
  p_verified_transaction jsonb default null
)
returns table(outcome text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  event_row public.learning_subscription_provider_events%rowtype;
  subscription_row public.learning_subscriptions%rowtype;
  invoice_row public.learning_subscription_invoices%rowtype;
  plan_row public.learning_subscription_plans%rowtype;
  terms_row public.learning_commercial_terms%rowtype;
  payload jsonb;
  verified jsonb;
  event_subscription_code text;
  event_customer_code text;
  event_plan_code text;
  event_invoice_code text;
  event_status text;
  invoice_period_start timestamptz;
  invoice_paid_through timestamptz;
  transaction_reference text;
  transaction_id text;
  amount_minor bigint;
  platform_share_minor bigint;
  seller_share_minor bigint;
  new_invoice_id uuid;
  next_subscription_status text;
  final_event_status text;
begin
  select * into event_row
  from public.learning_subscription_provider_events event
  where event.id = p_event_id
  for update;
  if not found then
    raise exception 'Subscription provider event receipt was not found' using errcode = 'P0002';
  end if;
  if event_row.processing_status in ('processed','ignored') then
    return query select 'already_processed'::text;
    return;
  end if;
  if not event_row.signature_valid or event_row.payment_domain <> 'test' then
    raise exception 'Only signature-verified Test Mode events may be processed' using errcode = '42501';
  end if;

  update public.learning_subscription_provider_events event
  set processing_status = 'received', processed_at = null, processing_error = null,
      processing_attempts = event.processing_attempts + 1
  where event.id = p_event_id
  returning * into event_row;

  select * into subscription_row
  from public.learning_subscriptions subscription
  where subscription.id = event_row.subscription_id
  for update;
  if not found then
    raise exception 'Subscription provider event has no matching subscription' using errcode = '23503';
  end if;
  payload := event_row.sanitized_payload;

  if event_row.event_type = 'subscription.create' then
    event_subscription_code := payload ->> 'subscription_code';
    event_customer_code := payload ->> 'customer_code';
    event_plan_code := payload ->> 'plan_code';
    if event_subscription_code is null or event_subscription_code !~ '^SUB_[A-Za-z0-9]{8,100}$'
       or event_plan_code is null or event_plan_code !~ '^PLN_[A-Za-z0-9]{8,100}$'
       or (event_customer_code is not null and event_customer_code !~ '^CUS_[A-Za-z0-9]{4,100}$') then
      raise exception 'Subscription creation event is missing valid provider identifiers' using errcode = '22023';
    end if;
    select * into plan_row from public.learning_subscription_plans plan where plan.id = subscription_row.plan_id;
    if plan_row.paystack_plan_code is distinct from event_plan_code then
      raise exception 'Provider subscription plan does not match the local plan' using errcode = '23514';
    end if;
    if subscription_row.paystack_subscription_code is not null
       and subscription_row.paystack_subscription_code <> event_subscription_code then
      raise exception 'Provider subscription code cannot be replaced' using errcode = '23514';
    end if;
    if subscription_row.paystack_customer_code is not null
       and event_customer_code is not null
       and subscription_row.paystack_customer_code <> event_customer_code then
      raise exception 'Provider customer code cannot be replaced' using errcode = '23514';
    end if;
    update public.learning_subscriptions subscription
    set paystack_subscription_code = event_subscription_code,
        paystack_customer_code = coalesce(subscription.paystack_customer_code, event_customer_code),
        updated_at = now()
    where subscription.id = subscription_row.id;
    final_event_status := 'processed';

  elsif event_row.event_type = 'invoice.create' then
    event_subscription_code := payload ->> 'subscription_code';
    event_invoice_code := payload ->> 'invoice_code';
    event_status := payload ->> 'status';
    amount_minor := nullif(payload ->> 'amount_minor', '')::bigint;
    invoice_period_start := nullif(payload ->> 'period_starts_at', '')::timestamptz;
    invoice_paid_through := nullif(payload ->> 'paid_through', '')::timestamptz;
    if subscription_row.paystack_subscription_code is null
       or subscription_row.paystack_subscription_code is distinct from event_subscription_code
       or event_invoice_code is null or event_invoice_code !~ '^INV_[A-Za-z0-9]{8,100}$'
       or amount_minor is null or amount_minor <= 0 or payload ->> 'currency' is distinct from 'NGN'
       or invoice_period_start is null or invoice_paid_through is null
       or invoice_paid_through <= invoice_period_start then
      raise exception 'Subscription invoice creation event is invalid or arrived before its subscription mapping' using errcode = '23514';
    end if;
    if event_status is null or event_status not in ('success','pending','attention','failed') then
      raise exception 'Subscription invoice event status is not supported' using errcode = '22023';
    end if;
    select * into plan_row from public.learning_subscription_plans plan where plan.id = subscription_row.plan_id;
    if amount_minor <> plan_row.amount_minor then
      raise exception 'Provider invoice amount does not match the immutable local plan amount' using errcode = '23514';
    end if;
    select * into terms_row from public.learning_commercial_terms terms
    where terms.version = plan_row.commercial_terms_version;
    if not found then raise exception 'Subscription commercial terms snapshot is unavailable' using errcode = '23503'; end if;

    select * into invoice_row
    from public.learning_subscription_invoices invoice
    where invoice.subscription_id = subscription_row.id
      and invoice.provider_invoice_code = event_invoice_code
    for update;
    if found then
      if invoice_row.amount_minor <> amount_minor
         or invoice_row.billing_period_starts_at <> invoice_period_start
         or invoice_row.paid_through <> invoice_paid_through then
        raise exception 'Provider invoice code was reused with conflicting period or amount details' using errcode = '23514';
      end if;
      new_invoice_id := invoice_row.id;
    else
      platform_share_minor := round(amount_minor * terms_row.commission_basis_points / 10000.0)::bigint;
      seller_share_minor := amount_minor - platform_share_minor;
      insert into public.learning_subscription_invoices(
        subscription_id, instructor_id, plan_name_snapshot,
        billing_period_starts_at, paid_through, provider_reference, provider_invoice_code,
        amount_minor, platform_share_minor, seller_share_minor,
        currency, commercial_terms_version, status, terminal_at
      ) values (
        subscription_row.id, plan_row.instructor_id, plan_row.name,
        invoice_period_start, invoice_paid_through,
        'GS-' || upper(replace(gen_random_uuid()::text, '-', '')), event_invoice_code,
        amount_minor, platform_share_minor, seller_share_minor,
        'NGN', plan_row.commercial_terms_version,
        case when event_status in ('success','pending') then 'payment_pending' else 'failed' end,
        case when event_status in ('failed','attention') then now() else null end
      ) returning id into new_invoice_id;

      insert into public.learning_subscription_invoice_courses(invoice_id, course_id, course_title_snapshot)
      select new_invoice_id, item.course_id, course.title
      from public.learning_subscription_plan_courses item
      join public.learning_courses course on course.id = item.course_id
      where item.plan_id = plan_row.id;
      if not exists (select 1 from public.learning_subscription_invoice_courses item where item.invoice_id = new_invoice_id) then
        raise exception 'Subscription invoice has no included course snapshot' using errcode = '23514';
      end if;
    end if;

    if event_status in ('failed','attention') then
      update public.learning_subscriptions subscription
      set status = case when subscription.status = 'active' then 'attention' else subscription.status end,
          updated_at = now()
      where subscription.id = subscription_row.id;
    end if;
    update public.learning_subscription_provider_events event
    set invoice_id = new_invoice_id
    where event.id = p_event_id;
    final_event_status := 'processed';

  elsif event_row.event_type in ('charge.success','invoice.update','invoice.payment_failed') then
    if event_row.invoice_id is null then
      raise exception 'Subscription payment event could not be linked to a local invoice' using errcode = '23503';
    end if;
    select * into invoice_row
    from public.learning_subscription_invoices invoice
    where invoice.id = event_row.invoice_id and invoice.subscription_id = subscription_row.id
    for update;
    if not found then raise exception 'Subscription invoice snapshot was not found' using errcode = '23503'; end if;

    event_subscription_code := payload ->> 'subscription_code';
    event_invoice_code := payload ->> 'invoice_code';
    event_status := payload ->> 'status';
    if event_subscription_code is not null and subscription_row.paystack_subscription_code is not null
         and event_subscription_code is distinct from subscription_row.paystack_subscription_code then
      raise exception 'Subscription payment event does not match the provider subscription' using errcode = '23514';
    end if;
    if event_invoice_code is not null and invoice_row.provider_invoice_code is distinct from event_invoice_code then
      raise exception 'Subscription payment event does not match the provider invoice' using errcode = '23514';
    end if;
    if event_row.event_type in ('invoice.update','invoice.payment_failed')
       and (invoice_row.provider_invoice_code is distinct from event_invoice_code
         or nullif(payload ->> 'amount_minor', '')::bigint is distinct from invoice_row.amount_minor
         or payload ->> 'currency' is distinct from 'NGN') then
      raise exception 'Provider invoice event amount or identity does not match the local invoice snapshot' using errcode = '23514';
    end if;
    if event_row.event_type = 'invoice.payment_failed'
       or event_status is null or event_status not in ('success','paid') then
      if invoice_row.status in ('paid','partially_refunded','refunded','chargeback') then
        final_event_status := 'ignored';
      else
        update public.learning_subscription_invoices invoice
        set status = 'failed', terminal_at = coalesce(invoice.terminal_at, now())
        where invoice.id = invoice_row.id;
        update public.learning_subscriptions subscription
        set status = case when subscription.status = 'active' then 'attention' else subscription.status end,
            updated_at = now()
        where subscription.id = subscription_row.id;
        final_event_status := 'processed';
      end if;
    else
      verified := p_verified_transaction;
      transaction_reference := coalesce(verified ->> 'reference', '');
      transaction_id := coalesce(verified ->> 'transaction_id', '');
      if verified is null or verified ->> 'status' is distinct from 'success'
         or verified ->> 'domain' is distinct from 'test' or verified ->> 'currency' is distinct from 'NGN'
         or transaction_reference = '' or transaction_id !~ '^[1-9][0-9]{0,39}$'
         or nullif(verified ->> 'requested_amount_minor', '')::bigint is distinct from invoice_row.amount_minor
         or nullif(payload ->> 'amount_minor', '')::bigint is distinct from invoice_row.amount_minor
         or payload ->> 'currency' is distinct from 'NGN' then
        raise exception 'Subscription payment has no matching verified Test Mode transaction' using errcode = '23514';
      end if;
      if event_row.event_type = 'charge.success'
         and payload ->> 'reference' is distinct from invoice_row.provider_reference then
        raise exception 'Initial subscription charge reference does not match its invoice' using errcode = '23514';
      end if;
      if payload ->> 'transaction_id' is not null
         and payload ->> 'transaction_id' is distinct from transaction_id then
        raise exception 'Verified transaction ID does not match the signed event' using errcode = '23514';
      end if;
      if event_row.event_type <> 'charge.success'
         and payload ->> 'transaction_reference' is distinct from transaction_reference then
        raise exception 'Verified transaction reference does not match the invoice event' using errcode = '23514';
      end if;
      if invoice_row.status in ('paid','partially_refunded','refunded','chargeback') then
        if invoice_row.provider_transaction_id = transaction_id
           and invoice_row.provider_transaction_reference = transaction_reference then
          final_event_status := 'ignored';
        else
          raise exception 'Subscription invoice already has a different financial outcome' using errcode = '23514';
        end if;
      else
        update public.learning_subscription_invoices invoice
        set status = 'paid', provider_transaction_id = transaction_id,
            provider_transaction_reference = transaction_reference,
            paid_at = coalesce(nullif(payload ->> 'paid_at', '')::timestamptz, now()),
            terminal_at = null
        where invoice.id = invoice_row.id;

        if subscription_row.paid_through is null or invoice_row.paid_through > subscription_row.paid_through then
          if subscription_row.status = 'expired' then
            raise exception 'A payment arrived after the subscription had expired; reconcile manually' using errcode = '23514';
          end if;
          next_subscription_status := case
            when subscription_row.status in ('cancelled','completed') then subscription_row.status
            when subscription_row.cancel_requested_at is not null or subscription_row.status = 'non_renewing' then 'non_renewing'
            else 'active'
          end;
          update public.learning_subscriptions subscription
          set current_period_starts_at = invoice_row.billing_period_starts_at,
              paid_through = invoice_row.paid_through,
              status = next_subscription_status,
              updated_at = now()
          where subscription.id = subscription_row.id;
        end if;
        final_event_status := 'processed';
      end if;
    end if;

  elsif event_row.event_type = 'subscription.not_renew' then
    update public.learning_subscriptions subscription
    set status = case
          when subscription.status in ('cancelled','completed','expired') then subscription.status
          when subscription.paid_through is null then 'pending'
          else 'non_renewing'
        end,
        cancel_requested_at = coalesce(subscription.cancel_requested_at, now()),
        updated_at = now()
    where subscription.id = subscription_row.id;
    final_event_status := 'processed';

  elsif event_row.event_type = 'subscription.disable' then
    event_status := payload ->> 'status';
    update public.learning_subscriptions subscription
    set status = case
          when subscription.status in ('completed','expired') then subscription.status
          when subscription.paid_through is null then 'pending'
          when event_status = 'complete' then 'completed'
          else 'cancelled'
        end,
        cancel_requested_at = coalesce(subscription.cancel_requested_at, now()),
        updated_at = now()
    where subscription.id = subscription_row.id;
    final_event_status := 'processed';

  else
    final_event_status := 'ignored';
  end if;

  update public.learning_subscription_provider_events event
  set processing_status = final_event_status,
      processed_at = now(),
      processing_error = null
  where event.id = p_event_id;
  return query select case when final_event_status = 'ignored' then 'ignored' else 'processed' end;
end;
$function$;

revoke all on function public.receive_learning_subscription_provider_event(text,text,text,jsonb,uuid,uuid,text),
  public.process_learning_subscription_provider_event(bigint,jsonb)
from public, anon, authenticated;
grant execute on function public.receive_learning_subscription_provider_event(text,text,text,jsonb,uuid,uuid,text),
  public.process_learning_subscription_provider_event(bigint,jsonb)
to service_role;

commit;
