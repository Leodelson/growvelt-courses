-- Forward-only repair: refer to the durable-receipt unique constraint by name
-- so the RPC's provider_event_id OUT column cannot shadow it.
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
  if position('on conflict on constraint learning_instructor_payout_provider_event_provider_event_id_key do nothing' in definition) > 0 then
    return;
  end if;
  if position('on conflict (provider_event_id) do nothing' in definition) = 0 then
    raise exception 'Expected durable-receipt conflict clause is missing';
  end if;
  definition := replace(
    definition,
    'on conflict (provider_event_id) do nothing',
    'on conflict on constraint learning_instructor_payout_provider_event_provider_event_id_key do nothing'
  );
  execute definition;
end $repair$;

commit;
