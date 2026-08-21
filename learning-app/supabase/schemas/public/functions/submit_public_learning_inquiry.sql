create or replace function public.submit_public_learning_inquiry (
  p_inquiry_type text,
  p_name         text,
  p_email        text,
  p_subject      text,
  p_message      text,
  p_organization text default null::text,
  p_phone        text default null::text,
  p_website      text default null::text
)
  returns table (
    inquiry_id   bigint,
    submitted_at timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  normalized_type text := lower(btrim(coalesce(p_inquiry_type, '')));
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  normalized_subject text := btrim(coalesce(p_subject, ''));
  normalized_message text := btrim(coalesce(p_message, ''));
  normalized_organization text := nullif(btrim(coalesce(p_organization, '')), '');
  normalized_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  inserted_id bigint;
  inserted_at timestamptz;
begin
  if nullif(btrim(coalesce(p_website, '')), '') is not null then
    raise exception 'Unable to submit this message' using errcode = '22023';
  end if;

  if normalized_type not in ('contact', 'partnership')
    or char_length(normalized_name) not between 2 and 160
    or char_length(normalized_email) not between 3 and 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(normalized_subject) not between 2 and 160
    or char_length(normalized_message) not between 20 and 5000
    or (normalized_organization is not null and char_length(normalized_organization) not between 2 and 160)
    or (normalized_phone is not null and char_length(normalized_phone) not between 3 and 32)
    or (normalized_type = 'partnership' and normalized_organization is null) then
    raise exception 'Invalid public inquiry' using errcode = '22023';
  end if;

  insert into public.learning_public_inquiries (
    inquiry_type,
    full_name,
    email,
    subject,
    message,
    organization,
    phone,
    source_page
  )
  values (
    normalized_type,
    normalized_name,
    normalized_email,
    normalized_subject,
    normalized_message,
    normalized_organization,
    normalized_phone,
    'learn.growvelt.com'
  )
  returning learning_public_inquiries.id, learning_public_inquiries.created_at
    into inserted_id, inserted_at;

  return query select inserted_id, inserted_at;
end;
$function$;

grant execute on function "public"."submit_public_learning_inquiry"(text, text, text, text, text, text, text, text) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "public"."submit_public_learning_inquiry"(text, text, text, text, text, text, text, text) from public;
