create or replace function public.recover_paystack_test_charge_event (
  p_event_id    bigint,
  p_operator_id uuid
)
  returns table (
    outcome       text,
    order_id      bigint,
    enrollment_id bigint
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare result_row record;
begin
  if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active')
  then raise exception 'Active administrator required' using errcode='42501'; end if;
  select * into result_row from public.process_paystack_test_charge_event(p_event_id);
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','payment_provider_event.reprocessed','payment_provider_event',p_event_id::text,jsonb_build_object('outcome',result_row.outcome));
  return query select result_row.outcome,result_row.order_id,result_row.enrollment_id;
end;$function$;

grant execute on function "public"."recover_paystack_test_charge_event"(bigint, uuid) to "postgres", "service_role";

revoke all on function "public"."recover_paystack_test_charge_event"(bigint, uuid) from public;
