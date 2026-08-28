create or replace function public.list_learning_refund_cases(p_operator_id uuid,p_order_id bigint default null)
returns table(case_id bigint,order_id bigint,order_reference text,case_reference uuid,status text,amount_minor bigint,currency text,reason_code text,operator_note text,
 provider_case_id text,provider_case_reference text,provider_status text,requested_at timestamptz,provider_submitted_at timestamptz,last_verified_at timestamptz,
 action_required_at timestamptz,processed_at timestamptz,failed_at timestamptz,failure_code text,failure_message text)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 return query select c.id,c.order_id,o.order_reference,c.case_reference,c.status,c.amount_minor,c.currency,c.reason_code,c.operator_note,c.provider_case_id,c.provider_case_reference,c.provider_status,c.requested_at,c.provider_submitted_at,c.last_verified_at,c.action_required_at,c.processed_at,c.failed_at,c.failure_code,c.failure_message
 from public.learning_payment_cases c join public.learning_orders o on o.id=c.order_id where c.case_type='refund' and (p_order_id is null or c.order_id=p_order_id) order by c.opened_at desc,c.id desc;
end;$function$;
revoke all on function public.list_learning_refund_cases(uuid,bigint) from public, anon, authenticated;
grant execute on function public.list_learning_refund_cases(uuid,bigint) to postgres, service_role;
