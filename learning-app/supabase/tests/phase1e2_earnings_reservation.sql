begin;

create function pg_temp.phase1e2_paid_order(p_course_id bigint,p_paid_at timestamptz)
returns bigint language plpgsql as $function$
declare order_key bigint; capture_key bigint; course_row record;
begin
  select instructor_id,title into course_row from public.learning_courses where id=p_course_id;
  insert into public.learning_orders(instructor_id,course_id,course_title_snapshot,gross_amount_minor,currency,status,commercial_terms_version,paid_at)
  values(course_row.instructor_id,p_course_id,course_row.title,10000,'NGN','paid','growvelt-commercial-v1',p_paid_at)
  returning id into order_key;
  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description)
  values(order_key,'payment_capture','NGN','Phase 1E2 rollback-only reservation fixture') returning id into capture_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency) values
    (capture_key,1,'asset.paystack_receivable',10000,'NGN'),
    (capture_key,2,'liability.marketplace_sales_unallocated',-10000,'NGN');
  return order_key;
end;$function$;

do $test$
declare
  v_admin_id uuid:='55555555-5555-4555-8555-555555555551';
  v_instructor_id uuid:='55555555-5555-4555-8555-555555555552';
  v_other_instructor_id uuid:='55555555-5555-4555-8555-555555555553';
  v_course_id bigint; v_order_id bigint; v_allocation_id bigint; v_earning_id bigint;
  v_reservation_one bigint; v_reservation_two bigint; v_before_ledger_count bigint; v_after_ledger_count bigint;
  v_refund_order bigint; v_dispute_order bigint; v_chargeback_order bigint; v_held_order bigint;
  v_blocked boolean; v_function_definition text;
