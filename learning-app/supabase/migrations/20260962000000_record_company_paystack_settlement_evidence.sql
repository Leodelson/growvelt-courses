-- Phase 3C: retain exact, operator-reviewed Paystack Live settlement evidence.
-- The trusted service must independently fetch and validate Paystack's live
-- settlement and transaction pages immediately before calling this function.
-- This record is not proof of receipt in Growvelt's bank account and does not
-- release, reserve, transfer, or make company seller proceeds payable.
-- Forward-fix rollback: revoke function execution in a reviewed migration and
-- retain immutable attestations for investigation; do not erase evidence.
begin;

create table public.learning_company_paystack_settlement_evidence (
  purchase_id bigint primary key references public.learning_company_commercial_sales(purchase_id) on delete restrict,
  attempt_id bigint not null unique references public.learning_company_paid_course_purchase_attempts(id) on delete restrict,
  settlement_id text not null check (settlement_id ~ '^[1-9][0-9]{0,18}$'),
  provider_transaction_id text not null unique check (provider_transaction_id ~ '^[1-9][0-9]{0,18}$'),
  provider_reference text not null unique check (provider_reference ~ '^CP-[A-F0-9]{32}$'),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  paystack_domain text not null default 'live' check (paystack_domain = 'live'),
  settled_at timestamptz not null,
  verified_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now()
);

create index learning_company_paystack_settlement_evidence_settlement_idx
  on public.learning_company_paystack_settlement_evidence(settlement_id);

alter table public.learning_company_paystack_settlement_evidence enable row level security;
revoke all on public.learning_company_paystack_settlement_evidence
  from public,anon,authenticated,service_role;
grant select on public.learning_company_paystack_settlement_evidence to service_role;

create trigger prevent_learning_company_paystack_settlement_evidence_mutation
before update or delete on public.learning_company_paystack_settlement_evidence
for each row execute function public.prevent_learning_company_sale_mutation();

create function public.record_learning_company_paystack_settlement_evidence(
  p_purchase_id bigint,p_actor_user_id uuid,p_settlement_id text,
  p_provider_transaction_id text,p_provider_reference text,
  p_amount_minor bigint,p_settled_at timestamptz)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare purchase_row public.learning_company_paid_course_purchases%rowtype;
  sale_row public.learning_company_commercial_sales%rowtype;
  attempt_row public.learning_company_paid_course_purchase_attempts%rowtype;
  existing public.learning_company_paystack_settlement_evidence%rowtype;
begin
  if p_purchase_id is null or p_actor_user_id is null
     or coalesce(p_settlement_id,'') !~ '^[1-9][0-9]{0,18}$'
     or coalesce(p_provider_transaction_id,'') !~ '^[1-9][0-9]{0,18}$'
     or coalesce(p_provider_reference,'') !~ '^CP-[A-F0-9]{32}$'
     or p_amount_minor is null or p_amount_minor <= 0
     or p_settled_at is null or p_settled_at > now() then
    raise exception 'Invalid company Paystack settlement evidence' using errcode = '22023';
  end if;
  if not exists (select 1 from public.account_capabilities capability
    where capability.user_id = p_actor_user_id and capability.capability = 'admin'
      and capability.status = 'active') then
    raise exception 'Active Learning Admin required' using errcode = '42501';
  end if;

  select * into purchase_row from public.learning_company_paid_course_purchases purchase
  where purchase.id = p_purchase_id for update;
  if not found then raise exception 'Company purchase not found' using errcode = 'P0002'; end if;
  select * into sale_row from public.learning_company_commercial_sales sale
  where sale.purchase_id = p_purchase_id;
  if not found then raise exception 'Company commercial sale not found' using errcode = 'P0002'; end if;
  select * into attempt_row from public.learning_company_paid_course_purchase_attempts attempt
  where attempt.id = sale_row.attempt_id;

  if purchase_row.status <> 'paid' or purchase_row.paid_at is null
     or sale_row.paystack_domain <> 'live' or sale_row.currency <> 'NGN'
     or sale_row.gross_amount_minor <> p_amount_minor
     or sale_row.provider_reference <> p_provider_reference
     or sale_row.provider_transaction_id <> p_provider_transaction_id
     or attempt_row.purchase_id <> p_purchase_id or attempt_row.provider <> 'paystack'
     or attempt_row.paystack_domain <> 'live' or attempt_row.status <> 'succeeded'
     or attempt_row.currency <> 'NGN' or attempt_row.amount_minor <> p_amount_minor
     or attempt_row.provider_reference <> p_provider_reference
     or attempt_row.provider_transaction_id <> p_provider_transaction_id
     or p_settled_at < purchase_row.paid_at::date then
    raise exception 'Settlement evidence does not match a paid Live company sale'
      using errcode = '22023';
  end if;

  select * into existing from public.learning_company_paystack_settlement_evidence evidence
  where evidence.purchase_id = p_purchase_id for update;
  if found then
    if existing.attempt_id <> attempt_row.id or existing.settlement_id <> p_settlement_id
       or existing.provider_transaction_id <> p_provider_transaction_id
       or existing.provider_reference <> p_provider_reference
       or existing.amount_minor <> p_amount_minor
       or existing.settled_at <> p_settled_at
       or existing.verified_by <> p_actor_user_id then
      raise exception 'Company settlement evidence conflicts with its prior record'
        using errcode = '23505';
    end if;
    return existing.purchase_id;
  end if;

  insert into public.learning_company_paystack_settlement_evidence(
    purchase_id,attempt_id,settlement_id,provider_transaction_id,
    provider_reference,amount_minor,settled_at,verified_by)
  values(p_purchase_id,attempt_row.id,p_settlement_id,p_provider_transaction_id,
    p_provider_reference,p_amount_minor,p_settled_at,p_actor_user_id);
  return p_purchase_id;
end;$function$;

revoke all on function public.record_learning_company_paystack_settlement_evidence(
  bigint,uuid,text,text,text,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.record_learning_company_paystack_settlement_evidence(
  bigint,uuid,text,text,text,bigint,timestamptz) to postgres,service_role;

commit;
