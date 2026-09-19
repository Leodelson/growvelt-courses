-- Forward-only repair for the reservation RPC's OUT-column name collision.
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
  definition := replace(
    definition,
    'if exists(select 1 from public.learning_instructor_earning_reservations where earning_id=earning_row.id) then',
    'if exists(select 1 from public.learning_instructor_earning_reservations reservation where reservation.earning_id=earning_row.id) then'
  );
  execute definition;
end $repair$;

commit;
