create or replace function public.capture_learning_security_audit_event()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  actor_id uuid := auth.uid();
  event_action text := tg_argv[0];
  event_entity_type text := tg_argv[1];
  event_entity_id text;
  event_metadata jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'account_capabilities' then
    event_entity_id := new.user_id::text || ':' || new.capability;
    event_metadata := jsonb_build_object('old_status', case when tg_op = 'INSERT' then null else old.status end, 'new_status', new.status);
  elsif tg_table_name = 'instructor_profiles' then
    event_entity_id := new.user_id::text;
    event_metadata := jsonb_build_object('old_status', old.approval_status, 'new_status', new.approval_status);
  elsif tg_table_name = 'learning_courses' then
    event_entity_id := new.id::text;
    event_metadata := jsonb_build_object('old_status', old.status, 'new_status', new.status);
  elsif tg_table_name = 'certificates' then
    event_entity_id := new.id::text;
    event_metadata := jsonb_build_object('status', new.status, 'certificate_code', new.certificate_code);
  else
    raise exception 'Unsupported learning audit source';
  end if;

  insert into public.learning_audit_events (actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values (actor_id, coalesce(auth.role(), 'database'), event_action, event_entity_type, event_entity_id, event_metadata);
  return new;
end;
$function$;

grant execute on function "public"."capture_learning_security_audit_event"() to "postgres", "service_role";

revoke all on function "public"."capture_learning_security_audit_event"() from public;
