-- Phase 3C: a verified reversal after release but before reservation/transfer
-- must reduce this purchase's available seller liability, not its held balance
-- and not another course's future earnings. Reserved/mixed balances still fail
-- closed. This migration cannot release, reserve, or transfer proceeds.
begin;

alter table public.learning_company_commercial_reversal_ledger_entries
  drop constraint if exists learning_company_commercial_reversal_ledger_entries_account_code_check;
alter table public.learning_company_commercial_reversal_ledger_entries
  add constraint learning_company_commercial_reversal_ledger_entries_account_code_check
  check (account_code in (
    'asset.paystack_receivable',
    'asset.company_seller_recovery_receivable',
    'revenue.platform_commission',
    'liability.company_seller_earnings_held',
    'liability.company_seller_earnings_available'));

create or replace function public.resolve_learning_company_reversal_seller_funding(
  p_purchase_id bigint,p_seller_reversal_minor bigint,p_inbox_event_id bigint,
  p_exclude_reversal_id bigint default null)
returns text language plpgsql security definer set search_path to '' as $function$
declare sale_row public.learning_company_commercial_sales%rowtype;
  seller_reversed bigint; held_reversed bigint; available_reversed bigint;
  receivable_booked bigint; released_total bigint; reserved_total bigint;
  transferred_boundaries bigint; transfer_evidence_total bigint;
  held_remaining bigint; available_remaining bigint; reserved_remaining bigint;
  transferable_remaining bigint;
