create or replace function public.recover_paystack_test_refund_event (
  p_event_id    bigint,
  p_operator_id uuid
)
  returns table (
    outcome               text,
    order_id              bigint,
    ledger_transaction_id bigint
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare result_row record;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 select * into result_row from public.process_paystack_test_refund_event(p_event_id);
 return query select result_row.outcome,result_row.order_id,result_row.ledger_transaction_id;
end;$function$;

grant execute on function "public"."recover_paystack_test_refund_event"(bigint, uuid) to "postgres", "service_role";

revoke all on function "public"."recover_paystack_test_refund_event"(bigint, uuid) from public;
