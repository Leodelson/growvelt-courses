-- Phase 3C: distinguish unverified Paystack settlement from verified
-- settlement while keeping the future seller-release writer disabled.
-- This assessment is read-only and never releases, reserves, or transfers funds.
begin;

create or replace function public.assess_learning_company_seller_release_gate(
  p_purchase_id bigint)
returns table(
  purchase_id bigint,seller_payee_id uuid,paystack_domain text,
  remaining_held_minor bigint,currency text,latest_review_id bigint,
  release_gate_state text
)
language sql stable security definer set search_path to '' as $function$
  select queue.purchase_id,queue.seller_payee_id,sale.paystack_domain,
    queue.remaining_held_minor,queue.currency,latest.id,
    case
      when exists (select 1 from public.learning_company_seller_outflow_boundaries boundary
        where boundary.purchase_id = queue.purchase_id)
        then 'seller_outflow_manual_review_required'
      when queue.review_state <> 'manual_admin_review_required'
        then queue.review_state
      when latest.id is null then 'admin_approval_missing'
      when latest.decision = 'continue_hold' then 'admin_hold_recorded'
      when latest.review_state_snapshot <> queue.review_state
        or latest.remaining_held_minor_snapshot <> queue.remaining_held_minor
        then 'admin_approval_stale'
      when not exists (
        select 1 from public.account_capabilities capability
        where capability.user_id = latest.actor_user_id
          and capability.capability = 'admin' and capability.status = 'active'
      ) then 'approval_actor_inactive'
      when sale.paystack_domain <> 'live' then 'test_mode_nonpayable'
      when not exists (
        select 1 from public.learning_company_paystack_settlement_evidence evidence
        where evidence.purchase_id = queue.purchase_id
      ) then 'provider_settlement_verification_required'
      when not exists (
        select 1
        from public.learning_company_paystack_settlement_evidence evidence
        join public.learning_company_paid_course_purchase_attempts attempt
          on attempt.id = evidence.attempt_id
        where evidence.purchase_id = queue.purchase_id
          and evidence.attempt_id = sale.attempt_id
          and evidence.paystack_domain = sale.paystack_domain
          and evidence.provider_reference = sale.provider_reference
          and evidence.provider_transaction_id = sale.provider_transaction_id
          and evidence.amount_minor = sale.gross_amount_minor
          and evidence.currency = sale.currency
          and attempt.purchase_id = queue.purchase_id
          and attempt.provider = 'paystack'
          and attempt.paystack_domain = 'live'
          and attempt.status = 'succeeded'
          and attempt.provider_reference = sale.provider_reference
          and attempt.provider_transaction_id = sale.provider_transaction_id
          and attempt.amount_minor = sale.gross_amount_minor
          and attempt.currency = sale.currency
      ) then 'settlement_evidence_mismatch'
      else 'settlement_verified_release_writer_not_enabled'
    end as release_gate_state
  from public.list_learning_company_seller_payout_review_queue() queue
  join public.learning_company_commercial_sales sale
    on sale.purchase_id = queue.purchase_id
  left join lateral (
    select review.id,review.actor_user_id,review.decision,
      review.review_state_snapshot,review.remaining_held_minor_snapshot
    from public.learning_company_seller_payout_reviews review
    where review.purchase_id = queue.purchase_id
    order by review.reviewed_at desc,review.id desc
    limit 1
  ) latest on true
  where queue.purchase_id = p_purchase_id;
$function$;

revoke all on function public.assess_learning_company_seller_release_gate(bigint)
  from public,anon,authenticated;
grant execute on function public.assess_learning_company_seller_release_gate(bigint)
  to postgres,service_role;

commit;
