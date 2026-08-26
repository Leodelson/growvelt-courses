create or replace function public.receive_paystack_test_verified_transaction(p_reference text,p_provider_transaction_id text,p_amount_minor bigint,p_currency text,p_domain text,p_payload jsonb,p_operator_id uuid)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare event_key bigint; attempt_row record; digest text;
begin
 if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 if p_domain<>'test' or p_currency<>'NGN' or p_amount_minor<=0 or p_payload->>'status'<>'success' then raise exception 'Provider verification is not a successful test payment' using errcode='22023'; end if;
 select a.id payment_attempt_id,a.order_id into attempt_row from public.learning_payment_attempts a where a.provider='paystack' and a.provider_reference=p_reference;
 if not found then raise exception 'Payment attempt not found' using errcode='P0002'; end if;
 digest:=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
 insert into public.learning_payment_provider_events(provider,provider_event_id,event_type,payload_digest,payload,signature_valid,verification_source,processing_status,order_id,payment_attempt_id,recovery_status)
 values('paystack','transaction.verify:'||p_provider_transaction_id,'charge.success',digest,p_payload,false,'provider_api','received',attempt_row.order_id,attempt_row.payment_attempt_id,'none')
 on conflict(provider,provider_event_id) do update set received_at=public.learning_payment_provider_events.received_at returning id into event_key;
 insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(p_operator_id,'admin_operator','payment_provider_event.verified_via_api','payment_provider_event',event_key::text,jsonb_build_object('reference',p_reference));
 return event_key;
end;$function$;
revoke all on function public.receive_paystack_test_verified_transaction(text,text,bigint,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.receive_paystack_test_verified_transaction(text,text,bigint,text,text,jsonb,uuid) to postgres,service_role;
