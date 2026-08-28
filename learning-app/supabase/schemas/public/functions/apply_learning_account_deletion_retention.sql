create or replace function public.apply_learning_account_deletion_retention()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
declare
  requested_choice text;
begin
  if exists (
    select 1
    from public.account_capabilities
    where user_id = old.id
      and capability = 'admin'
      and status = 'active'
  ) then
    raise exception 'Active Learning administrators require managed offboarding' using errcode = '42501';
  end if;

  if exists (select 1 from public.learning_courses where instructor_id = old.id)
    or exists (select 1 from public.course_rights_declarations where instructor_id = old.id)
  then
    raise exception 'Instructors with course content require managed offboarding' using errcode = '42501';
  end if;

  select certificate_choice
  into requested_choice
  from public.learning_account_deletion_requests
  where user_id = old.id;

  requested_choice := coalesce(requested_choice, 'remove_public_verification');

  if requested_choice = 'keep_verifiable' then
    update public.certificates
    set learner_id = null,
        retention_state = 'preserved_after_account_deletion',
        account_deleted_at = now()
    where learner_id = old.id;
  else
    update public.certificates
    set learner_id = null,
        learner_name = null,
        status = 'revoked',
        revoked_at = coalesce(revoked_at, now()),
        retention_state = 'anonymized_after_account_deletion',
        account_deleted_at = now()
    where learner_id = old.id;
  end if;

  return old;
end;
$function$;

grant execute on function "public"."apply_learning_account_deletion_retention"() to "postgres", "service_role";

revoke all on function "public"."apply_learning_account_deletion_retention"() from public;
