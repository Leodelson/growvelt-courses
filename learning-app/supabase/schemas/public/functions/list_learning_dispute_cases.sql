create or replace function public.list_learning_dispute_cases (
  p_operator_id uuid,
  p_order_id    bigint
)
  returns table (
    case_id              bigint,
    order_id             bigint,
    order_reference      text,
    status               text,
    amount_minor         bigint,
    currency             text,
    provider_case_id     text,
    provider_status      text,
    provider_resolution  text,
    dispute_category     text,
    dispute_reason       text,
    response_deadline_at timestamp with time zone,
    action_required_at   timestamp with time zone,
    opened_at            timestamp with time zone,
    resolved_at          timestamp with time zone
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
 if not public.is_learning_admin(p_operator_id) then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select c.id,c.order_id,o.order_reference,c.status,c.amount_minor,c.currency,c.provider_case_id,c.provider_status,c.provider_resolution,c.dispute_category,c.dispute_reason,c.response_deadline_at,c.action_required_at,c.opened_at,c.resolved_at
 from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id where c.case_type='chargeback' and (p_order_id is null or c.order_id=p_order_id) order by c.opened_at desc,c.id desc;
end;$function$;

grant execute on function "public"."list_learning_dispute_cases"(uuid, bigint) to "postgres", "service_role";

revoke all on function "public"."list_learning_dispute_cases"(uuid, bigint) from public;
