begin;
do $test$
declare definition text;
begin
  if not exists(select 1 from public.learning_payment_policy_settings where id and routine_refund_window_days=14 and routine_refund_progress_percent=20) then raise exception 'policy defaults missing'; end if;
  if has_table_privilege('anon','public.learning_payment_policy_settings','select') or has_table_privilege('authenticated','public.learning_payment_notifications','select') then raise exception 'browser financial policy/notification access granted'; end if;
  if exists(select 1 from pg_constraint where conrelid='public.learning_course_entitlements'::regclass and conname in ('learning_course_entitlements_learner_course_key','learning_course_entitlements_enrollment_id_key')) then raise exception 'historical entitlement uniqueness still blocks repurchase'; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='learning_course_entitlements_one_active_learner_course_key') then raise exception 'active entitlement uniqueness missing'; end if;
  select pg_get_functiondef('public.request_paystack_test_full_refund(text,uuid,uuid,text,text,text)'::regprocedure) into definition;
  if definition not like '%routine_refund_window_days%' or definition not like '%routine_refund_progress_percent%' or definition not like '%exceptional_admin_refund%' or definition not like '%certificates%' then raise exception 'refund policy enforcement incomplete'; end if;
  if has_function_privilege('anon','public.revoke_learning_certificate_for_financial_abuse(bigint,uuid,text)','execute') or has_function_privilege('authenticated','public.revoke_learning_certificate_for_financial_abuse(bigint,uuid,text)','execute') then raise exception 'browser certificate revocation allowed'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='certificates' and column_name='revocation_reason') then raise exception 'certificate revocation reason missing'; end if;
end $test$;
rollback;
