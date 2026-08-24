create or replace function public.get_own_paystack_learning_payment_status(p_order_reference text)
returns table(order_status text,payment_status text,course_slug text,entitlement_active boolean)
language sql stable security definer set search_path to '' as $function$
 select o.status,a.status,c.slug,exists(select 1 from public.learning_course_entitlements e where e.order_id=o.id and e.status='active')
 from public.learning_orders o join public.learning_payment_attempts a on a.order_id=o.id left join public.learning_courses c on c.id=o.course_id
 where o.order_reference=p_order_reference and o.learner_id=auth.uid() and a.provider='paystack' order by a.id desc limit 1;
$function$;
revoke all on function public.get_own_paystack_learning_payment_status(text) from public,anon;
grant execute on function public.get_own_paystack_learning_payment_status(text) to authenticated,postgres,service_role;
