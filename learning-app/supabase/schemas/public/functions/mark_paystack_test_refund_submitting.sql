create or replace function public.mark_paystack_test_refund_submitting (
  p_case_id     bigint,
  p_operator_id uuid
)
  returns text
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
 if not exists(select 1 from public.account_capabilities ac where ac.user_id=p_operator_id and ac.capability='admin' and ac.status='active') then raise exception 'Active administrator required' using errcode='42501'; end if;
 update public.learning_payment_cases set status='submitting' where id=p_case_id and case_type='refund' and status='requested';
 if not found then return 'already_submitted'; end if;
 insert into public.learning_payment_case_events(payment_case_id,event_type,normalized_status,provenance,operator_id) values(p_case_id,'refund.submitting','submitting','operator',p_operator_id);
 return 'submitting';
end;$function$;

grant execute on function "public"."mark_paystack_test_refund_submitting"(bigint, uuid) to "postgres", "service_role";

revoke all on function "public"."mark_paystack_test_refund_submitting"(bigint, uuid) from public;
