create or replace function public.fail_paystack_test_learning_attempt(p_order_reference text,p_failure_code text,p_failure_message text) returns void
language plpgsql security definer set search_path to '' as $function$
declare order_key bigint; begin
 select id into order_key from public.learning_orders where order_reference=p_order_reference for update; if order_key is null then return; end if;
 update public.learning_payment_attempts set status='failed',failed_at=now(),failure_code=left(coalesce(p_failure_code,'initialization_failed'),100),failure_message=left(coalesce(p_failure_message,'Paystack initialization failed'),1000)
 where order_id=order_key and provider='paystack' and status in ('initialized','pending');
 update public.learning_orders set status='cancelled',cancelled_at=now() where id=order_key and status in ('created','payment_pending');
end;$function$;
revoke all on function public.fail_paystack_test_learning_attempt(text,text,text) from public,anon,authenticated;
grant execute on function public.fail_paystack_test_learning_attempt(text,text,text) to postgres,service_role;
