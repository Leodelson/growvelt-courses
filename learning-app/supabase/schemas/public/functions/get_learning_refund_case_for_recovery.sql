create or replace function public.get_learning_refund_case_for_recovery (
  p_operator_id uuid,
  p_case_id     bigint
)
  returns table (
    order_reference         text,
    provider_case_id        text,
    provider_transaction_id text
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active')
 then raise exception 'Active administrator required' using errcode='42501'; end if;
 return query
 select o.order_reference,c.provider_case_id,c.provider_transaction_id
 from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id
 where c.id=p_case_id and c.case_type='refund' and c.status in('pending','processing','needs_attention')
   and c.provider_case_id is not null and c.provider_transaction_id is not null;
end;$function$;

grant execute on function "public"."get_learning_refund_case_for_recovery"(uuid, bigint) to "postgres", "service_role";

revoke all on function "public"."get_learning_refund_case_for_recovery"(uuid, bigint) from public;
