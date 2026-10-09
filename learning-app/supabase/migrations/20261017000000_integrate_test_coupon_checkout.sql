-- Phase 4: connect platform coupons to controlled individual Test Mode checkout.
-- This does not enable checkout, alter Live behavior, or change company purchases.

begin;

create or replace function public.is_learning_promotion_course_eligible(p_course_id bigint)
returns boolean
language sql stable security definer set search_path to '' as $function$
  select exists (
    select 1 from public.learning_courses course
    where course.id = p_course_id and course.status = 'published'
      and course.is_free = false and coalesce(course.is_limited_time_free, false) = false
      and coalesce(course.company_test_mode_only, false) = false
      and course.organization_id is null and course.price_currency = 'NGN'
      and course.price_amount > 0
      and (
        not public.is_paystack_test_fixture_course(course.id)
        or exists (
          select 1 from public.learning_paystack_test_fixtures fixture
          where fixture.course_id = course.id and fixture.status = 'active' and fixture.expires_at > now()
        )
      )
  );
$function$;
revoke all on function public.is_learning_promotion_course_eligible(bigint) from public, anon, authenticated;
grant execute on function public.is_learning_promotion_course_eligible(bigint) to postgres, service_role;

create or replace function public.list_learning_promotion_course_options_for_admin()
returns table(course_id bigint, title text, price_amount numeric, currency text)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;
  return query
    select course.id, course.title, course.price_amount, course.price_currency
    from public.learning_courses course
    where public.is_learning_promotion_course_eligible(course.id)
    order by course.title, course.id;
end;
$function$;

create or replace function public.create_learning_promotion_coupon_for_admin(
  p_code text,
  p_discount_kind text,
  p_discount_value bigint,
  p_max_discount_minor bigint,
  p_minimum_charge_minor bigint,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_max_redemptions integer,
  p_course_ids bigint[]
)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare
  actor_id uuid := auth.uid();
  normalized_code text := upper(btrim(p_code));
  coupon_key bigint;
  selected_count integer;
