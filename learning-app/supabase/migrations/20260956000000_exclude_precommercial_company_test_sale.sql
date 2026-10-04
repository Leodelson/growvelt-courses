-- Owner-approved historical Test Mode exception. This excludes only a paid
-- purchase made before company seller/terms snapshots existed. It does not
-- change the purchase, Paystack attempt, employee seat, or learning access.
begin;

create table public.learning_company_historical_test_sale_exclusions (
  purchase_id bigint primary key references public.learning_company_paid_course_purchases(id) on delete restrict,
  reason text not null check (reason = 'pre_commercial_test_without_terms'),
  decision_reference text not null check (length(btrim(decision_reference)) > 0),
  recorded_at timestamptz not null default now()
);

alter table public.learning_company_historical_test_sale_exclusions enable row level security;
revoke all on public.learning_company_historical_test_sale_exclusions from public,anon,authenticated,service_role;
grant select on public.learning_company_historical_test_sale_exclusions to service_role;

create trigger prevent_learning_company_historical_test_exclusion_mutation
before update or delete on public.learning_company_historical_test_sale_exclusions
for each row execute function public.prevent_learning_company_sale_mutation();

-- Fail closed if the reviewed, pre-commercial Test Mode population changes.
-- A later purchase with a normal immutable snapshot can never enter this set.
do $block$
declare candidate_count integer;
begin
  select count(*) into candidate_count
  from public.learning_company_paid_course_purchases purchase
  where purchase.status = 'paid'
    and purchase.seller_payee_id is null
    and purchase.commercial_terms_version is null
    and purchase.unit_amount_minor * purchase.seat_count = purchase.total_amount_minor
    and (select count(*) from public.learning_company_paid_course_purchase_seats seat
      where seat.purchase_id = purchase.id) = purchase.seat_count
    and not exists (select 1 from public.learning_company_commercial_sales sale
      where sale.purchase_id = purchase.id)
    and exists (
      select 1 from public.learning_company_paid_course_purchase_attempts attempt
      where attempt.purchase_id = purchase.id and attempt.provider = 'paystack'
        and attempt.paystack_domain = 'test' and attempt.status = 'succeeded'
        and attempt.amount_minor = purchase.total_amount_minor
        and attempt.currency = purchase.currency
        and attempt.provider_transaction_id is not null
    );
  if candidate_count > 1 then
    raise exception 'Multiple historical company Test Mode purchases require individual review'
      using errcode = '22023';
  end if;

  insert into public.learning_company_historical_test_sale_exclusions
    (purchase_id,reason,decision_reference)
  select purchase.id,'pre_commercial_test_without_terms',
    'Growvelt owner decision 2026-10-04: exclude legacy Test Mode purchase from seller earnings'
  from public.learning_company_paid_course_purchases purchase
  where purchase.status = 'paid'
    and purchase.seller_payee_id is null
    and purchase.commercial_terms_version is null
    and purchase.unit_amount_minor * purchase.seat_count = purchase.total_amount_minor
    and (select count(*) from public.learning_company_paid_course_purchase_seats seat
      where seat.purchase_id = purchase.id) = purchase.seat_count
    and not exists (select 1 from public.learning_company_commercial_sales sale
      where sale.purchase_id = purchase.id)
    and exists (
      select 1 from public.learning_company_paid_course_purchase_attempts attempt
      where attempt.purchase_id = purchase.id and attempt.provider = 'paystack'
        and attempt.paystack_domain = 'test' and attempt.status = 'succeeded'
        and attempt.amount_minor = purchase.total_amount_minor
        and attempt.currency = purchase.currency
        and attempt.provider_transaction_id is not null
    );
end;
$block$;

create or replace function public.reconcile_learning_company_commercial_sales()
returns table(purchase_id bigint,issue_type text)
language sql stable security definer set search_path to '' as $function$
  select purchase.id,'paid_purchase_missing_commercial_sale'::text
  from public.learning_company_paid_course_purchases purchase
  where purchase.status = 'paid'
    and not exists (select 1 from public.learning_company_commercial_sales sale
      where sale.purchase_id = purchase.id)
    and not exists (select 1 from public.learning_company_historical_test_sale_exclusions exclusion
      where exclusion.purchase_id = purchase.id)
  union all
  select exclusion.purchase_id,'invalid_historical_test_sale_exclusion'::text
  from public.learning_company_historical_test_sale_exclusions exclusion
  join public.learning_company_paid_course_purchases purchase on purchase.id = exclusion.purchase_id
  where purchase.status <> 'paid' or purchase.seller_payee_id is not null
    or purchase.commercial_terms_version is not null
    or exists (select 1 from public.learning_company_commercial_sales sale
      where sale.purchase_id = purchase.id)
    or not exists (
      select 1 from public.learning_company_paid_course_purchase_attempts attempt
      where attempt.purchase_id = purchase.id and attempt.provider = 'paystack'
        and attempt.paystack_domain = 'test' and attempt.status = 'succeeded'
        and attempt.amount_minor = purchase.total_amount_minor
        and attempt.currency = purchase.currency
        and attempt.provider_transaction_id is not null
    )
  union all
  select sale.purchase_id,'company_sale_amount_or_seat_mismatch'::text
  from public.learning_company_commercial_sales sale
  join public.learning_company_paid_course_purchases purchase on purchase.id = sale.purchase_id
  where sale.gross_amount_minor <> purchase.total_amount_minor
    or sale.gross_amount_minor <> sale.platform_commission_minor + sale.seller_gross_minor
    or sale.seat_count <> (select count(*) from public.learning_company_commercial_sale_lines line where line.purchase_id = sale.purchase_id)
    or sale.gross_amount_minor <> coalesce((select sum(line.unit_amount_minor) from public.learning_company_commercial_sale_lines line where line.purchase_id = sale.purchase_id),0)
    or sale.platform_commission_minor <> coalesce((select sum(line.platform_commission_minor) from public.learning_company_commercial_sale_lines line where line.purchase_id = sale.purchase_id),0)
    or sale.seller_gross_minor <> coalesce((select sum(line.seller_gross_minor) from public.learning_company_commercial_sale_lines line where line.purchase_id = sale.purchase_id),0)
  union all
  select sale.purchase_id,'company_sale_ledger_identity_mismatch'::text
  from public.learning_company_commercial_sales sale
  join public.learning_company_sale_ledger_transactions capture on capture.id = sale.capture_ledger_transaction_id
  join public.learning_company_sale_ledger_transactions allocation on allocation.id = sale.allocation_ledger_transaction_id
  where capture.purchase_id <> sale.purchase_id or capture.transaction_type <> 'payment_capture'
    or capture.amount_minor <> sale.gross_amount_minor
    or allocation.purchase_id <> sale.purchase_id or allocation.transaction_type <> 'commercial_allocation'
    or allocation.amount_minor <> sale.gross_amount_minor
  union all
  select ledger.purchase_id,'company_ledger_unbalanced'::text
  from public.learning_company_sale_ledger_transactions ledger
  left join public.learning_company_sale_ledger_entries entry on entry.transaction_id = ledger.id
  group by ledger.purchase_id,ledger.id having coalesce(sum(entry.amount_minor),0) <> 0 or count(entry.id) < 2;
$function$;

revoke all on function public.reconcile_learning_company_commercial_sales() from public,anon,authenticated;
grant execute on function public.reconcile_learning_company_commercial_sales() to postgres,service_role;

commit;
