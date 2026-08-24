alter table public.learning_payment_attempts
  add column provider_transaction_id text;

create unique index learning_payment_attempts_provider_transaction_key
  on public.learning_payment_attempts (provider, provider_transaction_id)
  where provider_transaction_id is not null;

create unique index learning_orders_one_active_purchase_key
  on public.learning_orders (learner_id, course_id)
  where learner_id is not null and course_id is not null
    and status in ('created', 'payment_pending', 'paid', 'partially_refunded');

create unique index learning_ledger_one_capture_per_order_key
  on public.learning_ledger_transactions (order_id)
  where transaction_type = 'payment_capture';

create or replace function public.initialize_paystack_test_learning_order(p_learner_id uuid, p_course_id bigint)
returns table (order_id bigint, order_reference text, payment_attempt_id bigint, amount_minor bigint, currency text)
language plpgsql security definer set search_path to '' as $function$
declare course_row record; order_key bigint; order_ref text; attempt_key bigint; amount_key bigint;
begin
  if p_learner_id is null or p_course_id is null then raise exception 'Learner and course are required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_learner_id::text || ':' || p_course_id::text, 0));
  if not exists (select 1 from public.profiles where id = p_learner_id) then raise exception 'Learner profile was not found' using errcode = 'P0002'; end if;
  select c.id, c.instructor_id, c.title, c.price_amount, c.price_currency, c.is_free, c.is_limited_time_free,
         c.status, p.full_name as instructor_name
    into course_row
  from public.learning_courses c left join public.profiles p on p.id = c.instructor_id
  where c.id = p_course_id;
  if not found or course_row.status <> 'published' then raise exception 'Course is not available for purchase' using errcode = '22023'; end if;
  if course_row.is_free or course_row.is_limited_time_free or course_row.price_amount is null or course_row.price_amount <= 0
    or course_row.price_currency <> 'NGN' or scale(course_row.price_amount) > 2
  then raise exception 'Course does not have an eligible paid NGN price' using errcode = '22023'; end if;
  if exists (select 1 from public.enrollments where learner_id = p_learner_id and course_id = p_course_id and status in ('active','completed'))
    or exists (select 1 from public.learning_course_entitlements where learner_id = p_learner_id and course_id = p_course_id and status = 'active')
  then raise exception 'Learner already has course access' using errcode = '23505'; end if;
  if exists (select 1 from public.learning_orders where learner_id = p_learner_id and course_id = p_course_id and status in ('created','payment_pending','paid','partially_refunded'))
  then raise exception 'A purchase already exists for this course' using errcode = '23505'; end if;
  amount_key := round(course_row.price_amount * 100)::bigint;
  insert into public.learning_orders (
    learner_id, course_id, instructor_id, course_title_snapshot, instructor_name_snapshot,
    gross_amount_minor, currency, status, commercial_terms_version
  ) values (
    p_learner_id, p_course_id, course_row.instructor_id, course_row.title, course_row.instructor_name,
    amount_key, 'NGN', 'created', 'phase1a-test-v1'
  ) returning id, learning_orders.order_reference into order_key, order_ref;
  insert into public.learning_payment_attempts (order_id, provider, provider_reference, amount_minor, currency, status)
  values (order_key, 'paystack', order_ref, amount_key, 'NGN', 'initialized') returning id into attempt_key;
  return query select order_key, order_ref, attempt_key, amount_key, 'NGN'::text;
end;
$function$;

create or replace function public.mark_paystack_test_learning_attempt_pending(p_order_reference text)
returns void language plpgsql security definer set search_path to '' as $function$
declare order_key bigint;
begin
  update public.learning_orders set status = 'payment_pending'
  where order_reference = p_order_reference and status = 'created' returning id into order_key;
  if order_key is null then raise exception 'Order cannot enter payment pending' using errcode = '22023'; end if;
  update public.learning_payment_attempts set status = 'pending'
  where order_id = order_key and provider = 'paystack' and status = 'initialized';
  if not found then raise exception 'Payment attempt cannot enter pending' using errcode = '22023'; end if;
end;
$function$;

create or replace function public.fail_paystack_test_learning_attempt(p_order_reference text, p_failure_code text, p_failure_message text)
returns void language plpgsql security definer set search_path to '' as $function$
declare order_key bigint;
begin
  select id into order_key from public.learning_orders where order_reference = p_order_reference for update;
  if order_key is null then return; end if;
  update public.learning_payment_attempts set status = 'failed', failed_at = now(), failure_code = left(coalesce(p_failure_code,'initialization_failed'),100),
    failure_message = left(coalesce(p_failure_message,'Paystack initialization failed'),1000)
  where order_id = order_key and provider = 'paystack' and status in ('initialized','pending');
  update public.learning_orders set status = 'cancelled', cancelled_at = now()
  where id = order_key and status in ('created','payment_pending');
