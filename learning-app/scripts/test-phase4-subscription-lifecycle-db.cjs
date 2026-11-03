/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_PACKAGE_PATH || '@electric-sql/pglite');

const migrationPaths = [
  '../supabase/migrations/20261022000000_add_private_learning_subscription_foundation.sql',
  '../supabase/migrations/20261023000000_add_learning_subscription_plan_management.sql',
  '../supabase/migrations/20261024000000_add_idempotent_subscription_test_plan_provisioning.sql',
  '../supabase/migrations/20261025000000_process_learning_subscription_provider_events.sql',
  '../supabase/migrations/20261026000000_integrate_subscription_course_access.sql',
  '../supabase/migrations/20261027000000_add_test_subscription_checkout.sql',
  '../supabase/migrations/20261028000000_allow_company_test_courses_for_test_subscription_setup.sql',
  '../supabase/migrations/20261029000000_allow_allowlisted_private_test_subscription_checkout.sql',
  '../supabase/migrations/20261030000000_reconcile_subscription_test_payment_from_provider_api.sql',
  '../supabase/migrations/20261031000000_list_own_learning_subscriptions.sql',
  '../supabase/migrations/20261128000000_add_subscription_invoice_earnings_source.sql',
  '../supabase/migrations/20261129000000_add_live_subscription_refund_reversal.sql',
  '../supabase/migrations/20261130000000_scope_subscription_management_to_provider_domain.sql',
  '../supabase/migrations/20261201000000_add_live_subscription_plan_provisioning.sql',
  '../supabase/migrations/20261202000000_list_subscription_invoice_earnings_for_admin.sql',
  '../supabase/migrations/20261203000000_add_subscription_invoice_earnings_release.sql',
  '../supabase/migrations/20261204000000_add_subscription_invoice_earnings_reservation.sql',
];
const migrations = migrationPaths.map((file) => readFileSync(path.resolve(__dirname, file), 'utf8'));

const instructorId = '00000000-0000-4000-8000-000000000002';
const learnerId = '00000000-0000-4000-8000-000000000003';
const planId = '10000000-0000-4000-8000-000000000001';
const subscriptionId = '20000000-0000-4000-8000-000000000001';
const initialInvoiceId = '30000000-0000-4000-8000-000000000001';
const planCode = 'PLN_gx2wn530m0i3w3m';
const subscriptionCode = 'SUB_1234567890';
const customerCode = 'CUS_12345678';
const initialReference = `GS-${'A'.repeat(32)}`;
const checkoutPlanId = '10000000-0000-4000-8000-000000000002';
const checkoutLearnerId = '00000000-0000-4000-8000-000000000005';
const checkoutRequestId = '40000000-0000-4000-8000-000000000001';
const retryLearnerId = '00000000-0000-4000-8000-000000000006';
const privateCheckoutLearnerId = '00000000-0000-4000-8000-000000000007';
const liveLearnerId = '00000000-0000-4000-8000-000000000008';
const operatorId = '00000000-0000-4000-8000-000000000009';

function payloadDigest(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function utcMonthStart(offset = 0) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)).toISOString();
}

