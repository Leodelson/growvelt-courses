create or replace function public.prevent_learning_payment_case_identity_change()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  if old.order_id is distinct from new.order_id or old.payment_attempt_id is distinct from new.payment_attempt_id
    or old.case_type is distinct from new.case_type or old.amount_minor is distinct from new.amount_minor
    or old.currency is distinct from new.currency or old.idempotency_key is distinct from new.idempotency_key
    or old.requested_amount_minor is distinct from new.requested_amount_minor or old.initiated_by is distinct from new.initiated_by
    or (old.provider_case_id is not null and old.provider_case_id is distinct from new.provider_case_id)
  then raise exception 'Payment case financial identity is immutable' using errcode='42501'; end if;
  if old.status is distinct from new.status and not (
    (old.case_type='refund' and (
      (old.status='requested' and new.status in ('submitting','cancelled')) or
      (old.status='submitting' and new.status in ('pending','processing','needs_attention','failed')) or
      (old.status='pending' and new.status in ('processing','needs_attention','processed','failed')) or
      (old.status='processing' and new.status in ('needs_attention','processed','failed')) or
      (old.status='needs_attention' and new.status in ('processing','processed','failed'))
    )) or
    (old.case_type='chargeback' and (
      (old.status='opened' and new.status in ('action_required','under_review','won','lost')) or
      (old.status='action_required' and new.status in ('submitted','under_review','won','lost')) or
      (old.status='submitted' and new.status in ('under_review','won','lost')) or
      (old.status='under_review' and new.status in ('action_required','won','lost'))
    ))
  ) then raise exception 'Unsupported payment case status transition' using errcode='22023'; end if;
  new.updated_at:=now(); return new;
end;$function$;

grant execute on function "public"."prevent_learning_payment_case_identity_change"() to "postgres", "service_role";

revoke all on function "public"."prevent_learning_payment_case_identity_change"() from public;
