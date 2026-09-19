-- Forward-only repair for duplicate durable-provider-receipt lookup.
begin;

do $repair$
declare definition text;
begin
  select pg_get_functiondef(
    'public.receive_paystack_test_transfer_provider_event(text,text,text,text,text,text,text,bigint,text,uuid)'::regprocedure
  ) into definition;
  if definition is null then
    raise exception 'Expected payout provider receipt function is missing';
  end if;
  if position('from public.learning_instructor_payout_provider_events provider_event where provider_event.provider_event_id=p_provider_event_id for update' in definition) > 0 then
    return;
  end if;
  if position('from public.learning_instructor_payout_provider_events where provider_event_id=p_provider_event_id for update' in definition) = 0 then
    raise exception 'Expected unqualified duplicate receipt lookup is missing';
  end if;
  definition := replace(
    definition,
    'from public.learning_instructor_payout_provider_events where provider_event_id=p_provider_event_id for update',
    'from public.learning_instructor_payout_provider_events provider_event where provider_event.provider_event_id=p_provider_event_id for update'
  );
  execute definition;
end $repair$;

commit;
