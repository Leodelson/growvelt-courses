create or replace function public.is_approved_growvelt_instructor()
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  select public.has_growvelt_learning_capability('instructor')
    and exists (
      select 1
      from public.instructor_profiles as instructor_profile
      where instructor_profile.user_id = auth.uid()
        and instructor_profile.approval_status = 'approved'
    );
$function$;

grant execute on function "public"."is_approved_growvelt_instructor"() to "authenticated", "postgres", "service_role";

revoke all on function "public"."is_approved_growvelt_instructor"() from public;
