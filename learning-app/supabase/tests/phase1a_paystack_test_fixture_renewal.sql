-- Phase 1A fixture-renewal regression suite. Isolated local database only.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous) values
('12000000-0000-4000-a000-000000000001','authenticated','authenticated','renew-tester@fixture.invalid','',now(),'{}','{"full_name":"Renewal Tester"}',now(),now(),false,false),
('12000000-0000-4000-a000-000000000002','authenticated','authenticated','renew-outsider@fixture.invalid','',now(),'{}','{"full_name":"Renewal Outsider"}',now(),now(),false,false),
('12000000-0000-4000-a000-000000000003','authenticated','authenticated','renew-teacher@fixture.invalid','',now(),'{}','{"full_name":"Renewal Instructor"}',now(),now(),false,false),
('12000000-0000-4000-a000-000000000004','authenticated','authenticated','renew-admin@fixture.invalid','',now(),'{}','{"full_name":"Renewal Admin"}',now(),now(),false,false);

insert into public.instructor_profiles(user_id,headline,bio,approval_status,reviewed_at)
values('12000000-0000-4000-a000-000000000003','Renewal Instructor','Local renewal instructor','approved',now());
insert into public.account_capabilities(user_id,capability,status) values
('12000000-0000-4000-a000-000000000003','instructor','active'),
('12000000-0000-4000-a000-000000000004','admin','active');

insert into public.learning_courses(instructor_id,title,slug,summary,description,level,category,is_free,price_amount,price_currency,is_limited_time_free,status,published_at)
values('12000000-0000-4000-a000-000000000003','[TEST] Renewable Paystack Course','phase1a-paystack-test-renewable','A renewable paid course fixture','A complete local-only course used to test guarded controlled-window renewal.','Beginner','Business',false,100,'NGN',false,'published',now()-interval '2 hours');
select set_config('renew.course',(select id::text from public.learning_courses where slug='phase1a-paystack-test-renewable'),true);
insert into public.course_modules(course_id,title,position) values(current_setting('renew.course')::bigint,'Renewal module',1);
insert into public.lessons(course_id,module_id,title,lesson_type,content,is_preview,position)
values(current_setting('renew.course')::bigint,(select id from public.course_modules where course_id=current_setting('renew.course')::bigint),'Renewal lesson','text','A valid controlled renewal lesson.',true,1);
insert into public.course_rights_declarations(course_id,instructor_id,declaration_version,rights_basis,accepted_at)
values(current_setting('renew.course')::bigint,'12000000-0000-4000-a000-000000000003','2026-08-v1','original',now()-interval '2 hours');
insert into public.learning_paystack_test_fixtures(course_id,tester_id,status,activated_at,expires_at,activated_by)
values(current_setting('renew.course')::bigint,'12000000-0000-4000-a000-000000000001','active',now()-interval '2 hours',now()-interval '1 hour','12000000-0000-4000-a000-000000000004');
select set_config('renew.previous',(select id::text from public.learning_paystack_test_fixtures where course_id=current_setting('renew.course')::bigint),true);

create temporary table renewed_fixture as
select * from public.renew_paystack_test_fixture(
  current_setting('renew.previous')::bigint,
  '12000000-0000-4000-a000-000000000004',
  now()+interval '2 hours'
);
select set_config('renew.current',(select fixture_id::text from renewed_fixture),true);

do $positive$
begin
  if not exists(
    select 1 from public.learning_paystack_test_fixtures
    where id=current_setting('renew.previous')::bigint and status='closed'
      and activated_at<expires_at and expires_at<closed_at
      and close_reason='Expired fixture window closed during guarded renewal'
  ) then raise exception 'Expired fixture history was not closed and preserved'; end if;
  if not exists(
    select 1 from public.learning_paystack_test_fixtures
    where id=current_setting('renew.current')::bigint
      and previous_fixture_id=current_setting('renew.previous')::bigint
      and course_id=current_setting('renew.course')::bigint
      and tester_id='12000000-0000-4000-a000-000000000001'
      and status='active' and expires_at>now()
  ) then raise exception 'Renewed fixture successor is invalid'; end if;
  if (select count(*) from public.course_rights_declarations where course_id=current_setting('renew.course')::bigint)<>2 then raise exception 'Renewal rights snapshot missing'; end if;
  if not exists(select 1 from public.learning_audit_events where action='paystack_test_fixture.expired' and entity_id=current_setting('renew.previous')) then raise exception 'Expiry audit missing'; end if;
  if not exists(select 1 from public.learning_audit_events where action='paystack_test_fixture.renewed' and entity_id=current_setting('renew.current')) then raise exception 'Renewal audit missing'; end if;
  if not exists(select 1 from public.learning_audit_events where action='paystack_test_fixture.activated' and entity_id=current_setting('renew.current')) then raise exception 'Renewal activation audit missing'; end if;
  if not exists(select 1 from public.learning_courses where id=current_setting('renew.course')::bigint and status='published') then raise exception 'Renewed course was not published'; end if;
  if has_function_privilege('authenticated','public.renew_paystack_test_fixture(bigint,uuid,timestamptz)','execute') then raise exception 'Browser can renew fixtures'; end if;
  if not has_function_privilege('service_role','public.renew_paystack_test_fixture(bigint,uuid,timestamptz)','execute') then raise exception 'Service renewal grant missing'; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='learning_paystack_test_fixtures_one_active_key' and indexdef like '%UNIQUE%') then raise exception 'Global one-active concurrency index missing'; end if;
  if position('pg_advisory_xact_lock' in pg_get_functiondef('public.renew_paystack_test_fixture(bigint,uuid,timestamptz)'::regprocedure))=0 then raise exception 'Renewal advisory lock missing'; end if;
