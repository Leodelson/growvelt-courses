-- Reconcile subscription invoice payout batches through the shared provider
-- event receipt, while keeping the established course-order processor intact.
begin;

create unique index if not exists learning_ledger_one_subscription_invoice_payout_settlement
  on public.learning_ledger_transactions(subscription_invoice_id)
  where subscription_invoice_id is not null
    and transaction_type='instructor_payout_settlement';

create or replace function public.prevent_unvalidated_subscription_invoice_earning_release()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  invoice_source uuid;
  financial_source_valid boolean;
  settlement_valid boolean;
begin
  if new.status is not distinct from old.status then return new; end if;
  select allocation.subscription_invoice_id into invoice_source
    from public.learning_commercial_allocations allocation where allocation.id=old.allocation_id;
  if invoice_source is null then return new; end if;

  if old.status='reserved' and new.status='paid' then
    select exists (
      select 1 from public.learning_instructor_payout_batch_settlements settlement
      join public.learning_instructor_payout_batches batch on batch.id=settlement.batch_id
      join public.learning_instructor_payout_batch_attempts attempt on attempt.id=settlement.attempt_id
      join public.learning_instructor_payout_batch_provider_events provider_event
        on provider_event.id=settlement.provider_event_id
      join public.learning_ledger_transactions transaction
        on transaction.id=settlement.ledger_transaction_id
      join public.learning_commercial_allocations allocation
        on allocation.id=old.allocation_id
      where settlement.earning_id=old.id
        and settlement.reservation_id is not null
        and settlement.amount_minor=old.gross_amount_minor
        and settlement.currency=old.currency
        and batch.source_type='subscription_invoice' and batch.status='succeeded'
        and batch.instructor_id=old.instructor_id
        and attempt.status='succeeded' and provider_event.provider_status='succeeded'
        and transaction.subscription_invoice_id=allocation.subscription_invoice_id
        and transaction.transaction_type='instructor_payout_settlement'
        and (select count(*) from public.learning_ledger_entries entry
          where entry.transaction_id=transaction.id and entry.currency=old.currency)=2
        and (select coalesce(sum(entry.amount_minor),0) from public.learning_ledger_entries entry
          where entry.transaction_id=transaction.id and entry.currency=old.currency)=0
    ) into settlement_valid;
    if coalesce(settlement_valid,false) then return new; end if;
    raise exception 'Subscription invoice earnings require an authoritative balanced payout settlement'
      using errcode='22023';
  end if;

  if (old.status='held' and new.status='available')
    or (old.status='available' and new.status='reserved') then
    select invoice.status='paid' and invoice.payment_domain='live'
      and invoice.provider_transaction_id is not null
      and invoice.provider_transaction_reference is not null
      and invoice.paid_at is not null
      and allocation.status='allocated'
      and allocation.instructor_id=old.instructor_id
      and invoice.instructor_id=old.instructor_id
      and allocation.instructor_gross_minor=old.gross_amount_minor
      and allocation.currency=old.currency and invoice.currency=old.currency
      and old.available_at<=now() and old.recoverable_amount_minor=0
      and not exists (select 1 from public.learning_subscription_refund_cases refund_case
        where refund_case.invoice_id=invoice.id)
    into financial_source_valid
    from public.learning_commercial_allocations allocation
    join public.learning_subscription_invoices invoice
      on invoice.id=allocation.subscription_invoice_id
    where allocation.id=old.allocation_id;
    if old.status='held' and new.status='available'
      and coalesce(financial_source_valid,false) and new.released_at is not null
      and not exists (select 1 from public.learning_instructor_earning_reservations reservation
        where reservation.earning_id=old.id) then return new; end if;
    if old.status='available' and new.status='reserved'
      and coalesce(financial_source_valid,false) and old.released_at is not null
      and new.reserved_at is not null
      and exists (select 1 from public.learning_instructor_earning_reservations reservation
        where reservation.earning_id=old.id and reservation.allocation_id=old.allocation_id
          and reservation.instructor_id=old.instructor_id
          and reservation.amount_minor=old.gross_amount_minor
          and reservation.currency=old.currency and reservation.status='reserved') then return new; end if;
    raise exception 'Subscription invoice earning is not eligible for this transition'
      using errcode='22023';
  end if;
  if new.status in ('available','reserved','paid') then
    raise exception 'Subscription invoice payout requires validated invoice controls'
      using errcode='22023';
  end if;
  if new.status in ('reversed','recoverable') and not exists (
    select 1 from public.learning_subscription_refund_cases refund_case
    where refund_case.invoice_id=invoice_source and refund_case.status='processed'
  ) then
    raise exception 'A verified processed invoice refund is required to reverse subscription earnings'
      using errcode='22023';
  end if;
  return new;
end;$function$;

drop trigger if exists prevent_unvalidated_subscription_invoice_earning_release
  on public.learning_instructor_earnings;
create trigger prevent_unvalidated_subscription_invoice_earning_release
before update of status on public.learning_instructor_earnings
for each row execute function public.prevent_unvalidated_subscription_invoice_earning_release();

