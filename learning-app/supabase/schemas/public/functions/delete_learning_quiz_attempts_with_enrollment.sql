create or replace function public.delete_learning_quiz_attempts_with_enrollment()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
  AS $function$
begin
  delete from public.quiz_attempts where enrollment_id = old.id;
  return old;
end;
$function$;

grant execute on function "public"."delete_learning_quiz_attempts_with_enrollment"() to "postgres", "service_role";

revoke all on function "public"."delete_learning_quiz_attempts_with_enrollment"() from public;
