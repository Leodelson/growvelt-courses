create or replace function public.validate_learning_provider_event_links()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.order_id is not null and new.payment_attempt_id is not null and not exists (
    select 1 from public.learning_payment_attempts where id=new.payment_attempt_id and order_id=new.order_id
  ) then raise exception 'Provider event attempt does not belong to its order' using errcode='22023'; end if;
  if new.payment_case_id is not null and not exists (
    select 1 from public.learning_payment_cases c
    where c.id=new.payment_case_id
      and (new.order_id is null or c.order_id=new.order_id)
      and (new.payment_attempt_id is null or c.payment_attempt_id=new.payment_attempt_id)
  ) then raise exception 'Provider event case does not belong to its order or attempt' using errcode='22023'; end if;
  return new;
end;
$function$;
revoke all on function public.validate_learning_provider_event_links() from public,anon,authenticated;
grant execute on function public.validate_learning_provider_event_links() to postgres,service_role;
