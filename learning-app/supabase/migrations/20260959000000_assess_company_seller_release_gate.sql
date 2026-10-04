-- Phase 3C: a read-only, service-only gate for a future company seller
-- release workflow. This function never moves or reserves money. In particular,
-- a human approval is not evidence that Paystack settled the charge.
begin;

create or replace function public.assess_learning_company_seller_release_gate(
  p_purchase_id bigint)
returns table(
  purchase_id bigint,
  seller_payee_id uuid,
  paystack_domain text,
  remaining_held_minor bigint,
  currency text,
  latest_review_id bigint,
  release_gate_state text
)
language sql stable security definer set search_path to '' as $function$
  select queue.purchase_id,queue.seller_payee_id,sale.paystack_domain,
    queue.remaining_held_minor,queue.currency,latest.id,
    case
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
      else 'provider_settlement_verification_required'
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
