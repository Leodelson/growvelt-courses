-- Phase 3C: if a verified company refund/lost dispute follows a fully
-- transferred seller balance, debit a private recovery receivable instead of
-- reversing a liability that is no longer held. Partial/mixed/reserved cases
-- remain blocked for manual review. This does not collect from sellers.
begin;

do $migration$
declare old_constraint text;
begin
  select constraint_row.conname into old_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid =
      'public.learning_company_commercial_reversal_ledger_entries'::regclass
    and constraint_row.contype = 'c'
    and pg_get_constraintdef(constraint_row.oid) like '%asset.paystack_receivable%'
    and pg_get_constraintdef(constraint_row.oid) like '%liability.company_seller_earnings_held%'
  limit 1;
  if old_constraint is null then
    raise exception 'Existing company reversal account constraint was not found';
  end if;
  execute format('alter table public.learning_company_commercial_reversal_ledger_entries drop constraint %I',
    old_constraint);
end;$migration$;
alter table public.learning_company_commercial_reversal_ledger_entries
  add constraint learning_company_commercial_reversal_ledger_entries_account_code_check
  check (account_code in (
    'asset.paystack_receivable',
    'asset.company_seller_recovery_receivable',
    'revenue.platform_commission',
    'liability.company_seller_earnings_held'));

create or replace function public.guard_learning_company_held_only_reversal()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare sale_row public.learning_company_commercial_sales%rowtype;
  seller_reversed bigint; held_reversed bigint; receivable_booked bigint;
  released_total bigint; reserved_total bigint; transferred_boundaries bigint;
  transfer_evidence_total bigint; held_remaining bigint; available_remaining bigint;
  reserved_remaining bigint; transferable_remaining bigint;
