-- Phase 1A controlled test-fixture renewal.
-- Preserves every fixture window as immutable history while allowing a guarded
-- successor for the same reserved test course and disposable learner.

drop index if exists public.learning_paystack_test_fixtures_course_key;

alter table public.learning_paystack_test_fixtures
  add column previous_fixture_id bigint;

alter table public.learning_paystack_test_fixtures
  add constraint learning_paystack_test_fixtures_previous_fixture_id_fkey
    foreign key (previous_fixture_id)
    references public.learning_paystack_test_fixtures(id)
    on delete restrict,
  add constraint learning_paystack_test_fixtures_previous_fixture_not_self_check
    check (previous_fixture_id is null or previous_fixture_id <> id);

create index learning_paystack_test_fixtures_course_history_idx
  on public.learning_paystack_test_fixtures(course_id, activated_at desc, id desc);

create unique index learning_paystack_test_fixtures_one_successor_key
  on public.learning_paystack_test_fixtures(previous_fixture_id)
  where previous_fixture_id is not null;

create or replace function public.protect_paystack_test_fixture_history()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  previous_row public.learning_paystack_test_fixtures%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.previous_fixture_id is null then
      if exists (
        select 1
        from public.learning_paystack_test_fixtures fixture
        where fixture.course_id = new.course_id
      ) then
        raise exception 'A historical fixture course must be renewed through the guarded renewal function'
          using errcode = '42501';
      end if;
    else
      select fixture.* into previous_row
      from public.learning_paystack_test_fixtures fixture
      where fixture.id = new.previous_fixture_id;

      if not found
        or previous_row.status <> 'closed'
        or previous_row.course_id <> new.course_id
        or previous_row.tester_id <> new.tester_id
        or previous_row.expires_at > new.activated_at
      then
        raise exception 'Fixture successor must follow a closed, expired window for the same course and tester'
          using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if old.id is distinct from new.id
    or old.course_id is distinct from new.course_id
    or old.tester_id is distinct from new.tester_id
    or old.expires_at is distinct from new.expires_at
    or old.activated_at is distinct from new.activated_at
    or old.activated_by is distinct from new.activated_by
    or old.previous_fixture_id is distinct from new.previous_fixture_id
  then
    raise exception 'Fixture identity and window history are immutable' using errcode = '42501';
  end if;

  if old.status = 'closed'
    or old.status <> 'active'
    or new.status <> 'closed'
    or new.closed_at is null
    or new.closed_by is null
    or char_length(btrim(new.close_reason)) not between 3 and 500
  then
    raise exception 'Only the one-way active-to-closed fixture transition is permitted'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function public.protect_paystack_test_fixture_history() from public, anon, authenticated;
grant execute on function public.protect_paystack_test_fixture_history() to postgres, service_role;

create trigger protect_paystack_test_fixture_history
before insert or update on public.learning_paystack_test_fixtures
for each row execute function public.protect_paystack_test_fixture_history();

