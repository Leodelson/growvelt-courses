-- A subscription invoice payout batch uses the existing transfer identity but
-- has an explicit source. Approval reserves earnings; it never sends money.
begin;

alter table public.learning_instructor_payout_batches
  add column source_type text not null default 'course_order'
  check (source_type in ('course_order','subscription_invoice'));

create or replace function public.prevent_learning_instructor_payout_batch_mutation()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op='DELETE' then raise exception 'Payout batch history is retained' using errcode='42501'; end if;
  if tg_table_name='learning_instructor_payout_batches'
    and old.id is not distinct from new.id
    and old.batch_reference is not distinct from new.batch_reference
    and old.idempotency_key is not distinct from new.idempotency_key
    and old.instructor_id is not distinct from new.instructor_id
    and old.payout_profile_id is not distinct from new.payout_profile_id
    and old.amount_minor is not distinct from new.amount_minor
    and old.currency is not distinct from new.currency
    and old.source_type is not distinct from new.source_type
    and old.assembled_by is not distinct from new.assembled_by
    and old.assembled_at is not distinct from new.assembled_at
    and (
      (old.status='assembled' and new.status='submitting')
      or (old.status='failed' and new.status='submitting')
      or (old.status='submitting' and new.status in ('pending','recovery_required','financially_blocked','succeeded','failed'))
      or (old.status='pending' and new.status in ('recovery_required','financially_blocked','succeeded','failed','reversed'))
      or (old.status='recovery_required' and new.status in ('pending','financially_blocked','succeeded','failed','reversed'))
      or (old.status='financially_blocked' and new.status in ('succeeded','failed','reversed'))
      or (old.status='succeeded' and new.status='reversed')
    ) then return new; end if;
  raise exception 'Payout batch financial identity is immutable' using errcode='42501';
end;$function$;

create function public.validate_learning_instructor_payout_batch_source()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare source_kind text;
begin
  select batch.source_type into source_kind
    from public.learning_instructor_payout_batches batch where batch.id=new.batch_id;
  if not exists (
    select 1 from public.learning_instructor_earnings earning
    join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
    where earning.id=new.earning_id
      and ((source_kind='course_order' and allocation.order_id is not null
        and allocation.subscription_invoice_id is null)
        or (source_kind='subscription_invoice' and allocation.order_id is null
          and allocation.subscription_invoice_id is not null))
  ) then raise exception 'Payout batch member source does not match the batch' using errcode='23514'; end if;
  return new;
end;$function$;
create trigger validate_learning_instructor_payout_batch_source
before insert on public.learning_instructor_payout_batch_members
for each row execute function public.validate_learning_instructor_payout_batch_source();

