create or replace function public.is_growvelt_learning_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select public.has_growvelt_learning_capability('admin');
$function$;

grant execute on function "public"."is_growvelt_learning_admin"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."is_growvelt_learning_admin"() from public;
