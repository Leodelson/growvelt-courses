-- A source-specific, fail-closed transfer claim for approved subscription
-- invoice batches. The application must still perform the provider call behind
-- its separate Live transfer switch.
begin;

create function public.begin_learning_subscription_invoice_live_payout_batch_transfer(
  p_batch_id bigint,p_actor_user_id uuid,p_idempotency_key text
) returns table(
  attempt_id bigint,attempt_reference text,recipient_code text,amount_minor bigint,
  currency text,transfer_submission_needed boolean
) language plpgsql security definer set search_path to '' as $function$
declare
  batch_row public.learning_instructor_payout_batches%rowtype;
  profile_row public.learning_instructor_payout_profiles%rowtype;
  prior_attempt public.learning_instructor_payout_batch_attempts%rowtype;
  member_row record;
  next_number integer;
  new_attempt_id bigint;
  new_reference text;
  checked_total bigint:=0;
  actual_total bigint;
begin
  if p_batch_id is null or p_actor_user_id is null or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z][a-z0-9:_-]{2,120}$'
    or not exists (select 1 from public.account_capabilities c
      where c.user_id=p_actor_user_id and c.capability='admin' and c.status='active') then
    raise exception 'Valid administrator and subscription payout batch required' using errcode='42501';
  end if;
  select * into batch_row from public.learning_instructor_payout_batches batch
    where batch.id=p_batch_id for update;
  if not found or batch_row.source_type<>'subscription_invoice' then
    raise exception 'Subscription invoice payout batch not found' using errcode='P0002';
  end if;
  select * into prior_attempt from public.learning_instructor_payout_batch_attempts attempt
    where attempt.idempotency_key=p_idempotency_key;
  if found then
    if prior_attempt.batch_id<>batch_row.id then
      raise exception 'Payout attempt idempotency conflict' using errcode='23505';
    end if;
    if prior_attempt.status<>'submitting' or prior_attempt.provider_transfer_id is not null then
      raise exception 'Payout attempt was already submitted or resolved; verify its reference' using errcode='22023';
    end if;
    return query select prior_attempt.id,prior_attempt.attempt_reference,
      prior_attempt.recipient_code,prior_attempt.amount_minor,prior_attempt.currency,false;
    return;
  end if;
  if batch_row.status not in ('assembled','failed') then
    raise exception 'Subscription payout batch is unavailable for a transfer attempt' using errcode='22023';
  end if;
  select * into prior_attempt from public.learning_instructor_payout_batch_attempts attempt
    where attempt.batch_id=batch_row.id order by attempt.attempt_number desc limit 1 for update;
  if found and prior_attempt.status<>'failed' then
    raise exception 'Previous payout attempt has no safe retry status' using errcode='22023';
  end if;
  if found and prior_attempt.attempt_number>=100 then
    raise exception 'Payout retry limit reached' using errcode='22023';
  end if;
  next_number:=coalesce(prior_attempt.attempt_number,0)+1;
  new_reference:='lpb-live-batch-'||batch_row.id::text||'-a'||next_number::text;

  select * into profile_row from public.learning_instructor_payout_profiles profile
    where profile.id=batch_row.payout_profile_id for update;
  if not found or profile_row.instructor_id<>batch_row.instructor_id
    or profile_row.provider<>'paystack' or profile_row.provider_domain<>'live'
    or profile_row.status<>'active' or profile_row.currency<>batch_row.currency then
    raise exception 'Active matching Live payout profile required' using errcode='22023';
  end if;
  if not exists (select 1 from public.learning_instructor_payout_batch_members member
    where member.batch_id=batch_row.id) then
    raise exception 'Subscription payout batch has no members' using errcode='23514';
  end if;
  for member_row in
    select member.earning_id,member.reservation_id,member.amount_minor,
      reservation.status reservation_status,reservation.future_payout_item_reference,
      earning.status earning_status,earning.instructor_id earning_instructor,
      earning.gross_amount_minor,earning.currency earning_currency,
      earning.released_at,earning.recoverable_amount_minor,
      allocation.id allocation_id,allocation.status allocation_status,
      allocation.instructor_id allocation_instructor,
      allocation.gross_amount_minor allocation_gross,allocation.platform_commission_minor,
      allocation.instructor_gross_minor,allocation.currency allocation_currency,
      allocation.commercial_terms_version allocation_terms,
      invoice.id invoice_id,invoice.status invoice_status,
      invoice.instructor_id invoice_instructor,invoice.payment_domain,
      invoice.provider_transaction_id,invoice.provider_transaction_reference,
      invoice.paid_at,invoice.seller_share_minor,invoice.amount_minor invoice_amount,
      invoice.platform_share_minor,invoice.currency invoice_currency,
      invoice.commercial_terms_version invoice_terms,
      subscription.payment_domain subscription_domain,
      plan.payment_domain plan_domain,plan.instructor_id plan_instructor,
      plan.commercial_terms_version plan_terms
    from public.learning_instructor_payout_batch_members member
    join public.learning_instructor_earning_reservations reservation
      on reservation.id=member.reservation_id
    join public.learning_instructor_earnings earning on earning.id=member.earning_id
    join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
    join public.learning_subscription_invoices invoice on invoice.id=allocation.subscription_invoice_id
    join public.learning_subscriptions subscription on subscription.id=invoice.subscription_id
    join public.learning_subscription_plans plan on plan.id=subscription.plan_id
    where member.batch_id=batch_row.id order by member.earning_id
  loop
    -- The refund request takes this invoice lock before inserting its case.
    perform 1 from public.learning_subscription_invoices invoice
      where invoice.id=member_row.invoice_id for update;
    perform 1 from public.learning_commercial_allocations allocation
      where allocation.id=member_row.allocation_id for update;
    perform 1 from public.learning_instructor_earnings earning
      where earning.id=member_row.earning_id for update;
    perform 1 from public.learning_instructor_earning_reservations reservation
      where reservation.id=member_row.reservation_id for update;
    if member_row.reservation_status<>'reserved'
      or member_row.future_payout_item_reference<>
        'lpb-'||batch_row.id::text||'-earning-'||member_row.earning_id::text
      or member_row.earning_status<>'reserved'
      or member_row.earning_instructor<>batch_row.instructor_id
      or member_row.gross_amount_minor<>member_row.amount_minor
      or member_row.earning_currency<>batch_row.currency
      or member_row.released_at is null or member_row.recoverable_amount_minor<>0
      or member_row.allocation_status<>'allocated'
      or member_row.allocation_instructor<>batch_row.instructor_id
      or member_row.allocation_gross<>member_row.invoice_amount
      or member_row.platform_commission_minor<>member_row.platform_share_minor
      or member_row.instructor_gross_minor<>member_row.amount_minor
      or member_row.allocation_currency<>batch_row.currency
      or member_row.invoice_status<>'paid' or member_row.payment_domain<>'live'
      or member_row.subscription_domain<>'live' or member_row.plan_domain<>'live'
      or member_row.plan_instructor<>batch_row.instructor_id
      or member_row.invoice_instructor<>batch_row.instructor_id
      or member_row.invoice_currency<>batch_row.currency
      or member_row.allocation_terms<>member_row.invoice_terms
      or member_row.invoice_terms<>member_row.plan_terms
      or member_row.seller_share_minor<>member_row.amount_minor
      or member_row.invoice_amount<>member_row.platform_share_minor+member_row.seller_share_minor
      or member_row.provider_transaction_id is null
      or member_row.provider_transaction_reference is null or member_row.paid_at is null
      or exists (select 1 from public.learning_subscription_refund_cases refund_case
        where refund_case.invoice_id=member_row.invoice_id)
      or exists (select 1 from public.learning_instructor_payout_settlements settlement
        where settlement.earning_id=member_row.earning_id
          or settlement.reservation_id=member_row.reservation_id)
      or exists (select 1 from public.learning_instructor_payout_items item
        where item.earning_id=member_row.earning_id
          or item.reservation_id=member_row.reservation_id) then
      raise exception 'Subscription payout member is no longer eligible for Live transfer'
        using errcode='22023';
    end if;
    checked_total:=checked_total+member_row.amount_minor;
  end loop;
  select coalesce(sum(member.amount_minor),0)::bigint into actual_total
    from public.learning_instructor_payout_batch_members member where member.batch_id=batch_row.id;
  if checked_total<>batch_row.amount_minor or actual_total<>batch_row.amount_minor
    or checked_total<100000 then
    raise exception 'Subscription payout batch total does not match eligible members'
      using errcode='23514';
  end if;
  insert into public.learning_instructor_payout_batch_attempts(
    batch_id,attempt_number,attempt_reference,idempotency_key,payout_profile_id,
    recipient_code,provider_recipient_id,amount_minor,currency,initiated_by
  ) values (batch_row.id,next_number,new_reference,p_idempotency_key,profile_row.id,
    profile_row.recipient_code,profile_row.provider_recipient_id,batch_row.amount_minor,
    batch_row.currency,p_actor_user_id) returning id into new_attempt_id;
  update public.learning_instructor_payout_batches batch set status='submitting'
    where batch.id=batch_row.id;
  insert into public.learning_instructor_payout_batch_attempt_events(
    attempt_id,event_type,from_status,to_status,provenance,actor_user_id,metadata
  ) values (new_attempt_id,'payout_batch_attempt.submitting',null,'submitting','admin',p_actor_user_id,
    jsonb_build_object('batch_reference',batch_row.batch_reference,
      'source','subscription_invoice','amount_minor',batch_row.amount_minor,
      'member_count',(select count(*) from public.learning_instructor_payout_batch_members member
        where member.batch_id=batch_row.id)));
  return query select new_attempt_id,new_reference,profile_row.recipient_code,
    batch_row.amount_minor,batch_row.currency,true;
