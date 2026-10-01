-- Read-only, service-only assessment of shared access after a posted and
-- source-marked company reversal. A candidate is NOT authorization to revoke;
-- no enrollment, assignment, progress, or payment rows are changed here.
begin;

create or replace function public.assess_learning_company_reversal_access(p_reversal_id bigint)
returns table(
  reversal_id bigint,assigned_user_id uuid,course_id bigint,enrollment_id bigint,
  enrollment_status text,free_self_claim boolean,active_free_company_assignment boolean,
  active_personal_entitlement boolean,other_active_paid_seat boolean,
  preexisting_access boolean,unknown_active_assignment boolean,decision text)
language sql stable security definer set search_path to '' as $function$
  with seat as (
    select reversal.id as reversal_id,line.assigned_user_id,
      purchase.id as purchase_id,purchase.course_id,
      source.assignment_id,source.enrollment_id,
      source.assignment_was_active_before_purchase,
      source.enrollment_was_active_before_purchase,
      enrollment.status as enrollment_status,
      course.is_free,course.price_amount,course.instructor_id
    from public.learning_company_commercial_reversals reversal
    join public.learning_company_commercial_reversal_lines line
      on line.reversal_id=reversal.id
    join public.learning_company_paid_course_purchases purchase
      on purchase.id=reversal.purchase_id and line.purchase_id=purchase.id
    join public.learning_company_paid_seat_access source
      on source.purchase_id=purchase.id
        and source.assigned_user_id=line.assigned_user_id
        and source.status in ('refunded','chargeback')
    join public.learning_company_reversal_access_results result_row
      on result_row.reversal_id=reversal.id
        and result_row.assigned_user_id=line.assigned_user_id
        and result_row.assignment_id=source.assignment_id
        and result_row.enrollment_id=source.enrollment_id
    join public.learning_courses course on course.id=purchase.course_id
    left join public.enrollments enrollment
      on enrollment.id=source.enrollment_id
        and enrollment.learner_id=line.assigned_user_id
        and enrollment.course_id=purchase.course_id
    where reversal.id=p_reversal_id
  ), signals as (
    select seat.*,
      exists(select 1 from public.learning_free_enrollment_claims claim
        where claim.learner_id=seat.assigned_user_id
          and claim.course_id=seat.course_id
          and claim.enrollment_id=seat.enrollment_id) as free_self_claim,
      exists(select 1 from public.learning_company_free_assignment_origins origin
        join public.learning_company_course_assignments assignment
          on assignment.id=origin.assignment_id and assignment.status='active'
        join public.learning_company_workspaces workspace
          on workspace.id=assignment.workspace_id and workspace.status='active'
        join public.learning_company_memberships membership
          on membership.workspace_id=workspace.id
            and membership.user_id=seat.assigned_user_id
            and membership.status='active'
        where origin.enrollment_id=seat.enrollment_id
          and assignment.course_id=seat.course_id
          and assignment.assigned_user_id=seat.assigned_user_id)
        as active_free_company_assignment,
      exists(select 1 from public.learning_course_entitlements entitlement
        where entitlement.learner_id=seat.assigned_user_id
          and entitlement.course_id=seat.course_id
          and entitlement.status='active') as active_personal_entitlement,
      exists(select 1 from public.learning_company_paid_seat_access other_source
        join public.learning_company_paid_course_purchases other_purchase
          on other_purchase.id=other_source.purchase_id
            and other_purchase.status='paid'
        where other_source.assigned_user_id=seat.assigned_user_id
          and other_source.purchase_id<>seat.purchase_id
          and other_source.enrollment_id=seat.enrollment_id
          and other_source.status='active'
          and other_purchase.course_id=seat.course_id) as other_active_paid_seat,
      exists(select 1 from public.learning_company_course_assignments other_assignment
        where other_assignment.assigned_user_id=seat.assigned_user_id
          and other_assignment.course_id=seat.course_id
          and other_assignment.status='active'
          and other_assignment.id<>seat.assignment_id) as unknown_active_assignment,
      exists(select 1 from public.learning_orders personal_order
        where personal_order.learner_id=seat.assigned_user_id
          and personal_order.course_id=seat.course_id
          and personal_order.status in ('paid','partially_refunded')) as personal_order_record
    from seat
  )
  select signals.reversal_id,signals.assigned_user_id,signals.course_id,
    signals.enrollment_id,signals.enrollment_status,
    signals.free_self_claim,signals.active_free_company_assignment,
    signals.active_personal_entitlement,signals.other_active_paid_seat,
    (signals.assignment_was_active_before_purchase
      or signals.enrollment_was_active_before_purchase) as preexisting_access,
    signals.unknown_active_assignment,
    case
      when signals.enrollment_status is null
        or signals.enrollment_status not in ('active','completed') then 'already_inactive'
      when signals.free_self_claim or signals.active_free_company_assignment
        or signals.active_personal_entitlement or signals.other_active_paid_seat
        then 'retain_independent_source'
      when signals.assignment_was_active_before_purchase
        or signals.enrollment_was_active_before_purchase
        or signals.unknown_active_assignment
        or signals.personal_order_record
        or signals.enrollment_status='completed'
        or signals.instructor_id=signals.assigned_user_id
        or (coalesce(signals.is_free,false) and coalesce(signals.price_amount,0)=0)
        then 'manual_review'
      else 'unproven_exclusive_candidate'
    end as decision
  from signals
  order by signals.assigned_user_id;
$function$;

revoke all on function public.assess_learning_company_reversal_access(bigint)
  from public,anon,authenticated;
grant execute on function public.assess_learning_company_reversal_access(bigint)
  to postgres,service_role;

commit;
