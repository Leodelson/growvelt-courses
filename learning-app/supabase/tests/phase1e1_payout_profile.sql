begin;

do $setup$
begin
  insert into auth.users(id,aud,role,email,created_at,updated_at) values
    ('33333333-3333-4333-8333-333333333331','authenticated','authenticated','phase1e1-instructor@example.test',now(),now()),
    ('33333333-3333-4333-8333-333333333332','authenticated','authenticated','phase1e1-other@example.test',now(),now()),
    ('33333333-3333-4333-8333-333333333333','authenticated','authenticated','phase1e1-admin@example.test',now(),now()) on conflict(id) do nothing;
  insert into public.profiles(id,email,full_name,onboarding_status) values
    ('33333333-3333-4333-8333-333333333331','phase1e1-instructor@example.test','Phase 1E1 Instructor','complete'),
    ('33333333-3333-4333-8333-333333333332','phase1e1-other@example.test','Phase 1E1 Other','complete'),
    ('33333333-3333-4333-8333-333333333333','phase1e1-admin@example.test','Phase 1E1 Admin','complete') on conflict(id) do nothing;
  insert into public.account_capabilities(user_id,capability,status) values
    ('33333333-3333-4333-8333-333333333331','instructor','active'),
    ('33333333-3333-4333-8333-333333333332','instructor','active'),
    ('33333333-3333-4333-8333-333333333333','admin','active') on conflict(user_id,capability) do nothing;
  insert into public.instructor_profiles(user_id,approval_status) values
    ('33333333-3333-4333-8333-333333333331','approved'),
    ('33333333-3333-4333-8333-333333333332','approved') on conflict(user_id) do nothing;
end$setup$;

do $service$
declare profile_id bigint; second_id bigint; before_captures bigint; after_captures bigint;
begin
  select count(*) into before_captures from public.learning_ledger_transactions where transaction_type='payment_capture';
  select payout_profile_id into profile_id from public.create_learning_instructor_paystack_test_payout_profile(
    '33333333-3333-4333-8333-333333333331','RCP_phase1e1test1','900001','058','Test Bank','Validated Instructor','0010','33333333-3333-4333-8333-333333333331');
  if profile_id is null or (select count(*) from public.learning_instructor_payout_profiles where instructor_id='33333333-3333-4333-8333-333333333331' and status='active')<>1 then raise exception 'Test recipient profile was not created'; end if;
  select payout_profile_id into second_id from public.create_learning_instructor_paystack_test_payout_profile(
    '33333333-3333-4333-8333-333333333331','RCP_phase1e1test1','900001','058','Test Bank','Validated Instructor','0010','33333333-3333-4333-8333-333333333331');
  if second_id<>profile_id or (select count(*) from public.learning_instructor_payout_profile_events where payout_profile_id=profile_id and event_type='payout_profile.created')<>1 then raise exception 'Recipient creation is not idempotent'; end if;
  begin perform public.create_learning_instructor_paystack_test_payout_profile('33333333-3333-4333-8333-333333333332','RCP_wrong_owner','900002','058','Test Bank','Wrong Owner','0011','33333333-3333-4333-8333-333333333331'); raise exception 'Cross-owner profile creation was accepted'; exception when insufficient_privilege then null; end;
  if not exists(select 1 from public.learning_instructor_payout_profiles where id=profile_id and provider_domain='test' and account_last4='0010') then raise exception 'Masked Test profile metadata is incorrect'; end if;
  if exists(select 1 from public.learning_instructor_payout_profiles where account_last4 like '%333333333331%') then raise exception 'Full account data was stored'; end if;
  if not public.disable_own_learning_instructor_paystack_test_payout_profile('33333333-3333-4333-8333-333333333331','33333333-3333-4333-8333-333333333331') then raise exception 'Profile disable failed'; end if;
  if (select status from public.learning_instructor_payout_profiles where id=profile_id)<>'disabled' then raise exception 'Profile lifecycle did not disable'; end if;
  select count(*) into after_captures from public.learning_ledger_transactions where transaction_type='payment_capture';
  if before_captures<>after_captures then raise exception 'Payout profile changed financial records'; end if;
end$service$;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333331',true);
do $owner$
begin
  if (select count(*) from public.get_own_learning_instructor_payout_profiles())<>1 then raise exception 'Owner profile visibility failed'; end if;
  if has_table_privilege('authenticated','public.learning_instructor_payout_profiles','select') or has_function_privilege('authenticated','public.create_learning_instructor_paystack_test_payout_profile(uuid,text,text,text,text,text,text,uuid)','execute') then raise exception 'Browser payout mutation/table access exposed'; end if;
end$owner$;

select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333332',true);
do $other$
begin
  if (select count(*) from public.get_own_learning_instructor_payout_profiles())<>0 then raise exception 'Instructor crossed payout-profile ownership boundary'; end if;
end$other$;

reset role;
do $admin$
begin
  if (select count(*) from public.list_learning_instructor_payout_profiles('33333333-3333-4333-8333-333333333333',100))<>1 then raise exception 'Admin payout-profile review failed'; end if;
  begin perform public.list_learning_instructor_payout_profiles('33333333-3333-4333-8333-333333333332',100); raise exception 'Non-admin payout review was accepted'; exception when insufficient_privilege then null; end;
end$admin$;

rollback;
