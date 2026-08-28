create or replace function public.get_learning_dispute_case_for_recovery (
  p_operator_id uuid,
  p_case_id     bigint
)
  returns table (
    case_id          bigint,
    provider_case_id text,
    order_reference  text,
    amount_minor     bigint,
    currency         text
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
 if not public.is_learning_admin(p_operator_id) then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select c.id,c.provider_case_id,o.order_reference,c.amount_minor,c.currency from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 where c.id=p_case_id and c.case_type='chargeback' and c.status in('opened','action_required','submitted','under_review') and c.provider_case_id is not null;
end;$function$;

grant execute on function "public"."get_learning_dispute_case_for_recovery"(uuid, bigint) to "postgres", "service_role";

revoke all on function "public"."get_learning_dispute_case_for_recovery"(uuid, bigint) from public;
