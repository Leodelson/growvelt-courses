create or replace function public.close_paystack_test_fixture (
  p_fixture_id  bigint,
  p_operator_id uuid,
  p_reason      text
)
  returns table (
    fixture_id bigint,
    course_id  bigint,
    status     text,
    closed_at  timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare fixture_row record; closed_time timestamptz := now(); normalized_reason text := btrim(p_reason);
begin
  if p_fixture_id is null or p_operator_id is null or char_length(normalized_reason) not between 3 and 500 then
    raise exception 'Fixture, operator, and closure reason are required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.account_capabilities capability where capability.user_id=p_operator_id and capability.capability='admin' and capability.status='active') then
    raise exception 'An active Growvelt Learning administrator is required' using errcode = '42501';
  end if;
  select fixture.* into fixture_row from public.learning_paystack_test_fixtures fixture where fixture.id=p_fixture_id and fixture.status='active' for update;
  if not found then raise exception 'Active test fixture was not found' using errcode = 'P0002'; end if;
  update public.learning_paystack_test_fixtures fixture set status='closed',closed_at=closed_time,closed_by=p_operator_id,close_reason=normalized_reason where fixture.id=p_fixture_id;
  update public.learning_courses course set status='archived',updated_at=closed_time where course.id=fixture_row.course_id and course.status='published';
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','paystack_test_fixture.closed','paystack_test_fixture',p_fixture_id::text,
    jsonb_build_object('course_id',fixture_row.course_id,'tester_id',fixture_row.tester_id,'reason',normalized_reason));
  return query select p_fixture_id,fixture_row.course_id,'closed'::text,closed_time;
end;$function$;

grant execute on function "public"."close_paystack_test_fixture"(bigint, uuid, text) to "postgres", "service_role";

revoke all on function "public"."close_paystack_test_fixture"(bigint, uuid, text) from public;
