create or replace function public.list_own_learning_certificates()
  returns table (
    certificate_code   text,
    course_title       text,
    learner_name       text,
    completed_at       timestamp with time zone,
    issued_at          timestamp with time zone,
    certificate_status text
  )
  language plpgsql
  stable
  security definer
  set search_path to ''
  AS $function$ begin if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if; return query select certificate_row.certificate_code,certificate_row.course_title,certificate_row.learner_name,certificate_row.completed_at,certificate_row.issued_at,certificate_row.status from public.certificates as certificate_row where certificate_row.learner_id=auth.uid() order by certificate_row.issued_at desc; end; $function$;

grant execute on function "public"."list_own_learning_certificates"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."list_own_learning_certificates"() from public;
