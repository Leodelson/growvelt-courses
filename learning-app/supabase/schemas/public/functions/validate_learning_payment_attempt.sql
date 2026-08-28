create or replace function public.validate_learning_payment_attempt()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare order_row record;
begin
  select gross_amount_minor, currency into order_row
  from public.learning_orders where id = new.order_id;
  if not found or new.amount_minor <> order_row.gross_amount_minor or new.currency <> order_row.currency then
    raise exception 'Payment attempt amount must match its authoritative order snapshot' using errcode = '22023';
  end if;
  return new;
end;
$function$;

grant execute on function "public"."validate_learning_payment_attempt"() to "postgres", "service_role";

revoke all on function "public"."validate_learning_payment_attempt"() from public;
