-- Growvelt Learning: align Admin reader output with auth.users.email's
-- varchar type without changing the Admin-only reader contract or grants.

begin;

do $$
begin
  if to_regprocedure('public.list_pending_instructor_applications()') is null
     or to_regprocedure('public.get_instructor_application_for_review(uuid)') is null then
    raise exception 'Instructor Admin reader email-type correction aborted: expected reader functions are missing';
  end if;

  if not exists (
    select 1
    from pg_proc as routine
    where routine.oid = 'public.list_pending_instructor_applications()'::regprocedure
      and routine.prosecdef
      and pg_get_function_result(routine.oid) = 'TABLE(user_id uuid, full_name text, email text, country text, phone text, headline text, bio text, expertise text[], years_experience smallint, teaching_experience text, motivation text, portfolio_url text, approval_status text, created_at timestamp with time zone, reviewed_at timestamp with time zone, reviewed_by uuid, review_note text)'
  ) or not exists (
    select 1
    from pg_proc as routine
    where routine.oid = 'public.get_instructor_application_for_review(uuid)'::regprocedure
      and routine.prosecdef
      and pg_get_function_result(routine.oid) = 'TABLE(user_id uuid, full_name text, email text, country text, phone text, headline text, bio text, expertise text[], years_experience smallint, teaching_experience text, motivation text, portfolio_url text, approval_status text, created_at timestamp with time zone, reviewed_at timestamp with time zone, reviewed_by uuid, review_note text)'
  ) then
    raise exception 'Instructor Admin reader email-type correction aborted: reader functions must be SECURITY DEFINER with the expected expanded result shape';
  end if;

  if has_function_privilege('public', 'public.list_pending_instructor_applications()', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_pending_instructor_applications()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_pending_instructor_applications()', 'EXECUTE')
     or has_function_privilege('public', 'public.get_instructor_application_for_review(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_instructor_application_for_review(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_instructor_application_for_review(uuid)', 'EXECUTE') then
    raise exception 'Instructor Admin reader email-type correction aborted: reader execution grants do not match the hardened baseline';
  end if;

  if not exists (
    select 1
    from information_schema.columns as column_definition
    where column_definition.table_schema = 'auth'
      and column_definition.table_name = 'users'
      and column_definition.column_name = 'email'
      and column_definition.data_type in ('character varying', 'text')
  ) then
    raise exception 'Instructor Admin reader email-type correction aborted: auth.users.email is not varchar/text-compatible';
  end if;
end;
$$;

create or replace function public.list_pending_instructor_applications()
returns table (
  user_id uuid,
  full_name text,
  email text,
  country text,
  phone text,
  headline text,
  bio text,
  expertise text[],
  years_experience smallint,
  teaching_experience text,
  motivation text,
  portfolio_url text,
  approval_status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Admin capability required' using errcode = '42501';
  end if;

  return query
  select application.user_id,
         profile.full_name,
         auth_user.email::text,
         application.country,
         application.phone,
         application.headline,
         application.bio,
         application.expertise,
         application.years_experience,
         application.teaching_experience,
         application.motivation,
         application.portfolio_url,
         application.approval_status,
         application.created_at,
         application.reviewed_at,
         application.reviewed_by,
         application.review_note
  from public.instructor_profiles as application
  join public.profiles as profile on profile.id = application.user_id
  join auth.users as auth_user on auth_user.id = application.user_id
  where application.approval_status = 'pending'
  order by application.created_at desc;
end;
$$;

create or replace function public.get_instructor_application_for_review(p_application_user_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  country text,
  phone text,
  headline text,
  bio text,
  expertise text[],
  years_experience smallint,
  teaching_experience text,
  motivation text,
  portfolio_url text,
  approval_status text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Admin capability required' using errcode = '42501';
  end if;

  return query
  select application.user_id,
         profile.full_name,
         auth_user.email::text,
         application.country,
         application.phone,
         application.headline,
         application.bio,
         application.expertise,
         application.years_experience,
         application.teaching_experience,
         application.motivation,
         application.portfolio_url,
         application.approval_status,
         application.created_at,
         application.reviewed_at,
         application.reviewed_by,
         application.review_note
  from public.instructor_profiles as application
  join public.profiles as profile on profile.id = application.user_id
  join auth.users as auth_user on auth_user.id = application.user_id
  where application.user_id = p_application_user_id;
end;
$$;

revoke execute on function public.list_pending_instructor_applications() from public, anon, authenticated;
revoke execute on function public.get_instructor_application_for_review(uuid) from public, anon, authenticated;
grant execute on function public.list_pending_instructor_applications() to authenticated;
grant execute on function public.get_instructor_application_for_review(uuid) to authenticated;

commit;
