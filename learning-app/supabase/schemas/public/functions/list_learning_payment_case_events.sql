create or replace function public.list_learning_payment_case_events(p_operator_id uuid,p_case_id bigint)
returns table(event_id bigint,payment_case_id bigint,event_type text,normalized_status text,provenance text,note text,metadata jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path to '' as $function$
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 return query select e.id,e.payment_case_id,e.event_type,e.normalized_status,e.provenance,e.note,e.metadata,e.created_at from public.learning_payment_case_events e where p_case_id is null or e.payment_case_id=p_case_id order by e.created_at,e.id;
end;$function$;
revoke all on function public.list_learning_payment_case_events(uuid,bigint) from public, anon, authenticated;
grant execute on function public.list_learning_payment_case_events(uuid,bigint) to postgres, service_role;