create or replace function public.renew_paystack_test_fixture(
  p_previous_fixture_id bigint,
  p_operator_id uuid,
  p_expires_at timestamptz
)
returns table(
  fixture_id bigint,
  previous_fixture_id bigint,
  course_id bigint,
  tester_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  previous_row public.learning_paystack_test_fixtures%rowtype;
  course_row public.learning_courses%rowtype;
  rights_row public.course_rights_declarations%rowtype;
  fixture_key bigint;
  renewal_time timestamptz := now();
begin
  if p_previous_fixture_id is null or p_operator_id is null or p_expires_at is null then
    raise exception 'Previous fixture, operator, and expiry are required' using errcode = '22023';
  end if;
  if p_expires_at <= renewal_time + interval '15 minutes'
    or p_expires_at > renewal_time + interval '24 hours'
  then
    raise exception 'Fixture expiry must be between 15 minutes and 24 hours from now'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.account_capabilities capability
    where capability.user_id = p_operator_id
      and capability.capability = 'admin'
      and capability.status = 'active'
  ) then
    raise exception 'An active Growvelt Learning administrator is required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('phase1a-test-fixture', 0));

  select fixture.* into previous_row
  from public.learning_paystack_test_fixtures fixture
  where fixture.id = p_previous_fixture_id
  for update;
  if not found then
    raise exception 'Previous test fixture was not found' using errcode = 'P0002';
  end if;
  if previous_row.status = 'active' and previous_row.expires_at > renewal_time then
    raise exception 'The previous fixture window has not expired' using errcode = '22023';
  end if;
  if previous_row.status not in ('active', 'closed') then
    raise exception 'Previous fixture is not renewable' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.learning_paystack_test_fixtures fixture
    where fixture.previous_fixture_id = previous_row.id
  ) then
    raise exception 'The previous fixture already has a successor' using errcode = '23505';
  end if;

  if previous_row.status = 'active' then
    update public.learning_paystack_test_fixtures fixture
    set status = 'closed',
        closed_at = renewal_time,
        closed_by = p_operator_id,
        close_reason = 'Expired fixture window closed during guarded renewal'
    where fixture.id = previous_row.id;

    insert into public.learning_audit_events(
      actor_user_id, actor_role, action, entity_type, entity_id, metadata
    ) values (
      p_operator_id,
      'admin_operator',
      'paystack_test_fixture.expired',
      'paystack_test_fixture',
      previous_row.id::text,
      jsonb_build_object(
        'course_id', previous_row.course_id,
        'tester_id', previous_row.tester_id,
        'expired_at', previous_row.expires_at,
        'recorded_at', renewal_time
      )
    );
  end if;

  if exists (
    select 1 from public.learning_paystack_test_fixtures fixture
    where fixture.status = 'active'
  ) then
    raise exception 'An active Paystack test fixture already exists' using errcode = '23505';
  end if;

  if not exists (select 1 from public.profiles where id = previous_row.tester_id) then
    raise exception 'Disposable learner profile was not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.account_capabilities capability
    where capability.user_id = previous_row.tester_id
      and capability.status = 'active'
      and capability.capability in ('admin', 'instructor')
  ) then
    raise exception 'Fixture tester must remain a learner-only disposable account'
      using errcode = '22023';
  end if;

  select course.* into course_row
  from public.learning_courses course
  where course.id = previous_row.course_id
  for update;
  if not found or course_row.status not in ('draft', 'published', 'archived') then
    raise exception 'Historical test course is not in a renewable state' using errcode = 'P0002';
  end if;
  if course_row.slug !~ '^phase1a-paystack-test-[a-z0-9-]+$'
    or course_row.title !~ '^\[TEST\] '
  then
    raise exception 'Fixture course must retain the reserved test title and slug markers'
      using errcode = '22023';
  end if;
  if course_row.instructor_id is null or not exists (
    select 1 from public.account_capabilities capability
    where capability.user_id = course_row.instructor_id
      and capability.capability = 'instructor'
      and capability.status = 'active'
  ) then
    raise exception 'Fixture course must remain owned by an approved instructor'
      using errcode = '42501';
  end if;
  if course_row.is_free
    or course_row.is_limited_time_free
    or course_row.price_amount is null
    or course_row.price_amount <= 0
    or course_row.price_currency <> 'NGN'
    or scale(course_row.price_amount) > 2
  then
    raise exception 'Fixture course must retain an eligible paid NGN price'
      using errcode = '22023';
  end if;
  if char_length(btrim(course_row.title)) not between 3 and 160
    or char_length(btrim(course_row.summary)) not between 10 and 320
    or char_length(btrim(course_row.description)) not between 40 and 10000
    or course_row.category not in (
      'Data Analytics','Business','Data Science','Business Intelligence','Programming',
      'Web Development','Cybersecurity','Digital Marketing','Creative Skills',
      'Digital Skills','Productivity'
    )
    or course_row.level not in (
      'Beginner','Intermediate','Beginner to intermediate','Beginner to job-ready'
    )
  then
    raise exception 'Complete the required test-course metadata before renewal'
      using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.course_modules module where module.course_id = course_row.id
  ) or not exists (
    select 1 from public.lessons lesson where lesson.course_id = course_row.id
  ) then
    raise exception 'The test course must retain at least one module and one lesson'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.course_modules module
    where module.course_id = course_row.id
      and char_length(btrim(module.title)) not between 2 and 160
  ) then
    raise exception 'Complete every module title before renewal' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.lessons lesson
    left join public.course_modules module
      on module.id = lesson.module_id and module.course_id = lesson.course_id
    where lesson.course_id = course_row.id and (
      module.id is null
      or char_length(btrim(lesson.title)) not between 2 and 160
      or lesson.lesson_type not in ('video', 'text', 'quiz')
      or (lesson.lesson_type = 'video' and (
        lesson.content is not null
        or lesson.video_provider is distinct from 'youtube'
        or lesson.video_reference is null
        or lesson.video_reference !~ '^[A-Za-z0-9_-]{11}$'
        or lesson.video_visibility not in ('public', 'unlisted')
        or lesson.duration_seconds not between 1 and 86400
        or lesson.video_url is not null
        or lesson.duration_minutes is not null
      ))
      or (lesson.lesson_type = 'text' and (
        lesson.content is null
        or char_length(btrim(lesson.content)) not between 1 and 20000
        or lesson.video_provider is not null
        or lesson.video_reference is not null
        or lesson.video_visibility is not null
        or lesson.duration_seconds is not null
        or lesson.video_url is not null
        or lesson.duration_minutes is not null
      ))
    )
  ) then
    raise exception 'Complete every lesson before renewal' using errcode = '22023';
  end if;

  if exists (
      select 1 from public.learning_orders orders
      where orders.learner_id = previous_row.tester_id and orders.course_id = previous_row.course_id
    )
    or exists (
      select 1 from public.learning_payment_attempts attempt
      join public.learning_orders orders on orders.id = attempt.order_id
      where orders.learner_id = previous_row.tester_id and orders.course_id = previous_row.course_id
    )
    or exists (
      select 1 from public.learning_payment_provider_events event
      join public.learning_orders orders on orders.id = event.order_id
      where orders.learner_id = previous_row.tester_id and orders.course_id = previous_row.course_id
    )
    or exists (
      select 1 from public.learning_ledger_transactions transaction
      join public.learning_orders orders on orders.id = transaction.order_id
      where orders.learner_id = previous_row.tester_id and orders.course_id = previous_row.course_id
    )
    or exists (
      select 1 from public.learning_ledger_entries entry
      join public.learning_ledger_transactions transaction on transaction.id = entry.transaction_id
      join public.learning_orders orders on orders.id = transaction.order_id
      where orders.learner_id = previous_row.tester_id and orders.course_id = previous_row.course_id
    )
    or exists (
      select 1 from public.learning_course_entitlements entitlement
      where entitlement.learner_id = previous_row.tester_id
        and entitlement.course_id = previous_row.course_id
    )
    or exists (
      select 1 from public.enrollments enrollment
      where enrollment.learner_id = previous_row.tester_id
        and enrollment.course_id = previous_row.course_id
    )
  then
    raise exception 'A fixture with financial or access history cannot be renewed'
      using errcode = '23505';
  end if;

  select declaration.* into rights_row
  from public.course_rights_declarations declaration
  where declaration.course_id = previous_row.course_id
    and declaration.instructor_id = course_row.instructor_id
    and declaration.declaration_version = '2026-08-v1'
    and declaration.rights_basis in ('original', 'licensed', 'authorized')
  order by declaration.accepted_at desc, declaration.id desc
  limit 1;
  if not found then
    raise exception 'The historical fixture rights declaration was not found'
      using errcode = 'P0002';
  end if;

  insert into public.course_rights_declarations(
    course_id, instructor_id, declaration_version, rights_basis
  ) values (
    previous_row.course_id,
    course_row.instructor_id,
    rights_row.declaration_version,
    rights_row.rights_basis
  );

  update public.learning_courses course
  set status = 'published',
      submitted_at = renewal_time,
      reviewed_at = renewal_time,
      reviewed_by = p_operator_id,
      review_note = 'Phase 1A controlled Paystack test fixture renewal',
      published_at = renewal_time,
      updated_at = renewal_time
  where course.id = previous_row.course_id;

  insert into public.learning_paystack_test_fixtures(
    course_id, tester_id, expires_at, activated_by, previous_fixture_id
  ) values (
    previous_row.course_id,
    previous_row.tester_id,
    p_expires_at,
    p_operator_id,
    previous_row.id
  ) returning id into fixture_key;

  insert into public.learning_audit_events(
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    p_operator_id,
    'admin_operator',
    'paystack_test_fixture.renewed',
    'paystack_test_fixture',
    fixture_key::text,
    jsonb_build_object(
      'previous_fixture_id', previous_row.id,
      'course_id', previous_row.course_id,
      'tester_id', previous_row.tester_id,
      'expires_at', p_expires_at
    )
  );

  insert into public.learning_audit_events(
    actor_user_id, actor_role, action, entity_type, entity_id, metadata
  ) values (
    p_operator_id,
    'admin_operator',
    'paystack_test_fixture.activated',
    'paystack_test_fixture',
    fixture_key::text,
    jsonb_build_object(
      'course_id', previous_row.course_id,
      'tester_id', previous_row.tester_id,
      'expires_at', p_expires_at,
      'previous_fixture_id', previous_row.id,
      'activation_type', 'renewal'
    )
  );

  return query
  select fixture_key, previous_row.id, previous_row.course_id, previous_row.tester_id, p_expires_at;
end;
$function$;

revoke all on function public.renew_paystack_test_fixture(bigint, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.renew_paystack_test_fixture(bigint, uuid, timestamptz)
  to postgres, service_role;