end;$function$;

revoke all on function public.begin_learning_subscription_invoice_live_payout_batch_transfer(bigint,uuid,text)
  from public,anon,authenticated;
grant execute on function public.begin_learning_subscription_invoice_live_payout_batch_transfer(bigint,uuid,text)
  to postgres,service_role;

-- Once a Live transfer may have been sent, hold new refund requests until
-- its provider outcome is known. A succeeded payout may later be refunded
-- through the existing recoverable-earnings accounting path.
create function public.prevent_learning_subscription_refund_during_payout_transfer()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if exists (
    select 1 from public.learning_commercial_allocations allocation
    join public.learning_instructor_earnings earning on earning.allocation_id=allocation.id
    join public.learning_instructor_payout_batch_members member on member.earning_id=earning.id
    join public.learning_instructor_payout_batches batch on batch.id=member.batch_id
    where allocation.subscription_invoice_id=new.invoice_id
      and batch.source_type='subscription_invoice'
      and batch.status in ('submitting','pending','recovery_required','financially_blocked')
  ) then
    raise exception 'Subscription refund requires payout transfer reconciliation first'
      using errcode='22023';
  end if;
  return new;
end;$function$;
create trigger prevent_learning_subscription_refund_during_payout_transfer
before insert on public.learning_subscription_refund_cases
for each row execute function public.prevent_learning_subscription_refund_during_payout_transfer();
revoke all on function public.prevent_learning_subscription_refund_during_payout_transfer()
  from public,anon,authenticated,service_role;

commit;
