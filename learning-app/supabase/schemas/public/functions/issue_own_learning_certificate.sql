create or replace function public.issue_own_learning_certificate (
  p_course_id bigint
)
  returns table (
    certificate_code   text,
    certificate_status text,
    issued_at          timestamp with time zone
  )
  language plpgsql
  security definer
  set search_path to ''
  AS $function$ declare state_row record; own_enrollment_id bigint; generated_code text; begin if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if; select enrollment_row.id into own_enrollment_id from public.enrollments as enrollment_row join public.learning_courses as course_row on course_row.id=enrollment_row.course_id and course_row.status='published' where enrollment_row.learner_id=auth.uid() and enrollment_row.course_id=p_course_id and enrollment_row.status='completed' and enrollment_row.completed_at is not null for update of enrollment_row,course_row; if own_enrollment_id is null then raise exception 'This course is not eligible for a certificate' using errcode='42501'; end if; select * into state_row from public.get_own_learning_certificate_state(p_course_id);if not coalesce(state_row.is_eligible,false) then raise exception 'This course is not eligible for a certificate' using errcode='22023'; end if; generated_code:=upper(replace(gen_random_uuid()::text,'-','')); insert into public.certificates(learner_id,course_id,certificate_code,learner_name,course_title,instructor_name,completed_at,status) select auth.uid(),course_row.id,generated_code,learner_profile.full_name,course_row.title,instructor_profile.full_name,enrollment_row.completed_at,'issued' from public.learning_courses as course_row join public.enrollments as enrollment_row on enrollment_row.id=own_enrollment_id left join public.profiles as learner_profile on learner_profile.id=auth.uid() left join public.profiles as instructor_profile on instructor_profile.id=course_row.instructor_id where course_row.id=p_course_id and learner_profile.full_name is not null on conflict(learner_id,course_id) do nothing; return query select certificate_row.certificate_code,certificate_row.status,certificate_row.issued_at from public.certificates as certificate_row where certificate_row.learner_id=auth.uid() and certificate_row.course_id=p_course_id; end; $function$;

grant execute on function "public"."issue_own_learning_certificate"(bigint) to "authenticated", "postgres", "service_role";

revoke all on function "public"."issue_own_learning_certificate"(bigint) from public;
