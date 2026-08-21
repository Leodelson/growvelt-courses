create or replace function public.has_growvelt_learning_capability (
  p_capability text
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select exists (
    select 1
    from public.account_capabilities as capability
    where capability.user_id = auth.uid()
      and capability.capability = p_capability
      and capability.status = 'active'
  );
$function$;

grant execute on function "public"."has_growvelt_learning_capability"(text) to "authenticated", "postgres", "service_role";

revoke all on function "public"."has_growvelt_learning_capability"(text) from public;
