-- Phase 3C3: Test Mode checkout helpers for company paid-course purchases.
-- These are server-only helpers. Browser callers may start checkout through the
-- guarded route, but only a signed Paystack webhook can finalize paid access.
begin;

create or replace function public.mark_learning_company_paid_course_checkout_pending(p_provider_reference text)
returns table(attempt_id bigint,status text)
language plpgsql security definer set search_path to '' as $function$
declare attempt_row public.learning_company_paid_course_purchase_attempts%rowtype;
begin
  select * into attempt_row from public.learning_company_paid_course_purchase_attempts attempt
  where attempt.provider = 'paystack' and attempt.provider_reference = btrim(coalesce(p_provider_reference,'')) for update;
  if not found then raise exception 'Payment attempt was not found' using errcode = '22023'; end if;
  if attempt_row.status = 'pending' then return query select attempt_row.id,attempt_row.status; return; end if;
  if attempt_row.status <> 'initialized' then raise exception 'This payment attempt cannot be submitted' using errcode = '22023'; end if;
  update public.learning_company_paid_course_purchase_attempts
  set status = 'pending', submitted_at = now()
  where id = attempt_row.id
  returning id,status into attempt_row.id,attempt_row.status;
  return query select attempt_row.id,attempt_row.status;
end;$function$;

create or replace function public.fail_learning_company_paid_course_checkout(p_provider_reference text,p_failure_code text,p_failure_message text)
returns table(attempt_id bigint,status text)
language plpgsql security definer set search_path to '' as $function$
declare attempt_row public.learning_company_paid_course_purchase_attempts%rowtype;
begin
  select * into attempt_row from public.learning_company_paid_course_purchase_attempts attempt
  where attempt.provider = 'paystack' and attempt.provider_reference = btrim(coalesce(p_provider_reference,'')) for update;
  if not found then raise exception 'Payment attempt was not found' using errcode = '22023'; end if;
  if attempt_row.status in ('succeeded','failed','abandoned') then return query select attempt_row.id,attempt_row.status; return; end if;
  update public.learning_company_paid_course_purchase_attempts
  set status = 'failed', failure_code = nullif(left(btrim(coalesce(p_failure_code,'')),120),''), failure_message = nullif(left(btrim(coalesce(p_failure_message,'')),500),''), failed_at = now()
  where id = attempt_row.id
  returning id,status into attempt_row.id,attempt_row.status;
  update public.learning_company_paid_course_purchases
  set status = 'checkout_ready', checkout_started_at = null
  where id = attempt_row.purchase_id and status = 'checkout_pending';
  return query select attempt_row.id,attempt_row.status;
end;$function$;

create or replace function public.finalize_learning_company_paid_course_purchase_by_reference(p_provider_reference text,p_provider_transaction_id text default null,p_amount_minor bigint default null,p_currency text default null,p_domain text default null)
returns table(purchase_id bigint,status text,granted_seat_count integer)
language plpgsql security definer set search_path to '' as $function$
declare purchase_key bigint;
begin
  select attempt.purchase_id into purchase_key
  from public.learning_company_paid_course_purchase_attempts attempt
  where attempt.provider = 'paystack' and attempt.provider_reference = btrim(coalesce(p_provider_reference,''));
  if purchase_key is null then raise exception 'Payment attempt was not found' using errcode = '22023'; end if;
  if p_amount_minor is not null and not exists(select 1 from public.learning_company_paid_course_purchase_attempts attempt where attempt.purchase_id = purchase_key and attempt.provider_reference = btrim(p_provider_reference) and attempt.amount_minor = p_amount_minor and attempt.currency = coalesce(p_currency,attempt.currency)) then raise exception 'Payment amount or currency did not match the company purchase' using errcode = '22023'; end if;
  if p_domain is not null and p_domain not in ('test','live') then raise exception 'Payment domain was invalid' using errcode = '22023'; end if;
  return query select result.purchase_id,result.status,result.granted_seat_count
  from public.finalize_learning_company_paid_course_purchase(purchase_key,p_provider_reference,p_provider_transaction_id) result;
end;$function$;

revoke all on function public.mark_learning_company_paid_course_checkout_pending(text), public.fail_learning_company_paid_course_checkout(text,text,text), public.finalize_learning_company_paid_course_purchase_by_reference(text,text,bigint,text,text) from public, anon, authenticated;
grant execute on function public.mark_learning_company_paid_course_checkout_pending(text), public.fail_learning_company_paid_course_checkout(text,text,text), public.finalize_learning_company_paid_course_purchase_by_reference(text,text,bigint,text,text) to postgres, service_role;

commit;
