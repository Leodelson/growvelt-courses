-- Phase 3C live-readiness: bind each company charge to its Paystack domain.
-- Existing Test Mode attempts remain test. This does not enable Live checkout.
begin;

alter table public.learning_company_paid_course_purchase_attempts
  add column paystack_domain text not null default 'test'
  constraint learning_company_paid_attempt_domain_check check (paystack_domain in ('test','live'));

create unique index learning_company_paid_attempt_domain_transaction_key
  on public.learning_company_paid_course_purchase_attempts(provider,paystack_domain,provider_transaction_id)
  where provider_transaction_id is not null;

create or replace function public.protect_learning_company_paid_attempt_domain()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if old.paystack_domain is distinct from new.paystack_domain
     and (old.status <> 'initialized' or new.status <> 'initialized' or old.provider_transaction_id is not null) then
    raise exception 'Submitted company payment domain is immutable' using errcode = '42501';
  end if;
  return new;
end;$function$;

create trigger protect_learning_company_paid_attempt_domain
before update of paystack_domain on public.learning_company_paid_course_purchase_attempts
for each row execute function public.protect_learning_company_paid_attempt_domain();

create or replace function public.set_learning_company_paid_checkout_domain(p_provider_reference text,p_domain text)
returns void language plpgsql security definer set search_path to '' as $function$
declare attempt_row public.learning_company_paid_course_purchase_attempts%rowtype;
begin
  if p_domain not in ('test','live') or p_domain is null then
    raise exception 'Invalid Paystack domain' using errcode = '22023';
  end if;
  select * into attempt_row from public.learning_company_paid_course_purchase_attempts attempt
  where attempt.provider = 'paystack' and attempt.provider_reference = btrim(coalesce(p_provider_reference,'')) for update;
  if not found then
    raise exception 'Company checkout is not available for this domain' using errcode = '22023';
  end if;
  if attempt_row.paystack_domain = p_domain and attempt_row.status in ('initialized','pending') then return; end if;
  if attempt_row.status <> 'initialized' then
    raise exception 'Submitted company checkout belongs to another domain' using errcode = '22023';
  end if;
  update public.learning_company_paid_course_purchase_attempts attempt
  set paystack_domain = p_domain where attempt.id = attempt_row.id;
end;$function$;

create or replace function public.finalize_learning_company_paid_course_purchase_by_reference(
  p_provider_reference text,p_provider_transaction_id text default null,
  p_amount_minor bigint default null,p_currency text default null,p_domain text default null)
returns table(purchase_id bigint,status text,granted_seat_count integer)
language plpgsql security definer set search_path to '' as $function$
declare attempt_row public.learning_company_paid_course_purchase_attempts%rowtype;
begin
  select * into attempt_row from public.learning_company_paid_course_purchase_attempts attempt
  where attempt.provider = 'paystack' and attempt.provider_reference = btrim(coalesce(p_provider_reference,''));
  if not found then raise exception 'Payment attempt was not found' using errcode = '22023'; end if;
  if p_domain is null or p_domain <> attempt_row.paystack_domain then
    raise exception 'Provider domain does not match the company payment attempt' using errcode = '22023';
  end if;
  if p_amount_minor is null or p_amount_minor <> attempt_row.amount_minor
     or p_currency is null or p_currency <> attempt_row.currency then
    raise exception 'Payment amount or currency did not match the company purchase' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_provider_transaction_id,'')),'') is null then
    raise exception 'Verified provider transaction is required' using errcode = '22023';
  end if;
  return query select result.purchase_id,result.status,result.granted_seat_count
  from public.finalize_learning_company_paid_course_purchase(
    attempt_row.purchase_id,attempt_row.provider_reference,p_provider_transaction_id) result;
end;$function$;

revoke all on function public.protect_learning_company_paid_attempt_domain(),
  public.set_learning_company_paid_checkout_domain(text,text),
  public.finalize_learning_company_paid_course_purchase_by_reference(text,text,bigint,text,text)
  from public,anon,authenticated;
grant execute on function public.protect_learning_company_paid_attempt_domain(),
  public.set_learning_company_paid_checkout_domain(text,text),
  public.finalize_learning_company_paid_course_purchase_by_reference(text,text,bigint,text,text)
  to postgres,service_role;

commit;
