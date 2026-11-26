-- Phase 4: add a first-class ledger source for verified Live subscription invoices.
-- This does not enable Live checkout or release/payout subscription earnings.

begin;

alter table public.learning_subscription_plans
  drop constraint if exists learning_subscription_plans_payment_domain_check;
alter table public.learning_subscription_plans
  add constraint learning_subscription_plans_payment_domain_check
  check (payment_domain in ('test','live'));

alter table public.learning_subscriptions
  drop constraint if exists learning_subscriptions_payment_domain_check;
alter table public.learning_subscriptions
  add constraint learning_subscriptions_payment_domain_check
  check (payment_domain in ('test','live'));

alter table public.learning_subscription_invoices
  drop constraint if exists learning_subscription_invoices_payment_domain_check;
alter table public.learning_subscription_invoices
  add constraint learning_subscription_invoices_payment_domain_check
  check (payment_domain in ('test','live'));

alter table public.learning_subscription_provider_events
  drop constraint if exists learning_subscription_provider_events_payment_domain_check;
alter table public.learning_subscription_provider_events
  add constraint learning_subscription_provider_events_payment_domain_check
  check (payment_domain in ('test','live'));

alter table public.learning_ledger_transactions
  add column subscription_invoice_id uuid
    references public.learning_subscription_invoices(id) on delete restrict;
alter table public.learning_ledger_transactions
  alter column order_id drop not null;
alter table public.learning_ledger_transactions
  add constraint learning_ledger_transactions_one_source_check
  check ((order_id is not null) <> (subscription_invoice_id is not null));
create index learning_ledger_transactions_subscription_invoice_idx
  on public.learning_ledger_transactions(subscription_invoice_id,occurred_at,id)
  where subscription_invoice_id is not null;

alter table public.learning_commercial_allocations
  add column subscription_invoice_id uuid
    references public.learning_subscription_invoices(id) on delete restrict;
alter table public.learning_commercial_allocations
  alter column order_id drop not null;
alter table public.learning_commercial_allocations
  add constraint learning_commercial_allocations_one_source_check
  check ((order_id is not null) <> (subscription_invoice_id is not null));
create unique index learning_commercial_allocations_subscription_invoice_key
  on public.learning_commercial_allocations(subscription_invoice_id)
  where subscription_invoice_id is not null;

create or replace function public.prevent_learning_commercial_allocation_mutation()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op='DELETE' then raise exception 'Commercial allocation history is retained and cannot be deleted' using errcode='42501'; end if;
  if old.order_id is distinct from new.order_id
    or old.subscription_invoice_id is distinct from new.subscription_invoice_id
    or old.commercial_terms_version is distinct from new.commercial_terms_version
    or old.instructor_id is distinct from new.instructor_id or old.course_id is distinct from new.course_id
    or old.gross_amount_minor is distinct from new.gross_amount_minor or old.platform_commission_minor is distinct from new.platform_commission_minor
    or old.instructor_gross_minor is distinct from new.instructor_gross_minor or old.currency is distinct from new.currency
    or old.allocation_ledger_transaction_id is distinct from new.allocation_ledger_transaction_id then
    raise exception 'Commercial allocation financial identity is immutable' using errcode='42501';
  end if;
  if old.status='allocated' and new.status='reversed' then return new; end if;
  if old.status is distinct from new.status or old.reversal_ledger_transaction_id is distinct from new.reversal_ledger_transaction_id
    or old.reversed_at is distinct from new.reversed_at or old.reversed_by_case_id is distinct from new.reversed_by_case_id then
    raise exception 'Unsupported commercial allocation transition' using errcode='22023';
  end if;
  return new;
end;$function$;
drop trigger if exists prevent_learning_commercial_allocation_mutation
  on public.learning_commercial_allocations;
create trigger prevent_learning_commercial_allocation_mutation
before update or delete on public.learning_commercial_allocations
for each row execute function public.prevent_learning_commercial_allocation_mutation();

-- Preserve the existing shared-enrollment provenance path for both payment
-- domains. A paid invoice only opens the access period it snapshots.
create or replace function public.grant_learning_subscription_invoice_course_access()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  subscription_row public.learning_subscriptions%rowtype;
  included_course record;
  enrollment_key bigint;
  enrollment_status text;
  had_preexisting_access boolean;
  existing_source public.learning_subscription_course_enrollment_sources%rowtype;
  course_count integer:=0;