begin
  if p_purchase_id is null or p_seller_reversal_minor is null or p_seller_reversal_minor < 0
      or p_inbox_event_id is null then
    raise exception 'Invalid company reversal funding request' using errcode = '22023';
  end if;
  perform 1 from public.learning_company_paid_course_purchases purchase
  where purchase.id = p_purchase_id for update;
  if not found then raise exception 'Paid company purchase is required' using errcode = '22023'; end if;
  select * into sale_row from public.learning_company_commercial_sales sale
  where sale.purchase_id = p_purchase_id;
  if not found then raise exception 'Company commercial sale is required' using errcode = '22023'; end if;

  if not exists(select 1 from public.learning_company_seller_outflow_boundaries boundary
      where boundary.purchase_id = p_purchase_id) then
    return 'liability.company_seller_earnings_held';
  end if;
  if sale_row.paystack_domain <> 'live' or sale_row.seller_payee_id is null then
    raise exception 'Post-release company reversal requires a Live sale and verified seller identity'
      using errcode = '22023';
  end if;

  if exists(select 1 from public.learning_company_seller_outflow_boundaries boundary
      where boundary.purchase_id = p_purchase_id and boundary.boundary_kind = 'transferred'
        and not exists(select 1 from public.learning_company_seller_transfer_evidence evidence
          where evidence.boundary_id = boundary.id))
     or exists(select 1 from public.reconcile_learning_company_seller_transfers() issue
       where issue.purchase_id = p_purchase_id
         and issue.issue_type <> 'company_seller_transfer_reversal_review_required')
     or exists(select 1 from public.reconcile_learning_company_seller_liability_movements() issue
       where issue.purchase_id = p_purchase_id)
     or exists(select 1 from public.learning_company_reversal_event_inbox notice
       where notice.purchase_id = p_purchase_id and notice.id <> p_inbox_event_id
         and not exists(select 1 from public.learning_company_commercial_reversals reversal
           where reversal.inbox_event_id = notice.id)) then
    raise exception 'Seller transfer evidence or release ledger requires manual review'
      using errcode = '22023';
  end if;

  if not exists(select 1
      from public.learning_company_paystack_settlement_evidence evidence
      join public.learning_company_paystack_bank_settlement_evidence bank
        on bank.settlement_id = evidence.settlement_id
      join public.learning_company_paid_course_purchase_attempts attempt
        on attempt.id = evidence.attempt_id
      where evidence.purchase_id = p_purchase_id
        and evidence.paystack_domain = 'live' and evidence.currency = 'NGN'
        and evidence.amount_minor = sale_row.gross_amount_minor
        and evidence.provider_reference = sale_row.provider_reference
        and evidence.provider_transaction_id = sale_row.provider_transaction_id
        and attempt.purchase_id = p_purchase_id and attempt.provider = 'paystack'
        and attempt.paystack_domain = 'live' and attempt.status = 'succeeded'
        and attempt.provider_reference = sale_row.provider_reference
        and attempt.provider_transaction_id = sale_row.provider_transaction_id
        and attempt.amount_minor = sale_row.gross_amount_minor and attempt.currency = sale_row.currency
        and bank.effective_amount_minor = bank.bank_credit_amount_minor and bank.currency = 'NGN')
     or not exists(select 1 from public.learning_company_seller_liability_movements movement
       where movement.purchase_id = p_purchase_id and movement.movement_kind = 'released')
     or exists(select 1 from public.learning_company_seller_liability_movements release
       where release.purchase_id = p_purchase_id and release.movement_kind = 'released'
         and not exists(select 1 from public.learning_company_seller_payout_reviews review
           join public.account_capabilities capability on capability.user_id = review.actor_user_id
           where review.purchase_id = p_purchase_id
             and review.decision = 'approve_for_future_release'
             and review.reviewed_at <= release.recorded_at
             and capability.capability = 'admin' and capability.status = 'active'
             and not exists(select 1 from public.learning_company_seller_payout_reviews later_review
               where later_review.purchase_id = review.purchase_id
                 and later_review.reviewed_at > review.reviewed_at
                 and later_review.reviewed_at <= release.recorded_at))) then
    raise exception 'Verified settlement, bank match, and prior active-admin approval are required'
      using errcode = '22023';
  end if;

  select coalesce(sum(reversal.seller_gross_minor),0) into seller_reversed
  from public.learning_company_commercial_reversals reversal
  where reversal.purchase_id = p_purchase_id
    and reversal.id is distinct from p_exclude_reversal_id;
  select coalesce(sum(entry.amount_minor),0) into held_reversed
  from public.learning_company_commercial_reversals reversal
  join public.learning_company_commercial_reversal_ledger_entries entry
    on entry.reversal_id = reversal.id
  where reversal.purchase_id = p_purchase_id and reversal.id is distinct from p_exclude_reversal_id
    and entry.account_code = 'liability.company_seller_earnings_held';
  select coalesce(sum(entry.amount_minor),0) into available_reversed
  from public.learning_company_commercial_reversals reversal
  join public.learning_company_commercial_reversal_ledger_entries entry
    on entry.reversal_id = reversal.id
  where reversal.purchase_id = p_purchase_id and reversal.id is distinct from p_exclude_reversal_id
    and entry.account_code = 'liability.company_seller_earnings_available';
  select coalesce(sum(entry.amount_minor),0) into receivable_booked
  from public.learning_company_commercial_reversals reversal
  join public.learning_company_commercial_reversal_ledger_entries entry
    on entry.reversal_id = reversal.id
  where reversal.purchase_id = p_purchase_id and reversal.id is distinct from p_exclude_reversal_id
    and entry.account_code = 'asset.company_seller_recovery_receivable';
  select coalesce(sum(movement.amount_minor),0) into released_total
  from public.learning_company_seller_liability_movements movement
  where movement.purchase_id = p_purchase_id and movement.movement_kind = 'released';
  select coalesce(sum(movement.amount_minor),0) into reserved_total
  from public.learning_company_seller_liability_movements movement
  where movement.purchase_id = p_purchase_id and movement.movement_kind = 'reserved';
  select coalesce(sum(boundary.amount_minor),0) into transferred_boundaries
  from public.learning_company_seller_outflow_boundaries boundary
  where boundary.purchase_id = p_purchase_id and boundary.boundary_kind = 'transferred';
  select coalesce(sum(evidence.amount_minor),0) into transfer_evidence_total
  from public.learning_company_seller_transfer_evidence evidence
  where evidence.purchase_id = p_purchase_id;

  held_remaining := sale_row.seller_gross_minor - held_reversed - released_total;
  available_remaining := released_total - reserved_total - available_reversed;
  reserved_remaining := reserved_total - transferred_boundaries;
  transferable_remaining := transfer_evidence_total - receivable_booked;
  if held_remaining < 0 or available_remaining < 0 or reserved_remaining < 0 then
    raise exception 'Company seller liability source balance is inconsistent' using errcode = '23514';
  end if;

  if held_remaining = 0
      and available_remaining = sale_row.seller_gross_minor - seller_reversed
      and reserved_total = 0 and transferred_boundaries = 0 and transfer_evidence_total = 0
      and available_remaining >= p_seller_reversal_minor then
    return 'liability.company_seller_earnings_available';
  end if;
  if held_remaining = 0 and available_remaining = 0 and reserved_remaining = 0
      and transfer_evidence_total = transferred_boundaries
      and transferable_remaining = sale_row.seller_gross_minor - seller_reversed
      and p_seller_reversal_minor <= transferable_remaining then
    return 'asset.company_seller_recovery_receivable';
  end if;
  raise exception 'Company seller reversal has mixed, held, reserved, or insufficient funding; manual review required'
    using errcode = '22023';