begin
  if actor_id is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;
  if normalized_code is null or normalized_code !~ '^[A-Z0-9][A-Z0-9_-]{3,23}$'
    or p_discount_kind is null or p_discount_kind not in ('fixed','percentage')
    or p_discount_value is null or p_discount_value <= 0
    or p_max_discount_minor is null or p_max_discount_minor <= 0
    or p_minimum_charge_minor is null or p_minimum_charge_minor <= 0
    or p_starts_at is null or p_ends_at is null or p_starts_at >= p_ends_at
    or (p_discount_kind = 'percentage' and p_discount_value > 10000)
    or (p_discount_kind = 'fixed' and p_discount_value > p_max_discount_minor)
    or (p_max_redemptions is not null and p_max_redemptions < 1)
    or p_course_ids is null or cardinality(p_course_ids) not between 1 and 20 then
    raise exception 'Coupon settings are invalid' using errcode = '22023';
  end if;

  select count(distinct selected.course_id)::integer into selected_count
  from unnest(p_course_ids) selected(course_id)
  where public.is_learning_promotion_course_eligible(selected.course_id);
  if selected_count <> cardinality(p_course_ids) then
    raise exception 'Choose only currently eligible published paid courses' using errcode = '22023';
  end if;

  insert into public.learning_promotion_coupons(
    code, discount_kind, discount_value, max_discount_minor, minimum_charge_minor,
    starts_at, ends_at, max_redemptions, created_by
  ) values (
    normalized_code, p_discount_kind, p_discount_value, p_max_discount_minor,
    p_minimum_charge_minor, p_starts_at, p_ends_at, p_max_redemptions, actor_id
  ) returning id into coupon_key;

  insert into public.learning_promotion_coupon_courses(coupon_id, course_id)
    select coupon_key, selected.course_id from unnest(p_course_ids) selected(course_id);

  insert into public.learning_audit_events(actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values (actor_id, 'admin_operator', 'promotion_coupon.created', 'promotion_coupon', coupon_key::text,
    jsonb_build_object('discount_kind', p_discount_kind, 'course_count', cardinality(p_course_ids),
      'max_redemptions', p_max_redemptions));
  return coupon_key;
end;
$function$;

create or replace function public.list_learning_promotion_coupons_for_admin()
returns table(
  coupon_id bigint, code text, discount_kind text, discount_value bigint,
  max_discount_minor bigint, minimum_charge_minor bigint, starts_at timestamptz,
  ends_at timestamptz, max_redemptions integer, active boolean,
  redeemed_count bigint, course_ids bigint[]
)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;
  return query
    select coupon.id, coupon.code, coupon.discount_kind, coupon.discount_value,
      coupon.max_discount_minor, coupon.minimum_charge_minor, coupon.starts_at, coupon.ends_at,
      coupon.max_redemptions, coupon.active,
      (select count(*) from public.learning_promotion_redemptions redemption
        where redemption.coupon_id = coupon.id and (redemption.status = 'consumed'
          or (redemption.status = 'reserved' and (redemption.expires_at > now() or exists(
            select 1 from public.learning_orders orders
            where orders.id = redemption.order_id and orders.status in ('created','payment_pending')
          ))))),
      coalesce((select array_agg(link.course_id order by link.course_id)
        from public.learning_promotion_coupon_courses link where link.coupon_id = coupon.id), '{}'::bigint[])
    from public.learning_promotion_coupons coupon
    order by coupon.created_at desc, coupon.id desc
    limit 200;
end;
$function$;

-- A reservation linked to a live pending order remains held until a verified
-- payment consumes it or the order reaches a terminal cancelled state.
alter table public.learning_promotion_redemptions
  drop constraint learning_promotion_redemptions_lifecycle_check;
alter table public.learning_promotion_redemptions
  add constraint learning_promotion_redemptions_lifecycle_check check (
    (status = 'reserved' and consumed_at is null and released_at is null)
    or (status = 'consumed' and consumed_at is not null and released_at is null and order_id is not null)
    or (status in ('released','expired') and consumed_at is null and released_at is not null and order_id is null)
  );

create or replace function public.reserve_learning_promotion_coupon_for_test(
  p_code text,
  p_learner_id uuid,
  p_course_id bigint,
  p_reservation_key uuid
)
returns table(
  redemption_id uuid, status text, expires_at timestamptz, list_price_minor bigint,
  discount_minor bigint, customer_charge_minor bigint, seller_share_minor bigint,
  platform_share_minor bigint, commercial_terms_version text
)
language plpgsql security definer set search_path to '' as $function$
declare
  coupon_row public.learning_promotion_coupons%rowtype;
  course_row public.learning_courses%rowtype;
  terms_row public.learning_commercial_terms%rowtype;
  prior_row public.learning_promotion_redemptions%rowtype;
  redemption_key uuid;
  terms_version text;
  price_minor bigint;
  platform_minor bigint;
  seller_minor bigint;
  raw_discount bigint;
  discount_minor bigint;
  charge_minor bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_learner_id is null
    or p_course_id is null or p_reservation_key is null
    or p_reservation_key = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Coupon checkout reservation is unavailable' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.learning_paystack_test_fixtures fixture
    where fixture.course_id = p_course_id and fixture.tester_id = p_learner_id
      and fixture.status = 'active' and fixture.expires_at > now()
  ) then
    raise exception 'Coupon checkout reservation is unavailable' using errcode = '22023';
  end if;

  select * into prior_row from public.learning_promotion_redemptions
    where reservation_key = p_reservation_key for update;
  if found then
    if prior_row.learner_id <> p_learner_id or prior_row.course_id <> p_course_id
      or not exists(select 1 from public.learning_promotion_coupons coupon
        where coupon.id = prior_row.coupon_id and coupon.code = upper(btrim(p_code))) then
      raise exception 'Coupon checkout reservation is unavailable' using errcode = '22023';
    end if;
    if prior_row.status = 'reserved' and (
        (prior_row.order_id is null and prior_row.expires_at > now())
        or (prior_row.order_id is not null and exists(
          select 1 from public.learning_orders orders
          where orders.id = prior_row.order_id and orders.status in ('created','payment_pending')
        ))
      ) then
      return query select prior_row.id, prior_row.status, prior_row.expires_at,
        prior_row.list_price_minor, prior_row.discount_minor, prior_row.customer_charge_minor,
        prior_row.seller_share_minor, prior_row.platform_share_minor, prior_row.commercial_terms_version;
      return;
    end if;
    raise exception 'Coupon checkout reservation is unavailable' using errcode = '22023';
  end if;

  select * into coupon_row from public.learning_promotion_coupons
    where code = upper(btrim(p_code)) for update;
  if not found or not coupon_row.active or coupon_row.starts_at > now() or coupon_row.ends_at <= now() then
    raise exception 'Coupon is invalid or unavailable' using errcode = '22023';
  end if;
  if not exists(select 1 from public.learning_promotion_coupon_courses link
      where link.coupon_id = coupon_row.id and link.course_id = p_course_id)
    or not public.is_learning_promotion_course_eligible(p_course_id) then
    raise exception 'Coupon is invalid or unavailable' using errcode = '22023';
  end if;

  update public.learning_promotion_redemptions as redemption
    set status = 'expired', released_at = now()
    where redemption.coupon_id = coupon_row.id and redemption.status = 'reserved'
      and redemption.expires_at <= now() and redemption.order_id is null;

  if coupon_row.max_redemptions is not null and (
      select count(*) from public.learning_promotion_redemptions redemption
      where redemption.coupon_id = coupon_row.id and (redemption.status = 'consumed'
        or (redemption.status = 'reserved' and (redemption.expires_at > now() or exists(
          select 1 from public.learning_orders orders
          where orders.id = redemption.order_id and orders.status in ('created','payment_pending')
        ))))
    ) >= coupon_row.max_redemptions then
    raise exception 'Coupon is invalid or unavailable' using errcode = '22023';
  end if;
  if (select count(*) from public.learning_promotion_redemptions redemption
      where redemption.coupon_id = coupon_row.id and redemption.learner_id = p_learner_id
        and (redemption.status = 'consumed' or (redemption.status = 'reserved' and (redemption.expires_at > now() or exists(
          select 1 from public.learning_orders orders
          where orders.id = redemption.order_id and orders.status in ('created','payment_pending')
        ))))) >= coupon_row.max_redemptions_per_user then
    raise exception 'Coupon is invalid or unavailable' using errcode = '22023';
  end if;

  select * into course_row from public.learning_courses course
    where course.id = p_course_id and public.is_learning_promotion_course_eligible(course.id)
    for share;
  if not found then raise exception 'Coupon is invalid or unavailable' using errcode = '22023'; end if;

  terms_version := public.resolve_learning_commercial_terms_version(course_row.id, course_row.instructor_id);
  select * into terms_row from public.learning_commercial_terms where version = terms_version;
  if not found then raise exception 'Coupon is invalid or unavailable' using errcode = '22023'; end if;
  price_minor := round(course_row.price_amount * 100)::bigint;
  platform_minor := round(price_minor * terms_row.commission_basis_points / 10000.0)::bigint;
  seller_minor := price_minor - platform_minor;
  if coupon_row.discount_kind = 'fixed' then raw_discount := coupon_row.discount_value;
  else raw_discount := round(price_minor * coupon_row.discount_value / 10000.0)::bigint;
  end if;
  discount_minor := least(raw_discount, coupon_row.max_discount_minor);
  charge_minor := price_minor - discount_minor;
  if discount_minor <= 0 or discount_minor > platform_minor or seller_minor <= 0
    or charge_minor < coupon_row.minimum_charge_minor then
    raise exception 'Coupon is invalid or unavailable' using errcode = '22023';
  end if;

  insert into public.learning_promotion_redemptions(
    coupon_id, learner_id, course_id, reservation_key, list_price_minor,
    discount_minor, customer_charge_minor, seller_share_minor, platform_share_minor,
    commercial_terms_version, expires_at
  ) values (
    coupon_row.id, p_learner_id, course_row.id, p_reservation_key, price_minor,
    discount_minor, charge_minor, seller_minor, platform_minor - discount_minor,
    terms_version, now() + interval '15 minutes'
  ) returning id into redemption_key;

  return query select redemption.id, redemption.status, redemption.expires_at,
    redemption.list_price_minor, redemption.discount_minor, redemption.customer_charge_minor,
    redemption.seller_share_minor, redemption.platform_share_minor, redemption.commercial_terms_version
    from public.learning_promotion_redemptions redemption where redemption.id = redemption_key;
