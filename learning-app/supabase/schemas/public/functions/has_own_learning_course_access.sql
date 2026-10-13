create or replace function public.has_own_learning_course_access(p_learner_id uuid, p_course_id bigint)
  returns boolean
  language sql
  stable
  security definer
  set search_path to ''
  AS $function$
  with own_enrollment as (
    select enrollment.id, enrollment.status
    from public.enrollments enrollment
    join public.learning_courses course
      on course.id = enrollment.course_id and course.status = 'published'
    where enrollment.learner_id = p_learner_id
      and enrollment.course_id = p_course_id
      and enrollment.status in ('active', 'completed')
  ), source_state as (
    select exists (
      select 1 from public.learning_subscription_course_enrollment_sources source
      join own_enrollment enrollment on enrollment.id = source.enrollment_id
      where source.learner_id = p_learner_id and source.course_id = p_course_id
    ) as has_subscription_provenance,
    exists (
      select 1 from public.learning_subscription_course_enrollment_sources source
      join own_enrollment enrollment on enrollment.id = source.enrollment_id
      where source.learner_id = p_learner_id and source.course_id = p_course_id
        and source.preexisting_access
    ) as had_access_before_subscription,
    exists (
      select 1
      from public.learning_subscription_course_enrollment_sources source
      join own_enrollment enrollment on enrollment.id = source.enrollment_id
      join public.learning_subscriptions subscription
        on subscription.id = source.subscription_id and subscription.learner_id = source.learner_id
      join public.learning_subscription_invoices invoice
        on invoice.subscription_id = subscription.id
       and invoice.status = 'paid'
       and invoice.payment_domain = 'test'
       and now() >= invoice.billing_period_starts_at
       and now() < invoice.paid_through
      join public.learning_subscription_invoice_courses included
        on included.invoice_id = invoice.id and included.course_id = source.course_id
      where source.learner_id = p_learner_id and source.course_id = p_course_id
        and subscription.payment_domain = 'test'
        and subscription.status in ('active', 'non_renewing', 'attention', 'cancelled', 'completed')
    ) as has_paid_subscription_period,
    exists (
      select 1 from public.learning_free_enrollment_claims claim
      join own_enrollment enrollment on enrollment.id = claim.enrollment_id
      where claim.learner_id = p_learner_id and claim.course_id = p_course_id
    ) or exists (
      select 1 from public.learning_course_entitlements entitlement
      where entitlement.learner_id = p_learner_id and entitlement.course_id = p_course_id
        and entitlement.status = 'active'
    ) or exists (
      select 1
      from public.learning_company_free_assignment_origins origin
      join public.learning_company_course_assignments assignment
        on assignment.id = origin.assignment_id and assignment.status = 'active'
      join public.learning_company_workspaces workspace
        on workspace.id = assignment.workspace_id and workspace.status = 'active'
      join public.learning_company_memberships membership
        on membership.workspace_id = workspace.id and membership.user_id = p_learner_id
         and membership.status = 'active'
      join own_enrollment enrollment on enrollment.id = origin.enrollment_id
      where assignment.assigned_user_id = p_learner_id and assignment.course_id = p_course_id
    ) or exists (
      select 1
      from public.learning_company_paid_seat_access source
      join public.learning_company_paid_course_purchases purchase
        on purchase.id = source.purchase_id and purchase.status = 'paid'
      join own_enrollment enrollment on enrollment.id = source.enrollment_id
      where source.assigned_user_id = p_learner_id and purchase.course_id = p_course_id
        and source.status = 'active'
    ) or exists (
      select 1 from public.learning_orders order_row
      where order_row.learner_id = p_learner_id and order_row.course_id = p_course_id
        and order_row.status in ('paid', 'partially_refunded')
    ) or exists (
      select 1 from public.learning_courses course
      where course.id = p_course_id and course.instructor_id = p_learner_id
    ) or exists (
      select 1 from public.learning_courses course
      where course.id = p_course_id and coalesce(course.is_free, false)
        and coalesce(course.price_amount, 0) = 0
    ) as has_non_subscription_source
  )
  select case
    when not exists (select 1 from own_enrollment) then false
    when not (select has_subscription_provenance from source_state) then true
    else (select had_access_before_subscription or has_paid_subscription_period or has_non_subscription_source from source_state)
  end;
$function$;

revoke all on function public.has_own_learning_course_access(uuid, bigint) from public, anon, authenticated;
grant execute on function public.has_own_learning_course_access(uuid, bigint) to postgres, service_role;
