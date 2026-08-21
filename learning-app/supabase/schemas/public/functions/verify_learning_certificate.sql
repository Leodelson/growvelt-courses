create or replace function public.verify_learning_certificate (
  p_certificate_code text
)
  returns table (
    is_valid           boolean,
    certificate_code   text,
    learner_name       text,
    course_title       text,
    completed_at       timestamp with time zone,
    issued_at          timestamp with time zone,
    certificate_status text
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$ declare normalized_code text:=upper(btrim(p_certificate_code)); begin if normalized_code is null or normalized_code !~ '^[A-F0-9]{32}$' then return; end if; return query select certificate_row.status='issued',certificate_row.certificate_code,certificate_row.learner_name,certificate_row.course_title,certificate_row.completed_at,certificate_row.issued_at,certificate_row.status from public.certificates as certificate_row where certificate_row.certificate_code=normalized_code; end; $function$;

grant execute on function "public"."verify_learning_certificate"(text) to "anon", "authenticated", "postgres", "service_role";

revoke all on function "public"."verify_learning_certificate"(text) from public;
