-- Phase 1A Paystack test-checkout database regression suite.
-- Runs only against the isolated local Docker database; all fixtures roll back.

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
) values
  ('10000000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'buyer-a@phase1a.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Phase 1A Buyer A"}', now(), now(), false, false),
  ('10000000-0000-4000-a000-000000000002', 'authenticated', 'authenticated', 'buyer-b@phase1a.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Phase 1A Buyer B"}', now(), now(), false, false),
  ('10000000-0000-4000-a000-000000000003', 'authenticated', 'authenticated', 'teacher@phase1a.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Phase 1A Instructor"}', now(), now(), false, false);

insert into public.instructor_profiles (user_id, headline, bio, approval_status, reviewed_at)
values ('10000000-0000-4000-a000-000000000003', 'Instructor', 'Phase 1A fixture', 'approved', now());
insert into public.account_capabilities (user_id, capability, status)
values ('10000000-0000-4000-a000-000000000003', 'instructor', 'active');

insert into public.learning_courses (
  instructor_id, title, slug, summary, description, level, category,
  is_free, price_amount, price_currency, is_limited_time_free, status
) values (
  '10000000-0000-4000-a000-000000000003', 'Phase 1A Paid Course', 'phase1a-paid-course',
  'Test-mode checkout fixture', 'A local-only paid-course fixture.',
  'Beginner', 'Business', false, 2500, 'NGN', false, 'published'
);
select set_config('phase1a.course', (select id::text from public.learning_courses where slug='phase1a-paid-course'), true);

create temporary table phase1a_order_a as
select * from public.initialize_paystack_test_learning_order(
  '10000000-0000-4000-a000-000000000001', current_setting('phase1a.course')::bigint
);
select set_config('phase1a.reference_a', (select order_reference from phase1a_order_a), true);

do $initialization$
begin
  if (select amount_minor from phase1a_order_a) <> 250000 then raise exception 'Server price was not converted to minor units'; end if;
  if (select currency from phase1a_order_a) <> 'NGN' then raise exception 'Order currency was not server-authoritative NGN'; end if;
  if not exists (
    select 1 from public.learning_orders
    where id=(select order_id from phase1a_order_a)
      and learner_id='10000000-0000-4000-a000-000000000001'
      and course_title_snapshot='Phase 1A Paid Course'
      and gross_amount_minor=250000 and commercial_terms_version='phase1a-test-v1'
  ) then raise exception 'Order snapshots were not captured'; end if;
  if not exists (
    select 1 from public.learning_payment_attempts
    where id=(select payment_attempt_id from phase1a_order_a)
      and provider='paystack' and status='initialized' and amount_minor=250000
  ) then raise exception 'Paystack attempt was not initialized'; end if;
end
$initialization$;

select public.mark_paystack_test_learning_attempt_pending(current_setting('phase1a.reference_a'));

create temporary table phase1a_result_a as
select * from public.finalize_paystack_test_charge(
  'charge.success:123456', repeat('a',64), current_setting('phase1a.reference_a'),
  '123456', 250000, 'NGN', 'test',
  '{"transaction_id":"123456","amount":250000,"currency":"NGN","domain":"test","status":"success"}'::jsonb
);

do $finalization$
declare ledger_id bigint;
begin
  if (select outcome from phase1a_result_a) <> 'paid_and_enrolled' then raise exception 'Verified event did not finalize'; end if;
  if not exists (select 1 from public.learning_orders where id=(select order_id from phase1a_order_a) and status='paid' and paid_at is not null) then raise exception 'Order was not paid'; end if;
  if not exists (select 1 from public.learning_payment_attempts where id=(select payment_attempt_id from phase1a_order_a) and status='succeeded' and provider_transaction_id='123456') then raise exception 'Attempt was not verified'; end if;
  if not exists (select 1 from public.enrollments where learner_id='10000000-0000-4000-a000-000000000001' and course_id=current_setting('phase1a.course')::bigint and status='active') then raise exception 'Enrollment was not created'; end if;
  if not exists (select 1 from public.learning_course_entitlements where order_id=(select order_id from phase1a_order_a) and status='active') then raise exception 'Entitlement was not created'; end if;
  select id into ledger_id from public.learning_ledger_transactions where order_id=(select order_id from phase1a_order_a) and transaction_type='payment_capture';
  if ledger_id is null or (select count(*) from public.learning_ledger_entries where transaction_id=ledger_id)<>2 or (select sum(amount_minor) from public.learning_ledger_entries where transaction_id=ledger_id)<>0 then raise exception 'Capture ledger is not exactly balanced'; end if;
end
$finalization$;

create temporary table phase1a_replay as
select * from public.finalize_paystack_test_charge(
  'charge.success:123456', repeat('a',64), current_setting('phase1a.reference_a'),
  '123456', 250000, 'NGN', 'test', '{}'::jsonb
);

do $idempotency$
declare blocked boolean := false;
begin
  if (select outcome from phase1a_replay) <> 'already_processed' then raise exception 'Webhook replay was not idempotent'; end if;
  if (select count(*) from public.learning_ledger_transactions where order_id=(select order_id from phase1a_order_a) and transaction_type='payment_capture')<>1 then raise exception 'Replay duplicated ledger capture'; end if;
  if (select count(*) from public.enrollments where learner_id='10000000-0000-4000-a000-000000000001' and course_id=current_setting('phase1a.course')::bigint)<>1 then raise exception 'Replay duplicated enrollment'; end if;
  begin
    perform public.initialize_paystack_test_learning_order('10000000-0000-4000-a000-000000000001',current_setting('phase1a.course')::bigint);
  exception when unique_violation then blocked:=true;
  end;
  if not blocked then raise exception 'Duplicate paid purchase was accepted'; end if;
end
$idempotency$;

create temporary table phase1a_order_b as
select * from public.initialize_paystack_test_learning_order(
  '10000000-0000-4000-a000-000000000002', current_setting('phase1a.course')::bigint
);
select set_config('phase1a.reference_b', (select order_reference from phase1a_order_b), true);
create temporary table phase1a_mismatch as
select * from public.finalize_paystack_test_charge(
  'charge.success:654321', repeat('b',64), current_setting('phase1a.reference_b'),
  '654321', 1, 'NGN', 'test', '{}'::jsonb
);

do $mismatch$
begin
  if (select outcome from phase1a_mismatch) <> 'amount_mismatch' then raise exception 'Amount mismatch was not rejected'; end if;
  if exists (select 1 from public.enrollments where learner_id='10000000-0000-4000-a000-000000000002' and course_id=current_setting('phase1a.course')::bigint) then raise exception 'Mismatch granted enrollment'; end if;
  if exists (select 1 from public.learning_course_entitlements where learner_id='10000000-0000-4000-a000-000000000002' and course_id=current_setting('phase1a.course')::bigint) then raise exception 'Mismatch granted entitlement'; end if;
end
$mismatch$;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-a000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $isolation$
begin
  if (select count(*) from public.get_own_paystack_learning_payment_status(current_setting('phase1a.reference_a')))<>1 then raise exception 'Owner could not read payment status'; end if;
  if (select count(*) from public.get_own_paystack_learning_payment_status(current_setting('phase1a.reference_b')))<>0 then raise exception 'Learner read another payment status'; end if;
  if has_function_privilege('authenticated','public.initialize_paystack_test_learning_order(uuid,bigint)','EXECUTE')
    or has_function_privilege('authenticated','public.finalize_paystack_test_charge(text,text,text,text,bigint,text,text,jsonb)','EXECUTE')
  then raise exception 'Browser role can execute server financial RPCs'; end if;
end
$isolation$;

reset role;

do $reconciliation$
begin
  if exists (select 1 from public.reconcile_paystack_test_learning_payments() where order_reference=current_setting('phase1a.reference_a')) then raise exception 'Healthy paid order appeared in reconciliation'; end if;
  if not exists (select 1 from public.reconcile_paystack_test_learning_payments() where order_reference=current_setting('phase1a.reference_b')) then raise exception 'Failed amount mismatch was not reconcilable'; end if;
end
$reconciliation$;

rollback;