begin
  if tg_op='UPDATE' and old.status='paid' then return new; end if;
  if new.status<>'paid' then return new; end if;
  select * into subscription_row from public.learning_subscriptions subscription
    where subscription.id=new.subscription_id for update;
  if not found or subscription_row.learner_id is null
    or subscription_row.payment_domain not in ('test','live')
    or new.payment_domain is distinct from subscription_row.payment_domain then
    raise exception 'Paid subscription invoice has no matching learner subscription and payment domain' using errcode='23514';
  end if;
  for included_course in
    select item.course_id from public.learning_subscription_invoice_courses item
    where item.invoice_id=new.id order by item.course_id
  loop
    course_count:=course_count+1;
    perform pg_advisory_xact_lock(hashtextextended(
      'learning-company-paid-access:'||included_course.course_id::text||':'||subscription_row.learner_id::text,0));
    select enrollment.id,enrollment.status into enrollment_key,enrollment_status
      from public.enrollments enrollment
      where enrollment.learner_id=subscription_row.learner_id and enrollment.course_id=included_course.course_id
      for update;
    had_preexisting_access:=found and enrollment_status in ('active','completed');
    if enrollment_key is null then
      insert into public.enrollments(learner_id,course_id,status)
        values(subscription_row.learner_id,included_course.course_id,'active')
        on conflict (learner_id,course_id) do nothing returning id,status into enrollment_key,enrollment_status;
      if enrollment_key is null then
        select enrollment.id,enrollment.status into enrollment_key,enrollment_status
          from public.enrollments enrollment
          where enrollment.learner_id=subscription_row.learner_id and enrollment.course_id=included_course.course_id
          for update;
        had_preexisting_access:=enrollment_status in ('active','completed');
      end if;
    elsif enrollment_status='cancelled' then
      update public.enrollments enrollment set status='active',completed_at=null
        where enrollment.id=enrollment_key returning enrollment.status into enrollment_status;
    end if;
    if enrollment_key is null or enrollment_status not in ('active','completed') then
      raise exception 'Subscription course enrollment could not be safely established' using errcode='23514';
    end if;
    select * into existing_source from public.learning_subscription_course_enrollment_sources source
      where source.subscription_id=subscription_row.id and source.course_id=included_course.course_id for update;
    if found then
      if existing_source.learner_id<>subscription_row.learner_id or existing_source.enrollment_id<>enrollment_key then
        raise exception 'Subscription course access provenance conflicts with its existing enrollment' using errcode='23514';
      end if;
    else
      insert into public.learning_subscription_course_enrollment_sources(
        subscription_id,learner_id,course_id,enrollment_id,preexisting_access
      ) values(subscription_row.id,subscription_row.learner_id,included_course.course_id,enrollment_key,had_preexisting_access);
    end if;
  end loop;
  if course_count=0 then raise exception 'Paid subscription invoice has no included course snapshot' using errcode='23514'; end if;
  return new;
end;$function$;

create or replace function public.has_own_learning_course_access(p_learner_id uuid,p_course_id bigint)
returns boolean language sql stable security definer set search_path to '' as $function$
  with own_enrollment as (
    select enrollment.id,enrollment.status from public.enrollments enrollment
    join public.learning_courses course on course.id=enrollment.course_id and course.status='published'
    where enrollment.learner_id=p_learner_id and enrollment.course_id=p_course_id
      and enrollment.status in ('active','completed')
  ), source_state as (
    select exists(
      select 1 from public.learning_subscription_course_enrollment_sources source
      join own_enrollment enrollment on enrollment.id=source.enrollment_id
      where source.learner_id=p_learner_id and source.course_id=p_course_id
    ) as has_subscription_provenance,
    exists(
      select 1 from public.learning_subscription_course_enrollment_sources source
      join own_enrollment enrollment on enrollment.id=source.enrollment_id
      where source.learner_id=p_learner_id and source.course_id=p_course_id and source.preexisting_access
    ) as had_access_before_subscription,
    exists(
      select 1 from public.learning_subscription_course_enrollment_sources source
      join own_enrollment enrollment on enrollment.id=source.enrollment_id
      join public.learning_subscriptions subscription
        on subscription.id=source.subscription_id and subscription.learner_id=source.learner_id
      join public.learning_subscription_invoices invoice
        on invoice.subscription_id=subscription.id and invoice.status='paid'
       and invoice.payment_domain=subscription.payment_domain
       and invoice.payment_domain in ('test','live')
       and now()>=invoice.billing_period_starts_at and now()<invoice.paid_through
      join public.learning_subscription_invoice_courses included
        on included.invoice_id=invoice.id and included.course_id=source.course_id
      where source.learner_id=p_learner_id and source.course_id=p_course_id
        and subscription.payment_domain in ('test','live')
        and subscription.status in ('active','non_renewing','attention','cancelled','completed')
    ) as has_paid_subscription_period,
    exists(
      select 1 from public.learning_free_enrollment_claims claim
      join own_enrollment enrollment on enrollment.id=claim.enrollment_id
      where claim.learner_id=p_learner_id and claim.course_id=p_course_id
    ) or exists(
      select 1 from public.learning_course_entitlements entitlement
      where entitlement.learner_id=p_learner_id and entitlement.course_id=p_course_id and entitlement.status='active'
    ) or exists(
      select 1 from public.learning_company_free_assignment_origins origin
      join public.learning_company_course_assignments assignment
        on assignment.id=origin.assignment_id and assignment.status='active'
      join public.learning_company_workspaces workspace
        on workspace.id=assignment.workspace_id and workspace.status='active'
      join public.learning_company_memberships membership
        on membership.workspace_id=workspace.id and membership.user_id=p_learner_id and membership.status='active'
      join own_enrollment enrollment on enrollment.id=origin.enrollment_id
      where assignment.assigned_user_id=p_learner_id and assignment.course_id=p_course_id
    ) or exists(
      select 1 from public.learning_company_paid_seat_access source
      join public.learning_company_paid_course_purchases purchase
        on purchase.id=source.purchase_id and purchase.status='paid'
      join own_enrollment enrollment on enrollment.id=source.enrollment_id
      where source.assigned_user_id=p_learner_id and purchase.course_id=p_course_id and source.status='active'
    ) or exists(
      select 1 from public.learning_orders order_row
      where order_row.learner_id=p_learner_id and order_row.course_id=p_course_id
        and order_row.status in ('paid','partially_refunded')
    ) or exists(
      select 1 from public.learning_courses course where course.id=p_course_id and course.instructor_id=p_learner_id
    ) or exists(
      select 1 from public.learning_courses course where course.id=p_course_id
        and coalesce(course.is_free,false) and coalesce(course.price_amount,0)=0
    ) as has_non_subscription_source
  )
  select case
    when not exists(select 1 from own_enrollment) then false
    when not (select has_subscription_provenance from source_state) then true
    else (select had_access_before_subscription or has_paid_subscription_period or has_non_subscription_source from source_state)
  end;
