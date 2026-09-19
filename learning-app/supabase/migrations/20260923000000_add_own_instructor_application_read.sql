-- Durable self-service read path for the Instructor application status page.
-- It exposes only the authenticated applicant's own application fields.
begin;

create or replace function public.get_own_instructor_application()
returns table(
  headline text,
  bio text,
  expertise text[],
  country text,
  phone text,
  years_experience smallint,
  teaching_experience text,
  motivation text,
  portfolio_url text,
  approval_status text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql stable security definer set search_path to '' as $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  return query
    select application.headline,application.bio,application.expertise,application.country,application.phone,
      application.years_experience,application.teaching_experience,application.motivation,application.portfolio_url,
      application.approval_status,application.created_at,application.reviewed_at
    from public.instructor_profiles application
    where application.user_id=auth.uid()
    limit 1;
end;$function$;

revoke all on function public.get_own_instructor_application() from public,anon;
grant execute on function public.get_own_instructor_application() to authenticated,postgres,service_role;

commit;