end;$function$;

create or replace function public.guard_learning_company_held_only_reversal()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  perform public.resolve_learning_company_reversal_seller_funding(
    new.purchase_id,new.seller_gross_minor,new.inbox_event_id,null);
  return new;
end;$function$;

create function public.route_learning_company_reversal_seller_funding()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare reversal_row public.learning_company_commercial_reversals%rowtype;
  expected_account text;
begin
  if new.account_code not in ('liability.company_seller_earnings_held',
      'liability.company_seller_earnings_available','asset.company_seller_recovery_receivable') then
    return new;
  end if;
  select * into reversal_row from public.learning_company_commercial_reversals reversal
  where reversal.id = new.reversal_id;
  if not found then raise exception 'Company reversal is required' using errcode = '22023'; end if;
  expected_account := public.resolve_learning_company_reversal_seller_funding(
    reversal_row.purchase_id,reversal_row.seller_gross_minor,
    reversal_row.inbox_event_id,reversal_row.id);
  if expected_account = 'liability.company_seller_earnings_available'
      and new.account_code = 'liability.company_seller_earnings_held' then
    new.account_code := expected_account;
  elsif new.account_code <> expected_account then
    raise exception 'Company reversal seller funding account does not match its verified source'
      using errcode = '23514';
  end if;
  return new;
end;$function$;

create trigger route_learning_company_reversal_seller_funding
before insert on public.learning_company_commercial_reversal_ledger_entries
for each row execute function public.route_learning_company_reversal_seller_funding();

create or replace function public.validate_learning_company_seller_liability_movement()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare boundary_row public.learning_company_seller_outflow_boundaries%rowtype;
  sale_row public.learning_company_commercial_sales%rowtype;
  released_total bigint; reserved_total bigint; reversed_total bigint; available_reversed bigint;
