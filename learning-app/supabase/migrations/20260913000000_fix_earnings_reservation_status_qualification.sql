-- Forward-only repair for the reservation RPC's OUT-column status collision.
begin;

do $repair$
declare definition text;
begin
  select pg_get_functiondef(
    'public.reserve_learning_instructor_earning(bigint,uuid,text,uuid)'::regprocedure
  ) into definition;
  if definition is null then
    raise exception 'Expected instructor earnings reservation function is missing';
  end if;
  if position('where earning.id=earning_row.id and earning.status=''available''' in definition) > 0 then
    return;
  end if;
  if position('where id=earning_row.id and status=''available''' in definition) = 0 then
    raise exception 'Expected unqualified reservation status guard is missing';
  end if;
  definition := replace(
    definition,
    'where id=earning_row.id and status=''available''',
    'where earning.id=earning_row.id and earning.status=''available'''
  );
  definition := replace(
    definition,
    'update public.learning_instructor_earnings' || chr(10) || '  set status=''reserved'',reserved_at=now(),hold_reason=''Reserved for a future controlled payout''',
    'update public.learning_instructor_earnings earning' || chr(10) || '  set status=''reserved'',reserved_at=now(),hold_reason=''Reserved for a future controlled payout'''
  );
  if position('update public.learning_instructor_earnings earning' in definition) = 0 then
    raise exception 'Expected reservation update alias could not be applied';
  end if;
  execute definition;
end $repair$;

commit;