end;
$function$;

create or replace function public.initialize_paystack_test_learning_order_with_coupon(
  p_learner_id uuid,
  p_course_id bigint,
  p_coupon_code text,
  p_reservation_key uuid
)
returns table(
  order_id bigint, order_reference text, payment_attempt_id bigint, amount_minor bigint,
  currency text, list_price_minor bigint, discount_minor bigint
)
language plpgsql security definer set search_path to '' as $function$
declare
  course_row record;
  order_key bigint;
  order_ref text;
  attempt_key bigint;
  reservation_row record;
  existing_order record;
begin
  if coalesce(auth.role(), '') <> 'service_role' or p_learner_id is null or p_course_id is null
    or p_reservation_key is null or p_reservation_key = '00000000-0000-0000-0000-000000000000'::uuid
    or p_coupon_code is null or btrim(p_coupon_code) !~ '^[A-Za-z0-9][A-Za-z0-9_-]{3,23}$' then
    raise exception 'Coupon checkout is unavailable' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_learner_id::text || ':' || p_course_id::text, 0));

  select orders.id, orders.order_reference, attempts.id payment_attempt_id,
    attempts.amount_minor, attempts.currency, redemption.list_price_minor, redemption.discount_minor
  into existing_order
  from public.learning_promotion_redemptions redemption
  join public.learning_promotion_coupons coupon on coupon.id = redemption.coupon_id
  join public.learning_orders orders on orders.id = redemption.order_id
  join public.learning_payment_attempts attempts on attempts.order_id = orders.id
    and attempts.provider = 'paystack' and attempts.paystack_domain = 'test'
  where redemption.reservation_key = p_reservation_key
    and redemption.learner_id = p_learner_id and redemption.course_id = p_course_id
    and coupon.code = upper(btrim(p_coupon_code)) and redemption.status = 'reserved'
    and orders.status in ('created','payment_pending') and attempts.status in ('initialized','pending')
  order by attempts.id desc limit 1;
  if found then
    return query select existing_order.id, existing_order.order_reference, existing_order.payment_attempt_id,
      existing_order.amount_minor, existing_order.currency, existing_order.list_price_minor, existing_order.discount_minor;
    return;
  end if;

  if not exists(select 1 from public.learning_paystack_test_fixtures fixture
      where fixture.course_id = p_course_id and fixture.tester_id = p_learner_id
        and fixture.status = 'active' and fixture.expires_at > now()) then
    raise exception 'Learner is not eligible for this controlled test checkout' using errcode = '42501';
  end if;
  if not exists(select 1 from public.profiles where id = p_learner_id) then
    raise exception 'Learner profile was not found' using errcode = 'P0002';
  end if;
  select course.id, course.instructor_id, course.title, course.price_amount,
    course.price_currency, course.is_free, course.is_limited_time_free, course.status,
    profile.full_name instructor_name
  into course_row
  from public.learning_courses course
  left join public.profiles profile on profile.id = course.instructor_id
  where course.id = p_course_id for share of course;
  if not found or not public.is_learning_promotion_course_eligible(course_row.id) then
    raise exception 'Course is not available for coupon checkout' using errcode = '22023';
  end if;
  if exists(select 1 from public.enrollments where learner_id = p_learner_id and course_id = p_course_id and status in ('active','completed'))
    or exists(select 1 from public.learning_course_entitlements where learner_id = p_learner_id and course_id = p_course_id and status = 'active') then
    raise exception 'Learner already has course access' using errcode = '23505';
  end if;
  if exists(select 1 from public.learning_orders where learner_id = p_learner_id and course_id = p_course_id and status in ('created','payment_pending','paid','partially_refunded')) then
    raise exception 'A purchase already exists for this course' using errcode = '23505';
  end if;

  select * into reservation_row from public.reserve_learning_promotion_coupon_for_test(
    p_coupon_code, p_learner_id, p_course_id, p_reservation_key
  );
  insert into public.learning_orders(
    learner_id, course_id, instructor_id, course_title_snapshot, instructor_name_snapshot,
    gross_amount_minor, currency, status, commercial_terms_version
  ) values (
    p_learner_id, p_course_id, course_row.instructor_id, course_row.title, course_row.instructor_name,
    reservation_row.customer_charge_minor, 'NGN', 'created', reservation_row.commercial_terms_version
  ) returning id, learning_orders.order_reference into order_key, order_ref;
  update public.learning_promotion_redemptions redemption
    set order_id = order_key
    where redemption.reservation_key = p_reservation_key
      and redemption.status = 'reserved' and redemption.order_id is null;
  if not found then raise exception 'Coupon reservation could not be attached to the order' using errcode = '40001'; end if;
  insert into public.learning_payment_attempts(
    order_id, provider, provider_reference, amount_minor, currency, status, paystack_domain
  ) values (order_key, 'paystack', order_ref, reservation_row.customer_charge_minor, 'NGN', 'initialized', 'test')
  returning id into attempt_key;
  return query select order_key, order_ref, attempt_key, reservation_row.customer_charge_minor,
    'NGN'::text, reservation_row.list_price_minor, reservation_row.discount_minor;