begin
  if has_table_privilege('authenticated','public.learning_instructor_earning_reservations','select')
    or has_function_privilege('authenticated','public.reserve_learning_instructor_earning(bigint,uuid,text,uuid)','execute') then
    raise exception 'Browser role can access earnings reservation financial state';
  end if;

  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (v_admin_id,'authenticated','authenticated','phase1e2-admin@example.test',now(),now()),
    (v_instructor_id,'authenticated','authenticated','phase1e2-instructor@example.test',now(),now()),
    (v_other_instructor_id,'authenticated','authenticated','phase1e2-other@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (v_admin_id,'phase1e2-admin@example.test','Phase 1E2 Admin','complete'),
    (v_instructor_id,'phase1e2-instructor@example.test','Phase 1E2 Instructor','complete'),
    (v_other_instructor_id,'phase1e2-other@example.test','Phase 1E2 Other Instructor','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (v_admin_id,'admin','active'),(v_instructor_id,'instructor','active'),(v_other_instructor_id,'instructor','active') on conflict(user_id,capability) do nothing;
  insert into public.instructor_profiles(user_id,approval_status) values
    (v_instructor_id,'approved'),(v_other_instructor_id,'approved') on conflict(user_id) do nothing;
  insert into public.learning_courses(instructor_id,title,slug,price_amount,price_currency,is_free,is_limited_time_free,status)
  values(v_instructor_id,'Phase 1E2 reservation course','phase1e2-reservation-course',100,'NGN',false,false,'draft') on conflict(slug) do nothing;
  select course.id into v_course_id from public.learning_courses course where course.slug='phase1e2-reservation-course';

  v_order_id:=pg_temp.phase1e2_paid_order(v_course_id,now()-interval '15 days');
  v_allocation_id:=public.allocate_learning_order_commercial_terms(v_order_id,null);
  if public.release_matured_learning_instructor_earnings(100,null)<>1 then raise exception 'Reservation fixture did not become available'; end if;
  select earning.id into v_earning_id from public.learning_instructor_earnings earning where earning.allocation_id=v_allocation_id and earning.status='available';
  select count(*) into v_before_ledger_count from public.learning_ledger_transactions transaction where transaction.order_id=v_order_id;

  select result.reservation_id into v_reservation_one from public.reserve_learning_instructor_earning(v_earning_id,v_instructor_id,'phase1e2:eligible:one',v_admin_id) result;
  select result.reservation_id into v_reservation_two from public.reserve_learning_instructor_earning(v_earning_id,v_instructor_id,'phase1e2:eligible:one',v_admin_id) result;
  select count(*) into v_after_ledger_count from public.learning_ledger_transactions transaction where transaction.order_id=v_order_id;
  if v_reservation_one is null or v_reservation_two<>v_reservation_one
    or not exists(select 1 from public.learning_instructor_earning_reservations reservation where reservation.id=v_reservation_one and reservation.earning_id=v_earning_id and reservation.allocation_id=v_allocation_id and reservation.instructor_id=v_instructor_id and reservation.amount_minor=7500 and reservation.status='reserved' and reservation.future_payout_item_reference is null)
    or not exists(select 1 from public.learning_instructor_earnings earning where earning.id=v_earning_id and earning.status='reserved')
    or (select count(*) from public.learning_instructor_earning_events event where event.earning_id=v_earning_id and event.event_type='earning.reserved')<>1
    or v_before_ledger_count<>v_after_ledger_count then
    raise exception 'Eligible available earning was not reserved atomically and idempotently without ledger movement';
  end if;
  update public.learning_instructor_earning_reservations as reservation
  set future_payout_item_reference='phase1e3-payout-item-'||v_reservation_one::text
  where reservation.id=v_reservation_one;
  if not exists(select 1 from public.learning_instructor_earning_reservations reservation where reservation.id=v_reservation_one and reservation.future_payout_item_reference='phase1e3-payout-item-'||v_reservation_one::text) then
    raise exception 'Privileged future payout reference linkage was not retained';
  end if;
  v_blocked:=false; begin
    update public.learning_instructor_earning_reservations as reservation set future_payout_item_reference='replacement-reference' where reservation.id=v_reservation_one;
  exception when insufficient_privilege then v_blocked:=true; end;
  if not v_blocked then raise exception 'Future payout reference was replaced'; end if;
  v_blocked:=false; begin
    update public.learning_instructor_earning_reservations as reservation set future_payout_item_reference=null where reservation.id=v_reservation_one;
  exception when insufficient_privilege then v_blocked:=true; end;
  if not v_blocked then raise exception 'Future payout reference was cleared'; end if;
  v_blocked:=false; begin
    update public.learning_instructor_earning_reservations as reservation set amount_minor=1 where reservation.id=v_reservation_one;
  exception when insufficient_privilege then v_blocked:=true; end;
  if not v_blocked then raise exception 'Reservation economic fields were mutable'; end if;
  perform set_config('phase1e2.reservation_id',v_reservation_one::text,true);
  v_blocked:=false; begin perform public.reserve_learning_instructor_earning(v_earning_id,v_instructor_id,'phase1e2:eligible:second',v_admin_id); exception when unique_violation or invalid_parameter_value then v_blocked:=true; end;
  if not v_blocked then raise exception 'Already reserved earning accepted another reservation'; end if;
  v_blocked:=false; begin perform public.reserve_learning_instructor_earning(v_earning_id,v_other_instructor_id,'phase1e2:wrong-owner',v_admin_id); exception when insufficient_privilege then v_blocked:=true; end;
  if not v_blocked then raise exception 'Cross-instructor reservation was accepted'; end if;
  v_blocked:=false; begin perform public.reserve_learning_instructor_earning(v_earning_id,v_instructor_id,'phase1e2:non-admin',v_instructor_id); exception when insufficient_privilege then v_blocked:=true; end;
  if not v_blocked then raise exception 'Non-admin actor reserved an earning'; end if;

  v_held_order:=pg_temp.phase1e2_paid_order(v_course_id,now()-interval '1 day');
  v_allocation_id:=public.allocate_learning_order_commercial_terms(v_held_order,null);
  select earning.id into v_earning_id from public.learning_instructor_earnings earning where earning.allocation_id=v_allocation_id;
  v_blocked:=false; begin perform public.reserve_learning_instructor_earning(v_earning_id,v_instructor_id,'phase1e2:held',v_admin_id); exception when invalid_parameter_value then v_blocked:=true; end;
  if not v_blocked then raise exception 'Held earning was reserved'; end if;

  v_refund_order:=pg_temp.phase1e2_paid_order(v_course_id,now()-interval '15 days');
  v_allocation_id:=public.allocate_learning_order_commercial_terms(v_refund_order); perform public.release_matured_learning_instructor_earnings(100,null);
  select earning.id into v_earning_id from public.learning_instructor_earnings earning where earning.allocation_id=v_allocation_id;
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(v_refund_order,'refund','processing',10000,'NGN','paystack','phase1e2-refund','processing');
  v_blocked:=false; begin perform public.reserve_learning_instructor_earning(v_earning_id,v_instructor_id,'phase1e2:refund',v_admin_id); exception when invalid_parameter_value then v_blocked:=true; end;
  if not v_blocked or exists(select 1 from public.learning_instructor_earning_reservations reservation where reservation.earning_id=v_earning_id) then raise exception 'Active refund did not block reservation'; end if;

  v_dispute_order:=pg_temp.phase1e2_paid_order(v_course_id,now()-interval '15 days');
  v_allocation_id:=public.allocate_learning_order_commercial_terms(v_dispute_order); perform public.release_matured_learning_instructor_earnings(100,null);
  select earning.id into v_earning_id from public.learning_instructor_earnings earning where earning.allocation_id=v_allocation_id;
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(v_dispute_order,'chargeback','opened',10000,'NGN','paystack','phase1e2-dispute','awaiting-merchant-feedback');
  v_blocked:=false; begin perform public.reserve_learning_instructor_earning(v_earning_id,v_instructor_id,'phase1e2:dispute',v_admin_id); exception when invalid_parameter_value then v_blocked:=true; end;
  if not v_blocked then raise exception 'Unresolved dispute did not block reservation'; end if;

  v_chargeback_order:=pg_temp.phase1e2_paid_order(v_course_id,now()-interval '15 days');
  v_allocation_id:=public.allocate_learning_order_commercial_terms(v_chargeback_order); perform public.release_matured_learning_instructor_earnings(100,null);
  select earning.id into v_earning_id from public.learning_instructor_earnings earning where earning.allocation_id=v_allocation_id;
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(v_chargeback_order,'chargeback','action_required',10000,'NGN','paystack','phase1e2-chargeback','awaiting-merchant-feedback');
  v_blocked:=false; begin perform public.reserve_learning_instructor_earning(v_earning_id,v_instructor_id,'phase1e2:chargeback',v_admin_id); exception when invalid_parameter_value then v_blocked:=true; end;
  if not v_blocked then raise exception 'Active chargeback protection did not block reservation'; end if;

  select pg_get_functiondef('public.reserve_learning_instructor_earning(bigint,uuid,text,uuid)'::regprocedure) into v_function_definition;
  if v_function_definition not like '%for update%' or v_function_definition not like '%share row exclusive%' or v_function_definition like '%p_amount%' or v_function_definition like '%p_status%' then
    raise exception 'Reservation function does not retain server-authoritative locking and economic inputs';
  end if;
end $test$;

set local role authenticated;
do $browser$
begin
  begin
    update public.learning_instructor_earning_reservations
    set future_payout_item_reference='browser-link-attempt'
    where id=current_setting('phase1e2.reservation_id',true)::bigint;
    raise exception 'Browser role linked a payout reference';
  exception when insufficient_privilege then null;
  end;
end $browser$;
reset role;

rollback;
