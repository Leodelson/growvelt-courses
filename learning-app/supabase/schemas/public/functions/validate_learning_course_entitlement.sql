create or replace function public.validate_learning_course_entitlement()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare order_row record;
begin
  select learner_id, course_id, status into order_row from public.learning_orders where id = new.order_id;
  if not found or order_row.status <> 'paid' or order_row.learner_id is distinct from new.learner_id
    or order_row.course_id is distinct from new.course_id
  then raise exception 'Paid entitlement must match a paid authoritative order' using errcode = '22023'; end if;
  return new;
end;
$function$;

grant execute on function "public"."validate_learning_course_entitlement"() to "postgres", "service_role";

revoke all on function "public"."validate_learning_course_entitlement"() from public;
