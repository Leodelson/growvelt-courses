-- Phase 3C: record an admin-attested bank-statement match for a Paystack
-- settlement batch. This is batch-level evidence (not one bank credit per
-- course sale) and never releases, reserves, or transfers seller proceeds.
begin;

create table public.learning_company_paystack_bank_settlement_evidence (
  settlement_id text primary key check (settlement_id ~ '^[1-9][0-9]{0,18}$'),
  anchor_purchase_id bigint not null references public.learning_company_commercial_sales(purchase_id) on delete restrict,
  settlement_date timestamptz not null,
  effective_amount_minor bigint not null check (effective_amount_minor > 0),
  bank_credit_amount_minor bigint not null check (bank_credit_amount_minor > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  bank_statement_reference text not null unique
    check (length(bank_statement_reference) between 3 and 120
      and bank_statement_reference !~ '[[:cntrl:]]'),
  bank_credit_date date not null,
  verified_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint learning_company_paystack_bank_credit_exact_match
    check (bank_credit_amount_minor = effective_amount_minor),
  constraint learning_company_paystack_bank_credit_after_settlement
    check (bank_credit_date >= (settlement_date at time zone 'UTC')::date)
);

alter table public.learning_company_paystack_bank_settlement_evidence enable row level security;
revoke all on public.learning_company_paystack_bank_settlement_evidence
  from public,anon,authenticated,service_role;
grant select on public.learning_company_paystack_bank_settlement_evidence to service_role;

create trigger prevent_learning_company_paystack_bank_settlement_evidence_mutation
before update or delete on public.learning_company_paystack_bank_settlement_evidence
for each row execute function public.prevent_learning_company_sale_mutation();

create function public.record_learning_company_paystack_bank_settlement_evidence(
  p_settlement_id text,p_anchor_purchase_id bigint,p_settlement_date timestamptz,
  p_effective_amount_minor bigint,p_bank_credit_amount_minor bigint,
  p_bank_statement_reference text,p_bank_credit_date date,p_actor_user_id uuid)
returns text language plpgsql security definer set search_path to '' as $function$
declare existing public.learning_company_paystack_bank_settlement_evidence%rowtype;
  recorded_settlement_id text;
begin
  if coalesce(p_settlement_id,'') !~ '^[1-9][0-9]{0,18}$'
     or p_anchor_purchase_id is null or p_settlement_date is null
     or p_settlement_date > now()
     or p_effective_amount_minor is null or p_effective_amount_minor <= 0
     or p_bank_credit_amount_minor is null
     or p_bank_credit_amount_minor <> p_effective_amount_minor
     or coalesce(p_bank_statement_reference,'') !~ '^[^[:cntrl:]]{3,120}$'
     or p_bank_credit_date is null
     or p_bank_credit_date < (p_settlement_date at time zone 'UTC')::date
     or p_bank_credit_date > (now() at time zone 'Africa/Lagos')::date
     or p_actor_user_id is null then
    raise exception 'Invalid company bank settlement evidence' using errcode = '22023';
  end if;
  if not exists (select 1 from public.account_capabilities capability
    where capability.user_id = p_actor_user_id and capability.capability = 'admin'
      and capability.status = 'active') then
    raise exception 'Active Learning Admin required' using errcode = '42501';
  end if;

  -- An existing Paystack charge-to-batch record is required. The trusted
  -- server re-fetches this sale's Live transaction and the batch effective
  -- amount before calling this recorder.
  if not exists (
    select 1 from public.learning_company_paystack_settlement_evidence evidence
    join public.learning_company_commercial_sales sale
      on sale.purchase_id = evidence.purchase_id
    join public.learning_company_paid_course_purchases purchase
      on purchase.id = evidence.purchase_id
    where evidence.purchase_id = p_anchor_purchase_id
      and evidence.settlement_id = p_settlement_id
      and sale.paystack_domain = 'live' and sale.currency = 'NGN'
      and purchase.status = 'paid'
  ) then
    raise exception 'Verified company Paystack settlement evidence is required'
      using errcode = '22023';
  end if;

  select * into existing from public.learning_company_paystack_bank_settlement_evidence evidence
  where evidence.settlement_id = p_settlement_id for update;
  if found then
    if existing.anchor_purchase_id <> p_anchor_purchase_id
       or existing.settlement_date <> p_settlement_date
       or existing.effective_amount_minor <> p_effective_amount_minor
       or existing.bank_credit_amount_minor <> p_bank_credit_amount_minor
       or existing.bank_statement_reference <> btrim(p_bank_statement_reference)
       or existing.bank_credit_date <> p_bank_credit_date
       or existing.verified_by <> p_actor_user_id then
      raise exception 'Company bank settlement evidence conflicts with its prior record'
        using errcode = '23505';
    end if;
    return existing.settlement_id;
  end if;

  insert into public.learning_company_paystack_bank_settlement_evidence(
    settlement_id,anchor_purchase_id,settlement_date,effective_amount_minor,
    bank_credit_amount_minor,bank_statement_reference,bank_credit_date,verified_by)
  values(p_settlement_id,p_anchor_purchase_id,p_settlement_date,p_effective_amount_minor,
    p_bank_credit_amount_minor,btrim(p_bank_statement_reference),p_bank_credit_date,p_actor_user_id)
  returning settlement_id into recorded_settlement_id;

  insert into public.learning_audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_actor_user_id,'admin_operator','company_paystack_settlement.bank_credit_reconciled',
    'learning_company_paystack_settlement',p_settlement_id,
    jsonb_build_object('anchor_purchase_id',p_anchor_purchase_id,
      'effective_amount_minor',p_effective_amount_minor,'currency','NGN',
      'bank_credit_date',p_bank_credit_date));
  return recorded_settlement_id;
end;$function$;

revoke all on function public.record_learning_company_paystack_bank_settlement_evidence(
  text,bigint,timestamptz,bigint,bigint,text,date,uuid)
  from public,anon,authenticated;
grant execute on function public.record_learning_company_paystack_bank_settlement_evidence(
  text,bigint,timestamptz,bigint,bigint,text,date,uuid) to service_role;

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
      when not exists (
        select 1 from public.learning_company_paystack_settlement_evidence evidence
        join public.learning_company_paystack_bank_settlement_evidence bank
          on bank.settlement_id = evidence.settlement_id
        where evidence.purchase_id = queue.purchase_id
          and bank.effective_amount_minor = bank.bank_credit_amount_minor
          and bank.currency = 'NGN'
      ) then 'bank_settlement_reconciliation_required'
      else 'bank_settlement_reconciled_release_writer_not_enabled'
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