begin
  perform 1 from public.learning_company_paid_course_purchases purchase
  where purchase.id = new.purchase_id for update;
  if not found then raise exception 'Paid company purchase is required' using errcode = '22023'; end if;
  if not exists(select 1 from public.learning_company_seller_outflow_boundaries boundary
      where boundary.purchase_id = new.purchase_id) then
    return new;
  end if;

  select * into sale_row from public.learning_company_commercial_sales sale
  where sale.purchase_id = new.purchase_id;
  if not found or sale_row.paystack_domain <> 'live' or sale_row.seller_payee_id is null then
    raise exception 'Company seller outflow requires manual post-release reversal accounting; only a verified Live transfer is eligible'
      using errcode = '22023';
  end if;

  if exists(select 1 from public.learning_company_seller_outflow_boundaries boundary
      where boundary.purchase_id = new.purchase_id and boundary.boundary_kind = 'transferred'
        and not exists(select 1 from public.learning_company_seller_transfer_evidence evidence
          where evidence.boundary_id = boundary.id))
     or exists(select 1 from public.reconcile_learning_company_seller_transfers() issue
       where issue.purchase_id = new.purchase_id
         and issue.issue_type <> 'company_seller_transfer_reversal_review_required')
     or exists(select 1 from public.reconcile_learning_company_seller_liability_movements() issue
       where issue.purchase_id = new.purchase_id)
     or exists(select 1 from public.learning_company_reversal_event_inbox notice
       where notice.purchase_id = new.purchase_id and notice.id <> new.inbox_event_id
         and not exists(select 1 from public.learning_company_commercial_reversals reversal
           where reversal.inbox_event_id = notice.id)) then
    raise exception 'Seller transfer evidence or release ledger requires manual review'
      using errcode = '22023';
  end if;

  if not exists(select 1 from public.learning_company_paystack_settlement_evidence evidence
      where evidence.purchase_id = new.purchase_id
        and evidence.paystack_domain = 'live' and evidence.currency = 'NGN'
        and evidence.amount_minor = sale_row.gross_amount_minor
        and evidence.provider_reference = sale_row.provider_reference
        and evidence.provider_transaction_id = sale_row.provider_transaction_id)
     or not exists(select 1 from public.learning_company_seller_liability_movements movement
       where movement.purchase_id = new.purchase_id and movement.movement_kind = 'released')
     or exists(select 1 from public.learning_company_seller_liability_movements release
       where release.purchase_id = new.purchase_id and release.movement_kind = 'released'
         and not exists(select 1 from public.learning_company_seller_payout_reviews review
           join public.account_capabilities capability on capability.user_id = review.actor_user_id
           where review.purchase_id = new.purchase_id
             and review.decision = 'approve_for_future_release'
             and review.reviewed_at <= release.recorded_at
             and capability.capability = 'admin' and capability.status = 'active'
             and not exists(select 1 from public.learning_company_seller_payout_reviews later_review
               where later_review.purchase_id = review.purchase_id
                 and later_review.reviewed_at > review.reviewed_at
                 and later_review.reviewed_at <= release.recorded_at))) then
    raise exception 'Current settlement evidence and prior active-admin approval are required'
      using errcode = '22023';
  end if;

  select coalesce(sum(reversal.seller_gross_minor),0) into seller_reversed
  from public.learning_company_commercial_reversals reversal
  where reversal.purchase_id = new.purchase_id;
  select coalesce(sum(entry.amount_minor),0) into held_reversed
  from public.learning_company_commercial_reversals reversal
  join public.learning_company_commercial_reversal_ledger_entries entry
    on entry.reversal_id = reversal.id
  where reversal.purchase_id = new.purchase_id
    and entry.account_code = 'liability.company_seller_earnings_held';
  select coalesce(sum(entry.amount_minor),0) into receivable_booked
  from public.learning_company_commercial_reversals reversal
  join public.learning_company_commercial_reversal_ledger_entries entry
    on entry.reversal_id = reversal.id
  where reversal.purchase_id = new.purchase_id
    and entry.account_code = 'asset.company_seller_recovery_receivable';
  select coalesce(sum(movement.amount_minor),0) into released_total
  from public.learning_company_seller_liability_movements movement
  where movement.purchase_id = new.purchase_id and movement.movement_kind = 'released';
  select coalesce(sum(movement.amount_minor),0) into reserved_total
  from public.learning_company_seller_liability_movements movement
  where movement.purchase_id = new.purchase_id and movement.movement_kind = 'reserved';
  select coalesce(sum(boundary.amount_minor),0) into transferred_boundaries
  from public.learning_company_seller_outflow_boundaries boundary
  where boundary.purchase_id = new.purchase_id and boundary.boundary_kind = 'transferred';
  select coalesce(sum(evidence.amount_minor),0) into transfer_evidence_total
  from public.learning_company_seller_transfer_evidence evidence
  where evidence.purchase_id = new.purchase_id;

  held_remaining := sale_row.seller_gross_minor - held_reversed - released_total;
  available_remaining := released_total - reserved_total;
  reserved_remaining := reserved_total - transferred_boundaries;
  transferable_remaining := transfer_evidence_total - receivable_booked;
  if held_remaining <> 0 or available_remaining <> 0 or reserved_remaining <> 0
     or transfer_evidence_total <> transferred_boundaries
     or transferable_remaining <> sale_row.seller_gross_minor - seller_reversed
     or new.seller_gross_minor > transferable_remaining then
    raise exception 'Company seller reversal has mixed, held, available, reserved, or insufficient transfer funding'
      using errcode = '22023';
  end if;
  return new;
end;$function$;

create or replace function public.post_learning_company_commercial_reversal(
  p_inbox_event_id bigint,p_provider_transaction_id text,p_verified_status text,
  p_verified_resolution text,p_verified_amount_minor bigint,p_selected_user_ids uuid[])
returns bigint language plpgsql security definer set search_path to '' as $function$
declare notice_row public.learning_company_reversal_event_inbox%rowtype;
  sale_row public.learning_company_commercial_sales%rowtype;
  existing_row public.learning_company_commercial_reversals%rowtype;
  reversal_kind text; reversal_key bigint; selected_count integer; selected_distinct_count integer;
  selected_gross bigint; selected_platform bigint; selected_seller bigint;
  seller_reversal_account text;
