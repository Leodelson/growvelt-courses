-- Phase 1B1: one-time correction of the unpublished Recovery Test A course slug.
-- This is intentionally data-specific. It does not create a reusable slug-editing path.

do $course_27_slug_correction$
declare
  course_row public.learning_courses%rowtype;
  operator_id constant uuid := '3df25e55-b501-480c-b608-8ea51dad6e84';
  expected_instructor_id constant uuid := '1fa66aa4-86f4-4e0a-b613-2689c8a7cda0';
  old_slug constant text := 'test-phase-1b1-abandoned-checkout-recovery';
  new_slug constant text := 'phase1a-paystack-test-phase1b1-abandoned-checkout-recovery';
  expected_title constant text := '[TEST] Phase 1B1 Abandoned Checkout Recovery';
  changed_rows integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('learning-course-slug:' || new_slug, 0));

  select course.*
  into course_row
  from public.learning_courses course
  where course.id = 27
  for update;

  if not found then
    raise exception 'Guarded course 27 slug correction: course not found' using errcode = 'P0002';
  end if;

  if course_row.slug <> old_slug
    or course_row.title <> expected_title
    or course_row.status <> 'draft'
    or course_row.submitted_at is not null
    or course_row.reviewed_at is not null
    or course_row.reviewed_by is not null
    or course_row.review_note is not null
    or course_row.published_at is not null
  then
    raise exception 'Guarded course 27 slug correction: course identity or lifecycle changed' using errcode = '22023';
  end if;

  if course_row.instructor_id is distinct from expected_instructor_id
    or not exists (
      select 1
      from public.instructor_profiles profile
      where profile.user_id = course_row.instructor_id
        and profile.approval_status = 'approved'
    )
    or not exists (
      select 1
      from public.account_capabilities capability
      where capability.user_id = course_row.instructor_id
        and capability.capability = 'instructor'
        and capability.status = 'active'
    )
  then
    raise exception 'Guarded course 27 slug correction: approved active instructor ownership required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.account_capabilities capability
    where capability.user_id = operator_id
      and capability.capability = 'admin'
      and capability.status = 'active'
  ) then
    raise exception 'Guarded course 27 slug correction: active administrator required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.learning_courses course
    where course.slug = new_slug and course.id <> course_row.id
  ) then
    raise exception 'Guarded course 27 slug correction: target slug is already used' using errcode = '23505';
  end if;

  if exists (select 1 from public.learning_paystack_test_fixtures fixture where fixture.course_id = course_row.id)
    or exists (select 1 from public.course_rights_declarations declaration where declaration.course_id = course_row.id)
    or exists (select 1 from public.learning_orders orders where orders.course_id = course_row.id)
    or exists (
      select 1 from public.learning_payment_attempts attempt
      join public.learning_orders orders on orders.id = attempt.order_id
      where orders.course_id = course_row.id
    )
    or exists (
      select 1 from public.learning_payment_provider_events event
      join public.learning_orders orders on orders.id = event.order_id
      where orders.course_id = course_row.id
    )
    or exists (
      select 1 from public.learning_ledger_transactions transaction
      join public.learning_orders orders on orders.id = transaction.order_id
      where orders.course_id = course_row.id
    )
    or exists (
      select 1 from public.learning_ledger_entries entry
      join public.learning_ledger_transactions transaction on transaction.id = entry.transaction_id
      join public.learning_orders orders on orders.id = transaction.order_id
      where orders.course_id = course_row.id
    )
    or exists (select 1 from public.learning_course_entitlements entitlement where entitlement.course_id = course_row.id)
    or exists (select 1 from public.enrollments enrollment where enrollment.course_id = course_row.id)
  then
    raise exception 'Guarded course 27 slug correction: fixture, rights, financial, or access history exists' using errcode = '23505';
  end if;

  update public.learning_courses course
  set slug = new_slug,
      updated_at = now()
  where course.id = course_row.id
    and course.slug = old_slug;

  get diagnostics changed_rows = row_count;
  if changed_rows <> 1 then
    raise exception 'Guarded course 27 slug correction: concurrent course change detected' using errcode = '40001';
  end if;

  insert into public.learning_audit_events (
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    operator_id,
    'admin_operator',
    'learning_course.test_slug_corrected',
    'learning_course',
    course_row.id::text,
    jsonb_build_object(
      'old_slug', old_slug,
      'new_slug', new_slug,
      'reason', 'Controlled pre-publication Phase 1B1 Recovery Test A correction',
      'course_status', course_row.status,
      'never_published', true
    )
  );
end;
$course_27_slug_correction$;
