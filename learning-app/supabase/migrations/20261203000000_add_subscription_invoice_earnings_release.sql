-- Live subscription invoice earnings may leave their hold only after the
-- immutable invoice, allocation, refund, and maturity checks agree. No payout
-- batch or provider transfer is created by this migration.
begin;

create or replace function public.prevent_unvalidated_subscription_invoice_earning_release()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  invoice_source uuid;
  release_allowed boolean;
begin
  if new.status is not distinct from old.status then return new; end if;
  select allocation.subscription_invoice_id into invoice_source
    from public.learning_commercial_allocations allocation where allocation.id=old.allocation_id;
  if invoice_source is null then return new; end if;

  if old.status='held' and new.status='available' then
    select invoice.status='paid' and invoice.payment_domain='live'
      and invoice.provider_transaction_id is not null
      and invoice.provider_transaction_reference is not null
      and invoice.paid_at is not null
      and allocation.status='allocated'
      and allocation.instructor_id=old.instructor_id
      and invoice.instructor_id=old.instructor_id
      and allocation.instructor_gross_minor=old.gross_amount_minor
      and allocation.currency=old.currency and invoice.currency=old.currency
      and old.available_at<=now() and new.released_at is not null
      and old.recoverable_amount_minor=0
      and not exists (select 1 from public.learning_subscription_refund_cases refund_case
        where refund_case.invoice_id=invoice.id)
      and not exists (select 1 from public.learning_instructor_earning_reservations reservation
        where reservation.earning_id=old.id)
    into release_allowed
    from public.learning_commercial_allocations allocation
    join public.learning_subscription_invoices invoice
      on invoice.id=allocation.subscription_invoice_id
    where allocation.id=old.allocation_id;
    if coalesce(release_allowed,false) then return new; end if;
    raise exception 'Subscription invoice earning is not eligible for release' using errcode='22023';
  end if;
  if new.status in ('available','reserved','paid') then
    raise exception 'Subscription invoice earnings remain held until payout controls are validated'
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

create function public.release_matured_learning_subscription_invoice_earnings(
  p_operator_id uuid, p_limit integer default 100
) returns integer language plpgsql security definer set search_path to '' as $function$
declare
  candidate record;
  earning_row public.learning_instructor_earnings%rowtype;
  invoice_row public.learning_subscription_invoices%rowtype;
  allocation_row public.learning_commercial_allocations%rowtype;
  ledger_key bigint;
  released_count integer:=0;
begin
  if p_operator_id is null or p_limit is null or p_limit not between 1 and 100
    or not exists (select 1 from public.account_capabilities c
      where c.user_id=p_operator_id and c.capability='admin' and c.status='active') then
    raise exception 'Active administrator and valid release limit required' using errcode='42501';
  end if;
  for candidate in
    select e.id, a.subscription_invoice_id
      from public.learning_instructor_earnings e
      join public.learning_commercial_allocations a on a.id=e.allocation_id
      where a.subscription_invoice_id is not null and e.status='held'
        and e.available_at<=now()
      order by e.available_at,e.id limit p_limit
  loop
    -- Refund requests lock their invoice first. Use the same lock order so a
    -- concurrent request either precedes this release or reverses it later.
    select * into invoice_row from public.learning_subscription_invoices
      where id=candidate.subscription_invoice_id for update;
    select * into allocation_row from public.learning_commercial_allocations
      where subscription_invoice_id=invoice_row.id for update;
    select * into earning_row from public.learning_instructor_earnings
      where id=candidate.id for update;
    if not found or earning_row.status<>'held' or earning_row.available_at>now()
      or invoice_row.status<>'paid' or invoice_row.payment_domain<>'live'
      or invoice_row.provider_transaction_id is null
      or invoice_row.provider_transaction_reference is null or invoice_row.paid_at is null
      or allocation_row.status<>'allocated' or allocation_row.id<>earning_row.allocation_id
      or allocation_row.instructor_id<>earning_row.instructor_id
      or invoice_row.instructor_id<>earning_row.instructor_id
      or allocation_row.instructor_gross_minor<>earning_row.gross_amount_minor
      or allocation_row.currency<>earning_row.currency
      or invoice_row.currency<>earning_row.currency or earning_row.recoverable_amount_minor<>0
      or exists (select 1 from public.learning_subscription_refund_cases refund_case
        where refund_case.invoice_id=invoice_row.id)
      or exists (select 1 from public.learning_instructor_earning_reservations reservation
        where reservation.earning_id=earning_row.id)
    then continue; end if;

    insert into public.learning_ledger_transactions(
      subscription_invoice_id,transaction_type,currency,description,created_by
    ) values (invoice_row.id,'instructor_earnings_release',earning_row.currency,
      'Matured subscription invoice instructor earnings released after financial review',p_operator_id)
      returning id into ledger_key;
    insert into public.learning_ledger_entries(
      transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference
    ) values
      (ledger_key,1,'liability.instructor_earnings_held',earning_row.gross_amount_minor,
        earning_row.currency,'instructor_earning',earning_row.id::text),
      (ledger_key,2,'liability.instructor_earnings_available',-earning_row.gross_amount_minor,
        earning_row.currency,'instructor',earning_row.instructor_id::text);
    update public.learning_instructor_earnings
      set status='available',released_at=now(),hold_reason=null
      where id=earning_row.id and status='held';
    if not found then raise exception 'Subscription earning release changed concurrently' using errcode='40001'; end if;
    insert into public.learning_instructor_earning_events(
      earning_id,event_type,from_status,to_status,ledger_transaction_id,actor_user_id,metadata
    ) values (earning_row.id,'earning.available','held','available',ledger_key,p_operator_id,
      jsonb_build_object('source','subscription_invoice','subscription_invoice_id',invoice_row.id));
    released_count:=released_count+1;
  end loop;
  return released_count;
end;$function$;

revoke all on function public.release_matured_learning_subscription_invoice_earnings(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.release_matured_learning_subscription_invoice_earnings(uuid,integer)
  to postgres,service_role;

commit;
