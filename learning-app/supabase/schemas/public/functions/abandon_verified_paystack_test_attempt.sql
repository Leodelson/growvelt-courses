create or replace function public.abandon_verified_paystack_test_attempt (
  p_order_reference text,
  p_operator_id     uuid,
  p_provider_status text,
  p_reason          text
)
  returns text
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare order_row record;
begin
  if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active')
  then raise exception 'Active administrator required' using errcode='42501'; end if;
  if p_provider_status not in ('abandoned','failed') then raise exception 'A conclusive non-success provider status is required' using errcode='22023'; end if;
  select o.id,o.status,a.id attempt_id,a.status attempt_status,a.initialized_at into order_row
  from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id and a.provider='paystack'
  where o.order_reference=p_order_reference for update of o,a;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if order_row.status not in ('created','payment_pending') or order_row.attempt_status not in ('initialized','pending')
  then return 'already_resolved'; end if;
  if order_row.initialized_at > now()-interval '30 minutes' then raise exception 'Checkout is not stale' using errcode='22023'; end if;
  update public.learning_payment_attempts set status='abandoned',failure_code='provider_'||p_provider_status,
    failure_message=left(coalesce(nullif(trim(p_reason),''),'Verified abandoned Paystack checkout'),1000)
  where id=order_row.attempt_id;
  update public.learning_orders set status='cancelled',cancelled_at=now() where id=order_row.id;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','payment_attempt.abandoned','learning_order',order_row.id::text,jsonb_build_object('provider_status',p_provider_status,'reason',left(coalesce(p_reason,''),500)));
  return 'abandoned';
end;$function$;

grant execute on function "public"."abandon_verified_paystack_test_attempt"(text, uuid, text, text) to "postgres", "service_role";

revoke all on function "public"."abandon_verified_paystack_test_attempt"(text, uuid, text, text) from public;
