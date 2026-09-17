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
  admin_id uuid:='55555555-5555-4555-8555-555555555551';
  instructor_id uuid:='55555555-5555-4555-8555-555555555552';
  other_instructor_id uuid:='55555555-5555-4555-8555-555555555553';
  course_id bigint; order_id bigint; allocation_id bigint; earning_id bigint;
  reservation_one bigint; reservation_two bigint; before_ledger_count bigint; after_ledger_count bigint;
  refund_order bigint; dispute_order bigint; chargeback_order bigint; held_order bigint;
  blocked boolean; function_definition text;
begin
  if has_table_privilege('authenticated','public.learning_instructor_earning_reservations','select')
    or has_function_privilege('authenticated','public.reserve_learning_instructor_earning(bigint,uuid,text,uuid)','execute') then
    raise exception 'Browser role can access earnings reservation financial state';
  end if;

  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (admin_id,'authenticated','authenticated','phase1e2-admin@example.test',now(),now()),
    (instructor_id,'authenticated','authenticated','phase1e2-instructor@example.test',now(),now()),
    (other_instructor_id,'authenticated','authenticated','phase1e2-other@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (admin_id,'phase1e2-admin@example.test','Phase 1E2 Admin','complete'),
    (instructor_id,'phase1e2-instructor@example.test','Phase 1E2 Instructor','complete'),
    (other_instructor_id,'phase1e2-other@example.test','Phase 1E2 Other Instructor','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (admin_id,'admin','active'),(instructor_id,'instructor','active'),(other_instructor_id,'instructor','active') on conflict(user_id,capability) do nothing;
  insert into public.instructor_profiles(user_id,approval_status) values
    (instructor_id,'approved'),(other_instructor_id,'approved') on conflict(user_id) do nothing;
  insert into public.learning_courses(instructor_id,title,slug,price_amount,price_currency,is_free,is_limited_time_free,status)
  values(instructor_id,'Phase 1E2 reservation course','phase1e2-reservation-course',100,'NGN',false,false,'draft') on conflict(slug) do nothing;
  select id into course_id from public.learning_courses where slug='phase1e2-reservation-course';

  order_id:=pg_temp.phase1e2_paid_order(course_id,now()-interval '15 days');
  allocation_id:=public.allocate_learning_order_commercial_terms(order_id,null);
  if public.release_matured_learning_instructor_earnings(100,null)<>1 then raise exception 'Reservation fixture did not become available'; end if;
  select id into earning_id from public.learning_instructor_earnings where allocation_id=allocation_id and status='available';
  select count(*) into before_ledger_count from public.learning_ledger_transactions where order_id=order_id;

  select reservation_id into reservation_one from public.reserve_learning_instructor_earning(earning_id,instructor_id,'phase1e2:eligible:one',admin_id);
  select reservation_id into reservation_two from public.reserve_learning_instructor_earning(earning_id,instructor_id,'phase1e2:eligible:one',admin_id);
  select count(*) into after_ledger_count from public.learning_ledger_transactions where order_id=order_id;
  if reservation_one is null or reservation_two<>reservation_one
    or not exists(select 1 from public.learning_instructor_earning_reservations where id=reservation_one and earning_id=earning_id and allocation_id=allocation_id and instructor_id=instructor_id and amount_minor=7500 and status='reserved' and future_payout_item_reference is null)
    or not exists(select 1 from public.learning_instructor_earnings where id=earning_id and status='reserved')
    or (select count(*) from public.learning_instructor_earning_events where earning_id=earning_id and event_type='earning.reserved')<>1
    or before_ledger_count<>after_ledger_count then
    raise exception 'Eligible available earning was not reserved atomically and idempotently without ledger movement';
  end if;
  update public.learning_instructor_earning_reservations
  set future_payout_item_reference='phase1e3-payout-item-'||reservation_one::text
  where id=reservation_one;
  if not exists(select 1 from public.learning_instructor_earning_reservations where id=reservation_one and future_payout_item_reference='phase1e3-payout-item-'||reservation_one::text) then
    raise exception 'Privileged future payout reference linkage was not retained';
  end if;
  blocked:=false; begin
    update public.learning_instructor_earning_reservations set future_payout_item_reference='replacement-reference' where id=reservation_one;
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Future payout reference was replaced'; end if;
  blocked:=false; begin
    update public.learning_instructor_earning_reservations set future_payout_item_reference=null where id=reservation_one;
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Future payout reference was cleared'; end if;
  blocked:=false; begin
    update public.learning_instructor_earning_reservations set amount_minor=1 where id=reservation_one;
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Reservation economic fields were mutable'; end if;
  perform set_config('phase1e2.reservation_id',reservation_one::text,true);
  blocked:=false; begin perform public.reserve_learning_instructor_earning(earning_id,instructor_id,'phase1e2:eligible:second',admin_id); exception when unique_violation or invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'Already reserved earning accepted another reservation'; end if;
  blocked:=false; begin perform public.reserve_learning_instructor_earning(earning_id,other_instructor_id,'phase1e2:wrong-owner',admin_id); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Cross-instructor reservation was accepted'; end if;
  blocked:=false; begin perform public.reserve_learning_instructor_earning(earning_id,instructor_id,'phase1e2:non-admin',instructor_id); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Non-admin actor reserved an earning'; end if;

  held_order:=pg_temp.phase1e2_paid_order(course_id,now()-interval '1 day');
  allocation_id:=public.allocate_learning_order_commercial_terms(held_order,null);
  select id into earning_id from public.learning_instructor_earnings where allocation_id=allocation_id;
  blocked:=false; begin perform public.reserve_learning_instructor_earning(earning_id,instructor_id,'phase1e2:held',admin_id); exception when invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'Held earning was reserved'; end if;

  refund_order:=pg_temp.phase1e2_paid_order(course_id,now()-interval '15 days');
  allocation_id:=public.allocate_learning_order_commercial_terms(refund_order); perform public.release_matured_learning_instructor_earnings(100,null);
  select id into earning_id from public.learning_instructor_earnings where allocation_id=allocation_id;
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(refund_order,'refund','processing',10000,'NGN','paystack','phase1e2-refund','processing');
  blocked:=false; begin perform public.reserve_learning_instructor_earning(earning_id,instructor_id,'phase1e2:refund',admin_id); exception when invalid_parameter_value then blocked:=true; end;
  if not blocked or exists(select 1 from public.learning_instructor_earning_reservations where earning_id=earning_id) then raise exception 'Active refund did not block reservation'; end if;

  dispute_order:=pg_temp.phase1e2_paid_order(course_id,now()-interval '15 days');
  allocation_id:=public.allocate_learning_order_commercial_terms(dispute_order); perform public.release_matured_learning_instructor_earnings(100,null);
  select id into earning_id from public.learning_instructor_earnings where allocation_id=allocation_id;
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(dispute_order,'chargeback','opened',10000,'NGN','paystack','phase1e2-dispute','awaiting-merchant-feedback');
  blocked:=false; begin perform public.reserve_learning_instructor_earning(earning_id,instructor_id,'phase1e2:dispute',admin_id); exception when invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'Unresolved dispute did not block reservation'; end if;

  chargeback_order:=pg_temp.phase1e2_paid_order(course_id,now()-interval '15 days');
  allocation_id:=public.allocate_learning_order_commercial_terms(chargeback_order); perform public.release_matured_learning_instructor_earnings(100,null);
  select id into earning_id from public.learning_instructor_earnings where allocation_id=allocation_id;
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
  values(chargeback_order,'chargeback','action_required',10000,'NGN','paystack','phase1e2-chargeback','awaiting-merchant-feedback');
  blocked:=false; begin perform public.reserve_learning_instructor_earning(earning_id,instructor_id,'phase1e2:chargeback',admin_id); exception when invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'Active chargeback protection did not block reservation'; end if;

  select pg_get_functiondef('public.reserve_learning_instructor_earning(bigint,uuid,text,uuid)'::regprocedure) into function_definition;
  if function_definition not like '%for update%' or function_definition not like '%share row exclusive%' or function_definition like '%p_amount%' or function_definition like '%p_status%' then
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