end;
$function$;

create or replace function public.release_learning_promotion_reservation_on_order_cancel()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    update public.learning_promotion_redemptions
      set status = 'released', released_at = now(), order_id = null
      where order_id = new.id and status = 'reserved';
  end if;
  return new;
end;
$function$;
revoke all on function public.release_learning_promotion_reservation_on_order_cancel() from public, anon, authenticated, service_role;
drop trigger if exists release_learning_promotion_reservation_on_order_cancel on public.learning_orders;
create trigger release_learning_promotion_reservation_on_order_cancel
after update of status on public.learning_orders
for each row execute function public.release_learning_promotion_reservation_on_order_cancel();

create or replace function public.allocate_learning_order_commercial_terms(p_order_id bigint,p_actor_user_id uuid default null)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare
  order_row record;
  terms_row public.learning_commercial_terms%rowtype;
  redemption_row public.learning_promotion_redemptions%rowtype;
  allocation_key bigint;
  ledger_key bigint;
  earning_key bigint;
  commission_minor bigint;
  instructor_minor bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('commercial-allocation:' || p_order_id::text, 0));
  select order_record.* into order_row from public.learning_orders order_record where order_record.id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  select allocation.id into allocation_key from public.learning_commercial_allocations allocation where allocation.order_id = p_order_id;
  if found then return allocation_key; end if;
  if order_row.status <> 'paid' or order_row.instructor_id is null or order_row.course_id is null or order_row.commercial_terms_version is null then
    raise exception 'Paid order with an instructor and commercial terms is required' using errcode = '22023';
  end if;
  if not exists(select 1 from public.learning_ledger_transactions where order_id = p_order_id and transaction_type = 'payment_capture') then
    raise exception 'Payment capture ledger is required before allocation' using errcode = '22023';
  end if;
  select * into terms_row from public.learning_commercial_terms where version = order_row.commercial_terms_version;
  if not found then return null; end if;

  select * into redemption_row from public.learning_promotion_redemptions where order_id = p_order_id for update;
  if found then
    if redemption_row.status <> 'reserved' or redemption_row.payment_mode <> 'test'
      or redemption_row.learner_id <> order_row.learner_id or redemption_row.course_id <> order_row.course_id
      or redemption_row.customer_charge_minor <> order_row.gross_amount_minor
      or redemption_row.commercial_terms_version <> order_row.commercial_terms_version
      or redemption_row.customer_charge_minor <> redemption_row.seller_share_minor + redemption_row.platform_share_minor
      or not exists(select 1 from public.learning_payment_attempts attempt
        where attempt.order_id = p_order_id and attempt.provider = 'paystack'
          and attempt.paystack_domain = 'test' and attempt.status = 'succeeded'
          and attempt.amount_minor = redemption_row.customer_charge_minor) then
      raise exception 'Coupon allocation snapshot does not match the verified test payment' using errcode = '22023';
    end if;
    commission_minor := redemption_row.platform_share_minor;
    instructor_minor := redemption_row.seller_share_minor;
  else
    commission_minor := round(order_row.gross_amount_minor * terms_row.commission_basis_points / 10000.0)::bigint;
    instructor_minor := order_row.gross_amount_minor - commission_minor;
  end if;

  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description,created_by)
  values(p_order_id,'commercial_allocation',order_row.currency,'Immutable Growvelt platform and instructor commercial allocation',p_actor_user_id) returning id into ledger_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency,counterparty_type,counterparty_reference) values
    (ledger_key,1,'liability.marketplace_sales_unallocated',order_row.gross_amount_minor,order_row.currency,'learning_order',order_row.order_reference),
    (ledger_key,2,'revenue.platform_commission',-commission_minor,order_row.currency,'commercial_terms',terms_row.version),
    (ledger_key,3,'liability.instructor_earnings_held',-instructor_minor,order_row.currency,'instructor',order_row.instructor_id::text);
  insert into public.learning_commercial_allocations(order_id,commercial_terms_version,instructor_id,course_id,gross_amount_minor,platform_commission_minor,instructor_gross_minor,currency,allocation_ledger_transaction_id)
  values(p_order_id,terms_row.version,order_row.instructor_id,order_row.course_id,order_row.gross_amount_minor,commission_minor,instructor_minor,order_row.currency,ledger_key) returning id into allocation_key;
  insert into public.learning_instructor_earnings(allocation_id,instructor_id,gross_amount_minor,currency,status,available_at,hold_reason)
  values(allocation_key,order_row.instructor_id,instructor_minor,order_row.currency,'held',coalesce(order_row.paid_at,now())+make_interval(days=>terms_row.earnings_hold_days),'Standard 14-day commercial earnings hold') returning id into earning_key;
  insert into public.learning_instructor_earning_events(earning_id,event_type,to_status,ledger_transaction_id,actor_user_id,metadata)
  values(earning_key,'earning.held','held',ledger_key,p_actor_user_id,jsonb_build_object('commercial_terms_version',terms_row.version,'hold_days',terms_row.earnings_hold_days,'platform_commission_minor',commission_minor));
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_actor_user_id,case when p_actor_user_id is null then 'payment_system' else 'admin_operator' end,'commercial_allocation.created','commercial_allocation',allocation_key::text,
    jsonb_build_object('order_id',p_order_id,'terms_version',terms_row.version,'platform_commission_minor',commission_minor,'instructor_gross_minor',instructor_minor,
      'coupon_discount_minor',case when redemption_row.id is null then 0 else redemption_row.discount_minor end));
  if redemption_row.id is not null then
    update public.learning_promotion_redemptions set status = 'consumed', consumed_at = now()
      where id = redemption_row.id and status = 'reserved';
    if not found then raise exception 'Coupon redemption could not be consumed' using errcode = '40001'; end if;
  end if;
  return allocation_key;
