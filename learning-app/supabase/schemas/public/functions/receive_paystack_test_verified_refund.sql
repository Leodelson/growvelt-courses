create or replace function public.receive_paystack_test_verified_refund(
 p_case_id bigint,p_provider_case_id text,p_provider_status text,p_provider_reference text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb,p_operator_id uuid
) returns bigint language plpgsql security definer set search_path to '' as $function$
declare case_row record; event_key bigint; digest text; normalized text;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 normalized:=replace(lower(trim(p_provider_status)),'_','-');
 if p_domain<>'test' or p_currency<>'NGN' or normalized not in('pending','processing','needs-attention','failed','processed') then raise exception 'Invalid verified refund' using errcode='22023'; end if;
 select * into case_row from public.learning_payment_cases where id=p_case_id and case_type='refund';
 if not found or case_row.amount_minor<>p_amount_minor then raise exception 'Verified refund does not match case' using errcode='22023'; end if;
 digest:=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
 insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,verification_source,processing_status,order_id,payment_attempt_id,payment_case_id,recovery_status)
 values('paystack','refund.verify:'||p_provider_case_id||':'||normalized,'refund.'||normalized,digest,p_payload,false,'provider_api','received',case_row.order_id,case_row.payment_attempt_id,p_case_id,'none')
 on conflict(provider,provider_event_id) do update set received_at=public.learning_payment_provider_events.received_at returning id into event_key;
 update public.learning_payment_cases set provider_case_id=coalesce(provider_case_id,p_provider_case_id),provider_case_reference=coalesce(provider_case_reference,p_provider_reference),last_verified_at=now() where id=p_case_id;
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(p_operator_id,'admin_operator','refund.verified_via_api','payment_case',p_case_id::text,jsonb_build_object('provider_status',normalized,'event_id',event_key));
 return event_key;
end;$function$;
revoke all on function public.receive_paystack_test_verified_refund(bigint,text,text,text,bigint,text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.receive_paystack_test_verified_refund(bigint,text,text,text,bigint,text,text,jsonb,uuid) to postgres, service_role;
