begin;

-- Keep the controlled Phase 1A Test fixture unpurchasable with real money,
-- including when a caller bypasses the public course catalog or route UI.
create or replace function public.initialize_paystack_live_learning_order(p_learner_id uuid, p_course_id bigint)
returns table (order_id bigint, order_reference text, payment_attempt_id bigint, amount_minor bigint, currency text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  course_row record;
  order_key bigint;
  order_ref text;
  attempt_key bigint;
  amount_key bigint;
  terms_version text;
begin
  if p_learner_id is null or p_course_id is null then
    raise exception 'Learner and course are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('paystack:live:' || p_learner_id::text || ':' || p_course_id::text, 0));
  if not exists (select 1 from public.profiles where id = p_learner_id) then
    raise exception 'Learner profile was not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.learning_paystack_test_fixtures where course_id = p_course_id) then
    raise exception 'Controlled Test Mode courses cannot be purchased with Live payments' using errcode = '42501';
  end if;

  select c.id, c.instructor_id, c.title, c.price_amount, c.price_currency, c.is_free,
         c.is_limited_time_free, c.status, p.full_name as instructor_name
    into course_row
  from public.learning_courses c
  left join public.profiles p on p.id = c.instructor_id
  where c.id = p_course_id;
  if not found or course_row.status <> 'published' then
    raise exception 'Course is not available for purchase' using errcode = '22023';
  end if;
  if course_row.is_free or course_row.is_limited_time_free or course_row.price_amount is null
    or course_row.price_amount <= 0 or course_row.price_currency <> 'NGN' or scale(course_row.price_amount) > 2
  then
    raise exception 'Course does not have an eligible paid NGN price' using errcode = '22023';
  end if;
  if exists (select 1 from public.enrollments where learner_id = p_learner_id and course_id = p_course_id and status in ('active', 'completed'))
    or exists (select 1 from public.learning_course_entitlements where learner_id = p_learner_id and course_id = p_course_id and status = 'active')
    or exists (select 1 from public.learning_orders where learner_id = p_learner_id and course_id = p_course_id and status in ('created', 'payment_pending', 'paid', 'partially_refunded'))
  then
    raise exception 'Learner already has course access or a purchase in progress' using errcode = '23505';
  end if;

  amount_key := round(course_row.price_amount * 100)::bigint;
  terms_version := public.resolve_learning_commercial_terms_version(course_row.id, course_row.instructor_id);
  insert into public.learning_orders (
    learner_id, course_id, instructor_id, course_title_snapshot, instructor_name_snapshot,
    gross_amount_minor, currency, status, commercial_terms_version
  ) values (
    p_learner_id, p_course_id, course_row.instructor_id, course_row.title, course_row.instructor_name,
    amount_key, 'NGN', 'created', terms_version
  ) returning id, learning_orders.order_reference into order_key, order_ref;
  insert into public.learning_payment_attempts (order_id, provider, provider_reference, amount_minor, currency, status, paystack_domain)
  values (order_key, 'paystack', order_ref, amount_key, 'NGN', 'initialized', 'live')
  returning id into attempt_key;
  return query select order_key, order_ref, attempt_key, amount_key, 'NGN'::text;
end;
$function$;

revoke all on function public.initialize_paystack_live_learning_order(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.initialize_paystack_live_learning_order(uuid, bigint)
  to postgres, service_role;

create or replace function public.fail_paystack_live_learning_attempt(
  p_order_reference text,
  p_failure_code text,
  p_failure_message text
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  order_key bigint;
begin
  -- This cleanup RPC is deliberately limited to learner-course GL references
  -- and Live-domain attempts. Company purchases use a separate CP flow.
  if p_order_reference is null or p_order_reference !~ '^GL-[A-F0-9]{32}$' then
    return;
  end if;

  select id into order_key
  from public.learning_orders
  where order_reference = p_order_reference
  for update;

  if order_key is null then
    return;
  end if;

  update public.learning_payment_attempts
  set status = 'failed',
      failed_at = now(),
      failure_code = left(coalesce(p_failure_code, 'initialization_failed'), 100),
      failure_message = left(coalesce(p_failure_message, 'Paystack initialization failed'), 1000)
  where order_id = order_key
    and provider = 'paystack'
    and paystack_domain = 'live'
    and status in ('initialized', 'pending');

  -- Do not cancel the order unless a matching Live attempt was actually
  -- transitioned. In particular, a concurrent successful webhook is safe.
  if not found then
    return;
  end if;

  update public.learning_orders
  set status = 'cancelled', cancelled_at = now()
  where id = order_key and status in ('created', 'payment_pending');
end;
$function$;

revoke all on function public.fail_paystack_live_learning_attempt(text, text, text)
  from public, anon, authenticated;
grant execute on function public.fail_paystack_live_learning_attempt(text, text, text)
  to postgres, service_role;

commit;
