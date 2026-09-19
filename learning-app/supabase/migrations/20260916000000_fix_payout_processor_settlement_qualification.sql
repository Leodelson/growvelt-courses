-- Forward-only repair for the canonical E4 processor's payout_item_id OUT-column collision.
begin;

do $repair$
declare definition text;
begin
  select pg_get_functiondef(
    'public.process_learning_instructor_payout_provider_event(bigint)'::regprocedure
  ) into definition;
  if definition is null then
    raise exception 'Expected canonical payout provider-event processor is missing';
  end if;
  if position('from public.learning_instructor_payout_settlements settlement where settlement.payout_item_id=item.id for update' in definition) > 0 then
    return;
  end if;
  if position('from public.learning_instructor_payout_settlements where payout_item_id=item.id for update' in definition) = 0 then
    raise exception 'Expected unqualified payout settlement lookup is missing';
  end if;
  definition := replace(
    definition,
    'from public.learning_instructor_payout_settlements where payout_item_id=item.id for update',
    'from public.learning_instructor_payout_settlements settlement where settlement.payout_item_id=item.id for update'
  );
  execute definition;
end $repair$;

commit;