end;
$function$;

create or replace function public.finalize_paystack_test_charge(
  p_provider_event_id text, p_payload_digest text, p_reference text, p_provider_transaction_id text,
  p_amount_minor bigint, p_currency text, p_domain text, p_payload jsonb
)
returns table (outcome text, order_id bigint, enrollment_id bigint)
language plpgsql security definer set search_path to '' as $function$
declare attempt_row record; event_row record; event_key bigint; enrollment_key bigint; ledger_key bigint; existing_digest text;
begin
  if p_domain <> 'test' or p_currency <> 'NGN' or p_amount_minor <= 0
    or p_payload_digest !~ '^[a-f0-9]{64}$' or p_provider_event_id is null or p_provider_transaction_id is null
  then raise exception 'Invalid Paystack test event' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('paystack:' || p_reference, 0));
  select a.id as attempt_id, a.order_id, a.amount_minor, a.currency, a.status as attempt_status,
         o.learner_id, o.course_id, o.status as order_status, o.gross_amount_minor
    into attempt_row
  from public.learning_payment_attempts a join public.learning_orders o on o.id = a.order_id
  where a.provider = 'paystack' and a.provider_reference = p_reference for update of a, o;
  if not found then
    insert into public.learning_payment_provider_events (provider, provider_event_id, event_type, payload_digest, payload, signature_valid, processing_status, processed_at, processing_error)
    values ('paystack', p_provider_event_id, 'charge.success', p_payload_digest, p_payload, true, 'ignored', now(), 'No matching Growvelt Learning payment attempt')
    on conflict (provider, provider_event_id) do nothing;
    return query select 'unknown_reference'::text, null::bigint, null::bigint; return;
  end if;
  select * into event_row from public.learning_payment_provider_events
  where provider = 'paystack' and provider_event_id = p_provider_event_id for update;
  if found then
    if event_row.payload_digest <> p_payload_digest then return query select 'duplicate_payload_mismatch'::text, attempt_row.order_id, null::bigint; return; end if;
    if event_row.processing_status = 'processed' then
      select e.enrollment_id into enrollment_key from public.learning_course_entitlements e where e.order_id = attempt_row.order_id;
      return query select 'already_processed'::text, attempt_row.order_id, enrollment_key; return;
    end if;
    event_key := event_row.id;
    update public.learning_payment_provider_events set processing_status = 'received', processed_at = null, processing_error = null,
      order_id = attempt_row.order_id, payment_attempt_id = attempt_row.attempt_id where id = event_key;
  else
    insert into public.learning_payment_provider_events (provider, provider_event_id, event_type, payload_digest, payload, signature_valid, order_id, payment_attempt_id)
    values ('paystack', p_provider_event_id, 'charge.success', p_payload_digest, p_payload, true, attempt_row.order_id, attempt_row.attempt_id)
    returning id into event_key;
  end if;
  if attempt_row.amount_minor <> p_amount_minor or attempt_row.gross_amount_minor <> p_amount_minor or attempt_row.currency <> p_currency then
    update public.learning_payment_provider_events set processing_status='failed', processed_at=now(), processing_error='Verified provider amount or currency did not match the order' where id=event_key;
    return query select 'amount_mismatch'::text, attempt_row.order_id, null::bigint; return;
  end if;
  if attempt_row.learner_id is null or attempt_row.course_id is null then
    update public.learning_payment_provider_events set processing_status='failed', processed_at=now(), processing_error='Order identity was detached before finalization' where id=event_key;
    return query select 'detached_order'::text, attempt_row.order_id, null::bigint; return;
  end if;
  if attempt_row.order_status in ('paid','partially_refunded','refunded','chargeback') then
    update public.learning_payment_provider_events set processing_status='processed', processed_at=now() where id=event_key;
    select e.enrollment_id into enrollment_key from public.learning_course_entitlements e where e.order_id = attempt_row.order_id;
    return query select 'already_paid'::text, attempt_row.order_id, enrollment_key; return;
  end if;
  if attempt_row.order_status = 'created' then update public.learning_orders set status='payment_pending' where id=attempt_row.order_id; end if;
  if attempt_row.order_status not in ('created','payment_pending') then
    update public.learning_payment_provider_events set processing_status='failed', processed_at=now(), processing_error='Order is not payable' where id=event_key;
    return query select 'order_not_payable'::text, attempt_row.order_id, null::bigint; return;
  end if;
  update public.learning_payment_attempts set status='succeeded', verified_at=now(), failed_at=null, failure_code=null, failure_message=null,
    provider_transaction_id=p_provider_transaction_id where id=attempt_row.attempt_id;
  update public.learning_orders set status='paid', paid_at=now(), cancelled_at=null where id=attempt_row.order_id;
  insert into public.learning_ledger_transactions (order_id, transaction_type, currency, description)
  values (attempt_row.order_id, 'payment_capture', 'NGN', 'Verified Paystack test-mode course payment') returning id into ledger_key;
  insert into public.learning_ledger_entries (transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference)
  values (ledger_key,1,'asset.paystack_receivable',p_amount_minor,'NGN','payment_provider',p_provider_transaction_id),
         (ledger_key,2,'liability.marketplace_sales_unallocated',-p_amount_minor,'NGN','learning_order',p_reference);
  insert into public.enrollments (learner_id, course_id, status)
  values (attempt_row.learner_id, attempt_row.course_id, 'active')
  on conflict (learner_id,course_id) do update set status='active', completed_at=null returning id into enrollment_key;
  insert into public.learning_course_entitlements (learner_id,course_id,order_id,enrollment_id,status)
  values (attempt_row.learner_id,attempt_row.course_id,attempt_row.order_id,enrollment_key,'active');
  update public.learning_payment_provider_events set processing_status='processed', processed_at=now(), processing_error=null where id=event_key;
  return query select 'paid_and_enrolled'::text, attempt_row.order_id, enrollment_key;
