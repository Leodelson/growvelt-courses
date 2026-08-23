create or replace function public.validate_learning_payment_case()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare order_row record;
begin
  select gross_amount_minor, currency into order_row from public.learning_orders where id = new.order_id;
  if not found or new.amount_minor > order_row.gross_amount_minor or new.currency <> order_row.currency
  then raise exception 'Payment case amount must fit its authoritative order' using errcode = '22023'; end if;
  if new.payment_attempt_id is not null and not exists (select 1 from public.learning_payment_attempts where id = new.payment_attempt_id and order_id = new.order_id)
  then raise exception 'Payment case attempt does not belong to its order' using errcode = '22023'; end if;
  return new;
end;
$function$;
revoke all on function public.validate_learning_payment_case() from public, anon, authenticated;
grant execute on function public.validate_learning_payment_case() to postgres, service_role;
