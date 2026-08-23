-- Phase 0E payment-neutral financial-foundation regression suite.
-- The runner restricts execution to the isolated local Docker database.
-- No provider call or real payment occurs; all fixtures are rolled back.

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  is_sso_user, is_anonymous
) values
  ('00000000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'buyer@phase0e.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Financial Buyer"}', now(), now(), false, false),
  ('00000000-0000-4000-a000-000000000002', 'authenticated', 'authenticated', 'other@phase0e.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Other Learner"}', now(), now(), false, false),
  ('00000000-0000-4000-a000-000000000003', 'authenticated', 'authenticated', 'teacher@phase0e.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Financial Instructor"}', now(), now(), false, false);

insert into public.instructor_profiles (user_id, headline, bio, approval_status, reviewed_at)
values ('00000000-0000-4000-a000-000000000003', 'Instructor', 'Phase 0E fixture', 'approved', now());
insert into public.account_capabilities (user_id, capability, status)
values ('00000000-0000-4000-a000-000000000003', 'instructor', 'active');

insert into public.learning_courses (
  instructor_id, title, slug, summary, description, level, category,
  is_free, price_amount, price_currency, is_limited_time_free, status
) values (
  '00000000-0000-4000-a000-000000000003', 'Phase 0E Paid Draft', 'phase0e-paid-draft',
  'Payment-neutral fixture', 'A paid draft that cannot yet be published or purchased.',
  'Beginner', 'Business', false, 5000, 'NGN', false, 'draft'
);
select set_config('phase0e.course', (select id::text from public.learning_courses where slug = 'phase0e-paid-draft'), true);

insert into public.learning_orders (
  learner_id, course_id, instructor_id, course_title_snapshot,
  instructor_name_snapshot, gross_amount_minor, currency
) values (
  '00000000-0000-4000-a000-000000000001', current_setting('phase0e.course')::bigint,
  '00000000-0000-4000-a000-000000000003', 'Phase 0E Paid Draft',
  'Financial Instructor', 500000, 'NGN'
);

-- psql-safe order key without relying on a client-provided identifier.
select set_config('phase0e.order', (select id::text from public.learning_orders where learner_id = '00000000-0000-4000-a000-000000000001'), true);

do $order_guards$
declare blocked boolean;
begin
  blocked := false;
  begin update public.learning_orders set gross_amount_minor = 1 where id = current_setting('phase0e.order')::bigint;
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Order amount snapshot was mutable'; end if;

  update public.learning_orders set status = 'payment_pending' where id = current_setting('phase0e.order')::bigint;
  update public.learning_orders set status = 'paid', paid_at = now() where id = current_setting('phase0e.order')::bigint;

  blocked := false;
  begin update public.learning_orders set status = 'created', paid_at = null where id = current_setting('phase0e.order')::bigint;
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Order status moved backwards'; end if;
end
$order_guards$;

do $attempt_guards$
declare blocked boolean;
begin
  blocked := false;
  begin
    insert into public.learning_payment_attempts (order_id, provider, provider_reference, amount_minor, currency)
    values (current_setting('phase0e.order')::bigint, 'test_provider', 'wrong-amount', 1, 'NGN');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Payment attempt accepted a client-like amount mismatch'; end if;
end
$attempt_guards$;

insert into public.learning_payment_attempts (
  order_id, provider, provider_reference, amount_minor, currency, status, verified_at
) values (
  current_setting('phase0e.order')::bigint, 'test_provider', 'phase0e-attempt', 500000, 'NGN', 'succeeded', now()
);
select set_config('phase0e.attempt', (select id::text from public.learning_payment_attempts where provider_reference = 'phase0e-attempt'), true);

do $idempotency_guards$
declare blocked boolean;
begin
  blocked := false;
  begin
    insert into public.learning_payment_attempts (order_id, provider, provider_reference, amount_minor, currency)
    values (current_setting('phase0e.order')::bigint, 'test_provider', 'phase0e-attempt', 500000, 'NGN');
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'Duplicate provider reference was accepted'; end if;
end
$idempotency_guards$;

insert into public.learning_payment_provider_events (
  provider, provider_event_id, event_type, payload_digest, payload,
  signature_valid, processing_status, order_id, payment_attempt_id, processed_at
) values (
  'test_provider', 'phase0e-event', 'payment.success', repeat('a', 64),
  '{"safe_fixture":true}'::jsonb, true, 'processed', current_setting('phase0e.order')::bigint,
  current_setting('phase0e.attempt')::bigint, now()
);

do $provider_event_idempotency$
declare blocked boolean;
begin
  blocked := false;
  begin
    insert into public.learning_payment_provider_events (
      provider, provider_event_id, event_type, payload_digest, signature_valid
    ) values ('test_provider', 'phase0e-event', 'payment.success', repeat('b', 64), true);
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'Duplicate provider event was accepted'; end if;
end
$provider_event_idempotency$;

insert into public.learning_ledger_transactions (order_id, transaction_type, currency, description)
values (current_setting('phase0e.order')::bigint, 'payment_capture', 'NGN', 'Phase 0E balanced fixture');
select set_config('phase0e.ledger_transaction', (select id::text from public.learning_ledger_transactions where description = 'Phase 0E balanced fixture'), true);
insert into public.learning_ledger_entries (transaction_id, line_number, account_code, amount_minor, currency)
values
  (current_setting('phase0e.ledger_transaction')::bigint, 1, 'processor.receivable', 500000, 'NGN'),
  (current_setting('phase0e.ledger_transaction')::bigint, 2, 'course.sales', -500000, 'NGN');
set constraints all immediate;
set constraints all deferred;

do $ledger_guards$
declare blocked boolean;
begin
  blocked := false;
  begin
    update public.learning_ledger_entries set amount_minor = 400000
    where transaction_id = current_setting('phase0e.ledger_transaction')::bigint and line_number = 1;
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Ledger entry was mutable'; end if;

  blocked := false;
  begin
    insert into public.learning_ledger_transactions (order_id, transaction_type, currency, description)
    values (current_setting('phase0e.order')::bigint, 'adjustment', 'NGN', 'Unbalanced fixture');
    insert into public.learning_ledger_entries (transaction_id, line_number, account_code, amount_minor, currency)
    values ((select id from public.learning_ledger_transactions where description = 'Unbalanced fixture'), 1, 'processor.receivable', 1, 'NGN');
    set constraints all immediate;
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'Unbalanced ledger transaction committed'; end if;
  set constraints all deferred;
end
$ledger_guards$;

insert into public.learning_course_entitlements (learner_id, course_id, order_id)
values ('00000000-0000-4000-a000-000000000001', current_setting('phase0e.course')::bigint, current_setting('phase0e.order')::bigint);

do $entitlement_and_case_guards$
declare blocked boolean;
begin
  blocked := false;
  begin
    insert into public.learning_course_entitlements (learner_id, course_id, order_id)
    values ('00000000-0000-4000-a000-000000000002', current_setting('phase0e.course')::bigint, current_setting('phase0e.order')::bigint);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Foreign learner entitlement was accepted for the order'; end if;

  blocked := false;
  begin
    insert into public.learning_payment_cases (order_id, case_type, amount_minor, currency, reason)
    values (current_setting('phase0e.order')::bigint, 'refund', 500001, 'NGN', 'Too large');
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Over-order refund amount was accepted'; end if;
end
$entitlement_and_case_guards$;

insert into public.learning_payment_cases (
  order_id, payment_attempt_id, case_type, status, amount_minor, currency, reason
) values (
  current_setting('phase0e.order')::bigint, current_setting('phase0e.attempt')::bigint,
  'refund', 'opened', 100000, 'NGN', 'Admin-controlled fixture'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-a000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $browser_isolation$
declare table_name text;
begin
  foreach table_name in array array[
    'learning_orders', 'learning_payment_attempts', 'learning_payment_provider_events',
    'learning_ledger_transactions', 'learning_ledger_entries',
    'learning_course_entitlements', 'learning_payment_cases'
  ] loop
    if has_table_privilege('authenticated', 'public.' || table_name, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Authenticated browser role can access %', table_name;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.course_registrations', 'INSERT')
    or has_table_privilege('anon', 'public.course_registrations', 'INSERT')
  then raise exception 'Legacy course registration intake remains browser-writable'; end if;
end
$browser_isolation$;

reset role;

delete from auth.users where id = '00000000-0000-4000-a000-000000000001';

do $retention_and_audit$
begin
  if not exists (
    select 1 from public.learning_orders
    where id = current_setting('phase0e.order')::bigint and learner_id is null
      and course_title_snapshot = 'Phase 0E Paid Draft' and gross_amount_minor = 500000
  ) then raise exception 'Financial order did not survive learner deletion with its snapshot'; end if;
  if exists (select 1 from public.learning_course_entitlements where order_id = current_setting('phase0e.order')::bigint) then
    raise exception 'Operational entitlement survived deleted learner profile';
  end if;
  if (select count(*) from public.learning_audit_events where entity_type in ('learning_order', 'course_entitlement', 'payment_case')) < 5 then
    raise exception 'Financial state changes were not captured in the append-only audit log';
  end if;
end
$retention_and_audit$;

rollback;
