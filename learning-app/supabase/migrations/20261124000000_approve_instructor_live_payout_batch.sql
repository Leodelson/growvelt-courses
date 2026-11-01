-- Administrator-only, atomic assembly of an exact Live instructor payout
-- batch. This does not call the provider, initiate a transfer, or settle money.
begin;

create function public.approve_learning_instructor_live_payout_batch(
  p_operator_id uuid,
  p_instructor_id uuid,
  p_payout_profile_id bigint,
  p_earning_ids bigint[],
  p_confirmed_amount_minor bigint,
  p_idempotency_key text
)
returns table(batch_id bigint,batch_reference text,amount_minor bigint,member_count integer)
language plpgsql security definer set search_path to '' as $function$
declare
  selected_ids bigint[];
  selected_id bigint;
  existing_batch public.learning_instructor_payout_batches%rowtype;
  profile_row public.learning_instructor_payout_profiles%rowtype;
  reserved_row record;
  order_row record;
  new_batch_id bigint;
  new_batch_reference text;
  actual_amount bigint := 0;
  bound_count integer;
begin
  if p_operator_id is null or p_instructor_id is null or p_payout_profile_id is null
    or p_earning_ids is null or cardinality(p_earning_ids) not between 1 and 100
    or array_position(p_earning_ids,null) is not null
    or p_confirmed_amount_minor is null or p_confirmed_amount_minor < 100000
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z][a-z0-9:_-]{2,120}$'
  then
    raise exception 'Valid batch identity and confirmed amount are required' using errcode='22023';
  end if;
  selected_ids := array(
    select distinct selected.earning_id
    from unnest(p_earning_ids) as selected(earning_id)
    order by selected.earning_id
  );
  if cardinality(selected_ids)<>cardinality(p_earning_ids) then
    raise exception 'Duplicate earning in payout batch' using errcode='22023';
  end if;
  if not exists(select 1 from public.account_capabilities c
    where c.user_id=p_operator_id and c.capability='admin' and c.status='active')
  then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  perform public.assert_learning_approved_instructor(p_instructor_id);

  -- Serialize retries of one request before checking or creating any member.
  perform pg_advisory_xact_lock(hashtextextended('learning-payout-batch:'||p_idempotency_key,0));
  select * into existing_batch from public.learning_instructor_payout_batches b
    where b.idempotency_key=p_idempotency_key;
  if found then
    if existing_batch.instructor_id<>p_instructor_id
      or existing_batch.payout_profile_id<>p_payout_profile_id
      or existing_batch.amount_minor<>p_confirmed_amount_minor
      or existing_batch.assembled_by<>p_operator_id
      or (select array_agg(m.earning_id order by m.earning_id)
          from public.learning_instructor_payout_batch_members m
          where m.batch_id=existing_batch.id) is distinct from selected_ids
    then
      raise exception 'Payout batch idempotency conflict' using errcode='23505';
    end if;
    return query select existing_batch.id,existing_batch.batch_reference,
      existing_batch.amount_minor,cardinality(selected_ids);
    return;
  end if;

  select * into profile_row from public.learning_instructor_payout_profiles p
    where p.id=p_payout_profile_id for update;
  if not found or profile_row.instructor_id<>p_instructor_id
    or profile_row.provider<>'paystack' or profile_row.provider_domain<>'live'
    or profile_row.status<>'active' or profile_row.currency<>'NGN'
  then
    raise exception 'Active matching Live payout profile required' using errcode='22023';
  end if;

  -- Sequence gaps on a rolled-back attempt are harmless. Every economic row
  -- below is inserted in the caller's one database transaction.
  new_batch_id := nextval(pg_get_serial_sequence('public.learning_instructor_payout_batches','id'));
  new_batch_reference := 'LPB-'||new_batch_id::text;
  foreach selected_id in array selected_ids loop
    -- The existing reservation routine locks the earning, allocation, order,
    -- and payment-case write path. Sorted IDs avoid cross-batch lock inversion.
    select * into reserved_row from public.reserve_learning_instructor_earning(
      selected_id,p_instructor_id,
      'batch:'||new_batch_id::text||':'||selected_id::text,p_operator_id);
    if reserved_row.reservation_id is null or reserved_row.currency<>'NGN' then
      raise exception 'Reservation failed for batch member' using errcode='22023';
    end if;
    select o.id,o.gross_amount_minor,o.currency into order_row
      from public.learning_instructor_earnings e
      join public.learning_commercial_allocations a on a.id=e.allocation_id
      join public.learning_orders o on o.id=a.order_id
      where e.id=selected_id;
    if order_row.id is null
      or (select count(*) from public.learning_payment_attempts attempt
          where attempt.order_id=order_row.id and attempt.status='succeeded')<>1
      or not exists(select 1 from public.learning_payment_attempts attempt
          where attempt.order_id=order_row.id and attempt.status='succeeded'
            and attempt.provider='paystack' and attempt.paystack_domain='live'
            and attempt.amount_minor=order_row.gross_amount_minor
            and attempt.currency=order_row.currency)
      or exists(select 1 from public.learning_payment_cases payment_case
          where payment_case.order_id=order_row.id and payment_case.status in
            ('requested','submitting','pending','processing','needs_attention',
             'opened','action_required','submitted','under_review',
             'processed','succeeded','lost'))
    then
      raise exception 'Live payment or financial protection prevents batch approval'
        using errcode='22023';
    end if;
    actual_amount := actual_amount + reserved_row.amount_minor;
  end loop;
  if actual_amount<>p_confirmed_amount_minor then
    raise exception 'Confirmed amount does not match exact reserved earnings'
      using errcode='22023';
  end if;

  insert into public.learning_instructor_payout_batches(
    id,batch_reference,idempotency_key,instructor_id,payout_profile_id,
    amount_minor,currency,assembled_by
  ) values (
    new_batch_id,new_batch_reference,p_idempotency_key,p_instructor_id,
    p_payout_profile_id,actual_amount,'NGN',p_operator_id
  );
  insert into public.learning_instructor_payout_batch_members(
    batch_id,reservation_id,earning_id,amount_minor
  ) select new_batch_id,r.id,r.earning_id,r.amount_minor
    from public.learning_instructor_earning_reservations r
    where r.earning_id=any(selected_ids)
    order by r.earning_id;
  if (select count(*) from public.learning_instructor_payout_batch_members m
    where m.batch_id=new_batch_id)<>cardinality(selected_ids)
  then
    raise exception 'Incomplete payout batch membership' using errcode='23514';
  end if;
  update public.learning_instructor_earning_reservations r
    set future_payout_item_reference='lpb-'||new_batch_id::text||'-earning-'||r.earning_id::text
    where r.earning_id=any(selected_ids)
      and r.future_payout_item_reference is null;
  get diagnostics bound_count = row_count;
  if bound_count<>cardinality(selected_ids) then
    raise exception 'Payout batch reservation binding failed' using errcode='23514';
  end if;
  insert into public.learning_audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,metadata
  ) values (
    p_operator_id,'admin_operator','instructor_payout_batch.assembled',
    'learning_instructor_payout_batch',new_batch_id::text,
    jsonb_build_object('batch_reference',new_batch_reference,
      'instructor_id',p_instructor_id,'payout_profile_id',p_payout_profile_id,
      'amount_minor',actual_amount,'earning_ids',selected_ids)
  );
  return query select new_batch_id,new_batch_reference,actual_amount,
    cardinality(selected_ids);
end;$function$;

revoke all on function public.approve_learning_instructor_live_payout_batch(
  uuid,uuid,bigint,bigint[],bigint,text) from public,anon,authenticated;
grant execute on function public.approve_learning_instructor_live_payout_batch(
  uuid,uuid,bigint,bigint[],bigint,text) to postgres,service_role;

commit;
