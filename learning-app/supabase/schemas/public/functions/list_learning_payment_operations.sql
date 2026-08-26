create or replace function public.list_learning_payment_operations(p_operator_id uuid,p_query text default null,p_limit integer default 50)
returns table(order_id bigint,order_reference text,learner_email text,course_title text,amount_minor bigint,currency text,order_status text,attempt_status text,provider_transaction_id text,latest_event_id bigint,event_status text,recovery_status text,created_at timestamptz,issue_count bigint)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 return query select o.id,o.order_reference,p.email,o.course_title_snapshot,o.gross_amount_minor,o.currency,o.status,a.status,a.provider_transaction_id,ev.id,ev.processing_status,ev.recovery_status,o.created_at,(select count(*) from public.reconcile_paystack_test_learning_payments() r where r.order_reference=o.order_reference)
 from public.learning_orders o left join public.profiles p on p.id=o.learner_id
 left join lateral(select * from public.learning_payment_attempts x where x.order_id=o.id order by x.initialized_at desc,x.id desc limit 1) a on true
 left join lateral(select * from public.learning_payment_provider_events x where x.order_id=o.id order by x.received_at desc,x.id desc limit 1) ev on true
 where p_query is null or trim(p_query)='' or o.order_reference ilike '%'||trim(p_query)||'%' or coalesce(p.email,'') ilike '%'||trim(p_query)||'%' or o.course_title_snapshot ilike '%'||trim(p_query)||'%'
 order by o.created_at desc,o.id desc limit least(greatest(coalesce(p_limit,50),1),100);
end;$function$;
revoke all on function public.list_learning_payment_operations(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.list_learning_payment_operations(uuid,text,integer) to postgres,service_role;
