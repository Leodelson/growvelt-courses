create or replace function public.protect_paystack_test_fixture_history()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare previous_row public.learning_paystack_test_fixtures%rowtype;
begin
  if tg_op='INSERT' then
    if new.previous_fixture_id is null then
      if exists(select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id=new.course_id) then
        raise exception 'A historical fixture course must be renewed through the guarded renewal function' using errcode='42501';
      end if;
    else
      select fixture.* into previous_row from public.learning_paystack_test_fixtures fixture where fixture.id=new.previous_fixture_id;
      if not found or previous_row.status<>'closed' or previous_row.course_id<>new.course_id
        or previous_row.tester_id<>new.tester_id or previous_row.expires_at>new.activated_at then
        raise exception 'Fixture successor must follow a closed, expired window for the same course and tester' using errcode='42501';
      end if;
    end if;
    return new;
  end if;
  if old.id is distinct from new.id or old.course_id is distinct from new.course_id
    or old.tester_id is distinct from new.tester_id or old.expires_at is distinct from new.expires_at
    or old.activated_at is distinct from new.activated_at or old.activated_by is distinct from new.activated_by
    or old.previous_fixture_id is distinct from new.previous_fixture_id then
    raise exception 'Fixture identity and window history are immutable' using errcode='42501';
  end if;
  if old.status='closed' or old.status<>'active' or new.status<>'closed' or new.closed_at is null
    or new.closed_by is null or char_length(btrim(new.close_reason)) not between 3 and 500 then
    raise exception 'Only the one-way active-to-closed fixture transition is permitted' using errcode='42501';
  end if;
  return new;
end;$function$;
revoke all on function public.protect_paystack_test_fixture_history() from public,anon,authenticated;
grant execute on function public.protect_paystack_test_fixture_history() to postgres,service_role;
