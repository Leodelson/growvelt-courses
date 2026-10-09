-- Coupon checkout is currently Test Mode-only and redemption requires the
-- assigned active fixture. Keep the admin selector consistent with that rule.

begin;

create or replace function public.is_learning_promotion_course_eligible(p_course_id bigint)
returns boolean
language sql stable security definer set search_path to '' as $function$
  select exists (
    select 1
    from public.learning_courses course
    join public.profiles instructor on instructor.id = course.instructor_id
    where course.id = p_course_id
      and nullif(btrim(instructor.full_name), '') is not null
      and course.status = 'published'
      and course.is_free = false
      and coalesce(course.is_limited_time_free, false) = false
      and coalesce(course.company_test_mode_only, false) = false
      and course.organization_id is null
      and course.price_currency = 'NGN'
      and course.price_amount > 0
      and exists (
        select 1
        from public.learning_paystack_test_fixtures fixture
        where fixture.course_id = course.id
          and fixture.status = 'active'
          and fixture.expires_at > now()
      )
  );
$function$;

revoke all on function public.is_learning_promotion_course_eligible(bigint)
  from public, anon, authenticated;
grant execute on function public.is_learning_promotion_course_eligible(bigint)
  to postgres, service_role;

commit;