create function public.list_learning_live_payout_batch_candidates(
  p_operator_id uuid,p_limit integer default 500
) returns table(
  source_type text,earning_id bigint,instructor_id uuid,instructor_name text,instructor_email text,
  payout_profile_id bigint,bank_name text,account_name text,account_last4 text,
  source_reference text,source_label text,amount_minor bigint,currency text,
  available_at timestamptz,eligible_total_minor bigint,eligible_earning_count bigint
) language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or not exists(select 1 from public.account_capabilities capability
    where capability.user_id=p_operator_id and capability.capability='admin' and capability.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  return query
    select 'course_order'::text,candidate.earning_id,candidate.instructor_id,candidate.instructor_name,
      candidate.instructor_email,candidate.payout_profile_id,candidate.bank_name,candidate.account_name,
      candidate.account_last4,candidate.order_reference,candidate.course_title,candidate.amount_minor,
      candidate.currency,candidate.available_at,candidate.eligible_total_minor,candidate.eligible_earning_count
    from public.list_learning_instructor_live_payout_batch_candidates(p_operator_id,p_limit) candidate
    union all
    select 'subscription_invoice'::text,candidate.earning_id,candidate.instructor_id,candidate.instructor_name,
      candidate.instructor_email,candidate.payout_profile_id,candidate.bank_name,candidate.account_name,
      candidate.account_last4,candidate.invoice_reference,candidate.plan_name,candidate.amount_minor,
      candidate.currency,candidate.available_at,candidate.eligible_total_minor,candidate.eligible_earning_count
    from public.list_learning_subscription_invoice_payout_batch_candidates(p_operator_id,p_limit) candidate
    limit least(greatest(coalesce(p_limit,500),1),500);
end;$function$;

create function public.list_learning_live_payout_batches(
  p_operator_id uuid,p_limit integer default 100
) returns table(
  batch_id bigint,batch_reference text,source_type text,instructor_id uuid,instructor_name text,
  instructor_email text,payout_profile_id bigint,bank_name text,account_name text,account_last4 text,
  amount_minor bigint,currency text,status text,member_count bigint,assembled_at timestamptz,
  attempt_id bigint,attempt_reference text,attempt_status text,provider_status text,
  provider_transfer_code text,attempted_at timestamptz
) language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or not exists(select 1 from public.account_capabilities capability
    where capability.user_id=p_operator_id and capability.capability='admin' and capability.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  return query select batch.id,batch.batch_reference,batch.source_type,batch.instructor_id,
    instructor.full_name,instructor.email,profile.id,profile.bank_name,profile.account_name,
    profile.account_last4,batch.amount_minor,batch.currency,batch.status,
    (select count(*) from public.learning_instructor_payout_batch_members member where member.batch_id=batch.id),
    batch.assembled_at,attempt.id,attempt.attempt_reference,attempt.status,attempt.provider_status,
    attempt.provider_transfer_code,attempt.initiated_at
  from public.learning_instructor_payout_batches batch
  join public.profiles instructor on instructor.id=batch.instructor_id
  join public.learning_instructor_payout_profiles profile on profile.id=batch.payout_profile_id
  left join lateral (select payout_attempt.* from public.learning_instructor_payout_batch_attempts payout_attempt
    where payout_attempt.batch_id=batch.id order by payout_attempt.attempt_number desc,payout_attempt.id desc limit 1) attempt on true
  order by batch.assembled_at desc,batch.id desc
  limit least(greatest(coalesce(p_limit,100),1),200);
end;$function$;

create function public.get_learning_subscription_invoice_live_payout_batch_preflight(
  p_operator_id uuid,p_batch_id bigint
) returns table(amount_minor bigint,currency text)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or p_batch_id is null or p_batch_id<=0
    or not exists(select 1 from public.account_capabilities capability
      where capability.user_id=p_operator_id and capability.capability='admin' and capability.status='active') then
    raise exception 'Active administrator and valid invoice batch required' using errcode='42501';
  end if;
  return query
    select batch.amount_minor,batch.currency
    from public.learning_instructor_payout_batches batch
    join public.learning_instructor_payout_profiles profile on profile.id=batch.payout_profile_id
    where batch.id=p_batch_id and batch.source_type='subscription_invoice'
      and batch.status in ('assembled','failed') and batch.amount_minor>=100000
      and profile.instructor_id=batch.instructor_id and profile.provider='paystack'
      and profile.provider_domain='live' and profile.status='active' and profile.currency=batch.currency
      and exists(select 1 from public.learning_instructor_payout_batch_members member
        join public.learning_instructor_earning_reservations reservation on reservation.id=member.reservation_id
        join public.learning_instructor_earnings earning on earning.id=member.earning_id
        join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
        join public.learning_subscription_invoices invoice on invoice.id=allocation.subscription_invoice_id
        join public.learning_subscriptions subscription on subscription.id=invoice.subscription_id
        join public.learning_subscription_plans plan on plan.id=subscription.plan_id
        where member.batch_id=batch.id and reservation.status='reserved' and earning.status='reserved'
          and earning.instructor_id=batch.instructor_id and earning.currency=batch.currency
          and earning.gross_amount_minor=member.amount_minor and earning.released_at is not null
          and earning.recoverable_amount_minor=0 and allocation.status='allocated'
          and allocation.instructor_id=batch.instructor_id
          and allocation.instructor_gross_minor=member.amount_minor
          and invoice.status='paid' and invoice.payment_domain='live'
          and subscription.payment_domain='live' and plan.payment_domain='live'
          and invoice.instructor_id=batch.instructor_id and plan.instructor_id=batch.instructor_id
          and invoice.seller_share_minor=member.amount_minor
          and invoice.amount_minor=invoice.platform_share_minor+invoice.seller_share_minor
          and invoice.commercial_terms_version=plan.commercial_terms_version
          and invoice.provider_transaction_id is not null
          and invoice.provider_transaction_reference is not null and invoice.paid_at is not null
          and not exists(select 1 from public.learning_subscription_refund_cases refund_case
            where refund_case.invoice_id=invoice.id)
          and not exists(select 1 from public.learning_instructor_payout_settlements settlement
            where settlement.earning_id=earning.id or settlement.reservation_id=reservation.id)
          and not exists(select 1 from public.learning_instructor_payout_items payout_item
            where payout_item.earning_id=earning.id or payout_item.reservation_id=reservation.id)
      );
end;$function$;

create function public.get_learning_live_payout_batch_attempt_source(
  p_operator_id uuid,p_attempt_id bigint
) returns table(source_type text)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or p_attempt_id is null or p_attempt_id<=0
    or not exists(select 1 from public.account_capabilities capability
      where capability.user_id=p_operator_id and capability.capability='admin' and capability.status='active') then
    raise exception 'Active administrator and valid payout attempt required' using errcode='42501';
  end if;
  return query select batch.source_type from public.learning_instructor_payout_batch_attempts attempt
    join public.learning_instructor_payout_batches batch on batch.id=attempt.batch_id
    where attempt.id=p_attempt_id;
end;$function$;

create function public.process_paystack_live_subscription_invoice_payout_batch_event(p_provider_event_id bigint)
returns table(outcome text,batch_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare
  ev public.learning_instructor_payout_batch_provider_events%rowtype;
  attempt public.learning_instructor_payout_batch_attempts%rowtype;
  batch_row public.learning_instructor_payout_batches%rowtype;
  member_row record;
  member_count bigint;
  checked_member_count bigint:=0;
  settlement_count bigint;
  checked_total bigint:=0;
  actual_total bigint;
  item_ineligible boolean:=false;
  ledger_key bigint;
begin
  select * into ev from public.learning_instructor_payout_batch_provider_events event
    where event.id=p_provider_event_id for update;
  if not found then raise exception 'Payout batch provider event not found' using errcode='P0002'; end if;
  if exists(select 1 from public.learning_instructor_payout_batch_event_processing_attempts processed
    where processed.provider_event_id=ev.id and processed.outcome in
      ('settled','failed','reversed','recorded','conflict','already_processed')) then
    return query select 'already_processed',processed.batch_id
      from public.learning_instructor_payout_batch_event_processing_attempts processed
      where processed.provider_event_id=ev.id and processed.outcome in
        ('settled','failed','reversed','recorded','conflict','already_processed')
      order by processed.id desc limit 1;
    return;
  end if;
  select * into attempt from public.learning_instructor_payout_batch_attempts item
    where item.attempt_reference=ev.attempt_reference;
  if not found then
    perform public.open_learning_instructor_payout_batch_finding(
      'payout-batch-event-unmatched:'||ev.id,null,ev.id,'unmatched_provider_event',
      'Signed Live transfer event does not match an approved payout batch attempt');
    insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,outcome,detail)
      values(ev.id,'deferred','Batch attempt is not available yet');
    return query select 'deferred',null::bigint; return;
  end if;
  select * into batch_row from public.learning_instructor_payout_batches batch
    where batch.id=attempt.batch_id for update;
  select * into attempt from public.learning_instructor_payout_batch_attempts item
    where item.id=attempt.id for update;
  if batch_row.source_type<>'subscription_invoice'
    or attempt.amount_minor<>ev.amount_minor or attempt.currency<>ev.currency
    or (attempt.provider_transfer_id is not null and attempt.provider_transfer_id<>ev.provider_transfer_id)
    or (attempt.provider_transfer_code is not null and ev.provider_transfer_code is not null
      and attempt.provider_transfer_code<>ev.provider_transfer_code) then
    perform public.open_learning_instructor_payout_batch_finding(
      'subscription-payout-batch-event-identity:'||ev.id,attempt.id,ev.id,
      'provider_amount_currency_mismatch',
      'Provider event source, amount, currency, or transfer identity does not match the immutable invoice batch attempt');
    insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
      values(ev.id,batch_row.id,'conflict','Provider event identity or invoice batch source mismatch');
    return query select 'conflict',batch_row.id; return;
  end if;
  if attempt.payout_profile_id<>batch_row.payout_profile_id
    or attempt.recipient_code !~ '^RCP_[A-Za-z0-9]+$'
    or attempt.provider_recipient_id !~ '^[0-9]+$' or attempt.initiated_by is null then
    perform public.open_learning_instructor_payout_batch_finding(
      'subscription-payout-batch-member-identity:'||attempt.id,attempt.id,ev.id,
      'member_financial_identity_mismatch','Invoice batch recipient or initiating administrator is inconsistent');
    insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
      values(ev.id,batch_row.id,'conflict','Immutable invoice batch attempt identity is inconsistent');
    return query select 'conflict',batch_row.id; return;
  end if;

  if attempt.status='submitting' then
    if ev.provider_transfer_code is null then
      insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
        values(ev.id,batch_row.id,'deferred','Provider response is still needed to complete transfer identity');
      return query select 'deferred',batch_row.id; return;
    end if;
    update public.learning_instructor_payout_batch_attempts item set status='pending',
      provider_transfer_id=ev.provider_transfer_id,provider_transfer_code=ev.provider_transfer_code,
      provider_status='pending',provider_received_at=now() where item.id=attempt.id;
    update public.learning_instructor_payout_batches batch set status='pending' where batch.id=batch_row.id;
    select * into attempt from public.learning_instructor_payout_batch_attempts item where item.id=attempt.id;
    select * into batch_row from public.learning_instructor_payout_batches batch where batch.id=batch_row.id;
  elsif attempt.provider_transfer_id is null then
    if ev.provider_transfer_code is null then
      insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
        values(ev.id,batch_row.id,'deferred','Provider transfer identity is incomplete; manual verification required');
      return query select 'deferred',batch_row.id; return;
    end if;
    update public.learning_instructor_payout_batch_attempts item set
      provider_transfer_id=ev.provider_transfer_id,provider_transfer_code=ev.provider_transfer_code,
      provider_status=case when ev.provider_status='pending' then 'pending' else item.provider_status end,
      provider_received_at=now() where item.id=attempt.id;
    select * into attempt from public.learning_instructor_payout_batch_attempts item where item.id=attempt.id;
  end if;

  if ev.provider_status='pending' then
    if attempt.status in ('pending','financially_blocked') then
      insert into public.learning_instructor_payout_batch_attempt_events(
        attempt_id,event_type,from_status,to_status,provenance,provider_event_id,payload_digest,metadata
      ) values(attempt.id,'paystack.pending',attempt.status,attempt.status,
        case when ev.provenance='provider_webhook' then 'provider_webhook' else 'provider_api' end,
        ev.provider_event_id,ev.payload_digest,jsonb_build_object('provider_transfer_id',ev.provider_transfer_id,
          'source','subscription_invoice'));
      insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
        values(ev.id,batch_row.id,'recorded','Provider invoice payout remains pending');
      return query select 'recorded',batch_row.id; return;
    end if;
    perform public.open_learning_instructor_payout_batch_finding(
      'subscription-payout-pending-conflict:'||ev.id,attempt.id,ev.id,
      'provider_outcome_conflict','Delayed pending event conflicts with the invoice batch attempt state');
    insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
      values(ev.id,batch_row.id,'conflict','Pending event conflicts with terminal invoice payout');
    return query select 'conflict',batch_row.id; return;
  end if;

  if ev.provider_status='reversed' then
    if attempt.status in ('failed','reversed') then
      perform public.open_learning_instructor_payout_batch_finding(
        'subscription-payout-reversed-conflict:'||ev.id,attempt.id,ev.id,'provider_outcome_conflict',
        'Reversal event conflicts with an already failed or reversed invoice payout');
      insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
        values(ev.id,batch_row.id,'conflict','Conflicting terminal invoice payout outcome');
      return query select 'conflict',batch_row.id; return;
    end if;
    perform public.open_learning_instructor_payout_batch_finding(
      'subscription-payout-reversed:'||attempt.id,attempt.id,ev.id,
      'terminal_payout_inconsistent_state',
      'Invoice payout was reversed by the provider; ledger and earning history remain retained for controlled recovery');
    update public.learning_instructor_payout_batch_attempts item set status='reversed',
      provider_transfer_id=coalesce(item.provider_transfer_id,ev.provider_transfer_id),
      provider_transfer_code=coalesce(item.provider_transfer_code,ev.provider_transfer_code),
      provider_status='reversed',provider_received_at=now() where item.id=attempt.id;
    update public.learning_instructor_payout_batches batch set status='reversed' where batch.id=batch_row.id;
    insert into public.learning_instructor_payout_batch_attempt_events(
      attempt_id,event_type,from_status,to_status,provenance,provider_event_id,payload_digest,metadata
    ) values(attempt.id,'paystack.reversed',attempt.status,'reversed',
      case when ev.provenance='provider_webhook' then 'provider_webhook' else 'provider_api' end,
      ev.provider_event_id,ev.payload_digest,jsonb_build_object('provider_transfer_id',ev.provider_transfer_id,
        'source','subscription_invoice'));
    insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
      values(ev.id,batch_row.id,'reversed','Provider reversal retained; no ledger history was rewritten');
    return query select 'reversed',batch_row.id; return;
  end if;

  if ev.provider_status='failed' then
    if attempt.status in ('succeeded','reversed','failed') then
      perform public.open_learning_instructor_payout_batch_finding(
        'subscription-payout-failed-conflict:'||ev.id,attempt.id,ev.id,'provider_outcome_conflict',
        'Failed event conflicts with an existing terminal invoice payout state');
      insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
        values(ev.id,batch_row.id,'conflict','Conflicting terminal invoice payout outcome');
      return query select 'conflict',batch_row.id; return;
    end if;
    perform 1 from public.learning_subscription_refund_cases refund_case
      join public.learning_commercial_allocations allocation on allocation.subscription_invoice_id=refund_case.invoice_id
      join public.learning_instructor_earnings earning on earning.allocation_id=allocation.id
      join public.learning_instructor_payout_batch_members member on member.earning_id=earning.id
      where member.batch_id=batch_row.id;
    if found then item_ineligible:=true; end if;
    for member_row in
      select member.earning_id,member.reservation_id,member.amount_minor,
        reservation.status reservation_status,reservation.future_payout_item_reference,
        earning.status earning_status,earning.instructor_id earning_instructor,
        earning.gross_amount_minor,earning.currency earning_currency,earning.released_at,
        earning.recoverable_amount_minor,allocation.id allocation_id,allocation.status allocation_status,
        allocation.instructor_id allocation_instructor,allocation.gross_amount_minor allocation_gross,
        allocation.platform_commission_minor,allocation.instructor_gross_minor,allocation.currency allocation_currency,
        invoice.id invoice_id,invoice.status invoice_status,invoice.instructor_id invoice_instructor,
        invoice.payment_domain,invoice.provider_transaction_id,invoice.provider_transaction_reference,
        invoice.paid_at,invoice.amount_minor invoice_amount,invoice.platform_share_minor,
        invoice.seller_share_minor,invoice.currency invoice_currency,invoice.commercial_terms_version,
        subscription.payment_domain subscription_domain,plan.payment_domain plan_domain,
        plan.instructor_id plan_instructor,plan.commercial_terms_version plan_terms
      from public.learning_instructor_payout_batch_members member
      join public.learning_instructor_earning_reservations reservation on reservation.id=member.reservation_id
      join public.learning_instructor_earnings earning on earning.id=member.earning_id
      join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
      join public.learning_subscription_invoices invoice on invoice.id=allocation.subscription_invoice_id
      join public.learning_subscriptions subscription on subscription.id=invoice.subscription_id
      join public.learning_subscription_plans plan on plan.id=subscription.plan_id
      where member.batch_id=batch_row.id order by member.earning_id
    loop
      checked_member_count:=checked_member_count+1;
      perform 1 from public.learning_subscription_invoices invoice where invoice.id=member_row.invoice_id for update;
      perform 1 from public.learning_commercial_allocations allocation where allocation.id=member_row.allocation_id for update;
      perform 1 from public.learning_instructor_earnings earning where earning.id=member_row.earning_id for update;
      perform 1 from public.learning_instructor_earning_reservations reservation where reservation.id=member_row.reservation_id for update;
      checked_total:=checked_total+member_row.amount_minor;
      if member_row.reservation_status<>'reserved'
        or member_row.future_payout_item_reference<>'lpb-'||batch_row.id::text||'-earning-'||member_row.earning_id::text
        or member_row.earning_status<>'reserved' or member_row.earning_instructor<>batch_row.instructor_id
        or member_row.gross_amount_minor<>member_row.amount_minor or member_row.earning_currency<>batch_row.currency
        or member_row.released_at is null or member_row.recoverable_amount_minor<>0
        or member_row.allocation_status<>'allocated' or member_row.allocation_instructor<>batch_row.instructor_id
        or member_row.allocation_gross<>member_row.invoice_amount
        or member_row.instructor_gross_minor<>member_row.amount_minor
        or member_row.platform_commission_minor<>member_row.platform_share_minor
        or member_row.seller_share_minor<>member_row.amount_minor
        or member_row.invoice_amount<>member_row.platform_share_minor+member_row.seller_share_minor
        or member_row.allocation_currency<>batch_row.currency or member_row.invoice_status<>'paid'
        or member_row.payment_domain<>'live' or member_row.subscription_domain<>'live'
        or member_row.plan_domain<>'live' or member_row.plan_instructor<>batch_row.instructor_id
        or member_row.invoice_instructor<>batch_row.instructor_id
        or member_row.invoice_currency<>batch_row.currency
        or member_row.commercial_terms_version<>member_row.plan_terms
        or member_row.provider_transaction_id is null or member_row.provider_transaction_reference is null
        or member_row.paid_at is null
        or exists(select 1 from public.learning_subscription_refund_cases refund_case
          where refund_case.invoice_id=member_row.invoice_id)
        or exists(select 1 from public.learning_instructor_payout_settlements settlement
          where settlement.earning_id=member_row.earning_id or settlement.reservation_id=member_row.reservation_id)
        or exists(select 1 from public.learning_instructor_payout_items payout_item
          where payout_item.earning_id=member_row.earning_id or payout_item.reservation_id=member_row.reservation_id)
        or exists(select 1 from public.learning_ledger_transactions transaction
          where transaction.subscription_invoice_id=member_row.invoice_id
            and transaction.transaction_type='instructor_payout_settlement') then
        item_ineligible:=true;
      end if;
    end loop;
    select count(*),coalesce(sum(member.amount_minor),0)::bigint into member_count,actual_total
      from public.learning_instructor_payout_batch_members member where member.batch_id=batch_row.id;
    if member_count=0 or checked_member_count<>member_count or checked_total<>batch_row.amount_minor
      or actual_total<>batch_row.amount_minor or ev.amount_minor<>batch_row.amount_minor then item_ineligible:=true; end if;
    if item_ineligible then
      update public.learning_instructor_payout_batch_attempts item set status='financially_blocked',
        provider_transfer_id=coalesce(item.provider_transfer_id,ev.provider_transfer_id),
        provider_transfer_code=coalesce(item.provider_transfer_code,ev.provider_transfer_code),
        provider_status='failed',provider_received_at=now(),failure_code='financial_protection'
        where item.id=attempt.id and item.status<>'financially_blocked';
      update public.learning_instructor_payout_batches batch set status='financially_blocked' where batch.id=batch_row.id;
      perform public.open_learning_instructor_payout_batch_finding(
        'subscription-payout-failed-blocked:'||attempt.id,attempt.id,ev.id,
        'provider_outcome_financially_blocked','Failed invoice payout is held for financial and member review');
      insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
        values(ev.id,batch_row.id,'deferred','Failed invoice payout is not retryable until financial controls are reviewed');
      return query select 'deferred',batch_row.id; return;
    end if;
    update public.learning_instructor_payout_batch_attempts item set status='failed',
      provider_transfer_id=coalesce(item.provider_transfer_id,ev.provider_transfer_id),
      provider_transfer_code=coalesce(item.provider_transfer_code,ev.provider_transfer_code),
      provider_status='failed',provider_received_at=now(),failure_code='provider_failed' where item.id=attempt.id;
    update public.learning_instructor_payout_batches batch set status='failed' where batch.id=batch_row.id;
    insert into public.learning_instructor_payout_batch_attempt_events(
      attempt_id,event_type,from_status,to_status,provenance,provider_event_id,payload_digest,metadata
    ) values(attempt.id,'paystack.failed',attempt.status,'failed',
      case when ev.provenance='provider_webhook' then 'provider_webhook' else 'provider_api' end,
      ev.provider_event_id,ev.payload_digest,jsonb_build_object('source','subscription_invoice'));
    insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
      values(ev.id,batch_row.id,'failed','Authoritative invoice payout failure recorded; reservations remain attached for exact retry');
    return query select 'failed',batch_row.id; return;
  end if;

  select count(*) into settlement_count from public.learning_instructor_payout_batch_settlements settlement
    where settlement.batch_id=batch_row.id;
  select count(*) into member_count from public.learning_instructor_payout_batch_members member
    where member.batch_id=batch_row.id;
  if settlement_count>0 then
    if settlement_count=member_count and attempt.status='succeeded' then
      insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
        values(ev.id,batch_row.id,'already_processed','Invoice batch already has one settlement for every member');
      return query select 'already_processed',batch_row.id; return;
    end if;
    perform public.open_learning_instructor_payout_batch_finding(
      'subscription-payout-partial-settlement:'||batch_row.id,attempt.id,ev.id,
      'partial_batch_settlement','Invoice payout settlements do not match the immutable batch member count');
    insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
      values(ev.id,batch_row.id,'conflict','Partial or inconsistent invoice settlement requires manual recovery');
    return query select 'conflict',batch_row.id; return;
  end if;
  if attempt.status in ('failed','reversed') or ev.amount_minor<>batch_row.amount_minor then
    perform public.open_learning_instructor_payout_batch_finding(
      'subscription-payout-success-conflict:'||ev.id,attempt.id,ev.id,
      case when ev.amount_minor<>batch_row.amount_minor then 'provider_amount_currency_mismatch' else 'provider_outcome_conflict' end,
      'Provider success conflicts with the invoice batch amount or a prior terminal attempt');
    insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
      values(ev.id,batch_row.id,'conflict','Provider success conflicts with invoice payout state');
    return query select 'conflict',batch_row.id; return;
  end if;

  checked_total:=0; checked_member_count:=0; item_ineligible:=false;
  for member_row in
    select member.earning_id,member.reservation_id,member.amount_minor,
      reservation.status reservation_status,reservation.future_payout_item_reference,
      earning.status earning_status,earning.instructor_id earning_instructor,
      earning.gross_amount_minor,earning.currency earning_currency,earning.released_at,
      earning.recoverable_amount_minor,allocation.id allocation_id,allocation.status allocation_status,
      allocation.instructor_id allocation_instructor,allocation.gross_amount_minor allocation_gross,
      allocation.platform_commission_minor,allocation.instructor_gross_minor,allocation.currency allocation_currency,
      invoice.id invoice_id,invoice.status invoice_status,invoice.instructor_id invoice_instructor,
      invoice.payment_domain,invoice.provider_transaction_id,invoice.provider_transaction_reference,
      invoice.paid_at,invoice.amount_minor invoice_amount,invoice.platform_share_minor,
      invoice.seller_share_minor,invoice.currency invoice_currency,invoice.commercial_terms_version,
      subscription.payment_domain subscription_domain,plan.payment_domain plan_domain,
      plan.instructor_id plan_instructor,plan.commercial_terms_version plan_terms
    from public.learning_instructor_payout_batch_members member
    join public.learning_instructor_earning_reservations reservation on reservation.id=member.reservation_id
    join public.learning_instructor_earnings earning on earning.id=member.earning_id
    join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
    join public.learning_subscription_invoices invoice on invoice.id=allocation.subscription_invoice_id
    join public.learning_subscriptions subscription on subscription.id=invoice.subscription_id
    join public.learning_subscription_plans plan on plan.id=subscription.plan_id
    where member.batch_id=batch_row.id order by member.earning_id
  loop
    checked_member_count:=checked_member_count+1;
    perform 1 from public.learning_subscription_invoices invoice where invoice.id=member_row.invoice_id for update;
    perform 1 from public.learning_commercial_allocations allocation where allocation.id=member_row.allocation_id for update;
    perform 1 from public.learning_instructor_earnings earning where earning.id=member_row.earning_id for update;
    perform 1 from public.learning_instructor_earning_reservations reservation where reservation.id=member_row.reservation_id for update;
    checked_total:=checked_total+member_row.amount_minor;
    if member_row.reservation_status<>'reserved'
      or member_row.future_payout_item_reference<>'lpb-'||batch_row.id::text||'-earning-'||member_row.earning_id::text
      or member_row.earning_status<>'reserved' or member_row.earning_instructor<>batch_row.instructor_id
      or member_row.gross_amount_minor<>member_row.amount_minor or member_row.earning_currency<>batch_row.currency
      or member_row.released_at is null or member_row.recoverable_amount_minor<>0
      or member_row.allocation_status<>'allocated' or member_row.allocation_instructor<>batch_row.instructor_id
      or member_row.allocation_gross<>member_row.invoice_amount
      or member_row.instructor_gross_minor<>member_row.amount_minor
      or member_row.platform_commission_minor<>member_row.platform_share_minor
      or member_row.seller_share_minor<>member_row.amount_minor
      or member_row.invoice_amount<>member_row.platform_share_minor+member_row.seller_share_minor
      or member_row.allocation_currency<>batch_row.currency or member_row.invoice_status<>'paid'
      or member_row.payment_domain<>'live' or member_row.subscription_domain<>'live'
      or member_row.plan_domain<>'live' or member_row.plan_instructor<>batch_row.instructor_id
      or member_row.invoice_instructor<>batch_row.instructor_id
      or member_row.invoice_currency<>batch_row.currency
      or member_row.commercial_terms_version<>member_row.plan_terms
      or member_row.provider_transaction_id is null or member_row.provider_transaction_reference is null
      or member_row.paid_at is null
      or exists(select 1 from public.learning_subscription_refund_cases refund_case
        where refund_case.invoice_id=member_row.invoice_id)
      or exists(select 1 from public.learning_instructor_payout_settlements settlement
        where settlement.earning_id=member_row.earning_id or settlement.reservation_id=member_row.reservation_id)
      or exists(select 1 from public.learning_instructor_payout_items payout_item
        where payout_item.earning_id=member_row.earning_id or payout_item.reservation_id=member_row.reservation_id)
      or exists(select 1 from public.learning_ledger_transactions transaction
        where transaction.subscription_invoice_id=member_row.invoice_id
          and transaction.transaction_type='instructor_payout_settlement') then
      item_ineligible:=true;
    end if;
  end loop;
  select coalesce(sum(member.amount_minor),0)::bigint into actual_total
    from public.learning_instructor_payout_batch_members member where member.batch_id=batch_row.id;
  if member_count=0 or checked_member_count<>member_count or checked_total<>batch_row.amount_minor
    or actual_total<>batch_row.amount_minor then item_ineligible:=true; end if;
  if item_ineligible then
    update public.learning_instructor_payout_batch_attempts item set status='financially_blocked',
      provider_transfer_id=coalesce(item.provider_transfer_id,ev.provider_transfer_id),
      provider_transfer_code=coalesce(item.provider_transfer_code,ev.provider_transfer_code),
      provider_status='success',provider_received_at=now(),failure_code='financial_protection'
      where item.id=attempt.id and item.status<>'financially_blocked';
    update public.learning_instructor_payout_batches batch set status='financially_blocked' where batch.id=batch_row.id;
    perform public.open_learning_instructor_payout_batch_finding(
      'subscription-payout-success-blocked:'||attempt.id,attempt.id,ev.id,
      'provider_outcome_financially_blocked','Provider success retained, but invoice earnings were not settled pending financial review');
    insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
      values(ev.id,batch_row.id,'deferred','Invoice provider success needs controlled financial review');
    return query select 'deferred',batch_row.id; return;
  end if;

  -- Mark the immutable provider outcome first; all subsequent inserts and
  -- earning updates remain in this transaction and roll back together.
  update public.learning_instructor_payout_batch_attempts item set status='succeeded',
    provider_transfer_id=coalesce(item.provider_transfer_id,ev.provider_transfer_id),
    provider_transfer_code=coalesce(item.provider_transfer_code,ev.provider_transfer_code),
    provider_status='success',provider_received_at=now(),failure_code=null where item.id=attempt.id;
  update public.learning_instructor_payout_batches batch set status='succeeded' where batch.id=batch_row.id;

  for member_row in
    select member.earning_id,member.reservation_id,member.amount_minor,
      earning.allocation_id,allocation.subscription_invoice_id,earning.instructor_id,earning.currency
    from public.learning_instructor_payout_batch_members member
    join public.learning_instructor_earnings earning on earning.id=member.earning_id
    join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
    where member.batch_id=batch_row.id order by member.earning_id
  loop
    insert into public.learning_ledger_transactions(
      subscription_invoice_id,transaction_type,currency,description
    ) values(member_row.subscription_invoice_id,'instructor_payout_settlement',member_row.currency,
      'Authoritative Paystack Live subscription invoice payout batch settlement') returning id into ledger_key;
    insert into public.learning_ledger_entries(
      transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference
    ) values
      (ledger_key,1,'liability.instructor_earnings_available',member_row.amount_minor,member_row.currency,
        'instructor_earning',member_row.earning_id::text),
      (ledger_key,2,'asset.paystack_transfer_clearing',-member_row.amount_minor,member_row.currency,
        'learning_instructor_payout_batch',batch_row.batch_reference||':'||member_row.earning_id::text);
    insert into public.learning_instructor_payout_batch_settlements(
      batch_id,attempt_id,provider_event_id,earning_id,reservation_id,ledger_transaction_id,amount_minor,currency
    ) values(batch_row.id,attempt.id,ev.id,member_row.earning_id,member_row.reservation_id,
      ledger_key,member_row.amount_minor,member_row.currency);
    update public.learning_instructor_earnings earning set status='paid',paid_at=now(),
      hold_reason='Paid through an authoritative Paystack Live subscription invoice payout batch'
      where earning.id=member_row.earning_id and earning.status='reserved';
    if not found then raise exception 'Reserved subscription earning cannot be settled' using errcode='40001'; end if;
    insert into public.learning_instructor_earning_events(
      earning_id,event_type,from_status,to_status,ledger_transaction_id,metadata
    ) values(member_row.earning_id,'earning.paid','reserved','paid',ledger_key,
      jsonb_build_object('source','subscription_invoice','subscription_invoice_id',member_row.subscription_invoice_id,
        'batch_reference',batch_row.batch_reference,'provider_event_id',ev.provider_event_id,
        'provider_transfer_id',ev.provider_transfer_id,'provenance',ev.provenance));
  end loop;
  insert into public.learning_instructor_payout_batch_attempt_events(
    attempt_id,event_type,from_status,to_status,provenance,provider_event_id,payload_digest,metadata
  ) values(attempt.id,'paystack.succeeded',attempt.status,'succeeded',
    case when ev.provenance='provider_webhook' then 'provider_webhook' else 'provider_api' end,
    ev.provider_event_id,ev.payload_digest,jsonb_build_object('source','subscription_invoice',
      'provider_transfer_id',ev.provider_transfer_id,'settlement_count',member_count,
      'batch_amount_minor',batch_row.amount_minor));
  insert into public.learning_instructor_payout_batch_event_processing_attempts(provider_event_id,batch_id,outcome,detail)
    values(ev.id,batch_row.id,'settled','All invoice batch members settled exactly once with balanced invoice-linked ledger entries');
  insert into public.learning_instructor_payout_batch_finding_events(finding_id,event_type,detail)
    select finding.id,'resolved','Resolved by authoritative successful invoice payout settlement'
    from public.learning_instructor_payout_batch_reconciliation_findings finding
    where finding.attempt_id=attempt.id
      and not exists(select 1 from public.learning_instructor_payout_batch_finding_events event
        where event.finding_id=finding.id and event.event_type='resolved')
    on conflict on constraint learning_ipb_finding_event_unique do nothing;
  return query select 'settled',batch_row.id;
end;$function$;

revoke all on function public.process_paystack_live_subscription_invoice_payout_batch_event(bigint)
  from public,anon,authenticated,service_role;
grant execute on function public.process_paystack_live_subscription_invoice_payout_batch_event(bigint) to postgres;
revoke all on function public.list_learning_live_payout_batch_candidates(uuid,integer),
  public.list_learning_live_payout_batches(uuid,integer),
  public.get_learning_subscription_invoice_live_payout_batch_preflight(uuid,bigint),
  public.get_learning_live_payout_batch_attempt_source(uuid,bigint)
  from public,anon,authenticated;
grant execute on function public.list_learning_live_payout_batch_candidates(uuid,integer),
  public.list_learning_live_payout_batches(uuid,integer),
  public.get_learning_subscription_invoice_live_payout_batch_preflight(uuid,bigint),
  public.get_learning_live_payout_batch_attempt_source(uuid,bigint)
  to postgres,service_role;

alter function public.process_paystack_live_instructor_payout_batch_event(bigint)
  rename to process_paystack_live_course_order_payout_batch_event;
revoke all on function public.process_paystack_live_course_order_payout_batch_event(bigint)
  from public,anon,authenticated,service_role;

create function public.process_paystack_live_instructor_payout_batch_event(p_provider_event_id bigint)
returns table(outcome text,batch_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare source_kind text;
begin
  select batch.source_type into source_kind
    from public.learning_instructor_payout_batch_provider_events provider_event
    join public.learning_instructor_payout_batch_attempts attempt
      on attempt.attempt_reference=provider_event.attempt_reference
    join public.learning_instructor_payout_batches batch on batch.id=attempt.batch_id
    where provider_event.id=p_provider_event_id;
  if source_kind='subscription_invoice' then
    return query select * from public.process_paystack_live_subscription_invoice_payout_batch_event(p_provider_event_id);
    return;
  end if;
  return query select * from public.process_paystack_live_course_order_payout_batch_event(p_provider_event_id);
end;$function$;

revoke all on function public.process_paystack_live_instructor_payout_batch_event(bigint)
  from public,anon,authenticated;
grant execute on function public.process_paystack_live_instructor_payout_batch_event(bigint)
  to postgres,service_role;

commit;