end;
$function$;

revoke all on function public.is_learning_promotion_course_eligible(bigint),
  public.list_learning_promotion_course_options_for_admin(),
  public.create_learning_promotion_coupon_for_admin(text,text,bigint,bigint,bigint,timestamptz,timestamptz,integer,bigint[]),
  public.list_learning_promotion_coupons_for_admin(),
  public.reserve_learning_promotion_coupon_for_test(text,uuid,bigint,uuid),
  public.initialize_paystack_test_learning_order_with_coupon(uuid,bigint,text,uuid),
  public.allocate_learning_order_commercial_terms(bigint,uuid)
  from public, anon, authenticated;
grant execute on function public.list_learning_promotion_course_options_for_admin(),
  public.create_learning_promotion_coupon_for_admin(text,text,bigint,bigint,bigint,timestamptz,timestamptz,integer,bigint[]),
  public.list_learning_promotion_coupons_for_admin()
  to authenticated, postgres;
grant execute on function public.reserve_learning_promotion_coupon_for_test(text,uuid,bigint,uuid),
  public.initialize_paystack_test_learning_order_with_coupon(uuid,bigint,text,uuid)
  to service_role, postgres;
grant execute on function public.allocate_learning_order_commercial_terms(bigint,uuid) to postgres, service_role;

commit;
