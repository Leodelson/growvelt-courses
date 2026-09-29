-- Fix the test-checkout state helpers: their unqualified RETURNING `status`
-- references collide with the RETURNS TABLE output parameter named `status`.
-- This prevented an initialized company purchase from being resumed.
begin;

create or replace function public.mark_learning_company_paid_course_checkout_pending(p_provider_reference text)
returns table(attempt_id bigint,status text)
language plpgsql security definer set search_path to '' as $function$
declare attempt_row public.learning_company_paid_course_purchase_attempts%rowtype;
begin
  select * into attempt_row from public.learning_company_paid_course_purchase_attempts attempt
  where attempt.provider = 'paystack' and attempt.provider_reference = btrim(coalesce(p_provider_reference,'')) for update;
  if not found then raise exception 'Payment attempt was not found' using errcode = '22023'; end if;
  if attempt_row.status = 'pending' then
    return query select attempt_row.id, attempt_row.status::text;
    return;
  end if;
  if attempt_row.status <> 'initialized' then raise exception 'This payment attempt cannot be submitted' using errcode = '22023'; end if;

  update public.learning_company_paid_course_purchase_attempts as attempt
  set status = 'pending', submitted_at = now()
  where attempt.id = attempt_row.id
  returning attempt.id, attempt.status into attempt_row.id, attempt_row.status;

  return query select attempt_row.id, attempt_row.status::text;
end;$function$;

create or replace function public.fail_learning_company_paid_course_checkout(p_provider_reference text,p_failure_code text,p_failure_message text)
returns table(attempt_id bigint,status text)
language plpgsql security definer set search_path to '' as $function$
declare attempt_row public.learning_company_paid_course_purchase_attempts%rowtype;
begin
  select * into attempt_row from public.learning_company_paid_course_purchase_attempts attempt
  where attempt.provider = 'paystack' and attempt.provider_reference = btrim(coalesce(p_provider_reference,'')) for update;
  if not found then raise exception 'Payment attempt was not found' using errcode = '22023'; end if;
  if attempt_row.status in ('succeeded','failed','abandoned') then
    return query select attempt_row.id, attempt_row.status::text;
    return;
  end if;

  update public.learning_company_paid_course_purchase_attempts as attempt
  set status = 'failed',
      failure_code = nullif(left(btrim(coalesce(p_failure_code,'')),120),''),
      failure_message = nullif(left(btrim(coalesce(p_failure_message,'')),500),''),
      failed_at = now()
  where attempt.id = attempt_row.id
  returning attempt.id, attempt.status into attempt_row.id, attempt_row.status;

  update public.learning_company_paid_course_purchases as purchase
  set status = 'checkout_ready', checkout_started_at = null
  where purchase.id = attempt_row.purchase_id and purchase.status = 'checkout_pending';

  return query select attempt_row.id, attempt_row.status::text;
end;$function$;

revoke all on function public.mark_learning_company_paid_course_checkout_pending(text), public.fail_learning_company_paid_course_checkout(text,text,text) from public, anon, authenticated;
grant execute on function public.mark_learning_company_paid_course_checkout_pending(text), public.fail_learning_company_paid_course_checkout(text,text,text) to postgres, service_role;

commit;
