create or replace function public.prevent_learning_financial_record_delete()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  raise exception 'Financial history is retained and cannot be deleted' using errcode = '42501';
end;
$function$;

grant execute on function "public"."prevent_learning_financial_record_delete"() to "postgres", "service_role";

revoke all on function "public"."prevent_learning_financial_record_delete"() from public;
