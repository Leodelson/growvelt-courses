-- Phase 1A controlled test-fixture regression suite. Isolated local database only.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous) values
('11000000-0000-4000-a000-000000000001','authenticated','authenticated','tester@fixture.invalid','',now(),'{}','{"full_name":"Fixture Tester"}',now(),now(),false,false),
('11000000-0000-4000-a000-000000000002','authenticated','authenticated','outsider@fixture.invalid','',now(),'{}','{"full_name":"Fixture Outsider"}',now(),now(),false,false),
('11000000-0000-4000-a000-000000000003','authenticated','authenticated','teacher@fixture.invalid','',now(),'{}','{"full_name":"Fixture Instructor"}',now(),now(),false,false),
('11000000-0000-4000-a000-000000000004','authenticated','authenticated','admin@fixture.invalid','',now(),'{}','{"full_name":"Fixture Admin"}',now(),now(),false,false);

insert into public.instructor_profiles(user_id,headline,bio,approval_status,reviewed_at) values('11000000-0000-4000-a000-000000000003','Fixture Instructor','Local fixture instructor','approved',now());
insert into public.account_capabilities(user_id,capability,status) values
('11000000-0000-4000-a000-000000000003','instructor','active'),('11000000-0000-4000-a000-000000000004','admin','active');

insert into public.learning_courses(instructor_id,title,slug,summary,description,level,category,is_free,price_amount,price_currency,is_limited_time_free,status)
values('11000000-0000-4000-a000-000000000003','[TEST] Controlled Paystack Course','phase1a-paystack-test-controlled','A controlled paid course fixture','A complete local-only course used to test the controlled checkout fixture.','Beginner','Business',false,2500,'NGN',false,'draft');
select set_config('fixture.course',(select id::text from public.learning_courses where slug='phase1a-paystack-test-controlled'),true);
insert into public.course_modules(course_id,title,position) values(current_setting('fixture.course')::bigint,'Fixture module',1);
insert into public.lessons(course_id,module_id,title,lesson_type,content,is_preview,position)
values(current_setting('fixture.course')::bigint,(select id from public.course_modules where course_id=current_setting('fixture.course')::bigint),'Fixture lesson','text','A valid controlled fixture lesson.',true,1);

create temporary table activated_fixture as select * from public.activate_paystack_test_fixture(
  current_setting('fixture.course')::bigint,'11000000-0000-4000-a000-000000000001','11000000-0000-4000-a000-000000000004',now()+interval '1 hour','2026-08-v1','original');
select set_config('fixture.id',(select fixture_id::text from activated_fixture),true);

do $activation$
declare blocked boolean:=false;
begin
  if not exists(select 1 from public.learning_courses where id=current_setting('fixture.course')::bigint and status='published') then raise exception 'Activation did not publish controlled course'; end if;
  if not exists(select 1 from public.learning_audit_events where action='paystack_test_fixture.activated' and entity_id=current_setting('fixture.id')) then raise exception 'Activation audit missing'; end if;
  begin
    perform public.activate_paystack_test_fixture(current_setting('fixture.course')::bigint,'11000000-0000-4000-a000-000000000002','11000000-0000-4000-a000-000000000004',now()+interval '1 hour','2026-08-v1','original');
  exception when unique_violation then blocked:=true; end;
  if not blocked then raise exception 'Second active fixture was accepted'; end if;
  if has_function_privilege('authenticated','public.activate_paystack_test_fixture(bigint,uuid,uuid,timestamptz,text,text)','execute') then raise exception 'Browser can activate fixtures'; end if;
end$activation$;

set local role anon;
do $anonymous$
begin
  if exists(select 1 from public.learning_courses where id=current_setting('fixture.course')::bigint) then raise exception 'Anonymous direct table access exposed fixture'; end if;
  if exists(select 1 from public.get_published_learning_course_by_slug('phase1a-paystack-test-controlled')) then raise exception 'Anonymous detail RPC exposed fixture'; end if;
  if exists(select 1 from public.search_public_published_learning_courses(null,null,null,null,'newest',24,0) where course_id=current_setting('fixture.course')::bigint) then raise exception 'Public catalog exposed fixture'; end if;
end$anonymous$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','11000000-0000-4000-a000-000000000002',true);
do $outsider$
begin
  if exists(select 1 from public.get_published_learning_course_by_slug('phase1a-paystack-test-controlled')) then raise exception 'Outsider opened fixture'; end if;
  if (select eligible from public.get_own_paystack_test_fixture_eligibility(current_setting('fixture.course')::bigint)) then raise exception 'Outsider was eligible'; end if;
  if has_function_privilege('authenticated','public.initialize_paystack_test_learning_order(uuid,bigint)','execute') then raise exception 'Browser can initialize financial orders directly'; end if;
end$outsider$;
select set_config('request.jwt.claim.sub','11000000-0000-4000-a000-000000000001',true);
do $tester$
begin
  if not exists(select 1 from public.get_published_learning_course_by_slug('phase1a-paystack-test-controlled')) then raise exception 'Designated tester could not open fixture'; end if;
  if not (select eligible from public.get_own_paystack_test_fixture_eligibility(current_setting('fixture.course')::bigint)) then raise exception 'Designated tester was not eligible'; end if;
  if exists(select 1 from public.list_published_learning_courses(24,0) where course_id=current_setting('fixture.course')::bigint) then raise exception 'Authenticated catalog exposed fixture'; end if;
end$tester$;
reset role;

do $outsider_service_call$
declare blocked boolean:=false;
begin
  begin perform public.initialize_paystack_test_learning_order('11000000-0000-4000-a000-000000000002',current_setting('fixture.course')::bigint);
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Service-side outsider initialization was accepted'; end if;
end$outsider_service_call$;

create temporary table fixture_order as select * from public.initialize_paystack_test_learning_order('11000000-0000-4000-a000-000000000001',current_setting('fixture.course')::bigint);
do $order_check$ begin if (select amount_minor from fixture_order)<>250000 then raise exception 'Fixture order did not use server price'; end if; end$order_check$;

select * from public.close_paystack_test_fixture(current_setting('fixture.id')::bigint,'11000000-0000-4000-a000-000000000004','Controlled local test completed');
do $closure$
begin
  if not exists(select 1 from public.learning_paystack_test_fixtures where id=current_setting('fixture.id')::bigint and status='closed') then raise exception 'Fixture was not closed'; end if;
  if not exists(select 1 from public.learning_courses where id=current_setting('fixture.course')::bigint and status='archived') then raise exception 'Fixture course was not archived'; end if;
  if not exists(select 1 from public.learning_audit_events where action='paystack_test_fixture.closed' and entity_id=current_setting('fixture.id')) then raise exception 'Closure audit missing'; end if;
end$closure$;

rollback;
