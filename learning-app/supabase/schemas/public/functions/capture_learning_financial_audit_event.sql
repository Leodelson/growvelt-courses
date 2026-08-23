create or replace function public.capture_learning_financial_audit_event()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  insert into public.learning_audit_events (actor_user_id, actor_role, action, entity_type, entity_id, metadata)
  values (auth.uid(), coalesce(auth.role(), 'database'), tg_argv[0], tg_argv[1], new.id::text,
    jsonb_build_object('old_status', case when tg_op = 'INSERT' then null else old.status end, 'new_status', new.status));
  return new;
end;
$function$;
revoke all on function public.capture_learning_financial_audit_event() from public, anon, authenticated;
grant execute on function public.capture_learning_financial_audit_event() to postgres, service_role;