begin
  perform 1 from public.learning_company_paid_course_purchases purchase
  where purchase.id = new.purchase_id for update;
  select * into boundary_row from public.learning_company_seller_outflow_boundaries boundary
  where boundary.id = new.boundary_id;
  select * into sale_row from public.learning_company_commercial_sales sale
  where sale.purchase_id = new.purchase_id;
  if not found or boundary_row.id is null
      or boundary_row.purchase_id <> new.purchase_id
      or boundary_row.seller_payee_id <> new.seller_payee_id
      or boundary_row.boundary_kind <> new.movement_kind
      or boundary_row.amount_minor <> new.amount_minor
      or boundary_row.currency <> new.currency
      or sale_row.seller_payee_id <> new.seller_payee_id
      or sale_row.currency <> new.currency then
    raise exception 'Company seller liability movement identity mismatch' using errcode = '22023';
  end if;
  select coalesce(sum(movement.amount_minor),0) into released_total
  from public.learning_company_seller_liability_movements movement
  where movement.purchase_id = new.purchase_id and movement.movement_kind = 'released';
  select coalesce(sum(movement.amount_minor),0) into reserved_total
  from public.learning_company_seller_liability_movements movement
  where movement.purchase_id = new.purchase_id and movement.movement_kind = 'reserved';
  select coalesce(sum(reversal.seller_gross_minor),0) into reversed_total
  from public.learning_company_commercial_reversals reversal
  where reversal.purchase_id = new.purchase_id;
  select coalesce(sum(entry.amount_minor),0) into available_reversed
  from public.learning_company_commercial_reversals reversal
  join public.learning_company_commercial_reversal_ledger_entries entry
    on entry.reversal_id = reversal.id
  where reversal.purchase_id = new.purchase_id
    and entry.account_code = 'liability.company_seller_earnings_available';
  if new.movement_kind = 'released' then
    released_total := released_total + new.amount_minor;
  else
    reserved_total := reserved_total + new.amount_minor;
  end if;
  if released_total > sale_row.seller_gross_minor - reversed_total
      or reserved_total > released_total - available_reversed then
    raise exception 'Company seller liability movement exceeds its source balance'
      using errcode = '23514';
  end if;
  return new;
end;$function$;

create or replace function public.reconcile_learning_company_seller_liability_movements()
returns table(purchase_id bigint,issue_type text)
language sql stable security definer set search_path to '' as $function$
  select movement.purchase_id,'company_seller_liability_movement_ledger_mismatch'::text
  from public.learning_company_seller_liability_movements movement
  left join public.learning_company_seller_liability_movement_entries debit
    on debit.movement_id = movement.id and debit.line_number = 1
  left join public.learning_company_seller_liability_movement_entries credit
    on credit.movement_id = movement.id and credit.line_number = 2
  where debit.amount_minor is distinct from movement.amount_minor
    or credit.amount_minor is distinct from -movement.amount_minor
    or debit.currency is distinct from movement.currency
    or credit.currency is distinct from movement.currency
    or debit.account_code is distinct from case movement.movement_kind
      when 'released' then 'liability.company_seller_earnings_held'
      else 'liability.company_seller_earnings_available' end
    or credit.account_code is distinct from case movement.movement_kind
      when 'released' then 'liability.company_seller_earnings_available'
      else 'liability.company_seller_earnings_reserved' end
  union all
  select boundary.purchase_id,'company_seller_outflow_boundary_without_ledger'::text
  from public.learning_company_seller_outflow_boundaries boundary
  where boundary.boundary_kind in ('released','reserved')
    and not exists(select 1 from public.learning_company_seller_liability_movements movement
      where movement.boundary_id = boundary.id)
  union all
  select hold.purchase_id,'company_seller_liability_negative_held'::text
  from public.list_learning_company_seller_held_liabilities() hold
  where hold.remaining_held_minor < 0
  union all
  select sale.purchase_id,'company_seller_liability_over_reserved'::text
  from public.learning_company_commercial_sales sale
  where coalesce((select sum(movement.amount_minor)
      from public.learning_company_seller_liability_movements movement
      where movement.purchase_id = sale.purchase_id and movement.movement_kind = 'reserved'),0)
    > coalesce((select sum(movement.amount_minor)
      from public.learning_company_seller_liability_movements movement
      where movement.purchase_id = sale.purchase_id and movement.movement_kind = 'released'),0)
      - coalesce((select sum(entry.amount_minor)
        from public.learning_company_commercial_reversals reversal
        join public.learning_company_commercial_reversal_ledger_entries entry
          on entry.reversal_id = reversal.id
        where reversal.purchase_id = sale.purchase_id
          and entry.account_code = 'liability.company_seller_earnings_available'),0)
  union all
  select sale.purchase_id,'company_seller_liability_negative_available'::text
  from public.learning_company_commercial_sales sale
  where coalesce((select sum(movement.amount_minor)
      from public.learning_company_seller_liability_movements movement
      where movement.purchase_id = sale.purchase_id and movement.movement_kind = 'released'),0)
    - coalesce((select sum(movement.amount_minor)
      from public.learning_company_seller_liability_movements movement
      where movement.purchase_id = sale.purchase_id and movement.movement_kind = 'reserved'),0)
    - coalesce((select sum(entry.amount_minor)
      from public.learning_company_commercial_reversals reversal
      join public.learning_company_commercial_reversal_ledger_entries entry
        on entry.reversal_id = reversal.id
      where reversal.purchase_id = sale.purchase_id
        and entry.account_code = 'liability.company_seller_earnings_available'),0) < 0;
