-- Read-only source-aware access decision for a learner/course pair. This is
-- not yet wired into learner RPCs: all entry points must switch together.
-- A reversed-only paid company seat is distinguishable from an independently
-- earned grant without mutating the shared enrollment or historical progress.
begin;

create or replace function public.resolve_learning_course_access_sources(
  p_learner_id uuid,p_course_id bigint)
returns table(enrollment_id bigint,decision text,has_independent_source boolean,
  has_reversed_company_seat boolean,requires_manual_review boolean)
language plpgsql stable security definer set search_path to '' as $function$
declare enrollment_row public.enrollments%rowtype;
  course_row public.learning_courses%rowtype;
  independent_source boolean; reversed_source boolean;
  ambiguous_source boolean;
begin
  if p_learner_id is null or p_course_id is null then
    raise exception 'Learner and course are required' using errcode='22023';
  end if;
  select * into enrollment_row from public.enrollments enrollment
  where enrollment.learner_id=p_learner_id and enrollment.course_id=p_course_id
    and enrollment.status in ('active','completed');
  select * into course_row from public.learning_courses course
  where course.id=p_course_id and course.status='published';
  if enrollment_row.id is null or course_row.id is null then
    return query select null::bigint,'not_enrolled'::text,false,false,false;
    return;
  end if;

  select
    exists(select 1 from public.learning_free_enrollment_claims claim
      where claim.learner_id=p_learner_id and claim.course_id=p_course_id
        and claim.enrollment_id=enrollment_row.id)
    or exists(select 1 from public.learning_course_entitlements entitlement
      where entitlement.learner_id=p_learner_id and entitlement.course_id=p_course_id
        and entitlement.status='active')
    or exists(select 1 from public.learning_company_free_assignment_origins origin
      join public.learning_company_course_assignments assignment
        on assignment.id=origin.assignment_id and assignment.status='active'
      join public.learning_company_workspaces workspace
        on workspace.id=assignment.workspace_id and workspace.status='active'
      join public.learning_company_memberships membership
        on membership.workspace_id=workspace.id and membership.user_id=p_learner_id
          and membership.status='active'
      where origin.enrollment_id=enrollment_row.id
        and assignment.assigned_user_id=p_learner_id and assignment.course_id=p_course_id)
    or exists(select 1 from public.learning_company_paid_seat_access source
      join public.learning_company_paid_course_purchases purchase
        on purchase.id=source.purchase_id and purchase.status='paid'
      where source.assigned_user_id=p_learner_id and source.enrollment_id=enrollment_row.id
        and source.status='active' and purchase.course_id=p_course_id),
    exists(select 1 from public.learning_company_paid_seat_access source
      join public.learning_company_paid_course_purchases purchase
        on purchase.id=source.purchase_id
      where source.assigned_user_id=p_learner_id and source.enrollment_id=enrollment_row.id
        and source.status in ('refunded','chargeback') and purchase.course_id=p_course_id),
    exists(select 1 from public.learning_company_paid_seat_access source
      join public.learning_company_paid_course_purchases purchase
        on purchase.id=source.purchase_id
      where source.assigned_user_id=p_learner_id and source.enrollment_id=enrollment_row.id
        and source.status in ('refunded','chargeback') and purchase.course_id=p_course_id
        and (source.assignment_was_active_before_purchase
          or source.enrollment_was_active_before_purchase))
    or exists(select 1 from public.learning_company_course_assignments assignment
      where assignment.assigned_user_id=p_learner_id and assignment.course_id=p_course_id
        and assignment.status='active'
        and not exists(select 1 from public.learning_company_free_assignment_origins origin
          where origin.assignment_id=assignment.id)
        and not exists(select 1 from public.learning_company_paid_seat_access source
          where source.assignment_id=assignment.id))
    or exists(select 1 from public.learning_orders personal_order
      where personal_order.learner_id=p_learner_id and personal_order.course_id=p_course_id
        and personal_order.status in ('paid','partially_refunded'))
    or enrollment_row.status='completed'
    or course_row.instructor_id=p_learner_id
    or (coalesce(course_row.is_free,false) and coalesce(course_row.price_amount,0)=0)
  into independent_source,reversed_source,ambiguous_source;

  return query select enrollment_row.id,
    case when independent_source then 'confirmed_source'
      when not reversed_source then 'legacy_active_enrollment'
      when ambiguous_source then 'manual_review'
      else 'reversed_only' end::text,
    independent_source,reversed_source,
    (reversed_source and not independent_source and ambiguous_source);
end;$function$;

revoke all on function public.resolve_learning_course_access_sources(uuid,bigint)
  from public,anon,authenticated;
grant execute on function public.resolve_learning_course_access_sources(uuid,bigint)
  to postgres,service_role;

commit;
