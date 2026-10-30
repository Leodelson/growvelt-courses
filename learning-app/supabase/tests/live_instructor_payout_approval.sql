begin;

create function pg_temp.live_approval_order(p_course_id bigint,p_domain text)
returns bigint language plpgsql as $function$
declare order_key bigint; capture_key bigint; course_row record;
begin
  select instructor_id,title into course_row from public.learning_courses where id=p_course_id;
  insert into public.learning_orders(instructor_id,course_id,course_title_snapshot,gross_amount_minor,currency,status,commercial_terms_version,paid_at)
    values(course_row.instructor_id,p_course_id,course_row.title,10000,'NGN','paid','growvelt-commercial-v1',now()-interval '15 days')
    returning id into order_key;
  insert into public.learning_payment_attempts(order_id,provider,provider_reference,amount_minor,currency,status,paystack_domain,verified_at)
    values(order_key,'paystack','live-approval-fixture-'||order_key::text,10000,'NGN','succeeded',p_domain,now());
  insert into public.learning_ledger_transactions(order_id,transaction_type,currency,description)
    values(order_key,'payment_capture','NGN','Rollback-only Live payout approval fixture') returning id into capture_key;
  insert into public.learning_ledger_entries(transaction_id,line_number,account_code,amount_minor,currency) values
    (capture_key,1,'asset.paystack_receivable',10000,'NGN'),
    (capture_key,2,'liability.marketplace_sales_unallocated',-10000,'NGN');
  return order_key;
end;$function$;

do $test$
declare admin_id uuid:='77777777-7777-4777-8777-777777777771';
        instructor_id uuid:='77777777-7777-4777-8777-777777777772';
        course_id bigint; order_key bigint; allocation_key bigint; earning_key bigint;
        reservation_key bigint; payout_item_key bigint; repeated_id bigint; test_order_id bigint;
        before_ledger bigint; after_ledger bigint; rejected boolean;
        receipt_key bigint; outcome_key text; otp_attempt_key bigint;
