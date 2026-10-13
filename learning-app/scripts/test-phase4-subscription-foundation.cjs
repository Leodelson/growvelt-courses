/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_PACKAGE_PATH || '@electric-sql/pglite');

const migration = readFileSync(path.resolve(__dirname,
  '../supabase/migrations/20261022000000_add_private_learning_subscription_foundation.sql'), 'utf8');
const planManagementMigration = readFileSync(path.resolve(__dirname,
  '../supabase/migrations/20261023000000_add_learning_subscription_plan_management.sql'), 'utf8');
const provisioningMigration = readFileSync(path.resolve(__dirname,
  '../supabase/migrations/20261024000000_add_idempotent_subscription_test_plan_provisioning.sql'), 'utf8');
const instructorId = '00000000-0000-4000-8000-000000000002';
const learnerId = '00000000-0000-4000-8000-000000000003';
const secondInstructorId = '00000000-0000-4000-8000-000000000004';
const planId = '10000000-0000-4000-8000-000000000001';
const draftPlanId = '10000000-0000-4000-8000-000000000002';
const subscriptionId = '20000000-0000-4000-8000-000000000001';
const invoiceId = '30000000-0000-4000-8000-000000000001';

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table public.profiles(id uuid primary key, full_name text);
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
      create table public.learning_commercial_terms(
        version text primary key, scope_type text not null, instructor_id uuid,
        active boolean not null, effective_at timestamptz not null, retired_at timestamptz
      );
      create function public.is_paystack_test_fixture_course(p_course_id bigint)
        returns boolean language sql stable as $$ select p_course_id = 90 $$;
      create function public.resolve_learning_commercial_terms_version(p_course_id bigint, p_instructor_id uuid)
        returns text language sql stable as $$
          select case when p_course_id=7 then 'instructor-commercial-v2' else 'growvelt-commercial-v1' end
        $$;
      insert into public.profiles values
        ('${instructorId}','Instructor'),('${learnerId}','Learner'),('${secondInstructorId}','Second Instructor');
      insert into public.account_capabilities values
        ('${instructorId}','instructor','active'),('${secondInstructorId}','instructor','active');
      insert into public.instructor_profiles values
        ('${instructorId}','approved'),('${secondInstructorId}','approved');
      insert into public.learning_commercial_terms
        values ('growvelt-commercial-v1','platform',null,true,now()-interval '1 day',null),
        ('instructor-commercial-v2','instructor','${instructorId}',true,now()-interval '1 day',null);
      insert into public.learning_courses(id,instructor_id,title,status,organization_id,is_free,
        is_limited_time_free,price_currency,price_amount,company_test_mode_only) values
        (1,'${instructorId}','Published paid','published',null,false,false,'NGN',1000,false),
        (2,'${instructorId}','Free','published',null,true,false,'NGN',null,false),
        (3,'${instructorId}','Organization','published',10,false,false,'NGN',1000,false),
        (4,null,'Unowned','published',null,false,false,'NGN',1000,false),
        (5,'${instructorId}','Company-only','published',null,false,false,'NGN',1000,true),
        (90,'${instructorId}','Paystack fixture','published',null,false,false,'NGN',1000,false),
        (6,'${secondInstructorId}','Another instructor course','published',null,false,false,'NGN',1000,false),
        (7,'${instructorId}','Different terms','published',null,false,false,'NGN',1000,false);
    `);
    await db.exec(migration);
    await db.exec(planManagementMigration);
    await db.exec(provisioningMigration);

    await db.query(`insert into public.learning_subscription_plans
      (id,instructor_id,name,amount_minor,commercial_terms_version)
      values ($1,$2,'Monthly catalog',5000,'growvelt-commercial-v1')`, [planId, instructorId]);
    await db.query(`insert into public.learning_subscription_plan_courses(plan_id,instructor_id,course_id)
      values ($1,$2,1)`, [planId, instructorId]);
    await db.query("update public.learning_subscription_plans set status='active' where id=$1", [planId]);

    await db.query(`insert into public.learning_subscription_plans
      (id,instructor_id,name,amount_minor,commercial_terms_version)
      values ($1,$2,'Draft validation plan',5000,'growvelt-commercial-v1')`, [draftPlanId, instructorId]);
    for (const courseId of [2,3,4,5,90]) {
      await assert.rejects(db.query(`insert into public.learning_subscription_plan_courses(plan_id,instructor_id,course_id)
        values ($1,$2,$3)`, [draftPlanId, instructorId, courseId]), /Only the instructor’s published public paid NGN courses/);
    }
    await assert.rejects(db.query("update public.learning_subscription_plans set status='draft' where id=$1", [planId]),
      /Subscription plan cannot be reactivated or returned to draft/);

    await db.query(`insert into public.learning_subscriptions(id,plan_id,learner_id)
      values ($1,$2,$3)`, [subscriptionId, planId, learnerId]);
    await db.query(`insert into public.learning_subscription_invoices(
      id,subscription_id,instructor_id,plan_name_snapshot,billing_period_starts_at,paid_through,
      provider_reference,amount_minor,platform_share_minor,seller_share_minor,commercial_terms_version,status,paid_at
    ) values ($1,$2,$3,'Monthly catalog','2026-10-01T00:00:00Z','2026-11-01T00:00:00Z',
      'GS-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',5000,1250,3750,'growvelt-commercial-v1','paid',now())`,
    [invoiceId, subscriptionId, instructorId]);
    await db.query(`insert into public.learning_subscription_invoice_courses(invoice_id,course_id,course_title_snapshot)
      values ($1,1,'Published paid')`, [invoiceId]);
    await db.query(`insert into public.learning_subscription_provider_events(
      provider_event_id,event_type,payload_digest,signature_valid,subscription_id,invoice_id,processing_status,processed_at
    ) values ('evt_test_001','invoice.update',repeat('a',64),true,$1,$2,'processed',now())`, [subscriptionId, invoiceId]);

    await assert.rejects(db.query(`insert into public.learning_subscription_invoices(
      subscription_id,instructor_id,plan_name_snapshot,billing_period_starts_at,paid_through,provider_reference,
      amount_minor,platform_share_minor,seller_share_minor,commercial_terms_version
    ) values ($1,$2,'Monthly catalog','2026-10-01','2026-11-01','GS-BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      5000,1500,3750,'growvelt-commercial-v1')`, [subscriptionId, instructorId]), /split_check/);
    await assert.rejects(db.query(`insert into public.learning_subscription_plans(
      instructor_id,name,amount_minor,commercial_terms_version,payment_domain
    ) values ($1,'Live plan',5000,'growvelt-commercial-v1','live')`, [instructorId]), /payment_domain_check/);

    const tables = [
      'learning_subscription_plans', 'learning_subscription_plan_courses', 'learning_subscriptions',
      'learning_subscription_invoices', 'learning_subscription_invoice_courses', 'learning_subscription_provider_events',
      'learning_subscription_plan_provisioning',
    ];
    for (const table of tables) {
      const grants = await db.query(`select has_table_privilege('anon',$1,'select') as anon_select,
        has_table_privilege('authenticated',$1,'select') as authenticated_select,
        has_table_privilege('service_role',$1,'select') as service_select`, [`public.${table}`]);
      assert.deepEqual(grants.rows[0], { anon_select: false, authenticated_select: false, service_select: false },
        `${table} must not be directly exposed to browser or service roles`);
      const rls = await db.query(`select relrowsecurity from pg_class where oid=$1::regclass`, [`public.${table}`]);
      assert.equal(rls.rows[0].relrowsecurity, true, `${table} must have RLS enabled`);
    }

    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.learning_subscription_invoices'), /permission denied/);
    await db.exec('reset role');

    await db.exec('set role authenticated');
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [instructorId]);
    const planCourses = await db.query('select * from public.list_own_learning_subscription_plan_courses()');
    assert.deepEqual(planCourses.rows.map((course) => course.course_id), [7, 1]);
    assert.equal(planCourses.rows.find((course) => course.course_id === 1).commercial_terms_version, 'growvelt-commercial-v1');
    const createdPlan = await db.query(`select public.create_own_learning_subscription_plan(
      $1,$2,$3,$4::bigint[]) as plan_id`,
    ['Instructor Monthly', 'A private test-mode subscription plan', 149900, [1]]);
    const ownerList = await db.query('select * from public.list_own_learning_subscription_plans()');
    const createdPlanRow = ownerList.rows.find((row) => row.plan_id === createdPlan.rows[0].plan_id);
    assert.ok(createdPlanRow, 'the caller should see the plan it created');
    assert.equal(Number(createdPlanRow.amount_minor), 149900);
    assert.deepEqual(createdPlanRow.course_ids, [1]);
    assert.deepEqual(createdPlanRow.course_titles, ['Published paid']);
    assert.equal(createdPlanRow.status, 'draft');
    const claimed = await db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [createdPlan.rows[0].plan_id]);
    assert.equal(claimed.rows[0].provisioning_state, 'claimed');
    assert.equal(claimed.rows[0].plan_name, 'Instructor Monthly');
    assert.equal(Number(claimed.rows[0].amount_minor), 149900);
    const duplicateClaim = await db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [createdPlan.rows[0].plan_id]);
    assert.equal(duplicateClaim.rows[0].provisioning_state, 'in_progress', 'a duplicate request must not call Paystack again');
    await assert.rejects(db.query('select * from public.learning_subscription_plan_provisioning'), /permission denied/);
    await assert.rejects(db.query(`select public.record_own_learning_subscription_plan_provisioning($1,$2,'PLN_gx2wn530m0i3w3m')`, [createdPlan.rows[0].plan_id, instructorId]), /permission denied/);
    await assert.rejects(db.query(`select public.finish_own_learning_subscription_plan_provisioning($1,$2,'ambiguous')`, [createdPlan.rows[0].plan_id, instructorId]), /permission denied/);
    await db.exec('set role service_role');
    await assert.rejects(db.query(`select public.record_own_learning_subscription_plan_provisioning($1,$2,'bad-code')`, [createdPlan.rows[0].plan_id, instructorId]), /Paystack plan code is invalid/);
    assert.equal((await db.query(`select public.record_own_learning_subscription_plan_provisioning($1,$2,'PLN_gx2wn530m0i3w3m') as state`, [createdPlan.rows[0].plan_id, instructorId])).rows[0].state, 'recorded');
    assert.equal((await db.query(`select public.record_own_learning_subscription_plan_provisioning($1,$2,'PLN_gx2wn530m0i3w3m') as state`, [createdPlan.rows[0].plan_id, instructorId])).rows[0].state, 'recorded', 'provider confirmation retries must be idempotent');
    await db.exec('set role authenticated');
    const recordedPlan = await db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [createdPlan.rows[0].plan_id]);
    assert.equal(recordedPlan.rows[0].provisioning_state, 'recorded');
    assert.equal(recordedPlan.rows[0].existing_plan_code, 'PLN_gx2wn530m0i3w3m');

    const retryDraft = await db.query(`select public.create_own_learning_subscription_plan('Retry monthly', null, 2500, array[1]::bigint[]) as plan_id`);
    await db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [retryDraft.rows[0].plan_id]);
    await db.exec('set role service_role');
    assert.equal((await db.query(`select public.finish_own_learning_subscription_plan_provisioning($1,$2,'provider_rejected') as state`, [retryDraft.rows[0].plan_id, instructorId])).rows[0].state, 'failed');
    await db.exec('set role authenticated');
    const retryClaim = await db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [retryDraft.rows[0].plan_id]);
    assert.equal(retryClaim.rows[0].provisioning_state, 'claimed', 'a definite provider rejection may be safely retried');
    assert.equal(retryClaim.rows[0].attempt_count, 2);
    await db.exec('set role service_role');
    assert.equal((await db.query(`select public.finish_own_learning_subscription_plan_provisioning($1,$2,'ambiguous') as state`, [retryDraft.rows[0].plan_id, instructorId])).rows[0].state, 'needs_reconciliation');
    await assert.rejects(db.query(`select public.finish_own_learning_subscription_plan_provisioning($1,$2,'unknown')`, [retryDraft.rows[0].plan_id, instructorId]), /Provisioning outcome is invalid/);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [retryDraft.rows[0].plan_id])).rows[0].provisioning_state, 'needs_reconciliation', 'an uncertain provider outcome must not be retried');

    const staleDraft = await db.query(`select public.create_own_learning_subscription_plan('Stale monthly', null, 3500, array[1]::bigint[]) as plan_id`);
    await db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [staleDraft.rows[0].plan_id]);
    await db.exec('reset role');
    await db.query(`update public.learning_subscription_plan_provisioning
      set claimed_at=now()-interval '6 minutes' where plan_id=$1`, [staleDraft.rows[0].plan_id]);
    await db.exec('set role authenticated');
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [instructorId]);
    assert.equal((await db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [staleDraft.rows[0].plan_id])).rows[0].provisioning_state,
      'needs_reconciliation', 'a stale claim must be parked, not automatically retried');

    await assert.rejects(db.query(`select public.create_own_learning_subscription_plan(
      'Invalid owner course', null, 1000, array[6]::bigint[])`), /Every selected course must be your published public paid NGN course/);
    await assert.rejects(db.query(`select public.create_own_learning_subscription_plan(
      'Mixed terms plan', null, 1000, array[1,7]::bigint[])`), /All courses in one plan must use the same active commercial terms/);
    await assert.rejects(db.query(`select public.create_own_learning_subscription_plan(
      'Duplicate course plan', null, 1000, array[1,1]::bigint[])`), /Selected course IDs must be unique and non-null/);
    await assert.rejects(db.query(`select public.create_own_learning_subscription_plan(
      'No courses', null, 1000, array[]::bigint[])`), /Select between 1 and 50 courses/);
    await assert.rejects(db.query('select * from public.learning_subscription_plans'), /permission denied/);

    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [secondInstructorId]);
    const otherOwnerList = await db.query('select * from public.list_own_learning_subscription_plans()');
    assert.equal(otherOwnerList.rows.length, 0, 'another approved instructor must not see this plan');
    assert.equal((await db.query('select * from public.list_own_learning_subscription_plan_provisioning()')).rows.length, 0,
      'another approved instructor must not see provisioning metadata');
    await assert.rejects(db.query('select * from public.claim_own_learning_subscription_plan_provisioning($1)', [createdPlan.rows[0].plan_id]), /Subscription plan is unavailable/);

    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [learnerId]);
    await assert.rejects(db.query('select * from public.list_own_learning_subscription_plans()'), /Approved Instructor capability required/);
    await assert.rejects(db.query('select * from public.list_own_learning_subscription_plan_courses()'), /Approved Instructor capability required/);
    await db.exec('reset role');

    const audit = await db.query(`select actor_user_id, actor_role, action, entity_type, metadata
      from public.learning_audit_events where entity_id=$1 and action='subscription_plan.draft_created'`, [createdPlan.rows[0].plan_id]);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].actor_user_id, instructorId);
    assert.equal(audit.rows[0].actor_role, 'instructor');
    assert.equal(audit.rows[0].action, 'subscription_plan.draft_created');
    assert.deepEqual(audit.rows[0].metadata.course_ids, [1]);

    for (const [role, expected] of [['anon', false], ['authenticated', true]]) {
      const permission = await db.query(`select has_function_privilege($1,
        'public.create_own_learning_subscription_plan(text,text,bigint,bigint[])','execute') as allowed`, [role]);
      assert.equal(permission.rows[0].allowed, expected, `${role} plan creation RPC permission`);
    }

    for (const [role, expected] of [['anon', false], ['authenticated', true]]) {
      const permission = await db.query(`select has_function_privilege($1,
        'public.claim_own_learning_subscription_plan_provisioning(uuid)','execute') as allowed`, [role]);
      assert.equal(permission.rows[0].allowed, expected, `${role} provider provisioning claim permission`);
    }

    for (const [role, expected] of [['anon', false], ['authenticated', false], ['service_role', true]]) {
      for (const signature of [
        'public.record_own_learning_subscription_plan_provisioning(uuid,uuid,text)',
        'public.finish_own_learning_subscription_plan_provisioning(uuid,uuid,text)',
      ]) {
        const permission = await db.query('select has_function_privilege($1,$2,\'execute\') as allowed', [role, signature]);
        assert.equal(permission.rows[0].allowed, expected, `${role} provider confirmation permission for ${signature}`);
      }
    }

    console.log('PASS private subscription schema, approved-instructor plan RPCs, duplicate-safe Test Mode provisioning, retry/reconciliation states, plan privacy, invoice integrity, and browser-role denial');
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
