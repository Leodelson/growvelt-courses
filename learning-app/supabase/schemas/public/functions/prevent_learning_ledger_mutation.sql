create or replace function public.prevent_learning_ledger_mutation()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin raise exception 'Financial ledger records are append-only' using errcode = '42501'; end;
$function$;
revoke all on function public.prevent_learning_ledger_mutation() from public, anon, authenticated;
grant execute on function public.prevent_learning_ledger_mutation() to postgres, service_role;