end$positive$;

set local role anon;
do $anonymous$
begin
  if exists(select 1 from public.get_published_learning_course_by_slug('phase1a-paystack-test-renewable')) then raise exception 'Anonymous detail RPC exposed renewed fixture'; end if;
  if exists(select 1 from public.search_public_published_learning_courses(null,null,null,null,'newest',24,0) where course_id=current_setting('renew.course')::bigint) then raise exception 'Public catalog exposed renewed fixture'; end if;
end$anonymous$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','12000000-0000-4000-a000-000000000002',true);
do $outsider$
begin
  if (select eligible from public.get_own_paystack_test_fixture_eligibility(current_setting('renew.course')::bigint)) then raise exception 'Outsider became eligible after renewal'; end if;
end$outsider$;
select set_config('request.jwt.claim.sub','12000000-0000-4000-a000-000000000001',true);
do $tester$
begin
  if not (select eligible from public.get_own_paystack_test_fixture_eligibility(current_setting('renew.course')::bigint)) then raise exception 'Designated tester lost eligibility after renewal'; end if;
  if exists(select 1 from public.list_published_learning_courses(24,0) where course_id=current_setting('renew.course')::bigint) then raise exception 'Authenticated catalog exposed renewed fixture'; end if;
end$tester$;
reset role;

do $negative$
declare blocked boolean;
begin
  blocked:=false;
  begin
    perform public.renew_paystack_test_fixture(current_setting('renew.previous')::bigint,'12000000-0000-4000-a000-000000000004',now()+interval '2 hours');
  exception when unique_violation then blocked:=true; end;
  if not blocked then raise exception 'A second successor for one historical fixture was accepted'; end if;

  blocked:=false;
  begin
    perform public.renew_paystack_test_fixture(current_setting('renew.current')::bigint,'12000000-0000-4000-a000-000000000004',now()+interval '2 hours');
  exception when invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'An unexpired active fixture was renewed'; end if;

  blocked:=false;
  begin
    perform public.renew_paystack_test_fixture(current_setting('renew.current')::bigint,'12000000-0000-4000-a000-000000000002',now()+interval '2 hours');
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'A non-admin renewed a fixture'; end if;

  blocked:=false;
  begin
    update public.learning_paystack_test_fixtures set expires_at=expires_at+interval '1 hour' where id=current_setting('renew.previous')::bigint;
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Historical fixture expiry was mutable'; end if;

  blocked:=false;
  begin
    insert into public.learning_paystack_test_fixtures(course_id,tester_id,expires_at,activated_by)
    values(current_setting('renew.course')::bigint,'12000000-0000-4000-a000-000000000001',now()+interval '1 hour','12000000-0000-4000-a000-000000000004');
  exception when insufficient_privilege or unique_violation then blocked:=true; end;
  if not blocked then raise exception 'Direct historical-course activation bypassed renewal'; end if;
end$negative$;

-- Close the successful successor, then prove access history blocks any later renewal.
select * from public.close_paystack_test_fixture(current_setting('renew.current')::bigint,'12000000-0000-4000-a000-000000000004','Prepare local financial-history rejection test');
insert into public.enrollments(learner_id,course_id,status)
values('12000000-0000-4000-a000-000000000001',current_setting('renew.course')::bigint,'active');
do $history_block$
declare blocked boolean:=false;
begin
  begin
    perform public.renew_paystack_test_fixture(current_setting('renew.current')::bigint,'12000000-0000-4000-a000-000000000004',now()+interval '2 hours');
  exception when unique_violation then blocked:=true; end;
  if not blocked then raise exception 'Fixture renewal with enrollment history was accepted'; end if;
end$history_block$;

rollback;
