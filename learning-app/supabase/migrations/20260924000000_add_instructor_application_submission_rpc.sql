-- Server-mediated, self-service Instructor application submission.
-- This avoids exposing submission reliability to browser table privileges.
begin;

create or replace function public.submit_own_instructor_application(
  p_country text,p_phone text,p_headline text,p_expertise text[],p_years_experience smallint,
  p_teaching_experience text,p_bio text,p_motivation text,p_portfolio_url text default null
)
returns table(approval_status text,created_at timestamptz)
language plpgsql security definer set search_path to '' as $function$
declare
  country_value text:=nullif(btrim(p_country),''); phone_value text:=nullif(btrim(p_phone),'');
  headline_value text:=nullif(btrim(p_headline),''); teaching_value text:=nullif(btrim(p_teaching_experience),'');
  bio_value text:=nullif(btrim(p_bio),''); motivation_value text:=nullif(btrim(p_motivation),''); portfolio_value text:=nullif(btrim(p_portfolio_url),'');
  expertise_value text[]:=array(select distinct btrim(item) from unnest(coalesce(p_expertise,array[]::text[])) item where btrim(item)<>'' order by btrim(item));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles profile where profile.id=auth.uid()) then raise exception 'Learning profile is not ready' using errcode='P0002'; end if;
  if country_value is null or char_length(country_value) not between 2 and 100
    or headline_value is null or char_length(headline_value) not between 2 and 160
    or coalesce(array_length(expertise_value,1),0) not between 1 and 12
    or p_years_experience is null or p_years_experience not between 0 and 60
    or teaching_value is null or char_length(teaching_value) not between 2 and 1500
    or bio_value is null or char_length(bio_value) not between 2 and 2000
    or motivation_value is null or char_length(motivation_value) not between 2 and 1500
    or (phone_value is not null and char_length(phone_value) not between 3 and 32)
    or (portfolio_value is not null and (char_length(portfolio_value)>500 or portfolio_value !~ '^https?://[^[:space:]]+$'))
  then raise exception 'Instructor application details are invalid' using errcode='22023'; end if;

  if exists(select 1 from public.instructor_profiles application where application.user_id=auth.uid()) then
    return query select application.approval_status,application.created_at from public.instructor_profiles application where application.user_id=auth.uid();
    return;
  end if;

  insert into public.instructor_profiles(user_id,country,phone,headline,expertise,years_experience,teaching_experience,bio,motivation,portfolio_url)
  values(auth.uid(),country_value,phone_value,headline_value,expertise_value,p_years_experience,teaching_value,bio_value,motivation_value,portfolio_value);
  return query select application.approval_status,application.created_at from public.instructor_profiles application where application.user_id=auth.uid();
end;$function$;

revoke all on function public.submit_own_instructor_application(text,text,text,text[],smallint,text,text,text,text) from public,anon;
grant execute on function public.submit_own_instructor_application(text,text,text,text[],smallint,text,text,text,text) to authenticated,postgres,service_role;

commit;
