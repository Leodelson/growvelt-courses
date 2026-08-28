create or replace function public.record_paystack_test_refund_submission(
 p_case_id bigint,p_provider_case_id text,p_provider_status text,p_provider_reference text,p_operator_id uuid
) returns text language plpgsql security definer set search_path to '' as $function$
declare normalized text;
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 normalized:=replace(lower(trim(p_provider_status)),'-','_');
 if normalized not in('pending','processing','needs_attention','failed','processed') then raise exception 'Unsupported refund provider status' using errcode='22023'; end if;
 update public.learning_payment_cases set provider_case_id=p_provider_case_id,provider_case_reference=p_provider_reference,
   provider_status=replace(normalized,'_','-'),provider_submitted_at=coalesce(provider_submitted_at,now()),last_verified_at=now(),
   status=case when normalized='processed' then 'pending' else normalized end,
   failed_at=case when normalized='failed' then now() else null end,
   failure_code=case when normalized='failed' then 'provider_failed' else null end,
   resolved_at=case when normalized='failed' then now() else null end
 where id=p_case_id and case_type='refund' and status in('submitting','pending','processing','needs_attention');
 if not found then return 'already_resolved'; end if;
 insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,operator_id,metadata)
 values(p_case_id,'refund.provider_submitted',normalized,'provider_api',p_operator_id,jsonb_build_object('provider_case_id',p_provider_case_id,'provider_reference',p_provider_reference));
 return normalized;
end;$function$;
revoke all on function public.record_paystack_test_refund_submission(bigint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.record_paystack_test_refund_submission(bigint,text,text,text,uuid) to postgres, service_role;