$function$;

create or replace function public.reconcile_learning_company_commercial_reversals()
returns table(reversal_id bigint,issue_type text)
language sql stable security definer set search_path to '' as $function$
  select reversal.id,'company_reversal_seat_sum_mismatch'::text
  from public.learning_company_commercial_reversals reversal
  where reversal.gross_amount_minor <> coalesce((select sum(line.unit_amount_minor)
      from public.learning_company_commercial_reversal_lines line where line.reversal_id = reversal.id),0)
    or reversal.platform_commission_minor <> coalesce((select sum(line.platform_commission_minor)
      from public.learning_company_commercial_reversal_lines line where line.reversal_id = reversal.id),0)
    or reversal.seller_gross_minor <> coalesce((select sum(line.seller_gross_minor)
      from public.learning_company_commercial_reversal_lines line where line.reversal_id = reversal.id),0)
  union all
  select reversal.id,'company_reversal_ledger_mismatch'::text
  from public.learning_company_commercial_reversals reversal
  where (select coalesce(sum(entry.amount_minor),0)
      from public.learning_company_commercial_reversal_ledger_entries entry
      where entry.reversal_id = reversal.id and entry.account_code = 'revenue.platform_commission')
        <> reversal.platform_commission_minor
    or (select coalesce(sum(entry.amount_minor),0)
      from public.learning_company_commercial_reversal_ledger_entries entry
      where entry.reversal_id = reversal.id
        and entry.account_code in ('liability.company_seller_earnings_held',
          'liability.company_seller_earnings_available','asset.company_seller_recovery_receivable'))
        <> reversal.seller_gross_minor
    or (select count(*) from public.learning_company_commercial_reversal_ledger_entries entry
      where entry.reversal_id = reversal.id
        and entry.account_code in ('liability.company_seller_earnings_held',
          'liability.company_seller_earnings_available','asset.company_seller_recovery_receivable')) > 1
    or (select coalesce(sum(entry.amount_minor),0)
      from public.learning_company_commercial_reversal_ledger_entries entry
      where entry.reversal_id = reversal.id and entry.account_code = 'asset.paystack_receivable')
        <> -reversal.gross_amount_minor
  union all
  select reversal.id,'company_recovery_receivable_missing_transfer_evidence'::text
  from public.learning_company_commercial_reversals reversal
  join public.learning_company_commercial_reversal_ledger_entries recovery_entry
    on recovery_entry.reversal_id = reversal.id
    and recovery_entry.account_code = 'asset.company_seller_recovery_receivable'
  where not exists(select 1 from public.learning_company_seller_transfer_evidence evidence
    where evidence.purchase_id = reversal.purchase_id
      and evidence.seller_payee_id = (select sale.seller_payee_id
        from public.learning_company_commercial_sales sale where sale.purchase_id = reversal.purchase_id)
      and evidence.recorded_at <= reversal.verified_at)
  union all
  select reversal.id,'company_recovery_receivable_exceeds_verified_transfers'::text
  from public.learning_company_commercial_reversals reversal
  where coalesce((select sum(entry.amount_minor)
      from public.learning_company_commercial_reversals earlier
      join public.learning_company_commercial_reversal_ledger_entries entry
        on entry.reversal_id = earlier.id
      where earlier.purchase_id = reversal.purchase_id and earlier.id <= reversal.id
        and entry.account_code = 'asset.company_seller_recovery_receivable'),0)
    > coalesce((select sum(evidence.amount_minor)
      from public.learning_company_seller_transfer_evidence evidence
      where evidence.purchase_id = reversal.purchase_id
        and evidence.recorded_at <= reversal.verified_at),0);
