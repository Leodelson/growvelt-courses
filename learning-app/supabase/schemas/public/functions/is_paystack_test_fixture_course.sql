create or replace function public.is_paystack_test_fixture_course(p_course_id bigint)
returns boolean language sql stable security definer set search_path to '' as $function$
  select exists(select 1 from public.learning_paystack_test_fixtures where course_id=p_course_id);
$function$;
revoke all on function public.is_paystack_test_fixture_course(bigint) from public;
grant execute on function public.is_paystack_test_fixture_course(bigint) to anon,authenticated,postgres,service_role;
