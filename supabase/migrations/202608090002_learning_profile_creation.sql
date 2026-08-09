-- Growvelt Learning Phase 1B: canonical Learner profile creation.
-- REVIEW ONLY: do not execute without the accompanying runbook.
begin;

do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('auth.users') is null then
    raise exception 'Expected public.profiles and auth.users before creating Learning profiles';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'id' and data_type = 'uuid')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'email' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name' and data_type = 'text')
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'account_type' and data_type = 'text') then
    raise exception 'public.profiles does not match the expected Learning profile shape';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'account_type'
      and is_nullable = 'NO' and column_default like '%learner%'
  ) then
    raise exception 'public.profiles.account_type must retain a non-null learner default';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgname = 'on_growvelt_learning_auth_user_created' and not tgisinternal) then
    raise exception 'Learning auth-user trigger already exists; inspect state before continuing';
  end if;
  if to_regprocedure('public.handle_new_growvelt_learning_profile()') is not null then
    raise exception 'Learning profile trigger function already exists; inspect state before continuing';
  end if;
  if to_regrole('supabase_auth_admin') is null then
    raise exception 'Expected supabase_auth_admin role is missing';
  end if;
end;
$$;

create function public.handle_new_growvelt_learning_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
$$;

revoke all on function public.handle_new_growvelt_learning_profile() from public, anon, authenticated;
grant execute on function public.handle_new_growvelt_learning_profile() to supabase_auth_admin;

create trigger on_growvelt_learning_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_growvelt_learning_profile();

commit;