begin
  if p_inbox_event_id is null or p_verified_amount_minor is null or p_verified_amount_minor <= 0
     or p_provider_transaction_id is null or p_provider_transaction_id !~ '^[1-9][0-9]*$'
     or p_selected_user_ids is null or cardinality(p_selected_user_ids) = 0 then
    raise exception 'Invalid company reversal evidence or seat selection' using errcode = '22023';
  end if;
  select * into notice_row from public.learning_company_reversal_event_inbox notice
  where notice.id = p_inbox_event_id for share;
  if not found or notice_row.provider_case_id !~ '^[1-9][0-9]*$' then
    raise exception 'Company reversal notice was not found or has no numeric provider case ID' using errcode = '22023';
  end if;
  if notice_row.event_type = 'refund.processed' and p_verified_status = 'processed' then
    reversal_kind := 'processed_refund';
  elsif notice_row.event_type = 'charge.dispute.resolve'
        and p_verified_status = 'resolved' and p_verified_resolution = 'merchant-accepted' then
    reversal_kind := 'lost_dispute';
  else
    raise exception 'Final provider reversal outcome is required' using errcode = '22023';
  end if;
  perform 1 from public.learning_company_paid_course_purchases purchase
  where purchase.id = notice_row.purchase_id and purchase.status = 'paid' for update;
  if not found then raise exception 'Paid company purchase is required' using errcode = '22023'; end if;
  select * into sale_row from public.learning_company_commercial_sales sale
  where sale.purchase_id = notice_row.purchase_id;
  if not found or sale_row.attempt_id <> notice_row.attempt_id
     or sale_row.paystack_domain <> notice_row.paystack_domain
     or sale_row.provider_reference <> notice_row.provider_reference
     or sale_row.provider_transaction_id <> p_provider_transaction_id
     or sale_row.currency <> notice_row.currency then
    raise exception 'Company sale does not match verified reversal identity' using errcode = '22023';
  end if;
  select count(*),count(distinct selected.user_id) into selected_count,selected_distinct_count
  from unnest(p_selected_user_ids) as selected(user_id);
  if selected_count <> selected_distinct_count or exists(
    select 1 from unnest(p_selected_user_ids) as selected(user_id) where selected.user_id is null) then
    raise exception 'Company reversal seats must be unique and non-null' using errcode = '22023';
  end if;
  select coalesce(sum(line.unit_amount_minor),0),coalesce(sum(line.platform_commission_minor),0),
    coalesce(sum(line.seller_gross_minor),0)
  into selected_gross,selected_platform,selected_seller
  from public.learning_company_commercial_sale_lines line
  where line.purchase_id = sale_row.purchase_id
    and line.assigned_user_id = any(p_selected_user_ids);
  if (select count(*) from public.learning_company_commercial_sale_lines line
      where line.purchase_id = sale_row.purchase_id
        and line.assigned_user_id = any(p_selected_user_ids)) <> selected_count
     or selected_gross <> p_verified_amount_minor
     or selected_gross <> selected_platform + selected_seller
     or (reversal_kind = 'lost_dispute'
       and (selected_count <> sale_row.seat_count or selected_gross <> sale_row.gross_amount_minor)) then
    raise exception 'Company reversal amount or paid seats do not match sale lines' using errcode = '22023';
  end if;
  select * into existing_row from public.learning_company_commercial_reversals reversal
  where reversal.paystack_domain = sale_row.paystack_domain
    and reversal.reversal_type = reversal_kind
    and reversal.provider_case_id = notice_row.provider_case_id;
  if found then
    if existing_row.purchase_id <> sale_row.purchase_id
       or existing_row.gross_amount_minor <> selected_gross
       or existing_row.platform_commission_minor <> selected_platform
       or existing_row.seller_gross_minor <> selected_seller
       or (select count(*) from public.learning_company_commercial_reversal_lines line
           where line.reversal_id = existing_row.id and line.assigned_user_id = any(p_selected_user_ids)) <> selected_count then
      raise exception 'Provider reversal case conflicts with an earlier posting' using errcode = '23505';
    end if;
    return existing_row.id;
  end if;
  if (select count(*) from public.learning_company_paid_seat_access access_row
      where access_row.purchase_id = sale_row.purchase_id
        and access_row.assigned_user_id = any(p_selected_user_ids)
        and access_row.status = 'active') <> selected_count then
    raise exception 'Active company paid-seat provenance is required' using errcode = '22023';
  end if;
  if exists(select 1 from public.learning_company_commercial_reversal_lines line
    where line.purchase_id = sale_row.purchase_id and line.assigned_user_id = any(p_selected_user_ids)) then
    raise exception 'A company paid seat has already been reversed' using errcode = '23505';
  end if;

  insert into public.learning_company_commercial_reversals(
    purchase_id,inbox_event_id,reversal_type,paystack_domain,provider_case_id,
    provider_reference,provider_transaction_id,gross_amount_minor,
    platform_commission_minor,seller_gross_minor,currency)
  values(sale_row.purchase_id,p_inbox_event_id,reversal_kind,sale_row.paystack_domain,
    notice_row.provider_case_id,sale_row.provider_reference,sale_row.provider_transaction_id,
    selected_gross,selected_platform,selected_seller,sale_row.currency)
  returning id into reversal_key;
  insert into public.learning_company_commercial_reversal_lines(
    reversal_id,purchase_id,assigned_user_id,unit_amount_minor,
    platform_commission_minor,seller_gross_minor,currency)
  select reversal_key,line.purchase_id,line.assigned_user_id,line.unit_amount_minor,
    line.platform_commission_minor,line.seller_gross_minor,line.currency
  from public.learning_company_commercial_sale_lines line
  where line.purchase_id = sale_row.purchase_id and line.assigned_user_id = any(p_selected_user_ids);

  if selected_platform > 0 then
    insert into public.learning_company_commercial_reversal_ledger_entries(
      reversal_id,line_number,account_code,amount_minor,currency)
    values(reversal_key,1,'revenue.platform_commission',selected_platform,sale_row.currency);
  end if;
  if selected_seller > 0 then
    seller_reversal_account := case
      when exists(select 1 from public.learning_company_seller_outflow_boundaries boundary
        where boundary.purchase_id = sale_row.purchase_id and boundary.boundary_kind = 'transferred')
        then 'asset.company_seller_recovery_receivable'
      else 'liability.company_seller_earnings_held'
    end;
    insert into public.learning_company_commercial_reversal_ledger_entries(
      reversal_id,line_number,account_code,amount_minor,currency)
    values(reversal_key,2,seller_reversal_account,selected_seller,sale_row.currency);
  end if;
  insert into public.learning_company_commercial_reversal_ledger_entries(
    reversal_id,line_number,account_code,amount_minor,currency)
  values(reversal_key,3,'asset.paystack_receivable',-selected_gross,sale_row.currency);
  if (select coalesce(sum(entry.amount_minor),0)
      from public.learning_company_commercial_reversal_ledger_entries entry
      where entry.reversal_id = reversal_key) <> 0 then
    raise exception 'Company reversal ledger is not balanced' using errcode = '23514';
  end if;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(null,'payment_system','company_paid_course.commercial_reversal_posted',
    'learning_company_paid_course_purchase',sale_row.purchase_id::text,
    jsonb_build_object('reversal_id',reversal_key,'inbox_event_id',p_inbox_event_id,
      'kind',reversal_kind,'gross_amount_minor',selected_gross,'seat_count',selected_count,
      'seller_funding',case when seller_reversal_account = 'asset.company_seller_recovery_receivable'
        then 'manual_recovery_receivable' else 'held_liability' end));
  return reversal_key;
