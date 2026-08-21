create or replace function public.list_pending_instructor_applications()
  returns table (
    user_id             uuid,
    full_name           text,
    email               text,
    country             text,
    phone               text,
    headline            text,
    bio                 text,
    expertise           text[],
    years_experience    smallint,
    teaching_experience text,
    motivation          text,
    portfolio_url       text,
    approval_status     text,
    created_at          timestamp with time zone,
    reviewed_at         timestamp with time zone,
    reviewed_by         uuid,
    review_note         text
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
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
$function$;

grant execute on function "public"."list_pending_instructor_applications"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_pending_instructor_applications"() from public;