$function$;

revoke all on function public.grant_learning_subscription_invoice_course_access(),
  public.has_own_learning_course_access(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.has_own_learning_course_access(uuid,bigint) to postgres,service_role;

create or replace function public.allocate_learning_subscription_invoice_commercial_terms(p_invoice_id uuid,p_actor_user_id uuid default null)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare
  invoice_row public.learning_subscription_invoices%rowtype;
  subscription_domain text;
  plan_domain text;
  plan_instructor uuid;
  plan_terms_version text;
  terms_row public.learning_commercial_terms%rowtype;
  allocation_key bigint;
  ledger_key bigint;
  earning_key bigint;
  commission_minor bigint;
begin
  if p_invoice_id is null then raise exception 'Subscription invoice is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('subscription-commercial-allocation:'||p_invoice_id::text,0));
  select * into invoice_row from public.learning_subscription_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Subscription invoice not found' using errcode='P0002'; end if;
  select subscription.payment_domain,plan.payment_domain,plan.instructor_id,plan.commercial_terms_version
    into subscription_domain,plan_domain,plan_instructor,plan_terms_version
    from public.learning_subscriptions subscription
    join public.learning_subscription_plans plan on plan.id=subscription.plan_id
    where subscription.id=invoice_row.subscription_id for share of subscription,plan;
  if not found or invoice_row.status<>'paid' or invoice_row.payment_domain<>'live'
    or subscription_domain<>'live' or plan_domain<>'live'
    or invoice_row.instructor_id is distinct from plan_instructor
    or invoice_row.commercial_terms_version is distinct from plan_terms_version
    or invoice_row.provider_transaction_id is null or invoice_row.paid_at is null then
    raise exception 'Verified paid Live subscription invoice with matching plan terms is required' using errcode='22023';
  end if;
  select id into allocation_key from public.learning_commercial_allocations
    where subscription_invoice_id=p_invoice_id;
  if found then return allocation_key; end if;
  if not exists (
      select 1 from public.learning_subscription_invoice_courses item where item.invoice_id=p_invoice_id
    )
    or exists (
      select 1 from public.learning_subscription_invoice_courses item
      left join public.learning_subscription_plan_courses plan_item
        on plan_item.plan_id=(select plan_id from public.learning_subscriptions where id=invoice_row.subscription_id)
       and plan_item.course_id=item.course_id
      where item.invoice_id=p_invoice_id and plan_item.course_id is null
    ) then
    raise exception 'Subscription invoice course snapshot does not match its plan' using errcode='23514';
  end if;
  select * into terms_row from public.learning_commercial_terms where version=invoice_row.commercial_terms_version;
  if not found or invoice_row.seller_share_minor<=0 then
    raise exception 'Active commercial terms and positive instructor share are required' using errcode='23514';
  end if;
  commission_minor:=invoice_row.amount_minor-invoice_row.seller_share_minor;
  if commission_minor<0
    or invoice_row.seller_share_minor<>round(invoice_row.amount_minor*terms_row.instructor_share_basis_points/10000.0)::bigint
    or invoice_row.platform_share_minor<>commission_minor
    or invoice_row.amount_minor<>invoice_row.platform_share_minor+invoice_row.seller_share_minor then
    raise exception 'Subscription invoice shares do not match its immutable commercial terms' using errcode='23514';
  end if;
  insert into public.learning_ledger_transactions(subscription_invoice_id,transaction_type,currency,description,created_by)
    values(p_invoice_id,'commercial_allocation',invoice_row.currency,
      'Immutable Growvelt platform and instructor subscription invoice allocation',p_actor_user_id)
    returning id into ledger_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference) values
    (ledger_key,1,'liability.marketplace_sales_unallocated',invoice_row.amount_minor,invoice_row.currency,'subscription_invoice',invoice_row.provider_reference),
    (ledger_key,2,'revenue.platform_commission',-commission_minor,invoice_row.currency,'commercial_terms',terms_row.version),
    (ledger_key,3,'liability.instructor_earnings_held',-invoice_row.seller_share_minor,invoice_row.currency,'instructor',invoice_row.instructor_id::text);
  insert into public.learning_commercial_allocations(
    subscription_invoice_id,commercial_terms_version,instructor_id,course_id,gross_amount_minor,
    platform_commission_minor,instructor_gross_minor,currency,allocation_ledger_transaction_id
  ) values (
    p_invoice_id,terms_row.version,invoice_row.instructor_id,null,invoice_row.amount_minor,
    commission_minor,invoice_row.seller_share_minor,invoice_row.currency,ledger_key
  ) returning id into allocation_key;
  insert into public.learning_instructor_earnings(
    allocation_id,instructor_id,gross_amount_minor,currency,status,available_at,hold_reason
  ) values (
    allocation_key,invoice_row.instructor_id,invoice_row.seller_share_minor,invoice_row.currency,'held',
    invoice_row.paid_at+make_interval(days=>terms_row.earnings_hold_days),
    'Subscription invoice earnings remain held until payout controls validate this source'
  ) returning id into earning_key;
  insert into public.learning_instructor_earning_events(earning_id,event_type,from_status,to_status,ledger_transaction_id,actor_user_id,metadata)
    values(earning_key,'earning.allocated',null,'held',ledger_key,p_actor_user_id,
      jsonb_build_object('source','subscription_invoice','subscription_invoice_id',p_invoice_id,'provider_reference',invoice_row.provider_reference));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    values(p_actor_user_id,case when p_actor_user_id is null then 'payment_system' else 'admin_operator' end,
      'commercial_allocation.created','commercial_allocation',allocation_key::text,
      jsonb_build_object('source','subscription_invoice','subscription_invoice_id',p_invoice_id,
        'gross_amount_minor',invoice_row.amount_minor,'instructor_share_minor',invoice_row.seller_share_minor));
  return allocation_key;