async function main() {
  const db = new PGlite();
  const expiredPeriodStart = utcMonthStart(-3);
  const expiredPeriodEnd = utcMonthStart(-2);
  const renewalPeriodStart = utcMonthStart(0);
  const renewalPeriodEnd = utcMonthStart(1);
  const nextPeriodStart = renewalPeriodEnd;
  const nextPeriodEnd = utcMonthStart(2);
  const delayedOldPeriodStart = utcMonthStart(-5);
  const delayedOldPeriodEnd = utcMonthStart(-4);
  const invalidPeriodStart = nextPeriodEnd;
  const invalidPeriodEnd = utcMonthStart(3);
  const renewalPaidAt = new Date(new Date(renewalPeriodStart).getTime() + 5 * 60 * 1000).toISOString();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table public.profiles(id uuid primary key, full_name text, email text);
      create table public.learning_instructor_payout_profiles(
        instructor_id uuid, provider text, provider_domain text,
        status text, currency text
      );
      create table public.learning_audit_events(
        actor_user_id uuid, actor_role text, action text, entity_type text, entity_id text, metadata jsonb
      );
      create table public.account_capabilities(user_id uuid, capability text, status text);
      create table public.instructor_profiles(user_id uuid, approval_status text);
      create function public.has_growvelt_learning_capability(p_capability text)
        returns boolean language sql stable as $$
          select exists(select 1 from public.account_capabilities
            where user_id=auth.uid() and capability=p_capability and status='active')
        $$;
      create function public.is_approved_growvelt_instructor()
        returns boolean language sql stable as $$
          select public.has_growvelt_learning_capability('instructor') and exists(
            select 1 from public.instructor_profiles
            where user_id=auth.uid() and approval_status='approved')
        $$;
      create table public.learning_courses(
        id bigint primary key, instructor_id uuid, title text not null, status text not null,
        organization_id bigint, is_free boolean not null default false,
        is_limited_time_free boolean not null default false, price_currency text,
        price_amount numeric(10,2), company_test_mode_only boolean not null default false
      );
      create table public.enrollments(
        id bigint generated by default as identity primary key,
        learner_id uuid not null references public.profiles(id),
        course_id bigint not null references public.learning_courses(id),
        status text not null default 'active', enrolled_at timestamptz not null default now(),
        completed_at timestamptz,
        unique(learner_id,course_id), unique(id,learner_id,course_id)
      );
      create table public.learning_free_enrollment_claims(learner_id uuid,course_id bigint,enrollment_id bigint);
      create table public.learning_course_entitlements(learner_id uuid,course_id bigint,status text);
      create table public.learning_orders(learner_id uuid,course_id bigint,status text);
      create table public.learning_company_free_assignment_origins(enrollment_id bigint,assignment_id bigint);
      create table public.learning_company_course_assignments(
        id bigint,assigned_user_id uuid,course_id bigint,workspace_id bigint,status text
      );
      create table public.learning_company_workspaces(id bigint,status text);
      create table public.learning_company_memberships(workspace_id bigint,user_id uuid,status text);
      create table public.learning_company_paid_course_purchases(id bigint,course_id bigint,status text);
      create table public.learning_company_paid_seat_access(
        purchase_id bigint,assigned_user_id uuid,enrollment_id bigint,status text
      );
      create table public.learning_commercial_terms(
        version text primary key, scope_type text not null, instructor_id uuid,
        commission_basis_points integer not null, instructor_share_basis_points integer not null,
        earnings_hold_days integer not null default 14, active boolean not null,
        effective_at timestamptz not null, retired_at timestamptz
      );
      create function public.is_paystack_test_fixture_course(p_course_id bigint)
        returns boolean language sql stable as $$ select p_course_id = 90 $$;
      create function public.resolve_learning_commercial_terms_version(p_course_id bigint, p_instructor_id uuid)
        returns text language sql stable as $$ select 'growvelt-commercial-v1'::text $$;
      insert into public.profiles(id,full_name,email) values
        ('${instructorId}','Instructor','instructor@example.test'),
        ('${learnerId}','Learner','learner@example.test'),
        ('${checkoutLearnerId}','Checkout Learner','checkout@example.test'),
        ('${retryLearnerId}','Retry Learner','retry@example.test'),
        ('${privateCheckoutLearnerId}','Private Checkout Learner','private@example.test'),
        ('${liveLearnerId}','Live Subscription Learner','live-learner@example.test'),
        ('${operatorId}','Payment Operator','operator@example.test');
      insert into public.account_capabilities values ('${instructorId}','instructor','active');
      insert into public.account_capabilities values ('${operatorId}','admin','active');
      insert into public.instructor_profiles values ('${instructorId}','approved');
      insert into public.learning_commercial_terms(
        version,scope_type,commission_basis_points,instructor_share_basis_points,
        active,effective_at,retired_at
      ) values ('growvelt-commercial-v1','platform',2500,7500,true,now()-interval '1 day',null);
      insert into public.learning_courses(id,instructor_id,title,status,organization_id,is_free,
        is_limited_time_free,price_currency,price_amount,company_test_mode_only) values
        (1,'${instructorId}','Tested paid course','published',null,false,false,'NGN',1000,false),
        (2,'${instructorId}','Private Company Test Course','published',null,false,false,'NGN',1000,true);
    `);
    const learnerAccessFunctions = [
      ['get_own_learning_enrollment_state', 'bigint'],
      ['list_own_learning_course_experience', 'integer, integer'],
      ['get_own_enrolled_learning_course_experience_by_slug', 'text'],
      ['get_own_enrolled_lesson_snapshot', 'text, bigint'],
      ['get_own_enrolled_quiz_snapshot', 'text, bigint'],
      ['complete_own_enrolled_lesson', 'bigint, bigint'],
      ['submit_own_quiz_attempt', 'text, bigint, jsonb'],
    ];
    for (const [name, args] of learnerAccessFunctions) {
      await db.exec(`create function public.${name}(${args}) returns boolean language sql as $function$
        select exists(select 1 from public.enrollments enrollment_row
          where enrollment_row.status in ('active', 'completed'))
      $function$`);
    }
    for (const migration of migrations.slice(0, -7)) await db.exec(migration);
    await db.exec(`
      create table public.learning_ledger_transactions(
        id bigint generated by default as identity primary key,
        order_id bigint not null,
        payment_case_id bigint,
        transaction_type text not null,
        currency text not null,
        occurred_at timestamptz not null default now(),
        description text,
        created_by uuid
      );
      create table public.learning_ledger_entries(
        id bigint generated by default as identity primary key,
        transaction_id bigint not null,
        line_number smallint not null,
        account_code text not null,
        amount_minor bigint not null,
        currency text not null,
        counterparty_type text,
        counterparty_reference text
      );
      create table public.learning_commercial_allocations(
        id bigint generated by default as identity primary key,
        order_id bigint not null unique,
        commercial_terms_version text not null,
        instructor_id uuid not null,
        course_id bigint,
        gross_amount_minor bigint not null,
        platform_commission_minor bigint not null,
        instructor_gross_minor bigint not null,
        currency text not null,
        allocation_ledger_transaction_id bigint not null unique,
        reversal_ledger_transaction_id bigint unique,
        status text not null default 'allocated',
        allocated_at timestamptz not null default now(),
        reversed_at timestamptz,
        reversed_by_case_id bigint,
        constraint learning_commercial_allocations_reversal_check check (
          (status='allocated' and reversal_ledger_transaction_id is null and reversed_at is null and reversed_by_case_id is null)
          or (status='reversed' and reversal_ledger_transaction_id is not null and reversed_at is not null and reversed_by_case_id is not null)
        )
      );
      create table public.learning_instructor_earnings(
        id bigint generated by default as identity primary key,
        allocation_id bigint not null unique,
        instructor_id uuid not null,
        gross_amount_minor bigint not null,
        currency text not null,
        status text not null default 'held',
        available_at timestamptz not null,
        released_at timestamptz,
        reserved_at timestamptz,
        paid_at timestamptz,
        reversed_at timestamptz,
        recoverable_amount_minor bigint not null default 0,
        hold_reason text,
        updated_at timestamptz not null default now()
      );
      create table public.learning_instructor_earning_reservations(
        id bigint generated by default as identity primary key,
        reservation_reference text not null unique,
        idempotency_key text not null unique,
        earning_id bigint not null unique,
        allocation_id bigint not null,
        instructor_id uuid not null,
        amount_minor bigint not null,
        currency text not null,
        status text not null,
        source text not null,
        actor_user_id uuid not null,
        future_payout_item_reference text,
        reserved_at timestamptz not null default now()
      );
      create function public.assert_learning_approved_instructor(p_instructor_id uuid)
      returns void language plpgsql as $function$
      begin
        if p_instructor_id <> '${instructorId}' then
          raise exception 'Approved instructor required' using errcode='42501';
        end if;
      end;$function$;
      create table public.learning_instructor_earning_events(
        id bigint generated by default as identity primary key,
        earning_id bigint not null,
        event_type text not null,
        from_status text,
        to_status text,
        ledger_transaction_id bigint,
        payment_case_id bigint,
        actor_user_id uuid,
        metadata jsonb not null default '{}'::jsonb
      );
    `);
    for (const migration of migrations.slice(-7, -5)) await db.exec(migration);
    for (const migration of migrations.slice(-5)) await db.exec(migration);

    for (const [name, args] of learnerAccessFunctions) {
      const definition = (await db.query(
        'select pg_get_functiondef(to_regprocedure($1)) as definition',
        [`public.${name}(${args})`],
      )).rows[0].definition;
      assert.match(definition, /has_own_learning_course_access/, `${name} must enforce shared subscription-aware access`);
    }

    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [instructorId]);
    const privatePlan = (await db.query(`select public.create_own_learning_subscription_plan(
      'Private test setup', null, 5000, array[2]::bigint[]) as plan_id`)).rows[0].plan_id;
    assert.equal((await db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [privatePlan])).rows[0].provisioning_state,
      'claimed', 'a Company Test Mode-only course can prepare a private provider Test Mode plan');
    await db.exec('reset role');
    await db.exec('set role service_role');
    assert.equal((await db.query(`select public.record_own_learning_subscription_plan_provisioning($1,$2,'PLN_gx2wn530m0i3w4p') as state`,
      [privatePlan, instructorId])).rows[0].state, 'recorded');
    await db.exec('reset role');
    const privateCoursePlans = await db.query('select * from public.list_public_test_learning_subscription_plans_for_course(2)');
    assert.equal(privateCoursePlans.rows.length, 0,
      'Company Test Mode-only courses and their plans must stay out of public subscription offers');
    await db.exec('set role service_role');
    const privateCheckoutPlan = await db.query(
      'select * from public.get_company_test_learning_subscription_plan_for_checkout($1)', [privatePlan],
    );
    assert.equal(privateCheckoutPlan.rows.length, 1,
      'the private server-only projection should expose the eligible Company Test Mode plan');
    assert.deepEqual(privateCheckoutPlan.rows[0].course_ids, [2]);
    const privateCheckout = (await db.query(`select * from public.begin_own_learning_test_subscription_checkout(
      $1,$2,'40000000-0000-4000-8000-000000000099')`, [privateCheckoutLearnerId, privatePlan])).rows[0];
    assert.equal(privateCheckout.outcome, 'initialize',
      'the private server-only checkout RPC should reserve a Company Test Mode plan');
    assert.equal(Number(privateCheckout.amount_minor), 5000);
    assert.match(privateCheckout.reference, /^GS-[A-F0-9]{32}$/);
    await db.exec('reset role');
    assert.equal((await db.query(
      'select count(*)::int as count from public.learning_subscription_invoice_courses where invoice_id=$1',
      [privateCheckout.invoice_id],
    )).rows[0].count, 1, 'private checkout must snapshot its course before provider initialization');
    assert.equal((await db.query(
      'select public.has_own_learning_course_access($1,2) as allowed', [privateCheckoutLearnerId],
    )).rows[0].allowed, false, 'reserving private Test Mode checkout must not grant course access before verified payment');

    const livePlanRequestId = '50000000-0000-4000-8000-000000000001';
    const recordedLivePlanRequestId = '50000000-0000-4000-8000-000000000002';
    const beginLivePlan = (requestId, name = 'Live monthly catalog', amount = 5000) => db.query(
      'select * from public.begin_own_learning_live_subscription_plan($1,$2,$3,null,$4,array[1]::bigint[])',
      [requestId, instructorId, name, amount],
    );
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [instructorId]);
    await assert.rejects(beginLivePlan(livePlanRequestId), /permission denied/,
      'instructor browser sessions cannot call the Live plan claim RPC directly');
    await db.exec('reset role');
    await db.exec('set role service_role');
    const firstLiveClaim = (await beginLivePlan(livePlanRequestId)).rows[0];
    assert.equal(firstLiveClaim.provisioning_state, 'claimed', 'one trusted server request atomically reserves its Live plan');
    assert.equal((await beginLivePlan(livePlanRequestId)).rows[0].provisioning_state, 'in_progress',
      'a replay of the same request must not make a second provider plan');
    await assert.rejects(beginLivePlan(livePlanRequestId, 'Live monthly catalog', 6000), /different plan details/,
      'a request key cannot be reused to alter the commercial amount');
    assert.equal((await db.query(`select public.finish_own_learning_live_subscription_plan_provisioning($1,$2,'provider_rejected') as state`,
      [firstLiveClaim.plan_id, instructorId])).rows[0].state, 'failed');
    const retriedLiveClaim = (await beginLivePlan(livePlanRequestId)).rows[0];
    assert.equal(retriedLiveClaim.provisioning_state, 'claimed', 'only a definite provider rejection makes the same request safely retryable');
    assert.equal(retriedLiveClaim.plan_id, firstLiveClaim.plan_id, 'safe retry retains the exact reserved plan');
    assert.equal(Number(retriedLiveClaim.attempt_count), 2);
    assert.equal((await db.query(`select public.finish_own_learning_live_subscription_plan_provisioning($1,$2,'ambiguous') as state`,
      [firstLiveClaim.plan_id, instructorId])).rows[0].state, 'needs_reconciliation');
    assert.equal((await beginLivePlan(livePlanRequestId)).rows[0].provisioning_state, 'needs_reconciliation',
      'an uncertain provider result blocks another Live plan-create request');
    const recordedLiveClaim = (await beginLivePlan(recordedLivePlanRequestId, 'Recorded Live catalog')).rows[0];
    assert.equal(recordedLiveClaim.provisioning_state, 'claimed');
    assert.equal((await db.query(`select public.record_own_learning_live_subscription_plan_provisioning($1,$2,'PLN_gx2wn530m0i3w4q') as state`,
      [recordedLiveClaim.plan_id, instructorId])).rows[0].state, 'recorded');
    const replayedRecordedPlan = (await beginLivePlan(recordedLivePlanRequestId, 'Recorded Live catalog')).rows[0];
    assert.equal(replayedRecordedPlan.provisioning_state, 'recorded', 'a recorded provider plan is safely returned without creating a duplicate');
    assert.equal(replayedRecordedPlan.existing_plan_code, 'PLN_gx2wn530m0i3w4q');
    await db.exec('reset role');
    assert.equal((await db.query(`select count(*)::int as count from public.learning_subscription_plans
      where payment_domain='live' and instructor_id=$1`, [instructorId])).rows[0].count, 2,
    'each unique browser request maps to one Live plan regardless of replay');
    const beginLiveExecute = 'public.begin_own_learning_live_subscription_plan(uuid,uuid,text,text,bigint,bigint[])';
    assert.equal((await db.query("select has_function_privilege('authenticated',$1,'execute') as allowed", [beginLiveExecute])).rows[0].allowed, false,
      'authenticated users must not invoke the service-only Live request reservation RPC');
    assert.equal((await db.query("select has_function_privilege('service_role',$1,'execute') as allowed", [beginLiveExecute])).rows[0].allowed, true,
      'the trusted server role may reserve Live plans behind the application feature gate');

    await db.query(`insert into public.learning_subscription_plans(
      id,instructor_id,name,amount_minor,commercial_terms_version,paystack_plan_code,status
    ) values ($1,$2,'Monthly learning catalog',5000,'growvelt-commercial-v1',$3,'draft')`,
    [planId, instructorId, planCode]);
    await db.query(`insert into public.learning_subscription_plan_courses(plan_id,instructor_id,course_id)
      values ($1,$2,1)`, [planId, instructorId]);
    await db.query("update public.learning_subscription_plans set status='active' where id=$1", [planId]);
    await db.query(`insert into public.learning_subscriptions(id,plan_id,learner_id)
      values ($1,$2,$3)`, [subscriptionId, planId, learnerId]);
    await db.query(`insert into public.learning_subscription_invoices(
      id,subscription_id,instructor_id,plan_name_snapshot,billing_period_starts_at,paid_through,
      provider_reference,amount_minor,platform_share_minor,seller_share_minor,
      commercial_terms_version,status
    ) values ($1,$2,$3,'Monthly learning catalog',$4,$5,
      $6,5000,1250,3750,'growvelt-commercial-v1','created')`,
    [initialInvoiceId, subscriptionId, instructorId, expiredPeriodStart, expiredPeriodEnd, initialReference]);
    await db.query(`insert into public.learning_subscription_invoice_courses(
      invoice_id,course_id,course_title_snapshot
    ) values ($1,1,'Tested paid course')`, [initialInvoiceId]);

    await db.query(`insert into public.learning_subscription_plans(
      id,instructor_id,name,amount_minor,commercial_terms_version,paystack_plan_code,status
    ) values ($1,$2,'Test checkout catalog',5000,'growvelt-commercial-v1','PLN_gx2wn530m0i3w4n','draft')`,
    [checkoutPlanId, instructorId]);
    await db.query(`insert into public.learning_subscription_plan_courses(plan_id,instructor_id,course_id)
      values ($1,$2,1)`, [checkoutPlanId, instructorId]);
    await db.query("update public.learning_subscription_plans set status='active' where id=$1", [checkoutPlanId]);

    const receive = async (eventKey, eventType, payload, invoiceId = null, digest = payloadDigest(payload)) => {
      const result = await db.query(`select * from public.receive_learning_subscription_provider_event(
        $1,$2,$3,$4::jsonb,$5,$6,'test'
      )`, [eventKey, eventType, digest, JSON.stringify(payload), subscriptionId, invoiceId]);
      return result.rows[0];
    };
    const process = async (eventId, verification = null) => (await db.query(
      'select * from public.process_learning_subscription_provider_event($1,$2::jsonb)',
      [eventId, verification ? JSON.stringify(verification) : null],
    )).rows[0].outcome;
    const invoiceByCode = async (code) => (await inspect(
      'select id,status,amount_minor,platform_share_minor,seller_share_minor,billing_period_starts_at,paid_through from public.learning_subscription_invoices where provider_invoice_code=$1',
      [code],
    )).rows[0];
    const currentSubscription = async () => (await inspect(
      'select status,current_period_starts_at,paid_through,cancel_requested_at from public.learning_subscriptions where id=$1',
      [subscriptionId],
    )).rows[0];

    await db.exec('set role service_role');
    const inspect = async (query, params = []) => {
      await db.exec('reset role');
      const result = await db.query(query, params);
      await db.exec('set role service_role');
      return result;
    };

    const beginCheckout = async (learner, plan, request) => (await db.query(
      `select * from public.begin_own_learning_test_subscription_checkout($1,$2,$3)`,
      [learner, plan, request],
    )).rows[0];
    const checkoutReservation = await beginCheckout(checkoutLearnerId, checkoutPlanId, checkoutRequestId);
    assert.equal(checkoutReservation.outcome, 'initialize');
    assert.match(checkoutReservation.reference, /^GS-[A-F0-9]{32}$/);
    assert.equal(Number(checkoutReservation.amount_minor), 5000);
    assert.equal(checkoutReservation.plan_code, 'PLN_gx2wn530m0i3w4n');
    assert.equal((await beginCheckout(checkoutLearnerId, checkoutPlanId, checkoutRequestId)).outcome, 'in_progress',
      'replaying an initializing request must not create another provider initialization claim');
    assert.equal((await inspect('select count(*)::int as count from public.learning_subscriptions where learner_id=$1 and plan_id=$2', [checkoutLearnerId, checkoutPlanId])).rows[0].count, 1);
    assert.equal((await inspect('select count(*)::int as count from public.learning_subscription_invoices where subscription_id=$1', [checkoutReservation.subscription_id])).rows[0].count, 1);
    assert.equal((await inspect('select count(*)::int as count from public.learning_subscription_invoice_courses where invoice_id=$1', [checkoutReservation.invoice_id])).rows[0].count, 1,
      'the initial invoice must snapshot its course bundle before the provider request');
    assert.equal((await db.query(`select public.finish_own_learning_test_subscription_checkout($1,'ready',$2) as outcome`,
      [checkoutRequestId, 'https://checkout.paystack.com/test-session_123'])).rows[0].outcome, 'ready');
    const retryByKey = await beginCheckout(checkoutLearnerId, checkoutPlanId, checkoutRequestId);
    assert.equal(retryByKey.outcome, 'ready');
    assert.equal(retryByKey.authorization_url, 'https://checkout.paystack.com/test-session_123');
    assert.equal((await beginCheckout(checkoutLearnerId, checkoutPlanId, '40000000-0000-4000-8000-000000000002')).authorization_url,
      'https://checkout.paystack.com/test-session_123', 'a fresh browser request should resume the same safe hosted session');

    const apiPaidAt = new Date().toISOString();
    const apiVerifiedPayload = {
      status: 'success', reference: checkoutReservation.reference, transaction_id: '90006',
      amount_minor: 5000, requested_amount_minor: 5000, charged_amount_minor: 5000, fees_minor: null,
      currency: 'NGN', domain: 'test', paid_at: apiPaidAt,
      metadata: { subscription_id: checkoutReservation.subscription_id, invoice_id: checkoutReservation.invoice_id },
    };
    const apiReconciliation = (await db.query(`select * from public.reconcile_own_learning_test_subscription_payment(
      $1,$2,$3,$4,'90006',5000,5000,null,$5,$6::jsonb)`, [
      checkoutLearnerId, checkoutReservation.reference, checkoutReservation.subscription_id,
      checkoutReservation.invoice_id, payloadDigest(apiVerifiedPayload), JSON.stringify(apiVerifiedPayload),
    ])).rows[0];
    assert.equal(apiReconciliation.outcome, 'processed',
      'a server-verified Paystack Test Mode transaction should reconcile when the signed webhook is unavailable');
    const apiEvent = (await inspect(`select signature_valid,verification_source,processing_status
      from public.learning_subscription_provider_events where id=$1`, [apiReconciliation.event_id])).rows[0];
    assert.deepEqual(apiEvent, { signature_valid: false, verification_source: 'provider_api', processing_status: 'processed' },
      'API verification must be audited separately and must never be mislabeled as a signed webhook');
    const repeatedApiReconciliation = (await db.query(`select * from public.reconcile_own_learning_test_subscription_payment(
      $1,$2,$3,$4,'90006',5000,5000,null,$5,$6::jsonb)`, [
      checkoutLearnerId, checkoutReservation.reference, checkoutReservation.subscription_id,
      checkoutReservation.invoice_id, payloadDigest(apiVerifiedPayload), JSON.stringify(apiVerifiedPayload),
    ])).rows[0];
    assert.equal(repeatedApiReconciliation.outcome, 'already_paid',
      'rechecking the same transaction must be idempotent and must not create another invoice or grant');
    assert.equal((await inspect('select status from public.learning_subscription_invoices where id=$1',
      [checkoutReservation.invoice_id])).rows[0].status, 'paid');
    assert.equal((await inspect('select count(*)::int as count from public.learning_commercial_allocations where subscription_invoice_id=$1',
      [checkoutReservation.invoice_id])).rows[0].count, 0,
    'Test Mode subscription invoices must not enter the Live instructor earnings ledger');
    assert.equal((await inspect('select public.has_own_learning_course_access($1,1) as allowed',
      [checkoutLearnerId])).rows[0].allowed, true,
    'a verified provider API reconciliation should grant the paid subscription access');
    const finalizedPeriod = (await inspect(`select billing_period_starts_at,paid_through
      from public.learning_subscription_invoices where id=$1`, [checkoutReservation.invoice_id])).rows[0];
    assert.equal(finalizedPeriod.billing_period_starts_at.toISOString(), new Date(apiPaidAt).toISOString());
    assert.ok(finalizedPeriod.paid_through > finalizedPeriod.billing_period_starts_at,
      'the initial billing period should begin at the verified provider payment time');

    const rejectedRequestId = '40000000-0000-4000-8000-000000000003';
    const rejectedCheckout = await beginCheckout(retryLearnerId, checkoutPlanId, rejectedRequestId);
    assert.equal(rejectedCheckout.outcome, 'initialize');
    assert.equal((await db.query(`select public.finish_own_learning_test_subscription_checkout($1,'rejected',null) as outcome`,
      [rejectedRequestId])).rows[0].outcome, 'retryable');
    const retryRequestId = '40000000-0000-4000-8000-000000000004';
    const retryCheckout = await beginCheckout(retryLearnerId, checkoutPlanId, retryRequestId);
    assert.equal(retryCheckout.outcome, 'initialize', 'only a definitive provider rejection may be retried');
    assert.equal(retryCheckout.subscription_id, rejectedCheckout.subscription_id);
    assert.equal(retryCheckout.invoice_id, rejectedCheckout.invoice_id);
    assert.equal((await db.query(`select public.finish_own_learning_test_subscription_checkout($1,'ambiguous',null) as outcome`,
      [retryRequestId])).rows[0].outcome, 'needs_reconciliation');
    assert.equal((await beginCheckout(retryLearnerId, checkoutPlanId, '40000000-0000-4000-8000-000000000005')).outcome, 'needs_reconciliation',
      'an uncertain provider result must stop another charge attempt');
    const mismatchedVerifiedPayload = {
      status: 'success', reference: rejectedCheckout.reference, transaction_id: '90007',
      amount_minor: 4999, requested_amount_minor: 4999, charged_amount_minor: 4999, fees_minor: null,
      currency: 'NGN', domain: 'test', paid_at: new Date().toISOString(),
      metadata: { subscription_id: rejectedCheckout.subscription_id, invoice_id: rejectedCheckout.invoice_id },
    };
    const mismatchedReconciliation = (await db.query(`select * from public.reconcile_own_learning_test_subscription_payment(
      $1,$2,$3,$4,'90007',4999,4999,null,$5,$6::jsonb)`, [
      retryLearnerId, rejectedCheckout.reference, rejectedCheckout.subscription_id,
      rejectedCheckout.invoice_id, payloadDigest(mismatchedVerifiedPayload), JSON.stringify(mismatchedVerifiedPayload),
    ])).rows[0];
    assert.equal(mismatchedReconciliation.outcome, 'amount_mismatch',
      'a provider API success for a different amount must not mark the invoice paid');
    assert.equal((await inspect('select status from public.learning_subscription_invoices where id=$1',
      [rejectedCheckout.invoice_id])).rows[0].status, 'created');
    assert.equal((await inspect(`select count(*)::int as count from public.learning_subscription_provider_events
      where provider_event_id='transaction.verify:subscription:test:90007'`, [])).rows[0].count, 0,
    'an amount-mismatched provider transaction must not enter the event ledger');

    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [checkoutLearnerId]);
    await db.exec('set role authenticated');
    const publicPlans = await db.query('select * from public.list_public_test_learning_subscription_plans_for_course(1)');
    assert.ok(publicPlans.rows.some((row) => row.plan_id === checkoutPlanId), 'eligible active plans should be discoverable only through the safe projection');
    const statusView = await db.query('select * from public.get_own_learning_subscription_payment_status($1)', [checkoutReservation.reference]);
    assert.equal(statusView.rows[0].invoice_status, 'paid');
    assert.equal(statusView.rows[0].access_active, true,
      'provider-API verified payment should appear as active in the learner callback status');
    await db.exec('reset role');
    await db.exec('set role service_role');

    // The initial successful charge may arrive before subscription.create.
    const initialPayload = {
      reference: initialReference, transaction_id: '90001', amount_minor: 5000,
      currency: 'NGN', status: 'success',
    };
    const initialReceipt = await receive('charge.success:transaction:90001', 'charge.success', initialPayload);
    assert.equal(initialReceipt.outcome, 'received');
    const signedEventProvenance = (await inspect(`select signature_valid,verification_source
      from public.learning_subscription_provider_events where id=$1`, [initialReceipt.event_id])).rows[0];
    assert.deepEqual(signedEventProvenance, { signature_valid: true, verification_source: 'webhook' },
      'HMAC-verified webhook provenance must remain distinct from the API reconciliation path');
    assert.equal(await process(initialReceipt.event_id, {
      reference: initialReference, transaction_id: '90001', requested_amount_minor: 5000,
      currency: 'NGN', domain: 'test', status: 'success',
    }), 'processed');
    assert.deepEqual(await currentSubscription(), {
      status: 'active', current_period_starts_at: new Date(expiredPeriodStart),
      paid_through: new Date(expiredPeriodEnd), cancel_requested_at: null,
    });
    const subscriptionEnrollment = await inspect(
      `select enrollment.id, enrollment.status, source.preexisting_access
       from public.enrollments enrollment
       join public.learning_subscription_course_enrollment_sources source
         on source.enrollment_id = enrollment.id
       where enrollment.learner_id = $1 and enrollment.course_id = 1`,
      [learnerId],
    );
    assert.equal(subscriptionEnrollment.rows.length, 1, 'a verified paid invoice should establish one shared course enrollment');
    assert.equal(subscriptionEnrollment.rows[0].status, 'active');
    assert.equal(subscriptionEnrollment.rows[0].preexisting_access, false);
    assert.equal((await inspect('select public.has_own_learning_course_access($1,1) as allowed', [learnerId])).rows[0].allowed, false,
      'an already-expired paid period must not grant access');

    // A renewal invoice can be received before its subscription.create event is processed.
    const renewalInvoicePayload = {
      invoice_code: 'INV_1234567890', subscription_code: subscriptionCode,
      amount_minor: 5000, currency: 'NGN', status: 'pending',
      period_starts_at: renewalPeriodStart, paid_through: renewalPeriodEnd,
    };
    const renewalReceipt = await receive('invoice.create:invoice:INV_1234567890:status:pending', 'invoice.create', renewalInvoicePayload);
    await assert.rejects(process(renewalReceipt.event_id), /arrived before its subscription mapping/);
    const createdSubscription = await receive('subscription.create:subscription:SUB_1234567890', 'subscription.create', {
      subscription_code: subscriptionCode, customer_code: customerCode, plan_code: planCode,
    });
    assert.equal(await process(createdSubscription.event_id), 'processed');
    assert.equal(await process(renewalReceipt.event_id), 'processed', 'the same received invoice event should succeed after its prerequisite arrives');
    const renewalInvoice = await invoiceByCode('INV_1234567890');
    assert.equal(renewalInvoice.status, 'payment_pending');
    assert.equal(Number(renewalInvoice.amount_minor), 5000);
    assert.equal(Number(renewalInvoice.platform_share_minor), 1250);
    assert.equal(Number(renewalInvoice.seller_share_minor), 3750);

    // A failed renewal does not extend paid access; a later verified success for that invoice can recover it.
    const failedPayload = {
      invoice_code: 'INV_1234567890', subscription_code: subscriptionCode,
      amount_minor: 5000, currency: 'NGN', status: 'attention',
    };
    const failedReceipt = await receive('invoice.payment_failed:INV_1234567890:attention', 'invoice.payment_failed', failedPayload);
    assert.equal(await process(failedReceipt.event_id), 'processed');
    assert.equal((await currentSubscription()).status, 'attention');
    assert.equal((await currentSubscription()).paid_through.toISOString(), expiredPeriodEnd);

    const renewalSuccessPayload = {
      invoice_code: 'INV_1234567890', subscription_code: subscriptionCode,
      amount_minor: 5000, currency: 'NGN', status: 'success',
      transaction_reference: 'provider-renewal-90002', paid_at: renewalPaidAt,
    };
    const renewalSuccess = await receive('invoice.update:INV_1234567890:success', 'invoice.update', renewalSuccessPayload);
    const renewalVerification = {
      reference: 'provider-renewal-90002', transaction_id: '90002', requested_amount_minor: 5000,
      currency: 'NGN', domain: 'test', status: 'success',
    };
    assert.equal(await process(renewalSuccess.event_id, renewalVerification), 'processed');
    assert.equal((await currentSubscription()).status, 'active');
    assert.equal((await currentSubscription()).paid_through.toISOString(), renewalPeriodEnd);
    assert.equal((await inspect('select status from public.learning_subscription_invoices where id=$1', [renewalInvoice.id])).rows[0].status, 'paid');
    assert.equal((await inspect('select public.has_own_learning_course_access($1,1) as allowed', [learnerId])).rows[0].allowed, true,
      'a verified paid renewal period should grant access');
    const paidRenewalReference = (await inspect(
      "select provider_reference from public.learning_subscription_invoices where provider_invoice_code='INV_1234567890'",
    )).rows[0].provider_reference;
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [learnerId]);
    await db.exec('set role authenticated');
    const paidRenewalStatus = await db.query('select * from public.get_own_learning_subscription_payment_status($1)', [paidRenewalReference]);
    assert.equal(paidRenewalStatus.rows[0].access_active, true, 'the callback status RPC should report access for a current verified paid period');
    const learnerSubscriptions = await db.query('select * from public.list_own_learning_subscriptions()');
    assert.equal(learnerSubscriptions.rows.length, 1, 'a learner should see only their own subscription records');
    assert.deepEqual({
      subscription_id: learnerSubscriptions.rows[0].subscription_id,
      plan_name: learnerSubscriptions.rows[0].plan_name,
      subscription_status: learnerSubscriptions.rows[0].subscription_status,
      provider_management_available: learnerSubscriptions.rows[0].provider_management_available,
      course_titles: learnerSubscriptions.rows[0].course_titles,
    }, {
      subscription_id: subscriptionId,
      plan_name: 'Monthly learning catalog',
      subscription_status: 'active',
      provider_management_available: true,
      course_titles: ['Tested paid course'],
    }, 'the learner projection should expose status and included courses, but only a boolean for provider management');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [instructorId]);
    assert.equal((await db.query('select * from public.list_own_learning_subscriptions()')).rows.length, 0,
      'another learner must not discover a subscription they do not own');
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    assert.equal((await db.query('select * from public.list_own_learning_subscriptions()')).rows.length, 0,
      'an unauthenticated context must not enumerate subscriptions');
    await db.exec('reset role');
    await db.exec('set role service_role');

    // Same delivery is idempotent; a later-arriving failure cannot reverse a verified paid invoice.
    const repeatedSuccess = await receive('invoice.update:INV_1234567890:success', 'invoice.update', renewalSuccessPayload);
    assert.equal(repeatedSuccess.outcome, 'duplicate');
    assert.equal(await process(repeatedSuccess.event_id, renewalVerification), 'already_processed');
    const lateFailure = await receive('invoice.payment_failed:INV_1234567890:attention', 'invoice.payment_failed', failedPayload);
    assert.equal(await process(lateFailure.event_id), 'already_processed');
    assert.equal((await currentSubscription()).paid_through.toISOString(), renewalPeriodEnd);
    assert.equal((await currentSubscription()).status, 'active');
    assert.equal((await receive('invoice.update:INV_1234567890:success', 'invoice.update', renewalSuccessPayload, null, 'b'.repeat(64))).outcome, 'duplicate_conflict');

    // Cancellation stops renewals but keeps existing access; an already issued, later verified invoice
    // received after disable extends the paid-through date without reactivating the subscription.
    assert.equal(await process((await receive('subscription.not_renew:SUB_1234567890', 'subscription.not_renew', {
      subscription_code: subscriptionCode, status: 'non-renewing',
    })).event_id), 'processed');
    assert.equal((await currentSubscription()).status, 'non_renewing');

    const nextInvoicePayload = {
      invoice_code: 'INV_2234567890', subscription_code: subscriptionCode,
      amount_minor: 5000, currency: 'NGN', status: 'pending',
      period_starts_at: nextPeriodStart, paid_through: nextPeriodEnd,
    };
    const nextInvoiceEvent = await receive('invoice.create:invoice:INV_2234567890:status:pending', 'invoice.create', nextInvoicePayload);
    assert.equal(await process(nextInvoiceEvent.event_id), 'processed');
    assert.equal(await process((await receive('subscription.disable:SUB_1234567890:cancelled', 'subscription.disable', {
      subscription_code: subscriptionCode, status: 'cancelled',
    })).event_id), 'processed');
    assert.equal((await currentSubscription()).status, 'cancelled');
    const disabledSuccessPayload = {
      invoice_code: 'INV_2234567890', subscription_code: subscriptionCode,
      amount_minor: 5000, currency: 'NGN', status: 'success',
      transaction_reference: 'provider-renewal-90003',
    };
    const disabledSuccess = await receive('invoice.update:INV_2234567890:success', 'invoice.update', disabledSuccessPayload);
    assert.equal(await process(disabledSuccess.event_id, {
      reference: 'provider-renewal-90003', transaction_id: '90003', requested_amount_minor: 5000,
      currency: 'NGN', domain: 'test', status: 'success',
    }), 'processed');
    assert.equal((await currentSubscription()).status, 'cancelled');
    assert.equal((await currentSubscription()).paid_through.toISOString(), nextPeriodEnd);

    // A delayed success for an older billing period records its invoice but never shortens current access.
    const oldInvoicePayload = {
      invoice_code: 'INV_0234567890', subscription_code: subscriptionCode,
      amount_minor: 5000, currency: 'NGN', status: 'pending',
      period_starts_at: delayedOldPeriodStart, paid_through: delayedOldPeriodEnd,
    };
    const oldInvoiceEvent = await receive('invoice.create:invoice:INV_0234567890:status:pending', 'invoice.create', oldInvoicePayload);
    assert.equal(await process(oldInvoiceEvent.event_id), 'processed');
    const oldSuccess = await receive('invoice.update:INV_0234567890:success', 'invoice.update', {
      invoice_code: 'INV_0234567890', subscription_code: subscriptionCode,
      amount_minor: 5000, currency: 'NGN', status: 'success', transaction_reference: 'provider-renewal-old',
    });
    assert.equal(await process(oldSuccess.event_id, {
      reference: 'provider-renewal-old', transaction_id: '90004', requested_amount_minor: 5000,
      currency: 'NGN', domain: 'test', status: 'success',
    }), 'processed');
    assert.equal((await currentSubscription()).paid_through.toISOString(), nextPeriodEnd);
    assert.equal((await currentSubscription()).status, 'cancelled');

    // Bad verification fails closed and leaves the invoice unpaid and paid-through untouched.
    const badInvoicePayload = {
      invoice_code: 'INV_3234567890', subscription_code: subscriptionCode,
      amount_minor: 5000, currency: 'NGN', status: 'pending',
      period_starts_at: invalidPeriodStart, paid_through: invalidPeriodEnd,
    };
    const badInvoiceEvent = await receive('invoice.create:invoice:INV_3234567890:status:pending', 'invoice.create', badInvoicePayload);
    assert.equal(await process(badInvoiceEvent.event_id), 'processed');
    const badSuccess = await receive('invoice.update:INV_3234567890:success', 'invoice.update', {
      invoice_code: 'INV_3234567890', subscription_code: subscriptionCode,
      amount_minor: 5000, currency: 'NGN', status: 'success', transaction_reference: 'provider-bad-amount',
    });
    await assert.rejects(process(badSuccess.event_id, {
      reference: 'provider-bad-amount', transaction_id: '90005', requested_amount_minor: 4999,
      currency: 'NGN', domain: 'test', status: 'success',
    }), /matching verified Test Mode transaction/);
    assert.equal((await invoiceByCode('INV_3234567890')).status, 'payment_pending');
    assert.equal((await currentSubscription()).paid_through.toISOString(), nextPeriodEnd);

    await db.exec('reset role');
    await db.exec(`update public.enrollments set status='completed',completed_at=now()
      where learner_id='${learnerId}' and course_id=1`);
    await db.exec(`update public.learning_subscriptions set status='expired' where id='${subscriptionId}'`);
    await db.exec('set role service_role');
    assert.equal((await inspect('select public.has_own_learning_course_access($1,1) as allowed', [learnerId])).rows[0].allowed, false,
      'a completed subscription-only enrollment must not outlive its paid period');
    await db.exec('reset role');
    await db.query(`insert into public.learning_course_entitlements(learner_id,course_id,status)
      values ($1,1,'active')`, [learnerId]);
    await db.exec('set role service_role');
    assert.equal((await inspect('select public.has_own_learning_course_access($1,1) as allowed', [learnerId])).rows[0].allowed, true,
      'an independent one-time purchase must preserve access after the subscription expires');
    assert.equal((await inspect('select status,completed_at is not null as preserved from public.enrollments where learner_id=$1 and course_id=1', [learnerId])).rows[0].preserved, true,
      'subscription lifecycle must preserve completed learning progress');

    await db.exec('reset role');
    const livePlanId = '10000000-0000-4000-8000-000000000003';
    const liveSubscriptionId = '20000000-0000-4000-8000-000000000002';
    const liveInvoiceId = '30000000-0000-4000-8000-000000000002';
    await db.query(`insert into public.learning_subscription_plans(
      id,instructor_id,name,amount_minor,commercial_terms_version,payment_domain,paystack_plan_code,status
    ) values ($1,$2,'Live monthly catalog',5000,'growvelt-commercial-v1','live','PLN_live_test_01','draft')`,
    [livePlanId, instructorId]);
    await db.query(`insert into public.learning_subscription_plan_courses(plan_id,instructor_id,course_id)
      values ($1,$2,1)`, [livePlanId, instructorId]);
    await db.query("update public.learning_subscription_plans set status='active' where id=$1", [livePlanId]);
    await db.query(`insert into public.learning_subscriptions(
      id,plan_id,learner_id,payment_domain,paystack_subscription_code,status,current_period_starts_at,paid_through
    ) values ($1,$2,$3,'live','SUB_live_test_01','active',$4,$5)`,
    [liveSubscriptionId, livePlanId, liveLearnerId, renewalPeriodStart, renewalPeriodEnd]);
    await db.query(`insert into public.learning_subscription_invoices(
      id,subscription_id,instructor_id,plan_name_snapshot,billing_period_starts_at,paid_through,
      provider_reference,payment_domain,amount_minor,platform_share_minor,seller_share_minor,
      commercial_terms_version,provider_transaction_id,provider_transaction_reference,status
    ) values ($1,$2,$3,'Live monthly catalog',$4,$5,$6,'live',5000,1250,3750,
      'growvelt-commercial-v1','90008','provider-live-charge-90008','payment_pending')`,
    [liveInvoiceId, liveSubscriptionId, instructorId, renewalPeriodStart, renewalPeriodEnd, `GS-${'C'.repeat(32)}`]);
    await db.query(`insert into public.learning_subscription_invoice_courses(
      invoice_id,course_id,course_title_snapshot
    ) values ($1,1,'Tested paid course')`, [liveInvoiceId]);
    await db.query(`update public.learning_subscription_invoices
      set status='paid',paid_at=now() where id=$1`, [liveInvoiceId]);
    const liveAllocation = (await inspect(`select id,order_id,subscription_invoice_id,gross_amount_minor,
      platform_commission_minor,instructor_gross_minor,course_id,status
      from public.learning_commercial_allocations where subscription_invoice_id=$1`, [liveInvoiceId])).rows[0];
    assert.deepEqual(liveAllocation, {
      id: liveAllocation.id,
      order_id: null,
      subscription_invoice_id: liveInvoiceId,
      gross_amount_minor: 5000,
      platform_commission_minor: 1250,
      instructor_gross_minor: 3750,
      course_id: null,
      status: 'allocated',
    }, 'a verified Live invoice should allocate its immutable plan shares without inventing a course order');
    assert.equal((await inspect(`select count(*)::int as count from public.learning_ledger_transactions
      where subscription_invoice_id=$1 and order_id is null and transaction_type='commercial_allocation'`, [liveInvoiceId])).rows[0].count, 1,
    'the allocation ledger entry must link directly to its subscription invoice');
    assert.deepEqual((await inspect(`select status,gross_amount_minor from public.learning_instructor_earnings
      where allocation_id=$1`, [liveAllocation.id])).rows[0], { status: 'held', gross_amount_minor: 3750 },
    'subscription instructor earnings must begin held, not immediately available');
    // Exercise the trigger as the database owner: service_role has no direct
    // table UPDATE privilege, which would otherwise mask a broken trigger.
    await db.exec('reset role');
    for (const unsafeStatus of ['available', 'reserved', 'paid']) {
      await assert.rejects(
        db.query(`update public.learning_instructor_earnings
          set status=$1 where allocation_id=$2`, [unsafeStatus, liveAllocation.id]),
        unsafeStatus === 'available'
          ? /Subscription invoice earning is not eligible for this transition/
          : /Subscription invoice payout requires validated invoice controls/,
        `subscription earnings must not become ${unsafeStatus} before validated financial controls allow it`,
      );
    }
    for (const unsafeStatus of ['reversed', 'recoverable']) {
      await assert.rejects(
        db.query(`update public.learning_instructor_earnings
          set status=$1 where allocation_id=$2`, [unsafeStatus, liveAllocation.id]),
        /A verified processed invoice refund is required/,
        `subscription earnings must not become ${unsafeStatus} without a verified invoice refund`,
      );
    }
    await db.exec('set role service_role');
    assert.deepEqual((await inspect(`select status,gross_amount_minor from public.learning_instructor_earnings
      where allocation_id=$1`, [liveAllocation.id])).rows[0], { status: 'held', gross_amount_minor: 3750 },
    'a rejected release attempt must leave the subscription earning held');
    const adminInvoiceEarnings = await db.query(
      'select * from public.list_learning_subscription_invoice_earnings_for_admin($1,10)', [operatorId],
    );
    assert.equal(adminInvoiceEarnings.rows.length, 1);
    assert.equal(adminInvoiceEarnings.rows[0].invoice_id, liveInvoiceId);
    assert.equal(adminInvoiceEarnings.rows[0].amount_minor, 3750);
    assert.equal(adminInvoiceEarnings.rows[0].earning_status, 'held');
    await assert.rejects(
      db.query('select * from public.list_learning_subscription_invoice_earnings_for_admin($1,10)', [instructorId]),
      /Active administrator required/,
    );
    assert.equal((await db.query(`select public.allocate_learning_subscription_invoice_commercial_terms($1,null) as id`,
      [liveInvoiceId])).rows[0].id, liveAllocation.id,
    'subscription invoice commercial allocation must be idempotent');
    assert.equal((await inspect('select public.has_own_learning_course_access($1,1) as allowed', [liveLearnerId])).rows[0].allowed, true,
      'a paid Live invoice should grant only its learner the course access period');

    const liveInvoiceReference = (await inspect(
      'select provider_reference from public.learning_subscription_invoices where id=$1', [liveInvoiceId],
    )).rows[0].provider_reference;
    const refundRequest = async (reference = liveInvoiceReference, key = '50000000-0000-4000-8000-000000000001') =>
      (await db.query(`select * from public.request_paystack_live_subscription_full_refund(
        $1,$2,$3,$4,'customer_request','Approved controlled subscription refund test')`,
      [reference, operatorId, key, reference])).rows[0];
    const invoiceRefundCase = await refundRequest();
    assert.deepEqual(invoiceRefundCase, {
      case_id: invoiceRefundCase.case_id,
      status: 'requested',
      amount_minor: 5000,
      currency: 'NGN',
      provider_transaction_id: '90008',
      provider_transaction_reference: 'provider-live-charge-90008',
    }, 'a Live subscription refund case must snapshot the exact invoice charge rather than a course order');
    assert.equal((await refundRequest()).case_id, invoiceRefundCase.case_id,
      'subscription refund request retries must return the idempotent case');
    await assert.rejects(refundRequest(liveInvoiceReference, '50000000-0000-4000-8000-000000000002'),
      /one_full_refund|unique/i, 'a second full refund request for the same invoice must be rejected');
    await assert.rejects(db.query(`select * from public.request_paystack_live_subscription_full_refund(
      $1,$2,$3,'GS-${'D'.repeat(32)}','customer_request','Wrong confirmation')`,
    [liveInvoiceReference, operatorId, '50000000-0000-4000-8000-000000000003']),
    /Invalid subscription refund request/);
    assert.equal((await db.query('select public.mark_paystack_live_subscription_refund_submitting($1,$2) as status',
      [invoiceRefundCase.case_id, operatorId])).rows[0].status, 'submitting');
    assert.equal((await db.query('select public.mark_paystack_live_subscription_refund_submitting($1,$2) as status',
      [invoiceRefundCase.case_id, operatorId])).rows[0].status, 'already_submitting',
    'a concurrent or retried admin request must not be authorized to POST a duplicate provider refund');
    assert.equal((await db.query(`select public.record_paystack_live_subscription_refund_submission(
      $1,'123456','processed','RFND_live_123456',$2,null) as status`,
    [invoiceRefundCase.case_id, operatorId])).rows[0].status, 'processing',
    'a provider response marked processed still requires a separate verified result before local finalization');
    const refundEvidence = {
      domain: 'live', currency: 'NGN', amount_minor: 5000, transaction_id: '90008',
      transaction_reference: 'provider-live-charge-90008', refund_id: '123456',
      refund_reference: 'RFND_live_123456', status: 'processed',
    };
    await assert.rejects(db.query(`select public.receive_paystack_live_subscription_refund_verification(
      $1,'refund-api-event-mismatch','${'a'.repeat(64)}','provider_api','123456','RFND_live_123456','processed',
      4999,'NGN','live','90008','provider-live-charge-90008',$2,$3)`,
    [invoiceRefundCase.case_id, JSON.stringify({ ...refundEvidence, amount_minor: 4999 }), operatorId]),
    /does not match the paid invoice/);
    const refundEventId = (await db.query(`select public.receive_paystack_live_subscription_refund_verification(
      $1,'refund-api-event-live-123456','${'b'.repeat(64)}','provider_api','123456','RFND_live_123456','processed',
      5000,'NGN','live','90008','provider-live-charge-90008',$2,$3) as event_id`,
    [invoiceRefundCase.case_id, JSON.stringify(refundEvidence), operatorId])).rows[0].event_id;
    const processedSubscriptionRefund = (await db.query(
      'select * from public.process_paystack_live_subscription_refund_event($1)', [refundEventId],
    )).rows[0];
    assert.equal(processedSubscriptionRefund.outcome, 'refunded');
    assert.equal(processedSubscriptionRefund.refund_case_id, invoiceRefundCase.case_id);
    assert.equal(processedSubscriptionRefund.invoice_id, liveInvoiceId);
    assert.equal((await inspect('select status from public.learning_subscription_invoices where id=$1', [liveInvoiceId])).rows[0].status,
      'refunded', 'only the verified invoice period is marked refunded');
    assert.equal((await inspect('select status from public.learning_instructor_earnings where allocation_id=$1', [liveAllocation.id])).rows[0].status,
      'reversed', 'verified invoice refund reverses held subscription instructor earnings');
    assert.equal((await inspect('select status,reversed_by_subscription_refund_case_id from public.learning_commercial_allocations where id=$1',
      [liveAllocation.id])).rows[0].reversed_by_subscription_refund_case_id, invoiceRefundCase.case_id,
    'subscription allocation reversal remains explicitly linked to its invoice refund case');
    assert.equal((await inspect('select count(*)::int as count from public.learning_ledger_transactions where subscription_refund_case_id=$1 and transaction_type in (\'refund\',\'instructor_earnings_reversal\')',
      [invoiceRefundCase.case_id])).rows[0].count, 2, 'refund and seller allocation reversal are both ledgered once');
    assert.equal((await inspect('select public.has_own_learning_course_access($1,1) as allowed', [liveLearnerId])).rows[0].allowed, false,
      'a fully refunded invoice no longer authorizes access for its paid period');
    assert.equal((await db.query('select outcome from public.process_paystack_live_subscription_refund_event($1)', [refundEventId])).rows[0].outcome,
      'already_processed', 'replaying verified provider evidence is idempotent');

    const liveRefundOperations = await db.query(
      'select * from public.list_learning_live_subscription_refund_operations($1,$2,10)',
      [operatorId, 'live-learner@example.test'],
    );
    assert.equal(liveRefundOperations.rows.length, 1,
      'admin payment operations should find the Live invoice by learner email');
    assert.deepEqual({
      invoice_reference: liveRefundOperations.rows[0].invoice_reference,
      learner_email: liveRefundOperations.rows[0].learner_email,
      invoice_status: liveRefundOperations.rows[0].invoice_status,
      refund_status: liveRefundOperations.rows[0].refund_status,
      refund_provider_status: liveRefundOperations.rows[0].refund_provider_status,
      refund_provider_case_id: liveRefundOperations.rows[0].refund_provider_case_id,
    }, {
      invoice_reference: liveInvoiceReference,
      learner_email: 'live-learner@example.test',
      invoice_status: 'refunded',
      refund_status: 'processed',
      refund_provider_status: 'processed',
      refund_provider_case_id: '123456',
    }, 'the admin projection should show only the invoice and its exact verified refund state');
    await assert.rejects(db.query(
      'select * from public.list_learning_live_subscription_refund_operations($1,null,10)', [instructorId],
    ), /Active administrator required/,
    'an instructor must not read the admin refund operations projection');

    const invoiceRefundEvents = await db.query(
      'select * from public.list_learning_live_subscription_refund_case_events($1,$2)',
      [operatorId, [invoiceRefundCase.case_id]],
    );
    const refundEventTypes = invoiceRefundEvents.rows.map((event) => event.event_type);
    assert.ok(refundEventTypes.includes('refund.requested'));
    assert.ok(refundEventTypes.includes('refund.submitting'));
    assert.ok(refundEventTypes.includes('refund.processed'));
    assert.ok(invoiceRefundEvents.rows.every((event) => event.refund_case_id === invoiceRefundCase.case_id),
      'the admin refund timeline must stay scoped to explicitly requested invoice cases');

    const privateRefundOperations = 'public.list_learning_live_subscription_refund_operations(uuid,text,integer)';
    const privateRefundEvents = 'public.list_learning_live_subscription_refund_case_events(uuid,bigint[])';
    for (const role of ['anon', 'authenticated']) {
      const grants = await db.query(`select has_function_privilege($1,$2,'execute') as operations,
        has_function_privilege($1,$3,'execute') as events`, [role, privateRefundOperations, privateRefundEvents]);
      assert.deepEqual(grants.rows[0], { operations: false, events: false },
        `${role} must not execute admin-only subscription refund projections`);
    }
    const serviceGrants = await db.query(`select has_function_privilege('service_role',$1,'execute') as operations,
      has_function_privilege('service_role',$2,'execute') as events`, [privateRefundOperations, privateRefundEvents]);
    assert.deepEqual(serviceGrants.rows[0], { operations: true, events: true },
      'the server-side service role must be able to render admin refund operations and history');

    const receiveExecute = `public.receive_learning_subscription_provider_event(text,text,text,jsonb,uuid,uuid,text)`;
    const processExecute = `public.process_learning_subscription_provider_event(bigint,jsonb)`;
    const privatePlanExecute = `public.get_company_test_learning_subscription_plan_for_checkout(uuid)`;
    const beginCheckoutExecute = `public.begin_own_learning_test_subscription_checkout(uuid,uuid,uuid)`;
    const reconcileExecute = `public.reconcile_own_learning_test_subscription_payment(uuid,text,uuid,uuid,text,bigint,bigint,bigint,text,jsonb)`;
    const listSubscriptionsExecute = `public.list_own_learning_subscriptions()`;
    for (const role of ['anon', 'authenticated']) {
      const grants = await db.query(`select has_function_privilege($1,$2,'execute') as receive,
        has_function_privilege($1,$3,'execute') as process,
        has_function_privilege($1,$4,'execute') as private_plan,
        has_function_privilege($1,$5,'execute') as begin_checkout,
        has_function_privilege($1,$6,'execute') as reconcile`,
      [role, receiveExecute, processExecute, privatePlanExecute, beginCheckoutExecute, reconcileExecute]);
      assert.deepEqual(grants.rows[0], { receive: false, process: false, private_plan: false, begin_checkout: false, reconcile: false },
        `${role} must not execute subscription provider, private plan, or checkout RPCs`);
    }
    assert.equal((await db.query(`select has_function_privilege('authenticated',$1,'execute') as allowed`, [listSubscriptionsExecute])).rows[0].allowed, true,
      'authenticated learners may call the ownership-filtered subscription status projection');
    assert.equal((await db.query(`select has_function_privilege('anon',$1,'execute') as allowed`, [listSubscriptionsExecute])).rows[0].allowed, false,
      'anonymous users may not call the private subscription status projection');
    await db.exec('reset role');

    // A separate, already-matured invoice proves release is invoice-backed,
    // balanced, admin-only, and idempotent without contacting a provider.
    const maturedInvoiceId = '30000000-0000-4000-8000-000000000003';
    const maturedPeriodStart = utcMonthStart(-1);
    const maturedPeriodEnd = utcMonthStart(0);
    const maturedPaidAt = new Date(new Date(maturedPeriodStart).getTime() + 5 * 60 * 1000).toISOString();
    await db.query(`insert into public.learning_subscription_invoices(
      id,subscription_id,instructor_id,plan_name_snapshot,billing_period_starts_at,paid_through,
      provider_reference,payment_domain,amount_minor,platform_share_minor,seller_share_minor,
      commercial_terms_version,provider_transaction_id,provider_transaction_reference,status
    ) values ($1,$2,$3,'Live monthly catalog',$4,$5,$6,'live',5000,1250,3750,
      'growvelt-commercial-v1','90009','provider-live-charge-90009','payment_pending')`,
    [maturedInvoiceId, liveSubscriptionId, instructorId, maturedPeriodStart, maturedPeriodEnd, `GS-${'D'.repeat(32)}`]);
    await db.query(`insert into public.learning_subscription_invoice_courses(
      invoice_id,course_id,course_title_snapshot
    ) values ($1,1,'Tested paid course')`, [maturedInvoiceId]);
    await db.query(`update public.learning_subscription_invoices
      set status='paid',paid_at=$2 where id=$1`, [maturedInvoiceId, maturedPaidAt]);
    await db.exec('set role service_role');
    await assert.rejects(
      db.query('select public.release_matured_learning_subscription_invoice_earnings($1,10)', [instructorId]),
      /Active administrator and valid release limit required/,
      'an instructor cannot release subscription invoice earnings',
    );
    assert.equal((await db.query('select public.release_matured_learning_subscription_invoice_earnings($1,10) as count',
      [operatorId])).rows[0].count, 1, 'only the matured and unrefunded Live invoice may release');
    assert.equal((await db.query('select public.release_matured_learning_subscription_invoice_earnings($1,10) as count',
      [operatorId])).rows[0].count, 0, 'a released invoice cannot be released twice');
    const released = (await inspect(`select e.id as earning_id,e.status,e.released_at is not null as released,
      a.subscription_invoice_id from public.learning_instructor_earnings e
      join public.learning_commercial_allocations a on a.id=e.allocation_id
      where a.subscription_invoice_id=$1`, [maturedInvoiceId])).rows[0];
    assert.deepEqual(released, { earning_id: released.earning_id, status: 'available', released: true,
      subscription_invoice_id: maturedInvoiceId });
    const releaseLedger = (await inspect(`select t.id,sum(entry.amount_minor)::bigint as balance,
      count(entry.id)::int as entries from public.learning_ledger_transactions t
      join public.learning_ledger_entries entry on entry.transaction_id=t.id
      where t.subscription_invoice_id=$1 and t.order_id is null
        and t.transaction_type='instructor_earnings_release'
      group by t.id`, [maturedInvoiceId])).rows;
    assert.equal(releaseLedger.length, 1);
    assert.deepEqual({ balance: releaseLedger[0].balance, entries: releaseLedger[0].entries },
      { balance: 0, entries: 2 }, 'the invoice release must have one balanced ledger pair');
    const releaseFunction = 'public.release_matured_learning_subscription_invoice_earnings(uuid,integer)';
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query(`select has_function_privilege($1,$2,'execute') as allowed`,
        [role, releaseFunction])).rows[0].allowed, false,
      `${role} must not execute the subscription earnings release`);
    }
    const reserve = (key, actor = operatorId) => db.query(
      'select * from public.reserve_learning_subscription_invoice_earning($1,$2,$3,$4)',
      [released.earning_id, instructorId, key, actor],
    );
    await assert.rejects(reserve('subscription:unauthorized', instructorId),
      /Valid administrator and reservation identity required/);
    const reserved = (await reserve('subscription:controlled')).rows[0];
    assert.equal(reserved.earning_id, released.earning_id);
    assert.equal(reserved.amount_minor, 3750);
    assert.equal((await reserve('subscription:controlled')).rows[0].reservation_id,
      reserved.reservation_id, 'the same claim must return the original reservation');
    await assert.rejects(reserve('subscription:duplicate'), /not eligible for reservation/,
      'a second key cannot reserve the same earning twice');
    assert.equal((await inspect('select status from public.learning_instructor_earnings where id=$1',
      [released.earning_id])).rows[0].status, 'reserved');
    assert.equal((await inspect(`select count(*)::int as count from public.learning_instructor_earning_reservations
      where earning_id=$1`, [released.earning_id])).rows[0].count, 1);
    await db.exec('reset role');

    console.log('PASS isolated subscription DB lifecycle: gated Live plan setup, Test checkout, held and matured Live invoice earnings, idempotent invoice reservation, invoice refund reversal, and access preservation');
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