$function$;

create or replace function public.reconcile_learning_company_seller_held_liabilities()
returns table(purchase_id bigint,issue_type text)
language sql stable security definer set search_path to '' as $function$
  with balances as (
    select hold.purchase_id,hold.original_held_minor,hold.reversed_minor,
      hold.remaining_held_minor,
      coalesce((select sum(entry.amount_minor)
        from public.learning_company_sale_ledger_transactions transaction_row
        join public.learning_company_sale_ledger_entries entry
          on entry.transaction_id = transaction_row.id
        where transaction_row.purchase_id = hold.purchase_id
          and entry.account_code = 'liability.company_seller_earnings_held'),0)::bigint as sale_ledger_minor,
      coalesce((select sum(entry.amount_minor)
        from public.learning_company_commercial_reversals reversal
        join public.learning_company_commercial_reversal_ledger_entries entry
          on entry.reversal_id = reversal.id
        where reversal.purchase_id = hold.purchase_id
          and entry.account_code = 'liability.company_seller_earnings_held'),0)::bigint as held_reversal_minor,
      coalesce((select sum(entry.amount_minor)
        from public.learning_company_commercial_reversals reversal
        join public.learning_company_commercial_reversal_ledger_entries entry
          on entry.reversal_id = reversal.id
        where reversal.purchase_id = hold.purchase_id
          and entry.account_code = 'liability.company_seller_earnings_available'),0)::bigint as available_reversal_minor,
      coalesce((select sum(entry.amount_minor)
        from public.learning_company_commercial_reversals reversal
        join public.learning_company_commercial_reversal_ledger_entries entry
          on entry.reversal_id = reversal.id
        where reversal.purchase_id = hold.purchase_id
          and entry.account_code = 'asset.company_seller_recovery_receivable'),0)::bigint as recovery_reversal_minor,
      coalesce((select sum(movement.amount_minor)
        from public.learning_company_seller_liability_movements movement
        where movement.purchase_id = hold.purchase_id and movement.movement_kind = 'released'),0)::bigint as released_minor
    from public.list_learning_company_seller_held_liabilities() hold
  )
  select balance.purchase_id,'company_seller_held_capture_mismatch'::text
  from balances balance where balance.sale_ledger_minor <> -balance.original_held_minor
  union all
  select balance.purchase_id,'company_seller_held_reversal_mismatch'::text
  from balances balance
  where balance.reversed_minor <> balance.held_reversal_minor
      + balance.available_reversal_minor + balance.recovery_reversal_minor
    or (balance.sale_ledger_minor = -balance.original_held_minor
      and balance.remaining_held_minor <> -(balance.sale_ledger_minor
        + balance.held_reversal_minor + balance.released_minor))
  union all
  select balance.purchase_id,'company_seller_held_negative_balance'::text
  from balances balance where balance.remaining_held_minor < 0;
$function$;

revoke all on function public.resolve_learning_company_reversal_seller_funding(bigint,bigint,bigint,bigint),
  public.route_learning_company_reversal_seller_funding(),
  public.validate_learning_company_seller_liability_movement()
  from public,anon,authenticated,service_role;
grant execute on function public.reconcile_learning_company_seller_liability_movements(),
  public.reconcile_learning_company_commercial_reversals(),
  public.reconcile_learning_company_seller_held_liabilities()
  to postgres,service_role;

commit;
