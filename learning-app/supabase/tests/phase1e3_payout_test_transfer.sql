begin;

do $test$
declare definition text;
begin
  if has_table_privilege('authenticated','public.learning_instructor_payout_items','select')
    or has_table_privilege('authenticated','public.learning_instructor_payout_item_events','insert')
    or has_function_privilege('authenticated','public.approve_learning_instructor_payout_item(bigint,text,uuid)','execute')
    or has_function_privilege('authenticated','public.begin_learning_instructor_test_transfer(bigint,uuid)','execute') then
    raise exception 'Browser role can access privileged Test payout transfer state';
  end if;
  select pg_get_functiondef('public.approve_learning_instructor_payout_item(bigint,text,uuid)'::regprocedure) into definition;
  if definition not like '%for update%' or definition not like '%share row exclusive%' or definition not like '%assert_learning_approved_instructor%' then
    raise exception 'Payout approval lost required locking or instructor protection';
  end if;
  select pg_get_functiondef('public.begin_learning_instructor_test_transfer(bigint,uuid)'::regprocedure) into definition;
  if definition not like '%status=''reserved''%' or definition not like '%share row exclusive%' or definition like '%p_amount%' then
    raise exception 'Test transfer submission lost server-authoritative financial protection';
  end if;
  select pg_get_functiondef('public.receive_paystack_test_transfer_event(text,text,text,text,text,text,bigint,text,jsonb)'::regprocedure) into definition;
  if definition not like '%''submitting'',''pending'',''recovery_required''%' or definition not like '%''financially_blocked''%' or definition not like '%provenance%''webhook''%' then
    raise exception 'Transfer webhook ordering or provenance protection is missing';
  end if;
  select pg_get_functiondef('public.record_learning_instructor_test_transfer_verification(bigint,text,text,text,uuid)'::regprocedure) into definition;
  if definition not like '%''provider_api''%' or definition not like '%Transfer identity mismatch%' then
    raise exception 'Provider verification recovery is not protected';
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.learning_instructor_payout_items'::regclass and contype='u') then
    raise exception 'Payout item uniqueness protections are missing';
  end if;
end $test$;

rollback;
