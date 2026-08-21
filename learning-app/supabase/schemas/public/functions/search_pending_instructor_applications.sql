create or replace function public.search_pending_instructor_applications (
  p_query  text    default null::text,
  p_limit  integer default 12,
  p_offset integer default 0
)
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
    review_note         text,
    total_applications  integer
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$
declare
  normalized_query text := nullif(lower(btrim(p_query)), '');
begin
  if auth.uid() is null or not public.is_growvelt_learning_admin() then
    raise exception 'Learning Admin capability required' using errcode = '42501';
  end if;

  if normalized_query is not null and length(normalized_query) > 120 then
    raise exception 'Search query is too long' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 48 or p_offset is null or p_offset < 0 then
    raise exception 'Invalid Instructor-review pagination' using errcode = '22023';
  end if;

  return query
  select
    application_row.user_id,
    profile_row.full_name,
    auth_user.email::text,
    application_row.country,
    application_row.phone,
    application_row.headline,
    application_row.bio,
    application_row.expertise,
    application_row.years_experience,
    application_row.teaching_experience,
    application_row.motivation,
    application_row.portfolio_url,
    application_row.approval_status,
    application_row.created_at,
    application_row.reviewed_at,
    application_row.review_note,
    count(*) over ()::integer
  from public.instructor_profiles as application_row
  join public.profiles as profile_row on profile_row.id = application_row.user_id
  join auth.users as auth_user on auth_user.id = application_row.user_id
  where application_row.approval_status = 'pending'
    and (
      normalized_query is null
      or strpos(lower(concat_ws(' ', profile_row.full_name, auth_user.email, application_row.country, application_row.headline, application_row.expertise::text)), normalized_query) > 0
    )
  order by application_row.created_at desc, application_row.user_id
  limit p_limit offset p_offset;
end;
$function$;

grant execute on function "public"."search_pending_instructor_applications"(text, integer, integer) to "authenticated", "postgres", "service_role";

revoke all on function "public"."search_pending_instructor_applications"(text, integer, integer) from public;
