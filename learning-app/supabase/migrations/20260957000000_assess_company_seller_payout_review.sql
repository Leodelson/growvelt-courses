-- Phase 3C: read-only company seller payout review queue.
-- Reaching a hold date never releases funds or authorizes a transfer.
-- An admin must review provider settlement, reversals, and the payee before
-- any future payout capability is designed and separately enabled.
begin;

create or replace function public.list_learning_company_seller_payout_review_queue()
returns table(
  purchase_id bigint,
  seller_payee_id uuid,
  seller_organization_id bigint,
  remaining_held_minor bigint,
  currency text,
  hold_until timestamptz,
  reversal_notice_count bigint,
  accounting_issue_count bigint,
  review_state text
)
language sql stable security definer set search_path to '' as $function$
  with accounting_issues as (
    select issue.purchase_id from public.reconcile_learning_company_commercial_sales() issue
    union all
    select reversal.purchase_id
    from public.reconcile_learning_company_commercial_reversals() issue
    join public.learning_company_commercial_reversals reversal on reversal.id = issue.reversal_id
    union all
    select issue.purchase_id from public.reconcile_learning_company_seller_held_liabilities() issue
    union all
    select issue.purchase_id from public.reconcile_learning_company_paid_seat_access() issue
    union all
    select reversal.purchase_id
    from public.reconcile_learning_company_reversal_access() issue
    join public.learning_company_commercial_reversals reversal on reversal.id = issue.reversal_id
  )
  select hold.purchase_id,hold.seller_payee_id,hold.seller_organization_id,
    hold.remaining_held_minor,hold.currency,
    purchase.paid_at + make_interval(days => terms.earnings_hold_days) as hold_until,
    (select count(*) from public.learning_company_reversal_event_inbox notice
      where notice.purchase_id = hold.purchase_id) as reversal_notice_count,
    (select count(*) from accounting_issues issue
      where issue.purchase_id = hold.purchase_id) as accounting_issue_count,
    case
      when hold.remaining_held_minor <= 0 then 'no_remaining_balance'
      when purchase.paid_at is null then 'payment_timestamp_missing'
      when exists (select 1 from accounting_issues issue
        where issue.purchase_id = hold.purchase_id) then 'accounting_review_required'
      when now() < purchase.paid_at + make_interval(days => terms.earnings_hold_days)
        then 'hold_active'
      when exists (select 1 from public.learning_company_reversal_event_inbox notice
        where notice.purchase_id = hold.purchase_id)
        then 'reversal_notice_review_required'
      else 'manual_admin_review_required'
    end as review_state
  from public.list_learning_company_seller_held_liabilities() hold
  join public.learning_company_commercial_sales sale on sale.purchase_id = hold.purchase_id
  join public.learning_company_paid_course_purchases purchase on purchase.id = hold.purchase_id
  join public.learning_commercial_terms terms on terms.version = sale.commercial_terms_version
  order by purchase.paid_at,hold.purchase_id;
$function$;

revoke all on function public.list_learning_company_seller_payout_review_queue()
  from public,anon,authenticated;
grant execute on function public.list_learning_company_seller_payout_review_queue()
  to postgres,service_role;

commit;