end;$function$;

create or replace function public.allocate_paid_live_learning_subscription_invoice()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  perform public.allocate_learning_subscription_invoice_commercial_terms(new.id,null);
  return new;
end;$function$;

create trigger allocate_paid_live_learning_subscription_invoice
after update of status on public.learning_subscription_invoices
for each row
when (old.status is distinct from new.status and new.status='paid' and new.payment_domain='live')
execute function public.allocate_paid_live_learning_subscription_invoice();

-- Existing release, reservation, and transfer functions are deliberately
-- order-backed. Keep invoice-backed subscription proceeds held until an
-- invoice-aware refund/reversal and payout lifecycle is implemented together.
create or replace function public.prevent_unvalidated_subscription_invoice_earning_release()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare invoice_source uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  select allocation.subscription_invoice_id into invoice_source
  from public.learning_commercial_allocations allocation
  where allocation.id=old.allocation_id;
  if invoice_source is not null and new.status in ('available','reserved','paid','recoverable') then
    raise exception 'Subscription invoice earnings remain held until invoice refund and payout controls are validated'
      using errcode='22023';
  end if;
  return new;
end;$function$;

create trigger prevent_unvalidated_subscription_invoice_earning_release
before update of status on public.learning_instructor_earnings
for each row execute function public.prevent_unvalidated_subscription_invoice_earning_release();

revoke all on function public.prevent_learning_commercial_allocation_mutation(),
  public.allocate_learning_subscription_invoice_commercial_terms(uuid,uuid),
  public.allocate_paid_live_learning_subscription_invoice(),
  public.prevent_unvalidated_subscription_invoice_earning_release()
from public,anon,authenticated,service_role;
grant execute on function public.allocate_learning_subscription_invoice_commercial_terms(uuid,uuid)
to postgres,service_role;

commit;
