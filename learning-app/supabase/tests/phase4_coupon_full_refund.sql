-- Phase 4 rollback-only end-to-end coupon refund regression.
-- Executed by test-phase4-coupon-commercial-regression-local.mjs in an isolated local DB.

insert into auth.users(id,aud,role,email,created_at,updated_at)
values
('24111111-1111-4111-8111-111111111111','authenticated','authenticated','phase4-coupon-admin@example.test',now(),now()),
('24111111-1111-4111-8111-111111111112','authenticated','authenticated','phase4-coupon-instructor@example.test',now(),now()),
('24111111-1111-4111-8111-111111111113','authenticated','authenticated','phase4-coupon-learner@example.test',now(),now());
insert into public.profiles(id,email,full_name,onboarding_status) values
('24111111-1111-4111-8111-111111111111','phase4-coupon-admin@example.test','Phase 4 Coupon Admin','complete'),
('24111111-1111-4111-8111-111111111112','phase4-coupon-instructor@example.test','Phase 4 Coupon Instructor','complete'),
('24111111-1111-4111-8111-111111111113','phase4-coupon-learner@example.test','Phase 4 Coupon Learner','complete')
on conflict(id) do nothing;
insert into public.account_capabilities(user_id,capability,status) values
('24111111-1111-4111-8111-111111111111','admin','active'),
('24111111-1111-4111-8111-111111111112','instructor','active');

