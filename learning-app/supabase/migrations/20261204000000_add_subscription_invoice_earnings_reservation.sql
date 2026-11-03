-- Invoice-specific reservation is independent of ordinary course orders. It
-- remains service-only and cannot initiate a provider transfer.
begin;

create or replace function public.prevent_unvalidated_subscription_invoice_earning_release()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  invoice_source uuid;
  financial_source_valid boolean;
begin
  if new.status is not distinct from old.status then return new; end if;
  select allocation.subscription_invoice_id into invoice_source
    from public.learning_commercial_allocations allocation where allocation.id=old.allocation_id;
  if invoice_source is null then return new; end if;

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

create function public.reserve_learning_subscription_invoice_earning(
  p_earning_id bigint,p_instructor_id uuid,p_idempotency_key text,p_actor_user_id uuid
) returns table(
  reservation_id bigint,reservation_reference text,earning_id bigint,instructor_id uuid,
  amount_minor bigint,currency text,status text,reserved_at timestamptz
) language plpgsql security definer set search_path to '' as $function$
declare
  invoice_key uuid;
  invoice_row public.learning_subscription_invoices%rowtype;
  allocation_row public.learning_commercial_allocations%rowtype;
  earning_row public.learning_instructor_earnings%rowtype;
  existing_row public.learning_instructor_earning_reservations%rowtype;
  reservation_key bigint;
begin
  if p_earning_id is null or p_instructor_id is null or p_actor_user_id is null
    or p_idempotency_key is null or p_idempotency_key !~ '^[a-z][a-z0-9:_-]{2,120}$'
    or not exists (select 1 from public.account_capabilities c
      where c.user_id=p_actor_user_id and c.capability='admin' and c.status='active') then
    raise exception 'Valid administrator and reservation identity required' using errcode='42501';
  end if;
  perform public.assert_learning_approved_instructor(p_instructor_id);
  perform pg_advisory_xact_lock(hashtextextended('learning-earning-reservation:'||p_earning_id::text,0));
  select * into existing_row from public.learning_instructor_earning_reservations
    where idempotency_key=p_idempotency_key for update;
  if found then
    if existing_row.earning_id<>p_earning_id or existing_row.instructor_id<>p_instructor_id then
      raise exception 'Reservation idempotency conflict' using errcode='23505';
    end if;
    return query select existing_row.id,existing_row.reservation_reference,existing_row.earning_id,
      existing_row.instructor_id,existing_row.amount_minor,existing_row.currency,
      existing_row.status,existing_row.reserved_at;
    return;
  end if;
  select allocation.subscription_invoice_id into invoice_key
    from public.learning_instructor_earnings earning
    join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
    where earning.id=p_earning_id;
  if invoice_key is null then raise exception 'Subscription invoice source required' using errcode='22023'; end if;
  -- Match the refund request lock order: invoice, allocation, earning.
  select * into invoice_row from public.learning_subscription_invoices
    where id=invoice_key for update;
  select * into allocation_row from public.learning_commercial_allocations
    where subscription_invoice_id=invoice_key for update;
  select * into earning_row from public.learning_instructor_earnings
    where id=p_earning_id for update;
  if invoice_row.status<>'paid' or invoice_row.payment_domain<>'live'
    or invoice_row.provider_transaction_id is null
    or invoice_row.provider_transaction_reference is null or invoice_row.paid_at is null
    or allocation_row.id<>earning_row.allocation_id or allocation_row.status<>'allocated'
    or allocation_row.instructor_id<>p_instructor_id or invoice_row.instructor_id<>p_instructor_id
    or allocation_row.instructor_gross_minor<>earning_row.gross_amount_minor
    or allocation_row.currency<>earning_row.currency or invoice_row.currency<>earning_row.currency
    or earning_row.instructor_id<>p_instructor_id or earning_row.currency<>'NGN'
    or earning_row.status<>'available' or earning_row.released_at is null
    or earning_row.available_at>now() or earning_row.recoverable_amount_minor<>0
    or exists (select 1 from public.learning_subscription_refund_cases refund_case
      where refund_case.invoice_id=invoice_key)
    or exists (select 1 from public.learning_instructor_earning_reservations reservation
      where reservation.earning_id=p_earning_id)
  then raise exception 'Subscription invoice earning is not eligible for reservation' using errcode='22023'; end if;

  insert into public.learning_instructor_earning_reservations(
    reservation_reference,idempotency_key,earning_id,allocation_id,instructor_id,
    amount_minor,currency,status,source,actor_user_id
  ) values ('LER-'||earning_row.id::text,p_idempotency_key,earning_row.id,allocation_row.id,
    p_instructor_id,earning_row.gross_amount_minor,earning_row.currency,'reserved','admin_internal',p_actor_user_id)
    returning id into reservation_key;
  update public.learning_instructor_earnings e
    set status='reserved',reserved_at=now(),hold_reason='Reserved for a controlled subscription payout'
    where e.id=earning_row.id and e.status='available';
  if not found then raise exception 'Subscription earning reservation changed concurrently' using errcode='40001'; end if;
  insert into public.learning_instructor_earning_events(
    earning_id,event_type,from_status,to_status,actor_user_id,metadata
  ) values (earning_row.id,'earning.reserved','available','reserved',p_actor_user_id,
    jsonb_build_object('source','subscription_invoice','subscription_invoice_id',invoice_key,
      'reservation_id',reservation_key));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    values (p_actor_user_id,'admin_operator','subscription_earning.reserved',
      'learning_instructor_earning',earning_row.id::text,
      jsonb_build_object('subscription_invoice_id',invoice_key,'reservation_id',reservation_key));
  return query select reservation.id,reservation.reservation_reference,reservation.earning_id,
    reservation.instructor_id,reservation.amount_minor,reservation.currency,
    reservation.status,reservation.reserved_at
    from public.learning_instructor_earning_reservations reservation where reservation.id=reservation_key;
end;$function$;

revoke all on function public.reserve_learning_subscription_invoice_earning(bigint,uuid,text,uuid)
  from public,anon,authenticated;
grant execute on function public.reserve_learning_subscription_invoice_earning(bigint,uuid,text,uuid)
  to postgres,service_role;

commit;
