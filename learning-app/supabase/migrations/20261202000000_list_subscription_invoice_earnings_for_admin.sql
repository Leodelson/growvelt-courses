-- Admin review of Live subscription proceeds. This function cannot release
-- earnings, reserve a payout, or contact a payment provider.
begin;

create function public.list_learning_subscription_invoice_earnings_for_admin(
  p_operator_id uuid, p_limit integer default 100
) returns table(
  invoice_id uuid, provider_reference text, instructor_id uuid, instructor_name text,
  earning_id bigint, amount_minor bigint, currency text,
  earning_status text, available_at timestamptz, invoice_status text,
  refund_status text, has_live_payout_profile boolean
)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or not exists (
    select 1 from public.account_capabilities c
    where c.user_id=p_operator_id and c.capability='admin' and c.status='active'
  ) then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  return query
    select invoice.id,invoice.provider_reference,earning.instructor_id,instructor.full_name,
      earning.id,earning.gross_amount_minor,earning.currency,earning.status,
      earning.available_at,invoice.status,
      (select refund_case.status from public.learning_subscription_refund_cases refund_case
        where refund_case.invoice_id=invoice.id order by refund_case.id desc limit 1),
      exists (select 1 from public.learning_instructor_payout_profiles profile
        where profile.instructor_id=earning.instructor_id and profile.provider='paystack'
          and profile.provider_domain='live' and profile.status='active'
          and profile.currency=earning.currency)
    from public.learning_subscription_invoices invoice
    join public.learning_commercial_allocations allocation
      on allocation.subscription_invoice_id=invoice.id
    join public.learning_instructor_earnings earning
      on earning.allocation_id=allocation.id and earning.instructor_id=invoice.instructor_id
    join public.profiles instructor on instructor.id=earning.instructor_id
    where invoice.payment_domain='live'
    order by invoice.paid_at desc nulls last,invoice.id desc
    limit least(greatest(coalesce(p_limit,100),1),200);
end;$function$;

revoke all on function public.list_learning_subscription_invoice_earnings_for_admin(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.list_learning_subscription_invoice_earnings_for_admin(uuid,integer)
  to postgres,service_role;

commit;
