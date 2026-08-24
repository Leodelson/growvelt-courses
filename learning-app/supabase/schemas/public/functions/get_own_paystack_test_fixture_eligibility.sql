create or replace function public.get_own_paystack_test_fixture_eligibility(p_course_id bigint)
returns table (eligible boolean, fixture_id bigint, expires_at timestamptz)
language sql stable security definer set search_path to '' as $function$
  select
    coalesce(bool_or(
      fixture.status='active' and fixture.expires_at>now() and fixture.tester_id=auth.uid()
      and course.status='published' and course.is_free=false and course.is_limited_time_free=false
      and course.price_amount>0 and course.price_currency='NGN'
    ),false),
    min(fixture.id) filter(where fixture.status='active' and fixture.expires_at>now() and fixture.tester_id=auth.uid()),
    min(fixture.expires_at) filter(where fixture.status='active' and fixture.expires_at>now() and fixture.tester_id=auth.uid())
  from public.learning_paystack_test_fixtures fixture join public.learning_courses course on course.id=fixture.course_id
  where fixture.course_id=p_course_id and auth.uid() is not null;
$function$;
revoke all on function public.get_own_paystack_test_fixture_eligibility(bigint) from public,anon;
grant execute on function public.get_own_paystack_test_fixture_eligibility(bigint) to authenticated,postgres,service_role;