end;
$function$;

create or replace function public.get_own_paystack_learning_payment_status(p_order_reference text)
returns table (order_status text, payment_status text, course_slug text, entitlement_active boolean)
language sql stable security definer set search_path to '' as $function$
  select o.status, a.status, c.slug,
    exists(select 1 from public.learning_course_entitlements e where e.order_id=o.id and e.status='active')
  from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id
  left join public.learning_courses c on c.id=o.course_id
  where o.order_reference=p_order_reference and o.learner_id=auth.uid() and a.provider='paystack'
  order by a.id desc limit 1;
$function$;

create or replace function public.reconcile_paystack_test_learning_payments()
returns table (issue_type text, order_reference text, detail text)
language sql stable security definer set search_path to '' as $function$
  select 'paid_without_successful_attempt', o.order_reference, 'Paid order has no successful Paystack attempt' from public.learning_orders o
  where o.status in ('paid','partially_refunded','refunded','chargeback') and not exists(select 1 from public.learning_payment_attempts a where a.order_id=o.id and a.provider='paystack' and a.status='succeeded')
  union all select 'paid_without_capture_ledger', o.order_reference, 'Paid order has no payment-capture ledger transaction' from public.learning_orders o
  where o.status in ('paid','partially_refunded','refunded','chargeback') and not exists(select 1 from public.learning_ledger_transactions t where t.order_id=o.id and t.transaction_type='payment_capture')
  union all select 'paid_without_entitlement', o.order_reference, 'Paid order has no active entitlement' from public.learning_orders o
  where o.status='paid' and not exists(select 1 from public.learning_course_entitlements e where e.order_id=o.id and e.status='active')
  union all select 'entitlement_without_enrollment', o.order_reference, 'Active entitlement has no active or completed enrollment' from public.learning_orders o join public.learning_course_entitlements e on e.order_id=o.id and e.status='active'
  where not exists(select 1 from public.enrollments n where n.id=e.enrollment_id and n.learner_id=e.learner_id and n.course_id=e.course_id and n.status in ('active','completed'))
  union all select 'successful_attempt_unpaid_order', o.order_reference, 'Successful attempt belongs to an unpaid order' from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id
  where a.provider='paystack' and a.status='succeeded' and o.status not in ('paid','partially_refunded','refunded','chargeback')
  union all select 'failed_provider_event', coalesce(o.order_reference,'unknown'), left(coalesce(ev.processing_error,'Provider event processing failed'),1000)
  from public.learning_payment_provider_events ev left join public.learning_orders o on o.id=ev.order_id where ev.provider='paystack' and ev.processing_status='failed';
$function$;

revoke all on function public.initialize_paystack_test_learning_order(uuid,bigint) from public, anon, authenticated;
revoke all on function public.mark_paystack_test_learning_attempt_pending(text) from public, anon, authenticated;
revoke all on function public.fail_paystack_test_learning_attempt(text,text,text) from public, anon, authenticated;
revoke all on function public.finalize_paystack_test_charge(text,text,text,text,bigint,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.reconcile_paystack_test_learning_payments() from public, anon, authenticated;
grant execute on function public.initialize_paystack_test_learning_order(uuid,bigint) to postgres, service_role;
grant execute on function public.mark_paystack_test_learning_attempt_pending(text) to postgres, service_role;
grant execute on function public.fail_paystack_test_learning_attempt(text,text,text) to postgres, service_role;
grant execute on function public.finalize_paystack_test_charge(text,text,text,text,bigint,text,text,jsonb) to postgres, service_role;
grant execute on function public.reconcile_paystack_test_learning_payments() to postgres, service_role;
revoke all on function public.get_own_paystack_learning_payment_status(text) from public, anon;
grant execute on function public.get_own_paystack_learning_payment_status(text) to authenticated, postgres, service_role;