create function public.list_learning_subscription_invoice_payout_batch_candidates(
  p_operator_id uuid,p_limit integer default 500
) returns table(
  earning_id bigint,instructor_id uuid,instructor_name text,instructor_email text,
  payout_profile_id bigint,bank_name text,account_name text,account_last4 text,
  invoice_reference text,plan_name text,amount_minor bigint,currency text,
  available_at timestamptz,eligible_total_minor bigint,eligible_earning_count bigint
) language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or not exists (select 1 from public.account_capabilities c
    where c.user_id=p_operator_id and c.capability='admin' and c.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  return query with eligible as (
    select earning.id earning_key,earning.instructor_id instructor_key,
      instructor.full_name,instructor.email,profile.id profile_key,profile.bank_name,
      profile.account_name,profile.account_last4,invoice.provider_reference,
      invoice.plan_name_snapshot,earning.gross_amount_minor,earning.currency,earning.available_at
    from public.learning_instructor_earnings earning
    join public.learning_commercial_allocations allocation
      on allocation.id=earning.allocation_id and allocation.instructor_id=earning.instructor_id
    join public.learning_subscription_invoices invoice
      on invoice.id=allocation.subscription_invoice_id
    join public.profiles instructor on instructor.id=earning.instructor_id
    join public.learning_instructor_payout_profiles profile
      on profile.instructor_id=earning.instructor_id and profile.provider='paystack'
      and profile.provider_domain='live' and profile.status='active' and profile.currency=earning.currency
    where earning.status='available' and earning.recoverable_amount_minor=0
      and earning.released_at is not null and earning.available_at<=now()
      and allocation.status='allocated' and invoice.status='paid'
      and invoice.payment_domain='live' and invoice.provider_transaction_id is not null
      and invoice.provider_transaction_reference is not null and invoice.paid_at is not null
      and invoice.instructor_id=earning.instructor_id
      and allocation.instructor_gross_minor=earning.gross_amount_minor
      and earning.currency='NGN' and allocation.currency=earning.currency
      and invoice.currency=earning.currency
      and not exists (select 1 from public.learning_subscription_refund_cases refund_case
        where refund_case.invoice_id=invoice.id)
      and not exists (select 1 from public.learning_instructor_earning_reservations reservation
        where reservation.earning_id=earning.id)
      and not exists (select 1 from public.learning_instructor_payout_batch_members member
        where member.earning_id=earning.id)
      and not exists (select 1 from public.learning_instructor_payout_items item
        where item.earning_id=earning.id)
  ), totals as (
    select e.instructor_key,e.profile_key,sum(e.gross_amount_minor)::bigint total_minor,
      count(*)::bigint earning_count from eligible e group by e.instructor_key,e.profile_key
      having sum(e.gross_amount_minor)>=100000
  )
  select e.earning_key,e.instructor_key,e.full_name,e.email,e.profile_key,e.bank_name,
    e.account_name,e.account_last4,e.provider_reference,e.plan_name_snapshot,
    e.gross_amount_minor,e.currency,e.available_at,t.total_minor,t.earning_count
  from eligible e join totals t on t.instructor_key=e.instructor_key and t.profile_key=e.profile_key
  order by t.total_minor desc,e.available_at,e.earning_key
  limit least(greatest(coalesce(p_limit,500),1),500);
end;$function$;

create function public.approve_learning_subscription_invoice_live_payout_batch(
  p_operator_id uuid,p_instructor_id uuid,p_payout_profile_id bigint,
  p_earning_ids bigint[],p_confirmed_amount_minor bigint,p_idempotency_key text
) returns table(batch_id bigint,batch_reference text,amount_minor bigint,member_count integer)
language plpgsql security definer set search_path to '' as $function$
declare
  selected_ids bigint[];
  selected_id bigint;
  existing_batch public.learning_instructor_payout_batches%rowtype;
  profile_row public.learning_instructor_payout_profiles%rowtype;
  reserved_row record;
  new_batch_id bigint;
  new_batch_reference text;
  actual_amount bigint:=0;
  bound_count integer;
begin
  if p_operator_id is null or p_instructor_id is null or p_payout_profile_id is null
    or p_earning_ids is null or cardinality(p_earning_ids) not between 1 and 100
    or array_position(p_earning_ids,null) is not null
    or p_confirmed_amount_minor is null or p_confirmed_amount_minor<100000
    or p_idempotency_key is null or p_idempotency_key !~ '^[a-z][a-z0-9:_-]{2,120}$'
    or not exists (select 1 from public.account_capabilities c
      where c.user_id=p_operator_id and c.capability='admin' and c.status='active') then
    raise exception 'Valid administrator and payout batch identity required' using errcode='42501';
  end if;
  selected_ids:=array(select distinct selected.earning_id
    from unnest(p_earning_ids) as selected(earning_id) order by selected.earning_id);
  if cardinality(selected_ids)<>cardinality(p_earning_ids) then
    raise exception 'Duplicate earning in payout batch' using errcode='22023';
  end if;
  perform public.assert_learning_approved_instructor(p_instructor_id);
  perform pg_advisory_xact_lock(hashtextextended('learning-payout-batch:'||p_idempotency_key,0));
  select * into existing_batch from public.learning_instructor_payout_batches batch
    where batch.idempotency_key=p_idempotency_key;
  if found then
    if existing_batch.source_type<>'subscription_invoice'
      or existing_batch.instructor_id<>p_instructor_id
      or existing_batch.payout_profile_id<>p_payout_profile_id
      or existing_batch.amount_minor<>p_confirmed_amount_minor
      or existing_batch.assembled_by<>p_operator_id
      or (select array_agg(member.earning_id order by member.earning_id)
        from public.learning_instructor_payout_batch_members member
        where member.batch_id=existing_batch.id) is distinct from selected_ids then
      raise exception 'Payout batch idempotency conflict' using errcode='23505';
    end if;
    return query select existing_batch.id,existing_batch.batch_reference,
      existing_batch.amount_minor,cardinality(selected_ids);
    return;
  end if;
  select * into profile_row from public.learning_instructor_payout_profiles profile
    where profile.id=p_payout_profile_id for update;
  if not found or profile_row.instructor_id<>p_instructor_id
    or profile_row.provider<>'paystack' or profile_row.provider_domain<>'live'
    or profile_row.status<>'active' or profile_row.currency<>'NGN' then
    raise exception 'Active matching Live payout profile required' using errcode='22023';
  end if;
  new_batch_id:=nextval(pg_get_serial_sequence('public.learning_instructor_payout_batches','id'));
  new_batch_reference:='LPB-'||new_batch_id::text;
  foreach selected_id in array selected_ids loop
    select * into reserved_row from public.reserve_learning_subscription_invoice_earning(
      selected_id,p_instructor_id,
      'batch:'||new_batch_id::text||':'||selected_id::text,p_operator_id);
    if reserved_row.reservation_id is null or reserved_row.currency<>'NGN' then
      raise exception 'Subscription reservation failed for batch member' using errcode='22023';
    end if;
    actual_amount:=actual_amount+reserved_row.amount_minor;
  end loop;
  if actual_amount<>p_confirmed_amount_minor then
    raise exception 'Confirmed amount does not match exact reserved earnings' using errcode='22023';
  end if;
  insert into public.learning_instructor_payout_batches(
    id,batch_reference,idempotency_key,instructor_id,payout_profile_id,
    amount_minor,currency,source_type,assembled_by
  ) values (new_batch_id,new_batch_reference,p_idempotency_key,p_instructor_id,
    p_payout_profile_id,actual_amount,'NGN','subscription_invoice',p_operator_id);
  insert into public.learning_instructor_payout_batch_members(
    batch_id,reservation_id,earning_id,amount_minor
  ) select new_batch_id,reservation.id,reservation.earning_id,reservation.amount_minor
    from public.learning_instructor_earning_reservations reservation
    where reservation.earning_id=any(selected_ids) order by reservation.earning_id;
  if (select count(*) from public.learning_instructor_payout_batch_members member
    where member.batch_id=new_batch_id)<>cardinality(selected_ids) then
    raise exception 'Incomplete subscription payout batch membership' using errcode='23514';
  end if;
  update public.learning_instructor_earning_reservations reservation
    set future_payout_item_reference='lpb-'||new_batch_id::text||'-earning-'||reservation.earning_id::text
    where reservation.earning_id=any(selected_ids)
      and reservation.future_payout_item_reference is null;
  get diagnostics bound_count=row_count;
  if bound_count<>cardinality(selected_ids) then
    raise exception 'Subscription payout reservation binding failed' using errcode='23514';
  end if;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
    values (p_operator_id,'admin_operator','subscription_payout_batch.assembled',
      'learning_instructor_payout_batch',new_batch_id::text,
      jsonb_build_object('batch_reference',new_batch_reference,'instructor_id',p_instructor_id,
        'payout_profile_id',p_payout_profile_id,'amount_minor',actual_amount,'earning_ids',selected_ids));
  return query select new_batch_id,new_batch_reference,actual_amount,cardinality(selected_ids);
end;$function$;

revoke all on function public.validate_learning_instructor_payout_batch_source(),
  public.list_learning_subscription_invoice_payout_batch_candidates(uuid,integer),
  public.approve_learning_subscription_invoice_live_payout_batch(uuid,uuid,bigint,bigint[],bigint,text)
  from public,anon,authenticated;
grant execute on function public.list_learning_subscription_invoice_payout_batch_candidates(uuid,integer),
  public.approve_learning_subscription_invoice_live_payout_batch(uuid,uuid,bigint,bigint[],bigint,text)
  to postgres,service_role;

commit;