insert into public.learning_courses(instructor_id,title,slug,summary,description,category,level,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('24111111-1111-4111-8111-111111111112','[TEST] Phase 4 coupon refund','phase4-coupon-full-refund','Rollback-only coupon refund test','Synthetic local course for the Phase 4 financial regression','Testing','Beginner',false,100,'NGN',false,'published',now())
returning id as course_id \gset phase4_coupon_

insert into public.learning_paystack_test_fixtures(course_id,tester_id,expires_at,activated_by)
values(:phase4_coupon_course_id,'24111111-1111-4111-8111-111111111113',now()+interval '1 day','24111111-1111-4111-8111-111111111111');

insert into public.learning_promotion_coupons(code,discount_kind,discount_value,max_discount_minor,minimum_charge_minor,starts_at,ends_at,max_redemptions,created_by)
values('PHASE4REFUND10','fixed',1000,1000,1000,now()-interval '1 hour',now()+interval '1 day',1,'24111111-1111-4111-8111-111111111111')
returning id as coupon_id \gset phase4_coupon_
insert into public.learning_promotion_coupon_courses(coupon_id,course_id)
values(:phase4_coupon_coupon_id,:phase4_coupon_course_id);

select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','service_role',true);
select * from public.initialize_paystack_test_learning_order_with_coupon(
  '24111111-1111-4111-8111-111111111113',:phase4_coupon_course_id,'PHASE4REFUND10','24111111-1111-4111-8111-111111111114'
) \gset phase4_coupon_order_
select public.mark_paystack_test_learning_attempt_pending(:'phase4_coupon_order_order_reference');
select * from public.finalize_paystack_test_charge(
  'phase4-coupon-refund-charge',repeat('a',64),:'phase4_coupon_order_order_reference','phase4-coupon-refund-transaction',
  :phase4_coupon_order_amount_minor,'NGN','test',
  jsonb_build_object('transaction_id','phase4-coupon-refund-transaction','reference',:'phase4_coupon_order_order_reference','amount',:phase4_coupon_order_amount_minor,'currency','NGN','domain','test','status','success')
);
select set_config('phase4_coupon.order_reference',:'phase4_coupon_order_order_reference',true);
select id as coupon_refund_order_id from public.learning_orders where order_reference=:'phase4_coupon_order_order_reference' \gset phase4_coupon_

do $coupon_paid$
begin
  if not exists(select 1 from public.learning_orders where order_reference=current_setting('phase4_coupon.order_reference') and gross_amount_minor=9000 and status='paid') then
    raise exception 'Coupon order did not retain its discounted customer charge';
  end if;
  if not exists(select 1 from public.learning_commercial_allocations allocation
    join public.learning_orders orders on orders.id=allocation.order_id
    where orders.order_reference=current_setting('phase4_coupon.order_reference')
      and allocation.gross_amount_minor=9000 and allocation.platform_commission_minor=1500 and allocation.instructor_gross_minor=7500) then
    raise exception 'Seller/platform allocation did not use the preserved undiscounted seller share';
  end if;
  if not exists(select 1 from public.learning_promotion_redemptions redemption
    join public.learning_orders orders on orders.id=redemption.order_id
    where orders.order_reference=current_setting('phase4_coupon.order_reference')
      and redemption.status='consumed' and redemption.list_price_minor=10000
      and redemption.discount_minor=1000 and redemption.customer_charge_minor=9000
      and redemption.seller_share_minor=7500 and redemption.platform_share_minor=1500) then
    raise exception 'Successful coupon redemption snapshot is incomplete';
  end if;
end;$coupon_paid$;

select case_id as coupon_refund_case_id from public.request_paystack_test_full_refund(
  :'phase4_coupon_order_order_reference','24111111-1111-4111-8111-111111111111','24111111-1111-4111-8111-111111111115',
  :'phase4_coupon_order_order_reference','exceptional_admin_refund','Rollback-only discounted purchase refund regression'
) \gset phase4_coupon_
select set_config('phase4_coupon.refund_case_id',:'phase4_coupon_coupon_refund_case_id',true);
select public.mark_paystack_test_refund_submitting(:phase4_coupon_coupon_refund_case_id,'24111111-1111-4111-8111-111111111111');
select public.record_paystack_test_refund_submission(:phase4_coupon_coupon_refund_case_id,'phase4-coupon-refund-case','pending','phase4-coupon-refund-provider-reference','24111111-1111-4111-8111-111111111111');
select public.receive_paystack_test_verified_refund(
  :phase4_coupon_coupon_refund_case_id,'phase4-coupon-refund-case','processed','phase4-coupon-refund-provider-reference',
  9000,'NGN','test',jsonb_build_object('id','phase4-coupon-refund-case','refund_reference','phase4-coupon-refund-provider-reference',
    'transaction_reference',:'phase4_coupon_order_order_reference','amount',9000,'currency','NGN','domain','test','status','processed'),
  '24111111-1111-4111-8111-111111111111'
) as coupon_refund_event_id \gset phase4_coupon_
select * from public.recover_paystack_test_refund_event(:phase4_coupon_coupon_refund_event_id,'24111111-1111-4111-8111-111111111111');
select * from public.process_paystack_test_refund_event(:phase4_coupon_coupon_refund_event_id);

do $coupon_refunded$
declare refund_ledger_id bigint; seller_reversal_id bigint;
begin
  if not exists(select 1 from public.learning_orders where order_reference=current_setting('phase4_coupon.order_reference') and status='refunded') then
    raise exception 'Discounted purchase did not reach refunded status';
  end if;
  if not exists(select 1 from public.learning_payment_cases where id=current_setting('phase4_coupon.refund_case_id')::bigint and status='processed' and amount_minor=9000 and processed_amount_minor=9000) then
    raise exception 'Refund case amount does not match the customer charge';
  end if;
  select transaction.id into refund_ledger_id from public.learning_ledger_transactions transaction
    where transaction.payment_case_id=current_setting('phase4_coupon.refund_case_id')::bigint and transaction.transaction_type='refund';
  if refund_ledger_id is null
    or (select sum(amount_minor) from public.learning_ledger_entries where transaction_id=refund_ledger_id)<>0
    or not exists(select 1 from public.learning_ledger_entries where transaction_id=refund_ledger_id and account_code='liability.marketplace_sales_unallocated' and amount_minor=9000)
    or not exists(select 1 from public.learning_ledger_entries where transaction_id=refund_ledger_id and account_code='asset.paystack_receivable' and amount_minor=-9000) then
    raise exception 'Refund ledger does not exactly reverse the discounted customer payment';
  end if;
  select allocation.reversal_ledger_transaction_id into seller_reversal_id
    from public.learning_commercial_allocations allocation join public.learning_orders orders on orders.id=allocation.order_id
    where orders.order_reference=current_setting('phase4_coupon.order_reference') and allocation.status='reversed'
      and allocation.gross_amount_minor=9000 and allocation.platform_commission_minor=1500 and allocation.instructor_gross_minor=7500;
  if seller_reversal_id is null
    or (select sum(amount_minor) from public.learning_ledger_entries where transaction_id=seller_reversal_id)<>0
    or not exists(select 1 from public.learning_instructor_earnings earning join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
      join public.learning_orders orders on orders.id=allocation.order_id
      where orders.order_reference=current_setting('phase4_coupon.order_reference') and earning.status='reversed' and earning.gross_amount_minor=7500) then
    raise exception 'Seller proceeds were not reversed consistently after the full refund';
  end if;
  if (select count(*) from public.learning_ledger_transactions where payment_case_id=current_setting('phase4_coupon.refund_case_id')::bigint and transaction_type='refund')<>1
    or (select count(*) from public.learning_ledger_transactions where payment_case_id=current_setting('phase4_coupon.refund_case_id')::bigint and transaction_type='instructor_earnings_reversal')<>1 then
    raise exception 'Refund replay created duplicate financial reversals';
  end if;
  if not exists(select 1 from public.learning_promotion_redemptions redemption join public.learning_orders orders on orders.id=redemption.order_id
    where orders.order_reference=current_setting('phase4_coupon.order_reference') and redemption.status='consumed') then
    raise exception 'Processed refund incorrectly restored the coupon redemption';
  end if;
  if not exists(select 1 from public.learning_course_entitlements entitlement join public.learning_orders orders on orders.id=entitlement.order_id
    where orders.order_reference=current_setting('phase4_coupon.order_reference') and entitlement.status='refunded' and entitlement.revoked_at is not null) then
    raise exception 'Refund did not revoke course access';
  end if;
end;$coupon_refunded$;

-- A distinct coupon on a second controlled fixture proves a lost-dispute
-- callback reverses the discounted customer charge and the preserved seller share.
-- The test-fixture control allows one active fixture at a time, so close the
-- first synthetic fixture and create another synthetic course for this case.
update public.learning_paystack_test_fixtures
set status='closed',closed_at=now(),closed_by='24111111-1111-4111-8111-111111111111',close_reason='Completed rollback-only Phase 4 refund fixture'
where course_id=:phase4_coupon_course_id and status='active';
insert into public.learning_courses(instructor_id,title,slug,summary,description,category,level,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('24111111-1111-4111-8111-111111111112','[TEST] Phase 4 coupon dispute','phase4-coupon-lost-dispute','Rollback-only coupon dispute test','Synthetic local course for the Phase 4 dispute regression','Testing','Beginner',false,100,'NGN',false,'published',now())
returning id as course_id \gset phase4_dispute_
insert into public.learning_paystack_test_fixtures(course_id,tester_id,expires_at,activated_by)
values(:phase4_dispute_course_id,'24111111-1111-4111-8111-111111111113',now()+interval '1 day','24111111-1111-4111-8111-111111111111');

insert into public.learning_promotion_coupons(code,discount_kind,discount_value,max_discount_minor,minimum_charge_minor,starts_at,ends_at,max_redemptions,created_by)
values('PHASE4DISPUTE10','fixed',1000,1000,1000,now()-interval '1 hour',now()+interval '1 day',1,'24111111-1111-4111-8111-111111111111')
returning id as coupon_id \gset phase4_dispute_coupon_
insert into public.learning_promotion_coupon_courses(coupon_id,course_id)
values(:phase4_dispute_coupon_coupon_id,:phase4_dispute_course_id);

select * from public.initialize_paystack_test_learning_order_with_coupon(
  '24111111-1111-4111-8111-111111111113',:phase4_dispute_course_id,'PHASE4DISPUTE10','24111111-1111-4111-8111-111111111116'
) \gset phase4_dispute_order_
select public.mark_paystack_test_learning_attempt_pending(:'phase4_dispute_order_order_reference');
select * from public.finalize_paystack_test_charge(
  'phase4-coupon-dispute-charge',repeat('b',64),:'phase4_dispute_order_order_reference','phase4-coupon-dispute-transaction',
  :phase4_dispute_order_amount_minor,'NGN','test',
  jsonb_build_object('transaction_id','phase4-coupon-dispute-transaction','reference',:'phase4_dispute_order_order_reference','amount',:phase4_dispute_order_amount_minor,'currency','NGN','domain','test','status','success')
);
select set_config('phase4_coupon.dispute_order_reference',:'phase4_dispute_order_order_reference',true);

select case_id as dispute_case_id,event_id as dispute_open_event_id
from public.receive_paystack_test_dispute_event(
  'phase4-coupon-dispute-open',repeat('c',64),'charge.dispute.create',:'phase4_dispute_order_order_reference',
  '900000099','awaiting-merchant-feedback',null,9000,'NGN','test','fraud','Rollback-only discounted purchase dispute regression',null,
  jsonb_build_object('id','900000099','status','awaiting-merchant-feedback','amount',9000,'currency','NGN','domain','test')
) \gset phase4_dispute_
select * from public.process_paystack_test_dispute_event(:phase4_dispute_dispute_open_event_id);
select event_id as dispute_resolution_event_id
from public.receive_paystack_test_dispute_event(
  'phase4-coupon-dispute-resolved',repeat('d',64),'charge.dispute.resolve',:'phase4_dispute_order_order_reference',
  '900000099','resolved','merchant-accepted',9000,'NGN','test','fraud','Rollback-only authoritative lost dispute',null,
  jsonb_build_object('id','900000099','status','resolved','resolution','merchant-accepted','amount',9000,'currency','NGN','domain','test')
) \gset phase4_dispute_
select * from public.process_paystack_test_dispute_event(:phase4_dispute_dispute_resolution_event_id);
select * from public.process_paystack_test_dispute_event(:phase4_dispute_dispute_resolution_event_id);

do $coupon_chargeback$
declare case_key bigint; reversal_key bigint; chargeback_key bigint;
begin
  select id into case_key from public.learning_payment_cases where provider_case_id='900000099' and case_type='chargeback';
  if not exists(select 1 from public.learning_orders where order_reference=current_setting('phase4_coupon.dispute_order_reference') and status='chargeback')
    or not exists(select 1 from public.learning_payment_cases where id=case_key and amount_minor=9000 and processed_amount_minor=9000 and status='lost' and provider_resolution='merchant-accepted') then
    raise exception 'Discounted lost dispute did not resolve at its exact captured amount';
  end if;
  select reversal_ledger_transaction_id into reversal_key from public.learning_commercial_allocations allocation
    join public.learning_orders orders on orders.id=allocation.order_id
    where orders.order_reference=current_setting('phase4_coupon.dispute_order_reference') and allocation.status='reversed'
      and allocation.gross_amount_minor=9000 and allocation.platform_commission_minor=1500 and allocation.instructor_gross_minor=7500;
  select id into chargeback_key from public.learning_ledger_transactions where payment_case_id=case_key and transaction_type='chargeback';
  if reversal_key is null or chargeback_key is null
    or (select sum(amount_minor) from public.learning_ledger_entries where transaction_id=reversal_key)<>0
    or (select sum(amount_minor) from public.learning_ledger_entries where transaction_id=chargeback_key)<>0
    or (select count(*) from public.learning_ledger_transactions where payment_case_id=case_key and transaction_type='instructor_earnings_reversal')<>1
    or not exists(select 1 from public.learning_instructor_earnings earning join public.learning_commercial_allocations allocation on allocation.id=earning.allocation_id
      join public.learning_orders orders on orders.id=allocation.order_id
      where orders.order_reference=current_setting('phase4_coupon.dispute_order_reference') and earning.status='reversed' and earning.gross_amount_minor=7500) then
    raise exception 'Discounted seller allocation was not reversed exactly once after the lost dispute';
  end if;
  if not exists(select 1 from public.learning_promotion_redemptions redemption join public.learning_orders orders on orders.id=redemption.order_id
    where orders.order_reference=current_setting('phase4_coupon.dispute_order_reference') and redemption.status='consumed')
    or not exists(select 1 from public.learning_course_entitlements entitlement join public.learning_orders orders on orders.id=entitlement.order_id
      where orders.order_reference=current_setting('phase4_coupon.dispute_order_reference') and entitlement.status='chargeback' and entitlement.revoked_at is not null)
    or exists(select 1 from public.reconcile_paystack_test_disputes() where order_reference=current_setting('phase4_coupon.dispute_order_reference')) then
    raise exception 'Lost dispute left the coupon, access, or dispute reconciliation in an inconsistent state';
  end if;
end;$coupon_chargeback$;