begin
  if has_function_privilege('authenticated','public.approve_learning_instructor_live_payout_item(bigint,text,uuid)','execute') then
    raise exception 'Browser role can approve a Live payout';
  end if;
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    (admin_id,'authenticated','authenticated','live-approval-admin@example.test',now(),now()),
    (instructor_id,'authenticated','authenticated','live-approval-instructor@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    (admin_id,'live-approval-admin@example.test','Fixture Admin','complete'),
    (instructor_id,'live-approval-instructor@example.test','Fixture Instructor','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    (admin_id,'admin','active'),(instructor_id,'instructor','active') on conflict(user_id,capability) do nothing;
  insert into public.instructor_profiles(user_id,approval_status) values
    (instructor_id,'approved') on conflict(user_id) do nothing;
  insert into public.learning_courses(instructor_id,title,slug,price_amount,price_currency,is_free,is_limited_time_free,status)
    values(instructor_id,'Live payout approval fixture','live-payout-approval-fixture',100,'NGN',false,false,'draft');
  select id into course_id from public.learning_courses where slug='live-payout-approval-fixture';
  perform public.create_learning_instructor_paystack_live_payout_profile(instructor_id,'RCP_livefixture1','777001','058','Fixture Bank','Fixture Instructor','1234',instructor_id);

  order_key:=pg_temp.live_approval_order(course_id,'live');
  allocation_key:=public.allocate_learning_order_commercial_terms(order_key,null);
  perform public.release_matured_learning_instructor_earnings(100,null);
  select earning.id into earning_key from public.learning_instructor_earnings earning where earning.allocation_id=allocation_key;
  select reservation_id into reservation_key from public.reserve_learning_instructor_earning(
    earning_key,instructor_id,'live-approval:reservation:1',admin_id);
  if not exists(select 1 from public.list_learning_instructor_live_payout_candidates(admin_id,100) candidate
    where candidate.reservation_id=reservation_key and candidate.amount_minor=7500) then
    raise exception 'Eligible Live reservation was not listed for administrator';
  end if;
  rejected:=false;
  begin perform public.list_learning_instructor_live_payout_candidates(instructor_id,100);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Instructor viewed Live payout candidates'; end if;
  select count(*) into before_ledger from public.learning_ledger_transactions ledger where ledger.order_id=order_key;
  select payout_item_id into payout_item_key from public.approve_learning_instructor_live_payout_item(
    reservation_key,'payout-live-approval:'||reservation_key::text,admin_id);
  select payout_item_id into repeated_id from public.approve_learning_instructor_live_payout_item(
    reservation_key,'payout-live-approval:'||reservation_key::text,admin_id);
  select count(*) into after_ledger from public.learning_ledger_transactions ledger where ledger.order_id=order_key;
  if payout_item_key is null or repeated_id<>payout_item_key or before_ledger<>after_ledger then
    raise exception 'Live approval is not idempotent or created a ledger movement';
  end if;
  if exists(select 1 from public.list_learning_instructor_live_payout_candidates(admin_id,100) candidate
    where candidate.reservation_id=reservation_key) then
    raise exception 'Approved Live reservation remained a candidate';
  end if;
  if not exists(select 1 from public.learning_instructor_payout_items item
    join public.learning_instructor_payout_profiles profile on profile.id=item.payout_profile_id
    where item.id=payout_item_key and item.status='approved' and item.provider_domain='live'
      and profile.provider_domain='live' and item.amount_minor=7500
      and item.provider_transfer_id is null and item.initiated_at is null) then
    raise exception 'Live approval item identity is invalid';
  end if;
  rejected:=false;
  begin perform public.begin_learning_instructor_test_transfer(payout_item_key,admin_id);
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected or exists(select 1 from public.learning_instructor_payout_items item
    where item.id=payout_item_key and (item.status<>'approved' or item.initiated_at is not null)) then
    raise exception 'Sandbox writer accepted or altered a Live payout item';
  end if;
  rejected:=false;
  begin perform public.approve_learning_instructor_live_payout_item(reservation_key,'payout-live-approval:'||reservation_key::text,instructor_id);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Instructor approved own payout'; end if;

  -- The Live writer uses only the approved identity, and a second submission
  -- cannot initiate another transfer even while the first is awaiting OTP.
  perform public.begin_learning_instructor_live_transfer(payout_item_key,admin_id);
  rejected:=false;
  begin perform public.begin_learning_instructor_live_transfer(payout_item_key,admin_id);
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'Duplicate Live transfer submission was allowed'; end if;
  perform public.record_learning_instructor_live_transfer_submission(
    payout_item_key,'777002','TRF_livesuccess','otp',admin_id);
  if not exists(select 1 from public.learning_instructor_payout_items item where item.id=payout_item_key
    and item.status='pending' and item.provider_status='otp' and item.provider_transfer_id='777002') then
    raise exception 'OTP-required Live transfer was treated as completed';
  end if;
  rejected:=false;
  begin perform public.mark_learning_instructor_live_transfer_recovery_required(payout_item_key,admin_id);
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'Known Live transfer was incorrectly marked unknown'; end if;
  select attempt_id into otp_attempt_key from public.begin_learning_instructor_live_otp_finalization(payout_item_key,admin_id);
  if otp_attempt_key is null or exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='learning_instructor_payout_live_otp_attempts'
      and column_name ilike '%otp%code%') then
    raise exception 'OTP attempt was not safely recorded';
  end if;
  rejected:=false;
  begin perform public.begin_learning_instructor_live_otp_finalization(payout_item_key,admin_id);
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'Duplicate OTP finalization attempt was allowed'; end if;
  perform public.complete_learning_instructor_live_otp_finalization(otp_attempt_key,'submitted',admin_id);
  rejected:=false;
  begin perform public.complete_learning_instructor_live_otp_finalization(otp_attempt_key,'submitted',admin_id);
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'OTP finalization outcome was mutable'; end if;

  -- A Test-domain receipt for a Live item must never settle the earning.
  select provider_event_id into receipt_key from public.receive_paystack_test_transfer_provider_event(
    'provider_api','test-cross-domain-'||payout_item_key::text,repeat('a',64),
    'lpi-live-reservation-'||reservation_key::text,'777001','TRF_testcrossdomain','succeeded',7500,'NGN',admin_id);
  select outcome into outcome_key from public.process_learning_instructor_payout_provider_event(receipt_key);
  if outcome_key<>'conflict' or exists(select 1 from public.learning_instructor_payout_settlements where payout_item_id=payout_item_key) then
    raise exception 'Cross-domain provider event settled a Live item';
  end if;

  -- Rollback-only simulation of a later authoritative provider success.
  select provider_event_id into receipt_key from public.receive_paystack_live_transfer_provider_event(
    'provider_api','live-success-'||payout_item_key::text,repeat('b',64),
    'lpi-live-reservation-'||reservation_key::text,'777002','TRF_livesuccess','succeeded',7500,'NGN',admin_id);
  select outcome into outcome_key from public.process_learning_instructor_payout_provider_event(receipt_key);
  if outcome_key<>'settled' or not exists(select 1 from public.learning_instructor_payout_settlements settlement
    where settlement.payout_item_id=payout_item_key and settlement.amount_minor=7500)
    or not exists(select 1 from public.learning_instructor_earnings earning
      where earning.id=earning_key and earning.status='paid') then
    raise exception 'Authoritative Live transfer outcome did not settle once';
  end if;
  select outcome into outcome_key from public.process_learning_instructor_payout_provider_event(receipt_key);
  select count(*) into after_ledger from public.learning_ledger_transactions ledger where ledger.order_id=order_key;
  if outcome_key<>'already_processed' or after_ledger<>before_ledger+1 then
    raise exception 'Live transfer outcome was not exactly once';
  end if;

  -- A timed-out provider request freezes the same item for verification;
  -- neither a second admin click nor an instructor can start another transfer.
  order_key:=pg_temp.live_approval_order(course_id,'live');
  allocation_key:=public.allocate_learning_order_commercial_terms(order_key,null);
  perform public.release_matured_learning_instructor_earnings(100,null);
  select earning.id into earning_key from public.learning_instructor_earnings earning where earning.allocation_id=allocation_key;
  select reservation_id into reservation_key from public.reserve_learning_instructor_earning(
    earning_key,instructor_id,'live-approval:reservation:unknown',admin_id);
  select payout_item_id into payout_item_key from public.approve_learning_instructor_live_payout_item(
    reservation_key,'payout-live-approval:'||reservation_key::text,admin_id);
  rejected:=false;
  begin perform public.begin_learning_instructor_live_transfer(payout_item_key,instructor_id);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Instructor could start a Live transfer'; end if;
  perform public.begin_learning_instructor_live_transfer(payout_item_key,admin_id);
  perform public.mark_learning_instructor_live_transfer_recovery_required(payout_item_key,admin_id);
  if not exists(select 1 from public.get_learning_instructor_live_transfer_for_recovery(payout_item_key,admin_id)
    where status='recovery_required' and provider_transfer_id is null) then
    raise exception 'Unknown Live submission was not retained for recovery';
  end if;
  rejected:=false;
  begin perform public.begin_learning_instructor_live_transfer(payout_item_key,admin_id);
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'Unknown Live transfer could be reinitiated'; end if;

  -- Pending evidence must not settle; a later authoritative failure can
  -- release only the still-eligible reserved earning, exactly once.
  order_key:=pg_temp.live_approval_order(course_id,'live');
  allocation_key:=public.allocate_learning_order_commercial_terms(order_key,null);
  perform public.release_matured_learning_instructor_earnings(100,null);
  select earning.id into earning_key from public.learning_instructor_earnings earning where earning.allocation_id=allocation_key;
  select reservation_id into reservation_key from public.reserve_learning_instructor_earning(
    earning_key,instructor_id,'live-approval:reservation:failed',admin_id);
  select payout_item_id into payout_item_key from public.approve_learning_instructor_live_payout_item(
    reservation_key,'payout-live-approval:'||reservation_key::text,admin_id);
  perform public.begin_learning_instructor_live_transfer(payout_item_key,admin_id);
  perform public.record_learning_instructor_live_transfer_submission(
    payout_item_key,'777004','TRF_livefailed','pending',admin_id);
  select count(*) into before_ledger from public.learning_ledger_transactions ledger where ledger.order_id=order_key;
  select provider_event_id into receipt_key from public.receive_paystack_live_transfer_provider_event(
    'provider_api','live-pending-'||payout_item_key::text,repeat('c',64),
    'lpi-live-reservation-'||reservation_key::text,'777004','TRF_livefailed','pending',7500,'NGN',admin_id);
  select outcome into outcome_key from public.process_learning_instructor_payout_provider_event(receipt_key);
  if outcome_key<>'recorded' or exists(select 1 from public.learning_instructor_payout_settlements
    where payout_item_id=payout_item_key) or not exists(select 1 from public.learning_instructor_earnings
    where id=earning_key and status='reserved') then
    raise exception 'Pending Live evidence incorrectly settled or released earnings';
  end if;
  select provider_event_id into receipt_key from public.receive_paystack_live_transfer_provider_event(
    'provider_api','live-failed-'||payout_item_key::text,repeat('d',64),
    'lpi-live-reservation-'||reservation_key::text,'777004','TRF_livefailed','failed',7500,'NGN',admin_id);
  select outcome into outcome_key from public.process_learning_instructor_payout_provider_event(receipt_key);
  select count(*) into after_ledger from public.learning_ledger_transactions ledger where ledger.order_id=order_key;
  if outcome_key<>'released' or after_ledger<>before_ledger
    or not exists(select 1 from public.learning_instructor_earnings where id=earning_key and status='available')
    or exists(select 1 from public.learning_instructor_payout_settlements where payout_item_id=payout_item_key) then
    raise exception 'Failed Live transfer did not safely release its reservation';
  end if;
  select outcome into outcome_key from public.process_learning_instructor_payout_provider_event(receipt_key);
  if outcome_key<>'already_processed' then raise exception 'Failed Live evidence was not idempotent'; end if;

  -- A financial case arriving after provider initiation blocks OTP completion.
  order_key:=pg_temp.live_approval_order(course_id,'live');
  allocation_key:=public.allocate_learning_order_commercial_terms(order_key,null);
  perform public.release_matured_learning_instructor_earnings(100,null);
  select earning.id into earning_key from public.learning_instructor_earnings earning where earning.allocation_id=allocation_key;
  select reservation_id into reservation_key from public.reserve_learning_instructor_earning(
    earning_key,instructor_id,'live-approval:reservation:otp-blocked',admin_id);
  select payout_item_id into payout_item_key from public.approve_learning_instructor_live_payout_item(
    reservation_key,'payout-live-approval:'||reservation_key::text,admin_id);
  perform public.begin_learning_instructor_live_transfer(payout_item_key,admin_id);
  perform public.record_learning_instructor_live_transfer_submission(
    payout_item_key,'777003','TRF_otprefundblocked','otp',admin_id);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
    values(order_key,'refund','needs_attention',10000,'NGN','paystack','live-otp-blocked-fixture','processing');
  rejected:=false;
  begin perform public.begin_learning_instructor_live_otp_finalization(payout_item_key,admin_id);
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected or exists(select 1 from public.learning_instructor_payout_live_otp_attempts attempt
    where attempt.payout_item_id=payout_item_key) then
    raise exception 'OTP finalization ignored active refund protection';
  end if;

  test_order_id:=pg_temp.live_approval_order(course_id,'test');
  allocation_key:=public.allocate_learning_order_commercial_terms(test_order_id,null);
  perform public.release_matured_learning_instructor_earnings(100,null);
  select earning.id into earning_key from public.learning_instructor_earnings earning where earning.allocation_id=allocation_key;
  select reservation_id into reservation_key from public.reserve_learning_instructor_earning(
    earning_key,instructor_id,'live-approval:reservation:2',admin_id);
  rejected:=false;
  begin perform public.approve_learning_instructor_live_payout_item(reservation_key,'payout-live-approval:'||reservation_key::text,admin_id);
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'Test purchase was approved for Live payout'; end if;

  order_key:=pg_temp.live_approval_order(course_id,'live');
  allocation_key:=public.allocate_learning_order_commercial_terms(order_key,null);
  perform public.release_matured_learning_instructor_earnings(100,null);
  select earning.id into earning_key from public.learning_instructor_earnings earning where earning.allocation_id=allocation_key;
  select reservation_id into reservation_key from public.reserve_learning_instructor_earning(
    earning_key,instructor_id,'live-approval:reservation:3',admin_id);
  insert into public.learning_payment_cases(order_id,case_type,status,amount_minor,currency,provider,provider_case_id,provider_status)
    values(order_key,'refund','needs_attention',10000,'NGN','paystack','live-approval-refund','processing');
  rejected:=false;
  begin perform public.approve_learning_instructor_live_payout_item(reservation_key,'payout-live-approval:'||reservation_key::text,admin_id);
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'Active refund did not block Live payout approval'; end if;
end $test$;

rollback;
