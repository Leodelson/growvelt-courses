create or replace function public.prevent_learning_subscription_course_enrollment_source_mutation()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  raise exception 'Subscription course access provenance cannot be changed or deleted' using errcode = '42501';
end;
$function$;

revoke all on function public.prevent_learning_subscription_course_enrollment_source_mutation()
  from public, anon, authenticated, service_role;
