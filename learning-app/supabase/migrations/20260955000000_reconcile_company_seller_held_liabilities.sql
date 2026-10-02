-- Phase 3C: read-only company seller hold accounting. This does not make
-- company proceeds available, reserve them, or authorize a transfer.
-- Keep live company checkout gated until release and reversal policy is complete.
begin;

create or replace function public.list_learning_company_seller_held_liabilities()
returns table(
  purchase_id bigint,
  seller_payee_id uuid,
  seller_organization_id bigint,
  original_held_minor bigint,
  reversed_minor bigint,
  remaining_held_minor bigint,
  currency text
)
language sql stable security definer set search_path to '' as $function$
  select sale.purchase_id, sale.seller_payee_id, sale.seller_organization_id,
    sale.seller_gross_minor,
    coalesce(reversals.reversed_minor, 0)::bigint,
    (sale.seller_gross_minor - coalesce(reversals.reversed_minor, 0))::bigint,
    sale.currency
  from public.learning_company_commercial_sales sale
  left join lateral (
    select sum(reversal.seller_gross_minor) as reversed_minor
    from public.learning_company_commercial_reversals reversal
    where reversal.purchase_id = sale.purchase_id
  ) reversals on true;
$function$;

create or replace function public.reconcile_learning_company_seller_held_liabilities()
returns table(purchase_id bigint, issue_type text)
language sql stable security definer set search_path to '' as $function$
  with balances as (
    select hold.purchase_id, hold.original_held_minor, hold.reversed_minor,
      hold.remaining_held_minor,
      coalesce((
        select sum(entry.amount_minor)
        from public.learning_company_sale_ledger_transactions transaction_row
        join public.learning_company_sale_ledger_entries entry
          on entry.transaction_id = transaction_row.id
        where transaction_row.purchase_id = hold.purchase_id
          and entry.account_code = 'liability.company_seller_earnings_held'
      ), 0)::bigint as sale_ledger_minor,
      coalesce((
        select sum(entry.amount_minor)
        from public.learning_company_commercial_reversals reversal
        join public.learning_company_commercial_reversal_ledger_entries entry
          on entry.reversal_id = reversal.id
        where reversal.purchase_id = hold.purchase_id
          and entry.account_code = 'liability.company_seller_earnings_held'
      ), 0)::bigint as reversal_ledger_minor
    from public.list_learning_company_seller_held_liabilities() hold
  )
  select balance.purchase_id, 'company_seller_held_capture_mismatch'::text
  from balances balance
  where balance.sale_ledger_minor <> -balance.original_held_minor
  union all
  select balance.purchase_id, 'company_seller_held_reversal_mismatch'::text
  from balances balance
  where balance.reversal_ledger_minor <> balance.reversed_minor
  union all
  select balance.purchase_id, 'company_seller_held_negative_balance'::text
  from balances balance
  where balance.remaining_held_minor < 0;
$function$;

revoke all on function public.list_learning_company_seller_held_liabilities(),
  public.reconcile_learning_company_seller_held_liabilities()
  from public, anon, authenticated;
grant execute on function public.list_learning_company_seller_held_liabilities(),
  public.reconcile_learning_company_seller_held_liabilities()
  to postgres, service_role;

commit;
