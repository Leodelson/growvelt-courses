create or replace function public.handle_new_growvelt_learning_profile()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'pg_catalog', 'public'
  AS $function$
declare
  safe_full_name text;
begin
  safe_full_name := nullif(
    pg_catalog.btrim(
      pg_catalog.left(
        coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
        160
      )
    ),
    ''
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, safe_full_name)
  on conflict (id) do nothing;

  return new;
end;
$function$;

grant execute on function "public"."handle_new_growvelt_learning_profile"() to "postgres", "service_role", "supabase_auth_admin";

revoke all on function "public"."handle_new_growvelt_learning_profile"() from public;
