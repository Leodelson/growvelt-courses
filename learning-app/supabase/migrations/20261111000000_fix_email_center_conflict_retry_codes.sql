-- PostgREST 14 retries SQLSTATE 40001. Optimistic revision/consent conflicts
-- are permanent until the operator reloads, not serialization failures.
-- Preserve current definitions, security attributes, grants and all data.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
do $repair$
declare signature text; definition text;
begin
  foreach signature in array array[
    'public.save_learning_email_center_draft(uuid,uuid,integer,jsonb)',
    'public.review_learning_email_center_draft(uuid,uuid,integer)',
    'public.claim_learning_email_center_attempt(uuid,uuid,integer,text)',
    'public.complete_learning_email_center_attempt(uuid,uuid,text,text,text)',
    'public.reserve_learning_email_center_budget(uuid,uuid,integer,text)',
    'public.read_learning_email_center_review(uuid,uuid,integer)',
    'public.approve_learning_email_release(uuid,uuid,integer,jsonb)',
    'public.advance_learning_email_broadcast(uuid,uuid,text,text,uuid,text)'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'Email Center repair prerequisite missing: %',signature;
    end if;
    definition:=pg_get_functiondef(to_regprocedure(signature));
    if position('''40001''' in definition)>0 then
      execute replace(definition,'''40001''','''PT409''');
    elsif position('''PT409''' in definition)=0 then
      raise exception 'Unexpected Email Center function definition: %',signature;
    end if;
  end loop;
end $repair$;
commit;