end;$function$;

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
          'asset.company_seller_recovery_receivable')) <> reversal.seller_gross_minor
    or (select count(*) from public.learning_company_commercial_reversal_ledger_entries entry
      where entry.reversal_id = reversal.id
        and entry.account_code in ('liability.company_seller_earnings_held',
          'asset.company_seller_recovery_receivable')) > 1
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
      where earlier.purchase_id = reversal.purchase_id
        and earlier.id <= reversal.id
        and entry.account_code = 'asset.company_seller_recovery_receivable'),0)
    > coalesce((select sum(evidence.amount_minor)
      from public.learning_company_seller_transfer_evidence evidence
      where evidence.purchase_id = reversal.purchase_id
        and evidence.recorded_at <= reversal.verified_at),0);
$function$;

create or replace function public.list_learning_company_seller_held_liabilities()
returns table(
  purchase_id bigint,seller_payee_id uuid,seller_organization_id bigint,
  original_held_minor bigint,reversed_minor bigint,remaining_held_minor bigint,currency text)
language sql stable security definer set search_path to '' as $function$
  select sale.purchase_id,sale.seller_payee_id,sale.seller_organization_id,
    sale.seller_gross_minor,
    coalesce(reversals.total_reversed_minor,0)::bigint,
    (sale.seller_gross_minor - coalesce(held_reversals.held_reversed_minor,0)
      - coalesce(releases.released_minor,0))::bigint,
    sale.currency
  from public.learning_company_commercial_sales sale
  left join lateral (
    select sum(reversal.seller_gross_minor) as total_reversed_minor
    from public.learning_company_commercial_reversals reversal
    where reversal.purchase_id = sale.purchase_id
  ) reversals on true
  left join lateral (
    select sum(entry.amount_minor) as held_reversed_minor
    from public.learning_company_commercial_reversals reversal
    join public.learning_company_commercial_reversal_ledger_entries entry
      on entry.reversal_id = reversal.id
    where reversal.purchase_id = sale.purchase_id
      and entry.account_code = 'liability.company_seller_earnings_held'
  ) held_reversals on true
  left join lateral (
    select sum(movement.amount_minor) as released_minor
    from public.learning_company_seller_liability_movements movement
    where movement.purchase_id = sale.purchase_id and movement.movement_kind = 'released'
  ) releases on true;
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
          and entry.account_code = 'asset.company_seller_recovery_receivable'),0)::bigint as recovery_reversal_minor,
      coalesce((select sum(movement.amount_minor)
        from public.learning_company_seller_liability_movements movement
        where movement.purchase_id = hold.purchase_id and movement.movement_kind = 'released'),0)::bigint as released_minor
    from public.list_learning_company_seller_held_liabilities() hold
  )
  select balance.purchase_id,'company_seller_held_capture_mismatch'::text
  from balances balance
  where balance.sale_ledger_minor <> -balance.original_held_minor
  union all
  select balance.purchase_id,'company_seller_held_reversal_mismatch'::text
  from balances balance
  where balance.reversed_minor <> balance.held_reversal_minor + balance.recovery_reversal_minor
    or (balance.sale_ledger_minor = -balance.original_held_minor
      and balance.remaining_held_minor <> -(balance.sale_ledger_minor
        + balance.held_reversal_minor + balance.released_minor))
  union all
  select balance.purchase_id,'company_seller_held_negative_balance'::text
  from balances balance
  where balance.remaining_held_minor < 0;
