create or replace function public.mark_paystack_test_learning_attempt_pending(p_order_reference text) returns void
language plpgsql security definer set search_path to '' as $function$
declare order_key bigint; begin
 update public.learning_orders set status='payment_pending' where order_reference=p_order_reference and status='created' returning id into order_key;
 if order_key is null then raise exception 'Order cannot enter payment pending' using errcode='22023'; end if;
 update public.learning_payment_attempts set status='pending' where order_id=order_key and provider='paystack' and status='initialized';
 if not found then raise exception 'Payment attempt cannot enter pending' using errcode='22023'; end if;
end;$function$;
revoke all on function public.mark_paystack_test_learning_attempt_pending(text) from public,anon,authenticated;
grant execute on function public.mark_paystack_test_learning_attempt_pending(text) to postgres,service_role;
