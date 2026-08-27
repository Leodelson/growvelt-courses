-- Positive assertions run after the one-time migration inside a rolled-back local transaction.
do $course_27_positive_assertions$
declare
  activation record;
begin
  if not exists (
    select 1 from public.learning_courses
    where id = 27
      and slug = 'phase1a-paystack-test-phase1b1-abandoned-checkout-recovery'
      and title = '[TEST] Phase 1B1 Abandoned Checkout Recovery'
      and status = 'draft'
      and submitted_at is null and reviewed_at is null and reviewed_by is null
      and review_note is null and published_at is null
  ) then
    raise exception 'Course 27 was not corrected without lifecycle changes';
  end if;

  if not exists (
    select 1 from public.learning_audit_events
    where actor_user_id = '3df25e55-b501-480c-b608-8ea51dad6e84'
      and actor_role = 'admin_operator'
      and action = 'learning_course.test_slug_corrected'
      and entity_type = 'learning_course'
      and entity_id = '27'
      and metadata->>'old_slug' = 'test-phase-1b1-abandoned-checkout-recovery'
      and metadata->>'new_slug' = 'phase1a-paystack-test-phase1b1-abandoned-checkout-recovery'
  ) then
    raise exception 'Immutable slug-correction audit event was not captured';
  end if;

  select * into activation
  from public.activate_paystack_test_fixture(
    27,
    '2b8dbe77-a6a1-44c4-89f4-cb93d5706bb5',
    '3df25e55-b501-480c-b608-8ea51dad6e84',
    now() + interval '24 hours',
    '2026-08-v1',
    'original'
  );

  if activation.course_id <> 27
    or activation.tester_id <> '2b8dbe77-a6a1-44c4-89f4-cb93d5706bb5'
    or not exists (select 1 from public.learning_paystack_test_fixtures where id = activation.fixture_id and status = 'active')
  then
    raise exception 'Corrected course was not accepted by guarded fixture activation';
  end if;
end;
$course_27_positive_assertions$;
