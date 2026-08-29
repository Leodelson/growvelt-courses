create or replace function public.revoke_learning_certificate_for_financial_abuse (
  p_certificate_id bigint,
  p_operator_id    uuid,
  p_reason         text
)
  returns void
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare normalized_reason text;
begin
  if not exists(select 1 from public.account_capabilities where user_id=p_operator_id and capability='admin' and status='active')
  then raise exception 'Active administrator required' using errcode='42501'; end if;
  normalized_reason:=trim(coalesce(p_reason,''));
  if char_length(normalized_reason) not between 10 and 1000 then raise exception 'A specific revocation reason is required' using errcode='22023'; end if;
  update public.certificates set status='revoked',revoked_at=now(),revocation_reason=normalized_reason
    where id=p_certificate_id and status='issued';
  if not found then raise exception 'Issued certificate not found' using errcode='P0002'; end if;
  insert into public.learning_audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata)
  values(p_operator_id,'admin_operator','certificate.financial_abuse_revoked','certificate',p_certificate_id::text,
    jsonb_build_object('reason',normalized_reason));
end;$function$;

grant execute on function "public"."revoke_learning_certificate_for_financial_abuse"(bigint, uuid, text) to "postgres", "service_role";

revoke all on function "public"."revoke_learning_certificate_for_financial_abuse"(bigint, uuid, text) from public;