$function$;

create or replace function public.list_learning_company_seller_recovery_receivables()
returns table(
  purchase_id bigint,seller_payee_id uuid,receivable_minor bigint,currency text)
language sql stable security definer set search_path to '' as $function$
  select reversal.purchase_id,sale.seller_payee_id,
    sum(entry.amount_minor)::bigint,sale.currency
  from public.learning_company_commercial_reversals reversal
  join public.learning_company_commercial_reversal_ledger_entries entry
    on entry.reversal_id = reversal.id
    and entry.account_code = 'asset.company_seller_recovery_receivable'
  join public.learning_company_commercial_sales sale on sale.purchase_id = reversal.purchase_id
  group by reversal.purchase_id,sale.seller_payee_id,sale.currency
  having sum(entry.amount_minor) > 0;
$function$;

revoke all on function public.guard_learning_company_held_only_reversal()
  from public,anon,authenticated,service_role;
revoke all on function public.post_learning_company_commercial_reversal(
  bigint,text,text,text,bigint,uuid[]),
  public.reconcile_learning_company_commercial_reversals(),
  public.list_learning_company_seller_held_liabilities(),
  public.list_learning_company_seller_recovery_receivables()
  from public,anon,authenticated;
grant execute on function public.reconcile_learning_company_commercial_reversals(),
  public.list_learning_company_seller_held_liabilities(),
  public.list_learning_company_seller_recovery_receivables()
  to postgres,service_role;
grant execute on function public.post_learning_company_commercial_reversal(
  bigint,text,text,text,bigint,uuid[]) to postgres;

commit;
