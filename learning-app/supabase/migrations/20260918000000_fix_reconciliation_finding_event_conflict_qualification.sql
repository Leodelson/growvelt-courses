-- Forward-only repair for immutable reconciliation finding-event idempotency.
begin;

do $repair$
declare definition text;
begin
  select pg_get_functiondef(
    'public.open_learning_instructor_payout_finding(text,bigint,bigint,text,text)'::regprocedure
  ) into definition;
  if definition is null then
    raise exception 'Expected payout reconciliation finding function is missing';
  end if;
  if position('on conflict on constraint learning_instructor_payout_reconcilia_finding_id_event_type_key do nothing' in definition) > 0 then
    return;
  end if;
  if position('on conflict (finding_id,event_type) do nothing' in definition) = 0 then
    raise exception 'Expected finding-event conflict clause is missing';
  end if;
  definition := replace(
    definition,
    'on conflict (finding_id,event_type) do nothing',
    'on conflict on constraint learning_instructor_payout_reconcilia_finding_id_event_type_key do nothing'
  );
  execute definition;
end $repair$;

commit;
