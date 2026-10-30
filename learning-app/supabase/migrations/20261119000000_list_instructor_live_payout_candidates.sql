-- Read-only administrator view of Live payout candidates. Approval remains a
-- separate guarded operation and rechecks every financial condition.
begin;
create or replace function public.list_learning_instructor_live_payout_candidates(p_operator_id uuid,p_limit integer default 100)
returns table(reservation_id bigint,reservation_reference text,instructor_name text,instructor_email text,amount_minor bigint,currency text)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if p_operator_id is null or not exists(select 1 from public.account_capabilities c
    where c.user_id=p_operator_id and c.capability='admin' and c.status='active') then
    raise exception 'Active administrator required' using errcode='42501';
  end if;
  return query select r.id,r.reservation_reference,p.full_name,p.email,r.amount_minor,r.currency
  from public.learning_instructor_earning_reservations r
  join public.learning_instructor_earnings e on e.id=r.earning_id
  join public.learning_commercial_allocations a on a.id=r.allocation_id
  join public.learning_orders o on o.id=a.order_id
  join public.profiles p on p.id=r.instructor_id
  where r.status='reserved' and r.future_payout_item_reference is null
    and e.status='reserved' and a.status='allocated' and o.status='paid'
    and not exists(select 1 from public.learning_instructor_payout_items item where item.reservation_id=r.id)
    and exists(select 1 from public.learning_instructor_payout_profiles profile
      where profile.instructor_id=r.instructor_id and profile.provider='paystack'
        and profile.provider_domain='live' and profile.status='active' and profile.currency=r.currency)
    and (select count(*) from public.learning_payment_attempts attempt
      where attempt.order_id=o.id and attempt.status='succeeded')=1
    and exists(select 1 from public.learning_payment_attempts attempt
      where attempt.order_id=o.id and attempt.status='succeeded'
        and attempt.provider='paystack' and attempt.paystack_domain='live'
        and attempt.amount_minor=o.gross_amount_minor and attempt.currency=o.currency)
    and not exists(select 1 from public.learning_payment_cases payment_case
      where payment_case.order_id=o.id and payment_case.status in
        ('requested','submitting','pending','processing','needs_attention','opened','action_required','submitted','under_review'))
  order by r.reserved_at desc,r.id desc limit least(greatest(coalesce(p_limit,100),1),200);
end;$function$;
revoke all on function public.list_learning_instructor_live_payout_candidates(uuid,integer) from public,anon,authenticated;
grant execute on function public.list_learning_instructor_live_payout_candidates(uuid,integer) to postgres,service_role;
commit;
